import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { WeatherSettings } from './WeatherSettings';
import { getWeatherForecast, WeatherForecast } from '../services/weatherService';
import { CloudRain, Wind, Thermometer, MapPin, Loader2 } from 'lucide-react';

export function WeatherView() {
  const config = useLiveQuery(() => db.config.where('type').equals('setting').toArray());
  const location = config?.find(c => c.id === 'weather_location')?.value;

  const [forecast, setForecast] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location) {
      setLoading(true);
      getWeatherForecast(location).then(data => {
        setForecast(data);
        setLoading(false);
      });
    } else {
      setForecast([]);
    }
  }, [location]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60">
        <div>
          <h1 className="text-2xl font-serif font-medium text-stone-900 flex items-center gap-3">
            <CloudRain className="w-8 h-8 text-blue-500" />
            Météo
          </h1>
          <p className="text-stone-500 text-sm">Prévisions à 7 jours et configuration des alertes</p>
        </div>
      </header>

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
        </div>
        
        <div className="lg:col-span-1">
          <WeatherSettings />
        </div>
      </div>
    </div>
  );
}
