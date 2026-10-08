import React, { useState, useMemo } from 'react';
import { CombinedEntry } from '../views/Journal';
import { 
  History, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Image as ImageIcon,
  ExternalLink,
  BookOpen,
  Leaf,
  CalendarClock
} from 'lucide-react';

interface JournalRetrospectiveProps {
  entries: CombinedEntry[];
  currentDate?: string;
  onSelectEntry?: (entry: CombinedEntry) => void;
  onOpenPerpetualModal?: (entry: CombinedEntry) => void;
}

export function JournalRetrospective({
  entries,
  currentDate = new Date().toISOString().split('T')[0],
  onSelectEntry,
  onOpenPerpetualModal
}: JournalRetrospectiveProps) {
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('potager_journal_retrospective_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('potager_journal_retrospective_open', String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

  // Parse reference date
  const refDateObj = useMemo(() => {
    const d = new Date(selectedDate);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [selectedDate]);

  const targetDay = refDateObj.getDate();
  const targetMonth = refDateObj.getMonth(); // 0-indexed
  const targetYear = refDateObj.getFullYear();

  // Find entries in past years matching day & month (exact or within +/- 3 days window)
  const retrospectiveData = useMemo(() => {
    if (!entries || entries.length === 0) return { exactMatches: [], nearbyMatches: [] };

    const exactMatches: { yearsAgo: number; entry: CombinedEntry; isExactDay: boolean; dayDiff: number }[] = [];
    const nearbyMatches: { yearsAgo: number; entry: CombinedEntry; isExactDay: boolean; dayDiff: number }[] = [];

    entries.forEach(entry => {
      if (entry.isDeleted) return;
      const d = new Date(entry.date);
      if (isNaN(d.getTime())) return;

      const entryYear = d.getFullYear();
      if (entryYear >= targetYear) return; // Only past years!

      const yearsAgo = targetYear - entryYear;
      const entryMonth = d.getMonth();
      const entryDay = d.getDate();

      // Check if exact day & month
      if (entryMonth === targetMonth && entryDay === targetDay) {
        exactMatches.push({
          yearsAgo,
          entry,
          isExactDay: true,
          dayDiff: 0
        });
      } else {
        // Check window of +/- 3 days in the same period of the past year
        // We calculate day of year difference
        const currentYearEquivalent = new Date(targetYear, entryMonth, entryDay);
        const diffMs = currentYearEquivalent.getTime() - new Date(targetYear, targetMonth, targetDay).getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (Math.abs(diffDays) <= 3) {
          nearbyMatches.push({
            yearsAgo,
            entry,
            isExactDay: false,
            dayDiff: diffDays
          });
        }
      }
    });

    // Sort by yearsAgo asc (1 year ago first, then 2 years, etc.)
    exactMatches.sort((a, b) => a.yearsAgo - b.yearsAgo || new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime());
    nearbyMatches.sort((a, b) => a.yearsAgo - b.yearsAgo || Math.abs(a.dayDiff) - Math.abs(b.dayDiff));

    return { exactMatches, nearbyMatches };
  }, [entries, targetDay, targetMonth, targetYear]);

  const hasMatches = retrospectiveData.exactMatches.length > 0 || retrospectiveData.nearbyMatches.length > 0;
  const totalCount = retrospectiveData.exactMatches.length + retrospectiveData.nearbyMatches.length;

  const handleStepDay = (step: number) => {
    const d = new Date(refDateObj);
    d.setDate(d.getDate() + step);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleResetToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const formattedRefDate = refDateObj.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long'
  });

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-stone-50 to-emerald-500/10 rounded-2xl border border-amber-200/90 shadow-2xs overflow-hidden transition-all duration-200">
      {/* Header bar */}
      <div 
        onClick={toggleExpanded}
        className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-white/40 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
            <History className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                <span>Rétrospective historique :</span>
                <span className="text-amber-800 font-serif capitalize">{formattedRefDate}</span>
              </h3>
              {hasMatches ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300/80">
                  {totalCount} observation{totalCount > 1 ? 's' : ''} passée{totalCount > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                  Aucune note ce jour-là
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500 truncate hidden sm:block">
              {hasMatches 
                ? "Découvrez ce que vous faisiez et observiez au potager à cette même période les années précédentes." 
                : "Parcourez les saisons passées pour caler vos semis, plantations et récoltes."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {/* Quick day switcher */}
          <div className="flex items-center bg-white/80 rounded-lg border border-stone-200 p-0.5 shadow-2xs text-xs">
            <button
              type="button"
              onClick={() => handleStepDay(-1)}
              className="p-1 hover:bg-stone-100 text-stone-600 rounded cursor-pointer"
              title="Jour précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input 
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-1.5 py-0.5 text-[11px] font-medium text-stone-700 bg-transparent outline-none cursor-pointer"
              title="Changer la date de référence"
            />
            <button
              type="button"
              onClick={() => handleStepDay(1)}
              className="p-1 hover:bg-stone-100 text-stone-600 rounded cursor-pointer"
              title="Jour suivant"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {selectedDate !== new Date().toISOString().split('T')[0] && (
            <button
              type="button"
              onClick={handleResetToday}
              className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-100/80 hover:bg-amber-200/80 rounded-lg transition-colors border border-amber-200 cursor-pointer hidden md:inline-flex"
              title="Revenir à aujourd'hui"
            >
              Aujourd'hui
            </button>
          )}

          <button
            type="button"
            onClick={toggleExpanded}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
            title={isExpanded ? "Replier la rétrospective" : "Déplier la rétrospective"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-amber-200/60 space-y-3">
          {!hasMatches ? (
            <div className="py-6 px-4 bg-white/70 rounded-xl border border-stone-200/70 text-center">
              <Sparkles className="w-7 h-7 text-amber-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-stone-700">
                Aucune note enregistrée le {formattedRefDate} lors des saisons antérieures.
              </p>
              <p className="text-[11px] text-stone-500 max-w-md mx-auto mt-1">
                En enregistrant vos observations aujourd'hui, vous construirez l'historique précieux que vous retrouverez l'année prochaine !
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStepDay(-7)}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  -7 jours
                </button>
                <button
                  type="button"
                  onClick={() => handleStepDay(7)}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  +7 jours
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Exact day matches */}
              {retrospectiveData.exactMatches.map(({ yearsAgo, entry }) => {
                const entryDate = new Date(entry.date);
                const dayName = entryDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

                return (
                  <div 
                    key={entry.id}
                    className="p-3.5 bg-white rounded-xl border border-amber-200/80 shadow-2xs space-y-2 hover:border-amber-400/80 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                          <History className="w-3 h-3 text-amber-700" />
                          <span>Il y a {yearsAgo} an{yearsAgo > 1 ? 's' : ''} ({entryDate.getFullYear()})</span>
                        </span>

                        {entry.success === true && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Réussite
                          </span>
                        )}
                        {entry.success === false && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Échec
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-medium text-stone-500 capitalize">
                        {dayName}
                      </div>

                      {/* Title if present */}
                      {entry.title && (
                        <h4 className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-2">
                          {entry.title}
                        </h4>
                      )}

                      {/* Content preview */}
                      <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                        {entry.content}
                      </p>

                      {/* Photos if any */}
                      {entry.photos && entry.photos.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto pt-1">
                          {entry.photos.map((p, idx) => (
                            <img 
                              key={idx} 
                              src={p} 
                              alt="Photo d'époque" 
                              className="w-12 h-12 rounded-lg object-cover border border-stone-200 shadow-2xs" 
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom actions */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-stone-500 flex items-center gap-1 font-medium">
                        {entry.type === 'journal' ? (
                          <>
                            <BookOpen className="w-3 h-3 text-blue-600" />
                            <span>Note du journal</span>
                          </>
                        ) : (
                          <>
                            <Leaf className="w-3 h-3 text-emerald-600" />
                            <span className="truncate max-w-[140px]">{entry.sourceName || 'Semis'}</span>
                          </>
                        )}
                      </span>

                      {onOpenPerpetualModal && (
                        <button
                          type="button"
                          onClick={() => onOpenPerpetualModal(entry)}
                          className="text-purple-700 hover:text-purple-900 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                          title="Planifier ce geste réussi pour les années suivantes"
                        >
                          <CalendarClock className="w-3 h-3 text-purple-600" />
                          <span>Au planning perpétuel</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Nearby matches (+/- 3 days) */}
              {retrospectiveData.nearbyMatches.map(({ yearsAgo, entry, dayDiff }) => {
                const entryDate = new Date(entry.date);
                const dayName = entryDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                const diffLabel = dayDiff > 0 ? `+${dayDiff} jour${dayDiff > 1 ? 's' : ''}` : `${dayDiff} jour${Math.abs(dayDiff) > 1 ? 's' : ''}`;

                return (
                  <div 
                    key={entry.id}
                    className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200 shadow-2xs space-y-2 hover:border-stone-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-800 font-semibold text-[10px] flex items-center gap-1">
                          <History className="w-3 h-3 text-stone-600" />
                          <span>Il y a {yearsAgo} an{yearsAgo > 1 ? 's' : ''} ({diffLabel})</span>
                        </span>

                        {entry.success === true && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Réussite
                          </span>
                        )}
                        {entry.success === false && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Échec
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-medium text-stone-500 capitalize">
                        {dayName}
                      </div>

                      {entry.title && (
                        <h4 className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-2">
                          {entry.title}
                        </h4>
                      )}

                      <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                        {entry.content}
                      </p>

                      {entry.photos && entry.photos.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto pt-1">
                          {entry.photos.map((p, idx) => (
                            <img 
                              key={idx} 
                              src={p} 
                              alt="Photo d'époque" 
                              className="w-12 h-12 rounded-lg object-cover border border-stone-200 shadow-2xs" 
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-stone-500 flex items-center gap-1 font-medium">
                        {entry.type === 'journal' ? (
                          <>
                            <BookOpen className="w-3 h-3 text-blue-600" />
                            <span>Note du journal</span>
                          </>
                        ) : (
                          <>
                            <Leaf className="w-3 h-3 text-emerald-600" />
                            <span className="truncate max-w-[140px]">{entry.sourceName || 'Semis'}</span>
                          </>
                        )}
                      </span>

                      {onOpenPerpetualModal && (
                        <button
                          type="button"
                          onClick={() => onOpenPerpetualModal(entry)}
                          className="text-purple-700 hover:text-purple-900 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                          title="Planifier ce geste réussi pour les années suivantes"
                        >
                          <CalendarClock className="w-3 h-3 text-purple-600" />
                          <span>Au planning perpétuel</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
