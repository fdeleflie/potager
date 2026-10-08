import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Camera, Trash2, CalendarClock, Sparkles, CheckCircle2, CalendarRange, Star, HelpCircle } from 'lucide-react';
import { PerpetualTask } from '../db';
import { compressImage } from '../utils/image';
import { fb, useFirebaseData } from '../hooks/useFirebaseData';
import { ConfirmModal } from './Modals';

export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const PERIOD_LABELS: Record<string, string> = {
  debut: 'Début de mois (du 1er au 10)',
  mi: 'Mi-mois (du 11 au 20)',
  fin: 'Fin de mois (du 21 au 31)',
  mois_entier: 'Tout le mois'
};

export const PERIOD_SHORT_LABELS: Record<string, string> = {
  debut: 'Début',
  mi: 'Mi-mois',
  fin: 'Fin',
  mois_entier: 'Tout le mois'
};

export function getPerpetualTaskMonths(task: { month: number; endMonth?: number }): number[] {
  if (!task.month) return [];
  const start = Number(task.month);
  const end = task.endMonth ? Number(task.endMonth) : start;

  if (end === start) {
    return [start];
  }

  const months: number[] = [];
  if (end >= start) {
    for (let m = start; m <= end; m++) {
      months.push(m);
    }
  } else {
    // Crosses year boundary (e.g. Nov -> Feb)
    for (let m = start; m <= 12; m++) {
      months.push(m);
    }
    for (let m = 1; m <= end; m++) {
      months.push(m);
    }
  }
  return months;
}

export function formatPerpetualPeriod(task: {
  month: number;
  period: string;
  endMonth?: number;
  endPeriod?: string;
  optimalMonth?: number;
  optimalPeriod?: string;
}): {
  summary: string;
  isMultiMonth: boolean;
  monthsCount: number;
  optimalText?: string;
  coveredMonths: number[];
} {
  const startMonthName = MONTH_NAMES[task.month - 1] || '';
  const isMulti = Boolean(task.endMonth && Number(task.endMonth) !== Number(task.month));
  const coveredMonths = getPerpetualTaskMonths(task);

  if (!isMulti) {
    const periodLabel = PERIOD_SHORT_LABELS[task.period] || 'Mois entier';
    return {
      summary: `${startMonthName} (${periodLabel})`,
      isMultiMonth: false,
      monthsCount: 1,
      coveredMonths
    };
  }

  const endMonthName = MONTH_NAMES[Number(task.endMonth) - 1] || '';
  const startPeriodLabel = task.period !== 'mois_entier' ? (PERIOD_SHORT_LABELS[task.period] || '') : '';
  const endPeriodLabel = task.endPeriod && task.endPeriod !== 'mois_entier' ? (PERIOD_SHORT_LABELS[task.endPeriod] || '') : '';

  const summary = `De ${startPeriodLabel ? `${startPeriodLabel.toLowerCase()} ` : ''}${startMonthName} à ${endPeriodLabel ? `${endPeriodLabel.toLowerCase()} ` : ''}${endMonthName}`;

  let optimalText: string | undefined;
  if (task.optimalMonth && task.optimalMonth >= 1 && task.optimalMonth <= 12) {
    const optMonthName = MONTH_NAMES[task.optimalMonth - 1];
    const optPeriodLabel = task.optimalPeriod && task.optimalPeriod !== 'mois_entier' ? ` (${PERIOD_SHORT_LABELS[task.optimalPeriod].toLowerCase()})` : '';
    optimalText = `${optMonthName}${optPeriodLabel}`;
  }

  return {
    summary,
    isMultiMonth: true,
    monthsCount: coveredMonths.length,
    optimalText,
    coveredMonths
  };
}

export const CATEGORY_CONFIG: Record<string, { label: string; icon: string; badgeClass: string }> = {
  multiplication: { label: 'Bouturage & Multiplication', icon: '🌿', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  sowing: { label: 'Semis', icon: '🌱', badgeClass: 'bg-green-50 text-green-700 border-green-200' },
  planting: { label: 'Plantation & Repiquage', icon: '🪴', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' },
  pruning: { label: 'Taille & Pincement', icon: '✂️', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  treatment: { label: 'Soin & Traitement', icon: '💊', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  harvest: { label: 'Récolte', icon: '🧺', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  maintenance: { label: 'Entretien & Paillage', icon: '🧹', badgeClass: 'bg-stone-50 text-stone-700 border-stone-200' },
  other: { label: 'Autre geste', icon: '📌', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' }
};

export function usePerpetualCategories() {
  const { data: rawConfig } = useFirebaseData<any>('config');
  return useMemo(() => {
    const custom = (rawConfig || []).filter(c => c.type === 'perpetual_task_category');
    if (custom.length === 0) return CATEGORY_CONFIG;

    const dynamicConfig: Record<string, { label: string; icon: string; badgeClass: string }> = {};
    custom.forEach(c => {
      // Find if it matches a legacy default
      const legacyEntry = Object.entries(CATEGORY_CONFIG).find(([_, ec]) => ec.label === c.value);
      const key = legacyEntry ? legacyEntry[0] : c.value;
      const existing = legacyEntry ? legacyEntry[1] : undefined;
      
      dynamicConfig[key] = {
        label: c.value,
        icon: existing?.icon || '📌',
        badgeClass: existing?.badgeClass || 'bg-blue-50 text-blue-700 border-blue-200'
      };
    });
    return dynamicConfig;
  }, [rawConfig]);
}

interface PerpetualTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialData?: Partial<PerpetualTask>;
}

export function PerpetualTaskModal({ isOpen, onClose, onSaved, initialData }: PerpetualTaskModalProps) {
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [plant, setPlant] = useState('');
  const [category, setCategory] = useState<PerpetualTask['category']>('multiplication');
  
  // Period states
  const [isMultiMonth, setIsMultiMonth] = useState(false);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [period, setPeriod] = useState<PerpetualTask['period']>('debut');
  const [endMonth, setEndMonth] = useState<number>(new Date().getMonth() + 1);
  const [endPeriod, setEndPeriod] = useState<PerpetualTask['period']>('fin');
  const [hasOptimal, setHasOptimal] = useState(false);
  const [optimalMonth, setOptimalMonth] = useState<number>(new Date().getMonth() + 1);
  const [optimalPeriod, setOptimalPeriod] = useState<PerpetualTask['period']>('mi');

  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [sourceNoteDate, setSourceNoteDate] = useState<string | undefined>();
  const [sourceNoteId, setSourceNoteId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = usePerpetualCategories();

  useEffect(() => {
    if (isOpen) {
      setPlant(initialData?.plant || '');
      setCategory(initialData?.category || 'multiplication');
      
      const startM = initialData?.month || (new Date().getMonth() + 1);
      setMonth(startM);
      setPeriod(initialData?.period || 'debut');

      const isMulti = Boolean(initialData?.endMonth && Number(initialData.endMonth) !== Number(initialData.month));
      setIsMultiMonth(isMulti);
      setEndMonth(initialData?.endMonth || ((startM % 12) + 1));
      setEndPeriod(initialData?.endPeriod || 'fin');

      const hasOpt = Boolean(initialData?.optimalMonth);
      setHasOptimal(hasOpt);
      setOptimalMonth(initialData?.optimalMonth || startM);
      setOptimalPeriod(initialData?.optimalPeriod || 'mi');

      setDescription(initialData?.description || '');
      setPhotos(initialData?.photos || []);
      setSourceNoteDate(initialData?.sourceNoteDate);
      setSourceNoteId(initialData?.sourceNoteId);
      setError(null);
    }
  }, [isOpen, initialData]);

  // Derived preview of covered months
  const previewPeriodInfo = useMemo(() => {
    return formatPerpetualPeriod({
      month,
      period,
      endMonth: isMultiMonth ? endMonth : undefined,
      endPeriod: isMultiMonth ? endPeriod : undefined,
      optimalMonth: isMultiMonth && hasOptimal ? optimalMonth : undefined,
      optimalPeriod: isMultiMonth && hasOptimal ? optimalPeriod : undefined
    });
  }, [month, period, isMultiMonth, endMonth, endPeriod, hasOptimal, optimalMonth, optimalPeriod]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedBase64 = await compressImage(file, 800, 800, 0.7);
      setPhotos(prev => [...prev, compressedBase64]);
    } catch (err) {
      console.error('Erreur compression image', err);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSaving(true);
    setError(null);

    try {
      const catLabel = categories[category]?.label || 'Geste';
      const generatedTitle = plant.trim() ? `${catLabel} - ${plant.trim()}` : catLabel;

      const payload: Omit<PerpetualTask, 'id'> = {
        title: generatedTitle,
        plant: plant.trim() || undefined,
        category,
        month: Number(month),
        period,
        endMonth: isMultiMonth ? Number(endMonth) : undefined,
        endPeriod: isMultiMonth ? endPeriod : undefined,
        optimalMonth: isMultiMonth && hasOptimal ? Number(optimalMonth) : undefined,
        optimalPeriod: isMultiMonth && hasOptimal ? optimalPeriod : undefined,
        description: description.trim() || undefined,
        photos: photos.length > 0 ? photos : undefined,
        sourceNoteDate,
        sourceNoteId,
        isDeleted: false,
        createdAt: initialData?.createdAt || new Date().toISOString()
      };

      if (initialData?.id) {
        await fb.update('perpetualTasks', initialData.id, payload);
      } else {
        await fb.add<any>('perpetualTasks', payload);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erreur sauvegarde geste perpétuel', err);
      setError(err?.message || 'Une erreur est survenue lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    try {
      await fb.update('perpetualTasks', initialData.id, { isDeleted: true });
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erreur suppression geste perpétuel', err);
      setError('Une erreur est survenue lors de la suppression');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden my-6 border border-stone-200">
        <div className="px-5 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-medium text-stone-900">
                {initialData?.id ? 'Modifier le geste perpétuel' : 'Ajouter au planning perpétuel'}
              </h3>
              <p className="text-xs text-stone-500">
                Geste récurrent à reproduire les années suivantes
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              {error}
            </div>
          )}

          {sourceNoteDate && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Geste issu d'une observation réussie enregistrée le <strong>{new Date(sourceNoteDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</span>
            </div>
          )}

          {/* Plante */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Plante / Espèce concernée
            </label>
            <input
              type="text"
              value={plant}
              onChange={e => setPlant(e.target.value)}
              placeholder="Ex: Kiwaï, Groseilliers, Tomates, Pommier..."
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Type de geste
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {Object.entries(categories).map(([key, cfg]) => {
                const isSelected = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key as any)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border text-left transition-all ${
                      isSelected
                        ? `${cfg.badgeClass} ring-2 ring-purple-500 shadow-xs font-semibold`
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <span>{cfg.icon}</span>
                    <span className="truncate">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Période dans l'année (Option 1 : Simple ou Plage multi-mois) */}
          <div className="p-3.5 bg-stone-50/90 rounded-2xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-purple-600" />
                <span>Période d'intervention</span>
              </span>

              {/* Multi-month toggle switch */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isMultiMonth}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsMultiMonth(checked);
                    if (checked && (!endMonth || endMonth === month)) {
                      setEndMonth((month % 12) + 1);
                    }
                  }}
                  className="rounded border-stone-300 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                />
                <span className="text-xs font-medium text-purple-900">
                  S'étend sur plusieurs mois (ex: Mai à Juillet)
                </span>
              </label>
            </div>

            {!isMultiMonth ? (
              /* Single Month Mode */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Mois récurrent
                  </label>
                  <select
                    value={month}
                    onChange={e => setMonth(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Moment du mois
                  </label>
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="debut">Début de mois (1 - 10)</option>
                    <option value="mi">Mi-mois (11 - 20)</option>
                    <option value="fin">Fin de mois (21 - 31)</option>
                    <option value="mois_entier">Tout le mois</option>
                  </select>
                </div>
              </div>
            ) : (
              /* Multi-Month Range Mode */
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Start Month */}
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="block text-[11px] font-semibold text-emerald-800 mb-1.5 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      Début de la période
                    </span>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] text-stone-500 mb-0.5">Mois de début</label>
                        <select
                          value={month}
                          onChange={e => setMonth(Number(e.target.value))}
                          className="w-full text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        >
                          {MONTH_NAMES.map((m, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-stone-500 mb-0.5">Moment du mois</label>
                        <select
                          value={period}
                          onChange={e => setPeriod(e.target.value as any)}
                          className="w-full text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        >
                          <option value="debut">Début de mois (1 - 10)</option>
                          <option value="mi">Mi-mois (11 - 20)</option>
                          <option value="fin">Fin de mois (21 - 31)</option>
                          <option value="mois_entier">Tout le mois</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* End Month */}
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="block text-[11px] font-semibold text-purple-800 mb-1.5 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                      Fin de la période
                    </span>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] text-stone-500 mb-0.5">Mois de fin</label>
                        <select
                          value={endMonth}
                          onChange={e => setEndMonth(Number(e.target.value))}
                          className="w-full text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        >
                          {MONTH_NAMES.map((m, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-stone-500 mb-0.5">Moment du mois</label>
                        <select
                          value={endPeriod}
                          onChange={e => setEndPeriod(e.target.value as any)}
                          className="w-full text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        >
                          <option value="debut">Début de mois (1 - 10)</option>
                          <option value="mi">Mi-mois (11 - 20)</option>
                          <option value="fin">Fin de mois (21 - 31)</option>
                          <option value="mois_entier">Tout le mois</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Optimal / Ideal Period Sub-Option */}
                <div className="pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-stone-700 select-none">
                    <input
                      type="checkbox"
                      checked={hasOptimal}
                      onChange={e => setHasOptimal(e.target.checked)}
                      className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                    />
                    <span className="font-medium flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>Préciser un moment idéal / optimal au cœur de cette période</span>
                    </span>
                  </label>

                  {hasOptimal && (
                    <div className="mt-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[10px] font-medium text-amber-900 mb-0.5">Mois idéal</label>
                        <select
                          value={optimalMonth}
                          onChange={e => setOptimalMonth(Number(e.target.value))}
                          className="w-full text-xs px-2 py-1.5 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        >
                          {MONTH_NAMES.map((m, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-amber-900 mb-0.5">Moment du mois idéal</label>
                        <select
                          value={optimalPeriod}
                          onChange={e => setOptimalPeriod(e.target.value as any)}
                          className="w-full text-xs px-2 py-1.5 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        >
                          <option value="debut">Début de mois (1 - 10)</option>
                          <option value="mi">Mi-mois (11 - 20)</option>
                          <option value="fin">Fin de mois (21 - 31)</option>
                          <option value="mois_entier">Tout le mois</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Range Preview Box */}
                <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-purple-900">
                      {previewPeriodInfo.summary}
                      <span className="ml-1.5 text-[11px] font-normal text-purple-700">
                        ({previewPeriodInfo.monthsCount} mois : {previewPeriodInfo.coveredMonths.map(m => MONTH_NAMES[m - 1]).join(', ')})
                      </span>
                    </p>
                    {previewPeriodInfo.optimalText && (
                      <p className="text-amber-800 font-medium text-[11px] flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-400 inline shrink-0" />
                        <span>Moment idéal recommandé : <strong>{previewPeriodInfo.optimalText}</strong></span>
                      </p>
                    )}
                    <p className="text-[11px] text-purple-700/80 pt-0.5">
                      ✓ Ce geste apparaîtra automatiquement dans chacun des mois couverts sans aucune duplication.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description / Conseil / Mémo */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Conseils, méthode & retours d'expérience
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Pour le marcottage aérien du kiwaï, choisir une tige vigoureuse de l'année précédente. Inciser l'écorce, appliquer de l'hormone de bouturage ou mousse de sphaigne humide, enserrer dans un manchon plastique étanche..."
              rows={4}
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-stone-700">
                Photos / Visuels du geste
              </label>
              <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg border border-purple-200 transition-colors">
                <Camera className="w-3.5 h-3.5" />
                <span>Ajouter photo</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handlePhotoUpload} 
                />
              </label>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-stone-200 h-20 bg-stone-100">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Supprimer la photo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
            <div>
              {initialData?.id && (
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Enregistrement...' : initialData?.id ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer ce geste perpétuel"
        message="Voulez-vous vraiment supprimer ce geste du planning perpétuel ? Il n'apparaîtra plus les années suivantes."
        isDanger={true}
      />
    </div>
  );
}
