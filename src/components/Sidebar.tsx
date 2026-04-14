import React from 'react';
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
  Map,
  Trees,
  Calendar,
  CheckSquare
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'seedlings', label: 'Mes Semis', icon: Sprout },
    { id: 'tasks', label: 'Tâches', icon: CheckSquare },
    { id: 'calendar', label: 'Calendrier', icon: Calendar },
    { id: 'stats', label: 'Statistiques', icon: BarChart3 },
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
        <h1 className="text-base font-serif text-emerald-400 flex items-center gap-1.5">
          <Sprout className="w-4 h-4" />
          PotagerApp
        </h1>
      </div>
      <nav className="flex-1 px-1.5 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id || (currentView.startsWith('seedling-') && item.id === 'seedlings');
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
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
    </div>
  );
}
