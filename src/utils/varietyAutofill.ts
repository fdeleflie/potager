import { getReferenceHarvestAndStorage, resolveVarietyHarvestAndStorage } from './harvestStorageData';
import { areVarietiesEquivalent, normalizeSpeciesName } from './varietyNormalizer';

export interface VarietyAttributeField {
  id: string;
  label: string;
  existingOptions?: string[];
}

export interface LocalVarietyProfile {
  couleur?: string;
  taille?: string;
  gout?: string;
  aspect?: string;
  hauteur?: string;
  origine?: string;
  precocite?: string;
  resistance?: string;
  comment?: string;
}

const LOCAL_VARIETY_PROFILES: Record<string, LocalVarietyProfile> = {
  // Pommiers
  'pommier___reinedesreinettes': {
    couleur: 'Jaune doré strié de rouge',
    taille: 'Moyen',
    gout: 'Sucré, acidulé, très parfumé',
    aspect: 'Peau fine dorée et orangée',
    hauteur: '3 à 4 m',
    origine: 'France / Pays-Bas (XVIIIe)',
    precocite: 'Mi-saison (fin août - septembre)',
    resistance: 'Moyenne à la tavelure',
    comment: 'Variété ancienne incontournable, excellente à croquer et en pâtisserie. Très bonne pollinisatrice pour les autres pommiers.',
  },
  'pommier___golden': {
    couleur: 'Jaune doré',
    taille: 'Moyen à gros',
    gout: 'Doux, sucré, juteux',
    aspect: 'Peau lisse jaune uniforme',
    hauteur: '3 à 4 m',
    origine: 'États-Unis (Virginie)',
    precocite: 'Tardive (septembre - octobre)',
    resistance: 'Sensible à la tavelure',
    comment: 'Pomme croquante et très productive, excellente conservation jusqu’en fin d’hiver. Bon pollinisateur.',
  },
  'pommier___belleduboskoop': {
    couleur: 'Vert-jaune lavé de rouge rugueux',
    taille: 'Gros à très gros',
    gout: 'Acidulé, aromatique, rustique',
    aspect: 'Peau épaisse légèrement liégeuse',
    hauteur: '3,5 à 4,5 m',
    origine: 'Pays-Bas (Boskoop, 1856)',
    precocite: 'Tardive (octobre)',
    resistance: 'Bonne résistance aux maladies',
    comment: 'Variété triploïde vigoureuse, reine des pommes à cuire (tartes, compotes) et de longue garde.',
  },
  'pommier___canadagris': {
    couleur: 'Gris-brun bronzé',
    taille: 'Gros',
    gout: 'Sucré, acidulé, chair fine',
    aspect: 'Peau mate et rugueuse typique',
    hauteur: '3,5 à 4,5 m',
    origine: 'France (XVIIIe siècle)',
    precocite: 'Tardive (octobre)',
    resistance: 'Bonne rusticité générale',
    comment: 'Variété triploïde ancienne très appréciée pour les tartes et la conservation hivernale en cave.',
  },
  'pommier___elstar': {
    couleur: 'Jaune lavé de rouge vif',
    taille: 'Moyen',
    gout: 'Juteux, très parfumé, équilibré',
    aspect: 'Peau fine lustrée bicolore',
    hauteur: '3 à 4 m',
    origine: 'Pays-Bas',
    precocite: 'Mi-saison (septembre)',
    resistance: 'Sensibilité moyenne à la tavelure',
    comment: 'Excellente pomme de table croquante et aromatique, très productive.',
  },
  'pommier___gala': {
    couleur: 'Rouge orangé strié sur fond jaune',
    taille: 'Moyen',
    gout: 'Doux, sucré, croquant',
    aspect: 'Peau fine brillante striée',
    hauteur: '3 à 4 m',
    origine: 'Nouvelle-Zélande',
    precocite: 'Précoce à mi-saison (fin août)',
    resistance: 'Moyenne',
    comment: 'Variété très appréciée des enfants pour sa douceur et son croquant dès la fin août.',
  },
  'pommier___grannysmith': {
    couleur: 'Vert vif',
    taille: 'Moyen à gros',
    gout: 'Très acidulé, croquant, rafraîchissant',
    aspect: 'Peau lisse verte brillante',
    hauteur: '3 à 4 m',
    origine: 'Australie (1868)',
    precocite: 'Très tardive (fin octobre)',
    resistance: 'Bonne tolérance générale',
    comment: 'Demande un bel ensoleillement automnal. Excellente garde jusqu’au printemps.',
  },
  // Poiriers
  'poirier___conference': {
    couleur: 'Vert-jaune bronzé de roux',
    taille: 'Moyen à allongé',
    gout: 'Très sucré, fondant, juteux',
    aspect: 'Forme allongée en bouteille, peau mate',
    hauteur: '3 à 4 m',
    origine: 'Angleterre (1885)',
    precocite: 'Mi-tardive (septembre)',
    resistance: 'Assez tolérante au froid et maladies',
    comment: 'Variété très fertile et partiellement autofertile, fiable chaque année et de bonne conservation.',
  },
  'poirier___williams': {
    couleur: 'Jaune doré à maturité',
    taille: 'Moyen à gros',
    gout: 'Très parfumé, musqué, fondant',
    aspect: 'Peau fine jaune paille, forme classique',
    hauteur: '3 à 4 m',
    origine: 'Angleterre (XVIIIe siècle)',
    precocite: 'Fin d’été (août - septembre)',
    resistance: 'Moyenne à la tavelure',
    comment: 'Référence gustative de fin d’été, idéale à croquer fraîche ou en poire au sirop.',
  },
  'poirier___doyenneducomice': {
    couleur: 'Jaune doré rosé au soleil',
    taille: 'Gros',
    gout: 'Fondant, très fin, sucré et parfumé',
    aspect: 'Forme ventrue et peau lisse',
    hauteur: '3 à 4 m',
    origine: 'France (Angers, 1849)',
    precocite: 'Tardive (octobre)',
    resistance: 'Moyenne',
    comment: 'Considérée comme l’une des meilleures poires de table par la finesse de sa chair.',
  },
  // Cerisiers
  'cerisier___burlat': {
    couleur: 'Rouge pourpre foncé',
    taille: 'Gros calibre',
    gout: 'Sucré, juteux, chair ferme',
    aspect: 'Cerise bigarreau brillante en cœur',
    hauteur: '4 à 6 m',
    origine: 'France (Rhône, 1930)',
    precocite: 'Très précoce (fin mai - juin)',
    resistance: 'Évite souvent la mouche grâce à sa précocité',
    comment: 'La référence des cerises précoces. Récolte hâtive limitant les attaques de ver de la cerise.',
  },
  'cerisier___napoleon': {
    couleur: 'Jaune clair lavé de rouge vif',
    taille: 'Gros',
    gout: 'Doux, acidulé, chair ferme',
    aspect: 'Bigarreau bicolore très décoratif',
    hauteur: '4 à 6 m',
    origine: 'Europe (XIXe siècle)',
    precocite: 'Mi-saison (juin - juillet)',
    resistance: 'Sensible à l’éclatement par forte pluie',
    comment: 'Excellent pollinisateur d’autres cerisiers, très bon en bocaux, confitures et cerises à l’eau-de-vie.',
  },
  // Abricotiers
  'abricotier___bergeron': {
    couleur: 'Orange vif tacheté de rouge',
    taille: 'Moyen à gros',
    gout: 'Parfumé, équilibré, sucré-acidulé',
    aspect: 'Peau veloutée orangée blushée',
    hauteur: '3 à 4 m',
    origine: 'France (Rhône, 1920)',
    precocite: 'Tardive (fin juillet - août)',
    resistance: 'Floraison tardive limitant le gel',
    comment: 'Autofertile et rustique, parfait en frais, confiture et tarte.',
  },
  // Kiwaïs & Kakis
  'kiwai___issai': {
    couleur: 'Vert lisse',
    taille: 'Petit (baie 2-3 cm)',
    gout: 'Très sucré, aromatique, sans acidité',
    aspect: 'Peau fine comestible sans poils',
    hauteur: 'Grimpante (3 à 4 m)',
    origine: 'Japon',
    precocite: 'Mi-saison (septembre - octobre)',
    resistance: 'Très rustique (-25 °C), peu sensible aux maladies',
    comment: 'Variété autofertile et très fructifère dès les premières années ; se mange entière avec la peau.',
  },
  'kaki___fuyu': {
    couleur: 'Orange vif',
    taille: 'Gros (tomate aplatie)',
    gout: 'Doux, sucré, non astringent',
    aspect: 'Fruit aplati ferme, peau lisse brillante',
    hauteur: '3 à 5 m',
    origine: 'Japon',
    precocite: 'Tardive (octobre - novembre)',
    resistance: 'Très peu sensible aux maladies',
    comment: 'Kaki non astringent : se croque ferme comme une pomme dès la récolte.',
  },
  // Tomates
  'tomate___coeurdeboeuf': {
    couleur: 'Rouge rose',
    taille: 'Gros (250 à 500 g)',
    gout: 'Doux, charnu, très peu de graines',
    aspect: 'Fruit côtelé en forme de cœur',
    hauteur: 'Indéterminée (1,8 à 2 m)',
    origine: 'Variété ancienne',
    precocite: 'Mi-tardive (70 à 80 j)',
    resistance: 'Sensibilité moyenne au mildiou',
    comment: 'Chair dense et savoureuse, idéale en salade, tomates farcies ou coulis.',
  },
  'tomate___marmande': {
    couleur: 'Rouge vif',
    taille: 'Moyen à gros (150 à 250 g)',
    gout: 'Parfumé, sucré, juteux',
    aspect: 'Fruit aplati et côtelé',
    hauteur: 'Indéterminée (1,5 m)',
    origine: 'France (Lot-et-Garonne)',
    precocite: 'Précoce à mi-saison (65 j)',
    resistance: 'Bonne tolérance au froid printanier',
    comment: 'Grand classique français rustique et productif, polyvalent cru ou cuit.',
  },
  'tomate___noiredecrimee': {
    couleur: 'Rouge sombre brun-pourpre',
    taille: 'Moyen à gros (150 à 300 g)',
    gout: 'Doux, riche, très faible acidité',
    aspect: 'Fruit légèrement aplati à épaules vert sombre',
    hauteur: 'Indéterminée (1,6 à 1,8 m)',
    origine: 'Ukraine (Crimée)',
    precocite: 'Mi-saison (70 j)',
    resistance: 'Bonne vigueur',
    comment: 'Une des tomates noires les plus appréciées en salade pour sa saveur douce et complexe.',
  },
  // Fraisiers
  'fraisier___gariguette': {
    couleur: 'Rouge orangé brillant',
    taille: 'Moyen, forme allongée',
    gout: 'Très parfumée, acidulée et sucrée',
    aspect: 'Fraise allongée fine et brillante',
    hauteur: '20 à 30 cm',
    origine: 'France (INRAE, 1976)',
    precocite: 'Très précoce (mai - juin, non remontante)',
    resistance: 'Bonne rusticité',
    comment: 'Variété printanière emblématique pour son arôme intense ; production groupée en début de saison.',
  },
  'fraisier___maradesbois': {
    couleur: 'Rouge vif',
    taille: 'Petit à moyen',
    gout: 'Parfum prononcé de fraise des bois',
    aspect: 'Fruit conique arrondi tendre',
    hauteur: '20 à 25 cm',
    origine: 'France (1991)',
    precocite: 'Remontante (juin aux gelées)',
    resistance: 'Bonne résistance générale',
    comment: 'Remontante généreuse produisant tout l’été et l’automne des fruits très aromatiques.',
  },
};

function normalizeFieldLabel(label: string): string {
  return (label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getLocalProfile(species: string, variety: string): LocalVarietyProfile | null {
  const normSpec = normalizeSpeciesName(species);
  for (const [key, profile] of Object.entries(LOCAL_VARIETY_PROFILES)) {
    const [dbSpec, dbVar] = key.split('___');
    if (normSpec === dbSpec && areVarietiesEquivalent(variety, dbVar)) {
      return profile;
    }
  }
  return null;
}

function mapLocalProfileToFields(
  profile: LocalVarietyProfile,
  fields: VarietyAttributeField[]
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const field of fields) {
    const key = normalizeFieldLabel(field.label);
    if (key.includes('couleur') || key.includes('color')) {
      if (profile.couleur) mapped[field.id] = profile.couleur;
    } else if (key.includes('taille') || key.includes('calibre')) {
      if (profile.taille) mapped[field.id] = profile.taille;
    } else if (key.includes('gout') || key.includes('saveur') || key.includes('arome')) {
      if (profile.gout) mapped[field.id] = profile.gout;
    } else if (key.includes('aspect') || key.includes('forme') || key.includes('peau')) {
      if (profile.aspect) mapped[field.id] = profile.aspect;
    } else if (key.includes('hauteur') || key.includes('port') || key.includes('vigueur')) {
      if (profile.hauteur) mapped[field.id] = profile.hauteur;
    } else if (key.includes('origine') || key.includes('provenance')) {
      if (profile.origine) mapped[field.id] = profile.origine;
    } else if (key.includes('precocite') || key.includes('maturite') || key.includes('saison')) {
      if (profile.precocite) mapped[field.id] = profile.precocite;
    } else if (key.includes('resistance') || key.includes('maladie') || key.includes('rusticite')) {
      if (profile.resistance) mapped[field.id] = profile.resistance;
    }
  }
  return mapped;
}

export interface HybridAutofillParams {
  species: string;
  category?: string;
  variety: string;
  speciesHarvestPeriod?: string;
  attributeFields: VarietyAttributeField[];
  currentAttributes?: Record<string, any>;
  currentComment?: string;
  currentHarvestMonths?: number[];
  currentStorageMonths?: number[];
  isManualHarvest?: boolean;
  overwriteExisting?: boolean;
}

export interface HybridAutofillResult {
  attributes: Record<string, string>;
  comment: string;
  harvestMonths: number[];
  storageMonths: number[];
  harvestSource: 'auto' | 'reference' | 'manual';
  isManualHarvest: boolean;
  usedServer: boolean;
  filledFieldCount: number;
  error?: string;
  retryAfterSeconds?: number;
}

interface ServerAutofillPayload {
  attributes?: Record<string, string>;
  comment?: string;
  harvestMonths?: number[];
  storageMonths?: number[];
}

function prepareLocalVarietyState(params: HybridAutofillParams) {
  const {
    species,
    variety,
    speciesHarvestPeriod,
    attributeFields,
    currentAttributes = {},
    currentComment = '',
    isManualHarvest = false,
    overwriteExisting = false,
  } = params;

  const localRef = getReferenceHarvestAndStorage(species, variety, speciesHarvestPeriod);
  const hasExactLocalHarvest = localRef.source === 'reference';
  const localProfile = getLocalProfile(species, variety);
  const localMapped = localProfile ? mapLocalProfileToFields(localProfile, attributeFields) : {};

  const fieldsToFetch = attributeFields.filter((f) => {
    const existingVal = String(currentAttributes[f.id] || '').trim();
    if (!overwriteExisting && existingVal) return false;
    if (!overwriteExisting && localMapped[f.id]) return false;
    return true;
  });

  const needsComment = overwriteExisting
    ? true
    : !String(currentComment || '').trim() && !localProfile?.comment;
  const needsHarvest = !isManualHarvest && (overwriteExisting || !hasExactLocalHarvest);

  return {
    localRef,
    hasExactLocalHarvest,
    localProfile,
    localMapped,
    fieldsToFetch,
    needsComment,
    needsHarvest,
    needsServer: fieldsToFetch.length > 0 || needsComment || needsHarvest,
  };
}

function mergeHybridVarietyData(
  params: HybridAutofillParams,
  localState: ReturnType<typeof prepareLocalVarietyState>,
  serverData: ServerAutofillPayload | null,
  usedServer: boolean,
  serverError?: string,
  retryAfterSeconds?: number
): HybridAutofillResult {
  const {
    attributeFields,
    currentAttributes = {},
    currentComment = '',
    currentHarvestMonths = [],
    currentStorageMonths = [],
    isManualHarvest = false,
    overwriteExisting = false,
  } = params;

  const aiAttributes = serverData?.attributes || {};
  const aiComment = String(serverData?.comment || '').trim();
  const aiHarvest = Array.isArray(serverData?.harvestMonths) ? serverData.harvestMonths : [];
  const aiStorage = Array.isArray(serverData?.storageMonths) ? serverData.storageMonths : [];

  const nextAttributes: Record<string, string> = {};
  let filledFieldCount = 0;

  for (const field of attributeFields) {
    const existingVal = String(currentAttributes[field.id] || '').trim();
    if (!overwriteExisting && existingVal) {
      nextAttributes[field.id] = existingVal;
      continue;
    }
    const candidate = aiAttributes[field.id] || localState.localMapped[field.id] || '';
    if (candidate) {
      nextAttributes[field.id] = candidate;
      if (candidate !== existingVal) filledFieldCount += 1;
    } else if (existingVal) {
      nextAttributes[field.id] = existingVal;
    }
  }

  let nextComment = String(currentComment || '').trim();
  if (overwriteExisting || !nextComment) {
    const candidateComment = localState.localProfile?.comment || aiComment || '';
    if (candidateComment) {
      if (candidateComment !== nextComment) filledFieldCount += 1;
      nextComment = candidateComment;
    }
  }

  let nextHarvest = [...currentHarvestMonths];
  let nextStorage = [...currentStorageMonths];
  let nextSource: 'auto' | 'reference' | 'manual' = isManualHarvest ? 'manual' : 'reference';

  if (!isManualHarvest) {
    if (localState.hasExactLocalHarvest && (!overwriteExisting || aiHarvest.length === 0)) {
      nextHarvest = [...localState.localRef.harvestMonths];
      nextStorage = [...localState.localRef.storageMonths];
      nextSource = 'reference';
    } else if (aiHarvest.length > 0) {
      nextHarvest = [...aiHarvest];
      nextStorage = [...aiStorage];
      nextSource = 'auto';
      filledFieldCount += 1;
    } else if (localState.localRef.harvestMonths.length > 0) {
      nextHarvest = [...localState.localRef.harvestMonths];
      nextStorage = [...localState.localRef.storageMonths];
      nextSource = 'reference';
    }
  }

  return {
    attributes: nextAttributes,
    comment: nextComment,
    harvestMonths: nextHarvest,
    storageMonths: nextStorage,
    harvestSource: nextSource,
    isManualHarvest,
    usedServer,
    filledFieldCount,
    error: serverError,
    retryAfterSeconds,
  };
}

export async function autofillVarietyHybrid(
  params: HybridAutofillParams
): Promise<HybridAutofillResult> {
  const { species, category, variety, attributeFields, overwriteExisting = false } = params;
  const localState = prepareLocalVarietyState(params);

  let serverData: ServerAutofillPayload | null = null;
  let usedServer = false;
  let serverError: string | undefined;
  let retryAfterSeconds: number | undefined;

  if (localState.needsServer) {
    try {
      const response = await fetch('/api/varieties/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species,
          category,
          variety,
          attributeFields: overwriteExisting ? attributeFields : localState.fieldsToFetch,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        serverError = payload?.error || `Erreur serveur (${response.status})`;
        if (typeof payload?.retryAfterSeconds === 'number') {
          retryAfterSeconds = payload.retryAfterSeconds;
        }
      } else {
        usedServer = true;
        serverData = payload;
      }
    } catch (err) {
      serverError = err instanceof Error ? err.message : 'Erreur réseau lors du pré-remplissage.';
    }
  }

  return mergeHybridVarietyData(
    params,
    localState,
    serverData,
    usedServer,
    serverError,
    retryAfterSeconds
  );
}

export interface BatchAutofillItemInput {
  key: string;
  species: string;
  category?: string;
  variety: string;
  speciesHarvestPeriod?: string;
  currentAttributes?: Record<string, any>;
  currentComment?: string;
  currentHarvestMonths?: number[];
  currentStorageMonths?: number[];
  isManualHarvest?: boolean;
}

export interface BatchAutofillChunkResult {
  key: string;
  result: HybridAutofillResult;
}

export interface BatchAutofillParams {
  items: BatchAutofillItemInput[];
  attributeFields: VarietyAttributeField[];
  overwriteExisting?: boolean;
  batchSize?: number;
  shouldAbort?: () => boolean;
  onChunkStart?: (items: BatchAutofillItemInput[]) => void;
  onChunkCompleted?: (results: BatchAutofillChunkResult[]) => Promise<void> | void;
  onWaitStatus?: (remainingSeconds: number | null) => void;
}

async function waitWithAbortCheck(
  seconds: number,
  shouldAbort?: () => boolean,
  onWaitStatus?: (remainingSeconds: number | null) => void
): Promise<boolean> {
  const total = Math.max(1, Math.min(75, Math.ceil(seconds)));
  for (let remaining = total; remaining > 0; remaining--) {
    if (shouldAbort?.()) {
      onWaitStatus?.(null);
      return false;
    }
    onWaitStatus?.(remaining);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  onWaitStatus?.(null);
  return !shouldAbort?.();
}

export async function autofillVarietiesBatchHybrid(params: BatchAutofillParams): Promise<{
  completedCount: number;
  updatedCount: number;
  errorCount: number;
  firstError?: string;
  aborted: boolean;
}> {
  const {
    items,
    attributeFields,
    overwriteExisting = false,
    batchSize = 12,
    shouldAbort,
    onChunkStart,
    onChunkCompleted,
    onWaitStatus,
  } = params;

  const prepared = items.map((item) => {
    const hybridParams: HybridAutofillParams = {
      species: item.species,
      category: item.category,
      variety: item.variety,
      speciesHarvestPeriod: item.speciesHarvestPeriod,
      attributeFields,
      currentAttributes: item.currentAttributes,
      currentComment: item.currentComment,
      currentHarvestMonths: item.currentHarvestMonths,
      currentStorageMonths: item.currentStorageMonths,
      isManualHarvest: item.isManualHarvest,
      overwriteExisting,
    };
    return {
      item,
      hybridParams,
      localState: prepareLocalVarietyState(hybridParams),
    };
  });

  let completedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let firstError: string | undefined;

  // Resolve purely local entries first (zero API calls needed)
  const localOnlyEntries = prepared.filter((entry) => !entry.localState.needsServer);
  if (localOnlyEntries.length > 0 && !shouldAbort?.()) {
    onChunkStart?.(localOnlyEntries.map((e) => e.item));
    const localResults: BatchAutofillChunkResult[] = localOnlyEntries.map((entry) => ({
      key: entry.item.key,
      result: mergeHybridVarietyData(entry.hybridParams, entry.localState, null, false),
    }));
    await onChunkCompleted?.(localResults);
    completedCount += localResults.length;
    updatedCount += localResults.length;
  }

  // Group server-needing entries into chunks so 12 varieties = 1 API call
  const remoteEntries = prepared.filter((entry) => entry.localState.needsServer);
  const safeChunkSize = Math.max(1, Math.min(15, batchSize));

  for (let i = 0; i < remoteEntries.length; i += safeChunkSize) {
    if (shouldAbort?.()) {
      return { completedCount, updatedCount, errorCount, firstError, aborted: true };
    }

    const chunk = remoteEntries.slice(i, i + safeChunkSize);
    onChunkStart?.(chunk.map((c) => c.item));

    let serverResultsMap: Record<string, ServerAutofillPayload> | null = null;
    let chunkError: string | undefined;
    let usedServer = false;

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (shouldAbort?.()) {
        return { completedCount, updatedCount, errorCount, firstError, aborted: true };
      }

      try {
        const response = await fetch('/api/varieties/autofill-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: chunk.map((c) => ({
              key: c.item.key,
              species: c.item.species,
              category: c.item.category,
              variety: c.item.variety,
            })),
            attributeFields,
          }),
        });

        const payload = await response.json();

        if (response.status === 429) {
          const retrySec =
            typeof payload?.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : 55;
          if (attempt < maxAttempts) {
            const resumed = await waitWithAbortCheck(retrySec, shouldAbort, onWaitStatus);
            if (!resumed) {
              return { completedCount, updatedCount, errorCount, firstError, aborted: true };
            }
            continue;
          }
          chunkError = payload?.error || 'Limite de requêtes atteinte (429).';
          break;
        }

        if (!response.ok) {
          chunkError = payload?.error || `Erreur serveur (${response.status})`;
          break;
        }

        serverResultsMap = payload?.results || {};
        usedServer = true;
        chunkError = undefined;
        break;
      } catch (err) {
        chunkError =
          err instanceof Error ? err.message : 'Erreur réseau lors du pré-remplissage groupé.';
        break;
      }
    }

    const chunkResults: BatchAutofillChunkResult[] = chunk.map((entry) => {
      const entryServerData = serverResultsMap?.[entry.item.key] || null;
      const entryErr =
        chunkError || (usedServer && !entryServerData ? 'Réponse absente pour cette variété' : undefined);
      const merged = mergeHybridVarietyData(
        entry.hybridParams,
        entry.localState,
        entryServerData,
        usedServer && Boolean(entryServerData),
        entryErr
      );
      if (merged.error) {
        errorCount += 1;
        if (!firstError) firstError = merged.error;
      } else {
        updatedCount += 1;
      }
      return {
        key: entry.item.key,
        result: merged,
      };
    });

    await onChunkCompleted?.(chunkResults);
    completedCount += chunkResults.length;
  }

  onWaitStatus?.(null);
  return {
    completedCount,
    updatedCount,
    errorCount,
    firstError,
    aborted: Boolean(shouldAbort?.()),
  };
}

/**
 * Checks whether a variety still has missing attributes, missing comment, or generic/empty harvest periods.
 */
export function hasMissingAutofillData(
  variety: any,
  plant: { name?: string; harvestPeriod?: string },
  attributeFields: VarietyAttributeField[]
): boolean {
  const attrs = variety?.attributes || {};
  const hasEmptyAttr = attributeFields.some((f) => !String(attrs[f.id] || '').trim());
  const hasEmptyComment = !String(attrs.comment || '').trim();
  const resolved = resolveVarietyHarvestAndStorage(
    plant?.name || '',
    variety?.value || '',
    attrs,
    plant?.harvestPeriod
  );
  const hasGenericOrEmptyHarvest =
    !resolved.isManual &&
    (resolved.source === 'none' || resolved.source === 'species_default' || resolved.harvestMonths.length === 0);

  return hasEmptyAttr || hasEmptyComment || hasGenericOrEmptyHarvest;
}
