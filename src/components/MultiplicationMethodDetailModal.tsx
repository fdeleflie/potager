import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Scissors, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ChevronRight, 
  Plus, 
  BookOpen, 
  Trees, 
  Sprout, 
  Clock, 
  Layers, 
  Lightbulb, 
  Wrench, 
  ShieldAlert, 
  Check, 
  ExternalLink,
  Search
} from 'lucide-react';
import { 
  MultiplicationMethod, 
  METHOD_ICONS_AND_COLORS 
} from '../data/multiplicationData';
import { 
  MULTIPLICATION_METHODS_GUIDE, 
  MethodDetail 
} from '../data/multiplicationMethodsGuide';
import { JOURNAL_MONTHS } from '../views/Journal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMethod?: MultiplicationMethod | string | null;
  plantContext?: {
    plantName: string;
    instructions?: {
      harvest: string;
      substrate: string;
      care: string;
      followUp: string;
    };
    category?: string;
  } | null;
  onStartLog?: (method: MultiplicationMethod, plantName?: string) => void;
  ownedPlantsByMethod?: Record<string, Array<{ name: string; type: string; variety?: string }>>;
}

export function MultiplicationMethodDetailModal({
  isOpen,
  onClose,
  initialMethod,
  plantContext,
  onStartLog,
  ownedPlantsByMethod = {}
}: Props) {
  // Normalize initialMethod if provided or default to 'bouture_bois_sec'
  const validMethods = Object.keys(MULTIPLICATION_METHODS_GUIDE) as MultiplicationMethod[];
  
  const getInitial = (): MultiplicationMethod => {
    if (initialMethod && validMethods.includes(initialMethod as MultiplicationMethod)) {
      return initialMethod as MultiplicationMethod;
    }
    return 'bouture_bois_sec';
  };

  const [selectedMethod, setSelectedMethod] = useState<MultiplicationMethod>(getInitial);
  const [activeTab, setActiveTab] = useState<'steps' | 'materials' | 'tips' | 'plants'>('steps');
  const [methodSearch, setMethodSearch] = useState<string>('');

  useEffect(() => {
    if (initialMethod && validMethods.includes(initialMethod as MultiplicationMethod)) {
      setSelectedMethod(initialMethod as MultiplicationMethod);
    }
  }, [initialMethod]);

  const detail: MethodDetail = MULTIPLICATION_METHODS_GUIDE[selectedMethod] || MULTIPLICATION_METHODS_GUIDE.bouture_bois_sec;
  const config = METHOD_ICONS_AND_COLORS[selectedMethod] || {
    label: detail.shortLabel,
    icon: detail.icon,
    bg: detail.badgeBg,
    text: detail.badgeText,
    border: detail.badgeBorder
  };

  const currentMonthNum = new Date().getMonth() + 1;
  const isCurrentlyInSeason = detail.seasonMonths.includes(currentMonthNum);

  // List of matching user owned plants for this method
  const ownedForThisMethod = ownedPlantsByMethod[selectedMethod] || [];

  // Filter list of methods for quick selector
  const filteredMethods = useMemo(() => {
    if (!methodSearch.trim()) return validMethods;
    const q = methodSearch.toLowerCase().trim();
    return validMethods.filter(m => {
      const d = MULTIPLICATION_METHODS_GUIDE[m];
      return (
        d.title.toLowerCase().includes(q) ||
        d.shortLabel.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.typicalPlants.some(p => p.toLowerCase().includes(q))
      );
    });
  }, [methodSearch, validMethods]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-stone-200/90 w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-stone-900 text-white p-4 sm:p-5 flex items-start justify-between gap-4 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-inner shrink-0">
              {detail.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-bold text-teal-300">
                  Fiche Technique Pépinière
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-white border border-white/20">
                  {detail.category}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-serif font-bold text-white tracking-tight">
                {detail.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onStartLog && (
              <button
                type="button"
                onClick={() => {
                  onStartLog(selectedMethod, plantContext?.plantName);
                  onClose();
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-teal-950 font-bold text-xs transition shadow-xs cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Noter une action</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Fermer la fiche"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Method Switcher Bar (Horizontal scroll on mobile, pills on desktop) */}
        <div className="bg-stone-50 border-b border-stone-200/80 px-3 sm:px-4 py-2 shrink-0 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0 mr-1 hidden md:inline">
            Méthodes :
          </span>
          {validMethods.map(m => {
            const mData = MULTIPLICATION_METHODS_GUIDE[m];
            const isSelected = selectedMethod === m;
            const count = (ownedPlantsByMethod[m] || []).length;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSelectedMethod(m);
                  setActiveTab('steps');
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-700 text-white font-bold shadow-2xs'
                    : 'bg-white text-stone-700 hover:bg-stone-200/80 border border-stone-200/80'
                }`}
                title={mData.title}
              >
                <span>{mData.icon}</span>
                <span className="truncate max-w-[120px] sm:max-w-none">{mData.shortLabel}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-teal-600 text-teal-100' : 'bg-stone-100 text-stone-600 font-bold'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Plant context banner if opened from a specific plant */}
        {plantContext && (
          <div className="bg-amber-50/90 border-b border-amber-200/90 px-4 py-2.5 flex items-center justify-between text-xs text-amber-950 gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">🌿</span>
              <span>
                Fiche ouverte pour votre plante : <strong>{plantContext.plantName}</strong>
              </span>
              <span className="text-stone-400">•</span>
              <span className="text-amber-800">
                Consultez ci-dessous le protocole général ainsi que les consignes spécifiques à cette variété.
              </span>
            </div>
            {onStartLog && (
              <button
                type="button"
                onClick={() => {
                  onStartLog(selectedMethod, plantContext.plantName);
                  onClose();
                }}
                className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer shadow-2xs"
              >
                Noter pour {plantContext.plantName}
              </button>
            )}
          </div>
        )}

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Key Indicators Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[11px] font-semibold">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                <span>Période idéale</span>
              </div>
              <p className="font-bold text-stone-900 leading-tight">
                {detail.season}
              </p>
              {isCurrentlyInSeason && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-1.5 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  De saison en ce moment !
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[11px] font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                <span>Difficulté</span>
              </div>
              <p className="font-bold text-stone-900 leading-tight">
                {detail.difficulty}
              </p>
              <span className="text-[11px] text-stone-500 block">
                Taux de reprise : <strong className="text-teal-800">{detail.successRate}</strong>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[11px] font-semibold">
                <Clock className="w-3.5 h-3.5 text-teal-700" />
                <span>Délai d'enracinement</span>
              </div>
              <p className="font-bold text-stone-900 leading-tight">
                {detail.rootingDuration}
              </p>
              <span className="text-[11px] text-stone-500 block">
                Avant transplantation
              </span>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[11px] font-semibold">
                <Trees className="w-3.5 h-3.5 text-teal-700" />
                <span>Dans votre jardin</span>
              </div>
              <p className="font-bold text-stone-900 leading-tight">
                {ownedForThisMethod.length} espèce{ownedForThisMethod.length > 1 ? 's' : ''}
              </p>
              <span className="text-[11px] text-stone-500 block truncate" title={ownedForThisMethod.map(p => p.name).join(', ')}>
                {ownedForThisMethod.length > 0 
                  ? ownedForThisMethod.slice(0, 3).map(p => p.name).join(', ') + (ownedForThisMethod.length > 3 ? '...' : '')
                  : 'Aucune plante répertoriée'}
              </span>
            </div>
          </div>

          {/* Biological Principle & Concept Card */}
          <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 text-xs text-teal-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
              <Lightbulb className="w-4 h-4 text-teal-700" />
              <span>Principe biologique & Pourquoi ça marche :</span>
            </div>
            <p className="text-teal-900/90 leading-relaxed text-xs sm:text-[13px]">
              {detail.principle}
            </p>
          </div>

          {/* Plant-Specific Instructions Card (if user clicked from a specific plant) */}
          {plantContext && plantContext.instructions && (
            <div className="bg-white rounded-2xl border-2 border-amber-300 p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                <span className="text-base">🌱</span>
                <span>Consignes spécifiques pour : <strong className="underline decoration-amber-400">{plantContext.plantName}</strong></span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/70 space-y-1">
                  <span className="font-bold text-amber-900 block">1. Prélèvement :</span>
                  <p className="text-stone-700">{plantContext.instructions.harvest}</p>
                </div>
                <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/70 space-y-1">
                  <span className="font-bold text-amber-900 block">2. Substrat & Empotage :</span>
                  <p className="text-stone-700">{plantContext.instructions.substrate}</p>
                </div>
                <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/70 space-y-1">
                  <span className="font-bold text-amber-900 block">3. Soins & Humidité :</span>
                  <p className="text-stone-700">{plantContext.instructions.care}</p>
                </div>
                <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/70 space-y-1">
                  <span className="font-bold text-amber-900 block">4. Suivi & Repiquage :</span>
                  <p className="text-stone-700">{plantContext.instructions.followUp}</p>
                </div>
              </div>
            </div>
          )}

          {/* Content Navigation Tabs */}
          <div className="border-b border-stone-200 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('steps')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'steps'
                  ? 'border-teal-700 text-teal-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Protocole pas-à-pas ({detail.steps.length} étapes)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('materials')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'materials'
                  ? 'border-teal-700 text-teal-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Matériel & Substrat ({detail.materials.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tips')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tips'
                  ? 'border-teal-700 text-teal-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Astuces & Erreurs à éviter</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('plants')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'plants'
                  ? 'border-teal-700 text-teal-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Trees className="w-3.5 h-3.5" />
              <span>Plantes compatibles ({ownedForThisMethod.length} possédées)</span>
            </button>
          </div>

          {/* TAB 1: STEP BY STEP INSTRUCTIONS */}
          {activeTab === 'steps' && (
            <div className="space-y-3.5">
              <h3 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
                <span>Protocole pas-à-pas détaillé pour réussir votre {detail.shortLabel.toLowerCase()} :</span>
              </h3>

              <div className="space-y-3">
                {detail.steps.map(step => (
                  <div
                    key={step.stepNumber}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs hover:border-teal-300 transition-colors space-y-1.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {step.stepNumber}
                      </div>
                      <div className="space-y-1 flex-1">
                        <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
                          {step.title}
                        </h4>
                        <p className="text-xs text-stone-600 leading-relaxed">
                          {step.description}
                        </p>
                        {step.tip && (
                          <div className="mt-1.5 text-[11px] text-teal-800 bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-200/60 flex items-start gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                            <span><strong>Le conseil du pépiniériste :</strong> {step.tip}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: MATERIALS */}
          {activeTab === 'materials' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-stone-200/90 space-y-3 shadow-2xs">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-teal-700" />
                  <span>Matériel, outillage & substrat recommandés :</span>
                </h3>

                <ul className="space-y-2 text-xs">
                  {detail.materials.map((mat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-stone-700">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 text-[10px]">
                        ✓
                      </span>
                      <span className="pt-0.5">{mat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs text-stone-600 space-y-2">
                <span className="font-bold text-stone-800 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-stone-500" />
                  <span>Règle d'or de propreté :</span>
                </span>
                <p className="leading-relaxed">
                  Dans toute multiplication végétative (particulièrement les boutures et le greffage), la désinfection des lames entre deux variétés est la première cause de succès. Nettoyez avec un coton imbibé d'alcool à 70° ou d'eau oxygénée pour éviter d'inoculer des virus ou chancres bactériens d'une branche à l'autre.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: PRO TIPS & MISTAKES TO AVOID */}
          {activeTab === 'tips' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Pro Tips */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-3 shadow-2xs">
                <h3 className="font-bold text-emerald-950 flex items-center gap-2 text-sm">
                  <Lightbulb className="w-4 h-4 text-emerald-700" />
                  <span>Astuces & Clés de réussite :</span>
                </h3>

                <ul className="space-y-2.5">
                  {detail.proTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-emerald-900">
                      <span className="text-emerald-600 text-sm leading-none shrink-0">•</span>
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Common Mistakes */}
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-3 shadow-2xs">
                <h3 className="font-bold text-rose-950 flex items-center gap-2 text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-700" />
                  <span>Erreurs fréquentes à éviter :</span>
                </h3>

                <ul className="space-y-2.5">
                  {detail.commonMistakes.map((err, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-rose-900">
                      <span className="text-rose-600 font-bold shrink-0">✕</span>
                      <span className="leading-relaxed">{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: COMPATIBLE PLANTS */}
          {activeTab === 'plants' && (
            <div className="space-y-4">
              {/* Owned Plants */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200/90 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-700" />
                    <span>Plantes de votre jardin compatibles avec cette méthode ({ownedForThisMethod.length}) :</span>
                  </h3>
                  <span className="text-[11px] text-stone-500">
                    Issu de vos arbres, semis et catalogue
                  </span>
                </div>

                {ownedForThisMethod.length === 0 ? (
                  <p className="text-xs text-stone-500 italic py-2">
                    Vous ne possédez actuellement aucune plante répertoriée utilisant principalement cette méthode.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {ownedForThisMethod.map((plant, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/70 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{config.icon}</span>
                          <div className="truncate">
                            <span className="font-bold text-teal-950 block truncate">
                              {plant.name}
                            </span>
                            {plant.variety && (
                              <span className="text-[10px] text-teal-700 truncate block">
                                {plant.variety}
                              </span>
                            )}
                          </div>
                        </div>

                        {onStartLog && (
                          <button
                            type="button"
                            onClick={() => {
                              onStartLog(selectedMethod, plant.name);
                              onClose();
                            }}
                            className="px-2 py-0.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-[10px] shrink-0 cursor-pointer"
                            title={`Noter une multiplication pour ${plant.name}`}
                          >
                            Noter
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Typical Reference Plants */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2">
                <h4 className="font-bold text-stone-700 text-xs">
                  Autres exemples types de plantes pour {detail.shortLabel} :
                </h4>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {detail.typicalPlants.map((plantName, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs font-medium"
                    >
                      {plantName}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-stone-50 border-t border-stone-200 p-3 sm:px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-stone-500 hidden sm:block">
            Période : <strong>{detail.season}</strong> • Taux de reprise moyen : <strong>{detail.successRate}</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onStartLog && (
              <button
                type="button"
                onClick={() => {
                  onStartLog(selectedMethod, plantContext?.plantName);
                  onClose();
                }}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Noter dans mon Journal</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
