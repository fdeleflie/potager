import { useFirebaseData, fb } from '../hooks/useFirebaseData';
import React, { useState, useMemo, useEffect } from 'react';
import { db, Task, Seedling, PerpetualTask } from '../db';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  List, 
  LayoutGrid, 
  Printer, 
  CalendarClock, 
  Plus, 
  ArrowRight,
  Scissors,
  Sparkles
} from 'lucide-react';
import { printElement } from '../utils/print';
import { useSeason } from '../contexts/SeasonContext';
import { PerpetualPlanningTab } from '../components/PerpetualPlanningTab';
import { MultiplicationsPlanningTab } from '../components/MultiplicationsPlanningTab';
import { PerpetualTaskModal, CATEGORY_CONFIG, MONTH_NAMES, usePerpetualCategories, getPerpetualTaskMonths } from '../components/PerpetualTaskModal';

interface CalendarEvent {
  id: string;
  type: 'sown' | 'transplanted' | 'planted' | 'harvest' | 'task' | 'forecast' | 'perpetual';
  title: string;
  colorClass: string;
  date: string;
  isForecast?: boolean;
}

export function CalendarView({ 
  setCurrentView,
  initialTab = 'month',
  initialMonth = 'all'
}: { 
  setCurrentView: (v: string) => void;
  initialTab?: 'month' | 'year' | 'agenda' | 'perpetual' | 'multiplications';
  initialMonth?: number | 'all';
}) {
  const { currentSeasonId, isItemInCurrentSeason } = useSeason();
  const categories = usePerpetualCategories();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Main 3-pillars tab navigation
  const [mainTab, setMainTab] = useState<'agenda' | 'perpetual' | 'multiplications'>(() => {
    if (initialTab === 'multiplications') return 'multiplications';
    if (initialTab === 'perpetual') return 'perpetual';
    return 'agenda';
  });

  const [perpetualInitialCategory, setPerpetualInitialCategory] = useState<string | undefined>(() => {
    return initialTab === 'multiplications' ? 'multiplication' : undefined;
  });

  // Submode for Agenda de saison (Mois vs Année Gantt)
  const [agendaSubMode, setAgendaSubMode] = useState<'month' | 'year'>(() => {
    return initialTab === 'year' ? 'year' : 'month';
  });

  const [isPerpetualModalOpen, setIsPerpetualModalOpen] = useState(false);
  const [editingPerpetualTask, setEditingPerpetualTask] = useState<Partial<PerpetualTask> | undefined>();
  const [perpetualInitialMonth, setPerpetualInitialMonth] = useState<number | 'all'>(initialMonth);

  useEffect(() => {
    if (initialTab === 'multiplications') {
      setMainTab('multiplications');
    } else if (initialTab === 'perpetual') {
      setMainTab('perpetual');
      setPerpetualInitialCategory(undefined);
    } else if (initialTab === 'year') {
      setMainTab('agenda');
      setAgendaSubMode('year');
    } else if (initialTab === 'month' || initialTab === 'agenda') {
      setMainTab('agenda');
      setAgendaSubMode('month');
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialMonth !== undefined) {
      setPerpetualInitialMonth(initialMonth);
    }
  }, [initialMonth]);
  
  const { data: rawSeedlings, error: seedlingsError } = useFirebaseData<any>('seedlings');
  const { data: rawTasks, error: tasksError } = useFirebaseData<any>('tasks');
  const { data: rawPerpetualTasks, error: perpetualError } = useFirebaseData<PerpetualTask>('perpetualTasks');

  const error = seedlingsError || tasksError || perpetualError;
  const seedlings = (rawSeedlings || []).filter(s => !s.isDeleted && isItemInCurrentSeason(s));
  const tasks = (rawTasks || []).filter(t => isItemInCurrentSeason(t));
  const perpetualTasks = useMemo(() => (rawPerpetualTasks || []).filter(t => !t.isDeleted), [rawPerpetualTasks]);

  const events = useMemo(() => {
    if (!seedlings) return {};
    
    const eventMap: Record<string, CalendarEvent[]> = {};
    
    const addEvent = (dateStr: string, event: CalendarEvent) => {
      if (!dateStr) return;
      if (!eventMap[dateStr]) {
        eventMap[dateStr] = [];
      }
      eventMap[dateStr].push(event);
    };

    const currentYear = currentDate.getFullYear();

    perpetualTasks.forEach(pt => {
      const coveredMonths = getPerpetualTaskMonths(pt);
      coveredMonths.forEach(m => {
        const monthStr = String(m).padStart(2, '0');
        let periodForMonth = pt.period;
        if (pt.optimalMonth === m && pt.optimalPeriod) {
          periodForMonth = pt.optimalPeriod;
        } else if (pt.endMonth === m && pt.endPeriod) {
          periodForMonth = pt.endPeriod;
        } else if (m !== pt.month && m !== pt.endMonth) {
          periodForMonth = 'mi';
        }

        let dayStr = '15';
        if (periodForMonth === 'debut') dayStr = '05';
        else if (periodForMonth === 'fin') dayStr = '25';
        else if (periodForMonth === 'mois_entier') dayStr = '01';

        const isOptimal = pt.optimalMonth === m;
        const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
        addEvent(dateStr, {
          id: pt.id,
          type: 'perpetual',
          title: isOptimal ? `⭐🔄 ${pt.title} (Idéal)` : `🔄 ${pt.title}`,
          colorClass: isOptimal
            ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
            : 'bg-purple-100 text-purple-800 border-purple-200',
          date: dateStr
        });
      });
    });

    seedlings.forEach(s => {
      if (s.dateSown) {
        addEvent(s.dateSown, {
          id: s.id,
          type: 'sown',
          title: `Semis: ${s.vegetable} (${s.variety || ''})`,
          colorClass: 'bg-amber-100 text-amber-800 border-amber-200',
          date: s.dateSown
        });
      }
      if (s.dateTransplanted) {
        addEvent(s.dateTransplanted, {
          id: s.id,
          type: 'transplanted',
          title: `Repiquage: ${s.vegetable} (${s.variety || ''})`,
          colorClass: 'bg-blue-100 text-blue-800 border-blue-200',
          date: s.dateTransplanted
        });
      }
      if (s.datePlanted) {
        addEvent(s.datePlanted, {
          id: s.id,
          type: 'planted',
          title: `Plantation: ${s.vegetable} (${s.variety || ''})`,
          colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          date: s.datePlanted
        });
      }

      if (s.harvests && s.harvests.length > 0) {
        s.harvests.forEach(h => {
          if (h.date) {
            addEvent(h.date, {
              id: `${s.id}-${h.id}`,
              type: 'harvest',
              title: `Récolte: ${s.vegetable} (${h.quantity} ${h.unit})`,
              colorClass: 'bg-orange-100 text-orange-800 border-orange-200',
              date: h.date
            });
          }
        });
      }

      if (s.dateSown && !s.isArchived) {
        try {
          const sown = new Date(s.dateSown);
          if (!isNaN(sown.getTime())) {
            if (!s.dateTransplanted && s.state === 'Démarrage') {
              const forecastTransplant = new Date(sown);
              forecastTransplant.setDate(sown.getDate() + 21);
              const dateStr = forecastTransplant.toISOString().split('T')[0];
              addEvent(dateStr, {
                id: `forecast-transplant-${s.id}`,
                type: 'forecast',
                title: `Prévision repiquage: ${s.vegetable}`,
                colorClass: 'bg-stone-100 text-stone-600 border-stone-200 border-dashed',
                date: dateStr,
                isForecast: true
              });
            }

            const baseDate = s.dateTransplanted ? new Date(s.dateTransplanted) : sown;
            if (!s.datePlanted && s.state !== 'Récolté') {
              const forecastPlant = new Date(baseDate);
              forecastPlant.setDate(baseDate.getDate() + (s.dateTransplanted ? 28 : 45));
              const dateStr = forecastPlant.toISOString().split('T')[0];
              addEvent(dateStr, {
                id: `forecast-plant-${s.id}`,
                type: 'forecast',
                title: `Prévision plantation: ${s.vegetable}`,
                colorClass: 'bg-stone-100 text-stone-600 border-stone-200 border-dashed',
                date: dateStr,
                isForecast: true
              });
            }
          }
        } catch (e) {
          console.error("Error calculating forecasts for seedling", s.id, e);
        }
      }
    });

    if (tasks) {
      tasks.forEach(t => {
        if (!t.isCompleted && t.dateDue) {
          addEvent(t.dateDue, {
            id: t.id,
            type: 'task',
            title: `Tâche: ${t.title}`,
            colorClass: 'bg-purple-100 text-purple-800 border-purple-200',
            date: t.dateDue
          });
        }
      });
    }

    return eventMap;
  }, [seedlings, tasks, perpetualTasks, currentDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Calendar cells
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(
      <div key={`empty-${i}`} className="min-h-[90px] sm:min-h-[110px] bg-stone-50/50 border border-stone-100 p-1.5 opacity-40"></div>
    );
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = events[dateStr] || [];
    const isToday = new Date().toISOString().split('T')[0] === dateStr;

    calendarCells.push(
      <div 
        key={`day-${d}`} 
        className={`min-h-[90px] sm:min-h-[110px] bg-white border border-stone-200/80 p-1.5 flex flex-col transition-colors hover:border-emerald-300 ${isToday ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/20' : ''}`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-600 text-white' : 'text-stone-700'}`}>
            {d}
          </span>
          {dayEvents.length > 0 && (
            <span className="text-[9px] font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-full">
              {dayEvents.length}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
          {dayEvents.map((ev, idx) => (
            <div 
              key={`${ev.id}-${ev.type}-${idx}`}
              onClick={() => {
                if (ev.type === 'task') setCurrentView('tasks');
                else if (ev.type === 'perpetual') {
                  setPerpetualInitialMonth('all');
                  setMainTab('perpetual');
                } else setCurrentView(`seedling-detail-${ev.id}`);
              }}
              className={`text-[9px] sm:text-[10px] leading-tight p-1 rounded border cursor-pointer hover:opacity-85 truncate ${ev.colorClass}`}
              title={ev.title}
            >
              {ev.title}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4" id="calendar-print-area">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Main Header with 2 Core Pillars */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 bg-white p-4 rounded-2xl shadow-sm border border-stone-200/70 print:hidden">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl shadow-inner ${
            mainTab === 'perpetual'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {mainTab === 'perpetual' ? (
              <CalendarClock className="w-5 h-5" />
            ) : (
              <CalendarIcon className="w-5 h-5" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold text-stone-900 tracking-tight">
              {mainTab === 'multiplications'
                ? 'Multiplications & Bouturage'
                : mainTab === 'perpetual' 
                  ? 'Planning Perpétuel' 
                  : 'Agenda de Saison'}
            </h1>
            <p className="text-xs text-stone-500">
              {mainTab === 'multiplications'
                ? 'Le calendrier mensuel des boutures, marcottes et greffes synchronisé avec les plantes de votre jardin'
                : mainTab === 'perpetual'
                  ? 'Les gestes récurrents (tailles, paillage, fertilisation, soins) qui reviennent chaque année au jardin'
                  : 'Suivez vos semis, repiquages et récoltes réelles de l\'année'}
            </p>
          </div>
        </div>

        {/* 3 Main Tabs Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200/90 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMainTab('agenda')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                mainTab === 'agenda'
                  ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Agenda de saison</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPerpetualInitialMonth('all');
                setPerpetualInitialCategory(undefined);
                setMainTab('perpetual');
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                mainTab === 'perpetual'
                  ? 'bg-purple-600 text-white shadow-2xs font-bold'
                  : 'text-purple-700 hover:text-purple-900'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Planning perpétuel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMainTab('multiplications');
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                mainTab === 'multiplications'
                  ? 'bg-teal-700 text-white shadow-2xs font-bold'
                  : 'text-teal-700 hover:text-teal-900'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Multiplications & Boutures</span>
            </button>
          </div>

          {/* Sub-controls specific to mainTab */}
          {mainTab === 'agenda' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
                <button 
                  onClick={() => setAgendaSubMode('month')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    agendaSubMode === 'month' ? 'bg-white text-stone-900 font-bold shadow-2xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Mois</span>
                </button>
                <button 
                  onClick={() => setAgendaSubMode('year')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    agendaSubMode === 'year' ? 'bg-white text-stone-900 font-bold shadow-2xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Année (Gantt)</span>
                </button>
              </div>

              {agendaSubMode === 'month' ? (
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
                  <button onClick={prevMonth} className="p-1 hover:bg-white rounded-lg transition-colors text-stone-600">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-semibold text-stone-800 px-1 min-w-[95px] text-center">
                    {monthNames[month]} {year}
                  </span>
                  <button onClick={nextMonth} className="p-1 hover:bg-white rounded-lg transition-colors text-stone-600">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
                  <button onClick={() => setCurrentDate(new Date(year - 1, month, 1))} className="p-1 hover:bg-white rounded-lg transition-colors text-stone-600">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-semibold text-stone-800 px-1 min-w-[50px] text-center">
                    {year}
                  </span>
                  <button onClick={() => setCurrentDate(new Date(year + 1, month, 1))} className="p-1 hover:bg-white rounded-lg transition-colors text-stone-600">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button 
                onClick={() => printElement('calendar-print-area', `Calendrier - ${monthNames[month]} ${year}`)}
                className="p-2 text-stone-600 hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors"
                title="Imprimer l'agenda"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          )}

          {mainTab === 'perpetual' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingPerpetualTask(undefined);
                  setIsPerpetualModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau geste</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* VIEW RENDER: 3 Pillars */}
      {mainTab === 'multiplications' ? (
        <MultiplicationsPlanningTab
          setCurrentView={setCurrentView}
          initialMonth={perpetualInitialMonth !== 'all' ? perpetualInitialMonth : undefined}
        />
      ) : mainTab === 'perpetual' ? (
        <PerpetualPlanningTab
          currentYear={year}
          currentSeasonId={currentSeasonId}
          onNewTask={() => {
            setEditingPerpetualTask(undefined);
            setIsPerpetualModalOpen(true);
          }}
          onEditTask={(task) => {
            setEditingPerpetualTask(task);
            setIsPerpetualModalOpen(true);
          }}
          initialSelectedMonth={perpetualInitialMonth}
          initialCategory={perpetualInitialCategory}
          setCurrentView={setCurrentView}
        />
      ) : agendaSubMode === 'month' ? (
        <>
          {/* Reminder of perpetual tasks for this month */}
          {(() => {
            const currentMonthPerpetuals = perpetualTasks.filter(t => t.month === (month + 1));
            if (currentMonthPerpetuals.length === 0) return null;
            return (
              <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-3.5 mb-4 shadow-2xs print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                      <CalendarClock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-purple-950">
                        Gestes perpétuels recommandés en {monthNames[month]} ({currentMonthPerpetuals.length})
                      </h3>
                      <p className="text-[11px] text-purple-700">
                        Répétez vos gestes réussis aux dates optimales
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPerpetualInitialMonth(month + 1);
                      setMainTab('perpetual');
                    }}
                    className="text-xs font-medium text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100/60 px-3 py-1 rounded-xl border border-purple-200 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <span>Consulter le planning perpétuel</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {currentMonthPerpetuals.map(t => {
                    const cat = categories[t.category] || CATEGORY_CONFIG[t.category];
                    return (
                      <span 
                        key={t.id} 
                        onClick={() => {
                          setPerpetualInitialMonth(month + 1);
                          setMainTab('perpetual');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs bg-white border border-purple-200 text-purple-900 font-medium flex items-center gap-1.5 shadow-2xs cursor-pointer hover:border-purple-400"
                      >
                        <span>{cat?.icon || '🌱'}</span>
                        <span>{t.title}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Monthly Grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center py-2.5 text-xs font-bold text-stone-600">
              {daysOfWeek.map(day => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarCells}
            </div>
          </div>
        </>
      ) : (
        /* Year Gantt View */
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 p-4 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px] space-y-4">
              {/* Header Months */}
              <div className="flex border-b border-stone-200 pb-2">
                <div className="w-48 shrink-0 font-medium text-stone-400 text-xs uppercase tracking-wider pl-2">Culture</div>
                <div className="flex-1 flex text-xs font-medium text-stone-500">
                  {monthNames.map(m => (
                    <div key={m} className="flex-1 text-center border-l border-stone-100 first:border-0">{m.slice(0, 3)}</div>
                  ))}
                </div>
              </div>

              {/* Seedlings Bars */}
              {seedlings && seedlings.map(s => {
                let startDate = s.dateSown ? new Date(s.dateSown) : (s.datePlanted ? new Date(s.datePlanted) : null);
                if (!startDate) return null;

                let endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 3);

                if (s.harvests && s.harvests.length > 0) {
                  const lastHarvest = s.harvests.reduce((latest, h) => {
                    const hDate = new Date(h.date);
                    return hDate > latest ? hDate : latest;
                  }, new Date(s.harvests[0].date));
                  if (lastHarvest > endDate) endDate = lastHarvest;
                }

                if (startDate.getFullYear() > year || endDate.getFullYear() < year) {
                  return null;
                }

                const yearStart = new Date(year, 0, 1);
                const yearEnd = new Date(year, 11, 31);
                
                const actualStart = startDate < yearStart ? yearStart : startDate;
                const actualEnd = endDate > yearEnd ? yearEnd : endDate;

                const totalDays = 365 + (year % 4 === 0 ? 1 : 0);
                const startDay = Math.floor((actualStart.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
                const durationDays = Math.floor((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24));

                const left = (startDay / totalDays) * 100;
                const width = Math.max((durationDays / totalDays) * 100, 1);

                return (
                  <div key={s.id} className="flex items-center group cursor-pointer" onClick={() => setCurrentView(`seedling-detail-${s.id}`)}>
                    <div className="w-48 shrink-0 pr-4 truncate">
                      <span className="text-sm font-medium text-stone-800">{s.vegetable}</span>
                      {s.variety && <span className="text-xs text-stone-500 ml-1">{s.variety}</span>}
                    </div>
                    <div className="flex-1 relative h-8 bg-stone-50 rounded-md border border-stone-100">
                      <div className="absolute inset-0 flex">
                        {monthNames.map((_, i) => (
                          <div key={i} className="flex-1 border-r border-stone-200/50 last:border-0"></div>
                        ))}
                      </div>
                      <div 
                        className={`absolute top-1.5 bottom-1.5 rounded-full shadow-sm transition-all group-hover:brightness-95 ${s.isArchived ? 'bg-stone-300' : 'bg-emerald-400'}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${s.vegetable} ${s.variety ? `(${s.variety})` : ''}`}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {(!seedlings || seedlings.length === 0) && (
                <div className="text-center py-8 text-stone-500 text-sm">Aucune culture pour cette année.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for creating / editing perpetual tasks */}
      <PerpetualTaskModal
        isOpen={isPerpetualModalOpen}
        onClose={() => {
          setIsPerpetualModalOpen(false);
          setEditingPerpetualTask(undefined);
        }}
        initialData={editingPerpetualTask}
      />
    </div>
  );
}
