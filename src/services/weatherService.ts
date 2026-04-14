export interface WeatherAlert {
  type: 'temperature' | 'wind';
  date: string;
  value: string;
  message: string;
}

export async function checkWeatherAlerts(
  location: string,
  tempMinThreshold: number | undefined,
  windMaxThreshold: number | undefined,
  windDirsThreshold: string[]
): Promise<WeatherAlert[]> {
  if (!location) return [];

  try {
    // 1. Geocoding
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=fr`);
    const geoData = await geoRes.json();
    
    if (!geoData.results || geoData.results.length === 0) {
      console.warn('Weather: Location not found');
      return [];
    }

    const { latitude, longitude } = geoData.results[0];

    // 2. Forecast (next 7 days)
    const forecastRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_min,windspeed_10m_max,winddirection_10m_dominant&timezone=auto`);
    const forecastData = await forecastRes.json();

    if (!forecastData.daily) return [];

    const alerts: WeatherAlert[] = [];
    const { time, temperature_2m_min, windspeed_10m_max, winddirection_10m_dominant } = forecastData.daily;

    for (let i = 0; i < time.length; i++) {
      const dateStr = new Date(time[i]).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      
      // Check Temperature
      if (tempMinThreshold !== undefined && temperature_2m_min[i] !== null && temperature_2m_min[i] <= tempMinThreshold) {
        alerts.push({
          type: 'temperature',
          date: dateStr,
          value: `${temperature_2m_min[i]}°C`,
          message: `Température minimale de ${temperature_2m_min[i]}°C prévue.`
        });
      }

      // Check Wind
      if (windMaxThreshold !== undefined && windspeed_10m_max[i] !== null && windspeed_10m_max[i] >= windMaxThreshold) {
        const dirDegrees = winddirection_10m_dominant[i];
        const dirText = getWindDirectionText(dirDegrees);
        
        // If windDirsThreshold is empty, we alert regardless of direction.
        // If it's not empty, we only alert if the direction matches one of the selected ones.
        if (windDirsThreshold.length === 0 || windDirsThreshold.includes(dirText)) {
          alerts.push({
            type: 'wind',
            date: dateStr,
            value: `${windspeed_10m_max[i]} km/h`,
            message: `Rafales de vent à ${windspeed_10m_max[i]} km/h de direction ${dirText} prévues.`
          });
        }
      }
    }

    return alerts;
  } catch (error) {
    console.error('Error fetching weather alerts:', error);
    return [];
  }
}

function getWindDirectionText(degrees: number | null): string {
  if (degrees === null) return 'Inconnue';
  const val = Math.floor((degrees / 45) + 0.5);
  const arr = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return arr[(val % 8)];
}
