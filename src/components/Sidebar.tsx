import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Sprout, 
  BookOpen, 
  Book, 
  Settings, 
  Trash2, 
  Save, 
  Printer,
  BarChart3,
  Scale,
  Map,
  Trees,
  Calendar,
  Cloud,
  CheckSquare,
  Plus
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

import { useSeason } from '../contexts/SeasonContext';

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { seasons, currentSeasonId, setCurrentSeasonId, createNewSeason, getSuggestedNextName, isLoading } = useSeason();
  const [isCreateSeasonModalOpen, setIsCreateSeasonModalOpen] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenCreateModal = () => {
    setNewSeasonName(getSuggestedNextName(seasons));
    setIsCreateSeasonModalOpen(true);
  };

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createNewSeason(newSeasonName.trim());
      setIsCreateSeasonModalOpen(false);
    } catch (err) {
      console.error('Failed to create season from sidebar', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'seedlings', label: 'Mes Semis', icon: Sprout },
    { id: 'tasks', label: 'Tâches', icon: CheckSquare },
    { id: 'calendar', label: 'Calendriers', icon: Calendar },
    { id: 'weather', label: 'Météo', icon: Cloud },
    { id: 'harvests', label: 'Récoltes', icon: Scale },
    { id: 'plan', label: 'Plan du potager', icon: Map },
    { id: 'orchard', label: 'Mon Verger', icon: Trees },
    { id: 'encyclopedia', label: 'Catalogue des Plantes', icon: BookOpen },
    { id: 'journal', label: 'Journal de bord', icon: Book },
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'backup', label: 'Sauvegarde', icon: Save },
    { id: 'trash', label: 'Corbeille', icon: Trash2 },
  ];

  return (
    <div className="w-40 bg-stone-900 text-stone-300 flex flex-col h-full">
      <div className="p-2.5">
        <h1 className="text-base font-serif text-emerald-400 flex items-center gap-1.5 mb-2">
          <Sprout className="w-4 h-4" />
          PotagerApp
        </h1>
        {!isLoading && seasons.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              id="sidebar-season-select"
              value={currentSeasonId || 'all'}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  handleOpenCreateModal();
                } else {
                  setCurrentSeasonId(e.target.value);
                }
              }}
              className="flex-1 min-w-0 bg-stone-800 text-stone-200 text-[10px] rounded-md px-1.5 py-1 border border-stone-700 outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">Toutes les saisons</option>
              {seasons.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="__new__">+ Nouvelle saison...</option>
            </select>
            <button
              id="sidebar-add-season-btn"
              type="button"
              onClick={handleOpenCreateModal}
              className="p-1 text-stone-400 hover:text-emerald-400 hover:bg-stone-800 rounded transition-colors flex-shrink-0"
              title="Créer une nouvelle saison"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <nav className="flex-1 px-1.5 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id || 
            (currentView.startsWith('seedling-') && item.id === 'seedlings') ||
            ((currentView === 'calendar-perpetual' || currentView === 'perpetual' || currentView === 'calendar-multiplications' || currentView === 'multiplications') && item.id === 'calendar');
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'seedlings') {
                  sessionStorage.removeItem('seedlings_filter_archived');
                  sessionStorage.removeItem('seedlings_filter_states');
                  sessionStorage.removeItem('seedlings_filter_vegetable');
                  sessionStorage.removeItem('seedlings_search');
                }
                setCurrentView(item.id);
              }}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'hover:bg-stone-800 hover:text-stone-100'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>
      <div className="p-1.5 text-[8px] text-stone-500 text-center">
        Gestion de semis v1.0
      </div>

      {isCreateSeasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-stone-900 text-stone-100 rounded-xl border border-stone-700 p-5 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-stone-100 flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Nouvelle saison
              </h3>
              <button 
                type="button"
                onClick={() => setIsCreateSeasonModalOpen(false)}
                className="text-stone-400 hover:text-stone-200 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            
            <p className="text-xs text-stone-400 mb-4">
              Créez une nouvelle saison pour vos nouveaux semis tout en conservant vos configurations et l'historique des saisons précédentes.
            </p>

            <form onSubmit={handleCreateSeason}>
              <div className="mb-4">
                <label className="block text-xs font-medium text-stone-300 mb-1.5">
                  Nom de la saison
                </label>
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="ex: Saison 2026/2027"
                  className="w-full px-3 py-2 text-xs bg-stone-800 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateSeasonModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newSeasonName.trim()}
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer et basculer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
