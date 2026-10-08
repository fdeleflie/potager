import { useFirebaseData } from '../hooks/useFirebaseData';
import React, { useState, useEffect } from 'react';
import { WeatherSettings } from './WeatherSettings';
import { getWeatherForecast, WeatherForecast } from '../services/weatherService';
import { CloudRain, Wind, Thermometer, MapPin, Loader2, Calendar, TrendingUp } from 'lucide-react';
import { WeatherHistorySection } from '../components/WeatherHistorySection';

interface WeatherViewProps {
  setCurrentView?: (view: string) => void;
  initialTab?: 'forecast' | 'history';
}

export function WeatherView({ setCurrentView, initialTab = 'forecast' }: WeatherViewProps) {
  const { data: rawConfig, error } = useFirebaseData<any>('config');
  const config = React.useMemo(() => (rawConfig || []).filter(item => item.type === 'setting'), [rawConfig]);
  const location = config?.find(c => c.id === 'weather_location')?.value;

  const [activeTab, setActiveTab] = useState<'forecast' | 'history'>(initialTab);
  const [forecast, setForecast] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location && location.trim()) {
      setLoading(true);
      getWeatherForecast(location.trim())
        .then(data => {
          setForecast(data || []);
          setLoading(false);
        })
        .catch(() => {
          setForecast([]);
          setLoading(false);
        });
    } else {
      setForecast([]);
    }
  }, [location]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60">
        <div>
          <h1 className="text-2xl font-serif font-medium text-stone-900 flex items-center gap-3">
            <CloudRain className="w-8 h-8 text-blue-500" />
            Météo & Températures
          </h1>
          <p className="text-stone-500 text-sm">Prévisions à 7 jours, alertes et historique des relevés du potager</p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('forecast')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'forecast' 
                ? 'bg-white text-stone-900 shadow-2xs font-semibold' 
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5 text-blue-500" />
            <span>Prévisions & Alertes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history' 
                ? 'bg-white text-stone-900 shadow-2xs font-semibold' 
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5 text-orange-500" />
            <span>Historique & Relevés</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {activeTab === 'forecast' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-serif font-medium text-stone-900 flex items-center gap-2">
              Prévisions pour {location || '...'}
            </h2>
            
            {!location && (
              <div className="p-8 text-center bg-stone-50 border border-stone-200 border-dashed rounded-xl text-stone-500">
                <MapPin className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p>Veuillez configurer votre ville ci-contre pour voir les prévisions.</p>
              </div>
            )}

            {loading && location && (
              <div className="flex justify-center items-center p-12 bg-white rounded-xl border border-stone-200/60 shadow-sm">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            )}

            {!loading && forecast.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {forecast.map((day, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-stone-200/60 shadow-sm flex flex-col items-center text-center">
                    <span className="font-medium text-stone-900 mb-2">{day.date}</span>
                    
                    <div className="flex items-center gap-1.5 text-orange-500 font-medium">
                      <Thermometer className="w-4 h-4" />
                      <span>{day.tempMax}°</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-500 font-medium text-sm mt-1">
                      <Thermometer className="w-3.5 h-3.5" />
                      <span>{day.tempMin}°</span>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-stone-100 w-full flex flex-col items-center gap-1 text-sm text-stone-600">
                      <Wind className="w-4 h-4 text-stone-400" />
                      <span>{day.windSpeed} km/h</span>
                      <span className="text-xs text-stone-400">{day.windDir}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick link to history */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="w-full p-4 rounded-xl border border-blue-200/80 bg-blue-50/50 hover:bg-blue-50 text-blue-900 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-semibold block">Consulter l'historique de vos relevés de température</span>
                    <span className="text-xs text-blue-700">Visualisez la courbe d'évolution, vos relevés de gelées et de pluie au potager.</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-600">&rarr;</span>
              </button>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <WeatherSettings />
          </div>
        </div>
      ) : (
        <WeatherHistorySection onNavigateToJournal={() => setCurrentView?.('journal')} />
      )}
    </div>
  );
}
