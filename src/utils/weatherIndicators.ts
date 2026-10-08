import { ConfigItem } from '../db';
import { extractEmoji } from '../components/EmojiLogoPicker';

export interface WeatherIndicatorItem {
  id: string;
  label: string;
  emoji: string;
  colorClass: string;
  activeClass: string;
  conditionKey?: string; // 'sun', 'partly_cloudy', 'cloudy', 'rain', 'storm', 'frost', 'wind', 'heat', 'fog', 'snow'
}

export const DEFAULT_WEATHER_INDICATORS: WeatherIndicatorItem[] = [
  {
    id: 'weather_ind_sun',
    label: 'Ensoleillé',
    emoji: '☀️',
    colorClass: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100',
    activeClass: 'bg-amber-500 text-white border-amber-600 shadow-xs font-semibold ring-2 ring-amber-400/30',
    conditionKey: 'sun'
  },
  {
    id: 'weather_ind_partly_cloudy',
    label: 'Éclaircies',
    emoji: '⛅',
    colorClass: 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100',
    activeClass: 'bg-sky-500 text-white border-sky-600 shadow-xs font-semibold ring-2 ring-sky-400/30',
    conditionKey: 'partly_cloudy'
  },
  {
    id: 'weather_ind_cloudy',
    label: 'Couvert',
    emoji: '☁️',
    colorClass: 'text-stone-700 bg-stone-100 border-stone-200 hover:bg-stone-200',
    activeClass: 'bg-stone-600 text-white border-stone-700 shadow-xs font-semibold ring-2 ring-stone-400/30',
    conditionKey: 'cloudy'
  },
  {
    id: 'weather_ind_rain',
    label: 'Pluie',
    emoji: '🌧️',
    colorClass: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100',
    activeClass: 'bg-blue-600 text-white border-blue-700 shadow-xs font-semibold ring-2 ring-blue-400/30',
    conditionKey: 'rain'
  },
  {
    id: 'weather_ind_drizzle',
    label: 'Averses',
    emoji: '🌦️',
    colorClass: 'text-cyan-800 bg-cyan-50 border-cyan-200 hover:bg-cyan-100',
    activeClass: 'bg-cyan-600 text-white border-cyan-700 shadow-xs font-semibold ring-2 ring-cyan-400/30',
    conditionKey: 'drizzle'
  },
  {
    id: 'weather_ind_storm',
    label: 'Orage',
    emoji: '⛈️',
    colorClass: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100',
    activeClass: 'bg-purple-600 text-white border-purple-700 shadow-xs font-semibold ring-2 ring-purple-400/30',
    conditionKey: 'storm'
  },
  {
    id: 'weather_ind_frost',
    label: 'Gelée',
    emoji: '❄️',
    colorClass: 'text-cyan-900 bg-cyan-100/70 border-cyan-300 hover:bg-cyan-200/70',
    activeClass: 'bg-cyan-700 text-white border-cyan-800 shadow-xs font-semibold ring-2 ring-cyan-400/30',
    conditionKey: 'frost'
  },
  {
    id: 'weather_ind_wind',
    label: 'Venteux',
    emoji: '💨',
    colorClass: 'text-teal-800 bg-teal-50 border-teal-200 hover:bg-teal-100',
    activeClass: 'bg-teal-600 text-white border-teal-700 shadow-xs font-semibold ring-2 ring-teal-400/30',
    conditionKey: 'wind'
  },
  {
    id: 'weather_ind_heat',
    label: 'Canicule',
    emoji: '🌡️',
    colorClass: 'text-rose-800 bg-rose-50 border-rose-200 hover:bg-rose-100',
    activeClass: 'bg-rose-600 text-white border-rose-700 shadow-xs font-semibold ring-2 ring-rose-400/30',
    conditionKey: 'heat'
  },
  {
    id: 'weather_ind_fog',
    label: 'Brouillard',
    emoji: '🌫️',
    colorClass: 'text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200',
    activeClass: 'bg-slate-600 text-white border-slate-700 shadow-xs font-semibold ring-2 ring-slate-400/30',
    conditionKey: 'fog'
  }
];

export type WeatherOption = WeatherIndicatorItem;
export const QUICK_WEATHER_OPTIONS = DEFAULT_WEATHER_INDICATORS;

export const PRESET_WEATHER_COLOR_PALETTES = [
  {
    name: 'Ambre / Soleil',
    colorClass: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100',
    activeClass: 'bg-amber-500 text-white border-amber-600 shadow-xs font-semibold ring-2 ring-amber-400/30'
  },
  {
    name: 'Ciel / Éclaircies',
    colorClass: 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100',
    activeClass: 'bg-sky-500 text-white border-sky-600 shadow-xs font-semibold ring-2 ring-sky-400/30'
  },
  {
    name: 'Bleu / Pluie',
    colorClass: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100',
    activeClass: 'bg-blue-600 text-white border-blue-700 shadow-xs font-semibold ring-2 ring-blue-400/30'
  },
  {
    name: 'Gris / Nuageux',
    colorClass: 'text-stone-700 bg-stone-100 border-stone-200 hover:bg-stone-200',
    activeClass: 'bg-stone-600 text-white border-stone-700 shadow-xs font-semibold ring-2 ring-stone-400/30'
  },
  {
    name: 'Cyan / Gel & Neige',
    colorClass: 'text-cyan-900 bg-cyan-100/70 border-cyan-300 hover:bg-cyan-200/70',
    activeClass: 'bg-cyan-700 text-white border-cyan-800 shadow-xs font-semibold ring-2 ring-cyan-400/30'
  },
  {
    name: 'Pourpre / Orage',
    colorClass: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100',
    activeClass: 'bg-purple-600 text-white border-purple-700 shadow-xs font-semibold ring-2 ring-purple-400/30'
  },
  {
    name: 'Teal / Vent',
    colorClass: 'text-teal-800 bg-teal-50 border-teal-200 hover:bg-teal-100',
    activeClass: 'bg-teal-600 text-white border-teal-700 shadow-xs font-semibold ring-2 ring-teal-400/30'
  },
  {
    name: 'Rose / Canicule',
    colorClass: 'text-rose-800 bg-rose-50 border-rose-200 hover:bg-rose-100',
    activeClass: 'bg-rose-600 text-white border-rose-700 shadow-xs font-semibold ring-2 ring-rose-400/30'
  },
  {
    name: 'Émeraude / Doux',
    colorClass: 'text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    activeClass: 'bg-emerald-600 text-white border-emerald-700 shadow-xs font-semibold ring-2 ring-emerald-400/30'
  }
];

/**
 * Checks whether an indicator option matches the current weatherCondition string.
 */
export function isWeatherOptionActive(currentCondition?: string, opt?: WeatherIndicatorItem): boolean {
  if (!currentCondition || !opt) return false;
  const trimmed = currentCondition.trim();
  const full = `${opt.emoji} ${opt.label}`.trim();
  
  // Exact match
  if (trimmed === full || trimmed === opt.label.trim() || (opt.emoji && trimmed === opt.emoji.trim())) {
    return true;
  }

  const normCurrent = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normOptLabel = (opt.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const optEmoji = opt.emoji?.trim();

  // If emoji matches and label is found in string
  if (optEmoji && trimmed.includes(optEmoji) && normOptLabel && normCurrent.includes(normOptLabel)) {
    return true;
  }

  // Exact normalized label match
  if (normCurrent === normOptLabel) {
    return true;
  }

  // If string contains the full option label
  if (normOptLabel && normCurrent.includes(normOptLabel)) {
    return true;
  }

  return false;
}

/**
 * Returns the effective list of weather indicators from Firestore config items,
 * falling back to DEFAULT_WEATHER_INDICATORS if none are defined.
 */
export function getEffectiveWeatherIndicators(rawConfig?: ConfigItem[]): WeatherIndicatorItem[] {
  if (!rawConfig || rawConfig.length === 0) {
    return DEFAULT_WEATHER_INDICATORS;
  }

  const customItems = rawConfig.filter(c => c.type === 'weather_indicator');
  if (customItems.length === 0) {
    return DEFAULT_WEATHER_INDICATORS;
  }

  return customItems.map(item => {
    const { emoji, cleanText } = extractEmoji(item.value || '');
    const finalEmoji = item.attributes?.emoji || emoji || '🌤️';
    const finalLabel = cleanText || item.value || 'Indicateur';
    const palette = PRESET_WEATHER_COLOR_PALETTES.find(p => p.name === item.attributes?.palette) || PRESET_WEATHER_COLOR_PALETTES[0];

    return {
      id: item.id,
      label: finalLabel,
      emoji: finalEmoji,
      colorClass: item.attributes?.colorClass || palette.colorClass,
      activeClass: item.attributes?.activeClass || palette.activeClass,
      conditionKey: item.attributes?.conditionKey
    };
  });
}

/**
 * Smartly finds the best matching weather indicator based on WMO code, temperature, rainfall, wind.
 */
export function matchBestWeatherIndicator(
  indicators: WeatherIndicatorItem[],
  report: {
    weatherCode: number;
    temperature: number;
    rainfall?: number;
    windSpeed?: number;
  }
): WeatherIndicatorItem {
  const { weatherCode, temperature, rainfall = 0, windSpeed = 0 } = report;

  // 1. Severe / Extreme Temperature Priority
  if (temperature <= 0) {
    const frostMatch = indicators.find(i => 
      i.conditionKey === 'frost' || 
      i.emoji === '❄️' || 
      i.label.toLowerCase().includes('gel') || 
      i.label.toLowerCase().includes('froid') ||
      i.label.toLowerCase().includes('neige')
    );
    if (frostMatch) return frostMatch;
  }

  if (temperature >= 30) {
    const heatMatch = indicators.find(i => 
      i.conditionKey === 'heat' || 
      i.emoji === '🌡️' || 
      i.label.toLowerCase().includes('canicule') || 
      i.label.toLowerCase().includes('chaleur')
    );
    if (heatMatch) return heatMatch;
  }

  // 2. Thunderstorm
  if (weatherCode >= 95) {
    const stormMatch = indicators.find(i => 
      i.conditionKey === 'storm' || 
      i.emoji === '⛈️' || 
      i.label.toLowerCase().includes('orage')
    );
    if (stormMatch) return stormMatch;
  }

  // 3. Snow
  if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
    const snowMatch = indicators.find(i => 
      i.conditionKey === 'snow' || 
      i.conditionKey === 'frost' ||
      i.emoji === '❄️' || 
      i.label.toLowerCase().includes('neige') || 
      i.label.toLowerCase().includes('gel')
    );
    if (snowMatch) return snowMatch;
  }

  // 4. Rain & Drizzle
  if ((weatherCode >= 61 && weatherCode <= 65) || (weatherCode >= 80 && weatherCode <= 82) || rainfall >= 1.0) {
    const rainMatch = indicators.find(i => 
      i.conditionKey === 'rain' || 
      i.emoji === '🌧️' || 
      i.label.toLowerCase().includes('pluie') || 
      i.label.toLowerCase().includes('pluvieux')
    );
    if (rainMatch) return rainMatch;
  }

  if ((weatherCode >= 51 && weatherCode <= 55) || (rainfall > 0 && rainfall < 1.0)) {
    const drizzleMatch = indicators.find(i => 
      i.conditionKey === 'drizzle' || 
      i.emoji === '🌦️' || 
      i.label.toLowerCase().includes('averse') || 
      i.label.toLowerCase().includes('bruine') ||
      i.label.toLowerCase().includes('pluie')
    );
    if (drizzleMatch) return drizzleMatch;
  }

  // 5. Strong Wind
  if (windSpeed >= 40) {
    const windMatch = indicators.find(i => 
      i.conditionKey === 'wind' || 
      i.emoji === '💨' || 
      i.label.toLowerCase().includes('vent')
    );
    if (windMatch) return windMatch;
  }

  // 6. Fog
  if (weatherCode === 45 || weatherCode === 48) {
    const fogMatch = indicators.find(i => 
      i.conditionKey === 'fog' || 
      i.emoji === '🌫️' || 
      i.label.toLowerCase().includes('brouillard') || 
      i.label.toLowerCase().includes('brume')
    );
    if (fogMatch) return fogMatch;
  }

  // 7. Cloudy / Overcast
  if (weatherCode === 3) {
    const cloudMatch = indicators.find(i => 
      i.conditionKey === 'cloudy' || 
      i.emoji === '☁️' || 
      i.label.toLowerCase().includes('couvert') || 
      i.label.toLowerCase().includes('nuage')
    );
    if (cloudMatch) return cloudMatch;
  }

  // 8. Partly Cloudy / Sunny Intervals
  if (weatherCode === 1 || weatherCode === 2) {
    const partlyMatch = indicators.find(i => 
      i.conditionKey === 'partly_cloudy' || 
      i.emoji === '⛅' || 
      i.label.toLowerCase().includes('éclaircie') || 
      i.label.toLowerCase().includes('variable')
    );
    if (partlyMatch) return partlyMatch;
  }

  // 9. Clear / Sunny
  if (weatherCode === 0) {
    const sunMatch = indicators.find(i => 
      i.conditionKey === 'sun' || 
      i.emoji === '☀️' || 
      i.label.toLowerCase().includes('soleil') || 
      i.label.toLowerCase().includes('ensoleillé')
    );
    if (sunMatch) return sunMatch;
  }

  // Fallback: return the first indicator
  return indicators[0] || DEFAULT_WEATHER_INDICATORS[0];
}
