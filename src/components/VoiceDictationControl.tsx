import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  RotateCcw, 
  Plus, 
  Replace, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Lock, 
  ExternalLink, 
  X, 
  HelpCircle,
  RefreshCw
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  compact?: boolean;
}

// Map common spoken French punctuation
function cleanFrenchSpeech(text: string): string {
  let res = text;
  // Common oral punctuation
  res = res.replace(/\s+à la ligne\s*/gi, '\n');
  res = res.replace(/\s+nouveau paragraphe\s*/gi, '\n\n');
  res = res.replace(/\s+point d'interrogation\s*/gi, '? ');
  res = res.replace(/\s+point d'exclamation\s*/gi, '! ');
  res = res.replace(/\s+deux points\s*/gi, ': ');
  res = res.replace(/\s+point virgule\s*/gi, '; ');
  res = res.replace(/\s+virgule\s*/gi, ', ');
  res = res.replace(/\s+point\s+/gi, '. ');
  res = res.replace(/\s+point$/gi, '.');
  
  // Capitalize first letter of sentences
  res = res.replace(/(^|[.?!]\s+)([a-zà-öø-ÿ])/g, (match, prefix, char) => prefix + char.toUpperCase());
  return res;
}

export function VoiceDictationControl({
  value,
  onChange,
  className = '',
  compact = false
}: Props) {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [interimText, setInterimText] = useState<string>('');
  const [lastOriginalText, setLastOriginalText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const baseTextRef = useRef<string>('');
  const modeRef = useRef<'append' | 'replace'>('append');
  const accumulatedTranscriptRef = useRef<string>('');

  // Detect whether we are embedded inside an iframe (like AI Studio preview)
  const isEmbeddedInIframe = typeof window !== 'undefined' && window.self !== window.top;

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += trans + ' ';
          } else {
            currentInterim += trans;
          }
        }

        if (finalTranscript) {
          accumulatedTranscriptRef.current += finalTranscript;
        }

        const totalSpoken = cleanFrenchSpeech(
          (accumulatedTranscriptRef.current + (currentInterim ? ' ' + currentInterim : '')).trim()
        );
        setInterimText(totalSpoken);

        // Apply immediately to the note depending on selected mode
        if (modeRef.current === 'replace') {
          onChange(totalSpoken);
        } else {
          // Append mode
          const base = baseTextRef.current.trim();
          if (!base) {
            onChange(totalSpoken);
          } else {
            const separator = base.endsWith('\n') ? '' : (base.endsWith('.') || base.endsWith('!') || base.endsWith('?')) ? ' ' : '. ';
            onChange(base + separator + totalSpoken);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error event:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMessage('Microphone non autorisé par le navigateur.');
          setShowPermissionModal(true);
          stopListening();
        } else if (event.error === 'no-speech') {
          // ignore transient silence
        } else if (event.error === 'network') {
          setErrorMessage('Erreur réseau lors de la reconnaissance vocale.');
          stopListening();
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.error('Failed to initialize SpeechRecognition:', e);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [onChange]);

  /**
   * Explicitly request getUserMedia permission first.
   * This forces the browser to show its native "Allow microphone" prompt
   * which SpeechRecognition often fails to trigger on its own.
   */
  const requestMicrophoneAccess = async (): Promise<boolean> => {
    setIsRequestingPermission(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsRequestingPermission(false);
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release tracks so SpeechRecognition has free access to the audio device
      stream.getTracks().forEach(track => track.stop());
      setIsRequestingPermission(false);
      setErrorMessage(null);
      return true;
    } catch (err: any) {
      console.warn('getUserMedia audio permission error:', err);
      setIsRequestingPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission denied') || err.message?.includes('not allowed')) {
        setErrorMessage('Microphone non autorisé par le navigateur.');
        setShowPermissionModal(true);
        return false;
      }
      return true; // try anyway with SpeechRecognition
    }
  };

  const startListening = async () => {
    setErrorMessage(null);
    setFeedbackMessage(null);

    // Request/verify microphone permission explicitly first
    const hasPermission = await requestMicrophoneAccess();
    if (!hasPermission) {
      setIsListening(false);
      return;
    }

    if (!recognitionRef.current) return;
    setLastOriginalText(value);
    baseTextRef.current = value;
    accumulatedTranscriptRef.current = '';
    setInterimText('');

    try {
      recognitionRef.current.start();
      setIsListening(true);
      isListeningRef.current = true;
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          recognitionRef.current.start();
          setIsListening(true);
          isListeningRef.current = true;
        }, 200);
      } catch (e2) {}
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    isListeningRef.current = false;

    if (interimText) {
      setFeedbackMessage(
        mode === 'append' 
          ? '✓ Retranscription ajoutée à la suite de la note !' 
          : '✓ Note remplacée par la retranscription vocale !'
      );
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleRestoreOriginal = () => {
    if (lastOriginalText !== null) {
      onChange(lastOriginalText);
      setLastOriginalText(null);
      setFeedbackMessage('Texte précédent restauré');
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const handleRetryPermission = async () => {
    setShowPermissionModal(false);
    await startListening();
  };

  const handleOpenStandalone = () => {
    try {
      window.open(window.location.href, '_blank');
    } catch (e) {
      console.error(e);
    }
  };

  if (!isSupported) {
    return (
      <div className={`flex items-center gap-1.5 text-[11px] text-stone-400 ${className}`}>
        <MicOff className="w-3.5 h-3.5 text-stone-400" />
        <span>Dictée vocale non prise en charge par ce navigateur (utilisez Chrome, Edge ou Safari)</span>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Main Microphone Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleListening}
            disabled={isRequestingPermission}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer select-none disabled:opacity-50 ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse ring-2 ring-rose-400 ring-offset-1'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 hover:border-emerald-300'
            }`}
            title={isListening ? 'Arrêter la dictée vocale' : 'Démarrer la dictée vocale au micro'}
          >
            {isListening ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <Mic className="w-3.5 h-3.5" />
                <span>En écoute... (Cliquer pour arrêter)</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isRequestingPermission ? 'Demande micro...' : 'Dictée vocale'}</span>
              </>
            )}
          </button>

          {/* Mode Selector: Ajouter vs Remplacer */}
          <div className="inline-flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setMode('append')}
              className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                mode === 'append'
                  ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="Ajoute la retranscription à la suite du texte déjà écrit"
            >
              <Plus className="w-3 h-3 text-emerald-600" />
              <span>Ajouter</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('replace')}
              className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                mode === 'replace'
                  ? 'bg-white text-amber-800 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="Remplace complètement le texte de la note par la retranscription"
            >
              <Replace className="w-3 h-3 text-amber-600" />
              <span>Remplacer</span>
            </button>
          </div>
        </div>

        {/* Restore / Undo button if text was modified or replaced */}
        {lastOriginalText !== null && lastOriginalText !== value && (
          <button
            type="button"
            onClick={handleRestoreOriginal}
            className="text-[11px] text-stone-500 hover:text-stone-800 inline-flex items-center gap-1 underline cursor-pointer"
            title="Revenir au texte d'origine avant la dictée"
          >
            <RotateCcw className="w-3 h-3 text-stone-400" />
            <span>Rétablir texte précédent</span>
          </button>
        )}
      </div>

      {/* Live recording indicator & speech preview */}
      {isListening && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5 animate-fade-in shadow-2xs">
          <div className="p-1 rounded-full bg-rose-200 text-rose-700 shrink-0 mt-0.5 animate-pulse">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-800 flex items-center gap-1.5">
                <span>Parlez naturellement en français...</span>
                <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-rose-100 border border-rose-300">
                  Mode : {mode === 'append' ? 'Ajout à la suite' : 'Remplacement complet'}
                </span>
              </span>
              <button
                type="button"
                onClick={stopListening}
                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
              >
                Terminer
              </button>
            </div>
            <p className="italic text-rose-700 text-[11px] leading-relaxed">
              {interimText || "En attente de votre voix... (ex: 'Plantation de 6 pieds de tomates sous serre, bon arrosage.')"}
            </p>
          </div>
        </div>
      )}

      {/* Success feedback toast banner */}
      {feedbackMessage && (
        <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-1.5 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Error message with quick guidance */}
      {errorMessage && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs flex items-start justify-between gap-2 animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{errorMessage}</p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowPermissionModal(true)}
                  className="text-red-700 hover:text-red-900 font-bold underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Comment autoriser le micro ?</span>
                </button>

                <button
                  type="button"
                  onClick={startListening}
                  className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Réessayer</span>
                </button>

                {isEmbeddedInIframe && (
                  <button
                    type="button"
                    onClick={handleOpenStandalone}
                    className="text-stone-600 hover:text-stone-900 underline inline-flex items-center gap-1 cursor-pointer"
                    title="Certains navigateurs bloquent le micro dans l'aperçu intégré"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>Ouvrir en plein écran</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-stone-400 hover:text-stone-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Permission helper modal */}
      {showPermissionModal && (
        <div 
          className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setShowPermissionModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
                  <MicOff className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-base">
                    Autoriser l'accès au microphone
                  </h3>
                  <p className="text-xs text-stone-500">Pour utiliser la dictée vocale de vos notes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-700 leading-relaxed">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Votre navigateur bloque actuellement le micro</span>
                </p>
                <p className="text-[11px] text-amber-800">
                  Pour des raisons de sécurité, le navigateur demande votre accord avant d'activer le microphone.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-stone-800">Comment débloquer en 2 clics :</p>
                
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-stone-50 border border-stone-200/80">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                  <div>
                    <span className="font-medium">Regardez tout à gauche de votre barre d'adresse :</span>
                    <p className="text-stone-500 text-[11px]">
                      Cliquez sur l'icône de <strong>cadenas 🔒</strong> ou <strong>réglages du site ⚙️</strong> (ou sur le micro barré 🚫 à droite).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-stone-50 border border-stone-200/80">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                  <div>
                    <span className="font-medium">Activez le microphone :</span>
                    <p className="text-stone-500 text-[11px]">
                      Sur la ligne <strong>Microphone</strong>, sélectionnez <strong>« Autoriser »</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-stone-50 border border-stone-200/80">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                  <div>
                    <span className="font-medium">Cliquez sur « Réessayer » ci-dessous</span>
                    <p className="text-stone-500 text-[11px]">
                      Ou actualisez la page (F5) si nécessaire.
                    </p>
                  </div>
                </div>
              </div>

              {isEmbeddedInIframe && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5 text-[11px]">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    <span>Vous êtes dans l'aperçu AI Studio :</span>
                  </p>
                  <p className="text-[11px] text-blue-800">
                    Certains navigateurs bloquent les micros dans les cadres intégrés. Ouvrir l'application dans son propre onglet débloque immédiatement le micro.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
              {isEmbeddedInIframe ? (
                <button
                  type="button"
                  onClick={handleOpenStandalone}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ouvrir dans un nouvel onglet</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowPermissionModal(false)}
                  className="px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleRetryPermission}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réessayer l'accès micro</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
