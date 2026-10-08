import React, { useState, useMemo } from 'react';
import { 
  X, Printer, Calendar, Table, FileText, CheckSquare, 
  Layers, Filter, Trees, Check, Apple, Sparkles, 
  Info, PenLine
} from 'lucide-react';
import { Tree } from '../db';
import { printElement } from '../utils/print';
import { formatHarvestPeriodSummary } from '../views/HarvestCalendar';
import { cleanDisplayName, isTechnicalId } from '../utils/varietyNormalizer';

export interface HarvestVarietyGroupItem {
  key: string;
  species: string;
  variety: string;
  displayName: string;
  icon?: string;
  color?: string;
  plantedCount: number;
  plannedCount: number;
  totalTrees: number;
  trees: Tree[];
  expectedYield: number;
  expectedYieldUnit: string;
  harvestMonths: number[];
  varietyConfigId?: string;
  spellingVariants?: string[];
}

export interface HarvestCalendarPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  varietyGroups: HarvestVarietyGroupItem[];
  filteredVarieties: HarvestVarietyGroupItem[];
  trees: Tree[];
  filteredTrees: Tree[];
  activeSpeciesFilter?: string;
  activeStatusFilter?: string;
  searchTerm?: string;
}

export type PrintLayoutMode = 'matrix' | 'monthly' | 'complete' | 'checklist';
export type PrintScope = 'all' | 'filtered' | 'planted_only' | 'planned_only';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MONTH_ABBR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
];

export function HarvestCalendarPrintModal({
  isOpen,
  onClose,
  varietyGroups,
  filteredVarieties,
  trees,
  filteredTrees,
  activeSpeciesFilter = 'all',
  activeStatusFilter = 'all',
  searchTerm = ''
}: HarvestCalendarPrintModalProps) {
  const currentYear = new Date().getFullYear();

  // Print controls
  const [layoutMode, setLayoutMode] = useState<PrintLayoutMode>('matrix');
  const [printScope, setPrintScope] = useState<PrintScope>('all');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [scale, setScale] = useState<number>(90);
  
  // Customization options
  const [docTitle, setDocTitle] = useState<string>(`Calendrier des Récoltes du Verger`);
  const [docSubtitle, setDocSubtitle] = useState<string>(`Planning annuel et maturité des fruits • Saison ${currentYear}`);
  const [showYields, setShowYields] = useState<boolean>(true);
  const [showPeriodSummary, setShowPeriodSummary] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showFieldNotes, setShowFieldNotes] = useState<boolean>(true);
  const [groupBySpecies, setGroupBySpecies] = useState<boolean>(true);

  // Compute targeted variety items according to scope
  const targetVarieties = useMemo(() => {
    let list: HarvestVarietyGroupItem[] = [];
    if (printScope === 'filtered') {
      list = filteredVarieties;
    } else if (printScope === 'planted_only') {
      list = varietyGroups.filter(v => v.plantedCount > 0);
    } else if (printScope === 'planned_only') {
      list = varietyGroups.filter(v => v.plannedCount > 0 || v.totalTrees === 0);
    } else {
      list = varietyGroups;
    }

    return list.filter(v => !isTechnicalId(v.species) && !isTechnicalId(v.variety));
  }, [printScope, filteredVarieties, varietyGroups]);

  // Aggregate metrics
  const totalTreesCount = useMemo(() => {
    return targetVarieties.reduce((sum, v) => sum + v.totalTrees, 0);
  }, [targetVarieties]);

  const totalYieldEstimate = useMemo(() => {
    return targetVarieties.reduce((sum, v) => sum + (v.expectedYield || 0), 0);
  }, [targetVarieties]);

  const totalSpeciesCount = useMemo(() => {
    return new Set(targetVarieties.map(v => v.species)).size;
  }, [targetVarieties]);

  // Group varieties by species if requested
  const varietiesBySpecies = useMemo(() => {
    const map = new Map<string, HarvestVarietyGroupItem[]>();
    targetVarieties.forEach(v => {
      const sp = v.species || 'Autres fruitiers';
      if (!map.has(sp)) map.set(sp, []);
      map.get(sp)!.push(v);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [targetVarieties]);

  // Monthly breakdown: Map each of 12 months to ripening varieties
  const monthlyRipening = useMemo(() => {
    return MONTH_NAMES.map((monthName, idx) => {
      const monthNum = idx + 1;
      const q1 = monthNum;
      const q2 = monthNum + 0.5;

      const itemsInMonth = targetVarieties.filter(v => 
        (v.harvestMonths || []).some(m => Math.abs(m - q1) < 0.01 || Math.abs(m - q2) < 0.01)
      ).map(v => {
        const hasQ1 = (v.harvestMonths || []).some(m => Math.abs(m - q1) < 0.01);
        const hasQ2 = (v.harvestMonths || []).some(m => Math.abs(m - q2) < 0.01);
        let timing = 'Tout le mois';
        if (hasQ1 && !hasQ2) timing = '1ère quinzaine (1-15)';
        else if (!hasQ1 && hasQ2) timing = '2ème quinzaine (16-31)';

        return {
          variety: v,
          timing,
          hasQ1,
          hasQ2
        };
      });

      return {
        monthIndex: idx,
        monthName,
        monthAbbr: MONTH_ABBR[idx],
        items: itemsInMonth
      };
    });
  }, [targetVarieties]);

  if (!isOpen) return null;

  const handlePrint = () => {
    printElement('harvest-calendar-printable-area', docTitle, {
      orientation,
      scale,
      hideHeader: true,
      extraStyles: `
        @media print {
          body {
            background-color: white !important;
            padding: 6mm;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .page-break-after {
            page-break-after: always;
            break-after: page;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border-color: #d6d3d1 !important;
          }
          .bg-emerald-500 {
            background-color: #10b981 !important;
            color: #ffffff !important;
          }
          .bg-amber-400 {
            background-color: #fbbf24 !important;
            color: #451a03 !important;
          }
          .bg-emerald-50 {
            background-color: #ecfdf5 !important;
          }
          .bg-stone-50 {
            background-color: #fafaf9 !important;
          }
          .bg-stone-100 {
            background-color: #f5f5f4 !important;
          }
        }
      `
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-medium text-stone-900">
                  Module d'Impression du Calendrier des Récoltes
                </h3>
                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  Précision 15 jours
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Générez des fiches et calendriers annuels mis en page pour affichage, carnet de verger ou export PDF.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-100 transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Controls Bar */}
        <div className="p-4 bg-stone-50/90 border-b border-stone-200/80 shrink-0 space-y-3">
          
          {/* Layout Mode Selection */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 shadow-2xs">
              <button
                type="button"
                onClick={() => { setLayoutMode('matrix'); setOrientation('landscape'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'matrix' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Matrice Annuelle (12 mois)</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('monthly'); setOrientation('portrait'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'monthly' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Récapitulatif Mois par Mois</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('checklist'); setOrientation('portrait'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'checklist' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Fiche Cueillette & Relevé</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('complete'); setOrientation('landscape'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'complete' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Dossier Complet</span>
              </button>
            </div>

            {/* Scope / Selection */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 text-xs shadow-2xs">
              <span className="text-stone-400 pl-2 pr-1 font-medium flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Périmètre :
              </span>
              <button
                type="button"
                onClick={() => setPrintScope('all')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printScope === 'all' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Tout le verger ({varietyGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setPrintScope('filtered')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printScope === 'filtered' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Filtre actif ({filteredVarieties.length})
              </button>
              <button
                type="button"
                onClick={() => setPrintScope('planted_only')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printScope === 'planted_only' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                🌿 Plantés ({varietyGroups.filter(v => v.plantedCount > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setPrintScope('planned_only')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printScope === 'planned_only' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                📅 Projets ({varietyGroups.filter(v => v.plannedCount > 0 || v.totalTrees === 0).length})
              </button>
            </div>
          </div>

          {/* Secondary configuration bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 pt-2 border-t border-stone-200/70">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Orientation */}
              <div className="flex items-center gap-2">
                <span className="text-stone-400 font-medium">Format :</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="harvest_orientation"
                    checked={orientation === 'landscape'}
                    onChange={() => setOrientation('landscape')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Paysage (A4)</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="harvest_orientation"
                    checked={orientation === 'portrait'}
                    onChange={() => setOrientation('portrait')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Portrait (A4)</span>
                </label>
              </div>

              {/* Scale */}
              <div className="flex items-center gap-2">
                <span className="text-stone-400 font-medium">Échelle :</span>
                <select
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs outline-none"
                >
                  <option value={75}>75% (très compact)</option>
                  <option value={85}>85% (compact)</option>
                  <option value={90}>90% (recommandé)</option>
                  <option value={100}>100% (standard)</option>
                </select>
              </div>

              {/* Toggles */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showYields}
                  onChange={(e) => setShowYields(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Rendements estimés</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPeriodSummary}
                  onChange={(e) => setShowPeriodSummary(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Résumé des périodes</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showFieldNotes}
                  onChange={(e) => setShowFieldNotes(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Zone notes manuscrites</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={groupBySpecies}
                  onChange={(e) => setGroupBySpecies(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Grouper par espèce</span>
              </label>
            </div>

            <div className="text-stone-500 font-medium text-[11px] bg-stone-100/90 px-2.5 py-1 rounded-lg">
              {targetVarieties.length} variété(s) • {totalTreesCount} arbre(s) • ~{totalYieldEstimate} kg estimé(s)
            </div>
          </div>

          {/* Document Title Editing */}
          <div className="pt-2 border-t border-stone-200/50 flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[11px] text-stone-400 font-medium whitespace-nowrap">Titre du document :</span>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 w-full sm:w-64 outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Titre imprimé..."
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:flex-1">
              <span className="text-[11px] text-stone-400 font-medium whitespace-nowrap">Sous-titre :</span>
              <input
                type="text"
                value={docSubtitle}
                onChange={(e) => setDocSubtitle(e.target.value)}
                className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs text-stone-600 w-full outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Sous-titre imprimé..."
              />
            </div>
          </div>
        </div>

        {/* Printable Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-100/70 custom-scrollbar">
          
          <div 
            id="harvest-calendar-printable-area" 
            className="bg-white p-6 sm:p-8 rounded-xl shadow-md border border-stone-200 mx-auto max-w-full text-stone-900"
            style={{ minHeight: '650px' }}
          >
            {/* Printable Document Header */}
            <div className="border-b-2 border-emerald-700 pb-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-serif font-bold text-2xl shadow-xs">
                  🍎
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 m-0">
                    {docTitle}
                  </h1>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {docSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end text-right text-[11px] text-stone-500">
                <div className="font-semibold text-stone-700">
                  Édition du {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium px-2 py-0.5 rounded">
                    {totalSpeciesCount} espèces • {targetVarieties.length} variétés
                  </span>
                  <span className="bg-stone-100 text-stone-700 font-medium px-2 py-0.5 rounded">
                    {totalTreesCount} arbre(s)
                  </span>
                  {showYields && totalYieldEstimate > 0 && (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 font-medium px-2 py-0.5 rounded">
                      ~{totalYieldEstimate} kg prévus
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Legend & Instructions (shown on prints) */}
            {showLegend && (
              <div className="mb-5 p-2.5 bg-stone-50 rounded-lg border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-bold text-stone-700 uppercase tracking-wider text-[10px]">Légende :</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block shadow-2xs border border-emerald-600"></span>
                    <span className="font-medium text-stone-800">Arbre planté au verger</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-amber-400 inline-block shadow-2xs border border-amber-500"></span>
                    <span className="font-medium text-stone-800">Projet / Variété planifiée</span>
                  </div>
                  <div className="flex items-center gap-1 text-stone-500">
                    <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-stone-200">1</span>
                    <span>= 1ère quinzaine (1 au 15)</span>
                  </div>
                  <div className="flex items-center gap-1 text-stone-500">
                    <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-stone-200">2</span>
                    <span>= 2ème quinzaine (16 au 31)</span>
                  </div>
                </div>

                <div className="text-[11px] text-stone-400 italic">
                  Calendrier de maturité et cueillette
                </div>
              </div>
            )}

            {/* Content: Mode 1 - Matrix Timeline (24 Quinzaines across 12 Months) */}
            {(layoutMode === 'matrix' || layoutMode === 'complete') && (
              <div className="space-y-6 mb-8">
                {layoutMode === 'complete' && (
                  <h2 className="text-base font-serif font-bold text-stone-900 border-b border-stone-300 pb-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-700" />
                    <span>Matrice Annuelle des Récoltes par Quinzaine</span>
                  </h2>
                )}

                {groupBySpecies ? (
                  // Grouped by species
                  varietiesBySpecies.map(([speciesName, vars]) => (
                    <div key={speciesName} className="page-break-inside-avoid space-y-2">
                      <div className="flex items-center justify-between bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-stone-900 text-sm">{speciesName}</span>
                          <span className="text-xs text-stone-500">({vars.length} variété{vars.length > 1 ? 's' : ''})</span>
                        </div>
                        <div className="text-xs text-stone-500 font-medium">
                          {vars.reduce((sum, v) => sum + v.totalTrees, 0)} arbre(s)
                          {showYields && ` • ~${vars.reduce((sum, v) => sum + (v.expectedYield || 0), 0)} kg`}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs border border-stone-200">
                          <thead>
                            <tr className="bg-stone-50 text-stone-700 uppercase tracking-wider text-[10px] font-bold border-b border-stone-300">
                              <th className="py-2 px-2.5 w-56 border-r border-stone-200">Variété</th>
                              {showPeriodSummary && <th className="py-2 px-2 w-32 border-r border-stone-200">Période</th>}
                              {showYields && <th className="py-2 px-2 w-16 text-center border-r border-stone-200">Rend.</th>}
                              {MONTH_ABBR.map((m, idx) => (
                                <th key={idx} className="py-1 px-0.5 text-center border-r border-stone-200 last:border-r-0">
                                  <div className="font-bold text-stone-800">{m}</div>
                                  <div className="flex text-[8px] font-mono text-stone-400 border-t border-stone-200 mt-0.5">
                                    <span className="flex-1">1</span>
                                    <span className="flex-1">2</span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {vars.map((v, vIdx) => {
                              const isPlanned = v.plantedCount === 0;
                              return (
                                <tr key={v.key} className={`border-b border-stone-200 ${vIdx % 2 === 1 ? 'bg-stone-50/50' : 'bg-white'}`}>
                                  {/* Variety info */}
                                  <td className="py-2 px-2.5 border-r border-stone-200">
                                    <div className="flex items-center gap-1.5">
                                      <div className={`w-2 h-2 rounded-full shrink-0 ${isPlanned ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                                      <span className="font-semibold text-stone-900">{v.variety}</span>
                                    </div>
                                    <div className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1">
                                      <span>{v.plantedCount} planté(s)</span>
                                      {v.plannedCount > 0 && <span>• {v.plannedCount} projet(s)</span>}
                                    </div>
                                  </td>

                                  {/* Period text summary */}
                                  {showPeriodSummary && (
                                    <td className="py-2 px-2 border-r border-stone-200 text-[11px] text-stone-600 font-medium">
                                      {formatHarvestPeriodSummary(v.harvestMonths)}
                                    </td>
                                  )}

                                  {/* Expected Yield */}
                                  {showYields && (
                                    <td className="py-2 px-2 border-r border-stone-200 text-center font-medium text-stone-700 text-[11px]">
                                      {v.expectedYield ? `${v.expectedYield} kg` : '—'}
                                    </td>
                                  )}

                                  {/* 12 Months & 24 Quinzaines cells */}
                                  {MONTH_NAMES.map((_, mIdx) => {
                                    const mNum = mIdx + 1;
                                    const q1 = mNum;
                                    const q2 = mNum + 0.5;
                                    const hasQ1 = (v.harvestMonths || []).some(m => Math.abs(m - q1) < 0.01);
                                    const hasQ2 = (v.harvestMonths || []).some(m => Math.abs(m - q2) < 0.01);

                                    return (
                                      <td key={mIdx} className="p-0 border-r border-stone-200 last:border-r-0 h-7 align-middle">
                                        <div className="flex h-full w-full">
                                          {/* 1ère quinzaine */}
                                          <div 
                                            className={`flex-1 h-full flex items-center justify-center border-r border-stone-200/50 text-[9px] font-bold ${
                                              hasQ1 
                                                ? isPlanned 
                                                  ? 'bg-amber-400 text-amber-950' 
                                                  : 'bg-emerald-500 text-white' 
                                                : ''
                                            }`}
                                          >
                                            {hasQ1 ? '1' : ''}
                                          </div>
                                          {/* 2ème quinzaine */}
                                          <div 
                                            className={`flex-1 h-full flex items-center justify-center text-[9px] font-bold ${
                                              hasQ2 
                                                ? isPlanned 
                                                  ? 'bg-amber-400 text-amber-950' 
                                                  : 'bg-emerald-500 text-white' 
                                                : ''
                                            }`}
                                          >
                                            {hasQ2 ? '2' : ''}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                ) : (
                  // Unified flat list
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs border border-stone-200">
                      <thead>
                        <tr className="bg-stone-50 text-stone-700 uppercase tracking-wider text-[10px] font-bold border-b border-stone-300">
                          <th className="py-2.5 px-3 w-60 border-r border-stone-200">Espèce & Variété</th>
                          {showPeriodSummary && <th className="py-2.5 px-2.5 w-36 border-r border-stone-200">Période</th>}
                          {showYields && <th className="py-2.5 px-2 w-16 text-center border-r border-stone-200">Rend.</th>}
                          {MONTH_ABBR.map((m, idx) => (
                            <th key={idx} className="py-1.5 px-0.5 text-center border-r border-stone-200 last:border-r-0">
                              <div className="font-bold text-stone-800">{m}</div>
                              <div className="flex text-[8px] font-mono text-stone-400 border-t border-stone-200 mt-0.5">
                                <span className="flex-1">1</span>
                                <span className="flex-1">2</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {targetVarieties.map((v, vIdx) => {
                          const isPlanned = v.plantedCount === 0;
                          return (
                            <tr key={v.key} className={`border-b border-stone-200 ${vIdx % 2 === 1 ? 'bg-stone-50/50' : 'bg-white'}`}>
                              <td className="py-2 px-3 border-r border-stone-200">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${isPlanned ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                                  <span className="font-bold text-stone-900">{v.species}</span>
                                  {v.variety && <span className="text-stone-600 font-normal">({v.variety})</span>}
                                </div>
                                <div className="text-[10px] text-stone-500 mt-0.5">
                                  {v.totalTrees} arbre(s) {isPlanned ? '• Projet' : '• Planté'}
                                </div>
                              </td>

                              {showPeriodSummary && (
                                <td className="py-2 px-2.5 border-r border-stone-200 text-[11px] text-stone-600 font-medium">
                                  {formatHarvestPeriodSummary(v.harvestMonths)}
                                </td>
                              )}

                              {showYields && (
                                <td className="py-2 px-2 border-r border-stone-200 text-center font-medium text-stone-700 text-[11px]">
                                  {v.expectedYield ? `${v.expectedYield} kg` : '—'}
                                </td>
                              )}

                              {MONTH_NAMES.map((_, mIdx) => {
                                const mNum = mIdx + 1;
                                const q1 = mNum;
                                const q2 = mNum + 0.5;
                                const hasQ1 = (v.harvestMonths || []).some(m => Math.abs(m - q1) < 0.01);
                                const hasQ2 = (v.harvestMonths || []).some(m => Math.abs(m - q2) < 0.01);

                                return (
                                  <td key={mIdx} className="p-0 border-r border-stone-200 last:border-r-0 h-7 align-middle">
                                    <div className="flex h-full w-full">
                                      <div 
                                        className={`flex-1 h-full flex items-center justify-center border-r border-stone-200/50 text-[9px] font-bold ${
                                          hasQ1 
                                            ? isPlanned 
                                              ? 'bg-amber-400 text-amber-950' 
                                              : 'bg-emerald-500 text-white' 
                                            : ''
                                        }`}
                                      >
                                        {hasQ1 ? '1' : ''}
                                      </div>
                                      <div 
                                        className={`flex-1 h-full flex items-center justify-center text-[9px] font-bold ${
                                          hasQ2 
                                            ? isPlanned 
                                              ? 'bg-amber-400 text-amber-950' 
                                              : 'bg-emerald-500 text-white' 
                                            : ''
                                        }`}
                                      >
                                        {hasQ2 ? '2' : ''}
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Content: Mode 2 - Monthly Breakdown (Mois par Mois) */}
            {(layoutMode === 'monthly' || layoutMode === 'complete') && (
              <div className="space-y-4 mb-8">
                {layoutMode === 'complete' && <div className="page-break-after" />}
                
                <div className="border-b border-stone-300 pb-2 flex items-center justify-between">
                  <h2 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
                    <Table className="w-4 h-4 text-emerald-700" />
                    <span>Récapitulatif Mensuel des Récoltes au Verger</span>
                  </h2>
                  <span className="text-xs text-stone-500 italic">Fruits prêts à récolter mois par mois</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {monthlyRipening.map(m => {
                    const hasHarvests = m.items.length > 0;
                    return (
                      <div 
                        key={m.monthIndex} 
                        className={`rounded-xl border p-3.5 page-break-inside-avoid flex flex-col justify-between ${
                          hasHarvests 
                            ? 'bg-white border-emerald-300 shadow-2xs' 
                            : 'bg-stone-50/70 border-stone-200 opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200">
                            <span className="font-serif font-bold text-stone-900 text-sm">
                              {m.monthName}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              hasHarvests ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200/60 text-stone-500'
                            }`}>
                              {m.items.length} fruit{m.items.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          {hasHarvests ? (
                            <ul className="space-y-2">
                              {m.items.map((item, iIdx) => (
                                <li key={iIdx} className="text-xs flex items-start justify-between gap-2 border-b border-stone-100 last:border-0 pb-1.5 last:pb-0">
                                  <div>
                                    <div className="font-semibold text-stone-800 flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${item.variety.plantedCount > 0 ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                      <span>{item.variety.species}</span>
                                      {item.variety.variety && (
                                        <span className="font-normal text-stone-600">({item.variety.variety})</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-stone-500 mt-0.5">
                                      {item.timing} • {item.variety.totalTrees} arbre(s)
                                    </div>
                                  </div>
                                  {showYields && item.variety.expectedYield > 0 && (
                                    <span className="text-[10px] font-medium text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">
                                      {item.variety.expectedYield} kg
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-stone-400 italic py-2">
                              Aucune récolte prévue ce mois-ci
                            </p>
                          )}
                        </div>

                        {hasHarvests && (
                          <div className="mt-3 pt-2 border-t border-stone-100 text-[10px] text-stone-500 flex justify-between">
                            <span>Total fruits du mois :</span>
                            <span className="font-bold text-emerald-800">
                              ~{m.items.reduce((s, it) => s + (it.variety.expectedYield || 0), 0)} kg
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content: Mode 3 - Checklist & Field Harvest Logs (Fiche de Cueillette sur le Terrain) */}
            {layoutMode === 'checklist' && (
              <div className="space-y-4 mb-8">
                <div className="border-b border-stone-300 pb-2 flex items-center justify-between">
                  <h2 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-700" />
                    <span>Fiche de Cueillette et Relevé Réel au Verger</span>
                  </h2>
                  <span className="text-xs text-stone-500 italic">À emporter lors des récoltes pour noter les cueillettes</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs border border-stone-200">
                    <thead>
                      <tr className="bg-stone-100 text-stone-700 uppercase tracking-wider text-[10px] font-bold border-b border-stone-300">
                        <th className="py-2.5 px-3 border-r border-stone-200">Espèce & Variété</th>
                        <th className="py-2.5 px-2.5 w-24 border-r border-stone-200">Statut</th>
                        <th className="py-2.5 px-2.5 w-40 border-r border-stone-200">Période Prévue</th>
                        <th className="py-2.5 px-2 w-20 text-center border-r border-stone-200">Prévu (kg)</th>
                        <th className="py-2.5 px-2 w-24 text-center border-r border-stone-200">Date Récolte</th>
                        <th className="py-2.5 px-2 w-20 text-center border-r border-stone-200">Poids Réel</th>
                        <th className="py-2.5 px-3">Remarques / Calibre / Goût</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetVarieties.map((v, vIdx) => {
                        const isPlanned = v.plantedCount === 0;
                        return (
                          <tr key={v.key} className={`border-b border-stone-200 page-break-inside-avoid ${vIdx % 2 === 1 ? 'bg-stone-50/50' : 'bg-white'}`}>
                            <td className="py-2.5 px-3 border-r border-stone-200">
                              <div className="font-bold text-stone-900">{v.species}</div>
                              <div className="text-stone-600">{v.variety}</div>
                              <div className="text-[10px] text-stone-400 mt-0.5">{v.totalTrees} arbre(s)</div>
                            </td>
                            <td className="py-2.5 px-2.5 border-r border-stone-200 text-stone-600 font-medium">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isPlanned ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isPlanned ? 'Projet' : 'Planté'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 border-r border-stone-200 text-[11px] text-stone-700">
                              {formatHarvestPeriodSummary(v.harvestMonths)}
                            </td>
                            <td className="py-2.5 px-2 border-r border-stone-200 text-center font-medium text-stone-600">
                              {v.expectedYield ? `${v.expectedYield} kg` : '—'}
                            </td>
                            {/* Empty handwriting cells */}
                            <td className="py-2.5 px-2 border-r border-stone-200 text-center bg-stone-50/30">
                              <div className="h-6 border-b border-stone-300 mx-1"></div>
                            </td>
                            <td className="py-2.5 px-2 border-r border-stone-200 text-center bg-stone-50/30">
                              <div className="h-6 border-b border-stone-300 mx-1"></div>
                            </td>
                            <td className="py-2.5 px-3 bg-stone-50/30">
                              <div className="h-6 border-b border-stone-300"></div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Optional Field Notes Section */}
            {showFieldNotes && (
              <div className="page-break-inside-avoid mt-6 pt-4 border-t-2 border-stone-200">
                <div className="flex items-center gap-2 mb-2 font-serif font-bold text-stone-900 text-sm">
                  <PenLine className="w-4 h-4 text-emerald-700" />
                  <span>Notes & Observations de Cueillette :</span>
                </div>
                <div className="space-y-3">
                  <div className="border-b border-stone-300 h-6"></div>
                  <div className="border-b border-stone-300 h-6"></div>
                  <div className="border-b border-stone-300 h-6"></div>
                </div>
              </div>
            )}

            {/* Printable Document Footer */}
            <div className="mt-8 pt-4 border-t border-stone-200 flex items-center justify-between text-[10px] text-stone-400">
              <div>
                Mon Potager & Verger • Calendrier des Récoltes • Imprimé le {new Date().toLocaleDateString('fr-FR')}
              </div>
              <div>
                Document généré pour consultation papier et carnet d'exploitation
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-500 text-center sm:text-left">
            Astuce : Dans la boîte de dialogue d'impression, choisissez le format <strong>Paysage</strong> et activez <strong>« Graphiques d'arrière-plan »</strong> pour imprimer les couleurs du calendrier.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium rounded-xl transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Lancer l'impression</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
