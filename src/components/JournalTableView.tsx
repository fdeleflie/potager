import React, { useMemo } from 'react';
import { CombinedEntry } from '../views/Journal';
import { PerpetualTask } from '../db';
import { formatDateShortFR, getNoteLatestDate, getSortedUpdates, parseSafeDate, toDateKey } from '../utils/notes';
import { CheckCircle2, XCircle, Leaf, BookOpen, CalendarClock, CalendarPlus, ExternalLink, X, Edit, Trash2, TreePine, Copy, History } from 'lucide-react';

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
}

export function JournalTableView({ 
  entries, 
  perpetualTasks,
  onStartEdit,
  onOpenFollowUp,
  onDelete,
  onCycleSuccess,
  onOpenPerpetualModal,
  onEditPerpetual,
  onDeletePerpetual,
  setCurrentView
}: Props) {
  const groupedEntries = useMemo(() => {
    const groups: Record<string, CombinedEntry[]> = {};
    
    entries.forEach(entry => {
      const effectiveDateStr = entry.latestDate || getNoteLatestDate(entry.date, entry.updates);
      const d = parseSafeDate(effectiveDateStr) || parseSafeDate(entry.date);
      if (!d) return;
      
      const monthYear = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const formattedMonthYear = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
      
      if (!groups[formattedMonthYear]) {
        groups[formattedMonthYear] = [];
      }
      groups[formattedMonthYear].push(entry);
    });
    
    return groups;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-xl border border-stone-200 border-dashed">
        <BookOpen className="w-8 h-8 text-stone-300 mx-auto mb-2" />
        <h3 className="text-sm font-medium text-stone-900">Aucune entrée trouvée</h3>
        <p className="text-xs text-stone-500 mt-1">Le registre est vide pour ces critères.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-medium text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-3 w-28">Date</th>
              <th className="px-3 py-3 max-w-[155px]">Plante / Type</th>
              <th className="px-3 py-3 w-28">Statut</th>
              <th className="px-3 py-3 whitespace-normal min-w-[220px]">Observation</th>
              <th className="px-3 py-3 w-44">Planning perpétuel</th>
              <th className="px-3 py-3 w-32 text-right">Actions</th>
            </tr>
          </thead>
          {Object.entries(groupedEntries).map(([monthYear, monthEntries]) => (
            <tbody key={monthYear} className="divide-y divide-stone-100">
              <tr className="bg-stone-50/70">
                <td colSpan={6} className="px-4 py-2 text-xs font-bold text-stone-700 bg-stone-100/60">
                  {monthYear} ({monthEntries.length})
                </td>
              </tr>
              {monthEntries.map(entry => {
                const linkedPerpetual = perpetualTasks.find(p => 
                  p.sourceNoteId === entry.id || 
                  (p.sourceNoteDate === entry.date && p.description === entry.content)
                );
                const sortedUpdates = getSortedUpdates(entry.updates);
                const latestDateStr = entry.latestDate || getNoteLatestDate(entry.date, sortedUpdates);
                const hasUpdates = sortedUpdates.length > 0;
                const datesDiffer = hasUpdates && toDateKey(latestDateStr) !== toDateKey(entry.date);
                const canFollowUp = entry.type === 'journal' || Boolean(entry.noteId);

                return (
                  <tr key={entry.id} className="hover:bg-stone-50/70 transition-colors group">
                    {/* Date */}
                    <td className="px-3.5 py-3 text-stone-600 text-xs font-medium align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-stone-800">
                          {formatDateShortFR(latestDateStr) || formatDateShortFR(entry.date)}
                        </span>
                        {hasUpdates && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold w-fit">
                            <History className="w-2.5 h-2.5" />
                            <span>MÀJ ({sortedUpdates.length})</span>
                          </span>
                        )}
                        {datesDiffer && (
                          <span className="text-[10px] text-stone-400">
                            Orig. : {formatDateShortFR(entry.date)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Plant / Type */}
                    <td className="px-3.5 py-3 align-top">
                      {entry.type === 'seedling' && (
                        <button
                          type="button"
                          onClick={() => setCurrentView(`seedling-detail-${entry.sourceId}`)}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium border border-emerald-200/80 transition-colors max-w-[180px] truncate"
                          title={`Voir la fiche du semis : ${entry.sourceName}`}
                        >
                          <Leaf className="w-3 h-3 shrink-0" />
                          <span className="truncate">{entry.sourceName || 'Semis'}</span>
                        </button>
                      )}

                      {entry.type === 'journal' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200/80">
                            <BookOpen className="w-3 h-3 shrink-0" />
                            <span>Journal</span>
                          </span>
                          {entry.hasDuplicate && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-300" title="Cette entrée possède des doublons identiques">
                              <Copy className="w-2.5 h-2.5 text-amber-600" />
                              <span>Doublon</span>
                            </span>
                          )}
                        </div>
                      )}

                      {entry.type === 'tree' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200/80 max-w-[180px] truncate">
                          <TreePine className="w-3 h-3 shrink-0" />
                          <span className="truncate">{entry.sourceName || 'Arbre'}</span>
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3 align-top">
                      {(entry.type === 'journal' || Boolean(entry.noteId && entry.sourceId)) ? (() => {
                        const statutLower = (entry.statut || '').toLowerCase();
                        const isSuccess = entry.success === true || statutLower.includes('réussi') || statutLower.includes('succès');
                        const isFailure = entry.success === false || statutLower.includes('échec') || statutLower.includes('raté');
                        const isInProgress = !isSuccess && !isFailure && statutLower.includes('cours');
                        const isTodo = !isSuccess && !isFailure && statutLower.includes('faire');
                        const isDone = !isSuccess && !isFailure && (statutLower.includes('fait') || statutLower.includes('terminé'));
                        const label =
                          entry.success === true ? 'Réussite' :
                          entry.success === false ? 'Échec' :
                          (entry.statut && entry.statut !== 'Neutre' ? entry.statut : 'Sans statut');

                        return (
                          <button
                            type="button"
                            onClick={() => onCycleSuccess(entry)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : isFailure
                                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                : isInProgress
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : isTodo
                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                : isDone
                                ? 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200/70'
                                : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200/60'
                            }`}
                            title="Cliquer pour changer le statut (Réussite / Échec / Sans statut)"
                          >
                            {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                            {isFailure && <XCircle className="w-3.5 h-3.5 text-red-600" />}
                            {!isSuccess && !isFailure && (
                              <span className="w-2 h-2 rounded-full bg-stone-400 mr-0.5" />
                            )}
                            <span>{label}</span>
                          </button>
                        );
                      })() : (
                        <>
                          {entry.success === true && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{entry.statut || 'Réussite'}</span>
                            </span>
                          )}
                          {entry.success === false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium" title={entry.failureReason ? `Raison : ${entry.failureReason}` : undefined}>
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                              <span>{entry.statut || 'Échec'}</span>
                            </span>
                          )}
                          {entry.success === undefined && (
                            <span className="text-stone-400 text-xs">{entry.statut || '-'}</span>
                          )}
                        </>
                      )}
                    </td>

                    {/* Observation text, updates & photos */}
                    <td className="px-3.5 py-3 whitespace-normal text-stone-700 align-top">
                      {(entry.description || entry.title) && (
                        <div className="font-semibold text-stone-900 text-xs mb-0.5">
                          {entry.description || entry.title}
                        </div>
                      )}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mb-1">
                          {entry.tags.map(tag => (
                            <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {(entry.weatherCondition || entry.temperature !== undefined || entry.rainfall !== undefined) && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50/80 text-blue-900 border border-blue-200/80 mb-1">
                          {entry.weatherCondition && <span>{entry.weatherCondition}</span>}
                          {entry.temperature !== undefined && (
                            <span className={entry.temperature <= 0 ? 'text-cyan-700 font-bold' : entry.temperature >= 28 ? 'text-rose-600 font-bold' : 'text-stone-800 font-semibold'}>
                              {entry.temperature > 0 ? `+${entry.temperature}` : entry.temperature}°C
                            </span>
                          )}
                          {(entry.temperatureMin !== undefined || entry.temperatureMax !== undefined) && (
                            <span className="text-[9px] text-stone-500 font-normal">
                              ({entry.temperatureMin !== undefined ? `${entry.temperatureMin}°` : ''}{entry.temperatureMin !== undefined && entry.temperatureMax !== undefined ? '/' : ''}{entry.temperatureMax !== undefined ? `${entry.temperatureMax}°` : ''})
                            </span>
                          )}
                          {entry.rainfall !== undefined && entry.rainfall > 0 && (
                            <span className="text-blue-700 font-medium">🌧️ {entry.rainfall}mm</span>
                          )}
                        </div>
                      )}
                      <p className="line-clamp-2 group-hover:line-clamp-none transition-all text-xs leading-relaxed">
                        {entry.content}
                      </p>
                      {sortedUpdates.length > 0 && (
                        <div className="mt-2 pl-2.5 border-l-2 border-amber-300 space-y-1 bg-amber-50/40 py-1.5 pr-2 rounded-r-lg">
                          {sortedUpdates.map(u => (
                            <div key={u.id} className="text-[11px] leading-snug text-stone-700">
                              <span className="font-bold text-amber-900 mr-1.5">
                                [{formatDateShortFR(u.date)}]
                              </span>
                              <span className="whitespace-pre-wrap">{u.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {entry.photos && entry.photos.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {entry.photos.map((p, i) => (
                            <img key={i} src={p} alt="" className="w-9 h-9 rounded-lg object-cover border border-stone-200 shadow-2xs" />
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Perpetual planning action */}
                    <td className="px-3.5 py-3 align-top">
                      {linkedPerpetual ? (
                        <div className="inline-flex items-center">
                          <button
                            type="button"
                            onClick={() => onEditPerpetual(linkedPerpetual)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 border-r-0 hover:bg-purple-100 rounded-l-lg text-xs font-medium transition-colors max-w-[140px] truncate"
                            title="Geste enregistré au planning perpétuel (cliquer pour modifier)"
                          >
                            <CalendarClock className="w-3 h-3 text-purple-600 shrink-0" />
                            <span className="truncate">{linkedPerpetual.title}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentView('calendar-perpetual')}
                            className="inline-flex items-center px-1.5 py-1 bg-purple-50 text-purple-600 border border-purple-200 border-r-0 hover:bg-purple-200/80 transition-colors"
                            title="Accéder directement au planning perpétuel"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePerpetual(linkedPerpetual.id)}
                            className="inline-flex items-center px-1.5 py-1 bg-purple-50 text-purple-400 border border-purple-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-r-lg transition-colors"
                            title="Retirer ce geste du planning perpétuel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenPerpetualModal(entry)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            entry.success === true
                              ? 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100 font-semibold shadow-2xs'
                              : 'bg-stone-50 text-stone-600 border border-stone-200 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-200'
                          }`}
                          title="Ajouter ce geste au planning perpétuel récurrent pour les années suivantes"
                        >
                          <CalendarPlus className="w-3.5 h-3.5 text-purple-600" />
                          <span>+ Au planning</span>
                        </button>
                      )}
                    </td>

                    {/* Follow-up, Edit & Delete / Navigate actions */}
                    <td className="px-3 py-3 text-right align-top">
                      <div className="flex items-center justify-end gap-1">
                        {canFollowUp && (
                          <button
                            type="button"
                            onClick={() => onOpenFollowUp(entry)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                            title="Ajouter ou consulter les mises à jour de suivi datées"
                          >
                            <History className="w-3 h-3" />
                            <span>+ Suivi</span>
                          </button>
                        )}
                        {(entry.type === 'journal' || Boolean(entry.noteId && entry.sourceId)) && (
                          <button
                            type="button"
                            onClick={() => onStartEdit(entry)}
                            className="p-1.5 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Modifier cette note"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {entry.type === 'journal' ? (
                          <button
                            type="button"
                            onClick={() => onDelete(entry.id, entry.type)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer cette note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : entry.type === 'seedling' ? (
                          <button
                            type="button"
                            onClick={() => setCurrentView(`seedling-detail-${entry.sourceId}`)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                            title="Consulter la fiche semis détaillée"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
