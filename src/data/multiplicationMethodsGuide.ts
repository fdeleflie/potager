import { MultiplicationMethod } from './multiplicationData';

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
  successRate: string; // e.g. "85 - 95%"
  rootingDuration: string; // e.g. "4 à 8 semaines"
  principle: string; // Biological explanation
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
