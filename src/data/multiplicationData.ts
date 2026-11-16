export type MultiplicationMethod = 
  | 'bouture_bois_sec'      // Hiver (rameau dormant sans feuilles)
  | 'bouture_herpacee'     // Printemps (tige jeune et tendre)
  | 'bouture_semi_aoutee'  // Été / Fin d'été (base ligneuse, pointe tendre)
  | 'division_touffe'      // Fin d'hiver / Printemps ou Automne
  | 'marcottage_couche'    // Printemps ou fin d'été
  | 'marcottage_aerien'    // Printemps sur branches aoûtées
  | 'stolons_drageons'     // Fin d'été à automne
  | 'bouture_racine'       // Fin d'automne à fin d'hiver
  | 'repiquage_gourmands'  // Fin de printemps / début d'été (ex: tomate)
  | 'greffage';            // Printemps (fente/couronne) ou Été (écusson)

export interface MultiplicationRule {
  id: string;
  speciesKeywords: string[]; // Keywords to match user's seedlings, trees, or encyclopedia catalog (e.g. ['figuier', 'figue', 'ficus'])
  commonName: string;
  category: 'fruitier' | 'aromatique' | 'petit_fruit' | 'vivace' | 'legume';
  method: MultiplicationMethod;
  methodLabel: string;
  optimalMonths: number[]; // 1 to 12
  possibleMonths: number[]; // 1 to 12
  difficulty: 'facile' | 'moyen' | 'delicat';
  difficultyLabel: string;
  rootingTimeWeeks: number; // estimated weeks to root
  summary: string;
  instructions: {
    harvest: string;    // Comment prélever
    substrate: string;  // Dans quoi planter (terreau, sable, eau)
    care: string;       // Arrosage, ombre, chaleur
    followUp: string;   // Repiquage / plantation
  };
  isCustom?: boolean;
  customConfigId?: string;
}

export const MULTIPLICATION_RULES: MultiplicationRule[] = [
  // --- PETITS FRUITS & LIANES ---
  {
    id: 'groseillier_bois_sec',
    speciesKeywords: ['groseillier', 'groseille', 'ribes'],
    commonName: 'Groseillier',
    category: 'petit_fruit',
    method: 'bouture_bois_sec',
    methodLabel: 'Bouture sur bois dormant',
    optimalMonths: [11, 12, 1, 2],
    possibleMonths: [10, 3],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 6,
    summary: 'L\'une des boutures les plus faciles du jardin, directement en terre meuble abritée.',
    instructions: {
      harvest: 'Prélevez des rameaux sains de l\'année de la taille d\'un crayon (20 à 25 cm), juste sous un œil.',
      substrate: 'En pleine terre légère ou en pot de terreau avec 30% de sable.',
      care: 'Enfoncez les 2/3 de la bouture en ne laissant dépasser que 2 ou 3 bourgeons. Maintenez le sol frais.',
      followUp: 'Repiquage en place à l\'automne suivant.'
    }
  },
  {
    id: 'cassissier_bois_sec',
    speciesKeywords: ['cassissier', 'cassis', 'ribes nigrum'],
    commonName: 'Cassissier',
    category: 'petit_fruit',
    method: 'bouture_bois_sec',
    methodLabel: 'Bouture sur bois sec',
    optimalMonths: [11, 12, 1, 2],
    possibleMonths: [10, 3],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 6,
    summary: 'S\'enracine à coup sûr en hiver. Prélevez lors de la taille d\'hiver.',
    instructions: {
      harvest: 'Tiges droites d\'un an bien vigoureuses d\'environ 25 cm de long.',
      substrate: 'Terreau léger + sable de rivière, ou le long d\'un mur exposé au nord.',
      care: 'Enfoncez à 70% de la hauteur. Tassez fermement autour de la base.',
      followUp: 'Vérifiez la feuillaison au printemps, transplantez à l\'automne.'
    }
  },
  {
    id: 'framboisier_drageons',
    speciesKeywords: ['framboisier', 'framboise', 'rubus idaeus'],
    commonName: 'Framboisier',
    category: 'petit_fruit',
    method: 'stolons_drageons',
    methodLabel: 'Prélèvement de drageons racinés',
    optimalMonths: [11, 12, 2, 3],
    possibleMonths: [10, 1],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 4,
    summary: 'Prélevez les rejets qui émergent naturellement au pied des rangs.',
    instructions: {
      harvest: 'Dégagez avec une bêche bien affûtée un jeune rejet avec ses propres racines.',
      substrate: 'Pleine terre enrichie en compost mûr et paillée généreusement.',
      care: 'Recoupez la tige à 25 cm de hauteur pour concentrer la sève sur les racines. Arrosez copieusement.',
      followUp: 'Première récolte possible dès l\'été ou l\'automne de l\'année suivante.'
    }
  },
  {
    id: 'mure_marcottage',
    speciesKeywords: ['mure', 'mûre', 'mûrier', 'ronce', 'rubus'],
    commonName: 'Mûrier sans épines / Ronce fruitière',
    category: 'petit_fruit',
    method: 'marcottage_couche',
    methodLabel: 'Marcottage par la pointe (bouterollage)',
    optimalMonths: [8, 9, 10],
    possibleMonths: [7, 11],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 5,
    summary: 'Le marcottage du mûrier s\'opère naturellement en enterrant l\'extrémité d\'un sarment.',
    instructions: {
      harvest: 'Arquez une tige souple de l\'année et courbez sa pointe vers le sol.',
      substrate: 'Enterrez la pointe à 8-10 cm dans une terre meuble et riche.',
      care: 'Maintenez en place avec un crochet métallique ou une pierre. Maintenez humide.',
      followUp: 'Sevrez (couper le lien de la plante mère) en fin d\'hiver et transplantez le jeune plant raciné.'
    }
  },
  {
    id: 'fraisier_stolons',
    speciesKeywords: ['fraisier', 'fraise', 'fragaria'],
    commonName: 'Fraisier',
    category: 'petit_fruit',
    method: 'stolons_drageons',
    methodLabel: 'Rempotage de stolons (gourmands)',
    optimalMonths: [7, 8, 9],
    possibleMonths: [6, 10],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 3,
    summary: 'Renouvelez votre fraiseraie tous les 3 ans en récupérant les meilleurs stolons.',
    instructions: {
      harvest: 'Repérez le premier œillet formé sur le stolon (le plus vigoureux proche du pied mère).',
      substrate: 'Enterrez l\'œillet dans un petit godet de terreau enterré au ras du sol à côté.',
      care: 'Maintenez arrosé. Une fois enraciné (2 à 3 semaines), coupez le stolon qui relie au pied mère.',
      followUp: 'Plantez les nouveaux pieds en place dès septembre pour une récolte abondante au printemps.'
    }
  },
  {
    id: 'vigne_bois_sec',
    speciesKeywords: ['vigne', 'raisin', 'vitis'],
    commonName: 'Vigne (Raisin de table)',
    category: 'fruitier',
    method: 'bouture_bois_sec',
    methodLabel: 'Bouturage à bois sec en crossette',
    optimalMonths: [1, 2, 3],
    possibleMonths: [11, 12],
    difficulty: 'moyen',
    difficultyLabel: 'Facile à moyen',
    rootingTimeWeeks: 8,
    summary: 'Prélevez les sarments de taille d\'hiver avant le débourrement.',
    instructions: {
      harvest: 'Prélevez un sarment bien aoûté de 25-30 cm avec 3 à 4 yeux et si possible un talon de vieux bois.',
      substrate: 'Mélange drainant 50% terreau et 50% sable.',
      care: 'Enfoncez verticalement en laissant 1 œil affleurer au-dessus de la surface.',
      followUp: 'Conservez à l\'abri du gel mais au frais, puis sortez à la lumière au printemps.'
    }
  },
  {
    id: 'kiwi_bouture_bois_sec',
    speciesKeywords: ['kiwi', 'actinidia'],
    commonName: 'Kiwi (Actinidia)',
    category: 'fruitier',
    method: 'bouture_bois_sec',
    methodLabel: 'Bouture de sarment dormant ou marcottage',
    optimalMonths: [1, 2, 3],
    possibleMonths: [11, 12, 7, 8],
    difficulty: 'moyen',
    difficultyLabel: 'Moyen',
    rootingTimeWeeks: 8,
    summary: 'Multipliez vos pieds femelles et mâles par bouture de bois d\'un an en fin d\'hiver.',
    instructions: {
      harvest: 'Prélevez un rameau d\'un an de 25 cm avec 3 nœuds lors de la taille d\'hiver.',
      substrate: 'Mélange 50% tourbe ou terreau de semis et 50% perlite ou sable.',
      care: 'Gardez à l\'étouffée sous cloche à 18-20°C. Humidité constante.',
      followUp: 'Rempotez individuellement au début de l\'été.'
    }
  },

  // --- ARBRES & ARBUSTES FRUITIERS DU VERGER ---
  {
    id: 'figuier_bois_sec',
    speciesKeywords: ['figuier', 'figue', 'ficus carica'],
    commonName: 'Figuier',
    category: 'fruitier',
    method: 'bouture_bois_sec',
    methodLabel: 'Bouture de rameau d\'un an',
    optimalMonths: [2, 3],
    possibleMonths: [1, 4, 11, 12],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 6,
    summary: 'Le figuier s\'enracine remarquablement vite en fin d\'hiver.',
    instructions: {
      harvest: 'Coupez un rameau terminal de 20-25 cm à bois grisâtre d\'un an avec un bourgeon terminal intact.',
      substrate: 'Bouteille plastique coupée avec trous au fond, remplie de terreau et sable.',
      care: 'Maintenez à température ambiante douce (18-20°C) à la lumière sans soleil direct. Sol frais.',
      followUp: 'Les racines blanches apparaissent à travers le pot transparent en 4 à 6 semaines.'
    }
  },
  {
    id: 'noisetier_marcottage',
    speciesKeywords: ['noisetier', 'noisette', 'corylus'],
    commonName: 'Noisetier',
    category: 'fruitier',
    method: 'marcottage_couche',
    methodLabel: 'Marcottage en cépée ou couché',
    optimalMonths: [10, 11, 2, 3],
    possibleMonths: [12, 1],
    difficulty: 'facile',
    difficultyLabel: 'Facile',
    rootingTimeWeeks: 12,
    summary: 'Le noisetier se marcotte facilement grâce à ses rejets souples de souche.',
    instructions: {
      harvest: 'Arquez une jeune branche souple partant de la souche et entaillez légèrement l\'écorce.',
      substrate: 'Enterrez la partie entaillée dans une tranchée de 15 cm de terre meuble enrichie.',
      care: 'Fixez avec un cavalier et relevez l\'extrémité vers le haut avec un tuteur.',
      followUp: 'Sevrez au bout d\'un an quand un bon système racinaire est formé.'
    }
  },
  {
    id: 'olivier_semi_aoute',
    speciesKeywords: ['olivier', 'olive', 'olea'],
    commonName: 'Olivier',
    category: 'fruitier',
    method: 'bouture_semi_aoutee',
    methodLabel: 'Bouturage semi-ligneux à l\'étouffée',
    optimalMonths: [7, 8, 9],
    possibleMonths: [6],
    difficulty: 'delicat',
    difficultyLabel: 'Délicat',
    rootingTimeWeeks: 10,
    summary: 'Nécessite de la chaleur et une humidité constante sous cloche.',
    instructions: {
      harvest: 'Rameau de l\'année de 15 cm avec talon de vieux bois. Supprimez les feuilles du bas.',
      substrate: 'Sable et tourbe/terreau léger (70% sable).',
      care: 'Placez à l\'étouffée (sac plastique transparent ou bouteille) à l\'ombre chaude (22-25°C).',
      followUp: 'Aérez progressivement après 2 mois dès l\'apparition des premières pousses.'
    }
  },
  {
    id: 'sureau_bois_sec',
    speciesKeywords: ['sureau', 'sambucus'],
    commonName: 'Sureau noir',
    category: 'fruitier',
    method: 'bouture_bois_sec',
    methodLabel: 'Bouture de bois sec en pleine terre',
    optimalMonths: [11, 12, 1, 2],
    possibleMonths: [10, 3],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 6,
    summary: 'Le sureau s\'enracine à une vitesse spectaculaire en fin d\'automne.',
    instructions: {
      harvest: 'Tige droite vigoureuse de l\'année de 30 cm de long avec 3 ou 4 paires de bourgeons.',
      substrate: 'Directement en terre meuble fraîche ou en jauge de sable.',
      care: 'Enfoncez à 80% dans le sol, tassez avec le pied. Ne laissez dépasser qu\'un nœud.',
      followUp: 'Croissance très rapide dès le printemps.'
    }
  },

  // --- AROMATIQUES & CONDIMENTAIRES ---
  {
    id: 'romarin_semi_aoute',
    speciesKeywords: ['romarin', 'rosmarinus', 'salvia rosmarinus'],
    commonName: 'Romarin',
    category: 'aromatique',
    method: 'bouture_semi_aoutee',
    methodLabel: 'Bouture semi-ligneuse d\'été',
    optimalMonths: [8, 9],
    possibleMonths: [5, 6, 7, 10],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 4,
    summary: 'Prélevez les tiges dont la base commence à durcir (aoûtement).',
    instructions: {
      harvest: 'Tiges de 10 à 12 cm. Dénudez le bas sur 5 cm en ôtant les aiguilles avec délicatesse.',
      substrate: 'Mélange drainant (terreau fin + sable). Enracinement possible également dans l\'eau.',
      care: 'Enfoncez de moitié. Arrosez légèrement sans détremper pour éviter la pourriture.',
      followUp: 'Hivernez hors gel la première année avant la mise en pleine terre au printemps.'
    }
  },
  {
    id: 'thym_marcottage_division',
    speciesKeywords: ['thym', 'serpolet', 'thymus'],
    commonName: 'Thym & Serpolet',
    category: 'aromatique',
    method: 'marcottage_couche',
    methodLabel: 'Marcottage naturel ou division',
    optimalMonths: [4, 5, 9, 10],
    possibleMonths: [6, 8],
    difficulty: 'facile',
    difficultyLabel: 'Facile',
    rootingTimeWeeks: 4,
    summary: 'Les branches basses du thym s\'enracinent seules au contact de la terre.',
    instructions: {
      harvest: 'Soulevez délicatement les tiges périphériques qui ont déjà développé des radicelles.',
      substrate: 'Terre caillouteuse ou godet de terreau très bien drainé.',
      care: 'Sectionnez le lien avec la plante mère et replantez immédiatement en arrosant.',
      followUp: 'Paillez légèrement avec du gravier pour éviter l\'excès d\'humidité au collet.'
    }
  },
  {
    id: 'menthe_division_racines',
    speciesKeywords: ['menthe', 'mentha'],
    commonName: 'Menthe (toutes variétés)',
    category: 'aromatique',
    method: 'division_touffe',
    methodLabel: 'Éclats de stolons racinaires ou bouture d\'eau',
    optimalMonths: [3, 4, 5, 9, 10],
    possibleMonths: [6, 7, 8],
    difficulty: 'facile',
    difficultyLabel: 'Imbattable (100% de réussite)',
    rootingTimeWeeks: 2,
    summary: 'Reprise quasi instantanée par morceaux de rhizomes ou tiges dans un verre d\'eau.',
    instructions: {
      harvest: 'Prélevez un morceau de racine blanche rampante de 10 cm portant des bourgeons.',
      substrate: 'N\'importe quel terreau ou terre de jardin humide.',
      care: 'Enterrez à plat sous 2 cm de terre et arrosez. Les pousses sortent en 7 à 10 jours.',
      followUp: 'Privilégiez la culture en pot pour contenir son tempérament très envahissant !'
    }
  },
  {
    id: 'sauge_semi_aoutee',
    speciesKeywords: ['sauge', 'salvia officinalis'],
    commonName: 'Sauge officinale',
    category: 'aromatique',
    method: 'bouture_semi_aoutee',
    methodLabel: 'Bouture de tête semi-aoûtée',
    optimalMonths: [7, 8, 9],
    possibleMonths: [5, 6],
    difficulty: 'facile',
    difficultyLabel: 'Facile',
    rootingTimeWeeks: 4,
    summary: 'Rajeunissez vos vieux pieds de sauge qui ont tendance à se dégarnir de la base.',
    instructions: {
      harvest: 'Tige terminale non fleurie de 10 cm. Retirez les feuilles du bas, ne gardez que 4 feuilles au sommet.',
      substrate: 'Godet avec 50% terreau et 50% perlite ou sable.',
      care: 'Placez à mi-ombre lumineuse et gardez frais sans excès d\'eau.',
      followUp: 'Pincez le sommet au printemps suivant pour forcer la ramification.'
    }
  },
  {
    id: 'laurier_sauce_bouture',
    speciesKeywords: ['laurier sauce', 'laurier', 'laurus nobilis'],
    commonName: 'Laurier-sauce',
    category: 'aromatique',
    method: 'bouture_semi_aoutee',
    methodLabel: 'Bouture à talon semi-ligneuse',
    optimalMonths: [8, 9],
    possibleMonths: [7, 10],
    difficulty: 'moyen',
    difficultyLabel: 'Moyen (enracinement lent)',
    rootingTimeWeeks: 8,
    summary: 'Prélevez des rejets avec un petit morceau de l\'écorce de la branche porteuse (talon).',
    instructions: {
      harvest: 'Rameau latéral de 12 cm arraché avec un talon d\'écorce à la base.',
      substrate: 'Mélange drainant riche en sable.',
      care: 'À l\'étouffée sous une cloche ou demi-bouteille à l\'ombre.',
      followUp: 'Soyez patient : le laurier met souvent 2 mois à raciner solidement.'
    }
  },
  {
    id: 'verveine_citronnelle_bouture',
    speciesKeywords: ['verveine', 'aloysia citrodora', 'lippia'],
    commonName: 'Verveine citronnelle',
    category: 'aromatique',
    method: 'bouture_semi_aoutee',
    methodLabel: 'Bouture de tiges semi-aoûtées',
    optimalMonths: [8, 9],
    possibleMonths: [6, 7],
    difficulty: 'facile',
    difficultyLabel: 'Facile',
    rootingTimeWeeks: 4,
    summary: 'Permet de créer de nouveaux pieds à rentrer au chaud l\'hiver avant les gelées.',
    instructions: {
      harvest: 'Extrémités de rameaux de 10-12 cm dont la base commence à durcir.',
      substrate: 'Godets de terreau léger enrichi de 30% de sable.',
      care: 'À l\'étouffée sous cloche ou plastique transparent à mi-ombre.',
      followUp: 'Conservez à l\'abri du gel (pièce lumineuse à 10-15°C) pendant tout le premier hiver.'
    }
  },
  {
    id: 'origan_marjolaine_division',
    speciesKeywords: ['origan', 'marjolaine', 'origanum'],
    commonName: 'Origan & Marjolaine vivace',
    category: 'aromatique',
    method: 'division_touffe',
    methodLabel: 'Division de souche ou marcottage',
    optimalMonths: [3, 4, 9, 10],
    possibleMonths: [5, 8],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 3,
    summary: 'Diviser régénère les touffes d\'origan et assure un arôme puissant.',
    instructions: {
      harvest: 'Prélevez un éclat périphérique avec racines et jeunes pousses à la bêche.',
      substrate: 'Terre caillouteuse ou terreau bien drainé.',
      care: 'Rabattez les tiges sèches d\'un tiers et arrosez à la plantation.',
      followUp: 'S\'installe très rapidement et résiste à la sécheresse.'
    }
  },
  {
    id: 'estragon_division',
    speciesKeywords: ['estragon', 'artemisia dracunculus'],
    commonName: 'Estragon français',
    category: 'aromatique',
    method: 'division_touffe',
    methodLabel: 'Division de souche au printemps',
    optimalMonths: [3, 4, 5],
    possibleMonths: [9, 10],
    difficulty: 'facile',
    difficultyLabel: 'Facile',
    rootingTimeWeeks: 3,
    summary: 'L\'estragon vrai ne produit pas de graines fertiles ; la division est la seule méthode fidèle !',
    instructions: {
      harvest: 'Déterrez la motte au redémarrage printanier et séparez des éclats pourvus de jeunes pousses et de racines.',
      substrate: 'Terre franche bien allégée en terreau et compost.',
      care: 'Arrosez le premier mois. Protégez du froid tardif.',
      followUp: 'Divisez tous les 3 ans pour maintenir la vigueur et la saveur anisée.'
    }
  },
  {
    id: 'ciboulette_division',
    speciesKeywords: ['ciboulette', 'allium schoenoprasum', 'ciboule'],
    commonName: 'Ciboulette & Ciboule',
    category: 'aromatique',
    method: 'division_touffe',
    methodLabel: 'Division des bulbes en touffe',
    optimalMonths: [3, 4, 10, 11],
    possibleMonths: [2, 5, 9],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 2,
    summary: 'Diviser régénère la ciboulette et évite que le centre de la touffe ne s\'épuise.',
    instructions: {
      harvest: 'Soulevez la touffe à la fourche bêche. Tranchez en 3 ou 4 parts au couteau ou à la main.',
      substrate: 'Terre riche et fraîche en place ou gros pot.',
      care: 'Rabattez les feuilles à 5 cm du sol avant de replanter. Arrosez copieusement.',
      followUp: 'Repart immédiatement avec de jeunes brins tendres.'
    }
  },
  {
    id: 'lavande_semi_aoutee',
    speciesKeywords: ['lavande', 'lavandula'],
    commonName: 'Lavande',
    category: 'aromatique',
    method: 'bouture_semi_aoutee',
    methodLabel: 'Bouturage semi-aoûté à talon',
    optimalMonths: [8, 9],
    possibleMonths: [7, 10],
    difficulty: 'facile',
    difficultyLabel: 'Facile',
    rootingTimeWeeks: 5,
    summary: 'Idéal à faire en fin d\'été après la floraison en taillant les touffes.',
    instructions: {
      harvest: 'Rameau non fleuri de 10 cm avec talon. Supprimez les feuilles sur les deux tiers inférieurs.',
      substrate: 'Terreau très sableux (60% sable / gravier fin).',
      care: 'Enfoncez de 6 cm. N\'arrosez que lorsque la surface est sèche pour éviter la fonte.',
      followUp: 'Rempotez au printemps suivant.'
    }
  },

  // --- LÉGUMES VIVACES & POTAGER ---
  {
    id: 'rhubarbe_division',
    speciesKeywords: ['rhubarbe', 'rheum'],
    commonName: 'Rhubarbe',
    category: 'vivace',
    method: 'division_touffe',
    methodLabel: 'Division d\'éclat de rhizome',
    optimalMonths: [2, 3, 10, 11],
    possibleMonths: [1, 12],
    difficulty: 'facile',
    difficultyLabel: 'Facile',
    rootingTimeWeeks: 6,
    summary: 'Tranchez la grosse souche pour obtenir de nouveaux plants fidèles et vigoureux.',
    instructions: {
      harvest: 'Dégagez la souche. Avec une bêche tranchante, prélevez un morceau de rhizome avec au moins 1 œil bien visible et des racines.',
      substrate: 'Trou de plantation de 50 cm enrichi avec beaucoup de compost ou fumier bien mûr.',
      care: 'Laissez l\'œil affleurer au niveau du sol sans l\'enterrer profondément. Paillez largement.',
      followUp: 'Ne récoltez pas la première année pour laisser le plant s\'installer puissamment.'
    }
  },
  {
    id: 'artichaut_œilletonnage',
    speciesKeywords: ['artichaut', 'cynara cardunculus', 'cynara'],
    commonName: 'Artichaut',
    category: 'vivace',
    method: 'stolons_drageons',
    methodLabel: 'Œilletonnage (prélèvement d\'œilletons)',
    optimalMonths: [3, 4, 10],
    possibleMonths: [5, 11],
    difficulty: 'moyen',
    difficultyLabel: 'Moyen',
    rootingTimeWeeks: 4,
    summary: 'L\'œilletonnage permet de rajeunir une artichautière tous les 3 ou 4 ans.',
    instructions: {
      harvest: 'Écartez la terre au pied du plant mère. Tranchez à la gouge ou au couteau un œilleton vigoureux avec un petit morceau de talon et quelques racines.',
      substrate: 'Plein soleil, terre meuble et profondément nourrie.',
      care: 'Habillez le plant : coupez l\'extrémité des feuilles d\'un tiers pour limiter l\'évaporation. Arrosez régulièrement.',
      followUp: 'Protégez du gel l\'hiver avec un paillis aéré de feuilles mortes sans buter le collet.'
    }
  },
  {
    id: 'oseille_division',
    speciesKeywords: ['oseille', 'rumex'],
    commonName: 'Oseille commune & vierge',
    category: 'vivace',
    method: 'division_touffe',
    methodLabel: 'Division de souche vivace',
    optimalMonths: [3, 4, 10],
    possibleMonths: [2, 5, 9, 11],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 3,
    summary: 'Diviser tous les 3 ans empêche l\'oseille de monter à graine trop vite.',
    instructions: {
      harvest: 'Arrachez la souche au printemps ou à l\'automne et séparez en éclats racinés.',
      substrate: 'Terre riche, fraîche et légèrement acide.',
      care: 'Supprimez les grandes feuilles extérieures, ne gardez que le cœur. Arrosez.',
      followUp: 'Nouvelle production de jeunes feuilles tendres en quelques semaines.'
    }
  },
  {
    id: 'consoude_bouture_racine',
    speciesKeywords: ['consoude', 'symphytum'],
    commonName: 'Consoude (Bocking 14 & officinale)',
    category: 'vivace',
    method: 'bouture_racine',
    methodLabel: 'Bouturage de tronçons de racines',
    optimalMonths: [3, 4, 10, 11],
    possibleMonths: [2, 5, 9],
    difficulty: 'facile',
    difficultyLabel: 'Inratable (reprise garantie)',
    rootingTimeWeeks: 3,
    summary: 'La reine des engrais verts et du purin se multiplie par simples bouts de racines.',
    instructions: {
      harvest: 'Déterrez une racine et coupez des tronçons de 4 à 5 cm d\'épaisseur d\'un doigt.',
      substrate: 'Enterrez à plat à 5 cm de profondeur dans une bonne terre de jardin.',
      care: 'Arrosez une fois. Les feuilles émergent rapidement même en sol pauvre.',
      followUp: 'Plantez à un endroit définitif car ses racines pivotantes sont quasi indestructibles !'
    }
  },
  {
    id: 'asperge_division_griffes',
    speciesKeywords: ['asperge', 'asparagus'],
    commonName: 'Asperge (Griffes)',
    category: 'vivace',
    method: 'division_touffe',
    methodLabel: 'Division de griffes d\'asperge',
    optimalMonths: [3, 4],
    possibleMonths: [2],
    difficulty: 'moyen',
    difficultyLabel: 'Moyen',
    rootingTimeWeeks: 8,
    summary: 'Division délicate des couronnes de racines lors de la rénovation d\'une aspergeraie.',
    instructions: {
      harvest: 'Dégagez délicatement une griffe âgée de 3 ans hors sol sans casser les racines charnues.',
      substrate: 'Tranchée profonde garnie de sable et compost meuble en dôme.',
      care: 'Étalez les racines en étoile sur le dôme et couvrez de 10 cm de terre légère.',
      followUp: 'Patientez 2 ans avant la première récolte significative.'
    }
  },
  {
    id: 'topinambour_tubercules',
    speciesKeywords: ['topinambour', 'helianthus tuberosus'],
    commonName: 'Topinambour',
    category: 'legume',
    method: 'division_touffe',
    methodLabel: 'Plantation / division d\'éclats de tubercules',
    optimalMonths: [2, 3, 4, 11],
    possibleMonths: [10, 12, 1],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 4,
    summary: 'Chaque tubercule ou fragment avec un œil redonne une forêt de tiges de 2 mètres.',
    instructions: {
      harvest: 'Conservez les tubercules moyens bien formés récoltés en hiver.',
      substrate: 'Pleine terre ordinaire à 10 cm de profondeur.',
      care: 'Espacez de 50 cm. Ne demande aucun soin particulier.',
      followUp: 'Récolte des premiers tubercules dès les premières gelées de l\'automne.'
    }
  },
  {
    id: 'tomate_gourmands',
    speciesKeywords: ['tomate', 'solanum lycopersicum'],
    commonName: 'Tomate (Bouturage de gourmands)',
    category: 'legume',
    method: 'repiquage_gourmands',
    methodLabel: 'Bouturage express de gourmand',
    optimalMonths: [6, 7],
    possibleMonths: [5, 8],
    difficulty: 'facile',
    difficultyLabel: 'Ultra facile (racines en 5 jours)',
    rootingTimeWeeks: 1,
    summary: 'Transformez vos gourmands de taille en plants productifs pour prolonger la saison en automne !',
    instructions: {
      harvest: 'Conservez un gourmand vigoureux de 15 cm retiré lors de la taille des pieds de tomate.',
      substrate: 'Mettez la base dans un verre d\'eau, ou directement en godet de terreau humide.',
      care: 'Des racines apparaissent au bout de 5 jours seulement. Gardez à l\'ombre au départ.',
      followUp: 'Plantez au potager 10 jours après. Vous obtiendrez des tomates mûres en septembre/octobre.'
    }
  },
  {
    id: 'rosier_bois_sec',
    speciesKeywords: ['rosier', 'rose', 'rosa'],
    commonName: 'Rosier (toutes variétés)',
    category: 'vivace',
    method: 'bouture_bois_sec',
    methodLabel: 'Bouture de bois sec / rameau défleuri',
    optimalMonths: [10, 11, 12, 1],
    possibleMonths: [8, 9, 2],
    difficulty: 'facile',
    difficultyLabel: 'Facile',
    rootingTimeWeeks: 8,
    summary: 'Bouturage classique à la sainte Catherine ou en fin d\'été avec un rameau bien aoûté.',
    instructions: {
      harvest: 'Prélevez un rameau droit de l\'année de 20-25 cm qui a fleuri. Retirez la fleur fanée et les épines du bas.',
      substrate: 'Pleine terre meuble mélangée à du sable le long d\'un mur au nord, ou en grand pot drainé.',
      care: 'Enfoncez les 2/3 du rameau. Vous pouvez coiffer d\'une bouteille plastique coupée pour faire une cloche.',
      followUp: 'Les premiers bourgeons débourrent au printemps. Transplantez à l\'automne suivant.'
    }
  },
  {
    id: 'hortensia_semi_aoute',
    speciesKeywords: ['hortensia', 'hydrangea'],
    commonName: 'Hortensia (Hydrangea)',
    category: 'vivace',
    method: 'bouture_semi_aoutee',
    methodLabel: 'Bouture semi-aoûtée de tige sans fleur',
    optimalMonths: [8, 9],
    possibleMonths: [7, 10],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 4,
    summary: 'S\'enracine très rapidement en fin d\'été à l\'étouffée ou à l\'ombre fraîche.',
    instructions: {
      harvest: 'Coupez l\'extrémité d\'une tige sans fleur de 15 cm avec 2 paires de feuilles. Coupez les grandes feuilles de moitié.',
      substrate: 'Mélange 50% terre de bruyère/terreau et 50% sable ou perlite.',
      care: 'Enfoncez sous le nœud effeuillé. Maintenez à l\'ombre et à l\'humidité constante.',
      followUp: 'Hivernez à l\'abri du gel la première année puis plantez au jardin au printemps.'
    }
  },
  {
    id: 'laurier_rose_ete',
    speciesKeywords: ['laurier-rose', 'laurier rose', 'nerium', 'oleander'],
    commonName: 'Laurier-rose (Nerium)',
    category: 'vivace',
    method: 'bouture_semi_aoutee',
    methodLabel: 'Bouturage estival (dans l\'eau ou terreau)',
    optimalMonths: [6, 7, 8],
    possibleMonths: [5, 9],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 4,
    summary: 'Bouture magique dans un simple bocal d\'eau avec un morceau de charbon de bois.',
    instructions: {
      harvest: 'Prélevez des pousses terminales de 15 cm non fleuries.',
      substrate: 'Directement dans un bocal d\'eau claire à la lumière, ou godet de terreau humide.',
      care: 'Changez l\'eau régulièrement. Des racines blanches épaisses apparaissent dès 3 semaines.',
      followUp: 'Dès que les racines mesurent 3-4 cm, rempotez délicatement en pot individuel.'
    }
  },
  {
    id: 'figuier_marcottage_aerien',
    speciesKeywords: ['figuier', 'figue', 'ficus'],
    commonName: 'Figuier (Marcottage aérien)',
    category: 'fruitier',
    method: 'marcottage_aerien',
    methodLabel: 'Marcottage aérien sur branche',
    optimalMonths: [4, 5, 6],
    possibleMonths: [3, 7],
    difficulty: 'moyen',
    difficultyLabel: 'Facile à moyen',
    rootingTimeWeeks: 8,
    summary: 'Permet d\'obtenir un grand plant de figuier déjà vigoureux et fidèle en une seule saison.',
    instructions: {
      harvest: 'Choisissez une belle branche de 2 à 3 ans de 1,5 à 2 cm de diamètre.',
      substrate: 'Manchon de plastique ou bouteille rempli de sphaigne ou terreau humide bien ficelé.',
      care: 'Entaillez l\'écorce sur 2 cm ou retirez un anneau d\'écorce avant d\'envelopper de sphaigne humide.',
      followUp: 'Sevrez en coupant sous le manchon en automne une fois le réseau de racines bien visible.'
    }
  },
  {
    id: 'pommier_poirier_greffe',
    speciesKeywords: ['pommier', 'pomme', 'malus', 'poirier', 'poire', 'pyrus'],
    commonName: 'Pommier & Poirier',
    category: 'fruitier',
    method: 'greffage',
    methodLabel: 'Greffe en fente / couronne ou écusson',
    optimalMonths: [3, 4, 8],
    possibleMonths: [2, 9],
    difficulty: 'moyen',
    difficultyLabel: 'Moyen (geste technique)',
    rootingTimeWeeks: 6,
    summary: 'Multiplication fidèle des variétés fruitières sur porte-greffe adapté au sol.',
    instructions: {
      harvest: 'Prélevez les greffons en janvier-février pendant le repos végétatif et stockez au frais.',
      substrate: 'Porte-greffe sain (M9, MM106 pour pommier, cognassier pour poirier).',
      care: 'Ajustez les cambiums avec précision, ligaturez avec du raphia et mastiquez les plaies.',
      followUp: 'Déligaturez dès le débourrement vigoureux pour éviter l\'étranglement.'
    }
  },
  {
    id: 'cerisier_prunier_greffe',
    speciesKeywords: ['cerisier', 'cerise', 'prunier', 'prune', 'prunus', 'abricotier', 'pecher'],
    commonName: 'Cerisier, Prunier & Fruits à noyau',
    category: 'fruitier',
    method: 'greffage',
    methodLabel: 'Greffage en écusson à œil dormant',
    optimalMonths: [7, 8],
    possibleMonths: [6, 9],
    difficulty: 'moyen',
    difficultyLabel: 'Moyen',
    rootingTimeWeeks: 4,
    summary: 'La méthode reine en fin d\'été pour tous les arbres fruitiers à noyau.',
    instructions: {
      harvest: 'Prélevez un œil bien formé avec un lambeau d\'écorce (écusson) sur un rameau de l\'année.',
      substrate: 'Incision en T sur l\'écorce du porte-greffe bien irrigué quelques jours avant.',
      care: 'Glissez l\'écusson sous les lèvres du T, ligaturez fermement en laissant le pétiole libre.',
      followUp: 'Si le pétiole tombe au bout de 15 jours en jaunissant, la greffe a pris !'
    }
  },
  {
    id: 'saule_bois_sec',
    speciesKeywords: ['saule', 'salix', 'saule pleureur', 'osier'],
    commonName: 'Saule & Osier (Fabrication d\'eau de saule)',
    category: 'vivace',
    method: 'bouture_bois_sec',
    methodLabel: 'Bouture directe sur bois dormant',
    optimalMonths: [11, 12, 1, 2],
    possibleMonths: [10, 3],
    difficulty: 'facile',
    difficultyLabel: 'Ultra facile (100% de reprise)',
    rootingTimeWeeks: 3,
    summary: 'S\'enracine instantanément et fournit l\'hormone naturelle pour vos autres boutures.',
    instructions: {
      harvest: 'Prélevez des rameaux droits de 30 à 50 cm pendant la période de dormance.',
      substrate: 'Pleine terre humide ou bocal d\'eau. Le saule s\'enracine partout.',
      care: 'Enfoncez directement en terre à 50% de profondeur. Conservez les jeunes pousses macérées pour créer de l\'eau de saule.',
      followUp: 'Plantez définitivement en sol frais ou humide.'
    }
  },
  {
    id: 'agrumes_marcottage_aerien',
    speciesKeywords: ['citronnier', 'citron', 'oranger', 'orange', 'mandarinier', 'clementine', 'agrumes', 'citrus'],
    commonName: 'Citronnier & Agrumes',
    category: 'fruitier',
    method: 'marcottage_aerien',
    methodLabel: 'Marcottage aérien de printemps',
    optimalMonths: [4, 5, 6],
    possibleMonths: [3, 7],
    difficulty: 'moyen',
    difficultyLabel: 'Moyen',
    rootingTimeWeeks: 10,
    summary: 'Le moyen le plus sûr de dupliquer un agrume de variété ancienne sans greffage.',
    instructions: {
      harvest: 'Choisissez un rameau de 1 à 2 ans de 1 cm d\'épaisseur.',
      substrate: 'Sphaigne humide entourée d\'un film plastique étanche scellé aux deux bouts.',
      care: 'Enlevez un anneau d\'écorce de 1,5 cm, appliquez un peu d\'eau de saule, enfermez dans la sphaigne.',
      followUp: 'Les racines se forment en 2 à 3 mois. Coupez sous la motte et rempotez en substrat spécial agrumes.'
    }
  },
  {
    id: 'chevrefeuille_marcottage',
    speciesKeywords: ['chevrefeuille', 'chèvrefeuille', 'lonicera', 'clematite', 'jasmin'],
    commonName: 'Chèvrefeuille, Clématite & Jasmin',
    category: 'vivace',
    method: 'marcottage_couche',
    methodLabel: 'Marcottage par couchage de sarment',
    optimalMonths: [5, 6, 7, 8],
    possibleMonths: [4, 9],
    difficulty: 'facile',
    difficultyLabel: 'Très facile',
    rootingTimeWeeks: 6,
    summary: 'Enterrez une branche souple sans la couper de la plante mère.',
    instructions: {
      harvest: 'Abaissez un rameau vigoureux vers le sol au pied de la grimpante.',
      substrate: 'Pleine terre meuble additionnée de compost et de sable.',
      care: 'Enterrez une portion centrale effeuillée en laissant l\'extrémité redressée à l\'air libre.',
      followUp: 'Séparez de la plante mère à l\'automne et replantez le pied autonome.'
    }
  },
  {
    id: 'myrtillier_semi_aoute',
    speciesKeywords: ['myrtille', 'myrtillier', 'vaccinium'],
    commonName: 'Myrtillier',
    category: 'petit_fruit',
    method: 'bouture_semi_aoutee',
    methodLabel: 'Bouturage semi-aoûté en terre acide',
    optimalMonths: [7, 8],
    possibleMonths: [6, 9],
    difficulty: 'moyen',
    difficultyLabel: 'Moyen',
    rootingTimeWeeks: 8,
    summary: 'Prélevez les rameaux de l\'année dès qu\'ils commencent à durcir.',
    instructions: {
      harvest: 'Tiges de 10-12 cm semi-aoûtées avec talon si possible.',
      substrate: 'Terre de bruyère pure ou mélange 50% tourbe / 50% sable très acide (pH 4,5).',
      care: 'Gardez à l\'étouffée et à mi-ombre avec de l\'eau non calcaire (eau de pluie).',
      followUp: 'Rempotez en pot individuel de terre de bruyère au printemps suivant.'
    }
  }
];

export const METHOD_ICONS_AND_COLORS: Record<MultiplicationMethod, { label: string; icon: string; bg: string; text: string; border: string }> = {
  bouture_bois_sec: {
    label: 'Bouture bois sec',
    icon: '🪵',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200'
  },
  bouture_semi_aoutee: {
    label: 'Bouture semi-aoûtée',
    icon: '🌿',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200'
  },
  bouture_herpacee: {
    label: 'Bouture herbacée',
    icon: '🌱',
    bg: 'bg-lime-50',
    text: 'text-lime-800',
    border: 'border-lime-200'
  },
  division_touffe: {
    label: 'Division de touffe',
    icon: '🪴',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200'
  },
  marcottage_couche: {
    label: 'Marcottage couché',
    icon: '➰',
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200'
  },
  marcottage_aerien: {
    label: 'Marcottage aérien',
    icon: '🎋',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200'
  },
  stolons_drageons: {
    label: 'Stolons & Drageons',
    icon: '🍓',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200'
  },
  bouture_racine: {
    label: 'Bouture de racine',
    icon: '🥔',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200'
  },
  repiquage_gourmands: {
    label: 'Bouture de gourmands',
    icon: '🍅',
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200'
  },
  greffage: {
    label: 'Greffage',
    icon: '🔪',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200'
  }
};

export interface MethodStep {
  stepNumber: number;
  title: string;
  description: string;
  tip?: string;
}

export interface MethodDetail {
  id: MultiplicationMethod;
  title: string;
  shortLabel: string;
  icon: string;
  category: 'Bouturage' | 'Marcottage' | 'Division' | 'Drageonnage' | 'Greffage';
  season: string;
  seasonMonths: number[];
  difficulty: 'Très facile' | 'Facile' | 'Facile à Moyen' | 'Moyen' | 'Délicat';
  successRate: string;
  rootingDuration: string;
  principle: string;
  materials: string[];
  steps: MethodStep[];
  proTips: string[];
  commonMistakes: string[];
  typicalPlants: string[];
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const MULTIPLICATION_METHODS_GUIDE: Record<MultiplicationMethod, MethodDetail> = {
  bouture_bois_sec: {
    id: 'bouture_bois_sec',
    title: 'Bouturage sur bois sec (dormant)',
    shortLabel: 'Bois sec',
    icon: '🪵',
    category: 'Bouturage',
    season: 'Novembre à Février (repos végétatif complet)',
    seasonMonths: [11, 12, 1, 2],
    difficulty: 'Très facile',
    successRate: '85 - 95%',
    rootingDuration: '6 à 10 semaines (débourrement au printemps)',
    principle:
      "Réalisé en plein hiver lorsque la sève est redescendue et que les feuilles sont tombées. Le rameau est gorgé de réserves glucidiques. En l'absence de feuilles, la bouture ne subit aucune déshydratation par évapotranspiration, ce qui permet la formation sereine d'un cal cicatriciel puis de racines adventives.",
    materials: [
      'Sécateur très affûté et désinfecté à l\'alcool à 70°',
      'Mélange léger : 50% sable de rivière ou perlite + 50% terreau de feuilles',
      'Pots profonds (au moins 15-20 cm) ou jauge en pleine terre au pied d\'un mur nord',
      'Étiquettes d\'identification avec nom de variété et date'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Sélection du rameau',
        description: 'Prélevez des rameaux vigoureux et sains de l\'année (bois aoûté de l\'été précédent). Choisissez un diamètre idéal de la taille d\'un crayon (6 à 10 mm).',
        tip: 'Évitez les gourmands trop tendres ou le bois âgé de plus de 2 ans.'
      },
      {
        stepNumber: 2,
        title: 'Taille et habillage de la tige',
        description: 'Coupez des tronçons de 20 à 25 cm. La base est coupée horizontalement juste sous un nœud ou bourgeon. Le haut est taillé en biseau (à 45°) à 1 cm au-dessus d\'un bourgeon.',
        tip: 'Le biseau du haut évite la stagnation d\'eau de pluie et permet d\'identifier immédiatement le sens haut/bas !'
      },
      {
        stepNumber: 3,
        title: 'Mise en place (enfoncement aux 2/3)',
        description: 'Enfoncez les tiges aux 2/3 de leur longueur dans le substrat drainant. Ne laissez dépasser à l\'air libre que 2 à 3 bourgeons au sommet. Tassez fermement autour de la tige.',
        tip: 'La technique en crossette (conserver 1 cm du rameau porteur à la base) fait des merveilles pour la vigne et le figuier.'
      },
      {
        stepNumber: 4,
        title: 'Hivernage et maintien au frais',
        description: 'Placez le pot ou la jauge à l\'extérieur, abrité des vents froids et de la pluie battante (idéalement le long d\'un mur exposé au Nord ou à l\'Est). Le froid stimule la dormance des bourgeons pendant que les racines s\'organisent.',
        tip: 'Ne mettez jamais les boutures de bois sec dans une pièce chauffée : les feuilles s\'ouvriraient avant les racines, épuisant la bouture.'
      },
      {
        stepNumber: 5,
        title: 'Débourrement & repiquage',
        description: 'Au printemps, les bourgeons débourrent. Maintenez le substrat légèrement frais. Ne tirez jamais sur la tige ! Attendez l\'automne suivant pour transplanter le jeune plant raciné en pleine terre.',
        tip: 'Un test d\'enracinement doux : une légère résistance quand on tire avec précaution.'
      }
    ],
    proTips: [
      'Tremper la base de la bouture dans de l\'eau de saule naturelle décuple la vitesse d\'émission racinaire.',
      'En pleine terre, vous pouvez faire une tranchée avec un lit de sable au fond pour planter 10 boutures en ligne.',
      'Étiquetez immédiatement avec un marqueur résistant aux UV : en hiver, tous les rameaux nus se ressemblent !'
    ],
    commonMistakes: [
      'Planter la bouture à l\'envers (bourgeons orientés vers le bas).',
      'Conserver les pots en intérieur chauffé (mort assurée par épuisement des réserves).',
      'Substrat trop lourd ou compact retenant l\'eau stagnante, provoquant la pourriture de la tige.'
    ],
    typicalPlants: [
      'Figuier',
      'Cassissier',
      'Groseillier',
      'Vigne de table',
      'Sureau noir',
      'Saule',
      'Peuplier',
      'Rosier d\'antan'
    ],
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200'
  },

  bouture_herpacee: {
    id: 'bouture_herpacee',
    title: 'Bouturage herbacé (tiges tendres de printemps)',
    shortLabel: 'Herbacée',
    icon: '🌱',
    category: 'Bouturage',
    season: 'Mai à Juin (tiges jeunes en pleine croissance printanière)',
    seasonMonths: [5, 6],
    difficulty: 'Facile',
    successRate: '80 - 90%',
    rootingDuration: '2 à 4 semaines',
    principle:
      "Utilise des tiges en pleine croissance printanière, très souples et non encore lignifiées (tendres et vertes). Les cellules végétales sont en division intense (méristèmes actifs), assurant un enracinement fulgurant sous réserve de maintenir une forte humidité atmosphérique (à l'étouffée).",
    materials: [
      'Lame de rasoir ou greffoir très propre (coupe nette sans écraser les tissus tendres)',
      'Godets avec terreau spécial semis & bouturage allégé en perlite',
      'Cloche transparente, sac de congélation percé ou mini-serre',
      'Pulvérisateur d\'eau tiède'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Prélèvement matinal',
        description: 'Prélevez les extrémités de tiges tôt le matin, quand la plante est gorgée d\'eau de nuit. Longueur idéale : 8 à 12 cm.',
        tip: 'Choisissez une pousse sans boutons floraux pour que toute l\'énergie aille aux racines.'
      },
      {
        stepNumber: 2,
        title: 'Effeuillage et coupe basale',
        description: 'Coupez net sous un nœud foliaire. Supprimez les feuilles de la moitié inférieure. Si les feuilles du haut sont grandes, réduisez-les de moitié pour limiter la transpiration.',
        tip: 'Supprimez immédiatement tout bouton floral ou fleur en formation.'
      },
      {
        stepNumber: 3,
        title: 'Mise en godet',
        description: 'Faites un avant-trou avec un crayon pour ne pas plier la tige tendre. Enfoncez la tige jusqu\'au premier nœud effeuillé. Tassez délicatement.',
        tip: 'Le contact direct entre le nœud et le substrat humide déclenche les premières radicelles.'
      },
      {
        stepNumber: 4,
        title: 'Mise à l\'étouffée',
        description: 'Coiffez le godet d\'une bouteille plastique coupée ou d\'un sac transparent. Placez à lumière tamisée (jamais de plein soleil direct qui ferait cuire la bouture).',
        tip: 'Aérez 5 minutes tous les deux jours pour chasser la condensation excessive et éviter le botrytis (moisissure).'
      },
      {
        stepNumber: 5,
        title: 'Sevrage progressif',
        description: 'Dès que de nouvelles feuilles apparaissent (après 2 à 3 semaines), retirez la cloche progressivement sur plusieurs jours. Rempotez individuellement.',
        tip: 'Arrosez par le bas (soucoupe) pour ne pas tasser la surface.'
      }
    ],
    proTips: [
      'Le bouturage dans l\'eau fonctionne remarquablement bien pour la menthe, le basilic et la verveine avant la mise en pot.',
      'Saupoudrez la surface du substrat d\'un voile de charbon de bois concassé ou de cannelle pour contrer les champignons pathogènes.'
    ],
    commonMistakes: [
      'Exposition au soleil direct sous cloche (effet de serre destructeur avec surchauffe).',
      'Oubli de réduire le feuillage, provoquant un flétrissement irréversible en 24h.',
      'Écrasement de la tige avec un sécateur émoussé au lieu d\'une coupe nette.'
    ],
    typicalPlants: [
      'Menthe',
      'Basilic vivace',
      'Verveine citronnelle',
      'Pélargonium / Géranium',
      'Dahlia',
      'Hortensia',
      'Sauge officinale'
    ],
    badgeBg: 'bg-lime-50',
    badgeText: 'text-lime-800',
    badgeBorder: 'border-lime-200'
  },

  bouture_semi_aoutee: {
    id: 'bouture_semi_aoutee',
    title: 'Bouturage semi-aoûté (fin d\'été)',
    shortLabel: 'Semi-aoûtée',
    icon: '🌿',
    category: 'Bouturage',
    season: 'Août à Septembre (tiges en cours de lignification)',
    seasonMonths: [8, 9],
    difficulty: 'Facile à Moyen',
    successRate: '80 - 90%',
    rootingDuration: '4 à 6 semaines',
    principle:
      "Le terme « semi-aoûté » désigne un rameau de l'année dont la base commence à brunir et durcir (se transformer en bois, comme au mois d'août), tandis que l'extrémité reste tendre et verte. C'est le compromis parfait entre robustesse cellulaire contre le pourrissement et souplesse d'émission racinaire.",
    materials: [
      'Sécateur d\'échenillage bien nettoyé',
      'Substrat drainant : 40% terreau, 40% sable, 20% perlite',
      'Pots de 10-12 cm ou terrine de multiplication',
      'Cloche ou mini-serre aérée'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Choix de la tige semi-aoûtée',
        description: 'Prélevez un rameau latéral bien exposé. Vérifiez : la base doit être ferme et semi-ligneuse (rigide quand on la plie), et l\'extrémité encore verte et souple.',
        tip: 'Longueur recommandée : 12 à 18 cm.'
      },
      {
        stepNumber: 2,
        title: 'Prélèvement avec talon (recommandé)',
        description: 'Arrachez doucement le rameau latéral avec un petit lambeau d\'écorce de la branche principale (le « talon »), puis égalisez la languette au sécateur.',
        tip: 'Le talon concentre un tissu riche en hormones naturelles favorisant l\'enracinement.'
      },
      {
        stepNumber: 3,
        title: 'Habillage de la bouture',
        description: 'Supprimez les feuilles sur les 2/3 inférieurs. Pincez la tête tendre du rameau si elle est trop molle. Conservez seulement 3 à 4 paires de feuilles au sommet.',
        tip: 'Pour les arbustes à feuilles persistantes (laurier, romarin, lavande), réduisez les feuilles restantes.'
      },
      {
        stepNumber: 4,
        title: 'Empotage & confinement doux',
        description: 'Plantez à mi-hauteur en pot. Arrosez copieusement puis placez sous châssis ou cloche à l\'ombre lumineuse.',
        tip: 'La température idéale se situe entre 18°C et 22°C.'
      },
      {
        stepNumber: 5,
        title: 'Hivernage abrité',
        description: 'À l\'automne, les racines se développent. Gardez la potée sous châssis froid ou véranda non chauffée pendant l\'hiver. Rempotage en place au printemps.',
        tip: 'Arrosez très modérément durant l\'hiver : le substrat doit être à peine humide.'
      }
    ],
    proTips: [
      'Idéal pour la plupart des aromatiques ligneuses méditerranéennes (thym, romarin, lavande, sauge).',
      'Mettre 4 à 5 boutures par pot permet de gagner de la place et crée un microclimat favorable.'
    ],
    commonMistakes: [
      'Prélever une tige trop vieille et totalement dure (enracinement très lent ou nul).',
      'Substrat constamment détrempé en automne amenant la pourriture de la tige.'
    ],
    typicalPlants: [
      'Romarin',
      'Lavande',
      'Thym vivace',
      'Sauge officinale',
      'Laurier sauce',
      'Myrtillier',
      'Kiwi (Actinidia)',
      'Camélia',
      'Houx'
    ],
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200'
  },

  division_touffe: {
    id: 'division_touffe',
    title: 'Division de touffe & d\'éclats de souche',
    shortLabel: 'Division',
    icon: '🪴',
    category: 'Division',
    season: 'Mars à Avril (printemps) ou Octobre à Novembre (automne)',
    seasonMonths: [3, 4, 10, 11],
    difficulty: 'Très facile',
    successRate: '95 - 98%',
    rootingDuration: 'Reprise immédiate (1 à 2 semaines)',
    principle:
      "La méthode la plus rapide et la plus sûre du jardin ! Les plantes vivaces et aromatiques cespiteuses s'élargissent d'année en année par leur couronne racinaire. La division consiste à scinder la souche mère en plusieurs éclats autonomes, chacun possédant déjà ses propres bourgeons végétatifs et ses propres racines fonctionnelles.",
    materials: [
      'Bêche tranchante ou louchet de pépiniériste',
      'Couteau désinfecté (Hori-Hori ou greffoir) pour les touffes fines',
      'Compost mûr pour enrichir le trou de plantation',
      'Arrosoir avec pomme'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Arrachage de la souche',
        description: 'Creusez une tranchée circulaire large autour de la touffe avec la bêche. Faites levier doucement pour extraire la motte complète sans abîmer les racines périphériques.',
        tip: 'Arrosez la veille si la terre est sèche pour faciliter l\'arrachage.'
      },
      {
        stepNumber: 2,
        title: 'Nettoyage et examen',
        description: 'Secouez l\'excès de terre ou rincez légèrement au jet pour visualiser le cœur de la souche, les départs de tiges et les racines saines.',
        tip: 'Le centre des vieilles touffes est souvent épuisé ou creux : ne gardez que la périphérie vigoureuse.'
      },
      {
        stepNumber: 3,
        title: 'Scission en éclats',
        description: 'Tranchez nettement la motte avec deux bêches dos à dos ou un couteau tranchant. Chaque éclat doit comporter au moins 3 à 5 bourgeons / pousses vigoureuses et un chevelu racinaire abondant.',
        tip: 'Recoupez les racines meurtries ou trop longues pour stimuler la reprise.'
      },
      {
        stepNumber: 4,
        title: 'Plantation immédiate des éclats',
        description: 'Replantez immédiatement les éclats sans laisser les racines sécher à l\'air libre. Installez dans une terre ameublie et compostée à la même profondeur qu\'auparavant.',
        tip: 'Tassez au pied et arrosez généreusement pour chasser les poches d\'air.'
      },
      {
        stepNumber: 5,
        title: 'Paillage et arrosage de reprise',
        description: 'Paillez le pied sur 5 cm (feuilles mortes ou paille). Maintenez arrosé pendant les 3 premières semaines.',
        tip: 'Rajeunissement garanti : le pied mère et les nouveaux éclats seront plus florifères dès la saison suivante !'
      }
    ],
    proTips: [
      'Divisez les vivaces à floraison estivale/automnale au printemps (mars-avril).',
      'Divisez les vivaces à floraison printanière en début d\'automne (septembre-octobre).',
      'Cette opération régénère les plantes qui s\'essoufflent après 3 à 5 ans au même endroit.'
    ],
    commonMistakes: [
      'Laisser la motte déterrée se dessécher au vent ou au soleil avant division.',
      'Faire des éclats trop petits sans racines suffisantes.',
      'Replantez le vieux centre sénescent de la touffe au lieu des jeunes rejets périphériques.'
    ],
    typicalPlants: [
      'Ciboulette',
      'Estragon français',
      'Oseille',
      'Rhubarbe',
      'Menthe',
      'Mélisse',
      'Consoude',
      'Artichaut',
      'Agapanthe',
      'Iris',
      'Hostas'
    ],
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200'
  },

  marcottage_couche: {
    id: 'marcottage_couche',
    title: 'Marcottage couché (en archet ou par la pointe)',
    shortLabel: 'Marcottage couché',
    icon: '➰',
    category: 'Marcottage',
    season: 'Printemps (avril à juin) ou Fin d\'été (août à septembre)',
    seasonMonths: [4, 5, 6, 8, 9],
    difficulty: 'Très facile',
    successRate: '95 - 99%',
    rootingDuration: '6 à 12 semaines (sevrage en fin d\'automne ou hiver)',
    principle:
      "Le marcottage est la méthode la plus sûre de tout le règne végétal : la branche à enraciner reste physiquement alimentée en eau et en sève par la plante mère durant tout le processus ! Aucun risque de flétrissement ni de dessèchement. Les racines se forment sur la partie de tige courbée et enterrée.",
    materials: [
      'Crochet en fil de fer (ou cavalier de tente / pierre plate) pour maintenir la tige',
      'Tuteur en bambou pour redresser l\'extrémité aérienne',
      'Couteau affûté (pour inciser légèrement l\'écorce)',
      'Terreau léger mélangé à du sable'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Sélection d\'une branche basse et souple',
        description: 'Repérez un rameau sain, vigoureux et flexible près du sol, capable d\'être courbé jusqu\'à terre sans casser.',
        tip: 'Longueur idéale : 40 à 80 cm.'
      },
      {
        stepNumber: 2,
        title: 'Préparation du sol et de la tige',
        description: 'Creusez une petite tranchée de 10 à 15 cm de profondeur au niveau de l\'arcure. Sur la tige, effeuillez la partie qui sera enterrée. Pratiquez une petite incision superficielle sous un œil.',
        tip: 'Glissez un grain d\'avoine ou une allumette dans l\'entaille pour la maintenir entrouverte et concentrer les hormones de cicatrisation.'
      },
      {
        stepNumber: 3,
        title: 'Fixation dans le sol',
        description: 'Plaquez la portion incisée au fond de la tranchée avec le crochet métallique. Redressez la pointe de la tige vers le ciel et attachez-la au tuteur.',
        tip: 'Le pli brusque à la sortie du sol freine la sève élaborée et favorise l\'émission de racines.'
      },
      {
        stepNumber: 4,
        title: 'Rebouchage et maintien de la fraîcheur',
        description: 'Comblez la tranchée avec un mélange de terre fine et de compost/terreau. Tassez et arrosez. Paillez la surface pour garder la fraîcheur.',
        tip: 'Le sol doit rester frais tout l\'été pour que les racines se développent vigoureusement.'
      },
      {
        stepNumber: 5,
        title: 'Sevrage de la marcotte',
        description: 'À l\'automne ou en fin d\'hiver suivant, dégagez délicatement la terre. Dès que le chevelu racinaire est bien formé, coupez la liaison avec la plante mère au sécateur.',
        tip: 'Transplantez le nouveau sujet autonome à son emplacement définitif.'
      }
    ],
    proTips: [
      'Pour les mûriers sans épines, le « bouterollage » consiste simplement à enterrer la pointe terminale d\'un sarment à 10 cm : elle s\'enracine spontanément en 3 semaines !',
      'Cette méthode fonctionne à merveille pour les plantes réputées récalcitrantes au bouturage classique.'
    ],
    commonMistakes: [
      'Casser la tige en la courbant trop brusquement (choisir une branche plus jeune ou plier progressivement).',
      'Laisser le sol de l\'arcure se dessécher durant les chaleurs de l\'été.',
      'Sevrer trop tôt avant que le système racinaire ne soit autonome.'
    ],
    typicalPlants: [
      'Mûrier sans épines',
      'Vigne',
      'Kiwai & Kiwi',
      'Noisetier',
      'Chèvrefeuille',
      'Clématite',
      'Figuier',
      'Groseillier à maquereau',
      'Rosier liane'
    ],
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-200'
  },

  marcottage_aerien: {
    id: 'marcottage_aerien',
    title: 'Marcottage aérien (sur branche haute)',
    shortLabel: 'Marcottage aérien',
    icon: '🎋',
    category: 'Marcottage',
    season: 'Avril à Juin (montée de sève printanière)',
    seasonMonths: [4, 5, 6],
    difficulty: 'Moyen',
    successRate: '80 - 90%',
    rootingDuration: '8 à 16 semaines',
    principle:
      "Permet de cloner une branche située trop haut dans un arbre ou arbuste pour être courbée jusqu'au sol. On amène la terre à la branche plutôt que la branche à la terre ! On retire un anneau d'écorce pour bloquer la sève descendante et on entoure la zone d'un manchon étanche de sphaigne ou terreau humide.",
    materials: [
      'Greffoir ou cutter très affûté',
      'Sphaigne naturelle du Chili bien hydratée ou terreau spécial motte',
      'Film plastique étanche (polyéthylène transparent ou noir) ou manchon réutilisable',
      'Raphia, colliers de serrage (zip) ou ruban adhésif d\'électricien',
      'Papier aluminium (pour réfléchir les rayons solaires en été)'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Choix de la branche mère',
        description: 'Sélectionnez une branche bien lignifiée de 1 à 3 cm de diamètre, bien exposée à la lumière et pourvue de ramifications saines au-dessus du point choisi.',
        tip: 'La zone choisie doit être dépourvue de départs de feuilles sur 15 cm.'
      },
      {
        stepNumber: 2,
        title: 'Décorticage d\'un anneau complet d\'écorce',
        description: 'À l\'aide du greffoir, incisez deux cercles parallèles espacés de 1,5 à 2 fois le diamètre de la tige (environ 2 à 3 cm). Retirez la bande d\'écorce jusqu\'au bois blanc (cambium).',
        tip: 'Grattez doucement le bois dénudé pour éliminer tout résidu de cambium et empêcher la cicatrisation sans racines.'
      },
      {
        stepNumber: 3,
        title: 'Pose du substrat humide (manchon)',
        description: 'Enveloppez la zone décortiquée d\'une grosse poignée de sphaigne préalablement essorée (comme une éponge pressée). La sphaigne doit entourer l\'incision sur 5 cm de part et d\'autre.',
        tip: 'La sphaigne possède des propriétés antibactériennes naturelles idéales contre les moisissures.'
      },
      {
        stepNumber: 4,
        title: 'Fermeture hermétique façon « bonbon »',
        description: 'Enroulez le film plastique autour du manchon et serrez fermement chaque extrémité avec un lien (forme d\'emballage de bonbon). Aucune eau de pluie ni air sec ne doit s\'infiltrer.',
        tip: 'Entourez d\'une feuille d\'aluminium pour éviter que le soleil ne surchauffe le substrat sous plastique transparent.'
      },
      {
        stepNumber: 5,
        title: 'Vérification et sevrage',
        description: 'Au bout de 2 à 3 mois, les racines blanches deviennent visibles à travers le plastique. Sciez la branche juste sous le manchon, retirez délicatement le plastique sans briser les racines, et empotez immédiatement.',
        tip: 'Rabattez 30% du feuillage supérieur lors de l\'empotage pour équilibrer la prise d\'eau.'
      }
    ],
    proTips: [
      'Technique royale pour obtenir un jeune arbre fruitier déjà grand et prêt à produire en seulement un an.',
      'Idéal sur les agrumes, figuiers, pommiers de plein vent et grands lilas.'
    ],
    commonMistakes: [
      'Incision trop superficielle : l\'écorce se reforme et aucune racine n\'apparaît.',
      'Manchon pas assez étanche qui se dessèche avant l\'émission des racines.',
      'Casser la motte racinaire fragile lors du retrait du film plastique.'
    ],
    typicalPlants: [
      'Figuier',
      'Citronnier & Oranger',
      'Pommier',
      'Magnolia',
      'Lilas',
      'Caoutchouc (Ficus)',
      'Érable du Japon'
    ],
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-800',
    badgeBorder: 'border-sky-200'
  },

  stolons_drageons: {
    id: 'stolons_drageons',
    title: 'Stolons, drageons et rejets racinés',
    shortLabel: 'Stolons & Drageons',
    icon: '🍓',
    category: 'Drageonnage',
    season: 'Juillet à Septembre (stolons) ou Novembre à Mars (drageons)',
    seasonMonths: [7, 8, 9, 11, 12, 1, 2, 3],
    difficulty: 'Très facile',
    successRate: '95 - 99%',
    rootingDuration: '2 à 4 semaines',
    principle:
      "La reproduction végétative naturelle à l'état pur. Les stolons (tiges aériennes rampantes comme chez le fraisier) émettent des nœuds munis de rosettes de feuilles et de racines. Les drageons (rejets souterrains nés des racines comme chez le framboisier) émergent spontanément du sol avec un système racinaire déjà constitué.",
    materials: [
      'Bêche affûtée pour trancher la racine mère du drageon',
      'Petits godets de terreau pour repiquer les stolons sur place',
      'Sécateur d\'appoint'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Pour les stolons (ex. Fraisiers)',
        description: 'Repérez le premier œilleton formé le long du filet coureur (le plus vigoureux et proche du pied mère). Enterrez un godet rempli de terreau au niveau du sol et fixez-y la rosette.',
        tip: 'Maintenez arrosé 15 jours : une fois bien ancré, sectionnez le cordon ombilical et plantez en place en septembre.'
      },
      {
        stepNumber: 2,
        title: 'Pour les drageons (ex. Framboisiers, Lilas)',
        description: 'Dégagez la terre à la base du jeune rejet émergent au printemps ou en fin d\'automne. Tranchez d\'un coup sec la racine traçante avec la bêche pour récupérer le rejet avec ses propres radicelles.',
        tip: 'Recoupez la tige du drageon à 25-30 cm de hauteur pour limiter l\'évaporation.'
      },
      {
        stepNumber: 3,
        title: 'Plantation immédiate',
        description: 'Replantez le sujet extrait dans une terre meuble et riche en compost. Arrosez abondamment.',
        tip: 'Paillez le rang pour éviter la concurrence des adventices.'
      }
    ],
    proTips: [
      'Ne conservez que les 2 premiers œilletons par stolon de fraisier pour garder un maximum de vigueur.',
      'Le renouvellement régulier par drageons permet de pérenniser une framboisaie productive sur plusieurs décennies.'
    ],
    commonMistakes: [
      'Arracher le drageon à la main sans bêche, arrachant la tige sans ses racines souterraines.',
      'Négliger l\'arrosage les premiers jours après la séparation du pied mère.'
    ],
    typicalPlants: [
      'Fraisier',
      'Framboisier',
      'Artichaut (œilletons)',
      'Menthe',
      'Poirier sauvage',
      'Bambous traçants',
      'Prunellier'
    ],
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200'
  },

  bouture_racine: {
    id: 'bouture_racine',
    title: 'Bouturage de tronçons de racines',
    shortLabel: 'Bouture de racine',
    icon: '🥔',
    category: 'Bouturage',
    season: 'Novembre à Février (repos végétatif racinaire)',
    seasonMonths: [11, 12, 1, 2],
    difficulty: 'Facile',
    successRate: '80 - 90%',
    rootingDuration: '6 à 10 semaines',
    principle:
      "Certaines espèces végétales à racines charnues possèdent la capacité extraordinaire de régénérer à la fois de nouvelles radicelles et de nouveaux bourgeons aériens directement à partir d'un simple fragment de racine prélevé en hiver.",
    materials: [
      'Fourche-bêche pour dégager les racines sans les hacher',
      'Couteau tranchant et désinfecté',
      'Terrine avec mélange 50% sable + 50% terreau fin',
      'Poudre de charbon de bois pour protéger les coupes'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Prélèvement des racines saines',
        description: 'Dégagez délicatement la terre au pied de la plante mère en hiver. Sélectionnez des racines saines et charnues de la grosseur d\'un crayon (5 à 12 mm).',
        tip: 'Prélevez les racines sans déraciner l\'ensemble du pied mère.'
      },
      {
        stepNumber: 2,
        title: 'Tronçonnage et repérage de polarité',
        description: 'Coupez des tronçons de 5 à 10 cm. Coupez la partie supérieure (côté collet) droit, et la partie inférieure (côté pointe) en biseau.',
        tip: 'Ce code visuel permet de ne jamais planter la racine la tête en bas !'
      },
      {
        stepNumber: 3,
        title: 'Mise en terrine',
        description: 'Enfoncez verticalement les tronçons dans le substrat sableux, coupe droite au ras de la surface, ou disposez-les horizontalement recouverts de 1 à 2 cm de sable.',
        tip: 'Maintenez le substrat à peine humide dans un local hors gel (châssis froid, cave lumineuse).'
      },
      {
        stepNumber: 4,
        title: 'Levée printanière',
        description: 'Au printemps, les premiers bourgeons verts émergent du haut du tronçon pendant que le chevelu racinaire s\'étoffe.',
        tip: 'Rempotez individuellement dès que les plantules ont 2 à 3 vraies feuilles.'
      }
    ],
    proTips: [
      'Génial pour propager la consoude Bocking 14 (stérile par graines), le raifort et les pavots orientaux.',
      'Saupoudrez les coupes de charbon de bois pour prévenir la pourriture en hiver.'
    ],
    commonMistakes: [
      'Planter les tronçons verticaux à l\'envers.',
      'Arroser excessivement en hiver dans un substrat lourd, ce qui fait pourrir la racine.'
    ],
    typicalPlants: [
      'Consoude de Russie (Bocking 14)',
      'Raifort',
      'Framboisier',
      'Mûrier',
      'Anémone du Japon',
      'Pavot d\'Orient',
      'Acanthus'
    ],
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-200'
  },

  repiquage_gourmands: {
    id: 'repiquage_gourmands',
    title: 'Bouturage de gourmands (tomates & solanacées)',
    shortLabel: 'Gourmands',
    icon: '🍅',
    category: 'Bouturage',
    season: 'Juin à Juillet (période d\'ébourgeonnage)',
    seasonMonths: [6, 7],
    difficulty: 'Très facile',
    successRate: '95 - 99%',
    rootingDuration: '5 à 10 jours seulement !',
    principle:
      "Les tiges de tomates sont garnies de cellules souches prêtes à émettre des racines adventives dès qu'elles sont au contact de l'eau ou de la terre. Les « gourmands » (pousses axillaires que l'on supprime habituellement lors de la taille) constituent de parfaites boutures déjà vigoureuses donnant un plant productif en un temps record pour prolonger la récolte jusqu'aux gelées.",
    materials: [
      'Gobelet d\'eau propre ou godet de terreau humide',
      'Sécateur ou pincement propre entre le pouce et l\'index'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Pincement du gourmand',
        description: 'Lors du pincement régulier de vos tomates, récupérez les gourmands axillaires vigoureux mesurant entre 10 et 20 cm.',
        tip: 'Choisissez des gourmands sains sans trace de mildiou.'
      },
      {
        stepNumber: 2,
        title: 'Mise à l\'eau ou en terreau',
        description: 'Supprimez les 2 feuilles du bas. Plongez la tige dans un verre d\'eau à température ambiante ou directement dans un godet de terreau bien mouillé.',
        tip: 'Dans l\'eau, des racines blanches de 2 cm apparaissent en moins d\'une semaine !'
      },
      {
        stepNumber: 3,
        title: 'Plantation au potager',
        description: 'Plantez le nouveau plant directement au potager en l\'enterrant profondément jusqu\'aux premières feuilles pour décupler le volume racinaire.',
        tip: 'Idéal pour remplacer un plant malade ou combler un trou dans les planches de culture.'
      }
    ],
    proTips: [
      'Permet d\'avoir une deuxième vague de tomates jeunes et très vigoureuses en septembre-octobre.',
      'Fonctionne également très bien avec les gourmands de basilic et de piments.'
    ],
    commonMistakes: [
      'Garder la bouture dans l\'eau trop longtemps : les racines aquatiques ont du mal à s\'adapter ensuite à la terre.',
      'Placer la bouture en plein cagnard les 48 premières heures.'
    ],
    typicalPlants: [
      'Tomate (toutes variétés)',
      'Tomate cerise',
      'Physalis (Coqueret du Pérou)',
      'Basilic grand vert'
    ],
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    badgeBorder: 'border-red-200'
  },

  greffage: {
    id: 'greffage',
    title: 'Greffage fruitier (fente, couronne, écusson)',
    shortLabel: 'Greffe',
    icon: '🔪',
    category: 'Greffage',
    season: 'Mars à Avril (greffe de printemps en fente/couronne) ou Août (écussonnage)',
    seasonMonths: [3, 4, 8],
    difficulty: 'Délicat',
    successRate: '65 - 85%',
    rootingDuration: '3 à 6 semaines (soudure des cambiums)',
    principle:
      "L'union chirurgicale entre un porte-greffe (qui apporte la vigueur, la tolérance au sol, aux maladies et le système racinaire) et un greffon d'une variété fruitière sélectionnée (qui apporte la saveur, la forme et la fertilité). La réussite repose sur la mise en contact intime des zones génératrices (cambium) des deux partenaires.",
    materials: [
      'Greffoir ou couteau de greffe parfaitement affûté (rasoir)',
      'Mastic à greffer (froid ou chaud) ou cire à cicatriser',
      'Ruban à greffer élastique (Flexiband, Parafilm ou raphia humide)',
      'Alcool à 70° pour désinfecter les lames entre chaque coupe'
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Prélèvement et conservation des greffons',
        description: 'Pour la greffe de printemps, prélevez les rameaux en plein hiver (janvier) pendant la dormance. Conservez-les au réfrigérateur (4°C) dans un linge humide ou au pied d\'un mur au nord.',
        tip: 'Le greffon doit être en dormance alors que le porte-greffe commence à démarrer sa sève !'
      },
      {
        stepNumber: 2,
        title: 'Préparation du porte-greffe',
        description: 'Coupez net le porte-greffe à la hauteur désirée. Fendez-le au centre sur 3 cm (greffe en fente) ou décollez l\'écorce (greffe en couronne).',
        tip: 'La coupe doit être parfaitement propre et plane.'
      },
      {
        stepNumber: 3,
        title: 'Taille du greffon en biseau double',
        description: 'Taillez la base du greffon en forme de coin ou de biseau régulier de 3 cm de long d\'un seul coup de lame net, sans ondulation.',
        tip: 'Ne touchez jamais les coupes fraîches avec les doigts pour ne pas déposer de corps gras.'
      },
      {
        stepNumber: 4,
        title: 'Assemblage et coïncidence des cambiums',
        description: 'Insérez le greffon dans la fente. C\'est l\'étape cruciale : l\'écorce interne verte du greffon doit parfaitement coïncider avec l\'écorce interne du porte-greffe d\'au moins un côté.',
        tip: 'Si les cambiums ne se touchent pas, la soudure est impossible.'
      },
      {
        stepNumber: 5,
        title: 'Ligature et masticage',
        description: 'Ligaturez fermement avec le ruban extensible. Recouvrez toutes les plaies de coupe et le sommet du greffon de mastic à greffer pour interdire l\'entrée d\'air sec et de pluie.',
        tip: 'Le mastic évite le dessèchement des cellules avant leur soudure biologique.'
      }
    ],
    proTips: [
      'Pour débuter, l\'écussonnage d\'été (août) sur jeunes fruitiers est plus accessible et cicatrise très vite.',
      'Supprimez tous les départs de sève situés sur le porte-greffe en dessous du point de greffe.'
    ],
    commonMistakes: [
      'Lame émoussée qui déchire le cambium.',
      'Décalage entre les deux couches d\'écorce (cambiums qui ne se croisent pas).',
      'Oubli de mastiquer, conduisant au dessèchement du greffon en 48 heures.'
    ],
    typicalPlants: [
      'Pommier',
      'Poirier',
      'Cerisier',
      'Prunier',
      'Pêcher / Abricotier',
      'Châtaignier',
      'Rosiers anciens',
      'Agrumes'
    ],
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-200'
  }
};

