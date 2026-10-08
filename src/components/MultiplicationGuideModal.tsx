import React, { useState, useMemo } from 'react';
import { 
  X, 
  Scissors, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  BookOpen, 
  Trees, 
  Sprout, 
  Clock, 
  Flame, 
  Droplets, 
  Layers, 
  Save, 
  Camera, 
  Eye, 
  Check, 
  XCircle,
  ExternalLink
} from 'lucide-react';
import { fb, useFirebaseData } from '../hooks/useFirebaseData';
import { Seedling, Tree, JournalEntry, Task, EncyclopediaEntry } from '../db';
import { 
  matchUserPlantsWithMultiplications, 
  EnrichedMultiplicationItem 
} from '../utils/multiplicationMatcher';
import { 
  MultiplicationRule, 
  MultiplicationMethod, 
  METHOD_ICONS_AND_COLORS 
} from '../data/multiplicationData';
import { v4 as uuidv4 } from 'uuid';
import { JOURNAL_MONTHS } from '../views/Journal';
import { MultiplicationMethodDetailModal } from './MultiplicationMethodDetailModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded?: () => void;
}

export function MultiplicationGuideModal({ isOpen, onClose, onNoteAdded }: Props) {
  const currentMonthNumber = new Date().getMonth() + 1; // 1-12
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNumber);
  const [filterOwnedOnly, setFilterOwnedOnly] = useState<boolean>(true);
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [selectedMethodDetail, setSelectedMethodDetail] = useState<MultiplicationMethod | null>(null);
  const [methodDetailPlantContext, setMethodDetailPlantContext] = useState<{
    plantName: string;
    instructions?: {
      harvest: string;
      substrate: string;
      care: string;
      followUp: string;
    };
    category?: string;
  } | null>(null);

  // Quick Action / Log Note State
  const [activeLoggingItem, setActiveLoggingItem] = useState<EnrichedMultiplicationItem | null>(null);
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logTitle, setLogTitle] = useState<string>('');
  const [logContent, setLogContent] = useState<string>('');
  const [logCount, setLogCount] = useState<string>('3');
  const [createFollowUpTask, setCreateFollowUpTask] = useState<boolean>(true);
  const [isSubmittingLog, setIsSubmittingLog] = useState<boolean>(false);
  const [logFeedback, setLogFeedback] = useState<string | null>(null);

  // Data fetching: seedlings (Mes Semis), trees (Mon Verger), encyclopedia (Catalogue des plantes), journal
  const { data: rawSeedlings } = useFirebaseData<Seedling>('seedlings');
  const { data: rawTrees } = useFirebaseData<Tree>('trees');
  const { data: rawEncyclopedia } = useFirebaseData<EncyclopediaEntry>('encyclopedia');
  const { data: rawJournal } = useFirebaseData<JournalEntry>('journal');

  const enrichedItems = useMemo(() => {
    return matchUserPlantsWithMultiplications(
      rawSeedlings || [],
      rawTrees || [],
      rawEncyclopedia || [],
      rawJournal || [],
      selectedMonth
    );
  }, [rawSeedlings, rawTrees, rawEncyclopedia, rawJournal, selectedMonth]);

  // Count items present in garden for the selected month
  const ownedOptimalCount = useMemo(() => {
    return enrichedItems.filter(item => item.isOwned && item.periodStatus === 'optimal').length;
  }, [enrichedItems]);

  const ownedPossibleCount = useMemo(() => {
    return enrichedItems.filter(item => item.isOwned && item.periodStatus === 'possible').length;
  }, [enrichedItems]);

  // Total user plants matching any rule
  const totalOwnedMatchedCount = useMemo(() => {
    return enrichedItems.filter(item => item.isOwned).length;
  }, [enrichedItems]);

  // Filtering
  const filteredItems = useMemo(() => {
    return enrichedItems.filter(item => {
      // Owned filter
      if (filterOwnedOnly && !item.isOwned) {
        return false;
      }

      // Method filter
      if (methodFilter !== 'all' && item.rule.method !== methodFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.rule.commonName.toLowerCase().includes(q);
        const matchesMethod = item.rule.methodLabel.toLowerCase().includes(q);
        const matchesOwned = item.ownedPlants.some(p => p.name.toLowerCase().includes(q));
        if (!matchesName && !matchesMethod && !matchesOwned) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // 1. Optimal period first, then possible, then out of season
      const order = { optimal: 0, possible: 1, out_of_season: 2 };
      const statusDiff = order[a.periodStatus] - order[b.periodStatus];
      if (statusDiff !== 0) return statusDiff;

      // 2. Owned first
      if (a.isOwned !== b.isOwned) return a.isOwned ? -1 : 1;

      // 3. Alphabetical
      return a.rule.commonName.localeCompare(b.rule.commonName);
    });
  }, [enrichedItems, filterOwnedOnly, methodFilter, searchQuery]);

  if (!isOpen) return null;

  const currentMonthLabel = JOURNAL_MONTHS.find(m => m.value === selectedMonth.toString())?.label || 'ce mois-ci';

  // Handler to open the quick-log form
  const handleStartLog = (item: EnrichedMultiplicationItem) => {
    setActiveLoggingItem(item);
    setLogDate(new Date().toISOString().split('T')[0]);
    const ownedName = item.ownedPlants.length > 0 ? ` (${item.ownedPlants[0].name})` : '';
    setLogTitle(`Multiplication : ${item.rule.methodLabel} de ${item.rule.commonName}${ownedName}`);
    setLogContent(
      `Réalisation de ${logCount} ${item.rule.methodLabel.toLowerCase()} de ${item.rule.commonName}.\n` +
      `Substrat : ${item.rule.instructions.substrate}\n` +
      `Conseil appliqué : ${item.rule.instructions.care}`
    );
    setLogFeedback(null);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoggingItem || isSubmittingLog) return;

    setIsSubmittingLog(true);
    setLogFeedback(null);

    try {
      const entryId = uuidv4();
      const tags = ['✂️ Multiplications & Boutures'];
      if (activeLoggingItem.rule.category === 'fruitier') tags.push('🌳 Verger');
      if (activeLoggingItem.rule.category === 'aromatique') tags.push('🌿 Aromatiques');

      // 1. Add Journal Entry
      await fb.add('journal', {
        id: entryId,
        date: logDate,
        title: logTitle.trim(),
        content: logContent.trim(),
        tags,
        isDeleted: false,
        successStatus: 'none'
      });

      // 2. Add Follow-up Task if requested
      if (createFollowUpTask) {
        const weeks = activeLoggingItem.rule.rootingTimeWeeks || 4;
        const dueDate = new Date(logDate);
        dueDate.setDate(dueDate.getDate() + weeks * 7);

        await fb.add('tasks', {
          id: uuidv4(),
          title: `Vérifier enracinement : ${activeLoggingItem.rule.commonName} (${activeLoggingItem.rule.methodLabel})`,
          description: `Vérifier la reprise et l'apparition de nouvelles pousses ou racines pour les ${logCount} multiplications réalisées le ${logDate}. ${activeLoggingItem.rule.instructions.followUp}`,
          dateCreated: new Date().toISOString(),
          dateDue: dueDate.toISOString().split('T')[0],
          isCompleted: false,
          priority: 'medium',
          type: 'automatic',
          isDeleted: false
        });
      }

      setLogFeedback('✓ Observation et rappel de suivi enregistrés dans votre Journal !');
      setTimeout(() => {
        setActiveLoggingItem(null);
        setLogFeedback(null);
        onNoteAdded?.();
      }, 1500);
    } catch (err) {
      console.error('Failed to log multiplication note:', err);
      setLogFeedback('Erreur lors de l\'enregistrement.');
    } finally {
      setIsSubmittingLog(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-stone-200/90 w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-4 sm:p-5 flex items-start justify-between gap-4 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-200 shadow-inner shrink-0">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-serif font-bold text-white tracking-tight">
                  Guide des Multiplications du Potager & Verger
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                  Votre Bible personnalisée
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Boutures, marcottes et divisions synchronisées avec vos variétés en place et vos notes passées
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Fermer le guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="bg-stone-50 border-b border-stone-200/80 p-3 sm:px-5 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Calendrier mensuel :</span>
            </span>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-500">Mois sélectionné :</span>
              <strong className="text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md font-semibold">
                {currentMonthLabel} {selectedMonth === currentMonthNumber && '(en cours)'}
              </strong>
            </div>
          </div>

          {/* 12 Months Pills */}
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
            {JOURNAL_MONTHS.map(m => {
              const monthNum = parseInt(m.value, 10);
              const isSelected = selectedMonth === monthNum;
              const isCurrent = currentMonthNumber === monthNum;

              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSelectedMonth(monthNum)}
                  className={`px-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all relative cursor-pointer text-center ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-xs font-bold scale-102 ring-2 ring-emerald-500/30'
                      : isCurrent
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 font-bold'
                        : 'bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-100'
                  }`}
                >
                  <span className="truncate block">{m.label.slice(0, 3)}</span>
                  {isCurrent && !isSelected && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-600"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-3 sm:px-5 bg-white border-b border-stone-200/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Owned vs All Switcher */}
            <div className="inline-flex rounded-xl border border-stone-200 p-0.5 bg-stone-100">
              <button
                type="button"
                onClick={() => setFilterOwnedOnly(true)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterOwnedOnly
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mes plantes ({totalOwnedMatchedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterOwnedOnly(false)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  !filterOwnedOnly
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-stone-500" />
                <span>Tout le catalogue ({enrichedItems.length})</span>
              </button>
            </div>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium outline-none cursor-pointer hover:bg-stone-100"
            >
              <option value="all">Toutes les techniques</option>
              <option value="bouture_bois_sec">🪵 Bouture bois sec (hiver)</option>
              <option value="bouture_semi_aoutee">🌿 Bouture semi-aoûtée (été)</option>
              <option value="division_touffe">🪴 Division de souche</option>
              <option value="marcottage_couche">➰ Marcottage</option>
              <option value="stolons_drageons">🍓 Stolons & Drageons</option>
              <option value="repiquage_gourmands">🍅 Bouture gourmands</option>
            </select>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Chercher (figuier, romarin, division...)"
              className="w-full px-3 py-1 pl-8 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-xs"
            />
            <Scissors className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Summary Pill for Selected Month */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-4 py-2 flex items-center justify-between text-xs text-emerald-950 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              En <strong>{currentMonthLabel}</strong> : 
              {ownedOptimalCount > 0 ? (
                <span className="font-semibold text-emerald-800 ml-1">
                  {ownedOptimalCount} plante{ownedOptimalCount > 1 ? 's' : ''} de votre jardin {ownedOptimalCount > 1 ? 'sont' : 'est'} en <strong>période optimale</strong>
                </span>
              ) : (
                <span className="text-stone-600 ml-1">Aucune plante en période optimale ce mois-ci</span>
              )}
              {ownedPossibleCount > 0 && (
                <span className="text-stone-600 ml-1">
                  ({ownedPossibleCount} possible{ownedPossibleCount > 1 ? 's' : ''})
                </span>
              )}
            </span>
          </div>

          <span className="text-[11px] text-stone-500 font-medium hidden sm:inline">
            {filteredItems.length} fiche{filteredItems.length > 1 ? 's' : ''} affichée{filteredItems.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Cards Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5 bg-stone-100/50">
          {filteredItems.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-stone-200 border-dashed text-center space-y-2">
              <Scissors className="w-8 h-8 text-stone-300 mx-auto" />
              <h3 className="text-sm font-bold text-stone-800">Aucune multiplication trouvée</h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                {filterOwnedOnly
                  ? "Aucune plante actuellement dans vos semis ou verger ne correspond à ce filtre pour ce mois. Décochez « Mes plantes uniquement » pour explorer tout le catalogue."
                  : "Essayez de modifier votre recherche ou le mois sélectionné."}
              </p>
              {filterOwnedOnly && (
                <button
                  type="button"
                  onClick={() => setFilterOwnedOnly(false)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Voir toutes les fiches du catalogue
                </button>
              )}
            </div>
          ) : (
            filteredItems.map(item => {
              const methodConfig = METHOD_ICONS_AND_COLORS[item.rule.method];
              const isExpanded = expandedCardId === item.rule.id;
              const hasPastHistory = item.journalHistory.length > 0;

              return (
                <div
                  key={item.rule.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
                    item.periodStatus === 'optimal'
                      ? 'border-emerald-300 ring-1 ring-emerald-500/20'
                      : item.periodStatus === 'possible'
                        ? 'border-amber-200'
                        : 'border-stone-200/80 opacity-90'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-3.5 sm:p-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-[240px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg leading-none">{methodConfig.icon}</span>
                        <h3 className="font-serif font-bold text-stone-900 text-base">
                          {item.rule.commonName}
                        </h3>

                        {/* Period Badge */}
                        {item.periodStatus === 'optimal' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            Période optimale ({currentMonthLabel})
                          </span>
                        )}
                        {item.periodStatus === 'possible' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            Période possible
                          </span>
                        )}
                        {item.periodStatus === 'out_of_season' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-500">
                            Hors saison (optimal : {item.rule.optimalMonths.map(m => JOURNAL_MONTHS.find(jm => jm.value === m.toString())?.label.slice(0, 3)).join(', ')})
                          </span>
                        )}
                      </div>

                      {/* Method & Category Badges */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setMethodDetailPlantContext({
                              plantName: item.rule.commonName,
                              instructions: item.rule.instructions,
                              category: item.rule.category
                            });
                            setSelectedMethodDetail(item.rule.method);
                          }}
                          className={`px-2 py-0.5 rounded-lg border font-semibold ${methodConfig.bg} ${methodConfig.text} ${methodConfig.border} hover:shadow-xs hover:ring-2 hover:ring-emerald-400/50 transition-all cursor-pointer flex items-center gap-1 group`}
                          title={`Cliquer pour voir la fiche détaillée de la méthode : ${item.rule.methodLabel}`}
                        >
                          <span>{item.rule.methodLabel}</span>
                          <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </button>

                        <span className="text-stone-400">•</span>
                        <span className="text-stone-500 text-[11px]">
                          Difficulté : <strong className="text-stone-700">{item.rule.difficultyLabel}</strong>
                        </span>

                        <span className="text-stone-400">•</span>
                        <span className="text-stone-500 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>Racines en ~{item.rule.rootingTimeWeeks} sem.</span>
                        </span>
                      </div>

                      {/* Matching Plants In User Garden */}
                      {item.isOwned ? (
                        <div className="pt-1 flex items-center gap-1.5 text-xs text-emerald-900 bg-emerald-50/80 px-2.5 py-1 rounded-xl border border-emerald-200/80 flex-wrap">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-semibold">Dans votre jardin :</span>
                          {item.ownedPlants.map(p => (
                            <span 
                              key={p.id}
                              className="px-1.5 py-0.2 rounded-md bg-white border border-emerald-200 text-stone-800 text-[11px] font-medium flex items-center gap-1"
                              title={p.type === 'tree' ? 'Présent dans Mon Verger' : p.type === 'catalog' ? 'Présent dans le Catalogue des Plantes' : 'Présent dans Mes Semis'}
                            >
                              <span>{p.type === 'tree' ? '🌳' : p.type === 'catalog' ? '📖' : '🌱'}</span>
                              <span>{p.name}</span>
                              <span className="text-[9px] text-stone-400 font-normal">({p.locationLabel || 'Inventaire'})</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-stone-400 italic">
                          Plante non encore répertoriée dans votre inventaire.
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartLog(item)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer hover:shadow-emerald-600/20"
                        title="Enregistrer cette multiplication dans votre Journal aujourd'hui"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Noter l'action</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedCardId(isExpanded ? null : item.rule.id)}
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition-colors cursor-pointer text-xs flex items-center gap-1 font-medium"
                        title={isExpanded ? 'Réduire' : 'Voir les conseils pas-à-pas et vos notes'}
                      >
                        <span className="text-[11px] hidden sm:inline">{isExpanded ? 'Fermer' : 'Détails'}</span>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Quick Summary Line */}
                  <div className="px-3.5 sm:px-4 pb-3 text-xs text-stone-600 border-b border-stone-100">
                    <p>{item.rule.summary}</p>
                  </div>

                  {/* History Preview Bar (Always visible if history exists) */}
                  {hasPastHistory && (
                    <div className="bg-amber-50/50 border-t border-amber-100/80 px-3.5 sm:px-4 py-2 flex items-center justify-between text-xs text-amber-950">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-semibold">
                          Votre expérience : {item.journalHistory.length} essai{item.journalHistory.length > 1 ? 's' : ''} noté{item.journalHistory.length > 1 ? 's' : ''} dans le Journal
                        </span>
                        {item.successCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {item.successCount} réussite{item.successCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {item.failureCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            {item.failureCount} échec{item.failureCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {item.lastActionDate && (
                        <span className="text-[11px] text-stone-500">
                          Dernier essai : {item.lastActionDate}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded Step-by-Step Instructions & Past Notes */}
                  {isExpanded && (
                    <div className="p-4 bg-stone-50/80 border-t border-stone-200 space-y-4 animate-fade-in text-xs">
                      {/* Technical Steps Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">1</span>
                            <span>Prélèvement & Préparation</span>
                          </div>
                          <p className="text-stone-600 leading-relaxed pl-6.5">
                            {item.rule.instructions.harvest}
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">2</span>
                            <span>Substrat & Récipient</span>
                          </div>
                          <p className="text-stone-600 leading-relaxed pl-6.5">
                            {item.rule.instructions.substrate}
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">3</span>
                            <span>Soins & Arrosage</span>
                          </div>
                          <p className="text-stone-600 leading-relaxed pl-6.5">
                            {item.rule.instructions.care}
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">4</span>
                            <span>Suivi & Plantation</span>
                          </div>
                          <p className="text-stone-600 leading-relaxed pl-6.5">
                            {item.rule.instructions.followUp}
                          </p>
                        </div>
                      </div>

                      {/* Detailed Past Journal Entries For This Plant */}
                      {hasPastHistory ? (
                        <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 space-y-2.5">
                          <h4 className="font-bold text-amber-950 flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-amber-600" />
                            <span>Extraits de votre Journal pour cette plante :</span>
                          </h4>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {item.journalHistory.map(entry => (
                              <div 
                                key={entry.id}
                                className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/70 space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-stone-800">
                                    📅 {entry.date} {entry.title && `— ${entry.title}`}
                                  </span>
                                  {entry.success === true && (
                                    <span className="px-1.5 py-0.2 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Réussite
                                    </span>
                                  )}
                                  {entry.success === false && (
                                    <span className="px-1.5 py-0.2 rounded-full font-bold text-[10px] bg-red-100 text-red-800 flex items-center gap-1">
                                      <XCircle className="w-3 h-3" /> Échec
                                    </span>
                                  )}
                                </div>
                                <p className="text-stone-700 whitespace-pre-wrap leading-relaxed text-xs">
                                  {entry.content}
                                </p>
                                {entry.photos && entry.photos.length > 0 && (
                                  <div className="flex gap-1.5 pt-1 overflow-x-auto">
                                    {entry.photos.map((ph, idx) => (
                                      <img 
                                        key={idx} 
                                        src={ph} 
                                        alt="Bouture" 
                                        className="w-12 h-12 object-cover rounded-lg border border-stone-200 shrink-0" 
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-xl border border-stone-200 text-stone-500 text-center italic">
                          Aucun antécédent noté pour le moment dans votre Journal pour cette plante. Dès que vous enregistrez un essai, il apparaîtra ici !
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-stone-200 p-3 sm:px-5 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-500">
            Conseil : Échelonnez vos boutures et notez vos réussites pour consolider votre propre Bible au fil des ans.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
          >
            Fermer le guide
          </button>
        </div>
      </div>

      {/* Quick Action Modal: Record multiplication in Journal */}
      {activeLoggingItem && (
        <div 
          className="fixed inset-0 z-60 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in"
          onClick={() => setActiveLoggingItem(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-sm">
                  Noter une multiplication dans le Journal
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setActiveLoggingItem(null)} 
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="p-4 space-y-3 text-xs">
              {logFeedback && (
                <div className={`p-2.5 rounded-xl font-semibold flex items-center gap-2 ${
                  logFeedback.startsWith('✓') 
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                    : 'bg-red-100 text-red-900'
                }`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>{logFeedback}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Date de réalisation :
                  </label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Nombre réalisé :
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={logCount}
                    onChange={e => setLogCount(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Titre de la note :
                </label>
                <input
                  type="text"
                  required
                  value={logTitle}
                  onChange={e => setLogTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Observation / Détails de culture :
                </label>
                <textarea
                  rows={4}
                  required
                  value={logContent}
                  onChange={e => setLogContent(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 font-medium resize-none leading-relaxed"
                />
              </div>

              {/* Follow-up task toggle */}
              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl space-y-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-purple-900">
                  <input
                    type="checkbox"
                    checked={createFollowUpTask}
                    onChange={e => setCreateFollowUpTask(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Programmer un rappel de suivi automatique</span>
                </label>
                <p className="text-[11px] text-purple-700 pl-6">
                  Une tâche automatique sera ajoutée dans votre calendrier à J+{activeLoggingItem.rule.rootingTimeWeeks * 7} pour vérifier l'enracinement et le rempotage.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setActiveLoggingItem(null)}
                  className="px-3 py-1.5 rounded-lg text-stone-600 hover:bg-stone-100 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLog}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmittingLog ? 'Enregistrement...' : 'Enregistrer dans le Journal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Technical Multiplication Method Detail Modal */}
      <MultiplicationMethodDetailModal
        isOpen={selectedMethodDetail !== null}
        onClose={() => {
          setSelectedMethodDetail(null);
          setMethodDetailPlantContext(null);
        }}
        initialMethod={selectedMethodDetail}
        plantContext={methodDetailPlantContext}
        onStartLog={(method, plantName) => {
          const matchedItem = enrichedItems.find(it => 
            plantName ? it.rule.commonName.toLowerCase() === plantName.toLowerCase() : it.rule.method === method
          );
          if (matchedItem) {
            handleStartLog(matchedItem);
          }
        }}
      />
    </div>
  );
}
