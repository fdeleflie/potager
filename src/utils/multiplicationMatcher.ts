import { MULTIPLICATION_RULES, MultiplicationRule, MultiplicationMethod } from '../data/multiplicationData';
import { Seedling, Tree, JournalEntry, EncyclopediaEntry, PerpetualTask, ConfigItem } from '../db';

export interface OwnedPlantMatch {
  id: string;
  name: string;
  type: 'tree' | 'seedling' | 'catalog' | 'perpetual';
  variety?: string;
  locationLabel?: string;
}

export interface SourceBadge {
  type: 'tree' | 'seedling' | 'catalog' | 'perpetual';
  label: string;
  count?: number;
  icon: string;
  className: string;
  tooltip: string;
}

export interface PlantSourceSummary {
  treeCount: number;
  treeVarieties: string[];
  seedlingCount: number;
  seedlingVarieties: string[];
  inCatalog: boolean;
  inPerpetual: boolean;
  badges: SourceBadge[];
  allVarietiesText?: string;
}

export interface EnrichedMultiplicationItem {
  rule: MultiplicationRule;
  isOwned: boolean;
  ownedPlants: OwnedPlantMatch[];
  sourceSummary: PlantSourceSummary;
  periodStatus: 'optimal' | 'possible' | 'out_of_season';
  journalHistory: JournalEntry[];
  lastActionDate?: string;
  successCount: number;
  failureCount: number;
}

export const MULTIPLICATION_KEYWORDS = [
  'boutur',
  'bouture',
  'marcott',
  'marcotte',
  'division',
  'drageon',
  'stolon',
  'greffe',
  'greffage',
  'oeilleton',
  'eclat'
];

/**
 * Normalise a text for botanical keyword matching:
 * lowercase, removes accents, punctuation.
 */
export function normalizeBotanical(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’\-–_]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split text into individual clean words of length >= 3
 */
function extractCleanWords(text: string): string[] {
  const norm = normalizeBotanical(text);
  if (!norm) return [];
  return norm.split(' ').filter(w => w.length >= 3);
}

/**
 * Check if a candidate plant text strictly matches a keyword or botanical rule.
 * Uses whole-word boundary matching and guards against false positives:
 * - "poire" must NOT match "poireau"
 * - "pomme" must NOT match "pomme de terre"
 * - "cerise" must NOT match "tomate cerise"
 */
export function isBotanicalMatch(
  candidateText: string, 
  keywordOrName: string, 
  ruleCategory?: 'fruitier' | 'aromatique' | 'petit_fruit' | 'vivace' | 'legume',
  candidateIsSeedling?: boolean
): boolean {
  const normCandidate = normalizeBotanical(candidateText);
  const normTarget = normalizeBotanical(keywordOrName);
  if (!normCandidate || !normTarget) return false;

  // Exact match
  if (normCandidate === normTarget) return true;

  // Anti-false-positive guards:
  // 1. "poireau" is not a pear tree
  if (normTarget.includes('poire') && normCandidate.includes('poireau')) return false;
  // 2. "pomme de terre" is not an apple tree
  if (normTarget.includes('pomme') && normCandidate.includes('pomme de terre')) return false;
  // 3. A seedling of "tomate cerise" is a tomato, NOT an orchard cherry tree (Cerisier)
  if (ruleCategory === 'fruitier' && candidateIsSeedling) {
    if (normCandidate.includes('tomate')) return false;
  }
  // 4. "organisation" is not "origan"
  if (normTarget.includes('origan') && normCandidate.includes('organisation')) return false;

  // Whole word matching:
  // Target keywords can be multi-word (e.g. "cassis", "artemisia dracunculus")
  const targetWords = extractCleanWords(normTarget);
  const candidateWords = extractCleanWords(normCandidate);

  // If target has multiple words (e.g. "laurier rose"), candidate must contain that exact phrase
  if (normTarget.includes(' ')) {
    const regex = new RegExp(`(^|\\s)${normTarget.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\s|$)`, 'i');
    if (regex.test(normCandidate)) return true;
  }

  // Check if any significant word of target matches a candidate word (exact or singular/plural stem)
  return targetWords.some(tw => {
    const twStem = tw.replace(/s$/, '').replace(/x$/, '');
    return candidateWords.some(cw => {
      const cwStem = cw.replace(/s$/, '').replace(/x$/, '');
      if (cwStem === twStem) return true;
      // Allow prefix match only if words are long (>= 6 letters) and share root
      if (twStem.length >= 6 && cwStem.length >= 6) {
        if (cwStem.startsWith(twStem) || twStem.startsWith(cwStem)) {
          return true;
        }
      }
      return false;
    });
  });
}

function getTaskMonths(task: { month: number; endMonth?: number }): number[] {
  if (!task.month) return [];
  const start = Number(task.month);
  const end = task.endMonth ? Number(task.endMonth) : start;
  if (end === start) return [start];
  const months: number[] = [];
  if (end >= start) {
    for (let m = start; m <= end; m++) months.push(m);
  } else {
    for (let m = start; m <= 12; m++) months.push(m);
    for (let m = 1; m <= end; m++) months.push(m);
  }
  return months;
}

/**
 * Detects perpetual tasks that appear to be cutting/layering/grafting
 * but are currently classified under another category.
 */
export function detectMisclassifiedMultiplicationTasks(tasks: PerpetualTask[] = []): PerpetualTask[] {
  return (tasks || []).filter(t => {
    if (t.isDeleted) return false;
    if (t.category === 'multiplication') return false;

    const fullText = normalizeBotanical(`${t.title || ''} ${t.description || ''} ${t.plant || ''}`);
    return MULTIPLICATION_KEYWORDS.some(kw => fullText.includes(kw));
  });
}

/**
 * Core matching engine:
 * Strictly cross-references the user's actual garden:
 * - Trees (Mon Verger)
 * - Seedlings (Mes Semis & Plants)
 * - Encyclopedia entries & config vegetables (Catalogue des Plantes)
 * - Perpetual tasks ONLY if classified under 'multiplication'
 *
 * This ensures unowned reference plants (like Consoude, Origan, Estragon) do NOT appear
 * in the user's multiplication schedule if they do not possess them.
 */
export function matchUserPlantsWithMultiplications(
  seedlings: Seedling[] = [],
  trees: Tree[] = [],
  encyclopedia: EncyclopediaEntry[] = [],
  journalEntries: JournalEntry[] = [],
  selectedMonth: number = new Date().getMonth() + 1,
  customRules: MultiplicationRule[] = [],
  perpetualTasks: PerpetualTask[] = [],
  config: ConfigItem[] = []
): EnrichedMultiplicationItem[] {
  const activeSeedlings = seedlings.filter(s => !s.isDeleted);
  const activeTrees = trees.filter(t => !t.isDeleted);
  const activeEncyclopedia = encyclopedia || [];
  const activeJournal = journalEntries.filter(j => !j.isDeleted);
  const activePerpetualTasks = perpetualTasks.filter(t => !t.isDeleted);
  const activeConfigVegetables = (config || []).filter(c => c.type === 'vegetable' && c.value);

  // Combine custom user rules (priority) with built-in reference rules
  const allRules: MultiplicationRule[] = [...customRules];
  MULTIPLICATION_RULES.forEach(defaultRule => {
    if (!allRules.some(r => r.id === defaultRule.id)) {
      allRules.push(defaultRule);
    }
  });

  // Extract tasks from perpetualTasks that explicitly define multiplication gestures
  // ONLY if categorized as multiplication or having explicit multiplication keywords
  activePerpetualTasks.forEach(pt => {
    const isMultiplicationCategory = pt.category === 'multiplication';
    const hasKeyword = MULTIPLICATION_KEYWORDS.some(kw =>
      normalizeBotanical(`${pt.title || ''} ${pt.description || ''}`).includes(kw)
    );

    if (isMultiplicationCategory || hasKeyword) {
      const plantLabel = pt.plant?.trim() || pt.title.replace(/bouturage|bouture|marcottage|marcotte|greffe|greffage|division/gi, '').replace(/de\s+|du\s+|des\s+|d'/gi, '').trim();
      const existingMatch = allRules.some(r => 
        isBotanicalMatch(plantLabel, r.commonName, r.category) || 
        r.speciesKeywords.some(k => isBotanicalMatch(plantLabel, k, r.category))
      );

      if (!existingMatch && plantLabel.length > 2) {
        // Infer method
        const titleNorm = normalizeBotanical(pt.title);
        let method: MultiplicationMethod = 'bouture_semi_aoutee';
        let methodLabel = 'Bouturage semi-aoûté';

        if (titleNorm.includes('marcott')) {
          if (titleNorm.includes('aerien')) {
            method = 'marcottage_aerien';
            methodLabel = 'Marcottage aérien';
          } else {
            method = 'marcottage_couche';
            methodLabel = 'Marcottage par couchage';
          }
        } else if (titleNorm.includes('greff')) {
          method = 'greffage';
          methodLabel = 'Greffage';
        } else if (titleNorm.includes('divis')) {
          method = 'division_touffe';
          methodLabel = 'Division de touffe';
        } else if (titleNorm.includes('bois sec') || [11, 12, 1, 2].includes(Number(pt.month))) {
          method = 'bouture_bois_sec';
          methodLabel = 'Bouture à bois dormant';
        } else if ([4, 5, 6].includes(Number(pt.month))) {
          method = 'bouture_herpacee';
          methodLabel = 'Bouture herbacée';
        }

        const covered = getTaskMonths(pt);
        const opt = pt.optimalMonth ? [Number(pt.optimalMonth)] : [Number(pt.month)];

        allRules.push({
          id: `perpetual_${pt.id}`,
          speciesKeywords: [plantLabel.toLowerCase()],
          commonName: plantLabel.charAt(0).toUpperCase() + plantLabel.slice(1),
          category: 'vivace',
          method,
          methodLabel,
          optimalMonths: opt,
          possibleMonths: covered,
          difficulty: 'facile',
          difficultyLabel: 'Geste personnalisé',
          rootingTimeWeeks: 4,
          summary: pt.description || `Geste issu de votre planning perpétuel : ${pt.title}`,
          instructions: {
            harvest: 'Prélevez les rameaux selon la technique habituelle.',
            substrate: 'Substrat drainant (terreau léger avec un tiers de sable).',
            care: 'Maintenir au frais et à l\'ombre avec arrosage régulier.',
            followUp: 'Surveillez l\'enracinement et repiquez dès reprise vigoureuse.'
          },
          isCustom: true
        });
      }
    }
  });

  return allRules.map(rule => {
    const ownedPlants: OwnedPlantMatch[] = [];
    const treeVarieties: string[] = [];
    const seedlingVarieties: string[] = [];
    let treeCount = 0;
    let seedlingCount = 0;
    let inCatalog = false;
    let inPerpetual = false;

    // 1. Mon Verger (trees)
    activeTrees.forEach(t => {
      const speciesMatch = rule.speciesKeywords.some(keyword => {
        return isBotanicalMatch(t.species, keyword, rule.category, false);
      }) || isBotanicalMatch(t.species, rule.commonName, rule.category, false);

      if (speciesMatch) {
        treeCount++;
        if (t.variety && !treeVarieties.includes(t.variety.trim())) {
          treeVarieties.push(t.variety.trim());
        }
        ownedPlants.push({
          id: t.id,
          name: t.variety ? `${t.species} (${t.variety})` : t.species,
          type: 'tree',
          variety: t.variety,
          locationLabel: 'Verger'
        });
      }
    });

    // 2. Mes Semis & Plants (seedlings)
    activeSeedlings.forEach(s => {
      // For seedlings, match vegetable name. Never match Tomate cerise with tree cherry!
      const vegMatch = rule.speciesKeywords.some(keyword => {
        return isBotanicalMatch(s.vegetable, keyword, rule.category, true);
      }) || isBotanicalMatch(s.vegetable, rule.commonName, rule.category, true);

      if (vegMatch) {
        seedlingCount++;
        if (s.variety && !seedlingVarieties.includes(s.variety.trim())) {
          seedlingVarieties.push(s.variety.trim());
        }
        ownedPlants.push({
          id: s.id,
          name: s.variety ? `${s.vegetable} (${s.variety})` : s.vegetable,
          type: 'seedling',
          variety: s.variety,
          locationLabel: 'Potager'
        });
      }
    });

    // 3. Catalogue des Plantes (encyclopedia & config vegetables)
    activeEncyclopedia.forEach(e => {
      if (!e.name) return;
      const match = rule.speciesKeywords.some(keyword => {
        return isBotanicalMatch(e.name, keyword, rule.category, false);
      }) || isBotanicalMatch(e.name, rule.commonName, rule.category, false);

      if (match) {
        inCatalog = true;
        const alreadyAdded = ownedPlants.some(p => isBotanicalMatch(p.name, e.name, rule.category));
        if (!alreadyAdded) {
          ownedPlants.push({
            id: e.id,
            name: e.name,
            type: 'catalog',
            locationLabel: 'Catalogue'
          });
        }
      }
    });

    activeConfigVegetables.forEach(c => {
      if (!c.value) return;
      const match = rule.speciesKeywords.some(keyword => {
        return isBotanicalMatch(c.value, keyword, rule.category, false);
      }) || isBotanicalMatch(c.value, rule.commonName, rule.category, false);

      if (match) {
        inCatalog = true;
        const alreadyAdded = ownedPlants.some(p => isBotanicalMatch(p.name, c.value, rule.category));
        if (!alreadyAdded) {
          ownedPlants.push({
            id: c.id,
            name: c.value,
            type: 'catalog',
            locationLabel: 'Catalogue'
          });
        }
      }
    });

    // 4. Planning Perpétuel: ONLY if the task is classified under 'multiplication'
    // Do NOT match random tasks like "purin de consoude" or maintenance tasks!
    activePerpetualTasks.forEach(pt => {
      if (pt.category !== 'multiplication') return; // Strict guard!

      const plantLabel = pt.plant?.trim() || '';
      if (!plantLabel) return;

      const match = rule.speciesKeywords.some(keyword => {
        return isBotanicalMatch(plantLabel, keyword, rule.category, false);
      }) || isBotanicalMatch(plantLabel, rule.commonName, rule.category, false);

      if (match) {
        inPerpetual = true;
        const alreadyAdded = ownedPlants.some(p => isBotanicalMatch(p.name, plantLabel, rule.category));
        if (!alreadyAdded) {
          ownedPlants.push({
            id: pt.id,
            name: plantLabel,
            type: 'perpetual',
            locationLabel: 'Planning perpétuel'
          });
        }
      }
    });

    // Build clean, deduplicated badges for UI presentation
    // This solves "cerisier : verger, verger, verger etc .... ou semis plant"
    const badges: SourceBadge[] = [];

    if (treeCount > 0) {
      const varsText = treeVarieties.length > 0 ? ` : ${treeVarieties.join(', ')}` : '';
      badges.push({
        type: 'tree',
        label: treeCount > 1 ? `Verger (${treeCount})` : 'Verger',
        count: treeCount,
        icon: '🌳',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        tooltip: `${treeCount} arbre${treeCount > 1 ? 's' : ''} dans Mon Verger${varsText}`
      });
    }

    if (seedlingCount > 0) {
      const varsText = seedlingVarieties.length > 0 ? ` : ${seedlingVarieties.join(', ')}` : '';
      badges.push({
        type: 'seedling',
        label: seedlingCount > 1 ? `Potager (${seedlingCount})` : 'Potager',
        count: seedlingCount,
        icon: '🌱',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
        tooltip: `${seedlingCount} semis/plant${seedlingCount > 1 ? 's' : ''} au potager${varsText}`
      });
    }

    if (inCatalog && treeCount === 0 && seedlingCount === 0) {
      badges.push({
        type: 'catalog',
        label: 'Catalogue',
        icon: '📖',
        className: 'bg-sky-50 text-sky-800 border-sky-200',
        tooltip: 'Plante enregistrée dans votre catalogue'
      });
    }

    if (inPerpetual && badges.length === 0) {
      badges.push({
        type: 'perpetual',
        label: 'Geste perpétuel',
        icon: '🔄',
        className: 'bg-purple-50 text-purple-800 border-purple-200',
        tooltip: 'Geste récurrent enregistré sous la catégorie Multiplication'
      });
    }

    // All distinct varieties combined
    const allVarieties = Array.from(new Set([...treeVarieties, ...seedlingVarieties]));
    const allVarietiesText = allVarieties.length > 0 ? allVarieties.join(', ') : undefined;

    const sourceSummary: PlantSourceSummary = {
      treeCount,
      treeVarieties,
      seedlingCount,
      seedlingVarieties,
      inCatalog,
      inPerpetual,
      badges,
      allVarietiesText
    };

    // Deduplicate owned plants by name
    const uniqueOwned = ownedPlants.filter((item, index, self) =>
      index === self.findIndex(t => t.name.toLowerCase() === item.name.toLowerCase())
    );

    // Period status calculation
    let periodStatus: 'optimal' | 'possible' | 'out_of_season' = 'out_of_season';
    if (rule.optimalMonths.includes(selectedMonth)) {
      periodStatus = 'optimal';
    } else if (rule.possibleMonths.includes(selectedMonth)) {
      periodStatus = 'possible';
    }

    // Matching past journal notes
    const relatedNotes = activeJournal.filter(note => {
      const contentNorm = normalizeBotanical(note.content || '');
      const titleNorm = normalizeBotanical(note.title || '');
      const tags = (note.tags || []).map(t => normalizeBotanical(t));

      const matchesSpecies = rule.speciesKeywords.some(k => {
        return isBotanicalMatch(note.title || '', k, rule.category) ||
               (note.tags || []).some(t => isBotanicalMatch(t, k, rule.category));
      }) || isBotanicalMatch(note.title || '', rule.commonName, rule.category);

      if (!matchesSpecies) return false;

      const hasMultiplicationTerm = MULTIPLICATION_KEYWORDS.some(term =>
        contentNorm.includes(term) || titleNorm.includes(term) || tags.some(t => t.includes(term))
      );

      return hasMultiplicationTerm;
    });

    relatedNotes.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const successCount = relatedNotes.filter(n => n.success === true).length;
    const failureCount = relatedNotes.filter(n => n.success === false).length;
    const lastActionDate = relatedNotes.length > 0 ? relatedNotes[0].date : undefined;

    return {
      rule,
      isOwned: badges.length > 0 || uniqueOwned.length > 0,
      ownedPlants: uniqueOwned,
      sourceSummary,
      periodStatus,
      journalHistory: relatedNotes,
      lastActionDate,
      successCount,
      failureCount
    };
  });
}
