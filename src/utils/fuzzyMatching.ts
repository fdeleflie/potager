// Fuzzy matching, normalization, and deduplication utility for plants and varieties
import { isTechnicalId } from './varietyNormalizer';

/**
 * Normalizes a French plant or variety string for robust phonetic & orthographic comparison:
 * - strips diacritics / accents (é, è, ê, ë, à, â, î, ï, ô, ö, ù, û, ü, ç -> e, a, i, o, u, c)
 * - converts hyphens, apostrophes (', ’, `), dots, slashes, underscores to spaces
 * - removes special symbols
 * - strips minor French stop words / articles if requested (d', de, du, des, le, la, les, l')
 * - stems plural trailing 's' / 'x' on words with length > 4 (e.g. "oullins" -> "oullin")
 * - collapses spaces & trims lowercase
 */
export function normalizeVarietyName(str: string, aggressive = false): string {
  if (!str) return '';

  // 1. Lowercase and normalize unicode diacritics
  let norm = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 2. Replace apostrophes and hyphens with spaces
  norm = norm.replace(/['’`\-_./\\,;:()\[\]{}*+?^$|#]/g, ' ');

  // 3. Keep only alphanumeric chars and spaces
  norm = norm.replace(/[^a-z0-9\s]/g, ' ');

  // 4. Split into words
  const words = norm.split(/\s+/).filter(w => w.length > 0);

  if (aggressive) {
    const stopWords = new Set(['d', 'de', 'du', 'des', 'le', 'la', 'les', 'l', 'un', 'une', 'arbre', 'variete', 'fruitier']);
    const filtered = words.filter(w => !stopWords.has(w)).map(w => {
      // Stem trailing 's' or 'x' for French plurals on longer words (e.g. oullins -> oullin, royales -> royale)
      if (w.length > 4 && (w.endsWith('s') || w.endsWith('x'))) {
        return w.slice(0, -1);
      }
      return w;
    });
    return filtered.sort().join(' ');
  }

  return words.join(' ');
}

/**
 * Standard Levenshtein Distance
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const v0: number[] = new Array(s2.length + 1);
  const v1: number[] = new Array(s2.length + 1);

  for (let i = 0; i <= s2.length; i++) {
    v0[i] = i;
  }

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= s2.length; j++) {
      v0[j] = v1[j];
    }
  }

  return v1[s2.length];
}

/**
 * Computes Levenshtein-based similarity ratio (0 to 1)
 */
export function stringSimilarityRatio(s1: string, s2: string): number {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

/**
 * Computes Jaccard word-set similarity ratio (0 to 1)
 */
export function tokenJaccardSimilarity(s1: string, s2: string): number {
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 0));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 0));
  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;

  let intersection = 0;
  words1.forEach(w => {
    if (words2.has(w)) intersection++;
  });

  const union = new Set([...words1, ...words2]).size;
  return intersection / union;
}

/**
 * Intelligent combined similarity score between two variety or plant names (0% to 100%)
 */
export function computeVarietySimilarity(nameA: string, nameB: string): number {
  if (!nameA || !nameB) return 0;
  const rawA = nameA.trim().toLowerCase();
  const rawB = nameB.trim().toLowerCase();
  if (rawA === rawB) return 100;

  // 1. Basic normalized comparison (without aggressive stemming)
  const normA = normalizeVarietyName(nameA, false);
  const normB = normalizeVarietyName(nameB, false);
  if (normA === normB) return 99;

  // 2. Aggressive normalized comparison (with French stemming and stop words removed)
  const aggA = normalizeVarietyName(nameA, true);
  const aggB = normalizeVarietyName(nameB, true);
  if (aggA === aggB && aggA.length > 0) return 95;

  // 3. String distance on normalized strings
  const levScore = stringSimilarityRatio(normA, normB);
  const tokScore = tokenJaccardSimilarity(normA, normB);

  // Substring bonus (e.g. "Reine Claude d'Oullins" vs "Reine Claude d'Oullins (Jaune)")
  let substringBonus = 0;
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    const maxLen = Math.max(normA.length, normB.length);
    if (minLen >= 4 && minLen / maxLen > 0.6) {
      substringBonus = 0.15;
    }
  }

  const combined = Math.min(1.0, (levScore * 0.6) + (tokScore * 0.4) + substringBonus);
  return Math.round(combined * 100);
}

export interface VarietyVariantItem {
  id: string;
  name: string;
  parentId: string;
  attributes?: any;
  plantName: string;
  treesCount: number;
  seedlingsCount: number;
}

export interface SimilarVarietyGroup {
  id: string; // group identifier
  plantName: string;
  canonicalParentId: string;
  suggestedName: string;
  variants: VarietyVariantItem[];
  maxSimilarity: number;
  isExactMatch: boolean;
}

/**
 * Scans all varieties across config and groups them into duplicate / similar clusters.
 */
export function detectSimilarVarieties(
  config: any[] | undefined,
  encyclopedia: any[] | undefined,
  trees: any[] | undefined,
  seedlings: any[] | undefined,
  threshold = 75,
  targetPlantName?: string
): SimilarVarietyGroup[] {
  if (!config) return [];

  // Build parent ID to Plant Name map
  const parentIdToPlantName = new Map<string, string>();
  const plantNameToPrimaryId = new Map<string, string>();

  encyclopedia?.forEach(e => {
    if (e.id && e.name) {
      const pName = e.name.trim();
      parentIdToPlantName.set(e.id, pName);
      if (!plantNameToPrimaryId.has(pName.toLowerCase())) {
        plantNameToPrimaryId.set(pName.toLowerCase(), e.id);
      }
    }
  });

  config.filter(c => c.type === 'vegetable').forEach(c => {
    if (c.id && c.value) {
      const pName = c.value.trim();
      parentIdToPlantName.set(c.id, pName);
      if (!plantNameToPrimaryId.has(pName.toLowerCase())) {
        plantNameToPrimaryId.set(pName.toLowerCase(), c.id);
      }
    }
  });

  // Count usage in trees and seedlings
  const varietyTreeCount = new Map<string, number>(); // key: `${plantName}___${varNameNorm}`
  trees?.forEach(t => {
    if (t.species && t.variety) {
      const k = `${t.species.trim().toLowerCase()}___${t.variety.trim().toLowerCase()}`;
      varietyTreeCount.set(k, (varietyTreeCount.get(k) || 0) + 1);
    }
  });

  const varietySeedlingCount = new Map<string, number>();
  seedlings?.forEach(s => {
    if (s.vegetable && s.variety) {
      const k = `${s.vegetable.trim().toLowerCase()}___${s.variety.trim().toLowerCase()}`;
      varietySeedlingCount.set(k, (varietySeedlingCount.get(k) || 0) + 1);
    }
  });

  // Collect all variety items
  const allVarieties: VarietyVariantItem[] = [];
  config
    .filter(c => c.type === 'variety' && c.value && !isTechnicalId(c.value))
    .forEach(v => {
      let pName = parentIdToPlantName.get(v.parentId);
      if (!pName || isTechnicalId(pName)) {
        pName = 'Autre';
      }
      if (targetPlantName && pName.toLowerCase() !== targetPlantName.trim().toLowerCase()) {
        return;
      }
      const usageKey = `${pName.toLowerCase()}___${(v.value || '').trim().toLowerCase()}`;
      allVarieties.push({
        id: v.id,
        name: v.value.trim(),
        parentId: v.parentId,
        attributes: v.attributes,
        plantName: pName,
        treesCount: varietyTreeCount.get(usageKey) || 0,
        seedlingsCount: varietySeedlingCount.get(usageKey) || 0,
      });
    });

  // Group varieties by plant name
  const plantGroups = new Map<string, VarietyVariantItem[]>();
  allVarieties.forEach(v => {
    const pKey = v.plantName.toLowerCase();
    if (!plantGroups.has(pKey)) plantGroups.set(pKey, []);
    plantGroups.get(pKey)!.push(v);
  });

  const resultGroups: SimilarVarietyGroup[] = [];
  let groupCounter = 1;

  plantGroups.forEach((items, pKey) => {
    const visited = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const itemA = items[i];
      if (visited.has(itemA.id)) continue;

      const cluster: VarietyVariantItem[] = [itemA];
      visited.add(itemA.id);
      let highestSimilarity = 0;
      let hasExact = false;

      for (let j = i + 1; j < items.length; j++) {
        const itemB = items[j];
        if (visited.has(itemB.id)) continue;

        const score = computeVarietySimilarity(itemA.name, itemB.name);
        if (score >= threshold) {
          cluster.push(itemB);
          visited.add(itemB.id);
          highestSimilarity = Math.max(highestSimilarity, score);
          if (score >= 99 || itemA.name.trim().toLowerCase() === itemB.name.trim().toLowerCase()) {
            hasExact = true;
          }
        }
      }

      // If we found duplicates or similar items in this cluster
      if (cluster.length > 1) {
        // Find best suggested canonical name:
        // Prioritize: items with attributes > items used in trees/seedlings > nicely capitalized names
        const sortedForCanonical = [...cluster].sort((a, b) => {
          const attrA = a.attributes && Object.keys(a.attributes).length > 0 ? 1 : 0;
          const attrB = b.attributes && Object.keys(b.attributes).length > 0 ? 1 : 0;
          if (attrA !== attrB) return attrB - attrA;

          const usageA = a.treesCount + a.seedlingsCount;
          const usageB = b.treesCount + b.seedlingsCount;
          if (usageA !== usageB) return usageB - usageA;

          // Prefer title-cased name over all-lowercase
          const isTitleA = /^[A-Z]/.test(a.name) ? 1 : 0;
          const isTitleB = /^[A-Z]/.test(b.name) ? 1 : 0;
          if (isTitleA !== isTitleB) return isTitleB - isTitleA;

          return b.name.length - a.name.length;
        });

        const bestItem = sortedForCanonical[0];
        const primaryParentId = plantNameToPrimaryId.get(pKey) || bestItem.parentId;

        resultGroups.push({
          id: `var-group-${groupCounter++}`,
          plantName: bestItem.plantName,
          canonicalParentId: primaryParentId,
          suggestedName: bestItem.name,
          variants: cluster,
          maxSimilarity: highestSimilarity || (hasExact ? 100 : 90),
          isExactMatch: hasExact && cluster.every(v => v.name.trim().toLowerCase() === cluster[0].name.trim().toLowerCase()),
        });
      }
    }
  });

  // Sort groups: exact matches and highest similarity first
  return resultGroups.sort((a, b) => {
    if (a.isExactMatch && !b.isExactMatch) return -1;
    if (!a.isExactMatch && b.isExactMatch) return 1;
    return b.maxSimilarity - a.maxSimilarity;
  });
}
