import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, History, Plus, Calendar, Edit2, Trash2, Check, Save, CheckCircle2, XCircle, Edit } from 'lucide-react';
import { NoteUpdate } from '../db';
import { formatDateShortFR, getSortedUpdates, toDateKey } from '../utils/notes';
import { VoiceDictationControl } from './VoiceDictationControl';

interface NoteFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  sourceLabel?: string;
  originDate: string;
  originText: string;
  updates: NoteUpdate[];
  onSaveUpdates: (nextUpdates: NoteUpdate[]) => Promise<void>;
  successStatus?: 'none' | 'success' | 'failure';
  onChangeSuccessStatus?: (next: 'none' | 'success' | 'failure') => Promise<void> | void;
  onOpenEdit?: () => void;
}

export function NoteFollowUpModal({
  isOpen,
  onClose,
  title,
  sourceLabel,
  originDate,
  originText,
  updates,
  onSaveUpdates,
  successStatus,
  onChangeSuccessStatus,
  onOpenEdit
}: NoteFollowUpModalProps) {
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newText, setNewText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editUpdateDate, setEditUpdateDate] = useState('');
  const [editUpdateText, setEditUpdateText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewDate(new Date().toISOString().split('T')[0]);
      setNewText('');
      setEditingUpdateId(null);
    }
  }, [isOpen]);

  const sortedUpdates = useMemo(() => getSortedUpdates(updates), [updates]);

  if (!isOpen) return null;

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || !newDate || isSaving) return;

    setIsSaving(true);
    try {
      const nextUpdate: NoteUpdate = {
        id: uuidv4(),
        date: newDate,
        text: newText.trim()
      };
      const nextList = getSortedUpdates([...sortedUpdates, nextUpdate]);
      await onSaveUpdates(nextList);
      setNewText('');
      setNewDate(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error('Failed to add note update:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEditUpdate = (u: NoteUpdate) => {
    setEditingUpdateId(u.id);
    setEditUpdateDate(toDateKey(u.date) || new Date().toISOString().split('T')[0]);
    setEditUpdateText(u.text);
  };

  const handleSaveEditUpdate = async (updateId: string) => {
    if (!editUpdateText.trim() || !editUpdateDate || isSaving) return;
    setIsSaving(true);
    try {
      const nextList = getSortedUpdates(
        sortedUpdates.map(u =>
          u.id === updateId
            ? { ...u, date: editUpdateDate, text: editUpdateText.trim() }
            : u
        )
      );
      await onSaveUpdates(nextList);
      setEditingUpdateId(null);
    } catch (err) {
      console.error('Failed to edit note update:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const nextList = sortedUpdates.filter(u => u.id !== updateId);
      await onSaveUpdates(nextList);
    } catch (err) {
      console.error('Failed to delete note update:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/80 bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif font-medium text-stone-900 text-base">
                Suivi daté & Mises à jour
              </h2>
              <p className="text-xs text-stone-500">
                {sourceLabel ? `${sourceLabel} • ` : ''}
                La note d'origine reste conservée avec sa date initiale.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Original note context */}
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                <Calendar className="w-3 h-3 text-emerald-600" />
                <span>Origine : {formatDateShortFR(originDate) || originDate}</span>
              </span>
              {sortedUpdates.length > 0 && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  {sortedUpdates.length} mise{sortedUpdates.length > 1 ? 's' : ''} à jour
                </span>
              )}
            </div>
            {title && (
              <div className="text-xs font-bold text-stone-900 pt-0.5">{title}</div>
            )}
            <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">
              {originText || <span className="italic text-stone-400">Aucun texte d'origine</span>}
            </p>
            {onChangeSuccessStatus && (
              <div className="pt-2 mt-1 border-t border-stone-200/70 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-stone-600">Statut de la note :</span>
                <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-white">
                  <button
                    type="button"
                    onClick={() => onChangeSuccessStatus('none')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                      (successStatus || 'none') === 'none'
                        ? 'bg-stone-100 text-stone-800 font-semibold'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Sans statut
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSuccessStatus('success')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all inline-flex items-center gap-1 cursor-pointer ${
                      successStatus === 'success'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-stone-500 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Réussite
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSuccessStatus('failure')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all inline-flex items-center gap-1 cursor-pointer ${
                      successStatus === 'failure'
                        ? 'bg-red-600 text-white font-semibold'
                        : 'text-stone-500 hover:text-red-700'
                    }`}
                  >
                    <XCircle className="w-3 h-3" />
                    Échec
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add new follow-up update */}
          <form onSubmit={handleAddUpdate} className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ajouter une mise à jour datée</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-stone-600">Date :</span>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-stone-200 bg-white text-stone-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <VoiceDictationControl
              value={newText}
              onChange={setNewText}
              compact
            />

            <textarea
              required
              rows={3}
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Notez l'évolution observée à cette date (reprise, floraison, traitement, résultat...)..."
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white text-stone-800 placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-y"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving || !newText.trim() || !newDate}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Enregistrement...' : 'Enregistrer la mise à jour'}</span>
              </button>
            </div>
          </form>

          {/* Timeline of existing updates */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-amber-600" />
              <span>Historique des mises à jour ({sortedUpdates.length})</span>
            </h3>

            {sortedUpdates.length === 0 ? (
              <div className="p-4 text-center rounded-xl border border-dashed border-stone-200 text-xs text-stone-400 italic">
                Aucune mise à jour enregistrée pour le moment.
              </div>
            ) : (
              <div className="space-y-2 border-l-2 border-amber-200 ml-2 pl-3.5">
                {sortedUpdates.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 rounded-xl border border-stone-200/80 bg-white shadow-2xs space-y-1.5 relative"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white absolute -left-[21px] top-4" />
                    {editingUpdateId === u.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editUpdateDate}
                            onChange={e => setEditUpdateDate(e.target.value)}
                            className="px-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={editUpdateText}
                          onChange={e => setEditUpdateText(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-y"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingUpdateId(null)}
                            className="px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            disabled={isSaving || !editUpdateText.trim()}
                            onClick={() => handleSaveEditUpdate(u.id)}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" />
                            <span>Valider</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            {formatDateShortFR(u.date) || u.date}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditUpdate(u)}
                              className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Modifier cette mise à jour"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUpdate(u.id)}
                              className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Supprimer cette mise à jour"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">
                          {u.text}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50/70 flex items-center justify-between gap-2">
          {onOpenEdit ? (
            <button
              type="button"
              onClick={onOpenEdit}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Modifier la note d'origine</span>
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
