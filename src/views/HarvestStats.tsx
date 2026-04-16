import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie } from 'recharts';
import { BarChart3, Scale, Hash, Trophy, TrendingUp, Euro, MapPin, ChevronDown, ChevronUp, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmModal } from '../components/Modals';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#f97316', '#6366f1'];

// Average price per kg for vegetables (estimated)
const PRICE_PER_KG = 3.5; 

export function HarvestStats() {
  const seedlings = useLiveQuery(() => db.seedlings.filter(s => !s.isDeleted).toArray());
  const config = useLiveQuery(() => db.config.toArray());
  const encyclopedia = useLiveQuery(() => db.encyclopedia.toArray());
  const expenses = useLiveQuery(() => db.expenses.toArray());
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const stats = useMemo(() => {
    if (!seedlings || !config || !encyclopedia || !expenses) return null;

    let totalKg = 0;
    let totalPieces = 0;
    let totalEstimatedValue = 0;
    
    const vegetableStats: Record<string, { kg: number, pieces: number, value: number }> = {};
    const monthlyStats: Record<string, { kg: number, pieces: number }> = {};
    const varietyStats: Record<string, { kg: number, pieces: number, vegetable: string, value: number }> = {};
    const zoneStats: Record<string, { kg: number, pieces: number }> = {};

    let filteredExpenses = expenses;

    if (selectedYear !== 'all') {
      filteredExpenses = filteredExpenses.filter(e => e.date.startsWith(selectedYear));
    }
    if (selectedMonth !== 'all') {
      const monthPrefix = `${selectedYear !== 'all' ? selectedYear : new Date().getFullYear()}-${selectedMonth.padStart(2, '0')}`;
      filteredExpenses = filteredExpenses.filter(e => e.date.startsWith(monthPrefix));
    }

    seedlings.forEach(s => {
      if (!s.harvests || s.harvests.length === 0) return;

      s.harvests.forEach(h => {
        const hDate = new Date(h.date);
        if (selectedYear !== 'all' && hDate.getFullYear().toString() !== selectedYear) return;
        if (selectedMonth !== 'all' && (hDate.getMonth() + 1).toString().padStart(2, '0') !== selectedMonth) return;

        let kg = 0;
        let pieces = 0;

        if (h.unit === 'kg') kg = h.quantity;
        else if (h.unit === 'g') kg = h.quantity / 1000;
        else if (h.unit === 'pièces') pieces = h.quantity;

        totalKg += kg;
        totalPieces += pieces;

        // By Vegetable
        const entry = encyclopedia.find(e => e.name === s.vegetable);
        const pricePerKg = entry?.pricePerKg || PRICE_PER_KG;
        const value = kg * pricePerKg;
        
        totalEstimatedValue += value;

        if (!vegetableStats[s.vegetable]) vegetableStats[s.vegetable] = { kg: 0, pieces: 0, value: 0 };
        vegetableStats[s.vegetable].kg += kg;
        vegetableStats[s.vegetable].pieces += pieces;
        vegetableStats[s.vegetable].value += value;

        // By Variety
        const varKey = s.variety ? `${s.vegetable} - ${s.variety}` : s.vegetable;
        if (!varietyStats[varKey]) varietyStats[varKey] = { kg: 0, pieces: 0, vegetable: s.vegetable, value: 0 };
        varietyStats[varKey].kg += kg;
        varietyStats[varKey].pieces += pieces;
        varietyStats[varKey].value += value;

        // By Zone
        const zoneName = s.zoneId ? config.find(c => c.id === s.zoneId)?.value || 'Zone inconnue' : 'Non assigné';
        if (!zoneStats[zoneName]) zoneStats[zoneName] = { kg: 0, pieces: 0 };
        zoneStats[zoneName].kg += kg;
        zoneStats[zoneName].pieces += pieces;

        // By Month
        const date = new Date(h.date);
        const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
        const monthName = monthNames[date.getMonth()];
        const year = date.getFullYear();
        const monthSortKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthName} ${year}`;
        
        if (!monthlyStats[monthSortKey]) monthlyStats[monthSortKey] = { kg: 0, pieces: 0, label: monthLabel } as any;
        monthlyStats[monthSortKey].kg += kg;
        monthlyStats[monthSortKey].pieces += pieces;
      });
    });

    // Format for Recharts
    const vegChartData = Object.entries(vegetableStats)
      .map(([name, data]) => ({ name, kg: Number(data.kg.toFixed(2)), pieces: data.pieces }))
      .sort((a, b) => b.kg - a.kg || b.pieces - a.pieces);

    const monthChartData = Object.entries(monthlyStats)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([sortKey, data]: [string, any]) => ({ 
        month: data.label, 
        kg: Number(data.kg.toFixed(2)), 
        pieces: data.pieces 
      }));

    const zoneChartData = Object.entries(zoneStats)
      .map(([name, data]) => ({ name, value: Number(data.kg.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    const varietyRanking = Object.entries(varietyStats)
      .map(([name, data]) => ({ name, kg: Number(data.kg.toFixed(2)), pieces: data.pieces, vegetable: data.vegetable, value: Number(data.value.toFixed(2)) }))
      .sort((a, b) => b.kg - a.kg || b.pieces - a.pieces);

    // Find top variety
    const topVarietyKg = varietyRanking.length > 0 ? varietyRanking[0] : { name: '-', kg: 0 };

    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = totalEstimatedValue - totalExpenses;

    return {
      totalKg: Number(totalKg.toFixed(2)),
      totalPieces,
      totalEstimatedValue: Number(totalEstimatedValue.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      vegChartData,
      monthChartData,
      zoneChartData,
      varietyRanking,
      topVarietyKg,
      filteredExpenses
    };
  }, [seedlings, config, encyclopedia, expenses, selectedYear, selectedMonth]);

  if (!seedlings || !stats) return <div className="p-4 text-stone-500">Chargement des statistiques...</div>;

  const years = Array.from(new Set([
    ...seedlings.flatMap(s => s.harvests?.map(h => new Date(h.date).getFullYear().toString()) || []),
    ...(expenses?.map(e => new Date(e.date).getFullYear().toString()) || [])
  ])).sort((a, b) => b.localeCompare(a));

  const months = [
    { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' }, { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' }, { value: '05', label: 'Mai' }, { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' }, { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' }, { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-medium text-stone-900">Statistiques des récoltes</h1>
            <p className="text-xs text-stone-500">Analysez la productivité de votre potager</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedYear} 
            onChange={(e) => {
              setSelectedYear(e.target.value);
              if (e.target.value === 'all') setSelectedMonth('all');
            }}
            className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-700"
          >
            <option value="all">Toutes les années</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {selectedYear !== 'all' && (
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-700"
            >
              <option value="all">Tous les mois</option>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Poids total</p>
            <p className="text-2xl font-bold text-stone-900">{stats.totalKg} <span className="text-sm font-medium text-stone-500">kg</span></p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Euro className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Valeur estimée</p>
            <p className="text-2xl font-bold text-stone-900">{stats.totalEstimatedValue} <span className="text-sm font-medium text-stone-500">€</span></p>
            <p className="text-[10px] text-stone-400 italic">Basé sur l'encyclopédie</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 flex items-center gap-4">
          <div className={`p-3 rounded-xl ${stats.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Rentabilité nette</p>
            <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.netProfit > 0 ? '+' : ''}{stats.netProfit} <span className="text-sm font-medium">€</span>
            </p>
            <p className="text-[10px] text-stone-400 italic">Valeur - Dépenses ({stats.totalExpenses}€)</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Top Variété</p>
            <p className="text-lg font-bold text-stone-900 truncate max-w-[150px]" title={stats.topVarietyKg.name}>
              {stats.topVarietyKg.name}
            </p>
            <p className="text-xs text-stone-500">{stats.topVarietyKg.kg.toFixed(2)} kg</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Zone la plus productive</p>
            <p className="text-lg font-bold text-stone-900">
              {stats.zoneChartData.length > 0 ? stats.zoneChartData[0].name : '-'}
            </p>
            <p className="text-xs text-stone-500">
              {stats.zoneChartData.length > 0 ? `${stats.zoneChartData[0].value} kg` : ''}
            </p>
          </div>
        </div>
      </div>

      {stats.totalKg === 0 && stats.totalPieces === 0 ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200/60 text-center">
          <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-medium text-stone-900 mb-2">Aucune récolte enregistrée</h2>
          <p className="text-stone-500 text-sm max-w-md mx-auto">
            Commencez à enregistrer vos récoltes depuis les fiches de vos plantations pour voir apparaître vos statistiques ici.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart: Récoltes par mois */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200/60">
            <h3 className="text-sm font-bold text-stone-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Évolution des récoltes (kg)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.monthChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value} kg`, 'Poids']}
                  />
                  <Line type="monotone" dataKey="kg" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart: Répartition par Zone */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200/60">
            <h3 className="text-sm font-bold text-stone-800 mb-6 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              Productivité par Zone (kg)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.zoneChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.zoneChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value} kg`, 'Poids']}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart: Récoltes par légume (kg) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200/60 lg:col-span-2">
            <h3 className="text-sm font-bold text-stone-800 mb-6">Répartition par légume (Poids en kg)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.vegChartData.filter(d => d.kg > 0)} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value} kg`, 'Poids']}
                  />
                  <Bar dataKey="kg" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                    {stats.vegChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Details Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden">
            <div className="p-5 border-b border-stone-100 flex justify-between items-center">
              <h3 className="text-sm font-bold text-stone-800">Classement détaillé des variétés</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-stone-500 bg-stone-50/50 uppercase">
                  <tr>
                    <th className="px-6 py-3 font-medium">Variété</th>
                    <th className="px-6 py-3 font-medium">Légume</th>
                    <th className="px-6 py-3 font-medium text-right">Poids (kg)</th>
                    <th className="px-6 py-3 font-medium text-right">Valeur (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {stats.varietyRanking.map((row, i) => (
                    <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-6 py-3 font-medium text-stone-900">{row.name}</td>
                      <td className="px-6 py-3 text-stone-500">{row.vegetable}</td>
                      <td className="px-6 py-3 text-right text-stone-600">
                        {row.kg > 0 ? <span className="font-medium">{row.kg.toFixed(2)} kg</span> : '-'}
                      </td>
                      <td className="px-6 py-3 text-right text-emerald-600 font-medium">
                        {row.value.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ExpensesSection expenses={stats.filteredExpenses} config={config} />
    </div>
  );
}

function ExpensesSection({ expenses, config }: { expenses: any[], config: any[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], category: '', amount: '', description: '' });
  const [confirmDelete, setConfirmDelete] = useState<{isOpen: boolean, id: string | null}>({ isOpen: false, id: null });

  const categories = config.filter(c => c.type === 'expense_category').map(c => c.value);
  const defaultCategory = categories.length > 0 ? categories[0] : 'Autre';

  // Set default category when opening form
  React.useEffect(() => {
    if (isAdding && !form.category) {
      setForm(prev => ({ ...prev, category: defaultCategory }));
    }
  }, [isAdding, defaultCategory, form.category]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) return;

    await db.expenses.add({
      id: uuidv4(),
      date: form.date,
      category: form.category,
      amount: Number(form.amount),
      description: form.description
    });

    setForm({ date: new Date().toISOString().split('T')[0], category: defaultCategory, amount: '', description: '' });
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ isOpen: true, id });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden mt-6">
      <div className="p-5 border-b border-stone-100 flex justify-between items-center">
        <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
          <Euro className="w-4 h-4 text-stone-500" />
          Dépenses
        </h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter
        </button>
      </div>

      {isAdding && (
        <div className="p-5 bg-stone-50 border-b border-stone-100">
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Date</label>
              <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Catégorie</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Description</label>
              <input type="text" placeholder="ex: Graines de tomates" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Montant (€)</label>
              <div className="flex gap-2">
                <input type="number" required step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm" />
                <button type="submit" className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        {expenses.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-sm">Aucune dépense enregistrée.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-stone-500 bg-stone-50/50 uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Catégorie</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium text-right">Montant</th>
                <th className="px-6 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((exp) => (
                <tr key={exp.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-6 py-3 text-stone-500">{new Date(exp.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-6 py-3 font-medium text-stone-900">
                    <span className="px-2 py-1 bg-stone-100 text-stone-600 rounded-md text-xs">{exp.category}</span>
                  </td>
                  <td className="px-6 py-3 text-stone-600">{exp.description}</td>
                  <td className="px-6 py-3 text-right text-red-600 font-medium">
                    -{exp.amount.toFixed(2)} €
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => handleDelete(exp.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: null })}
        onConfirm={async () => {
          if (confirmDelete.id) {
            await db.expenses.delete(confirmDelete.id);
            setConfirmDelete({ isOpen: false, id: null });
          }
        }}
        title="Supprimer la dépense"
        message="Voulez-vous vraiment supprimer cette dépense ?"
        isDanger={true}
      />
    </div>
  );
}
