import React, { useMemo, useState } from 'react';
import { CombinedEntry } from '../views/Journal';
import { NoteUpdate, PerpetualTask } from '../db';
import { formatDateShortFR, getNoteLatestDate, getSortedUpdates, parseSafeDate, toDateKey } from '../utils/notes';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Leaf, 
  BookOpen, 
  CalendarClock, 
  CalendarPlus, 
  ExternalLink, 
  Edit, 
  Trash2, 
  X, 
  TreePine,
  Plus,
  Calendar as CalendarIcon,
  Copy,
  History
} from 'lucide-react';

interface Props {
  entries: CombinedEntry[];
  perpetualTasks: PerpetualTask[];
  onStartEdit: (entry: CombinedEntry) => void;
  onOpenFollowUp: (entry: CombinedEntry) => void;
  onDelete: (id: string, type: string) => void;
  onCycleSuccess: (entry: CombinedEntry) => void;
  onOpenPerpetualModal: (entry: CombinedEntry) => void;
  onEditPerpetual: (task: PerpetualTask) => void;
  onDeletePerpetual: (perpetualId: string) => void;
  setCurrentView: (view: string) => void;
  onSelectDateForNewEntry?: (date: string) => void;
}

interface CalendarDayItem {
  entry: CombinedEntry;
  isUpdateReminder: boolean;
  matchedUpdates?: NoteUpdate[];
}

export function JournalCalendarView({ 
  entries, 
  perpetualTasks,
  onStartEdit,
  onOpenFollowUp,
  onDelete,
  onCycleSuccess,
  onOpenPerpetualModal,
  onEditPerpetual,
  onDeletePerpetual,
  setCurrentView,
  onSelectDateForNewEntry
}: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEntrySnapshot, setSelectedEntrySnapshot] = useState<CombinedEntry | null>(null);

  const selectedEntry = useMemo(() => {
    if (!selectedEntrySnapshot) return null;
    return entries.find(e => e.id === selectedEntrySnapshot.id) || selectedEntrySnapshot;
  }, [entries, selectedEntrySnapshot]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  // Adjust for Monday as first day of week
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const formattedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Group entries and dated follow-up reminders by day
  const itemsByDay = useMemo(() => {
    const map = new Map<number, CalendarDayItem[]>();

    const pushItem = (day: number, item: CalendarDayItem) => {
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(item);
    };

    entries.forEach(entry => {
      const originParsed = parseSafeDate(entry.date);
      const originKey = toDateKey(entry.date);

      if (originParsed && originParsed.getFullYear() === currentYear && originParsed.getMonth() === currentMonth) {
        pushItem(originParsed.getDate(), { entry, isUpdateReminder: false });
      }

      const sortedUpdates = getSortedUpdates(entry.updates);
      if (sortedUpdates.length > 0) {
        const updatesByDayInMonth = new Map<number, NoteUpdate[]>();
        sortedUpdates.forEach(u => {
          const uDate = parseSafeDate(u.date);
          if (!uDate) return;
          if (uDate.getFullYear() === currentYear && uDate.getMonth() === currentMonth) {
            // Only add a separate [Suivi] reminder card when the update is on a different date than origin
            if (toDateKey(u.date) !== originKey) {
              const dayNum = uDate.getDate();
              if (!updatesByDayInMonth.has(dayNum)) updatesByDayInMonth.set(dayNum, []);
              updatesByDayInMonth.get(dayNum)!.push(u);
            }
          }
        });

        updatesByDayInMonth.forEach((dayUpdates, dayNum) => {
          pushItem(dayNum, {
            entry,
            isUpdateReminder: true,
            matchedUpdates: dayUpdates
          });
        });
      }
    });

    return map;
  }, [entries, currentYear, currentMonth]);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: startOffset }, (_, i) => i);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  const selectedLinkedPerpetual = useMemo(() => {
    if (!selectedEntry) return null;
    return perpetualTasks.find(p => 
      p.sourceNoteId === selectedEntry.id || 
      (p.sourceNoteDate === selectedEntry.date && p.description === selectedEntry.content)
    ) || null;
  }, [selectedEntry, perpetualTasks]);

  const formatDayDateString = (day: number) => {
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${currentYear}-${m}-${d}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50">
        <h3 className="font-semibold text-stone-800 text-sm">{formattedMonthName}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200 rounded-md transition-colors"
          >
            Aujourd'hui
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1 rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1 rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Days Header */}
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/50">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-stone-500">
            {day}
          </div>
        ))}
      </div>

      {/* Grid Days */}
      <div className="grid grid-cols-7 bg-stone-100 gap-px">
        {blanks.map(blank => (
          <div key={`blank-${blank}`} className="bg-white min-h-[110px]" />
        ))}
        {days.map(day => {
          const dayItems = itemsByDay.get(day) || [];
          const isToday = isCurrentMonth && today.getDate() === day;
          const dayDateStr = formatDayDateString(day);

          return (
            <div 
              key={day} 
              className={`bg-white min-h-[110px] p-1.5 sm:p-2 border-stone-100 flex flex-col gap-1 transition-colors group/day ${isToday ? 'bg-emerald-50/20' : ''}`}
            >
              <div className="flex justify-between items-center">
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-700'}`}>
                  {day}
                </span>

                <div className="flex items-center gap-1">
                  {dayItems.length > 0 && (
                    <span className="text-[10px] text-stone-400 font-medium px-1 bg-stone-100 rounded">
                      {dayItems.length}
                    </span>
                  )}
                  {onSelectDateForNewEntry && (
                    <button
                      type="button"
                      onClick={() => onSelectDateForNewEntry(dayDateStr)}
                      className="opacity-0 group-hover/day:opacity-100 p-0.5 text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-all"
                      title={`Ajouter une observation le ${dayDateStr}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[150px] scrollbar-thin">
                {dayItems.map((item, idx) => {
                  const { entry, isUpdateReminder, matchedUpdates } = item;
                  const linkedPerpetual = perpetualTasks.find(p => 
                    p.sourceNoteId === entry.id || 
                    (p.sourceNoteDate === entry.date && p.description === entry.content)
                  );
                  const sortedUpdates = getSortedUpdates(entry.updates);
                  const canFollowUp = entry.type === 'journal' || Boolean(entry.noteId);

                  return (
                    <div 
                      key={`${entry.id}-${isUpdateReminder ? 'upd' : 'orig'}-${idx}`} 
                      onClick={() => setSelectedEntrySnapshot(entry)}
                      className={`text-[10px] sm:text-xs leading-tight p-2 rounded-lg border transition-all cursor-pointer shadow-2xs group/card relative ${
                        isUpdateReminder
                          ? 'border-amber-300 bg-amber-50/90 hover:border-amber-400 hover:bg-amber-100/70'
                          : 'border-stone-200/80 bg-stone-50/80 hover:border-emerald-300 hover:bg-emerald-50/40'
                      }`}
                      title={
                        isUpdateReminder
                          ? `Rappel de suivi de la note du ${formatDateShortFR(entry.date)}`
                          : 'Cliquer pour voir et gérer cette observation'
                      }
                    >
                      {/* Top row */}
                      <div className="flex items-center gap-1 mb-1">
                        {isUpdateReminder ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-200/90 text-amber-950 font-bold text-[9px] shrink-0">
                            <History className="w-2.5 h-2.5" />
                            <span>Suivi</span>
                          </span>
                        ) : entry.type === 'seedling' ? (
                          <Leaf className="w-3 h-3 text-emerald-600 shrink-0" />
                        ) : entry.type === 'tree' ? (
                          <TreePine className="w-3 h-3 text-amber-600 shrink-0" />
                        ) : (
                          <BookOpen className="w-3 h-3 text-stone-500 shrink-0" />
                        )}

                        <span className="font-semibold text-stone-800 truncate text-[11px]">
                          {entry.type === 'seedling' ? entry.sourceName : entry.type === 'tree' ? entry.sourceName : (entry.title || 'Journal')}
                        </span>

                        <div className="flex items-center gap-0.5 ml-auto shrink-0">
                          {!isUpdateReminder && sortedUpdates.length > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold"
                              title={`${sortedUpdates.length} mise(s) à jour de suivi`}
                            >
                              <History className="w-2.5 h-2.5" />
                              {sortedUpdates.length}
                            </span>
                          )}
                          {linkedPerpetual && (
                            <span title={`Au planning perpétuel : ${linkedPerpetual.title}`}>
                              <CalendarClock className="w-3 h-3 text-purple-600" />
                            </span>
                          )}
                          {entry.success === true && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                          {entry.success === false && <XCircle className="w-3 h-3 text-rose-500 shrink-0" />}
                        </div>
                      </div>

                      {/* Content snippet */}
                      {isUpdateReminder && matchedUpdates && matchedUpdates.length > 0 ? (
                        <>
                          <div className="text-amber-950 line-clamp-2 text-[10px] leading-relaxed font-medium">
                            {matchedUpdates.map(u => u.text).join(' • ')}
                          </div>
                          <div className="text-[9px] text-amber-700/90 mt-0.5 truncate">
                            Origine : {formatDateShortFR(entry.date)}
                          </div>
                        </>
                      ) : (
                        <>
                          {entry.title && entry.type !== 'journal' && (
                            <div className="font-semibold text-stone-900 text-[10px] truncate mb-0.5">
                              {entry.title}
                            </div>
                          )}
                          <div className="text-stone-600 line-clamp-2 text-[10px] leading-relaxed">
                            {entry.content}
                          </div>
                        </>
                      )}

                      {/* Hover action toolbar */}
                      <div 
                        className="mt-1.5 pt-1 border-t border-stone-200/60 flex items-center justify-between opacity-0 group-hover/card:opacity-100 transition-opacity"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-0.5">
                          {canFollowUp && (
                            <button
                              type="button"
                              onClick={() => onOpenFollowUp(entry)}
                              className="p-1 text-amber-800 hover:bg-amber-100 rounded text-[10px] inline-flex items-center gap-0.5 font-semibold"
                              title="Ajouter ou gérer les suivis datés"
                            >
                              <History className="w-3 h-3" />
                              <span className="text-[9px]">+ Suivi</span>
                            </button>
                          )}
                          {linkedPerpetual ? (
                            <button
                              type="button"
                              onClick={() => onEditPerpetual(linkedPerpetual)}
                              className="p-1 text-purple-700 hover:bg-purple-100 rounded text-[10px] inline-flex items-center gap-0.5"
                              title="Modifier le geste perpétuel"
                            >
                              <CalendarClock className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenPerpetualModal(entry)}
                              className="p-1 text-purple-700 hover:bg-purple-100 rounded text-[10px] inline-flex items-center gap-0.5"
                              title="Ajouter au planning perpétuel"
                            >
                              <CalendarPlus className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5">
                          {(entry.type === 'journal' || Boolean(entry.noteId && entry.sourceId)) && (
                            <button
                              type="button"
                              onClick={() => onStartEdit(entry)}
                              className="p-1 text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                              title="Modifier"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                          {entry.type === 'journal' ? (
                            <button
                              type="button"
                              onClick={() => onDelete(entry.id, entry.type)}
                              className="p-1 text-stone-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : entry.type === 'seedling' ? (
                            <button
                              type="button"
                              onClick={() => setCurrentView(`seedling-detail-${entry.sourceId}`)}
                              className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
                              title="Voir la fiche semis"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Fill remaining spaces to complete the grid */}
        {Array.from({ length: (7 - ((blanks.length + days.length) % 7)) % 7 }).map((_, i) => (
          <div key={`end-blank-${i}`} className="bg-white min-h-[110px]" />
        ))}
      </div>

      {/* Entry Detail & Actions Modal */}
      {selectedEntry && (() => {
        const sortedUpdates = getSortedUpdates(selectedEntry.updates);
        const latestDateStr = getNoteLatestDate(selectedEntry.date, sortedUpdates);
        const canFollowUp = selectedEntry.type === 'journal' || Boolean(selectedEntry.noteId);

        return (
          <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150" onClick={() => setSelectedEntrySnapshot(null)}>
            <div 
              className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/80 bg-stone-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-medium text-stone-900 text-base">
                      {(parseSafeDate(selectedEntry.date) || new Date(selectedEntry.date)).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {selectedEntry.type === 'seedling' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <Leaf className="w-3 h-3" />
                          {selectedEntry.sourceName}
                        </span>
                      ) : selectedEntry.type === 'tree' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
                          <TreePine className="w-3 h-3" />
                          {selectedEntry.sourceName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-700 font-medium">
                          <BookOpen className="w-3 h-3" />
                          Note du journal
                        </span>
                      )}
                      {sortedUpdates.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                          <History className="w-2.5 h-2.5" />
                          Dernière MÀJ : {formatDateShortFR(latestDateStr)}
                        </span>
                      )}
                      {selectedEntry.hasDuplicate && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-300">
                          <Copy className="w-2.5 h-2.5 text-amber-600" />
                          <span>Doublon</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedEntrySnapshot(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Status Section */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
                  <span className="text-xs font-semibold text-stone-700">Statut de culture :</span>
                  {(selectedEntry.type === 'journal' || Boolean(selectedEntry.noteId && selectedEntry.sourceId)) ? (
                    <button
                      type="button"
                      onClick={() => onCycleSuccess(selectedEntry)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        selectedEntry.success === true
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold'
                          : selectedEntry.success === false
                          ? 'bg-red-100 text-red-800 border border-red-200 font-semibold'
                          : 'bg-white text-stone-600 border border-stone-300'
                      }`}
                      title="Cliquer pour basculer : Réussite / Échec / Sans statut"
                    >
                      {selectedEntry.success === true && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {selectedEntry.success === false && <XCircle className="w-3.5 h-3.5 text-red-600" />}
                      <span>
                        {selectedEntry.success === true ? 'Réussite' : selectedEntry.success === false ? 'Échec' : 'Sans statut (cliquer pour changer)'}
                      </span>
                    </button>
                  ) : (
                    <div>
                      {selectedEntry.success === true && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Réussite
                        </span>
                      )}
                      {selectedEntry.success === false && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium" title={selectedEntry.failureReason}>
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                          Échec{selectedEntry.failureReason ? ` (${selectedEntry.failureReason})` : ''}
                        </span>
                      )}
                      {selectedEntry.success === undefined && (
                        <span className="text-xs text-stone-500 italic">Sans bilan particulier</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Observation Content */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-semibold text-stone-700">Observation d'origine :</h4>
                    {canFollowUp && (
                      <button
                        type="button"
                        onClick={() => onOpenFollowUp(selectedEntry)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        <History className="w-3 h-3" />
                        <span>+ Ajouter / Gérer le suivi</span>
                      </button>
                    )}
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1">
                    {selectedEntry.title && (
                      <h3 className="text-sm font-bold text-stone-900">
                        {selectedEntry.title}
                      </h3>
                    )}
                    {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 my-1">
                        {selectedEntry.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {(selectedEntry.weatherCondition || selectedEntry.temperature !== undefined || selectedEntry.rainfall !== undefined) && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-900 border border-blue-200 my-1">
                        {selectedEntry.weatherCondition && <span>{selectedEntry.weatherCondition}</span>}
                        {selectedEntry.temperature !== undefined && (
                          <span className={selectedEntry.temperature <= 0 ? 'text-cyan-700 font-bold' : selectedEntry.temperature >= 28 ? 'text-rose-600 font-bold' : 'text-stone-800 font-semibold'}>
                            {selectedEntry.temperature > 0 ? `+${selectedEntry.temperature}` : selectedEntry.temperature}°C
                          </span>
                        )}
                        {(selectedEntry.temperatureMin !== undefined || selectedEntry.temperatureMax !== undefined) && (
                          <span className="text-[11px] text-stone-500 font-normal">
                            ({selectedEntry.temperatureMin !== undefined ? `${selectedEntry.temperatureMin}°` : ''}{selectedEntry.temperatureMin !== undefined && selectedEntry.temperatureMax !== undefined ? ' / ' : ''}{selectedEntry.temperatureMax !== undefined ? `${selectedEntry.temperatureMax}°` : ''})
                          </span>
                        )}
                        {selectedEntry.rainfall !== undefined && selectedEntry.rainfall > 0 && (
                          <span className="text-blue-700 font-medium">🌧️ {selectedEntry.rainfall} mm</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs sm:text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">
                      {selectedEntry.content}
                    </p>
                  </div>
                </div>

                {/* Dated Updates Timeline */}
                {sortedUpdates.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-amber-600" />
                      <span>Mises à jour de suivi ({sortedUpdates.length}) :</span>
                    </h4>
                    <div className="border-l-2 border-amber-300 ml-1.5 pl-3 space-y-2">
                      {sortedUpdates.map(u => (
                        <div key={u.id} className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/70 text-xs space-y-1">
                          <span className="inline-block text-[10px] font-bold text-amber-900 bg-white border border-amber-200 px-1.5 py-0.5 rounded">
                            {formatDateShortFR(u.date)}
                          </span>
                          <p className="text-stone-800 whitespace-pre-wrap leading-relaxed">{u.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Photos */}
                {selectedEntry.photos && selectedEntry.photos.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-stone-700 mb-1.5">Photos :</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedEntry.photos.map((photo, index) => (
                        <img 
                          key={index} 
                          src={photo} 
                          alt="Photo observation" 
                          className="rounded-xl w-full h-36 object-cover border border-stone-200 shadow-xs" 
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Perpetual Task Integration Section */}
                <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-purple-900 font-semibold text-xs">
                      <CalendarClock className="w-4 h-4 text-purple-600" />
                      <span>Planning perpétuel des gestes récurrents</span>
                    </div>
                  </div>

                  {selectedLinkedPerpetual ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-purple-200">
                        <div>
                          <div className="text-xs font-semibold text-purple-900">{selectedLinkedPerpetual.title}</div>
                          <div className="text-[11px] text-purple-700 mt-0.5">
                            Mois {selectedLinkedPerpetual.month} • Période : {selectedLinkedPerpetual.period}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onEditPerpetual(selectedLinkedPerpetual);
                              setSelectedEntrySnapshot(null);
                            }}
                            className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md text-xs font-medium transition-colors"
                          >
                            Modifier le geste
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentView('calendar-perpetual');
                              setSelectedEntrySnapshot(null);
                            }}
                            className="p-1 text-purple-700 hover:bg-purple-100 rounded-md"
                            title="Accéder au planning perpétuel"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePerpetual(selectedLinkedPerpetual.id);
                              setSelectedEntrySnapshot(null);
                            }}
                            className="p-1 text-purple-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                            title="Retirer ce geste du planning perpétuel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <p className="text-[11px] text-purple-800 leading-relaxed mb-2">
                        Enregistrez ce geste pour qu'il réapparaisse automatiquement chaque année dans votre calendrier perpétuel.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPerpetualModal(selectedEntry);
                          setSelectedEntrySnapshot(null);
                        }}
                        className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <CalendarPlus className="w-4 h-4" />
                        <span>Ajouter ce geste au planning perpétuel</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50/50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedEntry.type === 'journal' && (
                    <button
                      type="button"
                      onClick={() => {
                        const entryToDelete = selectedEntry;
                        setSelectedEntrySnapshot(null);
                        onDelete(entryToDelete.id, entryToDelete.type);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  )}
                  {(selectedEntry.type === 'journal' || Boolean(selectedEntry.noteId && selectedEntry.sourceId)) && (
                    <button
                      type="button"
                      onClick={() => {
                        const entryToEdit = selectedEntry;
                        setSelectedEntrySnapshot(null);
                        onStartEdit(entryToEdit);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                  )}
                  {selectedEntry.type === 'seedling' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView(`seedling-detail-${selectedEntry.sourceId}`);
                        setSelectedEntrySnapshot(null);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Voir la fiche semis
                    </button>
                  )}
                  {canFollowUp && (
                    <button
                      type="button"
                      onClick={() => onOpenFollowUp(selectedEntry)}
                      className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      + Suivi
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedEntrySnapshot(null)}
                  className="px-4 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200 rounded-lg transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
