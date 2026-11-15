/**
 * Harvest and Conservation / Storage Data Model & Reference Dataset
 * Grounded in the orchard planning specifications and visual charts.
 */

import { normalizeSpeciesName, normalizeVarietyKey, areVarietiesEquivalent, isTechnicalId } from './varietyNormalizer';
import { getCanonicalCategory } from './categories';

export type HarvestSource = 'manual' | 'reference' | 'species_default' | 'none';

export interface HarvestStorageScheduleItem {
  id: string;
  species: string;
  variety: string;
  displayName: string; // e.g. "Cerisier - Burlat"
  category: string;
  icon?: string;
  color?: string;
  harvestMonths: number[]; // 1 to 12 (Jan=1, Dec=12)
  storageMonths: number[]; // 1 to 12
  varietyConfigId?: string;
  parentId?: string;
  totalQuantity?: number;
  orchardCount?: number;
  isTemporary?: boolean;
  status?: 'confirmed' | 'temporary';
  harvestSource?: HarvestSource;
  isManualHarvest?: boolean;
  defaultHarvestMonths?: number[];
  defaultStorageMonths?: number[];
}

export interface ResolvedHarvestStorage {
  harvestMonths: number[];
  storageMonths: number[];
  source: HarvestSource;
  isManual: boolean;
  defaultHarvestMonths: number[];
  defaultStorageMonths: number[];
}

export const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const MONTH_ABBR_FR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
];

/**
 * Predefined reference data matching the exact orchard schedule from the user's reference charts
 */
export const KNOWN_HARVEST_STORAGE_DATA: Record<string, { harvest: number[]; storage: number[] }> = {
  // Abricotiers
  'abricotier___bergeron': { harvest: [7, 8], storage: [] },
  'abricotier___goldcot': { harvest: [7], storage: [] },
  'abricotier___harcot': { harvest: [7], storage: [] },
  'abricotier___harlayne': { harvest: [7, 8], storage: [] },

  // Asiminiers
  'asiminier___inconnugraines': { harvest: [9, 10], storage: [] },
  'asiminier___inconnu': { harvest: [9, 10], storage: [] },
  'asiminier___standard': { harvest: [9, 10], storage: [] },

  // Casseille & Cassis
  'casseille___standard': { harvest: [6, 7], storage: [] },
  'cassis___standard': { harvest: [6, 7], storage: [] },
  'cassissier___standard': { harvest: [6, 7], storage: [] },

  // Cerisiers
  'cerisier___burlat': { harvest: [5, 6], storage: [] },
  'cerisier___inconnu': { harvest: [6, 7], storage: [] },
  'cerisier___standard': { harvest: [6, 7], storage: [] },
  'cerisier___napoleon': { harvest: [6, 7], storage: [] },

  // Figuiers
  'figuier___inconnucotepoule': { harvest: [8, 9], storage: [] },
  'figuier___inconnuportail': { harvest: [8, 9], storage: [] },
  'figuier___standard': { harvest: [8, 9], storage: [] },
  'figuier___inconnu': { harvest: [8, 9], storage: [] },

  // Fraisiers & Framboisiers
  'fraisier___remontant': { harvest: [6, 7, 8, 9, 10], storage: [] },
  'fraisier___inconnu': { harvest: [6, 7, 8, 9, 10], storage: [] },
  'framboise___inconnu': { harvest: [6, 7, 8, 9, 10], storage: [] },
  'framboisier___inconnu': { harvest: [6, 7, 8, 9, 10], storage: [] },
  'framboisier___remontant': { harvest: [6, 7, 8, 9, 10], storage: [] },

  // Groseilliers
  'groseillier___blanc': { harvest: [6, 7], storage: [] },
  'groseillier___rouge': { harvest: [6, 7], storage: [] },
  'groseillier___standard': { harvest: [6, 7], storage: [] },

  // Kakis
  'kaki___fuyu': { harvest: [10, 11], storage: [12] },
  'kaki___jiro': { harvest: [10, 11], storage: [12] },
  'kaki___standard': { harvest: [10, 11], storage: [12] },

  // Kiwaï
  'kiwai___ananasnaya': { harvest: [9, 10], storage: [11] },
  'kiwai___bingo': { harvest: [9, 10], storage: [11] },
  'kiwai___issai': { harvest: [9, 10], storage: [11] },
  'kiwai___kensred': { harvest: [9, 10], storage: [11] },

  // Kiwi
  'kiwi___inconnu': { harvest: [10, 11], storage: [12, 1, 2, 3] },
  'kiwi___standard': { harvest: [10, 11], storage: [12, 1, 2, 3] },

  // Mûrier
  'murier___beautiful': { harvest: [7, 8, 9], storage: [] },
  'murier___standard': { harvest: [7, 8, 9], storage: [] },

  // Nashi
  'nashi___hosui': { harvest: [7, 8, 9], storage: [10, 11] },
  'nashi___standard': { harvest: [8, 9], storage: [10, 11] },

  // Nectarinier
  'nectarinier___lordnapier': { harvest: [7, 8], storage: [] },
  'nectarinier___standard': { harvest: [7, 8], storage: [] },

  // Noisetier
  'noisetier___inconnu': { harvest: [9, 10], storage: [11, 12, 1, 2, 3, 4, 5] },
  'noisetier___standard': { harvest: [9, 10], storage: [11, 12, 1, 2, 3, 4, 5] },

  // Noyer
  'noyer___inconnu': { harvest: [9, 10], storage: [11, 12, 1, 2, 3, 4, 5] },
  'noyer___standard': { harvest: [9, 10], storage: [11, 12, 1, 2, 3, 4, 5] },

  // Olivier
  'olivier___inconnu': { harvest: [10, 11], storage: [] },
  'olivier___standard': { harvest: [10, 11], storage: [] },

  // Poiriers
  'poirier___doyenneducomice': { harvest: [9, 10], storage: [11, 12] },
  'poirier___standard': { harvest: [8, 9, 10], storage: [11] },
  'poirier___williams': { harvest: [8, 9], storage: [10] },
  'poirier___conference': { harvest: [9, 10], storage: [11, 12, 1] },

  // Pommiers
  'pommier___coxsorange': { harvest: [9, 10], storage: [11, 12] },
  'pommier___elstar': { harvest: [9], storage: [10, 11] },
  'pommier___gloster': { harvest: [10], storage: [11, 12, 1, 2, 3] },
  'pommier___goldendelicious': { harvest: [10], storage: [11, 12, 1, 2, 3, 4] },
  'pommier___melrose': { harvest: [10], storage: [11, 12, 1, 2, 3] },
  'pommier___reinedesreinettes': { harvest: [8, 9], storage: [10, 11] },
  'pommier___reinetteclochardparthenay': { harvest: [10], storage: [11, 12, 1, 2, 3, 4, 5] },
  'pommier___reinetteclochard': { harvest: [10], storage: [11, 12, 1, 2, 3, 4, 5] },
  'pommier___realedentraygue': { harvest: [10], storage: [11, 12, 1, 2, 3, 4] },
  'pommier___saintjeantransparenteblanche': { harvest: [7], storage: [8] },
  'pommier___saintjean': { harvest: [7], storage: [8] },
  'pommier___transparenteblanche': { harvest: [7], storage: [8] },
  'pommier___topaz': { harvest: [10], storage: [11, 12, 1, 2, 3, 4] },
  'pommier___jonagold': { harvest: [10], storage: [11, 12, 1, 2] },

  // Pruniers / Quetschiers / Reine-Claude / Mirabelliers
  'prunier___aprikyra': { harvest: [7, 8], storage: [] },
  'prunier___belledelouvain': { harvest: [8, 9], storage: [] },
  'prunier___francaprimira': { harvest: [8], storage: [] },
  'prunier___inconnu': { harvest: [8], storage: [] },
  'prunier___standard': { harvest: [8], storage: [] },
  'prunier___isabella': { harvest: [9], storage: [] },
  'prunier___jubileum': { harvest: [8], storage: [] },
  'prunier___kometa': { harvest: [7], storage: [] },
  'prunier___mirabelledenancy': { harvest: [8], storage: [9] },
  'prunier___missrose': { harvest: [8], storage: [] },
  'prunier___opal': { harvest: [7], storage: [] },
  'prunier___pluotflavorcandy': { harvest: [7, 8], storage: [] },
  'prunier___quetschestanley': { harvest: [8, 9], storage: [10] },
  'prunier___quetschedalsace': { harvest: [9], storage: [10] },
  'prunier___reineclaudedoullins': { harvest: [7, 8], storage: [] },
  'prunier___xgek': { harvest: [7, 8], storage: [] },
  'prunier___zorka': { harvest: [7], storage: [] },
  'quetschier___stanley': { harvest: [8, 9], storage: [10] },
  'quetschier___belledelouvain': { harvest: [8, 9], storage: [] },
  'quetschier___dalsace': { harvest: [9], storage: [10] },
  'reineclaude___doullins': { harvest: [7, 8], storage: [] },
  'mirabellier___denancy': { harvest: [8], storage: [9] },
  'mirabellier___franc': { harvest: [8], storage: [] },
  'mirabellier___aprimira': { harvest: [8], storage: [] },

  // Pêchers
  'pecher___avalonpride': { harvest: [8], storage: [] },
  'pecher___benedicte': { harvest: [8], storage: [] },
  'pecher___standard': { harvest: [8], storage: [] },

  // Vignes
  'vigne___himrod': { harvest: [8, 9], storage: [10] },
  'vigne___isabellasanspepins': { harvest: [9, 10], storage: [11] },
  'vigne___isabella': { harvest: [9, 10], storage: [11] },
  'vigne___lakemont': { harvest: [9], storage: [10] },
  'vigne___loosengohelle': { harvest: [9], storage: [10, 11] },
  'vigne___sweetyelisabeth': { harvest: [9], storage: [10] },
  'vigne___elisabeth': { harvest: [9], storage: [10] },
  'vigne___sweety': { harvest: [9], storage: [10] }
};

/**
 * Parses a French text period like "Août - Octobre" or "Juillet - Septembre" into month indices [1..12]
 */
export function parseFrenchMonthPeriod(periodStr?: string): number[] {
  if (!periodStr || typeof periodStr !== 'string') return [];
  const clean = periodStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const monthMap: Record<string, number> = {
    jan: 1, janvier: 1,
    fev: 2, fevrier: 2,
    mar: 3, mars: 3,
    avr: 4, avril: 4,
    mai: 5,
    juin: 6,
    juil: 7, juillet: 7,
    aout: 8,
    sep: 9, sept: 9, septembre: 9,
    oct: 10, octobre: 10,
    nov: 11, novembre: 11,
    dec: 12, decembre: 12
  };

  // Check for range with "-" or "a" or "au"
  const tokens = clean.split(/[-–—àa]|\s+au\s+/).map(t => t.trim()).filter(Boolean);
  if (tokens.length >= 2) {
    let startM = 0;
    let endM = 0;
    for (const [key, val] of Object.entries(monthMap)) {
      if (tokens[0].includes(key) && startM === 0) startM = val;
      if (tokens[1].includes(key) && endM === 0) endM = val;
    }
    if (startM > 0 && endM > 0) {
      const res: number[] = [];
      if (startM <= endM) {
        for (let m = startM; m <= endM; m++) res.push(m);
      } else {
        // Crosses year boundary (e.g. Nov to Feb)
        for (let m = startM; m <= 12; m++) res.push(m);
        for (let m = 1; m <= endM; m++) res.push(m);
      }
      return res;
    }
  }

  // Single month check
  for (const [key, val] of Object.entries(monthMap)) {
    if (clean.includes(key)) {
      return [val];
    }
  }

  return [];
}

/**
 * Look up the botanical/internet reference dataset for a given species + variety
 */
export function getReferenceHarvestAndStorage(
  species: string,
  variety: string,
  speciesHarvestPeriod?: string,
  speciesHarvestMonths?: number[]
): { harvestMonths: number[]; storageMonths: number[]; source: 'reference' | 'species_default' | 'none' } {
  // 1. Direct key match in known database
  const key = `${normalizeSpeciesName(species)}___${normalizeVarietyKey(variety)}`;
  const found = KNOWN_HARVEST_STORAGE_DATA[key];
  if (found) {
    return {
      harvestMonths: [...found.harvest],
      storageMonths: [...found.storage],
      source: 'reference'
    };
  }

  // 2. Fuzzy match in known database
  for (const [dbKey, dbData] of Object.entries(KNOWN_HARVEST_STORAGE_DATA)) {
    const [dbSpec, dbVar] = dbKey.split('___');
    if (normalizeSpeciesName(species) === dbSpec && areVarietiesEquivalent(variety, dbVar)) {
      return {
        harvestMonths: [...dbData.harvest],
        storageMonths: [...dbData.storage],
        source: 'reference'
      };
    }
  }

  // 3. Fallback to parent species general harvest period
  let harvestMonths: number[] = [];
  if (speciesHarvestMonths && speciesHarvestMonths.length > 0) {
    harvestMonths = Array.from(new Set(speciesHarvestMonths.map(m => Math.floor(m)))).filter(m => m >= 1 && m <= 12).sort((a, b) => a - b);
  } else if (speciesHarvestPeriod) {
    harvestMonths = parseFrenchMonthPeriod(speciesHarvestPeriod);
  }

  if (harvestMonths.length > 0) {
    return {
      harvestMonths,
      storageMonths: [],
      source: 'species_default'
    };
  }

  return {
    harvestMonths: [],
    storageMonths: [],
    source: 'none'
  };
}

/**
 * Resolves harvest and storage months for a variety and identifies its source
 * ('manual' vs 'reference' / 'species_default').
 */
export function resolveVarietyHarvestAndStorage(
  species: string,
  variety: string,
  varietyAttributes?: Record<string, any>,
  speciesHarvestPeriod?: string,
  speciesHarvestMonths?: number[]
): ResolvedHarvestStorage {
  // Reference (Internet / Botanical knowledge base)
  const ref = getReferenceHarvestAndStorage(species, variety, speciesHarvestPeriod, speciesHarvestMonths);

  const customHarvest = varietyAttributes?.harvestMonths;
  const customStorage = varietyAttributes?.storageMonths;
  const explicitManual = varietyAttributes?.harvestSource === 'manual' || varietyAttributes?.isManualHarvest === true;
  const explicitReference = varietyAttributes?.harvestSource === 'reference';

  // If explicitly flagged as manual
  if (explicitManual && Array.isArray(customHarvest)) {
    const normH = Array.from(new Set(customHarvest.map(m => Math.floor(Number(m))))).filter(m => m >= 1 && m <= 12).sort((a, b) => a - b);
    const normS = Array.isArray(customStorage)
      ? Array.from(new Set(customStorage.map(m => Math.floor(Number(m))))).filter(m => m >= 1 && m <= 12).sort((a, b) => a - b)
      : [];
    return {
      harvestMonths: normH,
      storageMonths: normS,
      source: 'manual',
      isManual: true,
      defaultHarvestMonths: ref.harvestMonths,
      defaultStorageMonths: ref.storageMonths
    };
  }

  // If explicitly requested to follow reference
  if (explicitReference) {
    return {
      harvestMonths: ref.harvestMonths,
      storageMonths: ref.storageMonths,
      source: ref.source,
      isManual: false,
      defaultHarvestMonths: ref.harvestMonths,
      defaultStorageMonths: ref.storageMonths
    };
  }

  // If custom attributes exist and differ from the default reference, it's a manual modification
  if (Array.isArray(customHarvest) && customHarvest.length > 0) {
    const normH = Array.from(new Set(customHarvest.map(m => Math.floor(Number(m))))).filter(m => m >= 1 && m <= 12).sort((a, b) => a - b);
    const normS = Array.isArray(customStorage)
      ? Array.from(new Set(customStorage.map(m => Math.floor(Number(m))))).filter(m => m >= 1 && m <= 12).sort((a, b) => a - b)
      : [];

    const hMatches = normH.length === ref.harvestMonths.length && normH.every((m, idx) => m === ref.harvestMonths[idx]);
    const sMatches = normS.length === ref.storageMonths.length && normS.every((m, idx) => m === ref.storageMonths[idx]);

    if (!hMatches || !sMatches) {
      return {
        harvestMonths: normH,
        storageMonths: normS,
        source: 'manual',
        isManual: true,
        defaultHarvestMonths: ref.harvestMonths,
        defaultStorageMonths: ref.storageMonths
      };
    }
  }

  // Otherwise, use reference
  return {
    harvestMonths: ref.harvestMonths,
    storageMonths: ref.storageMonths,
    source: ref.source,
    isManual: false,
    defaultHarvestMonths: ref.harvestMonths,
    defaultStorageMonths: ref.storageMonths
  };
}

/**
 * Sorts items alphabetically by Variety (Species - Variety)
 */
export function sortScheduleByVariety(items: HarvestStorageScheduleItem[]): HarvestStorageScheduleItem[] {
  return [...items].sort((a, b) => {
    return a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
  });
}

/**
 * Sorts items chronologically by Harvest start month, then harvest end, then storage start, then variety name
 */
export function sortScheduleByPeriod(items: HarvestStorageScheduleItem[]): HarvestStorageScheduleItem[] {
  return [...items].sort((a, b) => {
    const getMinMonth = (months: number[]) => months.length > 0 ? Math.min(...months) : 999;
    const getMaxMonth = (months: number[]) => months.length > 0 ? Math.max(...months) : 999;

    const aHarvestStart = getMinMonth(a.harvestMonths);
    const bHarvestStart = getMinMonth(b.harvestMonths);

    if (aHarvestStart !== bHarvestStart) {
      return aHarvestStart - bHarvestStart;
    }

    const aHarvestEnd = getMaxMonth(a.harvestMonths);
    const bHarvestEnd = getMaxMonth(b.harvestMonths);

    if (aHarvestEnd !== bHarvestEnd) {
      return aHarvestEnd - bHarvestEnd;
    }

    const aStorageStart = getMinMonth(a.storageMonths);
    const bStorageStart = getMinMonth(b.storageMonths);

    if (aStorageStart !== bStorageStart) {
      return aStorageStart - bStorageStart;
    }

    return a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
  });
}

/**
 * Formats a list of month numbers into a concise French summary
 * e.g. [7, 8] -> "Juil - Août", [10] -> "Octobre", [11, 12, 1, 2] -> "Nov - Fév"
 */
export function formatMonthRangeSummary(months?: number[]): string {
  if (!months || months.length === 0) return 'Non définie';
  const clean = Array.from(new Set(months.map(m => Math.floor(m)))).filter(m => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (clean.length === 0) return 'Non définie';
  if (clean.length === 12) return 'Toute l’année';

  if (clean.length === 1) {
    return MONTH_NAMES_FR[clean[0] - 1];
  }

  // Check if consecutive
  let isContinuous = true;
  for (let i = 1; i < clean.length; i++) {
    if (clean[i] !== clean[i - 1] + 1) {
      isContinuous = false;
      break;
    }
  }

  if (isContinuous) {
    return `${MONTH_ABBR_FR[clean[0] - 1]} → ${MONTH_ABBR_FR[clean[clean.length - 1] - 1]}`;
  }

  // Cross year check (e.g. [1, 2, 11, 12])
  const hasJanDec = clean.includes(1) && clean.includes(12);
  if (hasJanDec) {
    // Find where the split is
    const winterMonths = clean;
    const startLate = winterMonths.filter(m => m >= 7).sort((a, b) => a - b);
    const endEarly = winterMonths.filter(m => m < 7).sort((a, b) => a - b);
    if (startLate.length > 0 && endEarly.length > 0) {
      return `${MONTH_ABBR_FR[startLate[0] - 1]} → ${MONTH_ABBR_FR[endEarly[endEarly.length - 1] - 1]}`;
    }
  }

  return clean.map(m => MONTH_ABBR_FR[m - 1]).join(', ');
}

/**
 * Builds the full catalog list of HarvestStorageScheduleItem from Firestore config, encyclopedia, and trees.
 */
export function buildCatalogHarvestStorageItems(
  config: any[] | undefined,
  encyclopedia: any[] | undefined,
  trees: any[] | undefined
): HarvestStorageScheduleItem[] {
  if (!config || !encyclopedia) return [];

  const configVegetables = config.filter((c: any) => c.type === 'vegetable');
  const encyclopediaEntries = encyclopedia;

  const allNames = Array.from(new Set([
    ...configVegetables.map((c: any) => (c.value || '').toLowerCase().trim()),
    ...encyclopediaEntries.map((e: any) => (e.name || '').toLowerCase().trim()),
  ])).filter(Boolean);

  const items: HarvestStorageScheduleItem[] = [];

  allNames
    .map(nameLower => {
      const conf = configVegetables.find((c: any) => (c.value || '').toLowerCase().trim() === nameLower);
      const enc = encyclopediaEntries.find((e: any) => (e.name || '').toLowerCase().trim() === nameLower);
      const treeSample = trees?.find((t: any) => !t.isDeleted && (t.species || '').toLowerCase().trim() === nameLower);

      const displayName = enc?.name || conf?.value || treeSample?.species || '';
      const rawCategories: string[] = Array.isArray(enc?.categories) && enc.categories.length > 0
        ? enc.categories
        : (enc?.category ? [enc.category] : (treeSample ? ['Arbre fruitier'] : ['Légume']));
      const canonicalCategories = rawCategories.map((c: string) => getCanonicalCategory(c, config));
      const primaryCategory = canonicalCategories[0] || 'Légume';
      const icon = enc?.icon || (primaryCategory === 'Arbre fruitier' ? (treeSample?.icon || 'Trees') : 'Sprout');
      const color = enc?.color || treeSample?.color || '#10b981';
      const id = conf ? `c-${conf.id}` : (enc ? `e-${enc.id}` : nameLower);

      return {
        id,
        nameLower,
        name: displayName,
        configId: conf?.id,
        encyclopediaId: enc?.id,
        category: primaryCategory,
        harvestPeriod: enc?.harvestPeriod || '',
        icon,
        color,
      };
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
    .forEach(p => {
      const ids = new Set<string>();
      if (p.configId) ids.add(p.configId);
      if (p.encyclopediaId) ids.add(p.encyclopediaId);
      encyclopediaEntries.forEach((e: any) => {
        if ((e.name || '').trim().toLowerCase() === p.nameLower && e.id) ids.add(e.id);
      });
      configVegetables.forEach((c: any) => {
        if ((c.value || '').trim().toLowerCase() === p.nameLower && c.id) ids.add(c.id);
      });

      const vars = config.filter((c: any) => c.type === 'variety' && ids.has(c.parentId) && !isTechnicalId(c.value));
      const orchardCount = trees?.filter((t: any) => !t.isDeleted && (t.species || '').toLowerCase().trim() === p.nameLower).length || 0;

      if (vars.length > 0) {
        vars.forEach((v: any) => {
          const resolved = resolveVarietyHarvestAndStorage(
            p.name,
            v.value,
            v.attributes || {},
            p.harvestPeriod
          );
          const qty = Math.max(1, v.quantity !== undefined ? Number(v.quantity) : (v.attributes?.quantity !== undefined ? Number(v.attributes.quantity) : 1));
          const isTemp = Boolean(v.attributes?.isTemporary || v.attributes?.status === 'temporary');
          items.push({
            id: `${p.id}___${v.id || v.value}`,
            species: p.name,
            variety: v.value,
            displayName: `${p.name} - ${v.value}`,
            category: p.category,
            icon: p.icon,
            color: p.color,
            harvestMonths: resolved.harvestMonths,
            storageMonths: resolved.storageMonths,
            harvestSource: resolved.source,
            isManualHarvest: resolved.isManual,
            defaultHarvestMonths: resolved.defaultHarvestMonths,
            defaultStorageMonths: resolved.defaultStorageMonths,
            varietyConfigId: v.id,
            parentId: p.id,
            totalQuantity: qty,
            orchardCount,
            isTemporary: isTemp,
            status: isTemp ? 'temporary' : 'confirmed'
          });
        });
      } else {
        const resolved = resolveVarietyHarvestAndStorage(
          p.name,
          'Standard',
          undefined,
          p.harvestPeriod
        );
        items.push({
          id: `${p.id}___standard`,
          species: p.name,
          variety: 'Standard',
          displayName: `${p.name} - Standard`,
          category: p.category,
          icon: p.icon,
          color: p.color,
          harvestMonths: resolved.harvestMonths,
          storageMonths: resolved.storageMonths,
          harvestSource: resolved.source,
          isManualHarvest: resolved.isManual,
          defaultHarvestMonths: resolved.defaultHarvestMonths,
          defaultStorageMonths: resolved.defaultStorageMonths,
          parentId: p.id,
          totalQuantity: Math.max(1, orchardCount),
          orchardCount,
          isTemporary: false,
          status: 'confirmed'
        });
      }
    });

  return items;
}

