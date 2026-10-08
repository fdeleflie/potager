import { useFirebaseData, fb } from '../hooks/useFirebaseData';
import React, { useState, useEffect, useMemo } from 'react';
import { db, ConfigItem } from '../db';
import { 
  Save, 
  CloudRain, 
  Wind, 
  ThermometerSnowflake, 
  MapPin, 
  Navigation, 
  Plus, 
  Trash2, 
  Edit2, 
  Sparkles, 
  RotateCcw, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Thermometer, 
  Sun,
  Palette
} from 'lucide-react';
import { 
  DEFAULT_WEATHER_INDICATORS, 
  PRESET_WEATHER_COLOR_PALETTES, 
  WeatherIndicatorItem, 
  getEffectiveWeatherIndicators,
  matchBestWeatherIndicator
} from '../utils/weatherIndicators';
import { getCurrentWeather, resolveCoordinates } from '../services/weatherService';
import { EmojiLogoPicker, extractEmoji } from '../components/EmojiLogoPicker';
import { v4 as uuidv4 } from 'uuid';

export function WeatherSettings() {
  const { data: rawConfig, error } = useFirebaseData<any>('config');
  const config = useMemo(() => (rawConfig || []).filter(item => item.type === 'setting'), [rawConfig]);
  const weatherIndicatorsFromDb = useMemo(() => (rawConfig || []).filter(item => item.type === 'weather_indicator'), [rawConfig]);
  
  const [location, setLocation] = useState('');
  const [tempMin, setTempMin] = useState<number | ''>('');
  const [windMax, setWindMax] = useState<number | ''>('');
  const [windDirs, setWindDirs] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingError, setLocatingError] = useState<string | null>(null);

  // Live test preview
  const [isTestingWeather, setIsTestingWeather] = useState(false);
  const [testWeatherResult, setTestWeatherResult] = useState<any | null>(null);

  // Indicators management state
  const [newIndEmoji, setNewIndEmoji] = useState('🌤️');
  const [newIndLabel, setNewIndLabel] = useState('');
  const [newIndPalette, setNewIndPalette] = useState(PRESET_WEATHER_COLOR_PALETTES[0].name);
  const [newIndConditionKey, setNewIndConditionKey] = useState<string>('sun');

  const [editingIndId, setEditingIndId] = useState<string | null>(null);
  const [editingIndEmoji, setEditingIndEmoji] = useState('');
  const [editingIndLabel, setEditingIndLabel] = useState('');
  const [editingIndPalette, setEditingIndPalette] = useState(PRESET_WEATHER_COLOR_PALETTES[0].name);
  const [editingIndConditionKey, setEditingIndConditionKey] = useState<string>('sun');

  const [indicatorFeedback, setIndicatorFeedback] = useState<string | null>(null);

  const effectiveIndicators = useMemo(() => {
    return getEffectiveWeatherIndicators(rawConfig);
  }, [rawConfig]);

  useEffect(() => {
    if (config) {
      const loc = config.find(c => c.id === 'weather_location')?.value || '';
      const tMin = config.find(c => c.id === 'weather_temp_min')?.value;
      const wMax = config.find(c => c.id === 'weather_wind_max')?.value;
      const wDirs = config.find(c => c.id === 'weather_wind_dirs')?.value;

      setLocation(loc);
      setTempMin(tMin !== undefined && tMin !== '' ? Number(tMin) : '');
      setWindMax(wMax !== undefined && wMax !== '' ? Number(wMax) : '');
      setWindDirs(wDirs ? wDirs.split(',') : []);
    }
  }, [config]);

  // Handle GPS Auto-detect
  const handleDetectLocation = async () => {
    setIsLocating(true);
    setLocatingError(null);
    try {
      const coords = await resolveCoordinates();
      if (coords) {
        // Try reverse geocoding via bigdatacloud or open-meteo
        try {
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=fr`);
          const data = await res.json();
          const city = data.city || data.locality || data.principalSubdivision || '';
          const postcode = data.postcode ? ` ${data.postcode}` : '';
          const country = data.countryName ? `, ${data.countryName}` : '';
          if (city) {
            const locString = `${city}${postcode}${country}`;
            setLocation(locString);
            await fb.put('config', { id: 'weather_location', type: 'setting', value: locString });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
            return;
          }
        } catch {
          // fallback
        }
        const fallback = coords.name || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        setLocation(fallback);
        await fb.put('config', { id: 'weather_location', type: 'setting', value: fallback });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      } else {
        setLocatingError("Impossible d'obtenir la position GPS. Vérifiez les autorisations de votre navigateur.");
      }
    } catch (e: any) {
      setLocatingError(e.message || "Erreur de géolocalisation");
    } finally {
      setIsLocating(false);
    }
  };

  // Live test weather fetch
  const handleTestLiveWeather = async () => {
    setIsTestingWeather(true);
    setTestWeatherResult(null);
    try {
      const data = await getCurrentWeather(location);
      if (data) {
        const matched = matchBestWeatherIndicator(effectiveIndicators, {
          weatherCode: data.weatherCode,
          temperature: data.temperature,
          rainfall: data.rainfall,
          windSpeed: data.windSpeed
        });
        setTestWeatherResult({ ...data, matchedIndicator: matched });
      } else {
        setTestWeatherResult({ error: "Impossible de récupérer les données météo pour ce lieu. Vérifiez le nom de la ville." });
      }
    } catch (err: any) {
      setTestWeatherResult({ error: err.message || "Erreur de connexion à l'API météo" });
    } finally {
      setIsTestingWeather(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await fb.put('config', { id: 'weather_location', type: 'setting', value: location });
    await fb.put('config', { id: 'weather_temp_min', type: 'setting', value: tempMin.toString() });
    await fb.put('config', { id: 'weather_wind_max', type: 'setting', value: windMax.toString() });
    await fb.put('config', { id: 'weather_wind_dirs', type: 'setting', value: windDirs.join(',') });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const toggleDirection = (dir: string) => {
    setWindDirs(prev => 
      prev.includes(dir) ? prev.filter(d => d !== dir) : [...prev, dir]
    );
  };

  // Add new weather indicator
  const handleAddIndicator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndLabel.trim()) return;

    const { emoji: detectedEmoji, cleanText } = extractEmoji(newIndLabel.trim());
    const finalEmoji = newIndEmoji || detectedEmoji || '🌤️';
    const finalLabel = cleanText || newIndLabel.trim();
    const finalValue = `${finalEmoji} ${finalLabel}`;

    const palette = PRESET_WEATHER_COLOR_PALETTES.find(p => p.name === newIndPalette) || PRESET_WEATHER_COLOR_PALETTES[0];

    const newItem: ConfigItem = {
      id: `weather_ind_${uuidv4().slice(0, 8)}`,
      type: 'weather_indicator',
      value: finalValue,
      attributes: {
        emoji: finalEmoji,
        label: finalLabel,
        palette: newIndPalette,
        colorClass: palette.colorClass,
        activeClass: palette.activeClass,
        conditionKey: newIndConditionKey
      }
    };

    // If first time creating custom indicators, seed existing defaults first if empty
    if (weatherIndicatorsFromDb.length === 0) {
      for (const def of DEFAULT_WEATHER_INDICATORS) {
        const pal = PRESET_WEATHER_COLOR_PALETTES.find(p => p.colorClass === def.colorClass) || PRESET_WEATHER_COLOR_PALETTES[0];
        await fb.put('config', {
          id: def.id,
          type: 'weather_indicator',
          value: `${def.emoji} ${def.label}`,
          attributes: {
            emoji: def.emoji,
            label: def.label,
            palette: pal.name,
            colorClass: def.colorClass,
            activeClass: def.activeClass,
            conditionKey: def.conditionKey
          }
        });
      }
    }

    await fb.add('config', newItem);

    setNewIndLabel('');
    setNewIndEmoji('🌤️');
    setIndicatorFeedback(`Indicateur "${finalValue}" ajouté avec succès !`);
    setTimeout(() => setIndicatorFeedback(null), 3500);
  };

  // Edit indicator
  const handleStartEdit = (ind: WeatherIndicatorItem) => {
    setEditingIndId(ind.id);
    setEditingIndEmoji(ind.emoji);
    setEditingIndLabel(ind.label);
    const pal = PRESET_WEATHER_COLOR_PALETTES.find(p => p.colorClass === ind.colorClass) || PRESET_WEATHER_COLOR_PALETTES[0];
    setEditingIndPalette(pal.name);
    setEditingIndConditionKey(ind.conditionKey || 'sun');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIndId || !editingIndLabel.trim()) return;

    const { emoji: detectedEmoji, cleanText } = extractEmoji(editingIndLabel.trim());
    const finalEmoji = editingIndEmoji || detectedEmoji || '🌤️';
    const finalLabel = cleanText || editingIndLabel.trim();
    const finalValue = `${finalEmoji} ${finalLabel}`;

    const palette = PRESET_WEATHER_COLOR_PALETTES.find(p => p.name === editingIndPalette) || PRESET_WEATHER_COLOR_PALETTES[0];

    await fb.update('config', editingIndId, {
      value: finalValue,
      attributes: {
        emoji: finalEmoji,
        label: finalLabel,
        palette: editingIndPalette,
        colorClass: palette.colorClass,
        activeClass: palette.activeClass,
        conditionKey: editingIndConditionKey
      }
    });

    setEditingIndId(null);
    setIndicatorFeedback(`Indicateur mis à jour : "${finalValue}"`);
    setTimeout(() => setIndicatorFeedback(null), 3500);
  };

  // Delete indicator
  const handleDeleteIndicator = async (id: string, label: string) => {
    if (window.confirm(`Supprimer l'indicateur "${label}" ?`)) {
      await fb.delete('config', id);
      setIndicatorFeedback(`Indicateur "${label}" supprimé.`);
      setTimeout(() => setIndicatorFeedback(null), 3500);
    }
  };

  // Restore defaults
  const handleRestoreDefaultIndicators = async () => {
    if (!window.confirm("Voulez-vous réinitialiser tous les indicateurs météo aux 10 valeurs recommandées par défaut ?")) {
      return;
    }

    // Delete all current weather indicators
    for (const ind of weatherIndicatorsFromDb) {
      await fb.delete('config', ind.id);
    }

    // Put defaults
    for (const def of DEFAULT_WEATHER_INDICATORS) {
      const pal = PRESET_WEATHER_COLOR_PALETTES.find(p => p.colorClass === def.colorClass) || PRESET_WEATHER_COLOR_PALETTES[0];
      await fb.put('config', {
        id: def.id,
        type: 'weather_indicator',
        value: `${def.emoji} ${def.label}`,
        attributes: {
          emoji: def.emoji,
          label: def.label,
          palette: pal.name,
          colorClass: def.colorClass,
          activeClass: def.activeClass,
          conditionKey: def.conditionKey
        }
      });
    }

    setIndicatorFeedback("Indicateurs réinitialisés aux valeurs standards !");
    setTimeout(() => setIndicatorFeedback(null), 3500);
  };

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  return (
    <div className="space-y-6">
      {/* 1. Localisation & Live API Setting */}
      <div className="p-4 sm:p-5 bg-white rounded-xl shadow-xs border border-stone-200/70">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-stone-100">
          <div>
            <h2 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-500" />
              Localisation & Météo en Direct
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Utilisé par le bouton <strong>« Météo auto »</strong> du Journal et pour les alertes météo automatiques.
            </p>
          </div>
          {isSaved && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-fade-in">
              <Check className="w-3.5 h-3.5" /> Paramètres enregistrés !
            </span>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
              <span>Ville ou Code Postal du potager :</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Ex: La Bassée 59480, Lille, Toulouse, 75001 Paris..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isLocating}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                title="Détecter automatiquement ma position actuelle par GPS"
              >
                <Navigation className={`w-3.5 h-3.5 text-blue-500 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Localisation...' : 'GPS Auto'}</span>
              </button>
              <button
                type="button"
                onClick={handleTestLiveWeather}
                disabled={isTestingWeather || !location.trim()}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                title="Vérifier la connexion avec le service météo pour cette commune"
              >
                <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                <span>{isTestingWeather ? 'Test...' : 'Tester'}</span>
              </button>
            </div>
            {locatingError && (
              <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {locatingError}
              </p>
            )}
          </div>

          {/* Live test results card */}
          {testWeatherResult && (
            <div className={`p-3 rounded-xl border text-xs animate-fade-in ${
              testWeatherResult.error 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-gradient-to-r from-blue-50/80 to-sky-50/80 border-blue-200/80 text-blue-950'
            }`}>
              {testWeatherResult.error ? (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{testWeatherResult.error}</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5 text-blue-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Météo en direct pour {testWeatherResult.locationName || location} :
                    </span>
                    <span className="text-stone-500 font-normal">API Open-Meteo opérationnelle</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <div className="flex items-center gap-1 font-bold text-sm text-stone-900">
                      <Thermometer className="w-4 h-4 text-orange-500" />
                      {testWeatherResult.temperature}°C
                      {testWeatherResult.tempMin !== undefined && testWeatherResult.tempMax !== undefined && (
                        <span className="text-xs font-normal text-stone-500">({testWeatherResult.tempMin}° / {testWeatherResult.tempMax}°)</span>
                      )}
                    </div>
                    {testWeatherResult.matchedIndicator && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-semibold shadow-2xs">
                        <span>{testWeatherResult.matchedIndicator.emoji}</span>
                        <span>{testWeatherResult.matchedIndicator.label}</span>
                        <span className="text-[10px] text-stone-400 ml-1">(Indicateur automatique correspondant)</span>
                      </div>
                    )}
                    {testWeatherResult.rainfall !== undefined && testWeatherResult.rainfall > 0 && (
                      <div className="flex items-center gap-1 text-blue-700 font-semibold">
                        <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                        <span>{testWeatherResult.rainfall} mm d'eau</span>
                      </div>
                    )}
                    {testWeatherResult.windSpeed !== undefined && (
                      <div className="flex items-center gap-1 text-teal-800">
                        <Wind className="w-3.5 h-3.5 text-teal-600" />
                        <span>{testWeatherResult.windSpeed} km/h</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alertes météo thresholds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <ThermometerSnowflake className="w-4 h-4 text-blue-500" />
                Alerte Température Min / Risque de gel (°C)
              </label>
              <input
                type="number"
                value={tempMin}
                onChange={e => setTempMin(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 3"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-[11px] text-stone-500">Déclenche une alerte si la température minimale prévue descend sous ce seuil.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-stone-400" />
                Alerte Rafales de Vent Max (km/h)
              </label>
              <input
                type="number"
                value={windMax}
                onChange={e => setWindMax(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 50"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-[11px] text-stone-500">Alerte en cas de rafales supérieures à cette vitesse.</p>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-stone-400" />
              Directions de vent sensibles (optionnel) :
            </label>
            <div className="flex flex-wrap gap-1.5">
              {directions.map(dir => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => toggleDirection(dir)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                    windDirs.includes(dir)
                      ? 'bg-blue-600 border-blue-700 text-white shadow-2xs font-semibold'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-500">Laissez vide pour surveiller toutes les directions de vent.</p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer la localisation et les alertes</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Gestion des Indicateurs Météo Personnalisables */}
      <div className="p-4 sm:p-5 bg-white rounded-xl shadow-xs border border-stone-200/70 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
          <div>
            <h2 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-500" />
              Indicateurs Météo (Boutons 1-Clic du Journal)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Personnalisez les indicateurs météo disponibles dans le Journal. Vous pouvez en ajouter, changer leurs couleurs ou émojis.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRestoreDefaultIndicators}
            className="px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Restaurer les 10 indicateurs standards recommandés"
          >
            <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
            <span>Réinitialiser aux 10 standards</span>
          </button>
        </div>

        {indicatorFeedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{indicatorFeedback}</span>
          </div>
        )}

        {/* Aperçu interactif direct */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/70 space-y-2">
          <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
            Aperçu des boutons tels qu'ils s'affichent dans le Journal ({effectiveIndicators.length} indicateurs) :
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
            {effectiveIndicators.map(ind => (
              <div
                key={ind.id}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-between gap-1 shadow-2xs ${ind.colorClass}`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-sm leading-none">{ind.emoji}</span>
                  <span className="truncate">{ind.label}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-80 hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(ind)}
                    className="p-1 hover:bg-black/5 rounded text-stone-500 hover:text-stone-900 cursor-pointer"
                    title="Modifier cet indicateur"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteIndicator(ind.id, `${ind.emoji} ${ind.label}`)}
                    className="p-1 hover:bg-black/5 rounded text-stone-500 hover:text-red-600 cursor-pointer"
                    title="Supprimer cet indicateur"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formulaire d'édition si un indicateur est sélectionné */}
        {editingIndId && (
          <form onSubmit={handleSaveEdit} className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                Modifier l'indicateur météo
              </h3>
              <button
                type="button"
                onClick={() => setEditingIndId(null)}
                className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
              >
                Annuler
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-700">Émoji :</label>
                <EmojiLogoPicker
                  selectedEmoji={editingIndEmoji}
                  onSelect={setEditingIndEmoji}
                  size="sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-700">Libellé de l'indicateur :</label>
                <input
                  type="text"
                  required
                  value={editingIndLabel}
                  onChange={e => setEditingIndLabel(e.target.value)}
                  placeholder="Ex: Ensoleillé, Pluie battante, Brumes..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-700">Thème de couleur :</label>
                <select
                  value={editingIndPalette}
                  onChange={e => setEditingIndPalette(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  {PRESET_WEATHER_COLOR_PALETTES.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingIndId(null)}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200/50 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Enregistrer la modification</span>
              </button>
            </div>
          </form>
        )}

        {/* Formulaire d'ajout d'un nouvel indicateur */}
        <form onSubmit={handleAddIndicator} className="p-3.5 bg-stone-50 border border-stone-200/80 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            Ajouter un nouvel indicateur météo personnalisé
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-700">Émoji :</label>
              <EmojiLogoPicker
                selectedEmoji={newIndEmoji}
                onSelect={setNewIndEmoji}
                size="sm"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-stone-700">Nom de l'indicateur :</label>
              <input
                type="text"
                required
                value={newIndLabel}
                onChange={e => setNewIndLabel(e.target.value)}
                placeholder="Ex: Grêle, Fortes chaleurs, Brouillard épais..."
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-700">Thème :</label>
              <select
                value={newIndPalette}
                onChange={e => setNewIndPalette(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-200 bg-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                {PRESET_WEATHER_COLOR_PALETTES.map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!newIndLabel.trim()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter cet indicateur</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
