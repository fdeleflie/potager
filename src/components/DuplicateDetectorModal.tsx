import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, CheckCircle2, Sparkles, X, RefreshCw, 
  Layers, Check, ArrowRight, Info, Filter, Trash2, TreePine, 
  HelpCircle, SlidersHorizontal
} from 'lucide-react';
import { 
  SimilarVarietyGroup, 
  detectSimilarVarieties, 
  VarietyVariantItem 
} from '../utils/fuzzyMatching';
import { fb } from '../hooks/useFirebaseData';

interface DuplicateDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: any[] | undefined;
  encyclopedia: any[] | undefined;
  trees: any[] | undefined;
  seedlings: any[] | undefined;
  initialPlantFilter?: string;
  onSuccessToast?: (msg: string) => void;
}

export function DuplicateDetectorModal({
  isOpen,
  onClose,
  config,
  encyclopedia,
  trees,
  seedlings,
  initialPlantFilter,
  onSuccessToast,
}: DuplicateDetectorModalProps) {
  const [selectedPlant, setSelectedPlant] = useState<string>(initialPlantFilter || '');
  const [filterType, setFilterType] = useState<'all' | 'exact' | 'fuzzy'>('all');
  const [sensitivity, setSensitivity] = useState<number>(75);
  const [customCanonicalNames, setCustomCanonicalNames] = useState<Record<string, string>>({});
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, string>>({});
  const [mergingGroupId, setMergingGroupId] = useState<string | null>(null);
  const [isBulkMerging, setIsBulkMerging] = useState(false);
  const [ignoredGroupIds, setIgnoredGroupIds] = useState<Set<string>>(new Set());

  // Detect similar and exact duplicate groups
  const groups: SimilarVarietyGroup[] = useMemo(() => {
    if (!isOpen) return [];
    return detectSimilarVarieties(
      config,
      encyclopedia,
      trees,
      seedlings,
      sensitivity,
      selectedPlant || undefined
    ).filter(g => !ignoredGroupIds.has(g.id));
  }, [isOpen, config, encyclopedia, trees, seedlings, sensitivity, selectedPlant, ignoredGroupIds]);

  // Unique plant names in detected groups for quick filtering
  const availablePlants = useMemo(() => {
    const set = new Set<string>();
    groups.forEach(g => set.add(g.plantName));
    return Array.from(set).sort();
  }, [groups]);

  // Filtered groups by match type
  const displayedGroups = useMemo(() => {
    return groups.filter(g => {
      if (filterType === 'exact') return g.isExactMatch;
      if (filterType === 'fuzzy') return !g.isExactMatch;
      return true;
    });
  }, [groups, filterType]);

  const exactCount = useMemo(() => groups.filter(g => g.isExactMatch).length, [groups]);
  const fuzzyCount = useMemo(() => groups.filter(g => !g.isExactMatch).length, [groups]);

  if (!isOpen) return null;

  // Handles merging a single cluster of varieties into a single canonical variety
  const handleMergeGroup = async (group: SimilarVarietyGroup) => {
    setMergingGroupId(group.id);
    try {
      const canonicalName = (customCanonicalNames[group.id] || group.suggestedName).trim();
      const chosenVariantId = selectedVariantIds[group.id] || group.variants[0].id;
      
      // Combine attributes from all variants
      const mergedAttributes: any = {};
      group.variants.forEach(v => {
        if (v.attributes && typeof v.attributes === 'object') {
          Object.assign(mergedAttributes, v.attributes);
        }
      });

      // 1. Keep or update the primary config entry
      const primaryVariant = group.variants.find(v => v.id === chosenVariantId) || group.variants[0];
      await fb.update('config', primaryVariant.id, {
        value: canonicalName,
        parentId: group.canonicalParentId || primaryVariant.parentId,
        attributes: Object.keys(mergedAttributes).length > 0 ? mergedAttributes : undefined,
      });

      // 2. Delete all other redundant duplicate config entries
      const idsToDelete = group.variants
        .map(v => v.id)
        .filter(id => id !== primaryVariant.id);

      if (idsToDelete.length > 0) {
        await fb.batchDelete('config', idsToDelete);
      }

      // 3. Update any trees referencing variant names that were merged
      const variantNamesToMigrate = new Set(
        group.variants
          .map(v => v.name.trim())
          .filter(name => name.toLowerCase() !== canonicalName.toLowerCase())
      );

      if (trees && trees.length > 0 && variantNamesToMigrate.size > 0) {
        for (const tree of trees) {
          if (
            tree.species?.trim().toLowerCase() === group.plantName.toLowerCase() &&
            tree.variety &&
            variantNamesToMigrate.has(tree.variety.trim())
          ) {
            await fb.update('trees', tree.id, { variety: canonicalName });
          }
        }
      }

      // 4. Update any seedlings referencing variant names that were merged
      if (seedlings && seedlings.length > 0 && variantNamesToMigrate.size > 0) {
        for (const seedling of seedlings) {
          if (
            seedling.vegetable?.trim().toLowerCase() === group.plantName.toLowerCase() &&
            seedling.variety &&
            variantNamesToMigrate.has(seedling.variety.trim())
          ) {
            await fb.update('seedlings', seedling.id, { variety: canonicalName });
          }
        }
      }

      if (onSuccessToast) {
        onSuccessToast(`Variété « ${canonicalName} » (${group.plantName}) fusionnée avec succès (${group.variants.length} variantes consolidées).`);
      }
    } catch (err) {
      console.error('Error merging variety group:', err);
      alert('Une erreur est survenue lors de la fusion du groupe.');
    } finally {
      setMergingGroupId(null);
    }
  };

  // Bulk merge all exact matches and high-similarity matches (>= 90%)
  const handleBulkMergeEvident = async () => {
    const highConfidenceGroups = groups.filter(g => g.isExactMatch || g.maxSimilarity >= 90);
    if (highConfidenceGroups.length === 0) return;

    setIsBulkMerging(true);
    try {
      let mergedCount = 0;
      for (const group of highConfidenceGroups) {
        await handleMergeGroup(group);
        mergedCount++;
      }
      if (onSuccessToast) {
        onSuccessToast(`${mergedCount} groupe(s) de doublons et variantes fusionnés avec succès !`);
      }
    } catch (err) {
      console.error('Error bulk merging:', err);
      alert('Une erreur est survenue lors de la fusion automatique.');
    } finally {
      setIsBulkMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-semibold text-stone-900 flex items-center gap-2">
                Détecteur de Doublons & Variantes Proches
              </h2>
              <p className="text-xs text-stone-500">
                Identifie les orthographes proches (ex: Reine Claude d'Oullins), accents, tirets et doublons exacts pour les fusionner proprement.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Controls Bar */}
        <div className="p-4 border-b border-stone-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by plant */}
            <div className="flex items-center gap-1.5 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
              <TreePine className="w-3.5 h-3.5 text-stone-500" />
              <select
                value={selectedPlant}
                onChange={e => setSelectedPlant(e.target.value)}
                className="bg-transparent text-stone-800 font-medium focus:outline-none cursor-pointer"
              >
                <option value="">Toutes les plantes ({availablePlants.length})</option>
                {availablePlants.map(plant => (
                  <option key={plant} value={plant}>{plant}</option>
                ))}
              </select>
            </div>

            {/* Filter by duplicate type */}
            <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Tous ({groups.length})
              </button>
              <button
                onClick={() => setFilterType('exact')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'exact' ? 'bg-white text-emerald-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Exacts ({exactCount})
              </button>
              <button
                onClick={() => setFilterType('fuzzy')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterType === 'fuzzy' ? 'bg-white text-amber-700 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Orthographe proche ({fuzzyCount})
              </button>
            </div>
          </div>

          {/* Sensitivity Setting */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Sensibilité :</span>
              <select
                value={sensitivity}
                onChange={e => setSensitivity(Number(e.target.value))}
                className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-0.5 text-stone-700 font-medium cursor-pointer"
              >
                <option value={90}>Stricte (≥90%)</option>
                <option value={75}>Équilibrée (≥75%)</option>
                <option value={65}>Large (≥65%)</option>
              </select>
            </div>

            {/* Bulk merge button */}
            {groups.length > 0 && (
              <button
                type="button"
                disabled={isBulkMerging}
                onClick={handleBulkMergeEvident}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-medium rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title="Fusionne automatiquement tous les doublons évidents en conservant la meilleure orthographe"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBulkMerging ? 'animate-spin' : ''}`} />
                <span>{isBulkMerging ? 'Fusion en cours...' : 'Fusionner les évidences'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-stone-50/50 custom-scrollbar">
          {displayedGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-stone-400 space-y-3">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <p className="text-base font-serif font-medium text-stone-800">
                Aucun doublon ou variante proche détecté
              </p>
              <p className="text-xs text-stone-500 max-w-md">
                {selectedPlant 
                  ? `Les variétés pour « ${selectedPlant} » sont parfaitement propres et sans ambiguïté.`
                  : "Votre catalogue de plantes et variétés ne comporte actuellement aucun doublon ou variation d'orthographe."}
              </p>
            </div>
          ) : (
            displayedGroups.map((group) => {
              const currentCanonical = customCanonicalNames[group.id] || group.suggestedName;
              const isMergingThis = mergingGroupId === group.id;

              return (
                <div 
                  key={group.id} 
                  className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs hover:border-amber-300 transition-all space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-stone-200/60">
                        <TreePine className="w-3.5 h-3.5 text-stone-500" />
                        {group.plantName}
                      </span>
                      {group.isExactMatch ? (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Doublons exacts ({group.variants.length} copies)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          Orthographe proche ({group.maxSimilarity}% de similarité)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIgnoredGroupIds(prev => new Set(prev).add(group.id))}
                        className="text-stone-400 hover:text-stone-600 text-xs px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors"
                        title="Considérer comme des variétés distinctes"
                      >
                        Ignorer
                      </button>
                    </div>
                  </div>

                  {/* Variants List & Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-stone-700">
                      Variantes identifiées dans votre base :
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.variants.map((v) => {
                        const isChosen = currentCanonical.toLowerCase() === v.name.toLowerCase();
                        return (
                          <div
                            key={v.id}
                            onClick={() => {
                              setCustomCanonicalNames(prev => ({ ...prev, [group.id]: v.name }));
                              setSelectedVariantIds(prev => ({ ...prev, [group.id]: v.id }));
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-2 ${
                              isChosen 
                                ? 'bg-amber-50/70 border-amber-400 text-amber-950 ring-2 ring-amber-400/20' 
                                : 'bg-stone-50/60 border-stone-200 text-stone-700 hover:bg-stone-100/70'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="radio"
                                  name={`canonical-${group.id}`}
                                  checked={isChosen}
                                  onChange={() => {}}
                                  className="text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                                />
                                <span className="text-xs font-bold truncate">{v.name}</span>
                              </div>
                              <div className="text-[11px] text-stone-500 mt-1 pl-5 space-x-2">
                                {v.treesCount > 0 && (
                                  <span className="text-emerald-700 font-medium">
                                    🌳 {v.treesCount} arbre(s)
                                  </span>
                                )}
                                {v.seedlingsCount > 0 && (
                                  <span className="text-teal-700 font-medium">
                                    🌱 {v.seedlingsCount} semis
                                  </span>
                                )}
                                {v.attributes && Object.keys(v.attributes).length > 0 && (
                                  <span className="text-stone-600">
                                    ✨ Fiche renseignée
                                  </span>
                                )}
                              </div>
                            </div>
                            {isChosen && (
                              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-200/70 px-1.5 py-0.5 rounded">
                                Retenu
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Canonical Name Editor & Merge Trigger */}
                  <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50 p-3 rounded-xl">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-stone-500 whitespace-nowrap font-medium">
                        Orthographe finale :
                      </span>
                      <input
                        type="text"
                        value={currentCanonical}
                        onChange={e => setCustomCanonicalNames(prev => ({ ...prev, [group.id]: e.target.value }))}
                        className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        placeholder="Nom final après fusion"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isMergingThis || !currentCanonical.trim()}
                      onClick={() => handleMergeGroup(group)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      <Check className={`w-3.5 h-3.5 ${isMergingThis ? 'animate-spin' : ''}`} />
                      <span>{isMergingThis ? 'Fusion...' : `Fusionner les ${group.variants.length} variantes`}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-stone-400" />
            <span>
              La fusion met à jour automatiquement les arbres du verger et les semis associés à cette variété.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-medium rounded-xl transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
