import { toDateKey } from './notes';

export interface VarietyPlantingEntry {
  datePlanted: string;
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
    return attributes.plantings.map((entry: any, idx: number) => ({
      datePlanted: entry?.datePlanted ? (toDateKey(entry.datePlanted) || String(entry.datePlanted).trim()) : '',
      location: entry?.location ? String(entry.location).trim() : '',
      rootstock: entry?.rootstock !== undefined
        ? String(entry.rootstock).trim()
        : (idx === 0 ? legacyRootstock : ''),
    }));
  }

  const legacyDate = attributes.datePlanted
    ? (toDateKey(attributes.datePlanted) || String(attributes.datePlanted).trim())
    : '';
  const legacyLoc = attributes.location ? String(attributes.location).trim() : '';

  if (legacyDate || legacyLoc || legacyRootstock) {
    return [{ datePlanted: legacyDate, location: legacyLoc, rootstock: legacyRootstock }];
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
  return Array.from({ length: safeQty }, (_, idx) => ({
    datePlanted: entries[idx]?.datePlanted || '',
    location: entries[idx]?.location || '',
    rootstock: entries[idx]?.rootstock || '',
  }));
}

/**
 * Prepares plantings for Firestore storage (keeps slot indices up to last filled specimen,
 * and computes legacy fallback fields datePlanted / location / rootstock).
 */
export function buildPlantingsPayload(
  entries: Partial<VarietyPlantingEntry>[],
  quantity: number
): {
  plantings?: VarietyPlantingEntry[];
  datePlanted?: string;
  location?: string;
  rootstock?: string;
} {
  const resized = resizePlantingsToQuantity(entries, quantity).map(item => ({
    datePlanted: (item.datePlanted || '').trim(),
    location: (item.location || '').trim(),
    rootstock: (item.rootstock || '').trim(),
  }));

  const hasAnyData = resized.some(
    item => item.datePlanted !== '' || item.location !== '' || item.rootstock !== ''
  );
  if (!hasAnyData) {
    return {};
  }

  let lastNonEmptyIdx = -1;
  resized.forEach((item, idx) => {
    if (item.datePlanted || item.location || item.rootstock) lastNonEmptyIdx = idx;
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
  missing: number;
  isMissingAny: boolean;
  isMissingAll: boolean;
}

/**
 * Computes how many specimens of a variety have or are missing a planting date.
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
  const resized = resizePlantingsToQuantity(getVarietyPlantings(attributes), safeQty);
  const filled = resized.filter(entry => Boolean((entry.datePlanted || '').trim())).length;
  const missing = Math.max(0, safeQty - filled);
  return {
    total: safeQty,
    filled,
    missing,
    isMissingAny: missing > 0,
    isMissingAll: filled === 0,
  };
}

