import React, { useState, useEffect } from 'react';
import { Sprout, Trees } from 'lucide-react';
import { GardenPlan } from './GardenPlan';
import { Orchard } from './Orchard';

export type PlanSubTab = 'potager' | 'verger';

export function PlanView({
  setCurrentView,
  initialTab,
}: {
  setCurrentView?: (view: string) => void;
  initialTab?: PlanSubTab;
}) {
  const [activeTab, setActiveTab] = useState<PlanSubTab>(() => {
    if (initialTab) return initialTab;
    try {
      if (localStorage.getItem('orchard_pending_placement')) {
        return 'verger';
      }
      const saved = localStorage.getItem('plan_active_tab');
      if (saved === 'potager' || saved === 'verger') return saved;
    } catch {}
    return 'potager';
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      try {
        localStorage.setItem('plan_active_tab', initialTab);
      } catch {}
    } else {
      try {
        if (localStorage.getItem('orchard_pending_placement')) {
          setActiveTab('verger');
        }
      } catch {}
    }
  }, [initialTab]);

  const handleSelectTab = (tab: PlanSubTab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('plan_active_tab', tab);
    } catch {}
  };

  return (
    <div className="space-y-5">
      {/* Unified Plan Switcher: Potager vs Verger */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-stone-200/80 shadow-xs print:hidden">
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200/60 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleSelectTab('potager')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'potager'
                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50/70'
            }`}
          >
            <Sprout className={`w-4 h-4 ${activeTab === 'potager' ? 'text-emerald-600' : 'text-stone-400'}`} />
            <span>Potager</span>
            <span className="hidden md:inline text-[11px] font-normal text-stone-400">
              (Planches &amp; Semis)
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('verger')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'verger'
                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50/70'
            }`}
          >
            <Trees className={`w-4 h-4 ${activeTab === 'verger' ? 'text-emerald-600' : 'text-stone-400'}`} />
            <span>Verger</span>
            <span className="hidden md:inline text-[11px] font-normal text-stone-400">
              (Terrains &amp; Arbres)
            </span>
          </button>
        </div>

        <p className="text-xs text-stone-500 px-2 hidden lg:block">
          {activeTab === 'potager'
            ? 'Planches de culture et semis de la saison sélectionnée'
            : 'Terrains permanents, arbres fruitiers et arbustes du Catalogue'}
        </p>
      </div>

      {activeTab === 'potager' ? (
        <GardenPlan setCurrentView={setCurrentView} />
      ) : (
        <Orchard setCurrentView={setCurrentView} />
      )}
    </div>
  );
}
