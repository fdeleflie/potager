export interface WeatherAlert {
  type: 'temperature' | 'wind';
  date: string;
  value: string;
  message: string;
}

export interface WeatherForecast {
  date: string;
  tempMin: number;
  tempMax: number;
  windSpeed: number;
  windDir: string;
}

export interface CurrentWeatherReport {
  temperature: number;
  weatherCode: number;
  weatherCondition: string;
  tempMin?: number;
  tempMax?: number;
  rainfall?: number;
  humidity?: number;
  windSpeed?: number;
  locationName?: string;
}

export function getWeatherConditionFromCode(code: number, temp?: number): string {
  if (temp !== undefined && temp <= 0) return '❄️ Gelée';
  if (code === 0) return '☀️ Ensoleillé';
  if (code === 1 || code === 2) return '⛅ Éclaircies';
  if (code === 3) return '☁️ Couvert';
  if (code === 45 || code === 48) return '🌫️ Brouillard';
  if (code >= 51 && code <= 55) return '🌦️ Averses';
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return '🌧️ Pluie';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return '❄️ Gelée';
  if (code >= 95) return '⛈️ Orage';
  if (temp !== undefined && temp >= 30) return '🌡️ Canicule';
  return '☀️ Ensoleillé';
}

// In-memory caches to prevent redundant external API requests and handle offline / rate-limited states
const coordsCache = new Map<string, { coords: { latitude: number; longitude: number; name?: string }; timestamp: number }>();
const alertsCache = new Map<string, { alerts: WeatherAlert[]; timestamp: number }>();
const forecastCache = new Map<string, { forecast: WeatherForecast[]; timestamp: number }>();
const currentWeatherCache = new Map<string, { weather: CurrentWeatherReport; timestamp: number }>();

const TTL_WEATHER = 15 * 60 * 1000; // 15 minutes
const TTL_COORDS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Resolves coordinates from location string, or falls back to HTML5 Geolocation if available.
 */
export async function resolveCoordinates(location?: string): Promise<{ latitude: number; longitude: number; name?: string } | null> {
  if (location && location.trim()) {
    const cleanLoc = location.trim().toLowerCase();
    
    // Check in-memory cache
    const cached = coordsCache.get(cleanLoc);
    if (cached && Date.now() - cached.timestamp < TTL_COORDS) {
      return cached.coords;
    }

    try {
      const geoRes = await fetchWithTimeout(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanLoc)}&count=1&language=fr`
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const { latitude, longitude, name, country } = geoData.results[0];
          const coords = { latitude, longitude, name: country ? `${name}, ${country}` : name };
          coordsCache.set(cleanLoc, { coords, timestamp: Date.now() });
          return coords;
        }
      }
    } catch (e: any) {
      // If network fails but we had a previously expired cache, reuse it gracefully
      if (cached) return cached.coords;
      console.warn('Geocoding search temporarily unavailable:', e?.message || e);
    }
  }

  // Fallback: Browser geolocation if supported and permitted
  if (typeof window !== 'undefined' && 'geolocation' in navigator) {
    try {
      const coords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          err => reject(err),
          { timeout: 4000, maximumAge: 300000 }
        );
      });
      return { ...coords, name: 'Position actuelle (GPS)' };
    } catch {
      // Geolocation denied or timed out
    }
  }

  return null;
}

export async function getCurrentWeather(location?: string): Promise<CurrentWeatherReport | null> {
  const cacheKey = (location || '__gps__').trim().toLowerCase();
  const cached = currentWeatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < TTL_WEATHER) {
    return cached.weather;
  }

  try {
    const coords = await resolveCoordinates(location);
    if (!coords) return cached ? cached.weather : null;

    const { latitude, longitude, name } = coords;

    const weatherRes = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
    );

    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo HTTP ${weatherRes.status}`);
    }

    const data = await weatherRes.json();
    if (!data.current) return cached ? cached.weather : null;

    const cur = data.current;
    const temp = Math.round(cur.temperature_2m * 10) / 10;
    const code = cur.weather_code ?? 0;
    const daily = data.daily;
    const tempMin = daily?.temperature_2m_min?.[0] !== undefined ? Math.round(daily.temperature_2m_min[0] * 10) / 10 : undefined;
    const tempMax = daily?.temperature_2m_max?.[0] !== undefined ? Math.round(daily.temperature_2m_max[0] * 10) / 10 : undefined;
    const rainfall = cur.precipitation !== undefined && cur.precipitation > 0
      ? Math.round(cur.precipitation * 10) / 10 
      : (daily?.precipitation_sum?.[0] !== undefined ? Math.round(daily.precipitation_sum[0] * 10) / 10 : 0);

    const report: CurrentWeatherReport = {
      temperature: temp,
      weatherCode: code,
      weatherCondition: getWeatherConditionFromCode(code, temp),
      tempMin,
      tempMax,
      rainfall,
      humidity: cur.relative_humidity_2m,
      windSpeed: cur.wind_speed_10m,
      locationName: name
    };

    currentWeatherCache.set(cacheKey, { weather: report, timestamp: Date.now() });
    return report;
  } catch (err: any) {
    console.warn('Weather service temporarily unreachable:', err?.message || err);
    return cached ? cached.weather : null;
  }
}

export async function getWeatherForecast(location: string): Promise<WeatherForecast[]> {
  const cacheKey = (location || '').trim().toLowerCase();
  const cached = forecastCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < TTL_WEATHER) {
    return cached.forecast;
  }

  try {
    const coords = await resolveCoordinates(location);
    if (!coords) return cached ? cached.forecast : [];

    const { latitude, longitude } = coords;

    const forecastRes = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_min,temperature_2m_max,wind_speed_10m_max,windspeed_10m_max,wind_direction_10m_dominant,winddirection_10m_dominant&timezone=auto`
    );

    if (!forecastRes.ok) {
      throw new Error(`Open-Meteo HTTP ${forecastRes.status}`);
    }

    const forecastData = await forecastRes.json();
    if (!forecastData.daily) return cached ? cached.forecast : [];

    const { 
      time, 
      temperature_2m_min, 
      temperature_2m_max, 
      wind_speed_10m_max, 
      windspeed_10m_max,
      wind_direction_10m_dominant,
      winddirection_10m_dominant 
    } = forecastData.daily;

    const windSpeeds = wind_speed_10m_max || windspeed_10m_max || [];
    const windDirs = wind_direction_10m_dominant || winddirection_10m_dominant || [];

    const forecast: WeatherForecast[] = [];

    for (let i = 0; i < time.length; i++) {
      forecast.push({
        date: new Date(time[i]).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
        tempMin: temperature_2m_min?.[i] ?? 0,
        tempMax: temperature_2m_max?.[i] ?? 0,
        windSpeed: windSpeeds[i] ?? 0,
        windDir: getWindDirectionText(windDirs[i] ?? null)
      });
    }

    forecastCache.set(cacheKey, { forecast, timestamp: Date.now() });
    return forecast;
  } catch (error: any) {
    console.warn('Weather forecast temporarily unreachable:', error?.message || error);
    return cached ? cached.forecast : [];
  }
}

export async function checkWeatherAlerts(
  location: string,
  tempMinThreshold: number | undefined,
  windMaxThreshold: number | undefined,
  windDirsThreshold: string[]
): Promise<WeatherAlert[]> {
  const cacheKey = `${(location || '').trim().toLowerCase()}_${tempMinThreshold}_${windMaxThreshold}_${(windDirsThreshold || []).join('-')}`;
  const cached = alertsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < TTL_WEATHER) {
    return cached.alerts;
  }

  try {
    const coords = await resolveCoordinates(location);
    if (!coords) return cached ? cached.alerts : [];

    const { latitude, longitude } = coords;

    const forecastRes = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_min,wind_speed_10m_max,windspeed_10m_max,wind_direction_10m_dominant,winddirection_10m_dominant&timezone=auto`
    );

    if (!forecastRes.ok) {
      throw new Error(`Open-Meteo HTTP ${forecastRes.status}`);
    }

    const forecastData = await forecastRes.json();
    if (!forecastData.daily) return cached ? cached.alerts : [];

    const alerts: WeatherAlert[] = [];
    const { 
      time, 
      temperature_2m_min, 
      wind_speed_10m_max, 
      windspeed_10m_max,
      wind_direction_10m_dominant,
      winddirection_10m_dominant 
    } = forecastData.daily;

    const windSpeeds = wind_speed_10m_max || windspeed_10m_max || [];
    const windDirs = wind_direction_10m_dominant || winddirection_10m_dominant || [];

    for (let i = 0; i < time.length; i++) {
      const dateStr = new Date(time[i]).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      
      // Check Temperature Alert
      if (tempMinThreshold !== undefined && temperature_2m_min?.[i] !== null && temperature_2m_min?.[i] !== undefined && temperature_2m_min[i] <= tempMinThreshold) {
        alerts.push({
          type: 'temperature',
          date: dateStr,
          value: `${temperature_2m_min[i]}°C`,
          message: `Température minimale de ${temperature_2m_min[i]}°C prévue.`
        });
      }

      // Check Wind Alert
      const curWind = windSpeeds[i];
      if (windMaxThreshold !== undefined && curWind !== null && curWind !== undefined && curWind >= windMaxThreshold) {
        const dirDegrees = windDirs[i] ?? null;
        const dirText = getWindDirectionText(dirDegrees);
        
        if (windDirsThreshold.length === 0 || windDirsThreshold.includes(dirText)) {
          alerts.push({
            type: 'wind',
            date: dateStr,
            value: `${curWind} km/h`,
            message: `Rafales de vent à ${curWind} km/h de direction ${dirText} prévues.`
          });
        }
      }
    }

    alertsCache.set(cacheKey, { alerts, timestamp: Date.now() });
    return alerts;
  } catch (error: any) {
    console.warn('Weather alerts service currently unavailable (offline or network restriction):', error?.message || error);
    return cached ? cached.alerts : [];
  }
}

function getWindDirectionText(degrees: number | null): string {
  if (degrees === null || degrees === undefined) return 'Inconnue';
  const val = Math.floor((degrees / 45) + 0.5);
  const arr = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return arr[(val % 8)];
}
