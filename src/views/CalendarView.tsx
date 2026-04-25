import { useFirebaseData, fb } from '../hooks/useFirebaseData';
import React, { useState, useMemo } from 'react';
import { db, Task, Seedling } from '../db';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, LayoutGrid, Printer } from 'lucide-react';
import { printElement } from '../utils/print';

interface CalendarEvent {
  id: string;
  type: 'sown' | 'transplanted' | 'planted' | 'harvest' | 'task' | 'forecast';
  title: string;
  colorClass: string;
  date: string;
  isForecast?: boolean;
}

export function CalendarView({ setCurrentView }: { setCurrentView: (v: string) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  
  const { data: rawSeedlings, error: seedlingsError } = useFirebaseData<any>('seedlings');
  const { data: tasks, error: tasksError } = useFirebaseData<any>('tasks');

  const error = seedlingsError || tasksError;
  const seedlings = (rawSeedlings || []).filter(s => !s.isDeleted);

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

    seedlings.forEach(s => {
      if (s.dateSown) {
        addEvent(s.dateSown, {
          id: s.id,
          type: 'sown',
          title: `${s.vegetable} ${s.variety ? `(${s.variety})` : ''} (Démarrage)`,
          colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          date: s.dateSown
        });
      }
      if (s.dateTransplanted) {
        addEvent(s.dateTransplanted, {
          id: s.id,
          type: 'transplanted',
          title: `${s.vegetable} ${s.variety ? `(${s.variety})` : ''} (Repiquage)`,
          colorClass: 'bg-blue-100 text-blue-800 border-blue-200',
          date: s.dateTransplanted
        });
      }
      if (s.datePlanted) {
        addEvent(s.datePlanted, {
          id: s.id,
          type: 'planted',
          title: `${s.vegetable} ${s.variety ? `(${s.variety})` : ''} (Mise en terre)`,
          colorClass: 'bg-purple-100 text-purple-800 border-purple-200',
          date: s.datePlanted
        });
      }
      if (s.harvests) {
        s.harvests.forEach(h => {
          addEvent(h.date, {
            id: s.id,
            type: 'harvest',
            title: `${s.vegetable} (Récolte: ${h.quantity} ${h.unit})`,
            colorClass: 'bg-amber-100 text-amber-800 border-amber-200',
            date: h.date
          });
        });
      }

      // Forecasts
      if (!s.isArchived) {
        const addDays = (dateStr: string, days: number) => {
          const d = new Date(dateStr);
          d.setDate(d.getDate() + days);
          return d.toISOString().split('T')[0];
        };

        if (s.dateSown && !s.dateTransplanted && !s.datePlanted) {
          const estTransplant = addDays(s.dateSown, 21);
          addEvent(estTransplant, {
            id: s.id,
            type: 'forecast',
            title: `⏳ ${s.vegetable} (Repiquage estimé)`,
            colorClass: 'bg-blue-50 text-blue-600 border-blue-200 border-dashed',
            date: estTransplant,
            isForecast: true
          });
        }

        if ((s.dateTransplanted || s.dateSown) && !s.datePlanted) {
          const baseDate = s.dateTransplanted || s.dateSown;
          const daysToAdd = s.dateTransplanted ? 21 : 42;
          const estPlant = addDays(baseDate, daysToAdd);
          addEvent(estPlant, {
            id: s.id,
            type: 'forecast',
            title: `⏳ ${s.vegetable} (Mise en terre estimée)`,
            colorClass: 'bg-purple-50 text-purple-600 border-purple-200 border-dashed',
            date: estPlant,
            isForecast: true
          });
        }

        if (s.datePlanted && (!s.harvests || s.harvests.length === 0)) {
          const estHarvest = addDays(s.datePlanted, 60);
          addEvent(estHarvest, {
            id: s.id,
            type: 'forecast',
            title: `⏳ ${s.vegetable} (1ère récolte estimée)`,
            colorClass: 'bg-amber-50 text-amber-600 border-amber-200 border-dashed',
            date: estHarvest,
            isForecast: true
          });
        }
      }
    });

    // Tasks
    tasks?.forEach(t => {
      if (t.dateDue && !t.isCompleted) {
        addEvent(t.dateDue, {
          id: t.id,
          type: 'task',
          title: `${t.title} (Tâche)`,
          colorClass: 'bg-stone-100 text-stone-800 border-stone-300',
          date: t.dateDue
        });
      }
    });

    return eventMap;
  }, [seedlings, tasks]);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust so Monday is 0
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-24 bg-stone-50/50 border border-stone-100 rounded-lg"></div>);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = events[dateStr] || [];
    const isToday = dateStr === new Date().toISOString().split('T')[0];

    days.push(
      <div key={d} className={`h-24 sm:h-32 border rounded-lg p-1.5 flex flex-col overflow-hidden transition-colors ${isToday ? 'border-emerald-400 bg-emerald-50/30' : 'border-stone-200 bg-white hover:border-emerald-300'}`}>
        <div className="flex justify-between items-start mb-1">
          <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-500 text-white' : 'text-stone-600'}`}>
            {d}
          </span>
          {dayEvents.length > 0 && (
            <span className="text-[9px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">
              {dayEvents.length}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {dayEvents.map((ev, idx) => (
            <div 
              key={`${ev.id}-${ev.type}-${idx}`}
              onClick={() => {
                if (ev.type === 'task') setCurrentView('tasks');
                else setCurrentView(`seedling-detail-${ev.id}`);
              }}
              className={`text-[9px] sm:text-[10px] leading-tight p-1 rounded border cursor-pointer hover:opacity-80 truncate ${ev.colorClass}`}
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-medium text-stone-900">Calendrier des cultures</h1>
            <p className="text-xs text-stone-500">Suivez vos semis, repiquages et récoltes</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => printElement('calendar-print-area', `Calendrier - ${monthNames[month]} ${year}`)}
            className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            title="Imprimer le calendrier"
          >
            <Printer className="w-4 h-4" />
          </button>
          
          <div className="flex bg-stone-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${viewMode === 'month' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Mois
            </button>
            <button 
              onClick={() => setViewMode('year')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${viewMode === 'year' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <List className="w-4 h-4" /> Année (Gantt)
            </button>
          </div>

          {viewMode === 'month' && (
            <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-lg">
              <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-md transition-colors text-stone-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-stone-800 min-w-[120px] text-center">
                {monthNames[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-md transition-colors text-stone-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {viewMode === 'year' && (
            <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-lg">
              <button onClick={() => setCurrentDate(new Date(year - 1, month, 1))} className="p-1.5 hover:bg-white rounded-md transition-colors text-stone-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-stone-800 min-w-[80px] text-center">
                {year}
              </span>
              <button onClick={() => setCurrentDate(new Date(year + 1, month, 1))} className="p-1.5 hover:bg-white rounded-md transition-colors text-stone-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {viewMode === 'month' ? (
        <>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 print:border-none print:shadow-none print:p-0">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-[10px] font-medium text-stone-500 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {days}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 text-[10px] font-medium text-stone-600 bg-white p-3 rounded-xl border border-stone-200/60 shadow-sm print:border-none print:shadow-none print:p-0 print:mt-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></div>
              Démarrage
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
              Repiquage
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div>
              Mise en terre
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></div>
              Récolte
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-stone-100 border border-stone-300"></div>
              Tâche
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-white border border-dashed border-stone-400"></div>
              Prévision
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 overflow-x-auto print:border-none print:shadow-none print:p-0">
          <div className="min-w-[800px]">
            <div className="flex border-b border-stone-200 mb-2 pb-2">
              <div className="w-48 shrink-0 font-medium text-xs text-stone-500 uppercase tracking-wider">Culture</div>
              <div className="flex-1 flex">
                {monthNames.map(m => (
                  <div key={m} className="flex-1 text-center text-xs font-medium text-stone-500">{m.substring(0, 3)}</div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {seedlings?.filter(s => {
                const startStr = s.dateSown || s.dateTransplanted || s.datePlanted;
                if (!startStr) return false;
                const startDate = new Date(startStr);
                return startDate.getFullYear() <= year && (!s.isArchived || new Date(s.harvests?.[s.harvests.length - 1]?.date || startStr).getFullYear() >= year);
              }).sort((a, b) => {
                const dateA = new Date(a.dateSown || a.dateTransplanted || a.datePlanted || 0).getTime();
                const dateB = new Date(b.dateSown || b.dateTransplanted || b.datePlanted || 0).getTime();
                return dateA - dateB;
              }).map(s => {
                const startStr = s.dateSown || s.dateTransplanted || s.datePlanted;
                const startDate = new Date(startStr!);
                
                let endDate = new Date(year, 11, 31);
                if (s.isArchived) {
                  if (s.harvests && s.harvests.length > 0) {
                    endDate = new Date(s.harvests[s.harvests.length - 1].date);
                  } else {
                    endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 120);
                  }
                } else if (s.harvests && s.harvests.length > 0) {
                   endDate = new Date();
                   endDate.setDate(endDate.getDate() + 30);
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
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex">
                        {monthNames.map((_, i) => (
                          <div key={i} className="flex-1 border-r border-stone-200/50 last:border-0"></div>
                        ))}
                      </div>
                      {/* Bar */}
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
    </div>
  );
}
