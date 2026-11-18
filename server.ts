import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface AttributeFieldInput {
  id: string;
  label: string;
  existingOptions?: string[];
}

interface AutofillRequestBody {
  species?: string;
  category?: string;
  variety?: string;
  attributeFields?: AttributeFieldInput[];
}

interface BatchAutofillItem {
  key: string;
  species: string;
  category?: string;
  variety: string;
}

interface BatchAutofillRequestBody {
  items?: BatchAutofillItem[];
  attributeFields?: AttributeFieldInput[];
}

interface ApiHttpError extends Error {
  status?: number;
  statusCode?: number;
  retryAfterSeconds?: number;
}

function sanitizeMonthList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const nums = raw
    .map((m) => Math.floor(Number(m)))
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractStatusCode(err: unknown): number {
  const e = err as { status?: number; statusCode?: number; message?: string };
  if (typeof e?.statusCode === 'number') return e.statusCode;
  if (typeof e?.status === 'number') return e.status;
  const msg = String(e?.message || '');
  const codeMatch = msg.match(/"code"\s*:\s*(\d{3})/);
  if (codeMatch) return Number(codeMatch[1]);
  if (msg.includes('RESOURCE_EXHAUSTED')) return 429;
  return 500;
}

function extractRetryDelayMs(err: unknown): number | null {
  const msg = String((err as { message?: string })?.message || '');
  const retryInMatch = msg.match(/Please retry in\s+([0-9.]+)(ms|s)/i);
  if (retryInMatch) {
    const val = Number(retryInMatch[1]);
    if (Number.isFinite(val)) {
      return retryInMatch[2].toLowerCase() === 'ms'
        ? Math.ceil(val)
        : Math.ceil(val * 1000);
    }
  }
  const delayJsonMatch = msg.match(/"retryDelay"\s*:\s*"([0-9.]+)s"/i);
  if (delayJsonMatch) {
    const val = Number(delayJsonMatch[1]);
    if (Number.isFinite(val)) {
      return Math.ceil(val * 1000);
    }
  }
  return null;
}

const AUTOFILL_MODELS: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
  { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
  { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
];

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`Délai d'attente dépassé (${label}).`) as ApiHttpError;
          err.statusCode = 504;
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function callGeminiWithRetry<T>(
  fn: (modelConfig: { model: string; thinkingLevel: ThinkingLevel }) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let mIdx = 0; mIdx < AUTOFILL_MODELS.length; mIdx++) {
    const modelCfg = AUTOFILL_MODELS[mIdx];
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await withTimeout(
          fn(modelCfg),
          16000,
          `${modelCfg.model}`
        );
      } catch (err: unknown) {
        lastError = err;
        const status = extractStatusCode(err);
        const retryDelayMs = extractRetryDelayMs(err);

        if (status === 429) {
          const waitMs = retryDelayMs !== null ? retryDelayMs + 400 : 2000 * attempt;
          // Only sleep server-side for very short burst limits (<= 6s).
          if (attempt < maxAttempts && waitMs <= 6000) {
            await sleep(waitMs);
            continue;
          }
          // Try next fallback model if available before returning 429
          if (mIdx < AUTOFILL_MODELS.length - 1) {
            break;
          }
          const retryErr = new Error(
            'Limite temporaire de requêtes atteinte. Patientez quelques secondes avant de relancer.'
          ) as ApiHttpError;
          retryErr.statusCode = 429;
          retryErr.retryAfterSeconds = Math.max(5, Math.ceil(waitMs / 1000));
          throw retryErr;
        }

        if (status === 503 || status === 504 || status === 500) {
          if (attempt < maxAttempts) {
            await sleep(800);
            continue;
          }
          // Try next fallback model
          break;
        }

        throw err;
      }
    }
  }
  if (lastError) throw lastError;
  throw new Error('Échec inattendu lors de la génération.');
}

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatFieldDescriptions(attributeFields: AttributeFieldInput[]): string {
  return attributeFields
    .map((f) => {
      const opts =
        Array.isArray(f.existingOptions) && f.existingOptions.length > 0
          ? ` (exemples existants dans le catalogue : ${f.existingOptions.slice(0, 15).join(', ')})`
          : '';
      return `- id="${f.id}" | libellé="${f.label}"${opts}`;
    })
    .join('\n');
}

function mapRawAttributes(
  rawAttributes: unknown,
  allowedIds: Set<string>
): Record<string, string> {
  const attributesMap: Record<string, string> = {};
  if (Array.isArray(rawAttributes)) {
    for (const item of rawAttributes) {
      const id = String((item as { id?: string })?.id || '').trim();
      const value = String((item as { value?: string })?.value || '').trim();
      if (id && value && allowedIds.has(id)) {
        attributesMap[id] = value;
      }
    }
  }
  return attributesMap;
}

async function generateVarietyDetails(body: AutofillRequestBody) {
  const ai = createGeminiClient();
  if (!ai) {
    const err = new Error('GEMINI_API_KEY_MISSING') as ApiHttpError;
    err.statusCode = 503;
    throw err;
  }

  const species = String(body.species || '').trim();
  const category = String(body.category || '').trim();
  const variety = String(body.variety || '').trim();
  const attributeFields = Array.isArray(body.attributeFields) ? body.attributeFields : [];
  const fieldDescriptions = formatFieldDescriptions(attributeFields);

  const prompt = [
    `Tu es un expert en arboriculture, maraîchage et botanique (climat tempéré français / Europe de l'Ouest).`,
    `Donne la fiche technique précise et factuelle pour :`,
    `- Plante / Espèce : "${species}"${category ? ` (catégorie : "${category}")` : ''}`,
    `- Variété : "${variety}"`,
    ``,
    `Consignes strictes :`,
    `1. Renseigne chaque champ personnalisé demandé ci-dessous en français, de façon concise (1 à 6 mots maximum par champ, sans phrase longue, adapté à une étiquette ou fiche catalogue).`,
    `   - Si un champ concerne une couleur ("Couleur"), indique des couleurs simples en français (ex: "Rouge carmin", "Jaune doré").`,
    `   - Si un champ concerne un emoji ("Emoji"), donne un seul emoji pertinent.`,
    `   - Si une information varie ou reste incertaine pour une variété très rare ou générique ("Inconnu", "Standard"), donne la valeur la plus représentative de l'espèce et indique confidence="low" ou "medium".`,
    `   - Utilise les exemples existants du catalogue quand ils correspondent bien, tout en restant précis pour cette variété.`,
    attributeFields.length > 0
      ? `Champs demandés :\n${fieldDescriptions}`
      : `Aucun champ personnalisé supplémentaire demandé.`,
    `2. "harvestMonths" : liste des numéros de mois de récolte / cueillette à maturité en France (entiers de 1=Janvier à 12=Décembre).`,
    `3. "storageMonths" : liste des numéros de mois de conservation / stockage APRES récolte (entiers de 1 à 12). Laisse [] si consommation fraîche immédiate (cerises, fraises, tomates, laitues...) ; renseigne les mois de garde pour les pommes de garde, poires tardives, courges, kiwis, noix, pommes de terre, etc.`,
    `4. "comment" : 1 à 3 phrases synthétiques et pratiques en français (caractéristiques gustatives, port/vigueur, pollinisation si fruitier, résistance/sensibilité maladies, meilleur usage culinaire ou conseil de culture).`,
  ].join('\n');

  const response = await callGeminiWithRetry(({ model, thinkingLevel }) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel },
        systemInstruction:
          'Réponds uniquement en JSON valide selon le schéma demandé. Sois précis sur les variétés horticoles et fruitières françaises.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            attributes: {
              type: Type.ARRAY,
              description: 'Liste des valeurs pour chaque champ personnalisé demandé.',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Identifiant exact du champ fourni.' },
                  value: { type: Type.STRING, description: 'Valeur concise en français pour ce champ.' },
                },
                required: ['id', 'value'],
              },
            },
            harvestMonths: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: 'Mois de récolte (1 à 12).',
            },
            storageMonths: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: 'Mois de conservation après récolte (1 à 12).',
            },
            comment: {
              type: Type.STRING,
              description: 'Résumé / observations pratiques sur la variété en français (1 à 3 phrases).',
            },
            confidence: {
              type: Type.STRING,
              description: 'Niveau de certitude : high, medium ou low.',
            },
          },
          required: ['attributes', 'harvestMonths', 'storageMonths', 'comment', 'confidence'],
        },
      },
    })
  );

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text) as {
    attributes?: Array<{ id?: string; value?: string }>;
    harvestMonths?: number[];
    storageMonths?: number[];
    comment?: string;
    confidence?: string;
  };

  const allowedIds = new Set(attributeFields.map((f) => f.id));

  return {
    attributes: mapRawAttributes(parsed.attributes, allowedIds),
    harvestMonths: sanitizeMonthList(parsed.harvestMonths),
    storageMonths: sanitizeMonthList(parsed.storageMonths),
    comment: String(parsed.comment || '').trim(),
    confidence:
      parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
        ? parsed.confidence
        : 'medium',
  };
}

async function generateVarietiesBatch(body: BatchAutofillRequestBody) {
  const ai = createGeminiClient();
  if (!ai) {
    const err = new Error('GEMINI_API_KEY_MISSING') as ApiHttpError;
    err.statusCode = 503;
    throw err;
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems
    .map((item) => ({
      key: String(item?.key || '').trim(),
      species: String(item?.species || '').trim(),
      category: String(item?.category || '').trim(),
      variety: String(item?.variety || '').trim(),
    }))
    .filter((item) => item.key && item.species && item.variety)
    .slice(0, 15);

  if (items.length === 0) {
    return { results: {} };
  }

  const attributeFields = Array.isArray(body.attributeFields) ? body.attributeFields : [];
  const fieldDescriptions = formatFieldDescriptions(attributeFields);

  const itemsListText = items
    .map(
      (item, idx) =>
        `${idx + 1}. key="${item.key}" | Plante="${item.species}"${item.category ? ` (${item.category})` : ''} | Variété="${item.variety}"`
    )
    .join('\n');

  const prompt = [
    `Tu es un expert en arboriculture, maraîchage et botanique (climat tempéré français / Europe de l'Ouest).`,
    `Génère la fiche technique précise et factuelle pour CHACUNE des ${items.length} variétés ci-dessous.`,
    ``,
    `Liste des variétés à traiter (conserve impérativement le "key" exact pour chaque entrée) :`,
    itemsListText,
    ``,
    `Consignes strictes pour chaque entrée :`,
    `1. Renseigne chaque champ personnalisé demandé ci-dessous en français, de façon concise (1 à 5 mots maximum par champ, adapté à une fiche catalogue).`,
    `   - Si un champ concerne une couleur ("Couleur"), indique des couleurs simples en français.`,
    `   - Si un champ concerne un emoji ("Emoji"), donne un seul emoji pertinent.`,
    `   - Si une variété est très rare ou générique ("Inconnu", "Standard"), donne les valeurs les plus représentatives de l'espèce avec confidence="low" ou "medium".`,
    attributeFields.length > 0
      ? `Champs demandés :\n${fieldDescriptions}`
      : `Aucun champ personnalisé supplémentaire demandé.`,
    `2. "harvestMonths" : liste des numéros de mois de récolte à maturité en France (entiers de 1 à 12).`,
    `3. "storageMonths" : liste des numéros de mois de conservation APRÈS récolte (entiers de 1 à 12). Laisse [] pour les fruits/légumes de consommation fraîche immédiate.`,
    `4. "comment" : 1 à 2 phrases synthétiques et pratiques en français (goût, port/vigueur, pollinisation si fruitier, résistance/sensibilité maladies, usage ou culture).`,
  ].join('\n');

  const response = await callGeminiWithRetry(({ model, thinkingLevel }) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel },
        systemInstruction:
          'Réponds uniquement en JSON valide selon le schéma demandé. Retourne exactement une entrée par "key" fourni.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              description: 'Une fiche générée pour chaque variété demandée.',
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING, description: 'Identifiant exact "key" fourni dans la liste.' },
                  attributes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        value: { type: Type.STRING },
                      },
                      required: ['id', 'value'],
                    },
                  },
                  harvestMonths: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                  },
                  storageMonths: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                  },
                  comment: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                },
                required: ['key', 'attributes', 'harvestMonths', 'storageMonths', 'comment', 'confidence'],
              },
            },
          },
          required: ['items'],
        },
      },
    })
  );

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text) as {
    items?: Array<{
      key?: string;
      attributes?: Array<{ id?: string; value?: string }>;
      harvestMonths?: number[];
      storageMonths?: number[];
      comment?: string;
      confidence?: string;
    }>;
  };

  const allowedIds = new Set(attributeFields.map((f) => f.id));
  const allowedKeys = new Set(items.map((i) => i.key));
  const results: Record<
    string,
    {
      attributes: Record<string, string>;
      harvestMonths: number[];
      storageMonths: number[];
      comment: string;
      confidence: 'high' | 'medium' | 'low';
    }
  > = {};

  if (Array.isArray(parsed.items)) {
    for (const entry of parsed.items) {
      const key = String(entry?.key || '').trim();
      if (!key || !allowedKeys.has(key)) continue;
      results[key] = {
        attributes: mapRawAttributes(entry.attributes, allowedIds),
        harvestMonths: sanitizeMonthList(entry.harvestMonths),
        storageMonths: sanitizeMonthList(entry.storageMonths),
        comment: String(entry.comment || '').trim(),
        confidence:
          entry.confidence === 'high' || entry.confidence === 'medium' || entry.confidence === 'low'
            ? entry.confidence
            : 'medium',
      };
    }
  }

  return { results };
}

function handleAutofillError(res: express.Response, err: unknown) {
  const error = err as ApiHttpError;
  const status = extractStatusCode(error);

  if (error.message === 'GEMINI_API_KEY_MISSING') {
    return res.status(503).json({
      error:
        'Clé API non configurée sur le serveur (GEMINI_API_KEY manquante dans Settings > Secrets).',
    });
  }

  if (status === 429) {
    const retryAfterSeconds = error.retryAfterSeconds ?? 55;
    console.warn(`Quota /api/varieties/autofill temporairement atteint (retry dans ~${retryAfterSeconds}s).`);
    return res.status(429).json({
      error: `Limite de requêtes par minute atteinte. Reprise possible dans ${retryAfterSeconds}s.`,
      code: 'RATE_LIMIT',
      retryAfterSeconds,
    });
  }

  if (status === 400 || status === 403) {
    console.error('Erreur clé/permission /api/varieties/autofill:', error);
    return res.status(status).json({
      error:
        'Clé API Gemini invalide ou refusée. Vérifiez la clé configurée dans Settings > Secrets.',
    });
  }

  if (status === 503 || status === 504) {
    console.warn('Service Gemini temporairement surchargé ou timeout:', error?.message);
    return res.status(status).json({
      error:
        'Le service d’IA est temporairement surchargé ou lent. Réessayez dans quelques instants.',
    });
  }

  console.error('Erreur /api/varieties/autofill:', error);
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    error: 'Impossible de récupérer automatiquement les informations pour cette variété.',
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/varieties/autofill', async (req, res) => {
    try {
      const { species, variety } = req.body || {};
      if (!species || !variety) {
        return res.status(400).json({ error: 'Les noms de la plante et de la variété sont requis.' });
      }

      const result = await generateVarietyDetails(req.body);
      return res.json(result);
    } catch (err: unknown) {
      return handleAutofillError(res, err);
    }
  });

  app.post('/api/varieties/autofill-batch', async (req, res) => {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Une liste de variétés est requise.' });
      }

      const result = await generateVarietiesBatch(req.body);
      return res.json(result);
    } catch (err: unknown) {
      return handleAutofillError(res, err);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
