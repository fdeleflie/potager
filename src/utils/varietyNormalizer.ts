import { normalizeCategoryKey } from './categories';

/**
 * Canonical dictionary mapping common fruit names and tree names to a single canonical species key.
 * Handles plurals and common French tree vs fruit names (e.g. Pomme <-> Pommier).
 */
export const SPECIES_CANONICAL_MAP: Record<string, string> = {
  // Pommier / Pomme
  pomme: 'pommier',
  pommes: 'pommier',
  pommier: 'pommier',
  pommiers: 'pommier',

  // Poirier / Poire
  poire: 'poirier',
  poires: 'poirier',
  poirier: 'poirier',
  poiriers: 'poirier',

  // Pêcher / Pêche
  peche: 'pecher',
  peches: 'pecher',
  pecher: 'pecher',
  pechers: 'pecher',

  // Nectarinier / Nectarine
  nectarine: 'nectarinier',
  nectarines: 'nectarinier',
  nectarinier: 'nectarinier',
  nectariniers: 'nectarinier',

  // Brugnonier / Brugnon
  brugnon: 'brugnonier',
  brugnons: 'brugnonier',
  brugnonier: 'brugnonier',
  brugnoniers: 'brugnonier',

  // Cerisier / Cerise
  cerise: 'cerisier',
  cerises: 'cerisier',
  cerisier: 'cerisier',
  cerisiers: 'cerisier',

  // Prunier / Prune / Mirabelle / Quetsche
  prune: 'prunier',
  prunes: 'prunier',
  prunier: 'prunier',
  pruniers: 'prunier',
  quetsche: 'quetschier',
  quetsches: 'quetschier',
  quetschier: 'quetschier',
  quetschiers: 'quetschier',
  mirabelle: 'mirabellier',
  mirabelles: 'mirabellier',
  mirabellier: 'mirabellier',
  mirabelliers: 'mirabellier',

  // Abricotier / Abricot
  abricot: 'abricotier',
  abricots: 'abricotier',
  abricotier: 'abricotier',
  abricotiers: 'abricotier',

  // Figuier / Figue
  figue: 'figuier',
  figues: 'figuier',
  figuier: 'figuier',
  figuiers: 'figuier',

  // Vigne / Raisin
  raisin: 'vigne',
  raisins: 'vigne',
  vigne: 'vigne',
  vignes: 'vigne',

  // Framboisier / Framboise
  framboise: 'framboisier',
  framboises: 'framboisier',
  framboisier: 'framboisier',
  framboisiers: 'framboisier',

  // Groseillier / Groseille
  groseille: 'groseillier',
  groseilles: 'groseillier',
  groseillier: 'groseillier',
  groseilliers: 'groseillier',

  // Cassissier / Cassis
  cassis: 'cassissier',
  cassissier: 'cassissier',
  cassissiers: 'cassissier',

  // Myrtillier / Myrtille
  myrtille: 'myrtillier',
  myrtilles: 'myrtillier',
  myrtillier: 'myrtillier',
  myrtilliers: 'myrtillier',

  // Mûrier / Mûre
  mure: 'murier',
  mures: 'murier',
  murier: 'murier',
  muriers: 'murier',

  // Noyer / Noix
  noix: 'noyer',
  noyer: 'noyer',
  noyers: 'noyer',

  // Noisetier / Noisette
  noisette: 'noisetier',
  noisettes: 'noisetier',
  noisetier: 'noisetier',
  noisetiers: 'noisetier',

  // Châtaignier / Châtaigne
  chataigne: 'chataignier',
  chataignes: 'chataignier',
  chataignier: 'chataignier',
  chataigniers: 'chataignier',
  marron: 'chataignier',
  marrons: 'chataignier',
  marronnier: 'chataignier',

  // Amandier / Amande
  amande: 'amandier',
  amandes: 'amandier',
  amandier: 'amandier',
  amandiers: 'amandier',

  // Cognassier / Coing
  coing: 'cognassier',
  coings: 'cognassier',
  cognassier: 'cognassier',
  cognassiers: 'cognassier',

  // Olivier / Olive
  olive: 'olivier',
  olives: 'olivier',
  olivier: 'olivier',
  oliviers: 'olivier',

  // Kaki / Plaqueminier
  kaki: 'plaqueminier',
  kakis: 'plaqueminier',
  plaqueminier: 'plaqueminier',
  plaqueminiers: 'plaqueminier',

  // Kiwi / Actinidia
  kiwi: 'kiwi',
  kiwis: 'kiwi',
  actinidia: 'kiwi',

  // Néflier / Nèfle
  nefle: 'neflier',
  nefles: 'neflier',
  neflier: 'neflier',
  nefliers: 'neflier',

  // Sureau
  sureau: 'sureau',
  sureaux: 'sureau',
};

/**
 * Normalizes a species name (e.g. "Pêcher", "pecher", " Pêcher " -> "pecher", "Pomme" -> "pommier").
 */
export function normalizeSpeciesName(species?: string | null): string {
  if (!species) return '';
  const key = normalizeCategoryKey(species);
  if (SPECIES_CANONICAL_MAP[key]) {
    return SPECIES_CANONICAL_MAP[key];
  }
  // Try without trailing plural 's'
  if (key.endsWith('s') && SPECIES_CANONICAL_MAP[key.slice(0, -1)]) {
    return SPECIES_CANONICAL_MAP[key.slice(0, -1)];
  }
  return key;
}

/**
 * Words that are purely generic qualifiers and cannot serve as the sole matching token between varieties.
 */
export const GENERIC_VARIETY_WORDS = new Set([
  'rouge', 'jaune', 'vert', 'verte', 'blanc', 'blanche', 'noir', 'noire', 'bleu', 'bleue',
  'rose', 'dore', 'doree', 'pourpre', 'orange', 'brun', 'brune', 'violet', 'violette',
  'nain', 'naine', 'geant', 'geante', 'precoce', 'tardif', 'tardive',
  'standard', 'variete', 'type', 'gros', 'grosse', 'petit', 'petite',
  'double', 'simple', 'doux', 'douce', 'sauvage', 'commun', 'commune'
]);

/**
 * Extracts normalized tokens from a variety string.
 */
export function extractVarietyTokens(str?: string | null): string[] {
  if (!str) return [];
  const normalized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’\-_\./\(\)\[\]]/g, ' ')
    .replace(/\b(de|du|des|le|la|les|d|l)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  return normalized
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

/**
 * Normalizes a variety string for fuzzy and orthographic comparison:
 * 1. Strips accents and diacritics (Bénédicte -> benedicte)
 * 2. Lowercases & trims
 * 3. Replaces punctuation, apostrophes, hyphens, parentheses with spaces
 * 4. Removes common French prefix particles (de, du, des, le, la, les, d', l')
 * 5. Collapses repeated consecutive consonants (nn -> n, ll -> l, tt -> t, rr -> r, mm -> m, pp -> p, etc.)
 * 6. Strips trailing silent French letters ('e', 'es', 's')
 */
export function normalizeVarietyKey(variety?: string | null): string {
  if (!variety) return '';
  let str = variety
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // Replace punctuation and special characters with spaces
  str = str.replace(/['’\-_\./\(\)\[\]]/g, ' ');

  // Remove common French particles as separate words
  str = str.replace(/\b(de|du|des|le|la|les|d|l)\b/g, ' ');

  // Remove all non-alphanumeric characters and collapse spaces
  str = str.replace(/[^a-z0-9]/g, '');

  // Collapse duplicate consecutive consonants (bennedict -> benedict)
  str = str.replace(/([bcdfghjklmnpqrstvwxz])\1+/g, '$1');

  // Strip trailing silent French endings (e, es, s)
  str = str.replace(/(e|es|s)$/, '');

  return str;
}

/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Checks if two individual tokens match identically or with a small typo (e.g. delicous vs delicious).
 */
export function doTokensMatch(tokenA: string, tokenB: string): boolean {
  if (tokenA === tokenB) return true;
  const nA = normalizeVarietyKey(tokenA);
  const nB = normalizeVarietyKey(tokenB);
  if (nA && nB && nA === nB) return true;

  const maxLen = Math.max(nA.length, nB.length);
  const maxDist = maxLen >= 7 ? 2 : (maxLen >= 4 ? 1 : 0);
  if (maxDist > 0 && Math.abs(nA.length - nB.length) <= maxDist) {
    if (levenshteinDistance(nA, nB) <= maxDist) return true;
  }
  return false;
}

/**
 * Checks if one set of variety tokens is a valid distinctive subset of another.
 * E.g. ['golden'] in ['golden', 'delicious'] or ['golden', 'delicous'] -> true
 * E.g. ['boskoop'] in ['belle', 'boskoop'] -> true
 * E.g. ['granny'] in ['granny', 'smith'] -> true
 */
export function areTokensSubsets(tokA: string[], tokB: string[]): boolean {
  const [shorter, longer] = tokA.length <= tokB.length ? [tokA, tokB] : [tokB, tokA];
  if (shorter.length === 0) return false;

  let hasDistinctiveMatch = false;
  for (const sTok of shorter) {
    const matched = longer.some(lTok => doTokensMatch(sTok, lTok));
    if (!matched) return false;
    if (!GENERIC_VARIETY_WORDS.has(sTok) && sTok.length >= 3) {
      hasDistinctiveMatch = true;
    }
  }
  return hasDistinctiveMatch;
}

/**
 * Checks if two varieties are equivalent:
 * - Exact and case/accent-insensitive matches
 * - Normalized orthographic key (double consonants, silent trailing letters, French particles)
 * - Typo tolerance (delicous vs delicious, bennedict vs bénédicte)
 * - Shortened name / prefix subset matching (Golden vs Golden Delicious)
 */
export function areVarietiesEquivalent(varA?: string | null, varB?: string | null): boolean {
  if (!varA && !varB) return true;
  if (!varA || !varB) return false;

  const rawA = varA.trim();
  const rawB = varB.trim();

  // 1. Exact case-insensitive match
  if (rawA.toLowerCase() === rawB.toLowerCase()) return true;

  // 2. Accent-insensitive match
  const catA = normalizeCategoryKey(rawA);
  const catB = normalizeCategoryKey(rawB);
  if (catA === catB) return true;

  // 3. Normalized variety key (double consonants, silent trailing letters, French particles)
  const normA = normalizeVarietyKey(rawA);
  const normB = normalizeVarietyKey(rawB);
  if (normA && normB && normA === normB) return true;

  // 4. Fuzzy Levenshtein distance for close typos (dist <= 2 for words of length >= 5)
  if (normA.length >= 5 && normB.length >= 5 && Math.abs(normA.length - normB.length) <= 2) {
    if (levenshteinDistance(normA, normB) <= 2) {
      return true;
    }
  }

  // Also check Levenshtein on accent-stripped without consonant collapse
  const strippedA = catA.replace(/[^a-z0-9]/g, '');
  const strippedB = catB.replace(/[^a-z0-9]/g, '');
  if (strippedA.length >= 5 && strippedB.length >= 5 && Math.abs(strippedA.length - strippedB.length) <= 2) {
    if (levenshteinDistance(strippedA, strippedB) <= 2) {
      return true;
    }
  }

  // 5. Token-based subset matching (e.g. "Golden" vs "Golden Delicious" or "Golden Delicous")
  const tokensA = extractVarietyTokens(rawA);
  const tokensB = extractVarietyTokens(rawB);
  if (areTokensSubsets(tokensA, tokensB)) {
    return true;
  }

  return false;
}

/**
 * Detects if a string is a technical identifier (UUID, database key, hex token)
 * rather than a human-readable botanical species or variety name.
 */
export function isTechnicalId(str?: string | null): boolean {
  if (!str) return true;
  const s = str.trim();
  if (!s) return true;

  // Exact standard UUID: 8-4-4-4-12 hex digits (with or without braces)
  if (/^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(s)) return true;

  // Prefixed UUIDs (e.g. c-12345678-..., e-12345678-..., v-12345678-...)
  if (/^[cdev]-[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)) return true;

  // Truncated UUID or ID segment (e.g. de674b6d-fb5b-4286-97f8- or f001fe12-d0d2-4910-807b-b)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(s)) return true;

  // Generic hex strings with dashes: at least 14 chars with hex and dashes and no standard alphabet words
  if (/^[0-9a-f-]{14,}$/i.test(s) && (s.match(/-/g) || []).length >= 2) return true;

  return false;
}

/**
 * Determines whether a category refers to orchard fruit trees or fruit shrubs.
 * Strictly excludes vegetable categories (even 'légumes-fruits' like tomatoes and courgettes).
 */
export function isFruitCategory(category?: string | null): boolean {
  if (!category) return false;
  const cat = normalizeCategoryKey(category);
  // Exclude all vegetable families (legumes, legumes_fruits, legumes_racines, etc.)
  if (cat.includes('legume')) return false;

  return (
    cat.includes('arbre') ||
    cat.includes('arbuste') ||
    cat.includes('verger') ||
    cat.includes('fruit_rouge') ||
    cat.includes('fruits_rouges') ||
    cat.includes('petits_fruits') ||
    cat.includes('agrume') ||
    cat.includes('liane') ||
    cat.includes('baie') ||
    cat === 'fruit' ||
    cat === 'fruits'
  );
}

/**
 * Determines whether a species belongs in the fruit tree / orchard harvest calendar.
 */
export function isFruitSpecies(speciesName?: string | null, category?: string | null): boolean {
  if (!speciesName || isTechnicalId(speciesName)) return false;
  const norm = normalizeSpeciesName(speciesName);
  // Known orchard species (Pommier, Poirier, Cerisier, Pêcher, Prunier, Figuier, Framboisier, etc.)
  if (Boolean(SPECIES_CANONICAL_MAP[norm])) return true;
  // If explicitly categorized as fruit tree / orchard shrub
  if (category && isFruitCategory(category)) return true;
  return false;
}

/**
 * Ensures human-readable display name, replacing any technical IDs or UUIDs with a sensible fallback.
 */
export function cleanDisplayName(name?: string | null, fallback = ''): string {
  if (!name || isTechnicalId(name)) return fallback;
  return name.trim();
}

