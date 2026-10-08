import React, { useState, useEffect, useMemo } from 'react';
import { X, CloudRain, Thermometer, Save, Camera, Sparkles, CheckCircle2, Droplets, Wind, Sun, MapPin } from 'lucide-react';
import { compressImage } from '../utils/image';
import { fb, useFirebaseData } from '../hooks/useFirebaseData';
import { getCurrentWeather } from '../services/weatherService';
import { 
  getEffectiveWeatherIndicators, 
  matchBestWeatherIndicator, 
  isWeatherOptionActive,
  WeatherIndicatorItem,
  DEFAULT_WEATHER_INDICATORS
} from '../utils/weatherIndicators';
import { v4 as uuidv4 } from 'uuid';
import { useSeason } from '../contexts/SeasonContext';

export { QUICK_WEATHER_OPTIONS } from '../utils/weatherIndicators';

interface WeatherReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    id?: string;
    date?: string;
    weatherCondition?: string;
    temperature?: number;
    temperatureMin?: number;
    temperatureMax?: number;
    rainfall?: number;
    title?: string;
    content?: string;
    photos?: string[];
  };
  onSuccess?: () => void;
}

export function WeatherReadingModal({
  isOpen,
  onClose,
  initialData,
  onSuccess
}: WeatherReadingModalProps) {
  const { currentSeasonId, seasons } = useSeason();
  const { data: rawConfig } = useFirebaseData<any>('config');
  
  const weatherLocation = useMemo(() => {
    return (rawConfig || []).find((c: any) => c.id === 'weather_location' && c.type === 'setting')?.value || '';
  }, [rawConfig]);

  const effectiveIndicators = useMemo(() => {
    return getEffectiveWeatherIndicators(rawConfig);
  }, [rawConfig]);

  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [selectedCondition, setSelectedCondition] = useState<string>(initialData?.weatherCondition || '');
  const [temperature, setTemperature] = useState<string>(initialData?.temperature !== undefined ? initialData.temperature.toString() : '');
  const [temperatureMin, setTemperatureMin] = useState<string>(initialData?.temperatureMin !== undefined ? initialData.temperatureMin.toString() : '');
  const [temperatureMax, setTemperatureMax] = useState<string>(initialData?.temperatureMax !== undefined ? initialData.temperatureMax.toString() : '');
  const [rainfall, setRainfall] = useState<string>(initialData?.rainfall !== undefined ? initialData.rainfall.toString() : '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [photos, setPhotos] = useState<string[]>(initialData?.photos || []);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [liveWeatherMessage, setLiveWeatherMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDate(initialData.date || new Date().toISOString().split('T')[0]);
        setSelectedCondition(initialData.weatherCondition || '');
        setTemperature(initialData.temperature !== undefined ? initialData.temperature.toString() : '');
        setTemperatureMin(initialData.temperatureMin !== undefined ? initialData.temperatureMin.toString() : '');
        setTemperatureMax(initialData.temperatureMax !== undefined ? initialData.temperatureMax.toString() : '');
        setRainfall(initialData.rainfall !== undefined ? initialData.rainfall.toString() : '');
        setTitle(initialData.title || '');
        setContent(initialData.content || '');
        setPhotos(initialData.photos || []);
      } else {
        setDate(new Date().toISOString().split('T')[0]);
        setSelectedCondition(effectiveIndicators[0] ? `${effectiveIndicators[0].emoji} ${effectiveIndicators[0].label}` : '☀️ Ensoleillé');
        setTemperature('');
        setTemperatureMin('');
        setTemperatureMax('');
        setRainfall('');
        setTitle('Relevé météo du jour');
        setContent('');
        setPhotos([]);
      }
      setLiveWeatherMessage(null);
    }
  }, [isOpen, initialData, effectiveIndicators]);

  if (!isOpen) return null;

  const handleFetchCurrentWeather = async () => {
    setIsFetchingLive(true);
    setLiveWeatherMessage(null);
    try {
      const data = await getCurrentWeather(weatherLocation);
      if (data) {
        const matched = matchBestWeatherIndicator(effectiveIndicators, {
          weatherCode: data.weatherCode,
          temperature: data.temperature,
          rainfall: data.rainfall,
          windSpeed: data.windSpeed
        });
        setSelectedCondition(`${matched.emoji} ${matched.label}`);
        setTemperature(data.temperature.toString());
        if (data.tempMin !== undefined) setTemperatureMin(data.tempMin.toString());
        if (data.tempMax !== undefined) setTemperatureMax(data.tempMax.toString());
        if (data.rainfall !== undefined && data.rainfall > 0) setRainfall(data.rainfall.toString());
        setLiveWeatherMessage(`Météo relevée en direct pour ${data.locationName || weatherLocation || 'votre position'} !`);
      } else {
        setLiveWeatherMessage("⚠️ Ville non configurée. Veuillez renseigner votre commune dans Configuration > Météo ou autoriser l'accès GPS.");
      }
    } catch (err) {
      console.error('Failed to fetch live weather:', err);
      setLiveWeatherMessage("Erreur lors de la récupération des données météo en direct.");
    } finally {
      setIsFetchingLive(false);
    }
  };

  const handleToggleCondition = (cond: WeatherIndicatorItem) => {
    const full = `${cond.emoji} ${cond.label}`;
    if (selectedCondition === full) {
      setSelectedCondition('');
    } else {
      setSelectedCondition(full);
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
      console.error('Failed to compress photo:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const parsedTemp = temperature.trim() !== '' ? parseFloat(temperature) : undefined;
      const parsedMin = temperatureMin.trim() !== '' ? parseFloat(temperatureMin) : undefined;
      const parsedMax = temperatureMax.trim() !== '' ? parseFloat(temperatureMax) : undefined;
      const parsedRain = rainfall.trim() !== '' ? parseFloat(rainfall) : undefined;

      const fallbackText = content.trim() || (
        `Relevé météo : ${selectedCondition || 'Conditions météo'}` +
        (parsedTemp !== undefined ? ` • Température : ${parsedTemp}°C` : '') +
        (parsedRain !== undefined ? ` • Pluie : ${parsedRain} mm` : '')
      );

      const entryPayload: any = {
        title: title.trim() || 'Relevé météo',
        tags: ['❄️ Météo & Gelée'],
        date,
        content: fallbackText,
        photos,
        weatherCondition: selectedCondition || undefined,
        temperature: parsedTemp,
        temperatureMin: parsedMin,
        temperatureMax: parsedMax,
        rainfall: parsedRain,
        isDeleted: false,
        seasonId: (currentSeasonId && currentSeasonId !== 'all') ? currentSeasonId : seasons[0]?.id,
      };

      if (initialData?.id) {
        await fb.update('journal', initialData.id, entryPayload);
      } else {
        await fb.add('journal', {
          id: uuidv4(),
          ...entryPayload
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to save weather reading:', err);
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/80 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-2xs">
              <CloudRain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-base">
                {initialData?.id ? 'Modifier le relevé météo' : 'Nouveau Relevé Météo & Températures'}
              </h3>
              <p className="text-xs text-stone-500">
                Consignez la météo, le cumul de pluie et les températures du jour
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Date & Auto-Fetch Button */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-stone-700">Date du relevé :</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-stone-200 font-medium text-stone-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleFetchCurrentWeather}
              disabled={isFetchingLive}
              className="px-3 py-1 bg-gradient-to-r from-blue-50 to-sky-50 hover:from-blue-100 hover:to-sky-100 text-blue-700 border border-blue-200 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Pré-remplir automatiquement la météo actuelle via les capteurs météo en direct"
            >
              <Sparkles className={`w-3.5 h-3.5 text-blue-500 ${isFetchingLive ? 'animate-spin' : ''}`} />
              <span>{isFetchingLive ? 'Chargement météo...' : 'Météo en direct'}</span>
            </button>
          </div>

          {liveWeatherMessage && (
            <div className={`p-2.5 rounded-lg text-xs font-medium animate-fade-in ${
              liveWeatherMessage.startsWith('⚠️') 
                ? 'bg-amber-50 text-amber-900 border border-amber-200' 
                : 'bg-blue-50 text-blue-900 border border-blue-200'
            }`}>
              {liveWeatherMessage}
            </div>
          )}

          {/* Mini 1-Click Weather Indicators */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-stone-700 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Indicateur météo (1 clic) :</span>
              </label>
              {selectedCondition && (
                <button
                  type="button"
                  onClick={() => setSelectedCondition('')}
                  className="text-[11px] text-stone-400 hover:text-stone-700 underline cursor-pointer"
                >
                  Effacer
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
              {effectiveIndicators.map(cond => {
                const isSelected = isWeatherOptionActive(selectedCondition, cond);
                return (
                  <button
                    key={cond.id}
                    type="button"
                    onClick={() => handleToggleCondition(cond)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected ? `${cond.activeClass} ring-2 ring-emerald-500 font-bold shadow-xs scale-102` : cond.colorClass
                    }`}
                  >
                    <span className="text-sm leading-none">{cond.emoji}</span>
                    <span className="truncate">{cond.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Temperature & Rain inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50/80 p-3 rounded-xl border border-stone-200/80">
            {/* Température ponctuelle / Relevée */}
            <div className="space-y-1">
              <label className="font-semibold text-stone-700 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                <span>Température :</span>
              </label>
              <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200">
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={e => setTemperature(e.target.value)}
                  placeholder="21"
                  className="w-full text-xs font-semibold text-stone-900 outline-none"
                />
                <span className="text-stone-400 font-medium">°C</span>
              </div>
            </div>

            {/* Min / Max */}
            <div className="space-y-1">
              <label className="font-semibold text-stone-700 flex items-center gap-1">
                <span className="text-blue-600 font-bold">Min</span> / <span className="text-red-600 font-bold">Max</span> :
              </label>
              <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded-lg border border-stone-200">
                <input
                  type="number"
                  step="0.1"
                  value={temperatureMin}
                  onChange={e => setTemperatureMin(e.target.value)}
                  placeholder="12"
                  className="w-12 text-xs font-semibold text-blue-700 outline-none"
                  title="Température minimale"
                />
                <span className="text-stone-300">/</span>
                <input
                  type="number"
                  step="0.1"
                  value={temperatureMax}
                  onChange={e => setTemperatureMax(e.target.value)}
                  placeholder="24"
                  className="w-12 text-xs font-semibold text-red-700 outline-none"
                  title="Température maximale"
                />
                <span className="text-stone-400 font-medium">°C</span>
              </div>
            </div>

            {/* Précipitations (Pluie) */}
            <div className="space-y-1">
              <label className="font-semibold text-stone-700 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-blue-500" />
                <span>Pluie / Pluviomètre :</span>
              </label>
              <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={rainfall}
                  onChange={e => setRainfall(e.target.value)}
                  placeholder="0"
                  className="w-full text-xs font-semibold text-blue-700 outline-none"
                />
                <span className="text-stone-400 font-medium">mm</span>
              </div>
            </div>
          </div>

          {/* Observations complémentaires */}
          <div className="space-y-1.5">
            <label className="font-semibold text-stone-700">Observations / Commentaires :</label>
            <textarea
              rows={2}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Ex: Forte gelée blanche ce matin à -2°C, sol gelé sur 1cm. Arrosage naturel par 12mm de pluie dans la nuit..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-stone-700 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-stone-500" />
                <span>Photos du relevé :</span>
              </label>
              <label className="cursor-pointer text-xs text-blue-600 hover:text-blue-700 font-medium underline flex items-center gap-1">
                <span>+ Ajouter une photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isUploadingPhoto}
                />
              </label>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-stone-200 aspect-video group">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 bg-white/80 hover:bg-white text-stone-700 rounded-full shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Save Button */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer le relevé météo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
