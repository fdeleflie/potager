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
