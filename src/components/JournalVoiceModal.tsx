import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Save, CheckCircle2, AlertCircle, RotateCcw, Trash2, Calendar, Tag, Sparkles } from 'lucide-react';
import { fb } from '../hooks/useFirebaseData';
import { v4 as uuidv4 } from 'uuid';
import { Season, JournalEntry } from '../db';
import { useSeason } from '../contexts/SeasonContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  availableTags?: string[];
}

export function JournalVoiceModal({ isOpen, onClose, availableTags = [] }: Props) {
  const { currentSeasonId, seasons } = useSeason();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [statut, setStatut] = useState('Fait');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [dictationMode, setDictationMode] = useState<'append' | 'replace'>('append');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState(false);

  const recognitionRef = useRef<any>(null);
  const interimTextRef = useRef('');

  useEffect(() => {
    // Check SpeechRecognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'fr-FR';

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          if (final) {
            setContent(prev => {
              const cleanedFinal = final.trim();
              if (!cleanedFinal) return prev;
              if (dictationMode === 'replace') {
                return cleanedFinal;
              } else {
                // append with proper spacing
                return prev ? `${prev.trim()} ${cleanedFinal}` : cleanedFinal;
              }
            });
          }
          interimTextRef.current = interim;
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setSpeechError("Accès au microphone refusé. Veuillez autoriser le microphone dans votre navigateur.");
          } else if (event.error !== 'no-speech') {
            setSpeechError(`Erreur vocale : ${event.error}`);
          }
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Could not initialize SpeechRecognition:', e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [dictationMode]);

  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("La dictée vocale n'est pas supportée par votre navigateur actuel (essayez Chrome ou Safari).");
      return;
    }

    setSpeechError(null);
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
    } else {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.start();
          setIsRecording(true);
        }
      } catch (e) {
        console.error('Failed to start recognition:', e);
        setSpeechError("Impossible de démarrer l'enregistrement vocal.");
        setIsRecording(false);
      }
    }
  };

  if (!isOpen) return null;

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSaving) return;

    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsRecording(false);
    }

    setIsSaving(true);
    try {
      const isSuccess = statut.toLowerCase().includes('réussi') || statut.toLowerCase().includes('succès') || statut.toLowerCase().includes('fait');
      const isFailure = statut.toLowerCase().includes('échec') || statut.toLowerCase().includes('raté');

      const entry: JournalEntry = {
        id: uuidv4(),
        title: title.trim() || undefined,
        description: title.trim() || undefined,
        commentaire: content.trim(),
        statut: statut.trim() || 'Fait',
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        date,
        content: content.trim(),
        photos: [],
        isDeleted: false,
        seasonId: (currentSeasonId && currentSeasonId !== 'all') ? currentSeasonId : seasons[0]?.id,
        successStatus: isSuccess ? 'success' : isFailure ? 'failure' : 'none',
        success: isSuccess ? true : isFailure ? false : undefined
      };

      await fb.add('journal', entry);
      setSuccessFeedback(true);
      setTimeout(() => {
        setSuccessFeedback(false);
        setTitle('');
        setContent('');
        setSelectedTags([]);
        setStatut('Fait');
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to save voice note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/80 bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-2xs transition-all ${
              isRecording 
                ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-stone-900 text-base sm:text-lg">
                  Dictée vocale d'observation
                </h2>
                {isRecording && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 animate-pulse">
                    En écoute...
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">
                Parlez pour transcrire automatiquement votre note au potager
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isRecording && recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {}
              }
              onClose();
            }}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success feedback */}
        {successFeedback && (
          <div className="m-5 mb-0 p-3 bg-emerald-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Note dictée et enregistrée avec succès dans le journal !</span>
          </div>
        )}

        {/* Speech error */}
        {speechError && (
          <div className="m-5 mb-0 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{speechError}</span>
            </div>
            <button onClick={() => setSpeechError(null)} className="text-stone-400 hover:text-stone-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Big Mic Button & Mode */}
          <div className="flex flex-col items-center justify-center p-6 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-4">
            <button
              type="button"
              onClick={toggleRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700 text-white ring-8 ring-rose-200 animate-bounce'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-100 hover:scale-105'
              }`}
              title={isRecording ? 'Arrêter la dictée' : 'Démarrer la dictée vocale'}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>

            <div className="text-center">
              <p className="text-xs font-bold text-stone-800">
                {isRecording ? "🔴 Enregistrement en cours... Parlez clairement." : "Cliquez sur le micro pour dicter"}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                La transcription apparaît en direct dans le champ ci-dessous.
              </p>
            </div>

            {/* Append vs Replace mode */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-stone-600">Mode dictée :</span>
              <div className="inline-flex rounded-lg bg-stone-200/70 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDictationMode('append')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    dictationMode === 'append' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Ajouter la nouvelle dictée à la suite du texte existant"
                >
                  Compléter / Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setDictationMode('replace')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    dictationMode === 'replace' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Remplacer entièrement le texte existant par la nouvelle dictée"
                >
                  Remplacer
                </button>
              </div>
            </div>
          </div>

          {/* Title & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Titre de la note (optionnel)
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Semis de carottes, Météo gelée..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Date de l'observation
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Statut selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Statut de la note
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {['Fait', 'En cours', 'À faire', 'Réussite', 'Échec', 'Neutre'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatut(st)}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                    statut === st
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Transcribed content / editable textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-stone-700">
                Transcription de la note (modifiable manuellement)
              </label>
              <button
                type="button"
                onClick={() => setContent('')}
                className="text-[11px] text-stone-400 hover:text-red-600 underline cursor-pointer"
              >
                Effacer le texte
              </button>
            </div>
            <textarea
              required
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Le texte dicté s'affichera ici en temps réel. Vous pouvez aussi le compléter ou le corriger manuellement..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed resize-y"
            />
          </div>

          {/* Quick Tags */}
          {availableTags && availableTags.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tags d'activités</span>
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {availableTags.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-emerald-50 hover:text-emerald-800'
                      }`}
                    >
                      <span>{tag}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSaving || !content.trim()}
              className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer dans le journal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
