import React, { useState, useEffect, useMemo } from 'react';
import { CombinedEntry } from '../views/Journal';
import { X, Save, Camera, CheckCircle2, XCircle, Trash2, Calendar, Tag, Thermometer, Droplets, CloudRain, Sparkles } from 'lucide-react';
import { compressImage } from '../utils/image';
import { fb, useFirebaseData } from '../hooks/useFirebaseData';
import { getEffectiveWeatherIndicators, matchBestWeatherIndicator, isWeatherOptionActive, WeatherIndicatorItem } from '../utils/weatherIndicators';
import { getCurrentWeather } from '../services/weatherService';
import { VoiceDictationControl } from './VoiceDictationControl';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entry: CombinedEntry | null;
  onDelete?: (id: string, type: string) => void;
  availableTags?: string[];
}

export function JournalEditModal({ isOpen, onClose, entry, onDelete, availableTags = [] }: Props) {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [statut, setStatut] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [successStatus, setSuccessStatus] = useState<'none' | 'success' | 'failure'>('none');
  const [weatherCondition, setWeatherCondition] = useState('');
  const [temperature, setTemperature] = useState('');
  const [temperatureMin, setTemperatureMin] = useState('');
  const [temperatureMax, setTemperatureMax] = useState('');
  const [rainfall, setRainfall] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const { data: rawConfig } = useFirebaseData<any>('config');
  const effectiveIndicators = useMemo(() => getEffectiveWeatherIndicators(rawConfig), [rawConfig]);
  const weatherLocation = useMemo(() => {
    return (rawConfig || []).find((c: any) => c.id === 'weather_location' && c.type === 'setting')?.value || '';
  }, [rawConfig]);

  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [autoWeatherFeedback, setAutoWeatherFeedback] = useState<string | null>(null);

  const handleFetchAutoWeather = async () => {
    setIsFetchingWeather(true);
    setAutoWeatherFeedback(null);
    try {
      const data = await getCurrentWeather(weatherLocation);
      if (data) {
        const matched = matchBestWeatherIndicator(effectiveIndicators, {
          weatherCode: data.weatherCode,
          temperature: data.temperature,
          rainfall: data.rainfall,
          windSpeed: data.windSpeed
        });
        const finalCondition = `${matched.emoji} ${matched.label}`;
        setWeatherCondition(finalCondition);
        setTemperature(data.temperature.toString());
        if (data.tempMin !== undefined) setTemperatureMin(data.tempMin.toString());
        if (data.tempMax !== undefined) setTemperatureMax(data.tempMax.toString());
        if (data.rainfall !== undefined && data.rainfall > 0) setRainfall(data.rainfall.toString());
        if (!tags.includes('❄️ Météo & Gelée')) {
          setTags(prev => [...prev, '❄️ Météo & Gelée']);
        }
        setAutoWeatherFeedback(`✓ Validé : ${finalCondition} (${data.temperature}°C)`);
        setTimeout(() => setAutoWeatherFeedback(null), 4000);
      } else {
        setAutoWeatherFeedback("⚠️ Ville non configurée ou GPS indisponible");
        setTimeout(() => setAutoWeatherFeedback(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setAutoWeatherFeedback("Erreur relevé météo");
      setTimeout(() => setAutoWeatherFeedback(null), 3000);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  useEffect(() => {
    if (entry && isOpen) {
      setTitle(entry.title || '');
      setTags(entry.tags || []);
      setContent(entry.content || '');
      setDate(entry.date || new Date().toISOString().split('T')[0]);
      setStatut(entry.statut || (entry.success === true ? 'Réussite' : entry.success === false ? 'Échec' : 'Fait'));
      setPhotos(entry.photos || []);
      setSuccessStatus(
        entry.success === true ? 'success' :
        entry.success === false ? 'failure' : 'none'
      );
      setWeatherCondition(entry.weatherCondition || '');
      setTemperature(entry.temperature !== undefined ? entry.temperature.toString() : '');
      setTemperatureMin(entry.temperatureMin !== undefined ? entry.temperatureMin.toString() : '');
      setTemperatureMax(entry.temperatureMax !== undefined ? entry.temperatureMax.toString() : '');
      setRainfall(entry.rainfall !== undefined ? entry.rainfall.toString() : '');
    }
  }, [entry, isOpen]);

  if (!isOpen || !entry) return null;

  const handleToggleTag = (tag: string) => {
    setTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleToggleWeather = (opt: any) => {
    const full = `${opt.emoji} ${opt.label}`;
    if (weatherCondition === full) {
      setWeatherCondition('');
    } else {
      setWeatherCondition(full);
      // Also attach weather tag if not present
      if (!tags.includes('❄️ Météo & Gelée')) {
        setTags(prev => [...prev, '❄️ Météo & Gelée']);
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const base64 = await compressImage(file, 800, 800, 0.7);
      setPhotos(prev => [...prev, base64]);
    } catch (err) {
      console.error('Failed to compress image:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !entry) return;

    setIsSaving(true);
    try {
      const isSuccess = successStatus === 'success' || statut.toLowerCase().includes('réussi') || statut.toLowerCase().includes('succès');
      const isFailure = successStatus === 'failure' || statut.toLowerCase().includes('échec') || statut.toLowerCase().includes('raté');

      await fb.update('journal', entry.id, {
        title: title.trim() || undefined,
        description: title.trim() || undefined,
        statut: statut.trim() || (isSuccess ? 'Réussite' : isFailure ? 'Échec' : 'Fait'),
        commentaire: content.trim(),
        tags: tags.length > 0 ? tags : [],
        content: content.trim(),
        date,
        photos,
        successStatus: isSuccess ? 'success' : isFailure ? 'failure' : successStatus,
        success: isSuccess ? true : isFailure ? false : undefined,
        weatherCondition: weatherCondition || undefined,
        temperature: temperature.trim() !== '' ? parseFloat(temperature) : undefined,
        temperatureMin: temperatureMin.trim() !== '' ? parseFloat(temperatureMin) : undefined,
        temperatureMax: temperatureMax.trim() !== '' ? parseFloat(temperatureMax) : undefined,
        rainfall: rainfall.trim() !== '' ? parseFloat(rainfall) : undefined
      });
      onClose();
    } catch (err) {
      console.error('Failed to update journal entry:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/80 bg-stone-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif font-medium text-stone-900 text-base">Modifier l'observation</h2>
              <p className="text-xs text-stone-500">Mettez à jour le texte, la date, les photos ou le statut.</p>
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

        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Titre de l'observation (optionnel)
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Première récolte de courgettes, Taille des tomates..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-800 placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
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
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
              <span>Statut de l'observation</span>
              <span className="text-[11px] font-normal text-stone-400">Intégration outil : {statut || 'Fait'}</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
              {[
                { label: 'Fait', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
                { label: 'En cours', color: 'bg-amber-50 text-amber-800 border-amber-300' },
                { label: 'À faire', color: 'bg-blue-50 text-blue-800 border-blue-300' },
                { label: 'Réussite', color: 'bg-emerald-600 text-white border-emerald-600' },
                { label: 'Échec', color: 'bg-red-600 text-white border-red-600' },
                { label: 'Neutre', color: 'bg-stone-100 text-stone-700 border-stone-300' }
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setStatut(item.label);
                    if (item.label === 'Réussite') setSuccessStatus('success');
                    else if (item.label === 'Échec') setSuccessStatus('failure');
                    else setSuccessStatus('none');
                  }}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                    statut === item.label
                      ? 'ring-2 ring-emerald-500 shadow-2xs font-bold scale-102 ' + item.color
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={statut}
              onChange={e => setStatut(e.target.value)}
              placeholder="Ou saisissez un statut personnalisé (ex: Validé, Récolté...)"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Quick Activity Tags */}
          {availableTags && availableTags.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tags d'activités</span>
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {availableTags.map(tag => {
                  const isSelected = tags.includes(tag);
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

          {/* Quick Weather Indicators & Temperature */}
          <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/80 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                <span>Météo & Indicateurs en 1 clic</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFetchAutoWeather}
                  disabled={isFetchingWeather}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Récupérer la météo en direct et sélectionner l'indicateur automatiquement"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isFetchingWeather ? 'animate-spin' : ''}`} />
                  <span>{isFetchingWeather ? 'Relevé...' : weatherLocation ? `Météo auto (${weatherLocation})` : 'Météo auto (GPS)'}</span>
                </button>

                {weatherCondition && (
                  <button
                    type="button"
                    onClick={() => {
                      setWeatherCondition('');
                      setAutoWeatherFeedback(null);
                    }}
                    className="text-[11px] text-stone-400 hover:text-stone-600 underline cursor-pointer"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>

            {autoWeatherFeedback && (
              <div className="p-2 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs font-medium flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{autoWeatherFeedback}</span>
              </div>
            )}

            {/* Weather Emojis Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
              {effectiveIndicators.map(opt => {
                const isSelected = isWeatherOptionActive(weatherCondition, opt);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleToggleWeather(opt)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected ? `${opt.activeClass} ring-2 ring-emerald-500 font-bold shadow-xs scale-102` : opt.colorClass
                    }`}
                  >
                    <span className="text-sm leading-none">{opt.emoji}</span>
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Temperature & Rainfall inline inputs */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-stone-200/60">
              <div>
                <label className="block text-[10px] font-semibold text-stone-600 mb-0.5 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-orange-500" />
                  <span>T° (°C)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={e => setTemperature(e.target.value)}
                  placeholder="ex: 18.5"
                  className="w-full px-2 py-1 text-xs rounded-lg border border-stone-200 bg-white text-stone-900 outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-stone-600 mb-0.5">
                  <span className="text-blue-500 font-bold">Min</span> / <span className="text-red-500 font-bold">Max</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={temperatureMin}
                    onChange={e => setTemperatureMin(e.target.value)}
                    placeholder="Min"
                    className="w-1/2 px-1.5 py-1 text-xs rounded-lg border border-stone-200 bg-white text-stone-900 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={temperatureMax}
                    onChange={e => setTemperatureMax(e.target.value)}
                    placeholder="Max"
                    className="w-1/2 px-1.5 py-1 text-xs rounded-lg border border-stone-200 bg-white text-stone-900 outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-stone-600 mb-0.5 flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span>Pluie (mm)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={rainfall}
                  onChange={e => setRainfall(e.target.value)}
                  placeholder="ex: 8"
                  className="w-full px-2 py-1 text-xs rounded-lg border border-stone-200 bg-white text-stone-900 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700">
              Contenu de la note / observation
            </label>
            <VoiceDictationControl 
              value={content}
              onChange={setContent}
            />
            <textarea
              required
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Décrivez vos observations, la météo, un geste accompli (ou dictez oralement au micro)..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-y"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-700">Photos</label>
              <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium">
                <Camera className="w-3.5 h-3.5" />
                <span>{isUploadingPhoto ? 'Chargement...' : '+ Ajouter une photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploadingPhoto}
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group rounded-xl overflow-hidden border border-stone-200 aspect-video bg-stone-100">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors opacity-90"
                      title="Supprimer cette photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">Aucune photo jointe.</p>
            )}
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            {onDelete && entry.type === 'journal' ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(entry.id, entry.type);
                }}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            ) : <div />}

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
                disabled={isSaving || !content.trim()}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
