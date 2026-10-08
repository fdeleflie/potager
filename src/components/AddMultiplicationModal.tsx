import React, { useState, useMemo, useEffect } from 'react';
import { 
  Scissors, 
  X, 
  Save, 
  BookOpen, 
  Sprout, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Trees
} from 'lucide-react';
import { fb } from '../hooks/useFirebaseData';
import { EncyclopediaEntry, Tree, Seedling, ConfigItem } from '../db';
import { 
  MultiplicationMethod, 
  MultiplicationRule, 
  METHOD_ICONS_AND_COLORS 
} from '../data/multiplicationData';
import { v4 as uuidv4 } from 'uuid';
import { JOURNAL_MONTHS } from '../views/Journal';

interface AddMultiplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEncyclopedia: EncyclopediaEntry[];
  existingTrees: Tree[];
  existingSeedlings: Seedling[];
  onSuccess?: () => void;
  initialRule?: MultiplicationRule;
  initialPlantName?: string;
}

const DEFAULT_INSTRUCTIONS_BY_METHOD: Record<MultiplicationMethod, {
  harvest: string;
  substrate: string;
  care: string;
  followUp: string;
  weeks: number;
  months: number[];
  label: string;
}> = {
  bouture_bois_sec: {
    harvest: 'Prélevez des rameaux vigoureux et sains de l\'année de 20-25 cm de long (taille d\'un crayon), juste sous un nœud.',
    substrate: 'Mélange drainant 50% terreau et 50% sable de rivière, ou directement en jauge de terre légère.',
    care: 'Enfoncez aux 2/3 en ne laissant dépasser que 2 ou 3 bourgeons. Maintenez le substrat frais.',
    followUp: 'Laissez s\'enraciner jusqu\'à l\'automne suivant avant le repiquage définitif.',
    weeks: 6,
    months: [11, 12, 1, 2],
    label: 'Bouture sur bois dormant (hiver)'
  },
  bouture_semi_aoutee: {
    harvest: 'Prélevez des tiges de 10-15 cm dont la base est durcie (lignifiée) mais le sommet encore vert.',
    substrate: 'Godet de terreau fin enrichi de 30% de sable ou perlite.',
    care: 'Supprimez les feuilles de la moitié inférieure. Placez à l\'étouffée (sac plastique ou cloche) à mi-ombre.',
    followUp: 'Hivernez à l\'abri des fortes gelées avant de planter au printemps suivant.',
    weeks: 4,
    months: [8, 9],
    label: 'Bouture semi-aoûtée (fin d\'été)'
  },
  bouture_herpacee: {
    harvest: 'Prélevez des jeunes pousses tendres de printemps de 8 à 10 cm.',
    substrate: 'Terreau léger de semis très bien humidifié.',
    care: 'Gardez à température douce (20°C) à la lumière sans soleil direct.',
    followUp: 'Rempotez dès que les premières racines sortent par les trous du godet.',
    weeks: 3,
    months: [4, 5, 6],
    label: 'Bouture herbacée (printemps)'
  },
  division_touffe: {
    harvest: 'Déterrez la souche avec délicatesse et séparez à la bêche ou au couteau des éclats pourvus de racines saines.',
    substrate: 'Terre meuble enrichie en compost mûr.',
    care: 'Raccourcissez le feuillage d\'un tiers pour limiter l\'évaporation. Arrosez abondamment.',
    followUp: 'Arrosez régulièrement le premier mois jusqu\'à la reprise active.',
    weeks: 3,
    months: [3, 4, 10],
    label: 'Division de souche ou touffe'
  },
  marcottage_couche: {
    harvest: 'Courbez une branche basse et souple de l\'année vers le sol sans la casser.',
    substrate: 'Enterrez une partie médiane à 10 cm dans une tranchée de terre meuble.',
    care: 'Fixez avec un cavalier en laissant le sommet dressé vers le haut avec un tuteur.',
    followUp: 'Coupez le lien avec le pied mère au bout de 6 à 12 mois une fois les racines bien formées.',
    weeks: 8,
    months: [8, 9, 10],
    label: 'Marcottage couché'
  },
  marcottage_aerien: {
    harvest: 'Entaillez légèrement l\'écorce d\'une branche aoûtée sur 2 cm.',
    substrate: 'Entourez l\'entaille d\'un manchon de tourbe ou sphaigne humide maintenu par un film plastique.',
    care: 'Vérifiez que la sphaigne reste toujours humide.',
    followUp: 'Sevrez sous le manchon quand les racines tapissent le plastique.',
    weeks: 10,
    months: [4, 5, 6],
    label: 'Marcottage aérien'
  },
  stolons_drageons: {
    harvest: 'Prélevez un rejet ou un œillet de stolon ayant déjà commencé à émettre des racines.',
    substrate: 'Pleine terre riche et fraîche ou godet de terreau humide.',
    care: 'Sectionnez le lien avec la plante mère après enracinement.',
    followUp: 'Mise en place définitive à l\'automne pour une fructification dès l\'année suivante.',
    weeks: 3,
    months: [7, 8, 9],
    label: 'Stolons & Drageons'
  },
  bouture_racine: {
    harvest: 'Déterrez une racine charnue et prélevez des tronçons de 4-6 cm de longueur.',
    substrate: 'Enterrez à plat sous 3 cm de terreau léger ou terre franche.',
    care: 'Arrosez modérément. Les nouvelles pousses émergent en 3 à 4 semaines.',
    followUp: 'Transplantez les jeunes plants vigoureux à l\'automne.',
    weeks: 4,
    months: [11, 12, 1, 2, 3],
    label: 'Bouture de racine'
  },
  repiquage_gourmands: {
    harvest: 'Prélevez un gourmand vigoureux de 10-15 cm retiré lors de la taille.',
    substrate: 'Verre d\'eau ou godet de terreau très humide.',
    care: 'À l\'ombre douce pendant 5 jours. Les racines sortent en moins d\'une semaine.',
    followUp: 'Plantez directement au potager 10 jours après.',
    weeks: 1,
    months: [6, 7],
    label: 'Bouture de gourmands (tomate)'
  },
  greffage: {
    harvest: 'Prélevez des greffons bien aoûtés en repos végétatif ou prélevez un écusson en sève en été.',
    substrate: 'Porte-greffe sain et vigoureux adapté à votre terrain.',
    care: 'Ajustez les cambiums avec précision, ligaturez fermement au raphia et appliquez du mastic à greffer.',
    followUp: 'Déligaturez dès le débourrement actif pour éviter tout étranglement.',
    weeks: 6,
    months: [3, 4, 8],
    label: 'Greffage (fente, couronne ou écusson)'
  }
};

export function AddMultiplicationModal({
  isOpen,
  onClose,
  existingEncyclopedia,
  existingTrees,
  existingSeedlings,
  onSuccess,
  initialRule,
  initialPlantName
}: AddMultiplicationModalProps) {
  // Build clean, deduplicated and properly capitalized list of existing plants known to user
  const allKnownPlantNames = useMemo(() => {
    const rawNames = [
      ...existingEncyclopedia.map(e => e.name),
      ...existingTrees.map(t => t.species),
      ...existingSeedlings.map(s => s.vegetable)
    ];

    const map = new Map<string, string>(); // lower key -> clean capitalized display name

    for (const raw of rawNames) {
      if (!raw || typeof raw !== 'string' || !raw.trim()) continue;
      const trimmed = raw.trim();
      // Capitalize first letter cleanly
      const cleanName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      const key = cleanName.toLowerCase();

      if (!map.has(key)) {
        map.set(key, cleanName);
      } else {
        const existing = map.get(key)!;
        // Prefer version with capital first letter
        if (cleanName[0] === cleanName[0].toUpperCase() && existing[0] !== existing[0].toUpperCase()) {
          map.set(key, cleanName);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [existingEncyclopedia, existingTrees, existingSeedlings]);

  const [selectedPlantSource, setSelectedPlantSource] = useState<string>(() => {
    if (initialRule) return initialRule.commonName;
    if (initialPlantName) {
      const match = allKnownPlantNames.find(p => p.toLowerCase() === initialPlantName.toLowerCase());
      if (match) return match;
    }
    return allKnownPlantNames[0] || '__new__';
  });

  const [customPlantName, setCustomPlantName] = useState<string>('');

  useEffect(() => {
    if (initialRule) {
      setSelectedPlantSource(initialRule.commonName);
    } else if (initialPlantName) {
      const match = allKnownPlantNames.find(p => p.toLowerCase() === initialPlantName.toLowerCase());
      if (match) {
        setSelectedPlantSource(match);
      } else {
        setSelectedPlantSource('__new__');
        setCustomPlantName(initialPlantName);
      }
    }
  }, [initialRule, initialPlantName, allKnownPlantNames]);

  const [addToCatalog, setAddToCatalog] = useState<boolean>(true);
  const [catalogCategory, setCatalogCategory] = useState<string>('Arbre fruitier');

  const [method, setMethod] = useState<MultiplicationMethod>(
    initialRule?.method || 'bouture_bois_sec'
  );
  const [optimalMonths, setOptimalMonths] = useState<number[]>(
    initialRule?.optimalMonths || [11, 12, 1, 2]
  );
  const [difficulty, setDifficulty] = useState<'facile' | 'moyen' | 'delicat'>(
    initialRule?.difficulty || 'facile'
  );
  const [rootingWeeks, setRootingWeeks] = useState<number>(
    initialRule?.rootingTimeWeeks || 6
  );
  const [summary, setSummary] = useState<string>(
    initialRule?.summary || 'Multiplication par bouture à réaliser en période de repos végétatif.'
  );

  // Instructions
  const [harvestInstruction, setHarvestInstruction] = useState<string>(
    initialRule?.instructions.harvest || DEFAULT_INSTRUCTIONS_BY_METHOD.bouture_bois_sec.harvest
  );
  const [substrateInstruction, setSubstrateInstruction] = useState<string>(
    initialRule?.instructions.substrate || DEFAULT_INSTRUCTIONS_BY_METHOD.bouture_bois_sec.substrate
  );
  const [careInstruction, setCareInstruction] = useState<string>(
    initialRule?.instructions.care || DEFAULT_INSTRUCTIONS_BY_METHOD.bouture_bois_sec.care
  );
  const [followUpInstruction, setFollowUpInstruction] = useState<string>(
    initialRule?.instructions.followUp || DEFAULT_INSTRUCTIONS_BY_METHOD.bouture_bois_sec.followUp
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const plantName = selectedPlantSource === '__new__' ? customPlantName.trim() : selectedPlantSource;
  const isExistingInCatalog = existingEncyclopedia.some(
    e => e.name.toLowerCase().trim() === plantName.toLowerCase().trim()
  );

  // When method changes, fill sensible default instructions if not custom
  const handleMethodChange = (newMethod: MultiplicationMethod) => {
    setMethod(newMethod);
    const defaults = DEFAULT_INSTRUCTIONS_BY_METHOD[newMethod];
    if (defaults) {
      setOptimalMonths(defaults.months);
      setRootingWeeks(defaults.weeks);
      setHarvestInstruction(defaults.harvest);
      setSubstrateInstruction(defaults.substrate);
      setCareInstruction(defaults.care);
      setFollowUpInstruction(defaults.followUp);
      setSummary(`Multiplication par ${defaults.label.toLowerCase()} pour régénérer ou multiplier cette plante.`);
    }
  };

  const toggleMonth = (monthNum: number) => {
    if (optimalMonths.includes(monthNum)) {
      if (optimalMonths.length > 1) {
        setOptimalMonths(optimalMonths.filter(m => m !== monthNum));
      }
    } else {
      setOptimalMonths([...optimalMonths, monthNum].sort((a, b) => a - b));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantName) {
      setFeedback('Veuillez préciser le nom de la plante.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const difficultyLabels = {
        facile: 'Très facile',
        moyen: 'Moyen',
        delicat: 'Délicat'
      };

      const ruleId = initialRule ? initialRule.id : `custom_${uuidv4().slice(0, 8)}`;
      const configId = initialRule?.customConfigId || `cfg_mult_${uuidv4().slice(0, 8)}`;

      // 1. Save or update the custom multiplication rule in config collection
      await fb.put('config', {
        id: configId,
        type: 'custom_multiplication',
        value: plantName,
        attributes: {
          id: ruleId,
          speciesKeywords: [plantName.toLowerCase().trim()],
          commonName: plantName,
          category: catalogCategory === 'Arbre fruitier' ? 'fruitier' : catalogCategory === 'Petits fruits' ? 'petit_fruit' : catalogCategory === 'Aromatique' ? 'aromatique' : 'vivace',
          method,
          methodLabel: DEFAULT_INSTRUCTIONS_BY_METHOD[method]?.label || method,
          optimalMonths,
          possibleMonths: [],
          difficulty,
          difficultyLabel: difficultyLabels[difficulty],
          rootingTimeWeeks: rootingWeeks,
          summary: summary.trim(),
          instructions: {
            harvest: harvestInstruction.trim(),
            substrate: substrateInstruction.trim(),
            care: careInstruction.trim(),
            followUp: followUpInstruction.trim()
          },
          isCustom: true
        }
      });

      // 2. Coherent Catalog Sync: Add to Catalogue des Plantes if requested and not already present
      if (addToCatalog && !isExistingInCatalog) {
        const newEncId = uuidv4();
        await fb.add('encyclopedia', {
          id: newEncId,
          name: plantName,
          category: catalogCategory,
          sowingPeriod: '',
          plantingPeriod: optimalMonths.length > 0 
            ? JOURNAL_MONTHS.find(m => m.value === optimalMonths[0].toString())?.label || 'Printemps'
            : 'Automne / Printemps',
          harvestPeriod: 'Selon la variété',
          exposure: 'Plein soleil',
          waterNeeds: 'Moyen',
          spacing: catalogCategory === 'Arbre fruitier' ? '300' : catalogCategory === 'Petits fruits' ? '120' : '50',
          goodCompanions: [],
          badCompanions: [],
          tips: `Multiplication privilégiée : ${DEFAULT_INSTRUCTIONS_BY_METHOD[method]?.label}. ${summary}`,
          updatedAt: new Date().toISOString()
        });
      }

      setFeedback('✓ Règle de multiplication enregistrée et synchronisée avec succès !');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to save multiplication rule:', err);
      setFeedback('Erreur lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-60 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-xl max-h-[92vh] overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-teal-800 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-teal-200" />
            <h3 className="font-bold text-sm">
              {initialRule ? 'Modifier la multiplication' : 'Ajouter une multiplication à votre jardin'}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 text-xs">
          {feedback && (
            <div className={`p-3 rounded-xl font-semibold flex items-center gap-2 ${
              feedback.startsWith('✓') 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                : 'bg-red-100 text-red-900'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Plant Choice */}
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2.5">
            <label className="block text-xs font-bold text-stone-800">
              1. Plante concernée :
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">
                  Choisir parmi vos plantes :
                </label>
                <select
                  value={selectedPlantSource}
                  onChange={e => setSelectedPlantSource(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-medium text-xs"
                >
                  <optgroup label="Vos plantes répertoriées">
                    {allKnownPlantNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Autre plante">
                    <option value="__new__">+ Saisir une nouvelle plante...</option>
                  </optgroup>
                </select>
              </div>

              {selectedPlantSource === '__new__' && (
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">
                    Nom de la nouvelle plante :
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Cassissier Noir de Bourgogne, Kaki, Myrtillier..."
                    value={customPlantName}
                    onChange={e => setCustomPlantName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-semibold text-xs text-stone-900"
                  />
                </div>
              )}
            </div>

            {/* Catalog Coherence Sync Box */}
            {!isExistingInCatalog && plantName && (
              <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-2 text-emerald-950 mt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                  <input
                    type="checkbox"
                    checked={addToCatalog}
                    onChange={e => setAddToCatalog(e.target.checked)}
                    className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>📖 Enregistrer aussi « {plantName} » dans mon Catalogue des Plantes</span>
                </label>
                <p className="text-[11px] text-emerald-800 pl-6 leading-relaxed">
                  Cette plante fera désormais partie intégrante de votre Catalogue. Vous pourrez l'associer à vos semis, votre verger et votre calendrier sans créer de désynchronisation.
                </p>

                {addToCatalog && (
                  <div className="pl-6 pt-1 flex items-center gap-2">
                    <span className="text-[11px] text-stone-600 font-medium">Catégorie :</span>
                    <select
                      value={catalogCategory}
                      onChange={e => setCatalogCategory(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-emerald-300 bg-white text-xs font-semibold text-stone-800"
                    >
                      <option value="Arbre fruitier">🌳 Arbre fruitier</option>
                      <option value="Petits fruits">🍓 Petits fruits & Baies</option>
                      <option value="Aromatique">🌿 Plante aromatique</option>
                      <option value="Légume">🥕 Légume potager</option>
                      <option value="Vivace">🪴 Plante vivace</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Multiplication Method Choice */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-800">
              2. Méthode de multiplication :
            </label>
            <select
              value={method}
              onChange={e => handleMethodChange(e.target.value as MultiplicationMethod)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 font-semibold text-xs text-stone-900"
            >
              <option value="bouture_bois_sec">🪵 Bouture de rameau dormant (bois sec en hiver)</option>
              <option value="bouture_semi_aoutee">🌿 Bouture semi-aoûtée (semi-ligneuse en fin d'été)</option>
              <option value="bouture_herpacee">🌱 Bouture herbacée de printemps (tiges tendres)</option>
              <option value="division_touffe">🪴 Division de souche ou de touffe (printemps / automne)</option>
              <option value="marcottage_couche">➰ Marcottage couché (bouterollage)</option>
              <option value="marcottage_aerien">🎋 Marcottage aérien (sur branche)</option>
              <option value="stolons_drageons">🍓 Prélèvement de stolons ou drageons enracinés</option>
              <option value="bouture_racine">🥔 Bouture de racine (tronçons de racines)</option>
              <option value="repiquage_gourmands">🍅 Repiquage de gourmands (tomates)</option>
            </select>
          </div>

          {/* Optimal Months Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800">
                3. Mois optimaux :
              </label>
              <span className="text-[11px] text-stone-500">
                {optimalMonths.map(m => JOURNAL_MONTHS.find(jm => jm.value === m.toString())?.label.slice(0, 3)).join(', ')}
              </span>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
              {JOURNAL_MONTHS.map(m => {
                const monthNum = parseInt(m.value, 10);
                const isSelected = optimalMonths.includes(monthNum);

                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => toggleMonth(monthNum)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-teal-700 text-white shadow-2xs font-bold'
                        : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {m.label.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty & Rooting Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Difficulté :
              </label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-xs"
              >
                <option value="facile">Très facile</option>
                <option value="moyen">Moyen</option>
                <option value="delicat">Délicat</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Délai d'enracinement (semaines) :
              </label>
              <input
                type="number"
                min="1"
                max="52"
                value={rootingWeeks}
                onChange={e => setRootingWeeks(parseInt(e.target.value, 10) || 4)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-xs"
              />
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
              Résumé / Description courte :
            </label>
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-stone-200 font-medium text-xs"
              placeholder="Conseil rapide en une phrase..."
            />
          </div>

          {/* Step-by-Step Instructions */}
          <div className="space-y-2 pt-1 border-t border-stone-200">
            <label className="block text-xs font-bold text-stone-800">
              4. Consignes pas-à-pas (modifiables) :
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-0.5">
                  1. Prélèvement :
                </label>
                <textarea
                  rows={2}
                  value={harvestInstruction}
                  onChange={e => setHarvestInstruction(e.target.value)}
                  className="w-full p-2 rounded-lg border border-stone-200 text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-0.5">
                  2. Substrat & Contenant :
                </label>
                <textarea
                  rows={2}
                  value={substrateInstruction}
                  onChange={e => setSubstrateInstruction(e.target.value)}
                  className="w-full p-2 rounded-lg border border-stone-200 text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-0.5">
                  3. Soins & Humidité :
                </label>
                <textarea
                  rows={2}
                  value={careInstruction}
                  onChange={e => setCareInstruction(e.target.value)}
                  className="w-full p-2 rounded-lg border border-stone-200 text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-0.5">
                  4. Repiquage & Plantation :
                </label>
                <textarea
                  rows={2}
                  value={followUpInstruction}
                  onChange={e => setFollowUpInstruction(e.target.value)}
                  className="w-full p-2 rounded-lg border border-stone-200 text-xs resize-none"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-medium cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer la multiplication'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
