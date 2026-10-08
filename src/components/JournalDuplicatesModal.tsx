import React, { useState } from 'react';
import { X, Trash2, CheckCircle2, AlertTriangle, Copy, Calendar, Eye, Sparkles, Check } from 'lucide-react';
import { ConfirmModal } from './Modals';

export interface DuplicateGroup {
  key: string;
  date: string;
  content: string;
  entries: any[];
}

interface JournalDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateGroups: DuplicateGroup[];
  onDeleteEntry: (id: string) => Promise<void>;
  onKeepOnlyThisEntry: (group: DuplicateGroup, keepId: string) => Promise<void>;
  onCleanAllDuplicates: () => Promise<void>;
  isProcessing?: boolean;
}

export function JournalDuplicatesModal({
  isOpen,
  onClose,
  duplicateGroups,
  onDeleteEntry,
  onKeepOnlyThisEntry,
  onCleanAllDuplicates,
  isProcessing = false
}: JournalDuplicatesModalProps) {
  const [confirmCleanAll, setConfirmCleanAll] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalRedundantCount = duplicateGroups.reduce(
    (acc, g) => acc + Math.max(0, g.entries.length - 1),
    0
  );

  const handleDeleteSingle = async (id: string, groupDate: string) => {
    setDeletingId(id);
    try {
      await onDeleteEntry(id);
      setActionFeedback(`Entrée du ${groupDate} supprimée.`);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeepOnly = async (group: DuplicateGroup, keepId: string) => {
    setDeletingId(keepId);
    try {
      await onKeepOnlyThisEntry(group, keepId);
      setActionFeedback(`Doublons supprimés pour le groupe du ${group.date}.`);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCleanAll = async () => {
    setConfirmCleanAll(false);
    try {
      await onCleanAllDuplicates();
      setActionFeedback('Tous les doublons superflus ont été nettoyés avec succès !');
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <ConfirmModal
        isOpen={confirmCleanAll}
        onClose={() => setConfirmCleanAll(false)}
        title="Nettoyer tous les doublons"
        message={`Voulez-vous vraiment supprimer ${totalRedundantCount} doublon(s) superflu(s) ?\nPour chaque groupe d'entrées identiques à la même date, la première note sera conservée et les copies redondantes seront effacées.`}
        confirmText="Supprimer les doublons"
        cancelText="Annuler"
        isDanger={true}
        onConfirm={handleCleanAll}
      />

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200/80 bg-stone-50/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shrink-0">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
                <span>Gestion des doublons du journal</span>
                {totalRedundantCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                    {totalRedundantCount} doublon{totalRedundantCount > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Examinez les notes ayant le même contenu et la même date, et décidez de les conserver ou de les supprimer.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action feedback */}
        {actionFeedback && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionFeedback}</span>
          </div>
        )}

        {/* Scrollable list of duplicate groups */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {duplicateGroups.length === 0 ? (
            <div className="text-center py-12 px-4 bg-stone-50 rounded-2xl border border-stone-200 border-dashed">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-stone-800">Aucun doublon dans le journal</h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                Toutes les entrées de votre journal de bord sont uniques et bien synchronisées.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          ) : (
            <>
              {/* Header banner explaining choices */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2 max-w-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>{duplicateGroups.length} groupe{duplicateGroups.length > 1 ? 's' : ''} d'entrées identiques</strong> détecté{duplicateGroups.length > 1 ? 's' : ''}. Vous pouvez supprimer chaque copie individuellement ou choisir quelle note conserver.
                  </span>
                </div>
                {totalRedundantCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmCleanAll(true)}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Nettoyer tout ({totalRedundantCount})</span>
                  </button>
                )}
              </div>

              {/* Group items */}
              {duplicateGroups.map((group, groupIdx) => (
                <div
                  key={group.key || groupIdx}
                  className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden"
                >
                  {/* Group header */}
                  <div className="px-4 py-2.5 bg-stone-50/90 border-b border-stone-200/70 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-600" />
                        {new Date(group.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                      <span className="text-xs font-semibold text-stone-700">
                        {group.entries.length} copies identiques
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleKeepOnly(group, group.entries[0]?.id)}
                      disabled={isProcessing || deletingId !== null}
                      className="text-[11px] text-amber-700 hover:text-amber-900 hover:underline font-medium flex items-center gap-1 cursor-pointer"
                      title="Garder automatiquement la première note et supprimer toutes les autres copies de ce groupe"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Garder la 1ère & supprimer les autres</span>
                    </button>
                  </div>

                  {/* Duplicate entries list in this group */}
                  <div className="divide-y divide-stone-100">
                    {group.entries.map((entry, idx) => {
                      const isFirst = idx === 0;
                      const isDeletingThis = deletingId === entry.id;

                      return (
                        <div
                          key={entry.id || idx}
                          className={`p-3.5 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                            isFirst ? 'bg-emerald-50/20' : 'bg-white hover:bg-stone-50/60'
                          }`}
                        >
                          <div className="flex-1 space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  isFirst
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-stone-100 text-stone-600 border border-stone-200'
                                }`}
                              >
                                {isFirst ? 'Copie originale (#1)' : `Copie doublon (#${idx + 1})`}
                              </span>

                              {entry.successStatus === 'success' || entry.success === true ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium inline-flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" />
                                  Réussite
                                </span>
                              ) : entry.successStatus === 'failure' || entry.success === false ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                                  Échec
                                </span>
                              ) : null}

                              {entry.photos && entry.photos.length > 0 && (
                                <span className="text-[10px] text-stone-500 font-medium">
                                  📸 {entry.photos.length} photo{entry.photos.length > 1 ? 's' : ''}
                                </span>
                              )}

                              <span className="text-[10px] text-stone-400 font-mono">
                                ID: {entry.id?.substring(0, 8)}...
                              </span>
                            </div>

                            {entry.title && (
                              <h4 className="text-xs font-bold text-stone-900 truncate">
                                {entry.title}
                              </h4>
                            )}
                            <p className="text-xs text-stone-800 whitespace-pre-wrap line-clamp-3">
                              {entry.content}
                            </p>

                            {entry.photos && entry.photos.length > 0 && (
                              <div className="flex gap-1.5 overflow-x-auto pt-1">
                                {entry.photos.map((p: string, pIdx: number) => (
                                  <img
                                    key={pIdx}
                                    src={p}
                                    alt="Miniature"
                                    className="w-10 h-10 rounded-md object-cover border border-stone-200 shrink-0"
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Individual entry actions */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {!isFirst && (
                              <button
                                type="button"
                                onClick={() => handleKeepOnly(group, entry.id)}
                                disabled={isProcessing || isDeletingThis}
                                className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                title="Conserver cette note et supprimer les autres copies du groupe"
                              >
                                Garder celle-ci
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteSingle(entry.id, group.date)}
                              disabled={isProcessing || isDeletingThis}
                              className="px-2.5 py-1 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Supprimer cette note spécifique"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                              <span>{isDeletingThis ? 'Suppression...' : 'Supprimer'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50/80 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-stone-500 hidden sm:block">
            Vous pouvez fermer cette fenêtre à tout moment sans supprimer vos notes.
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200/70 border border-stone-200 rounded-xl transition-colors cursor-pointer"
            >
              Fermer (Conserver tel quel)
            </button>
            {totalRedundantCount > 0 && (
              <button
                type="button"
                onClick={() => setConfirmCleanAll(true)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Nettoyer tous les doublons ({totalRedundantCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
