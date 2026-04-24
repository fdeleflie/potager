import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseData } from '../hooks/useFirebaseData';
import { db, Task } from '../db';
import { Sprout, CheckCircle2, TrendingUp, BarChart3, PieChart as PieChartIcon, Printer, Archive, Coins, Gift, ShoppingBag, CheckSquare, Clock, ArrowRight } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { differenceInDays, parseISO } from 'date-fns';

import { printElement } from '../utils/print';

import { checkWeatherAlerts, WeatherAlert } from '../services/weatherService';

export function Dashboard({ setCurrentView }: { setCurrentView: (v: string) => void }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'harvests'>('overview');
  const rawSeedlings = useFirebaseData<any>('seedlings');
  const rawTasks = useFirebaseData<any>('tasks');
  const rawConfig = useFirebaseData<any>('config');

  const seedlings = useMemo(() => rawSeedlings.filter(s => !s.isDeleted), [rawSeedlings]);
  const manualTasks = useMemo(() => rawTasks.filter(t => !t.isDeleted && !t.isCompleted), [rawTasks]);
  const config = useMemo(() => rawConfig.filter(c => c.type === 'setting'), [rawConfig]);

  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([]);

  useEffect(() => {
    if (config) {
      const loc = config.find(c => c.id === 'weather_location')?.value;
      const tMin = config.find(c => c.id === 'weather_temp_min')?.value;
      const wMax = config.find(c => c.id === 'weather_wind_max')?.value;
      const wDirs = config.find(c => c.id === 'weather_wind_dirs')?.value;

      if (loc) {
        checkWeatherAlerts(
          loc,
          tMin !== undefined && tMin !== '' ? Number(tMin) : undefined,
          wMax !== undefined && wMax !== '' ? Number(wMax) : undefined,
          wDirs ? wDirs.split(',') : []
        ).then(alerts => setWeatherAlerts(alerts));
      }
    }
  }, [config]);

  // Auto tasks logic for dashboard
  const pendingAutoTasks = useMemo(() => {
    if (!seedlings) return [];
    const generated: any[] = [];
    const today = new Date();

    seedlings.filter(s => !s.isArchived).forEach(s => {
      if (s.state === 'Démarrage' && s.dateSown) {
        const days = differenceInDays(today, parseISO(s.dateSown));
        if (days >= 21) generated.push({ id: s.id, title: `Repiquer ${s.vegetable}`, priority: days >= 28 ? 'high' : 'medium' });
      }
      if (s.state === 'Repiquage' && s.dateTransplanted) {
        const days = differenceInDays(today, parseISO(s.dateTransplanted));
        if (days >= 28) generated.push({ id: s.id, title: `Planter ${s.vegetable}`, priority: days >= 35 ? 'high' : 'medium' });
      }
    });
    return generated;
  }, [seedlings]);

  const totalPendingTasks = (manualTasks?.length || 0) + pendingAutoTasks.length;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    if (seedlings) {
      seedlings.forEach(s => {
        if (s.dateSown) years.add(new Date(s.dateSown).getFullYear());
        if (s.dateTransplanted) years.add(new Date(s.dateTransplanted).getFullYear());
        if (s.datePlanted) years.add(new Date(s.datePlanted).getFullYear());
        if (s.harvests) {
          s.harvests.forEach(h => years.add(new Date(h.date).getFullYear()));
        }
      });
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [seedlings]);

  const yearSeedlings = useMemo(() => {
    if (!seedlings) return [];
    return seedlings.filter(s => {
      const y1 = s.dateSown ? new Date(s.dateSown).getFullYear() : null;
      const y2 = s.dateTransplanted ? new Date(s.dateTransplanted).getFullYear() : null;
      const y3 = s.datePlanted ? new Date(s.datePlanted).getFullYear() : null;
      const hasHarvestThisYear = s.harvests?.some(h => new Date(h.date).getFullYear() === selectedYear);
      if (!y1 && !y2 && !y3 && !hasHarvestThisYear) return selectedYear === new Date().getFullYear();
      return y1 === selectedYear || y2 === selectedYear || y3 === selectedYear || hasHarvestThisYear;
    });
  }, [seedlings, selectedYear]);

  // Sales Data
  const salesData = useMemo(() => {
    if (!yearSeedlings) return { sold: [], donated: [], totalRevenue: 0, totalSoldQty: 0, totalDonatedQty: 0, revenueByVeg: [], allTransactions: [] };
    
    const sold = yearSeedlings.filter(s => s.state === 'Vendu / Donné' && s.salePrice !== undefined && s.salePrice > 0);
    const donated = yearSeedlings.filter(s => s.state === 'Vendu / Donné' && (!s.salePrice || s.salePrice === 0));

    const totalRevenue = sold.reduce((sum, s) => sum + (Number(s.salePrice) || 0), 0);
    const totalSoldQty = sold.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const totalDonatedQty = donated.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

    const revByVegMap = sold.reduce((acc, s) => {
      acc[s.vegetable] = (acc[s.vegetable] || 0) + (Number(s.salePrice) || 0);
      return acc;
    }, {} as Record<string, number>);

  const revenueByVeg = Object.entries(revByVegMap)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value);

    const allTransactions = Array.from(new Map<string, any>([...sold, ...donated].map(item => [item.id, item])).values()).sort((a, b) => {
      const dateA = a.notes.length > 0 ? new Date(a.notes[a.notes.length - 1].date).getTime() : 0;
      const dateB = b.notes.length > 0 ? new Date(b.notes[b.notes.length - 1].date).getTime() : 0;
      return dateB - dateA;
    });

    return { sold, donated, totalRevenue, totalSoldQty, totalDonatedQty, revenueByVeg, allTransactions };
  }, [yearSeedlings]);

  // Harvest Data
  const harvestData = useMemo(() => {
    if (!yearSeedlings) return { totalByVeg: [], recentHarvests: [] };

    const vegTotals: Record<string, Record<string, number>> = {};
    const allHarvests: any[] = [];

    yearSeedlings.forEach(s => {
      if (s.harvests) {
        s.harvests.forEach(h => {
          if (new Date(h.date).getFullYear() === selectedYear) {
            allHarvests.push({ ...h, vegetable: s.vegetable, variety: s.variety, seedlingId: s.id });
            
            if (!vegTotals[s.vegetable]) vegTotals[s.vegetable] = {};
            vegTotals[s.vegetable][h.unit] = (vegTotals[s.vegetable][h.unit] || 0) + h.quantity;
          }
        });
      }
    });

    const totalByVeg = Object.entries(vegTotals).map(([vegetable, units]) => {
      return {
        vegetable,
        units: Object.entries(units).map(([unit, quantity]) => ({ unit, quantity }))
      };
    }).sort((a, b) => a.vegetable.localeCompare(b.vegetable));

    const recentHarvests = allHarvests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { totalByVeg, recentHarvests };
  }, [yearSeedlings, selectedYear]);

  if (!seedlings) return <div>Chargement...</div>;

  const archived = yearSeedlings.filter(s => s.isArchived);
  const successes = archived.filter(s => s.success === true);

  const archivedSown = archived.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  const archivedSuccessQty = archived.reduce((sum, s) => {
    if (s.success === true) {
      return sum + (Number(s.quantityPlanted) || Number(s.quantityTransplanted) || Number(s.quantity) || 0);
    }
    return sum;
  }, 0);

  const successRate = archivedSown > 0 ? Math.round((archivedSuccessQty / archivedSown) * 100) : 0;
  const stateData = Object.entries(
    yearSeedlings.reduce((acc, s) => {
      acc[s.state] = (acc[s.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  interface VegetableStat {
    name: string;
    totalSown: number;
    totalTransplanted: number;
    totalPlanted: number;
    archivedSown: number;
    archivedSuccess: number;
  }
  const vegetableStats = yearSeedlings.reduce((acc, s) => {
    if (!acc[s.vegetable]) {
      acc[s.vegetable] = { 
        name: s.vegetable, 
        totalSown: 0, 
        totalTransplanted: 0,
        totalPlanted: 0,
        archivedSown: 0,
        archivedSuccess: 0
      };
    }
    acc[s.vegetable].totalSown += (Number(s.quantity) || 0);
    acc[s.vegetable].totalTransplanted += (Number(s.quantityTransplanted) || 0);
    acc[s.vegetable].totalPlanted += (Number(s.quantityPlanted) || 0);
    
    if (s.isArchived) {
      acc[s.vegetable].archivedSown += (Number(s.quantity) || 0);
      if (s.success === true) {
        acc[s.vegetable].archivedSuccess += (Number(s.quantityPlanted) || Number(s.quantityTransplanted) || Number(s.quantity) || 0);
      }
    }
    return acc;
  }, {} as Record<string, VegetableStat>);

  const topVegetablesData = (Object.values(vegetableStats) as VegetableStat[])
    .sort((a, b) => b.totalSown - a.totalSown)
    .slice(0, 10)
    .map((stat: VegetableStat) => ({
      name: stat.name,
      repiques: stat.totalTransplanted,
      semes_restants: Math.max(0, stat.totalSown - stat.totalTransplanted),
      total: stat.totalSown
    }));

  const vegetableTableData = (Object.values(vegetableStats) as VegetableStat[])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((stat: VegetableStat) => ({
      ...stat,
      successRate: stat.archivedSown > 0 ? Math.round((stat.archivedSuccess / stat.archivedSown) * 100) : null
    }));

  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const monthlyData = monthNames.map((name, index) => {
    let semisCount = 0;
    let repiquageCount = 0;
    let plantationCount = 0;

    seedlings.forEach(s => {
      if (s.dateSown) {
        const d = new Date(s.dateSown);
        if (d.getMonth() === index && d.getFullYear() === selectedYear) semisCount += (Number(s.quantity) || 0);
      }
      if (s.dateTransplanted) {
        const d = new Date(s.dateTransplanted);
        if (d.getMonth() === index && d.getFullYear() === selectedYear) repiquageCount += (Number(s.quantityTransplanted) || 0);
      }
      if (s.datePlanted) {
        const d = new Date(s.datePlanted);
        if (d.getMonth() === index && d.getFullYear() === selectedYear) plantationCount += (Number(s.quantityPlanted) || 0);
      }
    });

    return {
      name,
      monthIndex: index,
      semis: semisCount,
      repiquage: repiquageCount,
      plantation: plantationCount,
    };
  });

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const totalSown = seedlings.reduce((sum, s) => {
    if (s.dateSown && new Date(s.dateSown).getFullYear() === selectedYear) return sum + (Number(s.quantity) || 0);
    if (!s.dateSown && selectedYear === new Date().getFullYear()) return sum + (Number(s.quantity) || 0);
    return sum;
  }, 0);
  
  const totalTransplanted = seedlings.reduce((sum, s) => {
    if (s.dateTransplanted && new Date(s.dateTransplanted).getFullYear() === selectedYear) return sum + (Number(s.quantityTransplanted) || 0);
    if (!s.dateTransplanted && selectedYear === new Date().getFullYear()) return sum + (Number(s.quantityTransplanted) || 0);
    return sum;
  }, 0);
  
  const totalPlanted = seedlings.reduce((sum, s) => {
    if (s.datePlanted && new Date(s.datePlanted).getFullYear() === selectedYear) return sum + (Number(s.quantityPlanted) || 0);
    if (!s.datePlanted && selectedYear === new Date().getFullYear()) return sum + (Number(s.quantityPlanted) || 0);
    return sum;
  }, 0);

  const handleMonthClick = (data: any) => {
    let monthIndex;
    if (data && data.activePayload && data.activePayload.length > 0) {
      monthIndex = data.activePayload[0].payload.monthIndex;
    } else if (data && data.monthIndex !== undefined) {
      monthIndex = data.monthIndex;
    } else if (data && data.activeTooltipIndex !== undefined) {
      monthIndex = data.activeTooltipIndex;
    }

    if (monthIndex !== undefined) {
      sessionStorage.setItem('seedlings_filter_month', monthIndex.toString());
      sessionStorage.setItem('seedlings_filter_year', selectedYear.toString());
      
      // Reset other filters to ensure the user sees the data
      sessionStorage.setItem('seedlings_filter_state', 'all');
      sessionStorage.setItem('seedlings_filter_vegetable', 'all');
      sessionStorage.setItem('seedlings_filter_archived', 'all');
      sessionStorage.setItem('seedlings_filter_success', 'all');
      sessionStorage.setItem('seedlings_search', '');
      
      setCurrentView('seedlings');
    }
  };

  return (
    <div className="space-y-3" id="dashboard-print-area">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-xl font-serif font-medium tracking-tight text-stone-900">Tableau de bord</h1>
          <p className="text-xs text-stone-500 mt-0.5">Vue d'ensemble et statistiques de votre potager.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => printElement('dashboard-print-area', 'Tableau de bord')}
            className="p-1 text-stone-600 hover:bg-stone-200 rounded-md transition-colors print:hidden"
            title="Imprimer / PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => {
              sessionStorage.setItem('seedlings_filter_archived', 'archived');
              sessionStorage.setItem('seedlings_filter_state', 'all');
              sessionStorage.setItem('seedlings_filter_vegetable', 'all');
              sessionStorage.setItem('seedlings_filter_success', 'all');
              sessionStorage.setItem('seedlings_filter_month', 'all');
              sessionStorage.setItem('seedlings_filter_year', 'all');
              sessionStorage.setItem('seedlings_search', '');
              setCurrentView('seedlings');
            }}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5 print:hidden"
          >
            <Archive className="w-3.5 h-3.5" />
            Archives
          </button>
          <button 
            onClick={() => setCurrentView('seedling-new')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5 print:hidden"
          >
            <Sprout className="w-3.5 h-3.5" />
            Nouveau semis
          </button>
        </div>
      </header>

      {weatherAlerts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 font-medium">Alertes Météo</span>
          </div>
          <ul className="space-y-2">
            {weatherAlerts.map((alert, idx) => (
              <li key={idx} className="text-sm text-red-800 flex items-start gap-2">
                <span className="font-semibold">{alert.date} :</span>
                <span>{alert.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-4 border-b border-stone-200 mb-4 print:hidden">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Vue d'ensemble
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sales' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Ventes & Dons
        </button>
        <button
          onClick={() => setActiveTab('harvests')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'harvests' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Récoltes
        </button>
      </div>

      {/* OVERVIEW TAB */}
      <div className={activeTab === 'overview' ? 'space-y-3' : 'hidden'}>
        {/* Volume Global Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-100">
            <Sprout className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[9px] font-medium text-stone-500 uppercase tracking-wider">Graines semées</p>
            <p className="text-xl font-semibold text-stone-900">{totalSown}</p>
          </div>
        </div>
        
        <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-100">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-[9px] font-medium text-stone-500 uppercase tracking-wider">Plants repiqués</p>
            <p className="text-xl font-semibold text-stone-900">{totalTransplanted}</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-100">
            <CheckCircle2 className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[9px] font-medium text-stone-500 uppercase tracking-wider">Mis en terre</p>
            <p className="text-xl font-semibold text-stone-900">{totalPlanted}</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60 flex items-center gap-2.5 cursor-pointer hover:bg-stone-50 transition-colors" onClick={() => setCurrentView('tasks')}>
          <div className="p-2 rounded-lg bg-red-100">
            <CheckSquare className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-[9px] font-medium text-stone-500 uppercase tracking-wider">Tâches en attente</p>
            <p className="text-xl font-semibold text-stone-900">{totalPendingTasks}</p>
          </div>
        </div>
      </div>

      {/* Tasks Summary Section */}
      {(manualTasks?.length || 0) > 0 || pendingAutoTasks.length > 0 ? (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-stone-800">Tâches prioritaires</h2>
            </div>
            <button 
              onClick={() => setCurrentView('tasks')}
              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider flex items-center gap-1"
            >
              Tout voir
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...(manualTasks || []), ...pendingAutoTasks.map(at => ({ ...at, type: 'auto' }))].slice(0, 3).map((task, i) => (
              <div 
                key={i} 
                onClick={() => {
                  if (task.type === 'auto' && task.id) {
                    setCurrentView(`seedling-detail-${task.id}`);
                  } else {
                    setCurrentView('tasks');
                  }
                }}
                className="p-3 rounded-lg bg-stone-50 border border-stone-100 flex items-start gap-3 cursor-pointer hover:bg-stone-100 hover:border-emerald-200 transition-all"
              >
                <div className={`mt-0.5 ${task.priority === 'high' ? 'text-red-500' : 'text-stone-400'}`}>
                  {task.type === 'auto' ? <Sprout className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-stone-900 truncate">{task.title}</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">
                    {task.type === 'auto' ? 'Suggestion automatique' : 'Tâche manuelle'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60 lg:col-span-2">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <h2 className="text-base font-serif font-medium">Top 10 des légumes semés</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topVegetablesData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="repiques" stackId="a" fill="#3b82f6" name="Repiqués" />
                <Bar dataKey="semes_restants" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} name="Semés (non repiqués)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
              <h2 className="text-base font-serif font-medium">Activité mensuelle</h2>
            </div>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-1.5 py-0.5 bg-stone-50 border border-stone-200 rounded-md text-[10px] font-medium text-stone-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={handleMonthClick} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 11}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: '11px' }}/>
                <Bar dataKey="semis" name="Semis" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="repiquage" name="Repiquage" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="plantation" name="Plantation" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60">
          <div className="flex items-center gap-1.5 mb-3">
            <PieChartIcon className="w-3.5 h-3.5 text-emerald-600" />
            <h2 className="text-base font-serif font-medium">Répartition par état</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stateData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table: Bilan par légume */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60 mt-3">
        <div className="flex items-center gap-1.5 mb-3">
          <Sprout className="w-3.5 h-3.5 text-emerald-600" />
          <h2 className="text-base font-serif font-medium">Bilan par légume</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-600">
            <thead className="bg-stone-50 text-stone-500 uppercase font-medium text-[10px]">
              <tr>
                <th className="px-3 py-2">Légume</th>
                <th className="px-3 py-2 text-right">Semés</th>
                <th className="px-3 py-2 text-right">Repiqués</th>
                <th className="px-3 py-2 text-right">Plantés</th>
                <th className="px-3 py-2 text-right">Réussite (Archivés)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {vegetableTableData.map(stat => (
                <tr key={stat.name} className="hover:bg-stone-50">
                  <td className="px-3 py-2 font-medium text-stone-900">{stat.name}</td>
                  <td className="px-3 py-2 text-right">{stat.totalSown}</td>
                  <td className="px-3 py-2 text-right">{stat.totalTransplanted}</td>
                  <td className="px-3 py-2 text-right">{stat.totalPlanted}</td>
                  <td className="px-3 py-2 text-right">
                    {stat.successRate !== null ? (
                      <span className={`font-medium ${stat.successRate >= 80 ? 'text-emerald-600' : stat.successRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {stat.successRate}%
                      </span>
                    ) : (
                      <span className="text-stone-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {vegetableTableData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-stone-400 italic">
                    Aucune donnée pour cette année
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* SALES TAB */}
      <div className={activeTab === 'sales' ? 'space-y-4' : 'hidden'}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-100">
              <Coins className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">Revenus totaux</p>
              <p className="text-2xl font-semibold text-stone-900">{salesData.totalRevenue} €</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100">
              <ShoppingBag className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">Plants vendus</p>
              <p className="text-2xl font-semibold text-stone-900">{salesData.totalSoldQty}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-100">
              <Gift className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">Plants donnés</p>
              <p className="text-2xl font-semibold text-stone-900">{salesData.totalDonatedQty}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-stone-200/60">
            <h2 className="text-sm font-semibold text-stone-800 mb-4">Revenus par légume</h2>
            <div className="h-64">
              {salesData.revenueByVeg.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesData.revenueByVeg}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {salesData.revenueByVeg.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} €`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-stone-400 text-sm italic">
                  Aucune vente enregistrée
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-stone-200/60 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-800">Historique des ventes & dons</h2>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider text-stone-500 bg-stone-50/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Légume</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium text-right">Qté</th>
                    <th className="px-4 py-3 font-medium text-right">Prix</th>
                    <th className="px-4 py-3 font-medium">Commentaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {salesData.allTransactions.map(t => {
                    const isSale = t.salePrice !== undefined && t.salePrice > 0;
                    const dateStr = t.notes.length > 0 ? new Date(t.notes[t.notes.length - 1].date).toLocaleDateString() : '-';
                    return (
                      <tr key={t.id} className="hover:bg-stone-50 transition-colors cursor-pointer" onClick={() => setCurrentView(`seedling-detail-${t.id}`)}>
                        <td className="px-4 py-3 text-stone-500">{dateStr}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-stone-900">{t.vegetable}</div>
                          <div className="text-xs text-stone-500">{t.variety}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${isSale ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isSale ? 'Vente' : 'Don'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-stone-900">{t.quantity}</td>
                        <td className="px-4 py-3 text-right">
                          {isSale ? <span className="font-medium text-emerald-600">{t.salePrice} €</span> : <span className="text-stone-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-stone-500 text-xs max-w-[200px] truncate" title={t.saleComment || ''}>
                          {t.saleComment || '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {salesData.allTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-400 italic">
                        Aucune transaction pour cette année
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* HARVESTS TAB */}
      <div className={activeTab === 'harvests' ? 'space-y-4' : 'hidden'}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-stone-200/60">
            <h2 className="text-sm font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wheat text-emerald-600"><path d="M2 22 22 2"/><path d="M3.4 16.2 6.2 19"/><path d="M5.5 12.7 9.8 17"/><path d="M8.4 9.8 14.1 15.5"/><path d="M12 7 18.4 13.4"/><path d="M16.2 4.9 21.2 9.9"/></svg>
              Totaux par légume
            </h2>
            <div className="space-y-3">
              {harvestData.totalByVeg.length > 0 ? (
                harvestData.totalByVeg.map(veg => (
                  <div key={veg.vegetable} className="p-3 rounded-lg border border-stone-100 bg-stone-50/50">
                    <h3 className="font-medium text-stone-900 mb-2">{veg.vegetable}</h3>
                    <div className="flex flex-wrap gap-2">
                      {veg.units.map(u => (
                        <span key={u.unit} className="inline-flex items-center px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-medium">
                          {u.quantity} {u.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-stone-400 text-sm italic py-4">
                  Aucune récolte enregistrée cette année
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-stone-200/60 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-800">Historique des récoltes</h2>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider text-stone-500 bg-stone-50/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Légume</th>
                    <th className="px-4 py-3 font-medium text-right">Quantité</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {harvestData.recentHarvests.map(h => (
                    <tr key={`${h.id}-${h.seedlingId}`} className="hover:bg-stone-50 transition-colors cursor-pointer" onClick={() => setCurrentView(`seedling-detail-${h.seedlingId}`)}>
                      <td className="px-4 py-3 text-stone-500">{new Date(h.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-stone-900">{h.vegetable}</div>
                        <div className="text-xs text-stone-500">{h.variety}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        {h.quantity} {h.unit}
                      </td>
                      <td className="px-4 py-3 text-stone-500 text-xs max-w-[200px] truncate" title={h.notes || ''}>
                        {h.notes || '-'}
                      </td>
                    </tr>
                  ))}
                  {harvestData.recentHarvests.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-stone-400 italic">
                        Aucune récolte pour cette année
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
