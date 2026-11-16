import { toDateKey } from './notes';
import { fb } from '../hooks/useFirebaseData';

export interface VarietyPlantingEntry {
  datePlanted: string;
  dateUnknown?: boolean;
  location: string;
  rootstock: string;
}

/**
 * Extracts normalized planting entries from a variety's attributes,
 * keeping full backwards compatibility with single datePlanted / location / rootstock fields.
 */
export function getVarietyPlantings(attributes?: Record<string, any>): VarietyPlantingEntry[] {
  if (!attributes) return [];

  const legacyRootstock = attributes.rootstock ? String(attributes.rootstock).trim() : '';

  if (Array.isArray(attributes.plantings) && attributes.plantings.length > 0) {
    return attributes.plantings.map((entry: any, idx: number) => {
      const datePlanted = entry?.datePlanted ? (toDateKey(entry.datePlanted) || String(entry.datePlanted).trim()) : '';
      return {
        datePlanted,
        dateUnknown: !datePlanted && Boolean(entry?.dateUnknown),
        location: entry?.location ? String(entry.location).trim() : '',
        rootstock: entry?.rootstock !== undefined
          ? String(entry.rootstock).trim()
          : (idx === 0 ? legacyRootstock : ''),
      };
    });
  }

  const legacyDate = attributes.datePlanted
    ? (toDateKey(attributes.datePlanted) || String(attributes.datePlanted).trim())
    : '';
  const legacyDateUnknown = !legacyDate && Boolean(attributes.dateUnknown);
  const legacyLoc = attributes.location ? String(attributes.location).trim() : '';

  if (legacyDate || legacyDateUnknown || legacyLoc || legacyRootstock) {
    return [{
      datePlanted: legacyDate,
      dateUnknown: legacyDateUnknown,
      location: legacyLoc,
      rootstock: legacyRootstock,
    }];
  }

  return [];
}

/**
 * Returns all distinct non-empty rootstock values across a variety's specimens.
 */
export function getDistinctRootstocks(attributes?: Record<string, any>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const p of getVarietyPlantings(attributes)) {
    const rs = (p.rootstock || '').trim();
    if (rs && !seen.has(rs.toLowerCase())) {
      seen.add(rs.toLowerCase());
      result.push(rs);
    }
  }

  const legacy = (attributes?.rootstock || '').trim();
  if (legacy && !seen.has(legacy.toLowerCase())) {
    seen.add(legacy.toLowerCase());
    result.push(legacy);
  }

  return result;
}

/**
 * Pads or slices a plantings list to match the desired specimen quantity.
 */
export function resizePlantingsToQuantity(
  entries: Partial<VarietyPlantingEntry>[],
  quantity: number
): VarietyPlantingEntry[] {
  const safeQty = Math.max(1, Math.floor(quantity) || 1);
  return Array.from({ length: safeQty }, (_, idx) => {
    const datePlanted = entries[idx]?.datePlanted || '';
    return {
      datePlanted,
      dateUnknown: !datePlanted && Boolean(entries[idx]?.dateUnknown),
      location: entries[idx]?.location || '',
      rootstock: entries[idx]?.rootstock || '',
    };
  });
}

/**
 * Prepares plantings for Firestore storage (keeps slot indices up to last filled specimen,
 * and computes legacy fallback fields datePlanted / location / rootstock).
 */
export function buildPlantingsPayload(
  entries: Partial<VarietyPlantingEntry>[],
  quantity: number
): {
  plantings?: Array<{ datePlanted: string; dateUnknown?: boolean; location: string; rootstock: string }>;
  datePlanted?: string;
  location?: string;
  rootstock?: string;
} {
  const resized = resizePlantingsToQuantity(entries, quantity).map(item => {
    const datePlanted = (item.datePlanted || '').trim();
    const dateUnknown = !datePlanted && Boolean(item.dateUnknown);
    const cleaned: { datePlanted: string; dateUnknown?: boolean; location: string; rootstock: string } = {
      datePlanted,
      location: (item.location || '').trim(),
      rootstock: (item.rootstock || '').trim(),
    };
    if (dateUnknown) {
      cleaned.dateUnknown = true;
    }
    return cleaned;
  });

  const hasAnyData = resized.some(
    item => item.datePlanted !== '' || Boolean(item.dateUnknown) || item.location !== '' || item.rootstock !== ''
  );
  if (!hasAnyData) {
    return {};
  }

  let lastNonEmptyIdx = -1;
  resized.forEach((item, idx) => {
    if (item.datePlanted || item.dateUnknown || item.location || item.rootstock) lastNonEmptyIdx = idx;
  });
  const compact = resized.slice(0, lastNonEmptyIdx + 1);

  const firstDate = compact.find(item => item.datePlanted)?.datePlanted;
  const firstLocation = compact.find(item => item.location)?.location;
  const firstRootstock = compact.find(item => item.rootstock)?.rootstock;

  return {
    plantings: compact,
    ...(firstDate ? { datePlanted: firstDate } : {}),
    ...(firstLocation ? { location: firstLocation } : {}),
    ...(firstRootstock ? { rootstock: firstRootstock } : {}),
  };
}

export interface VarietyMissingDateStats {
  total: number;
  filled: number;
  unknown: number;
  missing: number;
  isExcluded: boolean;
  isTemporary: boolean;
  isMissingAny: boolean;
  isMissingAll: boolean;
}

/**
 * Computes how many specimens of a variety have a known/unknown date vs missing a date.
 * Respects per-variety `excludePlantingDateTracking` opt-out and excludes temporary ("En projet") varieties.
 */
export function getVarietyMissingDateStats(
  attributes?: Record<string, any>,
  quantity?: number
): VarietyMissingDateStats {
  const rawQty =
    quantity !== undefined
      ? Number(quantity)
      : attributes?.quantity !== undefined
        ? Number(attributes.quantity)
        : 1;
  const safeQty = Math.max(1, Number.isFinite(rawQty) ? Math.floor(rawQty) : 1);

  const isTemporary = Boolean(attributes?.isTemporary || attributes?.status === 'temporary');
  const isManualExcluded = Boolean(attributes?.excludePlantingDateTracking);

  if (isTemporary || isManualExcluded) {
    return {
      total: safeQty,
      filled: safeQty,
      unknown: 0,
      missing: 0,
      isExcluded: isManualExcluded,
      isTemporary,
      isMissingAny: false,
      isMissingAll: false,
    };
  }

  const resized = resizePlantingsToQuantity(getVarietyPlantings(attributes), safeQty);
  let dated = 0;
  let unknown = 0;
  for (const entry of resized) {
    if ((entry.datePlanted || '').trim()) {
      dated += 1;
    } else if (entry.dateUnknown) {
      unknown += 1;
    }
  }
  const resolved = dated + unknown;
  const missing = Math.max(0, safeQty - resolved);
  return {
    total: safeQty,
    filled: dated,
    unknown,
    missing,
    isExcluded: false,
    isTemporary: false,
    isMissingAny: missing > 0,
    isMissingAll: resolved === 0,
  };
}

const TRACKED_PLANTING_CATEGORIES = new Set([
  'arbre fruitier',
  'arbres fruitiers',
  'petits fruits',
  'petit fruit',
  'fruit',
  'fruits',
  'vigne',
  'vignes',
  'agrume',
  'agrumes',
  'arbuste',
  'arbustes',
  'vivace',
  'vivaces',
  'plante vivace',
  'plantes vivaces',
  'grimpant',
  'grimpante',
  'grimpants',
  'grimpantes',
]);

function normalizeTrackingCategoryKey(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Returns true when at least one plant category corresponds to a persistent/perennial plant
 * (fruit trees, small fruits, fruits, vines, shrubs, etc.) tracked by default.
 * Vegetables, tubers, roots, flowers and aromatics return false by default.
 */
export function isCategoryTrackedForPlantingByDefault(categories?: string | string[] | null): boolean {
  const list = Array.isArray(categories)
    ? categories
    : categories
      ? [categories]
      : [];
  return list.some(cat => TRACKED_PLANTING_CATEGORIES.has(normalizeTrackingCategoryKey(cat)));
}

/**
 * Resolves whether catalog planting date tracking is active for a plant.
 * Explicit `trackPlantingDate` boolean overrides the category default.
 */
export function isPlantTrackedForPlanting(plant?: {
  trackPlantingDate?: boolean;
  category?: string;
  categories?: string[];
} | null): boolean {
  if (!plant) return false;
  if (typeof plant.trackPlantingDate === 'boolean') {
    return plant.trackPlantingDate;
  }
  const cats = plant.categories && plant.categories.length > 0
    ? plant.categories
    : plant.category
      ? [plant.category]
      : [];
  return isCategoryTrackedForPlantingByDefault(cats);
}

export const DEFAULT_ROOTSTOCKS: Array<{ id: string; value: string }> = [
  { id: 'rs_franc', value: '🌱 Franc (semis)' },
  { id: 'rs_non_greffe', value: '🌱 Non greffé / Franc de pied' },
  { id: 'rs_m9', value: '🌱 M9 (Pommier - faible vigueur)' },
  { id: 'rs_m26', value: '🌱 M26 (Pommier - vigueur modérée)' },
  { id: 'rs_mm106', value: '🌱 MM106 (Pommier - demi-tige)' },
  { id: 'rs_mm111', value: '🌱 MM111 (Pommier - haute-tige)' },
  { id: 'rs_ba29', value: '🌱 Cognassier de Provence BA29 (Poirier)' },
  { id: 'rs_sydo', value: "🌱 Cognassier d'Angers Sydo (Poirier)" },
  { id: 'rs_st_julien', value: '🌱 Saint-Julien A (Prunier / Pêcher)' },
  { id: 'rs_myrobolan', value: '🌱 Myrobolan (Prunier / Abricotier)' },
  { id: 'rs_gisela5', value: '🌱 Gisela 5 (Cerisier - nain)' },
  { id: 'rs_maxma14', value: '🌱 MaxMa 14 (Cerisier - demi-tige)' },
  { id: 'rs_mahaleb', value: '🌱 Sainte-Lucie / Mahaleb (Cerisier)' },
  { id: 'rs_gf677', value: '🌱 GF 677 (Pêcher / Amandier)' },
  { id: 'rs_montclar', value: '🌱 Montclar (Pêcher)' },
];

let isSeedingRootstocks = false;

export async function ensureRootstocksInitialized(config: any[] | undefined | null): Promise<void> {
  if (!config || config.length === 0 || isSeedingRootstocks) return;
  const isInitialized = config.some((c: any) => c.id === 'rootstocks_initialized');
  const existingRootstocks = config.filter((c: any) => c.type === 'rootstock');

  if (!isInitialized && existingRootstocks.length === 0) {
    isSeedingRootstocks = true;
    try {
      await fb.put('config', {
        id: 'rootstocks_initialized',
        type: 'setting',
        value: 'true',
      });
      for (const def of DEFAULT_ROOTSTOCKS) {
        await fb.put('config', {
          id: def.id,
          type: 'rootstock',
          value: def.value,
          attributes: { emoji: '🌱' },
        });
      }
    } catch (err) {
      console.error('Failed to seed default rootstocks:', err);
    } finally {
      isSeedingRootstocks = false;
    }
  }
}
