/**
 * Category Normalization and Harmonization Utilities
 * Handles accent-insensitive, case-insensitive normalization and canonical resolution.
 */

export const DEFAULT_PLANT_CATEGORIES = [
  'Légume',
  'Arbre fruitier',
  'Petits fruits',
  'Aromatique',
  'Fleur',
  'Fruit',
  'Racine',
  'Tubercule'
];

/**
 * Normalizes a category string by stripping accents/diacritics, trimming, and lowercasing.
 * E.g. "Légume", "legume", "LEGUME", "LÉGUME" -> "legume"
 */
export function normalizeCategoryKey(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Compares two categories for equality, ignoring accents and case.
 */
export function areCategoriesEqual(a?: string | null, b?: string | null): boolean {
  return normalizeCategoryKey(a) === normalizeCategoryKey(b);
}

/**
 * Returns the number of accented French characters in a string.
 */
function countAccents(str: string): number {
  return (str.match(/[éèêëàâäôöîïùûüçÉÈÊËÀÂÄÔÖÎÏÙÛÜÇ]/g) || []).length;
}

/**
 * Resolves any raw category name to its canonical version:
 * 1. Checks user-defined categories in config (if provided)
 * 2. Checks standard default plant categories
 * 3. Falls back to trimmed original with capital first letter
 */
export function getCanonicalCategory(
  rawName?: string | null,
  configCategories?: any[] | null
): string {
  if (!rawName || !rawName.trim()) {
    return 'Légume';
  }

  const trimmed = rawName.trim();
  const normalized = normalizeCategoryKey(trimmed);

  // 1. Check in config categories (type === 'category' or direct array)
  if (configCategories && Array.isArray(configCategories)) {
    const configMatch = configCategories.find((c: any) => {
      const val = typeof c === 'string' ? c : (c.type === 'category' ? c.value : (c.value || ''));
      return normalizeCategoryKey(val) === normalized;
    });

    if (configMatch) {
      const canonicalVal = typeof configMatch === 'string' ? configMatch : configMatch.value;
      if (canonicalVal && canonicalVal.trim()) {
        return canonicalVal.trim();
      }
    }
  }

  // 2. Check standard defaults (which have proper accents like "Légume")
  const defaultMatch = DEFAULT_PLANT_CATEGORIES.find(
    d => normalizeCategoryKey(d) === normalized
  );
  if (defaultMatch) {
    return defaultMatch;
  }

  // 3. Fallback: Capitalize first letter, keep remainder as is
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Deduplicates an array of category strings by normalizing accents and casing.
 * In case of collision (e.g. "Legume" vs "Légume"), picks the best canonical version
 * based on config, default catalog, accent count, and title-casing.
 */
export function deduplicateCategories(
  categories: (string | undefined | null)[],
  configCategories?: any[] | null
): string[] {
  const groups = new Map<string, string[]>();

  categories.forEach(cat => {
    if (!cat || !cat.trim()) return;
    const trimmed = cat.trim();
    const key = normalizeCategoryKey(trimmed);
    if (!key) return;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(trimmed);
  });

  const result: string[] = [];

  for (const [key, variants] of groups.entries()) {
    // 1. Is there a configured category in config?
    let chosen: string | null = null;
    if (configCategories && Array.isArray(configCategories)) {
      const match = configCategories.find((c: any) => {
        const val = typeof c === 'string' ? c : (c.type === 'category' ? c.value : (c.value || ''));
        return normalizeCategoryKey(val) === key;
      });
      if (match) {
        chosen = typeof match === 'string' ? match.trim() : (match.value || '').trim();
      }
    }

    // 2. Is there a default category matching this key?
    if (!chosen) {
      const defaultMatch = DEFAULT_PLANT_CATEGORIES.find(d => normalizeCategoryKey(d) === key);
      if (defaultMatch) {
        chosen = defaultMatch;
      }
    }

    // 3. Pick variant with most accents, then title-casing, then longest
    if (!chosen) {
      const sorted = [...variants].sort((a, b) => {
        const aAcc = countAccents(a);
        const bAcc = countAccents(b);
        if (bAcc !== aAcc) return bAcc - aAcc;
        // Prefer Title Case over ALLCAPS or all-lowercase
        const aIsTitle = /^[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]/.test(a) ? 1 : 0;
        const bIsTitle = /^[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]/.test(b) ? 1 : 0;
        if (bIsTitle !== aIsTitle) return bIsTitle - aIsTitle;
        return a.localeCompare(b);
      });
      chosen = sorted[0];
    }

    if (chosen) {
      result.push(chosen);
    }
  }

  return result.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}
