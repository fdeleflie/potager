import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, Trash2, ArrowRight, ShieldAlert, 
  TreePine, Sprout, X, Check, RefreshCw, Sparkles, Layers
} from 'lucide-react';
import { fb } from '../hooks/useFirebaseData';

interface DeletePlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  plant: any | null;
  allPlants: any[];
  trees: any[] | undefined;
  seedlings: any[] | undefined;
  config: any[] | undefined;
  encyclopedia: any[] | undefined;
  onDeleted?: (plantName: string, actionDesc: string) => void;
}

export function DeletePlantModal({
  isOpen,
  onClose,
  plant,
  allPlants,
  trees,
  seedlings,
  config,
  encyclopedia,
  onDeleted,
}: DeletePlantModalProps) {
  const [deleteMode, setDeleteMode] = useState<'reassign' | 'cascade' | 'catalog_only'>('reassign');
  const [targetPlantName, setTargetPlantName] = useState<string>('Prunier');
  const [isProcessing, setIsProcessing] = useState(false);

  // Identify matching trees and seedlings
  const plantName = plant?.name?.trim() || '';
  const plantNameLower = plantName.toLowerCase();

  const matchingTrees = useMemo(() => {
    if (!plantNameLower || !trees) return [];
    return trees.filter(t => (t.species || '').trim().toLowerCase() === plantNameLower);
  }, [plantNameLower, trees]);

  const matchingSeedlings = useMemo(() => {
    if (!plantNameLower || !seedlings) return [];
    return seedlings.filter(s => (s.vegetable || '').trim().toLowerCase() === plantNameLower);
  }, [plantNameLower, seedlings]);

  const matchingVarieties = useMemo(() => {
    if (!plant || !config) return [];
    const parentIds = new Set([plant.configId, plant.encyclopediaId, plant.id].filter(Boolean));
    return config.filter(c => c.type === 'variety' && parentIds.has(c.parentId));
  }, [plant, config]);

  // Candidates for reassignment (exclude the plant itself)
  const reassignmentCandidates = useMemo(() => {
    return allPlants
      .filter(p => (p.name || '').trim().toLowerCase() !== plantNameLower)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allPlants, plantNameLower]);

  // Auto-pick intelligent target (e.g. if plant is Mirabellier, Quetschier, Reine-Claude -> suggest Prunier)
  React.useEffect(() => {
    if (!isOpen || !plantNameLower) return;
    
    if (['mirabellier', 'mirabelier', 'quetschier', 'reine-claude', 'reine claude'].includes(plantNameLower)) {
      const prunier = reassignmentCandidates.find(p => p.name.toLowerCase().includes('prunier'));
      if (prunier) {
        setTargetPlantName(prunier.name);
        setDeleteMode('reassign');
        return;
      }
    }
    
    if (reassignmentCandidates.length > 0 && !reassignmentCandidates.some(c => c.name === targetPlantName)) {
      setTargetPlantName(reassignmentCandidates[0].name);
    }
  }, [isOpen, plantNameLower, reassignmentCandidates]);

  if (!isOpen || !plant) return null;

  const hasDependencies = matchingTrees.length > 0 || matchingSeedlings.length > 0;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      // 1. Find all encyclopedia and config entries for this plant
      const encEntries = (encyclopedia || []).filter(
        e => (e.name || '').trim().toLowerCase() === plantNameLower
      );
      const confVegetables = (config || []).filter(
        c => c.type === 'vegetable' && (c.value || '').trim().toLowerCase() === plantNameLower
      );

      const allParentIds = new Set([
        plant.configId,
        plant.encyclopediaId,
        plant.id,
        ...encEntries.map(e => e.id),
        ...confVegetables.map(c => c.id),
      ].filter(Boolean));

      // 2. Handle trees and seedlings depending on chosen mode
      if (deleteMode === 'reassign' && targetPlantName) {
        const targetPlantObj = allPlants.find(
          p => p.name.trim().toLowerCase() === targetPlantName.trim().toLowerCase()
        );
        const targetParentId = targetPlantObj?.encyclopediaId || targetPlantObj?.configId;

        // Reassign trees to target plant
        for (const t of matchingTrees) {
          await fb.update('trees', t.id, { 
            species: targetPlantName.trim(),
            // If tree variety is empty, use plantName as variety (e.g. Mirabellier -> Prunier, variety Mirabelle)
            variety: t.variety?.trim() ? t.variety.trim() : plantName
          });
        }

        // Reassign seedlings to target plant
        for (const s of matchingSeedlings) {
          await fb.update('seedlings', s.id, {
            vegetable: targetPlantName.trim(),
            variety: s.variety?.trim() ? s.variety.trim() : plantName
          });
        }

        // Reassign varieties to target plant's parent ID in config
        if (targetParentId) {
          for (const v of matchingVarieties) {
            await fb.update('config', v.id, { parentId: targetParentId });
          }
        }
      } else if (deleteMode === 'cascade') {
        // Delete all matching trees
        for (const t of matchingTrees) {
          await fb.delete('trees', t.id);
        }
        // Delete all matching seedlings
        for (const s of matchingSeedlings) {
          await fb.delete('seedlings', s.id);
        }
        // Delete varieties
        for (const v of matchingVarieties) {
          await fb.delete('config', v.id);
        }
      } else if (deleteMode === 'catalog_only') {
        // Delete varieties from catalog
        for (const v of matchingVarieties) {
          await fb.delete('config', v.id);
        }
      }

      // 3. Delete from encyclopedia
      for (const e of encEntries) {
        await fb.delete('encyclopedia', e.id);
      }

      // 4. Delete from config (type: 'vegetable')
      for (const c of confVegetables) {
        await fb.delete('config', c.id);
      }

      if (onDeleted) {
        const actionText = deleteMode === 'reassign' 
          ? `reclassée vers « ${targetPlantName} » et supprimée du catalogue`
          : 'supprimée définitivement';
        onDeleted(plantName, actionText);
      }

      onClose();
    } catch (err) {
      console.error('Error deleting plant:', err);
      alert('Une erreur est survenue lors de la suppression.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl shadow-xs ${
              hasDependencies ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
              {hasDependencies ? <Layers className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-serif font-semibold text-stone-900">
                Supprimer « {plantName} »
              </h2>
              <p className="text-xs text-stone-500">
                Gestion des dépendances (arbres, semis, variétés) du catalogue.
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

        {/* Body */}
        <div className="p-6 space-y-5">
          {hasDependencies ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Cette plante est actuellement utilisée dans votre jardin / verger :</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-amber-800">
                {matchingTrees.length > 0 && (
                  <li>
                    <strong>{matchingTrees.length} arbre(s)</strong> dans « Mon Verger » (ex: {matchingTrees.map(t => t.variety ? `${t.species} ${t.variety}` : t.species).slice(0, 3).join(', ')}{matchingTrees.length > 3 ? '...' : ''})
                  </li>
                )}
                {matchingSeedlings.length > 0 && (
                  <li>
                    <strong>{matchingSeedlings.length} semis</strong> enregistré(s)
                  </li>
                )}
                {matchingVarieties.length > 0 && (
                  <li>
                    <strong>{matchingVarieties.length} variété(s)</strong> enregistrée(s)
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-stone-600">
              Voulez-vous vraiment supprimer <strong>« {plantName} »</strong> ?
              {matchingVarieties.length > 0 && (
                <span className="block mt-1 text-xs text-stone-500">
                  Ses {matchingVarieties.length} variété(s) associée(s) seront également retirées du catalogue.
                </span>
              )}
            </p>
          )}

          {hasDependencies && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-700">
                Que souhaitez-vous faire des éléments existants ?
              </label>

              {/* Option 1: Reassign / Merge into another plant */}
              <div 
                onClick={() => setDeleteMode('reassign')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2.5 ${
                  deleteMode === 'reassign'
                    ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 ring-2 ring-emerald-400/20'
                    : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteMode === 'reassign'}
                      onChange={() => setDeleteMode('reassign')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-stone-900">
                      Reclasser & fusionner vers une autre plante (Recommandé)
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Sans perte
                  </span>
                </div>
                <p className="text-xs text-stone-600 pl-6">
                  Transfère les arbres, semis et variétés vers la plante cible (ex: transformer <em>Mirabellier</em> ou <em>Quetschier</em> en <em>Prunier</em>), puis supprime la fiche « {plantName} ».
                </p>

                {deleteMode === 'reassign' && (
                  <div className="pl-6 pt-1 flex items-center gap-2">
                    <span className="text-xs text-stone-500 font-medium">Plante cible :</span>
                    <select
                      value={targetPlantName}
                      onChange={e => setTargetPlantName(e.target.value)}
                      className="bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                    >
                      {reassignmentCandidates.map(p => (
                        <option key={p.id} value={p.name}>{p.name} ({p.category})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Option 2: Cascade Delete Everything */}
              <div 
                onClick={() => setDeleteMode('cascade')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                  deleteMode === 'cascade'
                    ? 'bg-red-50/70 border-red-400 text-red-950 ring-2 ring-red-400/20'
                    : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteMode === 'cascade'}
                      onChange={() => setDeleteMode('cascade')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs font-bold text-stone-900">
                      Supprimer la plante ET tous les arbres/semis associés
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                    Destructif
                  </span>
                </div>
                <p className="text-xs text-stone-600 pl-6">
                  Supprime définitivement la fiche de l'encyclopédie ainsi que les {matchingTrees.length} arbre(s) et {matchingSeedlings.length} semis existants.
                </p>
              </div>

              {/* Option 3: Catalog only */}
              <div 
                onClick={() => setDeleteMode('catalog_only')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                  deleteMode === 'catalog_only'
                    ? 'bg-amber-50/70 border-amber-400 text-amber-950 ring-2 ring-amber-400/20'
                    : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'catalog_only'}
                    onChange={() => setDeleteMode('catalog_only')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-stone-900">
                    Supprimer uniquement la fiche du catalogue
                  </span>
                </div>
                <p className="text-xs text-stone-600 pl-6">
                  Retire la plante du catalogue des plantes sans toucher aux arbres existants dans le verger.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/70 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-medium rounded-xl transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirm}
            className={`px-5 py-2 text-white font-medium rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
              deleteMode === 'reassign' 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Traitement en cours...</span>
              </>
            ) : deleteMode === 'reassign' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Reclasser vers {targetPlantName}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la suppression</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
