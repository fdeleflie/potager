import { useFirebaseData, fb } from '../hooks/useFirebaseData';
import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Save, CloudRain, Wind, ThermometerSnowflake, MapPin } from 'lucide-react';

export function WeatherSettings() {
  const { data: rawConfig, error } = useFirebaseData<any>('config');
  const config = React.useMemo(() => (rawConfig || []).filter(item => item.type === 'setting'), [rawConfig]);
  
  const [location, setLocation] = useState('');
  const [tempMin, setTempMin] = useState<number | ''>('');
  const [windMax, setWindMax] = useState<number | ''>('');
  const [windDirs, setWindDirs] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false);

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

  const handleSave = async (e: React.FormEvent) => {
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

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-stone-200/60">
      <h2 className="text-lg font-serif font-medium text-stone-900 mb-4 flex items-center gap-2">
        <CloudRain className="w-5 h-5 text-blue-500" />
        Paramètres Météo & Alertes
      </h2>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs mb-4">
          {error}
        </div>
      )}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <MapPin className="w-4 h-4 text-stone-400" />
            Ville ou Code Postal
          </label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Ex: La Bassée 59480"
            className="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-stone-500">Utilisé pour récupérer les prévisions météorologiques locales.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <ThermometerSnowflake className="w-4 h-4 text-blue-400" />
              Alerte Température Min (°C)
            </label>
            <input
              type="number"
              value={tempMin}
              onChange={e => setTempMin(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 4"
              className="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-stone-500">Vous serez alerté si la température prévue est inférieure ou égale à ce seuil.</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <Wind className="w-4 h-4 text-stone-400" />
              Alerte Vitesse Vent Max (km/h)
            </label>
            <input
              type="number"
              value={windMax}
              onChange={e => setWindMax(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 50"
              className="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-stone-500">Vous serez alerté si des rafales supérieures ou égales à ce seuil sont prévues.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <Wind className="w-4 h-4 text-stone-400" />
            Directions de vent sensibles
          </label>
          <div className="flex flex-wrap gap-2">
            {directions.map(dir => (
              <button
                key={dir}
                type="button"
                onClick={() => toggleDirection(dir)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  windDirs.includes(dir)
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {dir}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500">L'alerte vent ne se déclenchera que si le vent vient de l'une de ces directions (laissez vide pour ignorer la direction).</p>
        </div>

        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
          {isSaved ? (
            <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
              <Save className="w-4 h-4" /> Enregistré !
            </span>
          ) : <div />}
          <button
            type="submit"
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Enregistrer les paramètres
          </button>
        </div>
      </form>
    </div>
  );
}
