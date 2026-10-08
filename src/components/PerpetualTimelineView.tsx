import React, { useState, useMemo } from 'react';
import { PerpetualTask } from '../db';
import { 
  MONTH_NAMES, 
  PERIOD_LABELS, 
  getPerpetualTaskMonths, 
  formatPerpetualPeriod 
} from './PerpetualTaskModal';
import { 
  CheckCircle2, 
  Edit, 
  Trash2, 
  CalendarPlus, 
  Sparkles, 
  Calendar, 
  Plus, 
  Star,
  ChevronDown,
  ChevronUp,
  Layers,
  Filter,
  Search,
  CalendarRange,
  BookOpen,
  Clock,
  Scissors
} from 'lucide-react';

interface PerpetualTimelineViewProps {
  tasks: (PerpetualTask & {
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
  })[];
  categories: Record<string, { label: string; icon: string; badgeClass: string }>;
  currentMonthIndex: number;
  currentYear: number;
  onEditTask: (task: PerpetualTask) => void;
  onDeleteTask: (task: PerpetualTask) => void;
  onScheduleAsTask: (task: PerpetualTask, targetMonth?: number) => void;
  onNewTask: () => void;
}

const MONTH_ABBR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
];

/**
 * Computes which quinzaines (1.0 = first half of month 1, 1.5 = second half of month 1, etc.)
 * are active and optimal for a perpetual task.
 */
export function getPerpetualTaskQuinzaines(task: PerpetualTask): {
  activeQuinzaines: Set<number>;
  optimalQuinzaines: Set<number>;
} {
  const active = new Set<number>();
  const optimal = new Set<number>();

  const startM = Number(task.month) || 1;
  const startP = task.period || 'mois_entier';
  const endM = task.endMonth ? Number(task.endMonth) : startM;
  const endP = task.endPeriod || (task.endMonth ? 'fin' : startP);
  const coveredMonths = getPerpetualTaskMonths(task);

  coveredMonths.forEach(m => {
    const q1 = m; // 1ère quinzaine (1-15)
    const q2 = m + 0.5; // 2ème quinzaine (16-31)

    // Single month task
    if (startM === endM) {
      if (startP === 'debut') {
        active.add(q1);
      } else if (startP === 'fin') {
        active.add(q2);
      } else if (startP === 'mi') {
        active.add(q1);
        active.add(q2);
      } else {
        // mois_entier
        active.add(q1);
        active.add(q2);
      }
    } else {
      // Multi-month task
      if (m === startM) {
        if (startP === 'debut' || startP === 'mois_entier') {
          active.add(q1);
          active.add(q2);
        } else if (startP === 'mi') {
          active.add(q1);
          active.add(q2);
        } else if (startP === 'fin') {
          active.add(q2);
        }
      } else if (m === endM) {
        if (endP === 'debut') {
          active.add(q1);
        } else if (endP === 'mi') {
          active.add(q1);
        } else {
          // fin or mois_entier
          active.add(q1);
          active.add(q2);
        }
      } else {
        // Intermediate month
        active.add(q1);
        active.add(q2);
      }
    }
  });

  // Optimal Period
  if (task.optimalMonth && task.optimalMonth >= 1 && task.optimalMonth <= 12) {
    const optM = Number(task.optimalMonth);
    const optP = task.optimalPeriod || 'mois_entier';
    const optQ1 = optM;
    const optQ2 = optM + 0.5;

    if (optP === 'debut') {
      optimal.add(optQ1);
      active.add(optQ1);
    } else if (optP === 'fin') {
      optimal.add(optQ2);
      active.add(optQ2);
    } else {
      // mi or mois_entier
      optimal.add(optQ1);
      optimal.add(optQ2);
      active.add(optQ1);
      active.add(optQ2);
    }
  }

  return { activeQuinzaines: active, optimalQuinzaines: optimal };
}

export function PerpetualTimelineView({
  tasks,
  categories,
  currentMonthIndex,
  currentYear,
  onEditTask,
  onDeleteTask,
  onScheduleAsTask,
  onNewTask
}: PerpetualTimelineViewProps) {
  const [groupByCategory, setGroupByCategory] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchPlant = t.plant?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchPlant && !matchDesc) return false;
      }
      return true;
    }).sort((a, b) => {
      // Sort by start month, then by period
      const aMonth = Number(a.optimalMonth || a.month);
      const bMonth = Number(b.optimalMonth || b.month);
      if (aMonth !== bMonth) return aMonth - bMonth;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [tasks, categoryFilter, search]);

  // Group by category if requested
  const groupedTasks = useMemo(() => {
    if (!groupByCategory) {
      return [{ categoryKey: 'all', title: 'Tous les gestes', tasks: filteredTasks }];
    }

    const groups: { categoryKey: string; title: string; icon: string; tasks: typeof tasks }[] = [];
    const map = new Map<string, typeof tasks>();

    filteredTasks.forEach(t => {
      const cat = t.category || 'other';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(t);
    });

    Object.keys(categories).forEach(catKey => {
      const catTasks = map.get(catKey);
      if (catTasks && catTasks.length > 0) {
        groups.push({
          categoryKey: catKey,
          title: categories[catKey]?.label || catKey,
          icon: categories[catKey]?.icon || '🌱',
          tasks: catTasks
        });
      }
    });

    // Any remaining categories
    map.forEach((catTasks, catKey) => {
      if (!groups.some(g => g.categoryKey === catKey)) {
        groups.push({
          categoryKey: catKey,
          title: categories[catKey]?.label || catKey,
          icon: categories[catKey]?.icon || '🌱',
          tasks: catTasks
        });
      }
    });

    return groups;
  }, [filteredTasks, groupByCategory, categories]);

  // Render the interactive 12-month Quinzaine Timeline for a task
  const renderTaskTimeline = (task: PerpetualTask) => {
    const { activeQuinzaines, optimalQuinzaines } = getPerpetualTaskQuinzaines(task);
    const cat = categories[task.category] || { icon: '🌱', label: task.category };

    return (
      <div className="flex-1 flex h-8 bg-stone-100/70 rounded-xl p-0.5 border border-stone-200/60 overflow-hidden shadow-2xs">
        {MONTH_NAMES.map((monthName, mIdx) => {
          const mNum = mIdx + 1; // 1 to 12
          const q1 = mNum; // 1ère quinzaine (1-15)
          const q2 = mNum + 0.5; // 2ème quinzaine (16-31)

          const isQ1Active = activeQuinzaines.has(q1);
          const isQ2Active = activeQuinzaines.has(q2);
          const isQ1Optimal = optimalQuinzaines.has(q1);
          const isQ2Optimal = optimalQuinzaines.has(q2);
          const isCurrentMonth = mNum === currentMonthIndex;

          return (
            <div 
              key={mIdx} 
              className={`flex-1 flex border-r border-stone-200/50 last:border-r-0 relative group/month ${
                isCurrentMonth ? 'bg-purple-50/30' : ''
              }`}
            >
              {/* 1ère Quinzaine (1-15) */}
              <div
                title={`${monthName} (1-15 ${MONTH_ABBR[mIdx]}) : ${
                  isQ1Optimal ? '⭐ Moment idéal' : isQ1Active ? 'Période recommandée' : 'Hors période'
                }`}
                onClick={() => onEditTask(task)}
                className={`flex-1 h-full transition-all duration-150 relative flex items-center justify-center cursor-pointer border-r border-stone-200/30 ${
                  isQ1Optimal
                    ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold shadow-2xs'
                    : isQ1Active
                      ? 'bg-purple-600 hover:bg-purple-700 text-white font-medium'
                      : 'hover:bg-purple-100/40 text-transparent hover:text-stone-300'
                }`}
              >
                {isQ1Optimal ? (
                  <Star className="w-2.5 h-2.5 fill-amber-950 text-amber-950" />
                ) : (
                  <span className="text-[9px] select-none opacity-0 group-hover/month:opacity-80 transition-opacity">1</span>
                )}
              </div>

              {/* 2ème Quinzaine (16-31) */}
              <div
                title={`${monthName} (16-31 ${MONTH_ABBR[mIdx]}) : ${
                  isQ2Optimal ? '⭐ Moment idéal' : isQ2Active ? 'Période recommandée' : 'Hors période'
                }`}
                onClick={() => onEditTask(task)}
                className={`flex-1 h-full transition-all duration-150 relative flex items-center justify-center cursor-pointer ${
                  isQ2Optimal
                    ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold shadow-2xs'
                    : isQ2Active
                      ? 'bg-purple-600 hover:bg-purple-700 text-white font-medium'
                      : 'hover:bg-purple-100/40 text-transparent hover:text-stone-300'
                }`}
              >
                {isQ2Optimal ? (
                  <Star className="w-2.5 h-2.5 fill-amber-950 text-amber-950" />
                ) : (
                  <span className="text-[9px] select-none opacity-0 group-hover/month:opacity-80 transition-opacity">2</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Legend & Controls Bar */}
      <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-stone-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Legend */}
          <div className="flex items-center gap-3 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200/60 font-medium text-stone-700">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-purple-600 inline-block shadow-2xs"></span>
              <span>Période recommandée</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-400 inline-flex items-center justify-center shadow-2xs">
                <Star className="w-2.5 h-2.5 fill-amber-950 text-amber-950" />
              </span>
              <span className="font-semibold text-amber-900">Moment idéal (⭐)</span>
            </div>
            <div className="flex items-center gap-1 text-stone-400 hidden sm:flex">
              <span className="font-mono text-[10px]">1 = 1-15 / 2 = 16-31</span>
            </div>
          </div>

          {/* Grouping Toggle */}
          <button
            type="button"
            onClick={() => setGroupByCategory(!groupByCategory)}
            className={`px-3 py-1.5 rounded-xl border font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              groupByCategory
                ? 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>{groupByCategory ? 'Groupé par catégorie' : 'Vue liste continue'}</span>
          </button>
        </div>

        {/* Quick filter by category */}
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-700 outline-none text-xs"
          >
            <option value="all">Toutes catégories ({tasks.length})</option>
            {Object.entries(categories).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Gantt Timeline Matrix (Matching HarvestCalendar view) */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden flex flex-col">
        <div className="overflow-auto max-h-[calc(100vh-230px)] min-h-[420px] scroll-smooth custom-scrollbar">
          <div className="min-w-[920px] px-4 sm:px-6 pb-6">
            {/* Sticky Header with 12 Months & 24 Quinzaines Subdivisions */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md pt-4 pb-3 mb-2 border-b border-stone-200 px-2 flex items-end gap-3 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
              {/* Left Column Header */}
              <div className="w-64 pr-2 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Action & Végétal
                </span>
                <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
                  {filteredTasks.length} action{filteredTasks.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* 12 Months with 24 Quinzaines Header */}
              <div className="flex-1 flex gap-0.5">
                {MONTH_ABBR.map((m, idx) => {
                  const mNum = idx + 1;
                  const isCurrent = mNum === currentMonthIndex;
                  return (
                    <div 
                      key={idx} 
                      className={`flex-1 flex flex-col items-center py-0.5 rounded-lg transition-colors ${
                        isCurrent ? 'bg-purple-100/80 ring-1 ring-purple-300' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider ${
                          isCurrent ? 'text-purple-950 font-extrabold' : 'text-stone-800'
                        }`}>
                          {m}
                        </span>
                        {isCurrent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
                        )}
                      </div>
                      <div className="w-full flex text-[9px] font-mono text-stone-500 border-t border-stone-200/80 pt-0.5">
                        <span className="flex-1 text-center font-medium">1-15</span>
                        <span className="flex-1 text-center font-medium">16-31</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right actions spacer */}
              <div className="w-24 shrink-0 text-right pr-2">
                <span className="text-[10px] text-stone-400 font-semibold uppercase">Planifier</span>
              </div>
            </div>

            {/* Matrix Body: Rows of Perpetual Tasks */}
            {filteredTasks.length === 0 ? (
              <div className="text-center py-16 text-stone-400 space-y-2">
                <CalendarRange className="w-10 h-10 mx-auto text-stone-300" />
                <p className="font-medium text-stone-600">Aucun geste perpétuel ne correspond à ce filtre.</p>
                <button
                  type="button"
                  onClick={onNewTask}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Ajouter un geste perpétuel
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedTasks.map(group => (
                  <div key={group.categoryKey} className="space-y-1">
                    {/* Category Group Header if grouped */}
                    {groupByCategory && group.categoryKey !== 'all' && (
                      <div className="flex items-center gap-2 pt-2.5 pb-1 px-2 border-b border-stone-100 text-xs font-bold text-stone-700">
                        <span className="text-sm">{(group as any).icon}</span>
                        <span>{group.title}</span>
                        <span className="text-[10px] font-normal text-stone-400">({group.tasks.length})</span>
                      </div>
                    )}

                    <div className="divide-y divide-stone-100">
                      {group.tasks.map(task => {
                        const cat = categories[task.category] || { icon: '🌱', label: task.category };
                        const periodInfo = formatPerpetualPeriod(task);
                        const isExpanded = !!expandedTaskIds[task.id];
                        const hasTechSteps = !!task.instructions;

                        return (
                          <div key={task.id} className="transition-colors group hover:bg-stone-50/70 rounded-xl">
                            <div className="flex items-center py-2.5 px-2 gap-3">
                              {/* Left Column: Task Info */}
                              <div 
                                className="w-64 pr-2 cursor-pointer"
                                onClick={() => toggleExpand(task.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0 shadow-2xs font-semibold text-xs">
                                    {cat.icon || '🌱'}
                                  </div>
                                  <div className="truncate flex-1">
                                    <div className="font-semibold text-stone-900 text-xs truncate group-hover:text-purple-700 transition-colors flex items-center gap-1.5">
                                      <span className="truncate">{task.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5 truncate">
                                      {task.plant && (
                                        <span className="font-medium text-stone-700 truncate">
                                          {task.plant}
                                        </span>
                                      )}
                                      {task.plant && <span className="text-stone-300">•</span>}
                                      <span className="text-[10px] text-stone-400 truncate" title={periodInfo.summary}>
                                        {periodInfo.summary}
                                      </span>
                                    </div>
                                    {periodInfo.optimalText && (
                                      <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold mt-0.5">
                                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500 shrink-0" />
                                        <span className="truncate">Idéal : {periodInfo.optimalText}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Center Column: 12-Month Gantt Quinzaine Timeline */}
                              {renderTaskTimeline(task)}

                              {/* Right Column: Actions (Schedule in Tasks, Details, Edit, Delete) */}
                              <div className="w-24 shrink-0 flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onScheduleAsTask(task);
                                  }}
                                  className="p-1.5 text-stone-500 hover:text-purple-700 hover:bg-purple-100/70 rounded-lg transition-colors cursor-pointer"
                                  title="Planifier cette action dans vos tâches pour cette année"
                                >
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(task.id)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isExpanded ? 'bg-purple-100 text-purple-700 font-bold' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                                  }`}
                                  title={isExpanded ? 'Masquer les détails' : 'Afficher les consignes & détails'}
                                >
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditTask(task);
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                                  title="Modifier ce geste"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTask(task);
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                  title="Supprimer ce geste"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Inline Expandable Details Box */}
                            {isExpanded && (
                              <div className="mx-2 mb-3 p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-3 text-xs animate-fade-in">
                                {task.description && (
                                  <p className="text-stone-700 leading-relaxed whitespace-pre-wrap">
                                    {task.description}
                                  </p>
                                )}

                                {/* Technical multiplication steps */}
                                {hasTechSteps && task.instructions && (
                                  <div className="space-y-2 pt-1 border-t border-stone-200/60">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-stone-800">
                                      <span className="flex items-center gap-1.5">
                                        <Scissors className="w-3.5 h-3.5 text-teal-600" />
                                        <span>Guide pas-à-pas de multiplication :</span>
                                      </span>
                                      {task.rootingTimeWeeks && (
                                        <span className="text-stone-500 font-normal flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-stone-400" />
                                          <span>Enracinement : ~{task.rootingTimeWeeks} semaines</span>
                                        </span>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                      {task.instructions.harvest && (
                                        <div className="p-2 bg-white rounded-lg border border-stone-200/70">
                                          <strong className="text-stone-800 block mb-0.5">1. Prélèvement :</strong>
                                          <p className="text-stone-600 leading-relaxed">{task.instructions.harvest}</p>
                                        </div>
                                      )}
                                      {task.instructions.substrate && (
                                        <div className="p-2 bg-white rounded-lg border border-stone-200/70">
                                          <strong className="text-stone-800 block mb-0.5">2. Substrat & Godet :</strong>
                                          <p className="text-stone-600 leading-relaxed">{task.instructions.substrate}</p>
                                        </div>
                                      )}
                                      {task.instructions.care && (
                                        <div className="p-2 bg-white rounded-lg border border-stone-200/70">
                                          <strong className="text-stone-800 block mb-0.5">3. Soins & Humidité :</strong>
                                          <p className="text-stone-600 leading-relaxed">{task.instructions.care}</p>
                                        </div>
                                      )}
                                      {task.instructions.followUp && (
                                        <div className="p-2 bg-white rounded-lg border border-stone-200/70">
                                          <strong className="text-stone-800 block mb-0.5">4. Repiquage :</strong>
                                          <p className="text-stone-600 leading-relaxed">{task.instructions.followUp}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Historical Notes from Journal */}
                                {task.journalHistory && task.journalHistory.length > 0 && (
                                  <div className="pt-2 border-t border-stone-200/60">
                                    <div className="flex items-center gap-2 mb-1.5 text-[11px] font-bold text-amber-950">
                                      <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Vos essais notés dans le Journal ({task.journalHistory.length})</span>
                                      {task.successCount && task.successCount > 0 && (
                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                          {task.successCount} réussite{task.successCount > 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                      {task.journalHistory.slice(0, 3).map((entry: any) => (
                                        <div key={entry.id} className="p-2 bg-white rounded-lg border border-stone-200/70 text-[11px]">
                                          <span className="font-semibold text-stone-700">📅 {entry.date} : </span>
                                          <span className="text-stone-600">{entry.content}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
