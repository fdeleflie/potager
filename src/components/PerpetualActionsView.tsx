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
  Clock, 
  Calendar, 
  ArrowRight, 
  Plus, 
  Check, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Leaf,
  CalendarRange,
  Star
} from 'lucide-react';

interface PerpetualActionsViewProps {
  tasks: PerpetualTask[];
  categories: Record<string, { label: string; icon: string; badgeClass: string }>;
  currentMonthIndex: number;
  currentYear: number;
  onEditTask: (task: PerpetualTask) => void;
  onDeleteTask: (task: PerpetualTask) => void;
  onScheduleAsTask: (task: PerpetualTask, targetMonth?: number) => void;
  onZoomPhoto: (url: string) => void;
  onNewTask: () => void;
}

export function PerpetualActionsView({
  tasks,
  categories,
  currentMonthIndex,
  currentYear,
  onEditTask,
  onDeleteTask,
  onScheduleAsTask,
  onZoomPhoto,
  onNewTask
}: PerpetualActionsViewProps) {
  const [timingFilter, setTimingFilter] = useState<'all' | 'current_month' | 'next_month'>('all');
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  const today = new Date();
  const currentDay = today.getDate();
  const currentPeriod = currentDay <= 10 ? 'debut' : currentDay <= 20 ? 'mi' : 'fin';
  const nextMonthIndex = (currentMonthIndex % 12) + 1;

  // Counts for timing filters
  const currentMonthTasksCount = useMemo(() => {
    return tasks.filter(t => getPerpetualTaskMonths(t).includes(currentMonthIndex)).length;
  }, [tasks, currentMonthIndex]);

  const nextMonthTasksCount = useMemo(() => {
    return tasks.filter(t => getPerpetualTaskMonths(t).includes(nextMonthIndex)).length;
  }, [tasks, nextMonthIndex]);

  // Group filtered actions by month for visual rhythm
  const groupedByMonth = useMemo(() => {
    const map = new Map<number, PerpetualTask[]>();
    const periodOrder: Record<string, number> = { debut: 1, mi: 2, fin: 3, mois_entier: 4 };

    tasks.forEach(task => {
      const covered = getPerpetualTaskMonths(task);
      covered.forEach(m => {
        if (timingFilter === 'current_month' && m !== currentMonthIndex) return;
        if (timingFilter === 'next_month' && m !== nextMonthIndex) return;

        if (!map.has(m)) {
          map.set(m, []);
        }
        map.get(m)!.push(task);
      });
    });

    const sortedMap = new Map<number, PerpetualTask[]>(
      Array.from(map.entries()).sort((a, b) => a[0] - b[0])
    );

    sortedMap.forEach((tasksInMonth, m) => {
      tasksInMonth.sort((a, b) => {
        const aIsOpt = a.optimalMonth === m ? 0 : 1;
        const bIsOpt = b.optimalMonth === m ? 0 : 1;
        if (aIsOpt !== bIsOpt) return aIsOpt - bIsOpt;

        const aPeriod = m === a.endMonth && a.endPeriod ? a.endPeriod : a.period;
        const bPeriod = m === b.endMonth && b.endPeriod ? b.endPeriod : b.period;
        return (periodOrder[aPeriod] || 99) - (periodOrder[bPeriod] || 99);
      });
    });

    return sortedMap;
  }, [tasks, timingFilter, currentMonthIndex, nextMonthIndex]);

  const totalDisplayedCount = useMemo(() => {
    let count = 0;
    groupedByMonth.forEach(list => { count += list.length; });
    return count;
  }, [groupedByMonth]);

  const toggleExpand = (id: string) => {
    setExpandedDescriptions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getPeriodBadge = (period: string) => {
    switch (period) {
      case 'debut':
        return { label: '1er - 10 du mois', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'mi':
        return { label: '11 - 20 du mois', badge: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'fin':
        return { label: '21 - fin du mois', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { label: 'Tout le mois', badge: 'bg-stone-100 text-stone-700 border-stone-200' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-toolbar: Timing Filters & Summary */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar w-full sm:w-auto">
          <span className="text-[11px] font-medium text-stone-400 mr-1 shrink-0">Focus temporel :</span>
          
          <button
            type="button"
            onClick={() => setTimingFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
              timingFilter === 'all'
                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-semibold'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <span>Toutes les actions</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${timingFilter === 'all' ? 'bg-purple-800 text-white' : 'bg-stone-200 text-stone-700'}`}>
              {tasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTimingFilter('current_month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
              timingFilter === 'current_month'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                : 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
            }`}
          >
            <span>⚡ Ce mois-ci ({MONTH_NAMES[currentMonthIndex - 1]})</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${timingFilter === 'current_month' ? 'bg-emerald-800 text-white' : 'bg-emerald-200 text-emerald-900'}`}>
              {currentMonthTasksCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTimingFilter('next_month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all shrink-0 flex items-center gap-1.5 ${
              timingFilter === 'next_month'
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                : 'bg-blue-50/70 text-blue-800 border-blue-200 hover:bg-blue-100/70'
            }`}
          >
            <span>🔜 Mois prochain ({MONTH_NAMES[nextMonthIndex - 1]})</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${timingFilter === 'next_month' ? 'bg-blue-800 text-white' : 'bg-blue-200 text-blue-900'}`}>
              {nextMonthTasksCount}
            </span>
          </button>
        </div>

        <div className="text-xs text-stone-500 shrink-0 self-end sm:self-center">
          {totalDisplayedCount} {totalDisplayedCount > 1 ? 'actions affichées' : 'action affichée'}
        </div>
      </div>

      {/* Empty State */}
      {totalDisplayedCount === 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Aucune action trouvée</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              {timingFilter !== 'all' 
                ? `Aucun geste perpétuel n'est programmé pour cette période. Vous pouvez en créer un ou afficher toutes les actions.`
                : `Aucun geste perpétuel ne correspond aux filtres sélectionnés.`}
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-2">
            {timingFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setTimingFilter('all')}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium transition-colors"
              >
                Voir toutes les actions
              </button>
            )}
            <button
              type="button"
              onClick={onNewTask}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-medium transition-colors inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau geste</span>
            </button>
          </div>
        </div>
      )}

      {/* Actions List by Month */}
      {Array.from(groupedByMonth.entries()).map(([monthNum, monthActions]) => {
        const monthName = MONTH_NAMES[monthNum - 1];
        const isCurrentMonth = monthNum === currentMonthIndex;

        return (
          <div 
            key={monthNum}
            className={`bg-white rounded-2xl border transition-all overflow-hidden ${
              isCurrentMonth 
                ? 'border-emerald-300 ring-2 ring-emerald-100 shadow-md' 
                : 'border-stone-200/80 shadow-xs'
            }`}
          >
            {/* Month Header Banner */}
            <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
              isCurrentMonth ? 'bg-emerald-50/80 border-emerald-100' : 'bg-stone-50/80 border-stone-100'
            }`}>
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${isCurrentMonth ? 'text-emerald-700' : 'text-stone-500'}`} />
                <h3 className="text-sm font-serif font-bold text-stone-900">
                  {monthName}
                </h3>
                {isCurrentMonth && (
                  <span className="text-[10px] bg-emerald-600 text-white font-semibold px-2 py-0.5 rounded-full shadow-2xs">
                    Mois en cours
                  </span>
                )}
              </div>

              <span className="text-xs text-stone-500 font-medium">
                {monthActions.length} {monthActions.length > 1 ? 'actions à mener' : 'action à mener'}
              </span>
            </div>

            {/* Actions Table / List */}
            <div className="divide-y divide-stone-100">
              {monthActions.map(task => {
                const catConfig = categories[task.category] || { label: 'Autre', icon: '📌', badgeClass: 'bg-stone-50 text-stone-700 border-stone-200' };
                const periodFormatted = formatPerpetualPeriod(task);
                const isOptimalMonth = task.optimalMonth === monthNum;

                let periodInfo = getPeriodBadge(task.period);
                if (periodFormatted.isMultiMonth) {
                  if (monthNum === task.month) {
                    periodInfo = { label: `Début (${getPeriodBadge(task.period).label})`, badge: getPeriodBadge(task.period).badge };
                  } else if (monthNum === task.endMonth) {
                    const endP = task.endPeriod || 'fin';
                    periodInfo = { label: `Fin (${getPeriodBadge(endP).label})`, badge: getPeriodBadge(endP).badge };
                  } else {
                    periodInfo = { label: 'Période active', badge: 'bg-purple-50 text-purple-700 border-purple-200' };
                  }
                }

                const isNow = isCurrentMonth && (
                  !periodFormatted.isMultiMonth
                    ? (task.period === currentPeriod || task.period === 'mois_entier')
                    : (monthNum === task.month ? (task.period === currentPeriod || task.period === 'mois_entier') :
                       monthNum === task.endMonth ? (task.endPeriod === currentPeriod || task.endPeriod === 'mois_entier') : true)
                );
                const isExpanded = !!expandedDescriptions[task.id];
                const hasLongDesc = task.description && task.description.length > 130;

                return (
                  <div 
                    key={`${monthNum}-${task.id}`}
                    className={`p-4 transition-colors hover:bg-stone-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isOptimalMonth ? 'bg-amber-50/30' : isNow ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    {/* Left: Timing badge + Action detail */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Timing pill */}
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${periodInfo.badge}`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{periodInfo.label}</span>
                        </div>

                        {/* Multi-month range pill */}
                        {periodFormatted.isMultiMonth && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                            <CalendarRange className="w-3.5 h-3.5 text-purple-600" />
                            <span>{periodFormatted.summary}</span>
                          </div>
                        )}

                        {/* Optimal period recommendation */}
                        {isOptimalMonth && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 ring-1 ring-amber-400/40">
                            <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                            <span>Moment idéal recommandé !</span>
                          </div>
                        )}

                        {/* Category badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${catConfig.badgeClass}`}>
                          <span>{catConfig.icon}</span>
                          <span>{catConfig.label}</span>
                        </span>

                        {/* Plant badge */}
                        {task.plant && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{task.plant}</span>
                          </span>
                        )}

                        {/* Current Period Alert badge */}
                        {isNow && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-2xs animate-pulse">
                            ⚡ À faire en ce moment !
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div className="pt-0.5">
                        <h4 className="text-base font-semibold text-stone-900 leading-snug">
                          {task.title}
                        </h4>
                      </div>

                      {/* Description / Instructions */}
                      {task.description && (
                        <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/70 text-xs text-stone-700 leading-relaxed max-w-4xl">
                          <p className={`whitespace-pre-wrap ${!isExpanded && hasLongDesc ? 'line-clamp-2' : ''}`}>
                            {task.description}
                          </p>
                          {hasLongDesc && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(task.id)}
                              className="mt-1 text-purple-700 hover:text-purple-800 font-semibold inline-flex items-center gap-0.5 text-[11px]"
                            >
                              {isExpanded ? (
                                <>
                                  <span>Voir moins</span>
                                  <ChevronUp className="w-3 h-3" />
                                </>
                              ) : (
                                <>
                                  <span>Lire tout le mémo</span>
                                  <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Bottom details: Photos & Origin */}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {task.photos && task.photos.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            {task.photos.map((ph, idx) => (
                              <img
                                key={idx}
                                src={ph}
                                alt="Observation"
                                onClick={() => onZoomPhoto(ph)}
                                className="w-10 h-10 object-cover rounded-lg border border-stone-200 cursor-pointer hover:opacity-85 transition-opacity shadow-2xs"
                                title="Cliquer pour agrandir la photo"
                              />
                            ))}
                          </div>
                        )}

                        {task.sourceNoteDate && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Validé par observation du {new Date(task.sourceNoteDate).toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 shrink-0">
                      <button
                        type="button"
                        onClick={() => onScheduleAsTask(task, monthNum)}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-1.5 hover:shadow-sm"
                        title={`Créer une tâche dans le potager pour ${monthName} ${currentYear}`}
                      >
                        <CalendarPlus className="w-4 h-4" />
                        <span>Planifier ({monthName.slice(0, 4)}.)</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className="px-2.5 py-1.5 text-xs text-stone-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors inline-flex items-center gap-1 border border-stone-200/80 bg-white"
                          title="Modifier les détails de ce geste"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteTask(task)}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-stone-200/80 bg-white"
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
          </div>
        );
      })}
    </div>
  );
}
