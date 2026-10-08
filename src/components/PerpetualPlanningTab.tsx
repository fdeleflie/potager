import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarClock, Plus, Search, Filter, Trash2, Edit, Check, AlertCircle, Sparkles, 
  ArrowRight, CalendarPlus, CheckCircle2, ChevronRight, Image as ImageIcon, X,
  LayoutGrid, ListChecks, CalendarRange, Star, RefreshCw, Scissors, BookOpen,
  ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import { PerpetualTask, Task, Seedling, Tree, EncyclopediaEntry, JournalEntry, ConfigItem } from '../db';
import { fb, useFirebaseData, syncPriorityCollections } from '../hooks/useFirebaseData';
import { 
  MONTH_NAMES, 
  PERIOD_LABELS, 
  PERIOD_SHORT_LABELS,
  usePerpetualCategories, 
  CATEGORY_CONFIG,
  getPerpetualTaskMonths,
  formatPerpetualPeriod
} from './PerpetualTaskModal';
import { ConfirmModal, AlertModal } from './Modals';
import { PerpetualActionsView } from './PerpetualActionsView';
import { PerpetualTimelineView } from './PerpetualTimelineView';
import { AddMultiplicationModal } from './AddMultiplicationModal';
import { BotanicalLibraryModal } from './BotanicalLibraryModal';
import { MultiplicationRule } from '../data/multiplicationData';
import { 
  matchUserPlantsWithMultiplications, 
  detectMisclassifiedMultiplicationTasks,
  EnrichedMultiplicationItem 
} from '../utils/multiplicationMatcher';

interface PerpetualPlanningTabProps {
  currentYear: number;
  currentSeasonId?: string;
  onNewTask: () => void;
  onEditTask: (task: PerpetualTask) => void;
  initialSelectedMonth?: number | 'all';
  initialCategory?: string;
  setCurrentView?: (v: string) => void;
}

const SEASONS_CONFIG = {
  all: { label: 'Toute l\'année (12 mois)', icon: '🗓️', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  spring: { label: 'Printemps', icon: '🌸', months: [3, 4, 5], color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  summer: { label: 'Été', icon: '☀️', months: [6, 7, 8], color: 'bg-amber-50 text-amber-700 border-amber-200' },
  autumn: { label: 'Automne', icon: '🍂', months: [9, 10, 11], color: 'bg-orange-50 text-orange-700 border-orange-200' },
  winter: { label: 'Hiver', icon: '❄️', months: [12, 1, 2], color: 'bg-blue-50 text-blue-700 border-blue-200' }
};

export function PerpetualPlanningTab({
  currentYear,
  currentSeasonId,
  onNewTask,
  onEditTask,
  initialSelectedMonth = 'all',
  initialCategory,
  setCurrentView
}: PerpetualPlanningTabProps) {
  const { data: rawPerpetualTasks, error } = useFirebaseData<PerpetualTask>('perpetualTasks');
  const { data: rawSeedlings } = useFirebaseData<Seedling>('seedlings');
  const { data: rawTrees } = useFirebaseData<Tree>('trees');
  const { data: rawEncyclopedia } = useFirebaseData<EncyclopediaEntry>('encyclopedia');
  const { data: rawJournal } = useFirebaseData<JournalEntry>('journal');
  const { data: rawConfig } = useFirebaseData<ConfigItem>('config');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [selectedSeason, setSelectedSeason] = useState<keyof typeof SEASONS_CONFIG>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(initialSelectedMonth);
  const [viewMode, setViewMode] = useState<'timeline' | 'cards' | 'actions'>('timeline');
  const [scheduledToast, setScheduledToast] = useState<string | null>(null);
  const [isSyncingPriority, setIsSyncingPriority] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Modals for multiplication integration
  const [isAddMultiplicationOpen, setIsAddMultiplicationOpen] = useState(false);
  const [isBotanicalLibraryOpen, setIsBotanicalLibraryOpen] = useState(false);
  const [initialPlantName, setInitialPlantName] = useState<string | undefined>();
  const [expandedTechTaskIds, setExpandedTechTaskIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  const handlePrioritySync = async () => {
    setIsSyncingPriority(true);
    setSyncToast(null);
    try {
      const res = await syncPriorityCollections();
      if (res.success) {
        setSyncToast(`Journal & Perpétuel synchronisés (${res.syncedCount} entrées à ${res.time})`);
      } else {
        setSyncToast(res.error || 'Erreur de synchro');
      }
    } catch (e: any) {
      setSyncToast(e.message || 'Erreur');
    } finally {
      setIsSyncingPriority(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  };

  const categories = usePerpetualCategories();

  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; task?: PerpetualTask }>({ isOpen: false });
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  const currentMonthIndex = new Date().getMonth() + 1; // 1-12

  // Custom multiplication rules saved by user
  const customRules: MultiplicationRule[] = useMemo(() => {
    return (rawConfig || [])
      .filter(c => c.type === 'custom_multiplication' && c.attributes)
      .map(c => ({
        ...c.attributes,
        customConfigId: c.id
      }));
  }, [rawConfig]);

  // Misclassified tasks in perpetual tasks (bouturage / marcottage but not in category multiplication)
  const misclassifiedTasks = useMemo(() => {
    return detectMisclassifiedMultiplicationTasks(rawPerpetualTasks || []);
  }, [rawPerpetualTasks]);
  const [isReclassifyingTasks, setIsReclassifyingTasks] = useState(false);
  const [reclassifyToast, setReclassifyToast] = useState<string | null>(null);

  const handleReclassifyAll = async () => {
    if (misclassifiedTasks.length === 0 || isReclassifyingTasks) return;
    setIsReclassifyingTasks(true);
    setReclassifyToast(null);
    try {
      let count = 0;
      for (const t of misclassifiedTasks) {
        await fb.update('perpetualTasks', t.id, { category: 'multiplication' });
        count++;
      }
      setReclassifyToast(`✓ ${count} geste(s) de bouturage ou marcottage ont été reclassés avec succès dans la rubrique « Multiplication » !`);
    } catch (e: any) {
      console.error('Erreur reclassement:', e);
      setReclassifyToast('Erreur lors du reclassement des gestes.');
    } finally {
      setIsReclassifyingTasks(false);
      setTimeout(() => setReclassifyToast(null), 5000);
    }
  };

  // Match plants user owns (seedlings, trees, encyclopedia, perpetual tasks) with multiplication rules
  const matchedMultiplications = useMemo(() => {
    return matchUserPlantsWithMultiplications(
      rawSeedlings || [],
      rawTrees || [],
      rawEncyclopedia || [],
      rawJournal || [],
      selectedMonth === 'all' ? currentMonthIndex : Number(selectedMonth),
      customRules,
      rawPerpetualTasks || [],
      rawConfig || []
    ).filter(item => item.isOwned);
  }, [rawSeedlings, rawTrees, rawEncyclopedia, rawJournal, selectedMonth, currentMonthIndex, customRules, rawPerpetualTasks, rawConfig]);

  // Unified allTasks: combines standard perpetual tasks + matched multiplication items
  const allTasks = useMemo(() => {
    const tasks: (PerpetualTask & {
      instructions?: {
        harvest?: string;
        substrate?: string;
        care?: string;
        followUp?: string;
      };
      rootingTimeWeeks?: number;
      multiplicationMethod?: string;
      isCustom?: boolean;
      journalHistory?: any[];
      successCount?: number;
      failureCount?: number;
    })[] = [...(rawPerpetualTasks || []).filter(t => !t.isDeleted)];

    // Integrate matched plant multiplications
    matchedMultiplications.forEach(m => {
      const plantNorm = (m.rule.commonName || '').toLowerCase().trim();
      const alreadyExists = tasks.some(t =>
        t.category === 'multiplication' &&
        ((t.plant && t.plant.toLowerCase().trim() === plantNorm) ||
         (t.title && t.title.toLowerCase().includes(plantNorm)))
      );

      if (!alreadyExists) {
        const firstOpt = m.rule.optimalMonths[0] || m.rule.possibleMonths[0] || 3;
        const lastOpt = m.rule.optimalMonths[m.rule.optimalMonths.length - 1] || firstOpt;

        tasks.push({
          id: m.rule.isCustom ? m.rule.id : `mult_${m.rule.id}`,
          title: `${m.rule.methodLabel} de ${m.rule.commonName}`,
          plant: m.rule.commonName,
          category: 'multiplication',
          month: firstOpt,
          period: 'debut',
          endMonth: lastOpt,
          endPeriod: 'fin',
          optimalMonth: firstOpt,
          optimalPeriod: 'mi',
          description: m.rule.summary,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          isCustom: m.rule.isCustom,
          rootingTimeWeeks: m.rule.rootingTimeWeeks,
          multiplicationMethod: m.rule.methodLabel,
          instructions: m.rule.instructions,
          journalHistory: m.journalHistory,
          successCount: m.successCount,
          failureCount: m.failureCount
        });
      }
    });

    return tasks;
  }, [rawPerpetualTasks, matchedMultiplications]);

  // Detect catalog plants without multiplication methods
  const plantsWithoutRules = useMemo(() => {
    const matchedNames = new Set(
      matchedMultiplications.flatMap(item => item.ownedPlants.map(p => p.name.toLowerCase().trim()))
    );

    const candidates = new Map<string, string>();
    (rawEncyclopedia || []).forEach(e => {
      if (!e.name || typeof e.name !== 'string' || !e.name.trim()) return;
      const trimmed = e.name.trim();
      const cleanName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      const norm = cleanName.toLowerCase();
      const hasMatch = Array.from(matchedNames).some(m => m.includes(norm) || norm.includes(m));
      if (!hasMatch && !candidates.has(norm)) {
        candidates.set(norm, cleanName);
      }
    });

    return Array.from(candidates.values()).slice(0, 5);
  }, [matchedMultiplications, rawEncyclopedia]);

  // Split categories for 2-line display
  const allCategoryEntries = useMemo(() => {
    return Object.entries(categories);
  }, [categories]);

  const { row1Categories, row2Categories } = useMemo(() => {
    const total = allCategoryEntries.length + 1; // +1 for 'all'
    const mid = Math.ceil(total / 2);
    const row1 = allCategoryEntries.slice(0, Math.max(1, mid - 1));
    const row2 = allCategoryEntries.slice(Math.max(1, mid - 1));
    return { row1Categories: row1, row2Categories: row2 };
  }, [allCategoryEntries]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchPlant = t.plant?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchPlant && !matchDesc) return false;
      }

      // Category
      if (selectedCategory !== 'all' && t.category !== selectedCategory) {
        return false;
      }

      const coveredMonths = getPerpetualTaskMonths(t);

      // Month
      if (selectedMonth !== 'all' && !coveredMonths.includes(Number(selectedMonth))) {
        return false;
      }

      // Season
      if (selectedSeason !== 'all') {
        const seasonMonths = SEASONS_CONFIG[selectedSeason].months;
        if (!coveredMonths.some(m => seasonMonths.includes(m))) return false;
      }

      return true;
    });
  }, [allTasks, search, selectedCategory, selectedMonth, selectedSeason]);

  // Group tasks by month (1 to 12)
  const tasksByMonth = useMemo(() => {
    const map: Record<number, typeof allTasks> = {};
    for (let m = 1; m <= 12; m++) {
      map[m] = [];
    }
    filteredTasks.forEach(t => {
      const coveredMonths = getPerpetualTaskMonths(t);
      coveredMonths.forEach(m => {
        if (map[m]) {
          map[m].push(t);
        }
      });
    });
    // Sort tasks in each month by period order
    const periodOrder: Record<string, number> = { debut: 1, mi: 2, fin: 3, mois_entier: 4 };
    for (let m = 1; m <= 12; m++) {
      map[m].sort((a, b) => {
        const aIsOpt = a.optimalMonth === m ? 0 : 1;
        const bIsOpt = b.optimalMonth === m ? 0 : 1;
        if (aIsOpt !== bIsOpt) return aIsOpt - bIsOpt;

        const aPeriod = m === a.endMonth && a.endPeriod ? a.endPeriod : a.period;
        const bPeriod = m === b.endMonth && b.endPeriod ? b.endPeriod : b.period;
        return (periodOrder[aPeriod] || 99) - (periodOrder[bPeriod] || 99);
      });
    }
    return map;
  }, [filteredTasks]);

  // Which months should be displayed?
  const visibleMonths = useMemo(() => {
    if (selectedMonth !== 'all') {
      return [Number(selectedMonth)];
    }
    if (selectedSeason !== 'all') {
      return SEASONS_CONFIG[selectedSeason].months;
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }, [selectedMonth, selectedSeason]);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.task) return;
    try {
      if (confirmDelete.task.id.startsWith('mult_')) {
        // If it's a generated rule from plant matcher, dismiss modal
        setConfirmDelete({ isOpen: false });
        return;
      }
      await fb.update('perpetualTasks', confirmDelete.task.id, { isDeleted: true });
      setConfirmDelete({ isOpen: false });
    } catch (err: any) {
      console.error('Erreur suppression tâche perpétuelle', err);
      setAlertState({
        isOpen: true,
        title: 'Erreur',
        message: 'Impossible de supprimer ce geste.'
      });
    }
  };

  const handleScheduleAsTask = async (task: PerpetualTask, targetMonth?: number) => {
    try {
      const chosenMonth = targetMonth || task.optimalMonth || task.month;
      const monthStr = String(chosenMonth).padStart(2, '0');

      let periodForChosen = task.period;
      if (task.optimalMonth && chosenMonth === task.optimalMonth && task.optimalPeriod) {
        periodForChosen = task.optimalPeriod;
      } else if (task.endMonth && chosenMonth === task.endMonth && task.endPeriod) {
        periodForChosen = task.endPeriod;
      } else if (chosenMonth !== task.month && chosenMonth !== task.endMonth) {
        periodForChosen = 'mi';
      }

      let dayStr = '15';
      if (periodForChosen === 'debut') dayStr = '05';
      else if (periodForChosen === 'fin') dayStr = '25';
      else if (periodForChosen === 'mois_entier') dayStr = '10';

      const dateDue = `${currentYear}-${monthStr}-${dayStr}`;
      const periodInfo = formatPerpetualPeriod(task);
      const descLines = [
        task.description,
        `[Action issue du planning perpétuel]`,
        periodInfo.isMultiMonth ? `Période d'intervention : ${periodInfo.summary}${periodInfo.optimalText ? ` (Moment idéal : ${periodInfo.optimalText})` : ''}` : ''
      ].filter(Boolean);

      await fb.add<any>('tasks', {
        title: task.plant ? `${task.title} (${task.plant})` : task.title,
        description: descLines.join('\n\n'),
        dateCreated: new Date().toISOString().split('T')[0],
        dateDue,
        isCompleted: false,
        priority: task.optimalMonth === chosenMonth ? 'high' : 'medium',
        type: 'manual',
        isDeleted: false,
        seasonId: currentSeasonId
      });

      // Follow-up automatic task for rooting check if multiplication
      if ((task as any).rootingTimeWeeks) {
        const weeks = (task as any).rootingTimeWeeks;
        const checkDate = new Date(dateDue);
        checkDate.setDate(checkDate.getDate() + weeks * 7);

        await fb.add<any>('tasks', {
          title: `Vérifier enracinement : ${task.plant || task.title}`,
          description: `Vérifier la reprise et les racines pour l'action réalisée le ${dateDue}.\n${(task as any).instructions?.followUp || ''}`,
          dateCreated: new Date().toISOString().split('T')[0],
          dateDue: checkDate.toISOString().split('T')[0],
          isCompleted: false,
          priority: 'medium',
          type: 'automatic',
          isDeleted: false,
          seasonId: currentSeasonId
        });
      }

      setScheduledToast(`Action "${task.title}" planifiée pour le ${new Date(dateDue).toLocaleDateString('fr-FR')} !`);
      setTimeout(() => setScheduledToast(null), 4500);
    } catch (err: any) {
      console.error('Erreur planification tâche', err);
      setAlertState({
        isOpen: true,
        title: 'Erreur',
        message: "Impossible de planifier l'action dans les tâches."
      });
    }
  };

  const getSeasonForMonth = (m: number) => {
    if ([12, 1, 2].includes(m)) return { name: 'Hiver', icon: '❄️', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    if ([3, 4, 5].includes(m)) return { name: 'Printemps', icon: '🌸', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    if ([6, 7, 8].includes(m)) return { name: 'Été', icon: '☀️', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { name: 'Automne', icon: '🍂', color: 'text-orange-600 bg-orange-50 border-orange-200' };
  };

  return (
    <div className="space-y-4">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-stone-50 p-4 rounded-2xl border border-purple-200/70 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-serif font-medium text-stone-900 flex items-center gap-2">
              <span>Planning Perpétuel & Multiplications</span>
              <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-sans font-semibold">
                {allTasks.length} {allTasks.length > 1 ? 'gestes & multiplications' : 'geste'}
              </span>
            </h2>
            <p className="text-xs text-stone-600 mt-0.5 max-w-3xl leading-relaxed">
              Consignez vos gestes réussis observés au potager et au verger (tailles, bouturages, semis précoces, divisions, soins) pour anticiper et répéter exactement les mêmes actions chaque année aux dates idéales.
            </p>
          </div>
        </div>

        {/* Action Buttons in Banner */}
        <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
          {/* Open Full Multiplications Calendar */}
          <button
            type="button"
            onClick={() => setCurrentView?.('calendar-multiplications')}
            className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Consulter le calendrier mensuel spécialisé des multiplications (boutures, marcottes)"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Rubrique Multiplications ✂️</span>
          </button>

          {/* Reference Botanical Models Library */}
          <button
            type="button"
            onClick={() => setIsBotanicalLibraryOpen(true)}
            className="px-3 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Consulter et importer des modèles botaniques de référence (figuier, lavande, kiwi...)"
          >
            <BookOpen className="w-3.5 h-3.5 text-teal-600" />
            <span>Modèles de référence</span>
          </button>

          {/* Add Standard Perpetual Task */}
          <button
            type="button"
            onClick={onNewTask}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un geste</span>
          </button>

          {/* Sync */}
          <button
            type="button"
            onClick={handlePrioritySync}
            disabled={isSyncingPriority}
            className="px-2.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80 rounded-xl text-xs font-medium shadow-2xs transition-all flex items-center gap-1 shrink-0 hover:border-purple-300 cursor-pointer"
            title="Synchroniser le planning perpétuel avec Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPriority ? 'animate-spin text-purple-600' : 'text-purple-700'}`} />
            <span className="hidden sm:inline">{isSyncingPriority ? 'Synchro...' : 'Synchro'}</span>
          </button>
        </div>
      </div>

      {/* Detection Banner for misclassified cutting / layering tasks */}
      {misclassifiedTasks.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-2xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <span>Gestes de bouturage & marcottage détectés ({misclassifiedTasks.length})</span>
                </h3>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Certains gestes perpétuels ({misclassifiedTasks.slice(0, 3).map(t => `« ${t.title} »`).join(', ')}{misclassifiedTasks.length > 3 ? '...' : ''}) sont actuellement classés sous d'autres rubriques. Reclassez-les sous la rubrique <strong>« Multiplication »</strong> pour alimenter directement le calendrier mensuel spécialisé.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleReclassifyAll}
                disabled={isReclassifyingTasks}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isReclassifyingTasks ? 'Reclassement...' : 'Reclasser en « Multiplication » en 1 clic'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {reclassifyToast && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reclassifyToast}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setReclassifyToast(null)}
            className="text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {syncToast && (
        <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span>{syncToast}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setSyncToast(null)}
            className="text-stone-400 hover:text-stone-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar: Search, Seasons, Months, Categories & Views */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/70 shadow-xs space-y-3">
        {/* Search & Month Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par geste ou plante (ex: groseillier, bouture, tomate, purin)..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap justify-between sm:justify-end">
            <select
              value={selectedMonth}
              onChange={e => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedMonth(val);
                if (val !== 'all') setSelectedSeason('all');
              }}
              className="text-xs px-3 py-2 border border-stone-200 rounded-xl bg-stone-50 font-medium text-stone-700 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            >
              <option value="all">🗓️ Tous les mois (12)</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name} {idx + 1 === currentMonthIndex ? '(Mois en cours)' : ''}
                </option>
              ))}
            </select>

            {/* View Mode Toggle Switcher */}
            <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-purple-600 text-white shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Frise annuelle matricielle (comme le calendrier des récoltes)"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Frise annuelle</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
                title="Affichage par mois en cartes"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Par mois</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('actions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'actions'
                    ? 'bg-white text-purple-700 shadow-xs font-semibold'
                    : 'text-stone-500 hover:text-purple-700'
                }`}
                title="Affichage optimisé pour la lecture des actions à mener"
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>Actions à mener</span>
              </button>
            </div>
          </div>
        </div>

        {/* Season Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <span className="text-[11px] font-medium text-stone-400 mr-1 shrink-0">Saison :</span>
          {(Object.entries(SEASONS_CONFIG) as [keyof typeof SEASONS_CONFIG, any][]).map(([key, cfg]) => {
            const isSelected = selectedSeason === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedSeason(key);
                  setSelectedMonth('all');
                }}
                className={`px-3 py-1 text-xs font-medium rounded-xl border transition-all shrink-0 flex items-center gap-1 ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Categories (2 Lines) */}
        <div className="space-y-1.5 pt-1 border-t border-stone-100">
          {/* Ligne 1 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
            <span className="text-[11px] font-medium text-stone-400 mr-1 shrink-0">Geste :</span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all shrink-0 flex items-center gap-1 ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-semibold'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <span>✨</span>
              <span>Tous ({allTasks.length})</span>
            </button>

            {row1Categories.map(([key, cfg]) => {
              const isSelected = selectedCategory === key;
              const count = allTasks.filter(t => t.category === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all shrink-0 flex items-center gap-1 ${
                    isSelected
                      ? `${cfg.badgeClass} ring-2 ring-purple-500 font-semibold shadow-2xs`
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  {count > 0 && <span className="text-[9px] opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Ligne 2 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar pl-[52px]">
            {row2Categories.map(([key, cfg]) => {
              const isSelected = selectedCategory === key;
              const count = allTasks.filter(t => t.category === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all shrink-0 flex items-center gap-1 ${
                    isSelected
                      ? `${cfg.badgeClass} ring-2 ring-purple-500 font-semibold shadow-2xs`
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  {count > 0 && <span className="text-[9px] opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Suggestion prompt for plants in catalog without multiplication rules */}
      {plantsWithoutRules.length > 0 && (selectedCategory === 'all' || selectedCategory === 'multiplication') && (
        <div className="bg-stone-50 border border-stone-200 px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs text-stone-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-stone-400">💡</span>
            <span>
              Plantes de votre catalogue sans fiche de multiplication : 
              <strong className="text-stone-900 ml-1">
                {plantsWithoutRules.join(', ')}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setInitialPlantName(plantsWithoutRules[0]);
              setIsAddMultiplicationOpen(true);
            }}
            className="text-teal-800 hover:text-teal-950 font-bold shrink-0 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Définir pour {plantsWithoutRules[0]}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main View Area: Either Timeline, Actions View or Month Cards View */}
      {viewMode === 'timeline' ? (
        <PerpetualTimelineView
          tasks={filteredTasks}
          categories={categories}
          currentMonthIndex={currentMonthIndex}
          currentYear={currentYear}
          onEditTask={onEditTask}
          onDeleteTask={task => setConfirmDelete({ isOpen: true, task })}
          onScheduleAsTask={handleScheduleAsTask}
          onNewTask={onNewTask}
        />
      ) : viewMode === 'actions' ? (
        <PerpetualActionsView
          tasks={filteredTasks}
          categories={categories}
          currentMonthIndex={currentMonthIndex}
          currentYear={currentYear}
          onEditTask={onEditTask}
          onDeleteTask={task => setConfirmDelete({ isOpen: true, task })}
          onScheduleAsTask={handleScheduleAsTask}
          onZoomPhoto={url => setZoomedPhoto(url)}
          onNewTask={onNewTask}
        />
      ) : (
        /* Months Display Grid */
        <div className="space-y-6">
        {visibleMonths.map(monthNum => {
          const monthTasks = tasksByMonth[monthNum] || [];
          const monthName = MONTH_NAMES[monthNum - 1];
          const season = getSeasonForMonth(monthNum);
          const isCurrentMonth = monthNum === currentMonthIndex;

          return (
            <div 
              key={monthNum}
              className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                isCurrentMonth 
                  ? 'border-purple-300 ring-2 ring-purple-100 shadow-md' 
                  : 'border-stone-200/70 shadow-xs'
              }`}
            >
              {/* Month Header */}
              <div className={`p-4 border-b flex items-center justify-between ${
                isCurrentMonth ? 'bg-purple-50/50 border-purple-200/60' : 'bg-stone-50/60 border-stone-200/60'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${
                    isCurrentMonth ? 'bg-purple-600 text-white' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {monthNum}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-bold text-stone-900 text-base">
                        {monthName}
                      </h3>
                      {isCurrentMonth && (
                        <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">
                          Mois en cours
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${season.color}`}>
                        {season.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500 font-medium">
                    {monthTasks.length} {monthTasks.length > 1 ? 'gestes' : 'geste'}
                  </span>
                  <button
                    onClick={onNewTask}
                    className="p-1 text-stone-400 hover:text-purple-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title={`Ajouter un geste pour ${monthName}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Month Gestures List */}
              <div className="p-4">
                {monthTasks.length === 0 ? (
                  <div className="py-6 text-center text-stone-400 text-xs">
                    <p>Aucun geste perpétuel enregistré pour {monthName}.</p>
                    <button
                      onClick={onNewTask}
                      className="mt-2 text-purple-600 hover:text-purple-700 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter un geste pour ce mois</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {monthTasks.map(task => {
                      const catConfig = categories[task.category] || CATEGORY_CONFIG.other;
                      const periodInfo = formatPerpetualPeriod(task);
                      const isOptimalMonth = task.optimalMonth === monthNum;
                      
                      // Determine period label for this specific month
                      let currentMonthTiming = '';
                      if (periodInfo.isMultiMonth) {
                        if (monthNum === task.month) {
                          currentMonthTiming = `Début période (${PERIOD_SHORT_LABELS[task.period] || 'Tout le mois'})`;
                        } else if (monthNum === task.endMonth) {
                          currentMonthTiming = `Fin période (${PERIOD_SHORT_LABELS[task.endPeriod || 'fin'] || 'Fin'})`;
                        } else {
                          currentMonthTiming = 'Période active';
                        }
                      } else {
                        currentMonthTiming = task.period === 'debut' ? 'Début (1-10)' : task.period === 'mi' ? 'Mi-mois (11-20)' : task.period === 'fin' ? 'Fin (21-31)' : 'Tout le mois';
                      }

                      return (
                        <div
                          key={`${monthNum}-${task.id}`}
                          className={`p-3.5 rounded-xl border transition-all hover:shadow-sm flex flex-col justify-between group ${
                            isOptimalMonth 
                              ? 'bg-amber-50/40 hover:bg-white border-amber-300 ring-1 ring-amber-200 shadow-2xs'
                              : 'bg-stone-50/50 hover:bg-white border-stone-200 hover:border-purple-200'
                          }`}
                        >
                          <div>
                            {/* Top Badges */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catConfig.badgeClass}`}>
                                <span>{catConfig.icon}</span>
                                <span className="truncate">{catConfig.label}</span>
                              </span>

                              <div className="flex items-center gap-1 flex-wrap">
                                {isOptimalMonth && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-900 bg-amber-200/80 px-1.5 py-0.5 rounded-md border border-amber-300">
                                    <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                                    <span>Idéal !</span>
                                  </span>
                                )}
                                <span className="text-[10px] font-medium text-stone-500 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                                  {currentMonthTiming}
                                </span>
                              </div>
                            </div>

                            {/* Multi-month span badge */}
                            {periodInfo.isMultiMonth && (
                              <div className="mb-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-purple-800 bg-purple-50/80 border border-purple-200/80">
                                  <CalendarRange className="w-3 h-3 text-purple-600 shrink-0" />
                                  <span>{periodInfo.summary}</span>
                                </span>
                              </div>
                            )}

                            {/* Title & Plant */}
                            <h4 className="text-sm font-semibold text-stone-900 leading-snug">
                              {task.title}
                            </h4>
                            {task.plant && (
                              <p className="text-xs text-purple-700 font-medium mt-0.5">
                                🌿 {task.plant}
                              </p>
                            )}

                            {/* Description / Conseils */}
                            {task.description && (
                              <p className="text-xs text-stone-600 mt-2 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                {task.description}
                              </p>
                            )}

                            {/* Technical multiplication steps toggle if available */}
                            {task.instructions && (
                              <div className="mt-2.5 pt-2 border-t border-stone-100">
                                <button
                                  type="button"
                                  onClick={() => setExpandedTechTaskIds(prev => ({ ...prev, [task.id]: !prev[task.id] }))}
                                  className="w-full flex items-center justify-between text-[11px] font-semibold text-teal-800 hover:text-teal-950 bg-teal-50/60 px-2.5 py-1.5 rounded-lg border border-teal-200/60 transition-colors cursor-pointer"
                                >
                                  <span className="flex items-center gap-1">
                                    <Scissors className="w-3 h-3 text-teal-600" />
                                    <span>Guide technique & étapes pas-à-pas</span>
                                  </span>
                                  {expandedTechTaskIds[task.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>

                                {expandedTechTaskIds[task.id] && (
                                  <div className="mt-2 p-2.5 bg-stone-50 rounded-lg border border-stone-200/80 space-y-1.5 text-[11px] animate-fade-in">
                                    {task.rootingTimeWeeks && (
                                      <div className="text-[10px] text-stone-500 font-medium pb-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-stone-400" />
                                        <span>Temps d'enracinement : ~{task.rootingTimeWeeks} semaines</span>
                                      </div>
                                    )}
                                    {task.instructions.harvest && (
                                      <p><strong className="text-stone-800">1. Prélèvement : </strong>{task.instructions.harvest}</p>
                                    )}
                                    {task.instructions.substrate && (
                                      <p><strong className="text-stone-800">2. Substrat : </strong>{task.instructions.substrate}</p>
                                    )}
                                    {task.instructions.care && (
                                      <p><strong className="text-stone-800">3. Soins : </strong>{task.instructions.care}</p>
                                    )}
                                    {task.instructions.followUp && (
                                      <p><strong className="text-stone-800">4. Repiquage : </strong>{task.instructions.followUp}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Photos */}
                            {task.photos && task.photos.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1">
                                {task.photos.map((ph, idx) => (
                                  <img
                                    key={idx}
                                    src={ph}
                                    alt=""
                                    onClick={() => setZoomedPhoto(ph)}
                                    className="w-12 h-12 object-cover rounded-lg border border-stone-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                                    title="Cliquer pour agrandir"
                                  />
                                ))}
                              </div>
                            )}

                            {/* Validation Source Note Date */}
                            {task.sourceNoteDate && (
                              <div className="mt-2.5 flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50/70 border border-emerald-100 px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="truncate">Validé le {new Date(task.sourceNoteDate).toLocaleDateString('fr-FR')}</span>
                              </div>
                            )}
                          </div>

                          {/* Footer Actions */}
                          <div className="mt-3 pt-2.5 border-t border-stone-200/70 flex items-center justify-between gap-1">
                            <button
                              onClick={() => handleScheduleAsTask(task, monthNum)}
                              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                              title={`Planifier ce geste dans vos tâches pour ${monthName} ${currentYear}`}
                            >
                              <CalendarPlus className="w-3.5 h-3.5 text-purple-600" />
                              <span>Planifier en {currentYear}</span>
                            </button>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onEditTask(task)}
                                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                                title="Modifier ce geste"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ isOpen: true, task })}
                                className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                title="Supprimer ce geste"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Toast Notification */}
      {scheduledToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="text-xs font-medium">{scheduledToast}</span>
          <button 
            type="button"
            onClick={() => setScheduledToast(null)}
            className="text-emerald-200 hover:text-white ml-2 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lightbox / Zoom Photo Modal */}
      {zoomedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setZoomedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img 
              src={zoomedPhoto} 
              alt="" 
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl border border-white/20" 
            />
            <button
              onClick={() => setZoomedPhoto(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-white text-stone-800 rounded-full shadow-md hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false })}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le geste perpétuel"
        message={`Voulez-vous vraiment supprimer le geste "${confirmDelete.task?.title}" du planning perpétuel ?`}
        isDanger={true}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={() => setAlertState({ isOpen: false, title: '', message: '' })}
        title={alertState.title}
        message={alertState.message}
      />

      {/* Add Multiplication Modal (with Catalog Sync) */}
      {isAddMultiplicationOpen && (
        <AddMultiplicationModal
          isOpen={isAddMultiplicationOpen}
          onClose={() => {
            setIsAddMultiplicationOpen(false);
            setInitialPlantName(undefined);
          }}
          existingEncyclopedia={rawEncyclopedia || []}
          existingTrees={rawTrees || []}
          existingSeedlings={rawSeedlings || []}
          initialPlantName={initialPlantName}
        />
      )}

      {/* Botanical Reference Library Modal */}
      {isBotanicalLibraryOpen && (
        <BotanicalLibraryModal
          isOpen={isBotanicalLibraryOpen}
          onClose={() => setIsBotanicalLibraryOpen(false)}
          existingEncyclopedia={rawEncyclopedia || []}
          existingTrees={rawTrees || []}
          existingSeedlings={rawSeedlings || []}
        />
      )}
    </div>
  );
}
