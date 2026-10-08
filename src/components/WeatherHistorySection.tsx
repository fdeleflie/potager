import React, { useState, useMemo } from 'react';
import { JournalEntry } from '../db';
import { fb, useFirebaseData } from '../hooks/useFirebaseData';
import { 
  CloudRain, 
  Thermometer, 
  Droplets, 
  Plus, 
  Calendar, 
  Search, 
  Filter, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  TrendingDown, 
  Snowflake, 
  SunMedium, 
  Sparkles,
  Info
} from 'lucide-react';
import { WeatherReadingModal } from './WeatherReadingModal';
import { ConfirmModal } from './Modals';

interface Props {
  onNavigateToJournal?: () => void;
}

export function WeatherHistorySection({ onNavigateToJournal }: Props) {
  const { data: rawEntries, error } = useFirebaseData<JournalEntry>('journal');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<'all' | '7d' | '30d' | '90d' | 'year'>('all');
  const [filterCondition, setFilterCondition] = useState<'all' | 'frost' | 'rain' | 'heat'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  const [confirmDeleteState, setConfirmDeleteState] = useState<{
    isOpen: boolean;
    entryId: string | null;
  }>({ isOpen: false, entryId: null });

  // Filter journal entries that are weather records
  const weatherEntries = useMemo(() => {
    if (!rawEntries) return [];
    return rawEntries.filter(e => {
      if (e.isDeleted) return false;
      const hasCondition = Boolean(e.weatherCondition);
      const hasTemp = e.temperature !== undefined || e.temperatureMin !== undefined || e.temperatureMax !== undefined;
      const hasRain = e.rainfall !== undefined && e.rainfall > 0;
      const hasWeatherTag = e.tags?.some(t => t.toLowerCase().includes('météo') || t.toLowerCase().includes('gelée'));
      const hasWeatherTitle = e.title?.toLowerCase().includes('météo') || e.title?.toLowerCase().includes('température');
      return hasCondition || hasTemp || hasRain || hasWeatherTag || hasWeatherTitle;
    });
  }, [rawEntries]);

  // Apply filters: period, condition type, search
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const searchLower = searchTerm.toLowerCase().trim();

    return weatherEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      const diffDays = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);

      // Period filter
      if (filterPeriod === '7d' && diffDays > 7) return false;
      if (filterPeriod === '30d' && diffDays > 30) return false;
      if (filterPeriod === '90d' && diffDays > 90) return false;
      if (filterPeriod === 'year' && entryDate.getFullYear() !== now.getFullYear()) return false;

      // Condition filter
      if (filterCondition === 'frost') {
        const isFrost = (entry.temperature !== undefined && entry.temperature <= 0) ||
                        (entry.temperatureMin !== undefined && entry.temperatureMin <= 0) ||
                        entry.weatherCondition?.toLowerCase().includes('gel') ||
                        entry.tags?.some(t => t.toLowerCase().includes('gel'));
        if (!isFrost) return false;
      }

      if (filterCondition === 'rain') {
        const isRain = (entry.rainfall !== undefined && entry.rainfall > 0) ||
                       entry.weatherCondition?.toLowerCase().includes('plui') ||
                       entry.weatherCondition?.toLowerCase().includes('bruin') ||
                       entry.weatherCondition?.toLowerCase().includes('orag');
        if (!isRain) return false;
      }

      if (filterCondition === 'heat') {
        const isHeat = (entry.temperature !== undefined && entry.temperature >= 28) ||
                       (entry.temperatureMax !== undefined && entry.temperatureMax >= 28) ||
                       entry.weatherCondition?.toLowerCase().includes('canicule');
        if (!isHeat) return false;
      }

      // Search term
      if (searchLower) {
        const matchesTitle = entry.title?.toLowerCase().includes(searchLower);
        const matchesContent = entry.content?.toLowerCase().includes(searchLower);
        const matchesCondition = entry.weatherCondition?.toLowerCase().includes(searchLower);
        const matchesDate = entry.date.includes(searchLower);
        if (!matchesTitle && !matchesContent && !matchesCondition && !matchesDate) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [weatherEntries, filterPeriod, filterCondition, searchTerm]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (weatherEntries.length === 0) {
      return { count: 0, latestTemp: null, minTemp: null, maxTemp: null, totalRain: 0, frostCount: 0 };
    }

    let minTemp: { val: number; date: string } | null = null;
    let maxTemp: { val: number; date: string } | null = null;
    let totalRain = 0;
    let frostCount = 0;
    let validTempSum = 0;
    let validTempCount = 0;

    const sortedByDateDesc = [...weatherEntries].sort((a, b) => b.date.localeCompare(a.date));
    const latestWithTemp = sortedByDateDesc.find(e => e.temperature !== undefined || e.temperatureMax !== undefined);
    const latestTemp = latestWithTemp ? (latestWithTemp.temperature ?? latestWithTemp.temperatureMax) : null;

    weatherEntries.forEach(e => {
      const t = e.temperature ?? e.temperatureMax;
      const tMin = e.temperatureMin ?? e.temperature;
      
      if (t !== undefined) {
        validTempSum += t;
        validTempCount++;
        if (!maxTemp || t > maxTemp.val) {
          maxTemp = { val: t, date: e.date };
        }
      }

      if (tMin !== undefined) {
        if (!minTemp || tMin < minTemp.val) {
          minTemp = { val: tMin, date: e.date };
        }
      }

      if ((tMin !== undefined && tMin <= 0) || e.weatherCondition?.toLowerCase().includes('gel')) {
        frostCount++;
      }

      if (e.rainfall !== undefined && e.rainfall > 0) {
        totalRain += e.rainfall;
      }
    });

    const avgTemp = validTempCount > 0 ? Math.round((validTempSum / validTempCount) * 10) / 10 : null;

    return {
      count: weatherEntries.length,
      latestTemp,
      latestDate: latestWithTemp?.date,
      avgTemp,
      minTemp,
      maxTemp,
      totalRain: Math.round(totalRain * 10) / 10,
      frostCount
    };
  }, [weatherEntries]);

  // Chart data: chronological order (oldest to newest)
  const chartPoints = useMemo(() => {
    const list = [...filteredEntries]
      .filter(e => e.temperature !== undefined || e.temperatureMin !== undefined || e.temperatureMax !== undefined || (e.rainfall !== undefined && e.rainfall > 0))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Limit to latest 40 points for clean chart display
    return list.slice(-40);
  }, [filteredEntries]);

  // SVG Chart calculation
  const chartSvgData = useMemo(() => {
    if (chartPoints.length < 2) return null;

    const width = 800;
    const height = 220;
    const padding = { top: 30, right: 30, bottom: 40, left: 45 };

    const temps = chartPoints
      .map(p => p.temperature ?? p.temperatureMax ?? p.temperatureMin)
      .filter((t): t is number => t !== undefined);

    if (temps.length === 0) return null;

    const minT = Math.min(...temps, -2);
    const maxT = Math.max(...temps, 30);
    const yRange = Math.max(10, maxT - minT);

    const getY = (val: number) => {
      const normalized = (val - minT) / yRange;
      return height - padding.bottom - normalized * (height - padding.top - padding.bottom);
    };

    const getX = (idx: number) => {
      const step = (width - padding.left - padding.right) / (chartPoints.length - 1);
      return padding.left + idx * step;
    };

    // Calculate line path
    const pointsWithCoords = chartPoints.map((p, idx) => {
      const t = p.temperature ?? p.temperatureMax ?? p.temperatureMin;
      const x = getX(idx);
      const y = t !== undefined ? getY(t) : null;
      return { ...p, x, y, tempVal: t };
    });

    const validCoords = pointsWithCoords.filter(p => p.y !== null) as Array<typeof pointsWithCoords[0] & { y: number }>;

    let linePath = '';
    if (validCoords.length > 0) {
      linePath = `M ${validCoords[0].x} ${validCoords[0].y}`;
      for (let i = 1; i < validCoords.length; i++) {
        linePath += ` L ${validCoords[i].x} ${validCoords[i].y}`;
      }
    }

    // 0°C line (Frost line)
    const zeroY = (minT <= 0 && maxT >= 0) ? getY(0) : null;

    // Rain bars max
    const rains = chartPoints.map(p => p.rainfall || 0);
    const maxRain = Math.max(...rains, 5);

    return {
      width,
      height,
      padding,
      minT: Math.floor(minT),
      maxT: Math.ceil(maxT),
      zeroY,
      linePath,
      pointsWithCoords,
      maxRain,
      getY,
      getX
    };
  }, [chartPoints]);

  const handleDeleteEntry = async (id: string) => {
    try {
      await fb.delete('journal', id);
    } catch (err) {
      console.error('Failed to delete weather reading:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Add */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-xs border border-stone-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-serif font-medium text-stone-900 flex items-center gap-2">
              <span>Historique des relevés météo & températures</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-800 font-sans font-medium">
                {weatherEntries.length} relevé{weatherEntries.length > 1 ? 's' : ''}
              </span>
            </h2>
            <p className="text-xs text-stone-500">
              Suivi au fil des saisons : températures quotidiennes, gelées, canicules et pluviométrie
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingEntry(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau relevé météo</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Latest Temp */}
        <div className="bg-white p-3.5 rounded-xl border border-stone-200/70 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>Dernier relevé</span>
            <Thermometer className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-stone-900">
            {stats.latestTemp !== null ? `${stats.latestTemp > 0 ? `+${stats.latestTemp}` : stats.latestTemp}°C` : '—'}
          </div>
          <span className="text-[10px] text-stone-400">
            {stats.latestDate ? new Date(stats.latestDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Aucun relevé'}
          </span>
        </div>

        {/* Min Temp (Frost check) */}
        <div className="bg-white p-3.5 rounded-xl border border-stone-200/70 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>Min absolue</span>
            <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="text-lg font-bold text-cyan-700 flex items-center gap-1">
            <span>{stats.minTemp ? `${stats.minTemp.val}°C` : '—'}</span>
            {stats.minTemp && stats.minTemp.val <= 0 && (
              <span className="text-[10px] px-1 py-0.2 bg-cyan-100 text-cyan-800 rounded font-semibold uppercase">Gelée</span>
            )}
          </div>
          <span className="text-[10px] text-stone-400">
            {stats.minTemp?.date ? new Date(stats.minTemp.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
          </span>
        </div>

        {/* Max Temp */}
        <div className="bg-white p-3.5 rounded-xl border border-stone-200/70 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>Max absolue</span>
            <SunMedium className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-orange-600 flex items-center gap-1">
            <span>{stats.maxTemp ? `+${stats.maxTemp.val}°C` : '—'}</span>
            {stats.maxTemp && stats.maxTemp.val >= 30 && (
              <span className="text-[10px] px-1 py-0.2 bg-rose-100 text-rose-800 rounded font-semibold uppercase">Chaud</span>
            )}
          </div>
          <span className="text-[10px] text-stone-400">
            {stats.maxTemp?.date ? new Date(stats.maxTemp.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
          </span>
        </div>

        {/* Cumulative Rain */}
        <div className="bg-white p-3.5 rounded-xl border border-stone-200/70 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>Cumul pluie</span>
            <Droplets className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-blue-700">
            {stats.totalRain} mm
          </div>
          <span className="text-[10px] text-stone-400">
            Arrosage naturel enregistré
          </span>
        </div>

        {/* Total Frost Days */}
        <div className="bg-white p-3.5 rounded-xl border border-stone-200/70 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span>Jours de gel</span>
            <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="text-lg font-bold text-stone-800">
            {stats.frostCount} jour{stats.frostCount > 1 ? 's' : ''}
          </div>
          <span className="text-[10px] text-stone-400">
            ≤ 0°C observés
          </span>
        </div>
      </div>

      {/* Interactive Temperature & Rain Chart */}
      {chartSvgData && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-stone-900">
                Courbe des températures et pluviométrie
              </h3>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] text-stone-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Température (°C)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-cyan-500 border-dashed" />
                <span className="text-cyan-700 font-medium">Ligne de gel (0°C)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-300" />
                <span>Pluie (mm)</span>
              </div>
            </div>
          </div>

          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartSvgData.width} ${chartSvgData.height}`}
              className="w-full min-w-[600px] h-48 select-none"
            >
              {/* Background horizontal grid lines */}
              <line
                x1={chartSvgData.padding.left}
                y1={chartSvgData.padding.top}
                x2={chartSvgData.width - chartSvgData.padding.right}
                y2={chartSvgData.padding.top}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <line
                x1={chartSvgData.padding.left}
                y1={chartSvgData.height - chartSvgData.padding.bottom}
                x2={chartSvgData.width - chartSvgData.padding.right}
                y2={chartSvgData.height - chartSvgData.padding.bottom}
                stroke="#e2e8f0"
                strokeWidth="1"
              />

              {/* Frost line at 0°C (dashed line) */}
              {chartSvgData.zeroY !== null && (
                <g>
                  <line
                    x1={chartSvgData.padding.left}
                    y1={chartSvgData.zeroY}
                    x2={chartSvgData.width - chartSvgData.padding.right}
                    y2={chartSvgData.zeroY}
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={chartSvgData.padding.left - 6}
                    y={chartSvgData.zeroY + 3}
                    textAnchor="end"
                    fill="#0891b2"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    0°
                  </text>
                </g>
              )}

              {/* Rain bars at bottom */}
              {chartSvgData.pointsWithCoords.map((pt, idx) => {
                if (!pt.rainfall || pt.rainfall <= 0) return null;
                const barHeight = Math.min(30, (pt.rainfall / chartSvgData.maxRain) * 30);
                const barY = chartSvgData.height - chartSvgData.padding.bottom - barHeight;
                return (
                  <rect
                    key={`rain-${idx}`}
                    x={pt.x - 3}
                    y={barY}
                    width="6"
                    height={barHeight}
                    rx="1"
                    fill="#93c5fd"
                    opacity="0.8"
                  />
                );
              })}

              {/* Temperature line */}
              {chartSvgData.linePath && (
                <path
                  d={chartSvgData.linePath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Temperature data points */}
              {chartSvgData.pointsWithCoords.map((pt, idx) => {
                if (pt.y === null || pt.tempVal === undefined) return null;
                const isFrost = pt.tempVal <= 0;
                const isHeat = pt.tempVal >= 28;
                const dotColor = isFrost ? '#06b6d4' : isHeat ? '#ef4444' : '#3b82f6';

                return (
                  <g
                    key={`pt-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => {
                      setEditingEntry(pt as any);
                      setIsModalOpen(true);
                    }}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4.5"
                      fill="#ffffff"
                      stroke={dotColor}
                      strokeWidth="2.5"
                      className="hover:r-6 transition-all"
                    />
                    {/* Date label on bottom */}
                    {idx % Math.ceil(chartSvgData.pointsWithCoords.length / 8) === 0 && (
                      <text
                        x={pt.x}
                        y={chartSvgData.height - 12}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="9.5"
                      >
                        {new Date(pt.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Hover tooltip */}
            {hoveredPoint && (
              <div 
                className="absolute z-20 bg-stone-900 text-white text-xs rounded-xl p-2.5 shadow-xl pointer-events-none -translate-x-1/2 -translate-y-full mb-2"
                style={{
                  left: `${(hoveredPoint.x / chartSvgData.width) * 100}%`,
                  top: `${hoveredPoint.y}px`
                }}
              >
                <div className="font-semibold text-stone-200">
                  {new Date(hoveredPoint.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {hoveredPoint.weatherCondition && <span>{hoveredPoint.weatherCondition}</span>}
                  {hoveredPoint.tempVal !== undefined && (
                    <span className="font-bold text-amber-300">{hoveredPoint.tempVal}°C</span>
                  )}
                  {hoveredPoint.rainfall !== undefined && hoveredPoint.rainfall > 0 && (
                    <span className="text-blue-300">🌧️ {hoveredPoint.rainfall}mm</span>
                  )}
                </div>
                {hoveredPoint.title && (
                  <div className="text-[11px] text-stone-400 mt-1 max-w-[180px] truncate">
                    {hoveredPoint.title}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-stone-50 p-3 rounded-xl border border-stone-200">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center bg-white rounded-lg border border-stone-200 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterPeriod('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterPeriod === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Tout
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('7d')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterPeriod === '7d' ? 'bg-blue-600 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              7 jours
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('30d')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterPeriod === '30d' ? 'bg-blue-600 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              30 jours
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('year')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterPeriod === 'year' ? 'bg-blue-600 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Cette année
            </button>
          </div>

          {/* Condition type filter */}
          <div className="flex items-center bg-white rounded-lg border border-stone-200 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterCondition('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterCondition === 'all' ? 'bg-stone-800 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Toutes météos
            </button>
            <button
              type="button"
              onClick={() => setFilterCondition('frost')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                filterCondition === 'frost' ? 'bg-cyan-600 text-white shadow-2xs' : 'text-cyan-800 hover:bg-cyan-50'
              }`}
              title="Filtrer uniquement les gelées (≤ 0°C)"
            >
              <Snowflake className="w-3 h-3" />
              <span>Gelées</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterCondition('rain')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                filterCondition === 'rain' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-800 hover:bg-blue-50'
              }`}
              title="Filtrer les jours avec pluie"
            >
              <Droplets className="w-3 h-3" />
              <span>Pluie</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterCondition('heat')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                filterCondition === 'heat' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-800 hover:bg-rose-50'
              }`}
              title="Filtrer les chaleurs (≥ 28°C)"
            >
              <SunMedium className="w-3 h-3" />
              <span>Chaleurs</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher dans les relevés..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-white text-stone-800 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Chronological List of Readings */}
      <div className="space-y-2.5">
        {filteredEntries.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-2">
            <CloudRain className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-sm font-medium text-stone-700">Aucun relevé météo correspondant</p>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Utilisez le bouton ci-dessus pour enregistrer votre premier relevé météo ou relever la température du jour.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredEntries.map(entry => {
              const hasNegative = (entry.temperature !== undefined && entry.temperature <= 0) ||
                                  (entry.temperatureMin !== undefined && entry.temperatureMin <= 0);
              const isHeat = (entry.temperature !== undefined && entry.temperature >= 28) ||
                             (entry.temperatureMax !== undefined && entry.temperatureMax >= 28);

              return (
                <div
                  key={entry.id}
                  className={`bg-white rounded-xl p-3.5 border transition-all hover:shadow-sm flex flex-col justify-between ${
                    hasNegative 
                      ? 'border-cyan-200 bg-cyan-50/20' 
                      : isHeat 
                      ? 'border-rose-200 bg-rose-50/20' 
                      : 'border-stone-200/80 hover:border-stone-300'
                  }`}
                >
                  <div>
                    {/* Top Row: Date, Badge, Actions */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-stone-900">
                          {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {entry.weatherCondition && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 border border-stone-200">
                            {entry.weatherCondition}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntry(entry);
                            setIsModalOpen(true);
                          }}
                          className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                          title="Modifier le relevé"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteState({ isOpen: true, entryId: entry.id })}
                          className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          title="Supprimer ce relevé"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Temperature and Rain Badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {entry.temperature !== undefined && (
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                          hasNegative 
                            ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' 
                            : isHeat 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : 'bg-orange-50 text-orange-800 border border-orange-200'
                        }`}>
                          <Thermometer className="w-3.5 h-3.5" />
                          <span>{entry.temperature > 0 ? `+${entry.temperature}` : entry.temperature}°C</span>
                        </div>
                      )}

                      {(entry.temperatureMin !== undefined || entry.temperatureMax !== undefined) && (
                        <div className="px-2 py-1 rounded-lg bg-stone-50 border border-stone-200 text-stone-600 text-xs font-medium flex items-center gap-1.5">
                          {entry.temperatureMin !== undefined && (
                            <span className={entry.temperatureMin <= 0 ? 'text-cyan-700 font-bold' : ''}>
                              Min: {entry.temperatureMin}°
                            </span>
                          )}
                          {entry.temperatureMin !== undefined && entry.temperatureMax !== undefined && (
                            <span className="text-stone-300">/</span>
                          )}
                          {entry.temperatureMax !== undefined && (
                            <span className={entry.temperatureMax >= 28 ? 'text-rose-600 font-bold' : ''}>
                              Max: {entry.temperatureMax}°
                            </span>
                          )}
                        </div>
                      )}

                      {entry.rainfall !== undefined && entry.rainfall > 0 && (
                        <div className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium flex items-center gap-1">
                          <Droplets className="w-3.5 h-3.5" />
                          <span>{entry.rainfall} mm d'eau</span>
                        </div>
                      )}
                    </div>

                    {/* Title & Notes */}
                    {entry.title && (
                      <div className="text-xs font-bold text-stone-900 mb-0.5">
                        {entry.title}
                      </div>
                    )}
                    {entry.content && (
                      <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                        {entry.content}
                      </p>
                    )}

                    {/* Photos */}
                    {entry.photos && entry.photos.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {entry.photos.map((p, idx) => (
                          <img key={idx} src={p} alt="" className="w-10 h-10 rounded-lg object-cover border border-stone-200 shadow-2xs" />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer note */}
                  <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                    <span>Synchronisé avec le Journal de bord</span>
                    {onNavigateToJournal && (
                      <button
                        type="button"
                        onClick={onNavigateToJournal}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        Voir au journal &rarr;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Weather Reading Modal (Add / Edit) */}
      <WeatherReadingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEntry(null);
        }}
        initialData={editingEntry ? {
          id: editingEntry.id,
          date: editingEntry.date,
          weatherCondition: editingEntry.weatherCondition,
          temperature: editingEntry.temperature,
          temperatureMin: editingEntry.temperatureMin,
          temperatureMax: editingEntry.temperatureMax,
          rainfall: editingEntry.rainfall,
          title: editingEntry.title,
          content: editingEntry.content,
          photos: editingEntry.photos
        } : undefined}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={confirmDeleteState.isOpen}
        onClose={() => setConfirmDeleteState({ isOpen: false, entryId: null })}
        onConfirm={() => {
          if (confirmDeleteState.entryId) {
            handleDeleteEntry(confirmDeleteState.entryId);
          }
          setConfirmDeleteState({ isOpen: false, entryId: null });
        }}
        title="Supprimer ce relevé météo ?"
        message="Êtes-vous sûr de vouloir supprimer ce relevé ? Cette action le supprimera également du journal de bord."
        confirmText="Supprimer"
        isDanger={true}
      />
    </div>
  );
}
