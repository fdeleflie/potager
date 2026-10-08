/**
 * Data extracted from the user's Orchard Aerial Plan PDF
 * Category: "Arbre fruitier"
 * Total: 46 fruit trees, shrubs, and vines
 */

export interface OrchardFruitItem {
  species: string;
  variety: string;
  fullName: string;
  category: 'Arbre fruitier';
  exposure: 'Plein soleil' | 'Mi-ombre';
  waterNeeds: 'Faible' | 'Moyen' | 'Élevé';
  spacing: string; // in cm
  sowingPeriod: string;
  plantingPeriod: string;
  harvestPeriod: string;
  icon: string;
  color: string;
  tips: string;
}

export const ORCHARD_PDF_SPECIES = [
  {
    name: 'Pommier',
    icon: 'Apple',
    color: '#ef4444',
    spacing: '400',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Août - Novembre',
    tips: 'Tailler en fin d’hiver pour favoriser la fructification. Éclaircir les fruits en juin pour calibrer la récolte.'
  },
  {
    name: 'Poirier',
    icon: 'Trees',
    color: '#84cc16',
    spacing: '400',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Août - Octobre',
    tips: 'Sensible à la tavelure et au feu bactérien. Privilégier une taille en gobelet ou espalier.'
  },
  {
    name: 'Prunier',
    icon: 'Trees',
    color: '#8b5cf6',
    spacing: '400',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juillet - Septembre',
    tips: 'Taille minimale en vert après récolte si besoin. Éviter les plaies importantes propices à la gommose.'
  },
  {
    name: 'Quetschier',
    icon: 'Trees',
    color: '#6366f1',
    spacing: '400',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Août - Octobre',
    tips: 'Excellente variété de prune d’Europe centrale et d’Alsace. Fruits savoureux en tarte et confiture.'
  },
  {
    name: 'Reine-Claude',
    icon: 'Trees',
    color: '#10b981',
    spacing: '400',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juillet - Août',
    tips: 'Prune reine très sucrée et juteuse. Arrosage régulier en période de grossissement des fruits.'
  },
  {
    name: 'Mirabellier',
    icon: 'Trees',
    color: '#eab308',
    spacing: '400',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Août - Septembre',
    tips: 'Récolte dorée gorgée de sucre. Secouer légèrement les branches à maturité pour faire tomber les fruits mûrs.'
  },
  {
    name: 'Cerisier',
    icon: 'Cherry',
    color: '#dc2626',
    spacing: '500',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Faible' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Mai - Juillet',
    tips: 'Protéger des oiseaux avec un filet à maturité. Ne pas tailler sévèrement pour éviter la gommose.'
  },
  {
    name: 'Pêcher',
    icon: 'Trees',
    color: '#f97316',
    spacing: '350',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juillet - Septembre',
    tips: 'Sensible à la cloque du pêcher (traiter au cuivre à la chute des feuilles et au débourrement).'
  },
  {
    name: 'Nectarinier',
    icon: 'Trees',
    color: '#f43f5e',
    spacing: '350',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juillet - Août',
    tips: 'Peau lisse sans duvet. Demande une exposition chaude et abritée des vents froids.'
  },
  {
    name: 'Abricotier',
    icon: 'Trees',
    color: '#fb923c',
    spacing: '400',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Faible' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juin - Août',
    tips: 'Floraison précoce sensible aux gelées printanières. Privilégier un sol bien drainé non calcaire.'
  },
  {
    name: 'Pluot',
    icon: 'Trees',
    color: '#a855f7',
    spacing: '400',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juillet - Septembre',
    tips: 'Hybride complexe prune x abricot (Zaiger). Chair extrêmement sucrée et parfumée.'
  },
  {
    name: 'Aprikyra',
    icon: 'Trees',
    color: '#d946ef',
    spacing: '350',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juillet - Août',
    tips: 'Croisement abricot x cerise (Prunus armeniaca x Prunus cerasifera). Saveur originale très douce.'
  },
  {
    name: 'Noyer',
    icon: 'Trees',
    color: '#78716c',
    spacing: '800',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Septembre - Octobre',
    tips: 'Grand arbre majestueux. Sécrète de la juglone (racines et feuilles), laisser un grand périmètre libre.'
  },
  {
    name: 'Figuier',
    icon: 'Trees',
    color: '#7c3aed',
    spacing: '400',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Faible' as const,
    plantingPeriod: 'Mars - Mai',
    harvestPeriod: 'Juillet - Octobre',
    tips: 'Adore la chaleur et un mur exposé sud. Rustique une fois bien implanté.'
  },
  {
    name: 'Asiminier',
    icon: 'Leaf',
    color: '#84cc16',
    spacing: '300',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Septembre - Octobre',
    tips: 'Pavier blanc / Pawpaw américain. Fruit exotique à chair crémeuse saveur mangue-banane, très rustique (-25°C).'
  },
  {
    name: 'Mûrier',
    icon: 'Trees',
    color: '#475569',
    spacing: '350',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juillet - Septembre',
    tips: 'Mûrier fruitier vigoureux. Fruits charnus très sucrés, parfaits en gelées et desserts.'
  },
  {
    name: 'Kiwi',
    icon: 'Leaf',
    color: '#65a30d',
    spacing: '300',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Élevé' as const,
    plantingPeriod: 'Mars - Mai',
    harvestPeriod: 'Octobre - Novembre',
    tips: 'Liane vigoureuse nécessitant un solide palissage/pergola. Sol frais et arrosage estival régulier.'
  },
  {
    name: 'Cassis',
    icon: 'Shrub',
    color: '#334155',
    spacing: '120',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juin - Juillet',
    tips: 'Arbuste buissonnant parfumé. Tailler les branches de plus de 3 ans pour renouveler le bois fructifère.'
  },
  {
    name: 'Casseille',
    icon: 'Shrub',
    color: '#4c1d95',
    spacing: '150',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Moyen' as const,
    plantingPeriod: 'Novembre - Mars',
    harvestPeriod: 'Juillet - Août',
    tips: 'Hybride cassis x groseillier à maquereau, sans épines. Gros fruits savoureux riches en vitamine C.'
  },
  {
    name: 'Vigne',
    icon: 'Grape',
    color: '#9333ea',
    spacing: '150',
    exposure: 'Plein soleil' as const,
    waterNeeds: 'Faible' as const,
    plantingPeriod: 'Novembre - Avril',
    harvestPeriod: 'Août - Octobre',
    tips: 'Conduire sur fil de fer ou treille. Pratiquer une taille courte en hiver (taille à deux yeux) et ébourgeonner au printemps.'
  }
];

export const ORCHARD_PDF_VARIETIES: { species: string; variety: string }[] = [
  // Pommiers
  { species: 'Pommier', variety: 'Golden Delicious' },
  { species: 'Pommier', variety: 'Jonagold' },
  { species: 'Pommier', variety: 'Cox\'s Orange' },
  { species: 'Pommier', variety: 'Gloster' },
  { species: 'Pommier', variety: 'Elstar' },
  { species: 'Pommier', variety: 'Melrose' },
  { species: 'Pommier', variety: 'Topaz' },

  // Poiriers
  { species: 'Poirier', variety: 'Doyenné du Comice' },
  { species: 'Poirier', variety: 'Poirier standard' },

  // Pruniers / Quetschiers / Reine-Claude
  { species: 'Prunier', variety: 'Reine-Claude d\'Oullins' },
  { species: 'Prunier', variety: 'Reine-Claude d\'Althan' },
  { species: 'Prunier', variety: 'Quetsche d\'Alsace' },
  { species: 'Prunier', variety: 'Opal' },
  { species: 'Prunier', variety: 'Kometa' },
  { species: 'Prunier', variety: 'Zorka' },
  { species: 'Prunier', variety: 'Xgek' },
  { species: 'Prunier', variety: 'Jubileum' },
  { species: 'Quetschier', variety: 'Stanley' },
  { species: 'Quetschier', variety: 'Belle de Louvain' },
  { species: 'Reine-Claude', variety: 'D\'Oullins' },

  // Mirabelliers
  { species: 'Mirabellier', variety: 'De Nancy' },
  { species: 'Mirabellier', variety: 'Franc' },
  { species: 'Mirabellier', variety: 'Aprimira' },

  // Cerisiers
  { species: 'Cerisier', variety: 'Burlat' },
  { species: 'Cerisier', variety: 'Napoléon' },

  // Pêchers / Nectariniers
  { species: 'Pêcher', variety: 'Avalon Pride' },
  { species: 'Pêcher', variety: 'Bénédicte' },
  { species: 'Nectarinier', variety: 'Lord Napier' },

  // Abricotiers & Hybrides
  { species: 'Abricotier', variety: 'Bergeron' },
  { species: 'Abricotier', variety: 'Harlayne' },
  { species: 'Abricotier', variety: 'Goldcot' },
  { species: 'Abricotier', variety: 'Harcot' },
  { species: 'Pluot', variety: 'Flavor Candy' },
  { species: 'Aprikyra', variety: 'Standard' },

  // Noyer, Figuier, Asiminier, Mûrier, Kiwi, Cassis, Casseille
  { species: 'Noyer', variety: 'Standard' },
  { species: 'Figuier', variety: 'Standard' },
  { species: 'Asiminier', variety: 'Standard' },
  { species: 'Mûrier', variety: 'Beautiful' },
  { species: 'Kiwi', variety: 'Standard' },
  { species: 'Cassis', variety: 'Standard' },
  { species: 'Casseille', variety: 'Standard' },

  // Vignes
  { species: 'Vigne', variety: 'Lakemont' },
  { species: 'Vigne', variety: 'Himrod' },
  { species: 'Vigne', variety: 'Miss Rose' },
  { species: 'Vigne', variety: 'Isabella' },
  { species: 'Vigne', variety: 'Elisabeth' },
  { species: 'Vigne', variety: 'Sweety' }
];
