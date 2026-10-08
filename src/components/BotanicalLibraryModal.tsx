import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  X, 
  Plus, 
  CheckCircle2, 
  Sprout, 
  Clock, 
  Trees, 
  Leaf,
  Sparkles,
  Scissors,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { fb, useFirebaseData } from '../hooks/useFirebaseData';
import { EncyclopediaEntry, Tree, Seedling, PerpetualTask } from '../db';
import { MULTIPLICATION_RULES, MultiplicationRule, METHOD_ICONS_AND_COLORS } from '../data/multiplicationData';
import { JOURNAL_MONTHS } from '../views/Journal';
import { v4 as uuidv4 } from 'uuid';

interface BotanicalLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEncyclopedia: EncyclopediaEntry[];
  existingTrees: Tree[];
  existingSeedlings: Seedling[];
  onImportSuccess?: (plantName: string) => void;
}

export function BotanicalLibraryModal({
  isOpen,
  onClose,
  existingEncyclopedia,
  existingTrees,
  existingSeedlings,
  onImportSuccess
}: BotanicalLibraryModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const { data: rawPerpetualTasks } = useFirebaseData<PerpetualTask>('perpetualTasks');

  if (!isOpen) return null;

  // Normalized list of user's plants
  const userPlantNames = [
    ...existingEncyclopedia.map(e => e.name.toLowerCase().trim()),
    ...existingTrees.map(t => t.species.toLowerCase().trim()),
    ...existingSeedlings.map(s => s.vegetable.toLowerCase().trim())
  ];

  const isPlantOwned = (rule: MultiplicationRule) => {
    return rule.speciesKeywords.some(keyword => {
      const k = keyword.toLowerCase().trim();
      return userPlantNames.some(p => p.includes(k) || k.includes(p));
    });
  };

  const filteredRules = MULTIPLICATION_RULES.filter(rule => {
    if (selectedCategory !== 'all' && rule.category !== selectedCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        rule.commonName.toLowerCase().includes(q) ||
        rule.methodLabel.toLowerCase().includes(q) ||
        rule.summary.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleImportToGarden = async (rule: MultiplicationRule) => {
    setImportingId(rule.id);
    setSuccessToast(null);

    try {
      const categoryMapping: Record<string, string> = {
        fruitier: 'Arbre fruitier',
        petit_fruit: 'Petits fruits',
        aromatique: 'Aromatique',
        vivace: 'Vivace',
        legume: 'Légume'
      };

      const firstMonth = rule.optimalMonths[0] || 3;
      const endMonth = rule.optimalMonths[rule.optimalMonths.length - 1] || firstMonth;
      const monthLabel = JOURNAL_MONTHS.find(m => m.value === firstMonth.toString())?.label || 'Printemps';

      // 1. Add to Encyclopedia if not present
      const alreadyInEncyclopedia = existingEncyclopedia.some(
        e => e.name.toLowerCase().trim() === rule.commonName.toLowerCase().trim()
      );

      if (!alreadyInEncyclopedia) {
        const newEncId = uuidv4();
        await fb.add('encyclopedia', {
          id: newEncId,
          name: rule.commonName,
          category: categoryMapping[rule.category] || 'Légume',
          sowingPeriod: '',
          plantingPeriod: monthLabel,
          harvestPeriod: 'Selon variété',
          exposure: rule.category === 'fruitier' || rule.category === 'aromatique' ? 'Plein soleil' : 'Mi-ombre',
          waterNeeds: rule.category === 'aromatique' ? 'Faible' : 'Moyen',
          spacing: rule.category === 'fruitier' ? '300' : rule.category === 'petit_fruit' ? '120' : '40',
          goodCompanions: [],
          badCompanions: [],
          tips: `Multiplication privilégiée : ${rule.methodLabel}. ${rule.summary}`,
          updatedAt: new Date().toISOString()
        });
      }

      // 2. Add to Perpetual Tasks as a recurring multiplication action
      const newTaskId = uuidv4();
      await fb.add('perpetualTasks', {
        id: newTaskId,
        title: `Multiplication : ${rule.methodLabel}`,
        plant: rule.commonName,
        category: 'multiplication',
        month: firstMonth,
        period: 'mi',
        endMonth: endMonth !== firstMonth ? endMonth : undefined,
        endPeriod: endMonth !== firstMonth ? 'fin' : undefined,
        optimalMonth: firstMonth,
        optimalPeriod: 'mi',
        description: `${rule.summary}\n\n1. Prélèvement : ${rule.instructions.harvest}\n2. Substrat : ${rule.instructions.substrate}\n3. Soins : ${rule.instructions.care}\n4. Suivi : ${rule.instructions.followUp}`,
        isDeleted: false,
        dateCreated: new Date().toISOString()
      });

      setSuccessToast(`« ${rule.commonName} » a été ajoutée à votre Catalogue et à votre planning perpétuel !`);
      onImportSuccess?.(rule.commonName);
      setTimeout(() => {
        setSuccessToast(null);
      }, 3500);
    } catch (err) {
      console.error('Failed to import botanical model to catalog:', err);
      alert('Erreur lors de l\'ajout au catalogue.');
    } finally {
      setImportingId(null);
    }
  };

  const handleRemoveFromGarden = async (rule: MultiplicationRule) => {
    if (!window.confirm(`Voulez-vous retirer « ${rule.commonName} » de votre Catalogue des Plantes et de votre planning perpétuel ?`)) {
      return;
    }

    setRemovingId(rule.id);
    setSuccessToast(null);

    try {
      const qName = rule.commonName.toLowerCase().trim();

      // 1. Remove from Encyclopedia entries matching this plant name
      const matchingEnc = existingEncyclopedia.filter(e => {
        const encName = e.name.toLowerCase().trim();
        return encName === qName || rule.speciesKeywords.some(k => encName === k.toLowerCase().trim());
      });

      for (const enc of matchingEnc) {
        await fb.delete('encyclopedia', enc.id);
      }

      // 2. Remove from Perpetual Tasks matching this plant
      const matchingTasks = (rawPerpetualTasks || []).filter(t => {
        const plantNorm = (t.plant || '').toLowerCase().trim();
        const titleNorm = (t.title || '').toLowerCase().trim();
        return plantNorm.includes(qName) || qName.includes(plantNorm) || titleNorm.includes(qName);
      });

      for (const task of matchingTasks) {
        await fb.delete('perpetualTasks', task.id);
      }

      setSuccessToast(`« ${rule.commonName} » a été retirée de votre Catalogue et du planning perpétuel.`);
      onImportSuccess?.(rule.commonName);
      setTimeout(() => {
        setSuccessToast(null);
      }, 3500);
    } catch (err) {
      console.error('Failed to remove plant from catalog/perpetual:', err);
      alert('Erreur lors du retrait.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-60 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-purple-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-purple-200" />
            <div>
              <h3 className="font-bold text-sm">
                Bibliothèque de modèles de référence
              </h3>
              <p className="text-[11px] text-purple-200">
                Ajoutez ou retirez en 1 clic des végétaux classiques avec leurs méthodes de multiplication et périodes idéales
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                selectedCategory === 'all' 
                  ? 'bg-purple-700 text-white font-bold' 
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              Toutes
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('petit_fruit')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                selectedCategory === 'petit_fruit' 
                  ? 'bg-purple-700 text-white font-bold' 
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              🍓 Petits fruits
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('fruitier')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                selectedCategory === 'fruitier' 
                  ? 'bg-purple-700 text-white font-bold' 
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              🌳 Fruitiers
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('aromatique')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                selectedCategory === 'aromatique' 
                  ? 'bg-purple-700 text-white font-bold' 
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              🌿 Aromatiques
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('vivace')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                selectedCategory === 'vivace' 
                  ? 'bg-purple-700 text-white font-bold' 
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              🪴 Vivaces & Légumes
            </button>
          </div>

          <div className="relative min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Chercher (lavande, kiwi...)"
              className="w-full px-3 py-1.5 pl-7 rounded-xl border border-stone-200 bg-white text-xs outline-none focus:border-purple-500"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="mx-4 mt-3 p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Content List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 custom-scrollbar">
          <p className="text-[11px] text-stone-500 italic pb-1">
            💡 En ajoutant une plante, elle rejoint immédiatement votre <strong>Catalogue des Plantes</strong> et le <strong>Planning perpétuel</strong>. Si vous l'avez ajoutée par erreur, cliquez simplement sur <strong>« Retirer »</strong> pour la supprimer instantanément.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredRules.map(rule => {
              const owned = isPlantOwned(rule);
              const methodConfig = METHOD_ICONS_AND_COLORS[rule.method];
              const isImporting = importingId === rule.id;
              const isRemoving = removingId === rule.id;

              return (
                <div 
                  key={rule.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                    owned 
                      ? 'bg-purple-50/40 border-purple-200 shadow-2xs' 
                      : 'bg-white border-stone-200/90 shadow-2xs hover:border-purple-300'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{methodConfig.icon}</span>
                        <h4 className="font-serif font-bold text-stone-900 text-sm">
                          {rule.commonName}
                        </h4>
                      </div>

                      {owned ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Déjà chez vous
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600">
                          Non possédé
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                      <span className={`px-1.5 py-0.2 rounded-md border font-medium ${methodConfig.bg} ${methodConfig.text} ${methodConfig.border}`}>
                        {rule.methodLabel}
                      </span>
                      <span className="text-stone-400">•</span>
                      <span className="text-stone-500">
                        {rule.optimalMonths.map(m => JOURNAL_MONTHS.find(jm => jm.value === m.toString())?.label.slice(0, 3)).join(', ')}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {rule.summary}
                    </p>
                  </div>

                  {/* Actions: Add or Remove Button */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-stone-400">
                      Enracinement : ~{rule.rootingTimeWeeks} sem.
                    </span>

                    {!owned ? (
                      <button
                        type="button"
                        onClick={() => handleImportToGarden(rule)}
                        disabled={isImporting}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isImporting ? 'Ajout...' : 'Ajouter à mon jardin'}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveFromGarden(rule)}
                          disabled={isRemoving}
                          className="px-2.5 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg font-medium transition flex items-center gap-1 cursor-pointer"
                          title={`Retirer « ${rule.commonName} » de votre catalogue et planning`}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{isRemoving ? 'Retrait...' : 'Retirer'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-stone-100 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-stone-200 text-stone-700 rounded-xl border border-stone-200 text-xs font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
