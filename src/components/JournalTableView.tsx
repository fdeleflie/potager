import React, { useMemo } from 'react';
import { CombinedEntry } from '../views/Journal';
import { PerpetualTask } from '../db';
import { CheckCircle2, XCircle, Leaf, BookOpen, CalendarClock, CalendarPlus, ExternalLink, X, Edit, Trash2, TreePine, Copy } from 'lucide-react';

interface Props {
  entries: CombinedEntry[];
  perpetualTasks: PerpetualTask[];
  onStartEdit: (entry: CombinedEntry) => void;
  onDelete: (id: string, type: string) => void;
  onCycleSuccess: (id: string, currentSuccess?: boolean) => void;
  onOpenPerpetualModal: (entry: CombinedEntry) => void;
  onEditPerpetual: (task: PerpetualTask) => void;
  onDeletePerpetual: (perpetualId: string) => void;
  setCurrentView: (view: string) => void;
}

export function JournalTableView({ 
  entries, 
  perpetualTasks,
  onStartEdit,
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
      const d = new Date(entry.date);
      if (isNaN(d.getTime())) return;
      
      const monthYear = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      // Capitalize first letter of month
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
              <th className="px-3.5 py-3 w-28">Date</th>
              <th className="px-3.5 py-3 w-44">Plante / Type</th>
              <th className="px-3.5 py-3 w-32">Statut</th>
              <th className="px-3.5 py-3 whitespace-normal min-w-[280px]">Observation</th>
              <th className="px-3.5 py-3 w-56">Planning perpétuel</th>
              <th className="px-3.5 py-3 w-24 text-right">Actions</th>
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

                return (
                  <tr key={entry.id} className="hover:bg-stone-50/70 transition-colors group">
                    {/* Date */}
                    <td className="px-3.5 py-3 text-stone-600 text-xs font-medium">
                      {new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>

                    {/* Plant / Type */}
                    <td className="px-3.5 py-3">
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
                    <td className="px-3.5 py-3">
                      {entry.type === 'journal' ? (
                        <button
                          type="button"
                          onClick={() => onCycleSuccess(entry.id, entry.success)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                            entry.success === true
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : entry.success === false
                              ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                              : 'bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200/60'
                          }`}
                          title="Cliquer pour changer le statut (Réussite / Échec / Neutre)"
                        >
                          {entry.success === true && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                          {entry.success === false && <XCircle className="w-3.5 h-3.5 text-red-600" />}
                          {entry.success === undefined && <span className="w-2 h-2 rounded-full bg-stone-400 mr-0.5" />}
                          <span>{entry.success === true ? 'Réussite' : entry.success === false ? 'Échec' : 'Neutre'}</span>
                        </button>
                      ) : (
                        <>
                          {entry.success === true && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Réussite</span>
                            </span>
                          )}
                          {entry.success === false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium" title={entry.failureReason ? `Raison : ${entry.failureReason}` : undefined}>
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                              <span>Échec</span>
                            </span>
                          )}
                          {entry.success === undefined && (
                            <span className="text-stone-400 text-xs">-</span>
                          )}
                        </>
                      )}
                    </td>

                    {/* Observation text & photos */}
                    <td className="px-3.5 py-3 whitespace-normal text-stone-700">
                      {entry.title && (
                        <div className="font-semibold text-stone-900 text-xs mb-0.5">
                          {entry.title}
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
                      {entry.photos && entry.photos.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {entry.photos.map((p, i) => (
                            <img key={i} src={p} alt="" className="w-9 h-9 rounded-lg object-cover border border-stone-200 shadow-2xs" />
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Perpetual planning action */}
                    <td className="px-3.5 py-3">
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

                    {/* Edit & Delete / Navigate actions */}
                    <td className="px-3.5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {entry.type === 'journal' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onStartEdit(entry)}
                              className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Modifier cette note"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(entry.id, entry.type)}
                              className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer cette note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : entry.type === 'seedling' ? (
                          <button
                            type="button"
                            onClick={() => setCurrentView(`seedling-detail-${entry.sourceId}`)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-medium"
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
