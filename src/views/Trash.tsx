import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { ConfirmModal } from '../components/Modals';

export function Trash() {
  const deletedSeedlings = useLiveQuery(() => db.seedlings.filter(s => s.isDeleted).toArray());
  const deletedJournal = useLiveQuery(() => db.journal.filter(j => j.isDeleted).toArray());

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  if (!deletedSeedlings || !deletedJournal) return <div>Chargement...</div>;

  const handleRestoreSeedling = async (id: string) => {
    await db.seedlings.update(id, { isDeleted: false });
  };

  const handlePermanentDeleteSeedling = async (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Suppression définitive',
      message: 'Voulez-vous vraiment supprimer définitivement ce semis ? Cette action est irréversible.',
      isDanger: true,
      onConfirm: async () => {
        await db.seedlings.delete(id);
      }
    });
  };

  const handleRestoreJournal = async (id: string) => {
    await db.journal.update(id, { isDeleted: false });
  };

  const handlePermanentDeleteJournal = async (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Suppression définitive',
      message: 'Voulez-vous vraiment supprimer définitivement cette note ? Cette action est irréversible.',
      isDanger: true,
      onConfirm: async () => {
        await db.journal.delete(id);
      }
    });
  };

  const handleEmptyTrash = async () => {
    setConfirmState({
      isOpen: true,
      title: 'Vider la corbeille',
      message: 'Voulez-vous vraiment vider la corbeille ? Cette action est irréversible.',
      isDanger: true,
      onConfirm: async () => {
        for (const s of deletedSeedlings) {
          await db.seedlings.delete(s.id);
        }
        for (const j of deletedJournal) {
          await db.journal.delete(j.id);
        }
      }
    });
  };

  const isEmpty = deletedSeedlings.length === 0 && deletedJournal.length === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText="Supprimer"
      />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-medium text-stone-900 flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-red-600" />
            Corbeille
          </h1>
          <p className="text-stone-500 mt-2">Restaurez les éléments supprimés ou videz la corbeille.</p>
        </div>
        {!isEmpty && (
          <button 
            onClick={handleEmptyTrash}
            className="bg-red-100 hover:bg-red-200 text-red-800 px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            Vider la corbeille
          </button>
        )}
      </header>

      {isEmpty ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 border-dashed">
          <Trash2 className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-900">La corbeille est vide</h3>
          <p className="text-stone-500 mt-1">Aucun élément supprimé récemment.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {deletedSeedlings.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 p-6">
              <h2 className="text-xl font-serif font-medium mb-4">Semis supprimés</h2>
              <div className="divide-y divide-stone-100">
                {deletedSeedlings.map(s => (
                  <div key={s.id} className="py-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-stone-900">{s.vegetable} - {s.variety}</h3>
                      <p className="text-sm text-stone-500 line-clamp-1">
                        {s.dateSown && <span>Semé le {new Date(s.dateSown).toLocaleDateString()}</span>}
                        {s.action && <span className="italic text-stone-400"> • Action: {s.action}</span>}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRestoreSeedling(s.id)}
                        className="text-emerald-600 hover:text-emerald-700 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                        title="Restaurer"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handlePermanentDeleteSeedling(s.id)}
                        className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deletedJournal.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 p-6">
              <h2 className="text-xl font-serif font-medium mb-4">Notes de journal supprimées</h2>
              <div className="divide-y divide-stone-100">
                {deletedJournal.map(j => (
                  <div key={j.id} className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-stone-900">{new Date(j.date).toLocaleDateString()}</p>
                      <p className="text-sm text-stone-500 truncate max-w-md">{j.content}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRestoreJournal(j.id)}
                        className="text-emerald-600 hover:text-emerald-700 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                        title="Restaurer"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handlePermanentDeleteJournal(j.id)}
                        className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
