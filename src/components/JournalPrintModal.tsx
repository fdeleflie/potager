import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Printer, BookOpen, Table, CheckSquare, Layers, 
  Filter, CheckCircle2, XCircle, Calendar, Camera, 
  PenLine, Sparkles, AlertTriangle, ArrowUpDown
} from 'lucide-react';
import { CombinedEntry, JOURNAL_MONTHS, JOURNAL_QUARTERS } from '../views/Journal';
import { printElement } from '../utils/print';
import { Season } from '../db';

export type JournalPrintLayout = 'chronicle' | 'table' | 'experience_review' | 'by_plant' | 'calendar';
export type JournalPrintScope = 'filtered' | 'all' | 'season' | 'success_only' | 'failure_only';

export interface JournalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: CombinedEntry[];
  filteredEntries: CombinedEntry[];
  seasons: Season[];
  currentSeasonId?: string;
  activeFilterSeason?: string;
  activeSearchTerm?: string;
  activeFilterYear?: string;
  activeFilterQuarter?: string;
  activeFilterMonth?: string;
}

export function JournalPrintModal({
  isOpen,
  onClose,
  entries,
  filteredEntries,
  seasons,
  currentSeasonId,
  activeFilterSeason = 'all',
  activeSearchTerm = '',
  activeFilterYear = 'all',
  activeFilterQuarter = 'all',
  activeFilterMonth = 'all'
}: JournalPrintModalProps) {
  const currentYear = new Date().getFullYear();

  // Print controls
  const [layoutMode, setLayoutMode] = useState<JournalPrintLayout>('chronicle');
  const [printScope, setPrintScope] = useState<JournalPrintScope>('filtered');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    activeFilterSeason !== 'all' ? activeFilterSeason : (currentSeasonId || (seasons[0]?.id || 'all'))
  );
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [scale, setScale] = useState<number>(90);

  // Date filters for print
  const [printYear, setPrintYear] = useState<string>(activeFilterYear || 'all');
  const [printQuarter, setPrintQuarter] = useState<string>(activeFilterQuarter || 'all');
  const [printMonth, setPrintMonth] = useState<string>(activeFilterMonth || 'all');

  useEffect(() => {
    if (isOpen) {
      setPrintYear(activeFilterYear || 'all');
      setPrintQuarter(activeFilterQuarter || 'all');
      setPrintMonth(activeFilterMonth || 'all');
    }
  }, [isOpen, activeFilterYear, activeFilterQuarter, activeFilterMonth]);

  // Customization options
  const [docTitle, setDocTitle] = useState<string>('Journal de Bord du Potager');
  const [docSubtitle, setDocSubtitle] = useState<string>(`Observations, bilans et chroniques de culture • ${currentYear}`);
  const [includePhotos, setIncludePhotos] = useState<boolean>(true);
  const [showStatusBadges, setShowStatusBadges] = useState<boolean>(true);
  const [showFieldNotes, setShowFieldNotes] = useState<boolean>(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    const currentY = new Date().getFullYear().toString();
    yearSet.add(currentY);
    (entries || []).forEach(e => {
      const d = new Date(e.date);
      if (!isNaN(d.getTime())) {
        yearSet.add(d.getFullYear().toString());
      }
    });
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const dateFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (printYear !== 'all') parts.push(`Année ${printYear}`);
    if (printQuarter !== 'all') {
      const q = JOURNAL_QUARTERS.find(x => x.value === printQuarter);
      parts.push(q ? q.shortLabel : printQuarter);
    }
    if (printMonth !== 'all') {
      const m = JOURNAL_MONTHS.find(x => x.value === printMonth);
      parts.push(m ? m.label : `Mois ${printMonth}`);
    }
    return parts.length > 0 ? parts.join(' • ') : null;
  }, [printYear, printQuarter, printMonth]);

  // Compute targeted entries according to chosen scope and temporal filters
  const targetEntries = useMemo(() => {
    let list: CombinedEntry[] = [];

    if (printScope === 'filtered') {
      list = [...filteredEntries];
    } else if (printScope === 'all') {
      list = [...entries];
    } else if (printScope === 'season') {
      if (selectedSeasonId === 'all') {
        list = [...entries];
      } else {
        list = entries.filter(e => e.seasonId === selectedSeasonId);
      }
    } else if (printScope === 'success_only') {
      list = entries.filter(e => e.success === true);
    } else if (printScope === 'failure_only') {
      list = entries.filter(e => e.success === false);
    } else {
      list = [...entries];
    }

    // Apply Year / Quarter / Month refinement if not in filtered mode
    if (printScope !== 'filtered') {
      if (printYear !== 'all') {
        list = list.filter(e => {
          const d = new Date(e.date);
          return !isNaN(d.getTime()) && d.getFullYear().toString() === printYear;
        });
      }

      if (printQuarter !== 'all') {
        list = list.filter(e => {
          const d = new Date(e.date);
          if (isNaN(d.getTime())) return false;
          const m = d.getMonth() + 1;
          const q = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
          return q === printQuarter;
        });
      }

      if (printMonth !== 'all') {
        list = list.filter(e => {
          const d = new Date(e.date);
          if (isNaN(d.getTime())) return false;
          const m = d.getMonth() + 1;
          return m.toString() === printMonth;
        });
      }
    }

    return list.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [printScope, filteredEntries, entries, selectedSeasonId, sortOrder, printYear, printQuarter, printMonth]);

  // Derived metrics
  const successCount = useMemo(() => targetEntries.filter(e => e.success === true).length, [targetEntries]);
  const failureCount = useMemo(() => targetEntries.filter(e => e.success === false).length, [targetEntries]);
  const neutralCount = useMemo(() => targetEntries.filter(e => e.success === undefined).length, [targetEntries]);
  const photoCount = useMemo(() => targetEntries.reduce((sum, e) => sum + (e.photos?.length || 0), 0), [targetEntries]);

  // Entries grouped by plant / source for "by_plant" layout
  const entriesByPlant = useMemo(() => {
    const map = new Map<string, CombinedEntry[]>();
    targetEntries.forEach(e => {
      const key = e.sourceName || (e.type === 'journal' ? 'Observations générales' : 'Autres notes');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [targetEntries]);

  // Entries split for "experience_review" (Successes vs Failures)
  const experienceSuccesses = useMemo(() => targetEntries.filter(e => e.success === true), [targetEntries]);
  const experienceFailures = useMemo(() => targetEntries.filter(e => e.success === false), [targetEntries]);
  const experienceObservations = useMemo(() => targetEntries.filter(e => e.success === undefined), [targetEntries]);

  if (!isOpen) return null;

  const handlePrint = () => {
    printElement('journal-printable-area', docTitle, {
      orientation,
      scale,
      hideHeader: true,
      extraStyles: `
        @media print {
          body {
            background-color: white !important;
            padding: 8mm;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
        }
      `
    });
  };

  const getSeasonName = (seasonId?: string) => {
    if (!seasonId) return null;
    const s = seasons.find(x => x.id === seasonId);
    return s ? s.name : null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-medium text-stone-900">
                  Module d'Impression du Journal de Bord
                </h3>
                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  Édition Papier & PDF
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Mise en page de vos chroniques, retours d'expérience et observations de culture pour carnet ou archivage.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-100 transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Configuration Bar */}
        <div className="p-4 bg-stone-50/90 border-b border-stone-200/80 shrink-0 space-y-3">
          
          {/* Row 1: Layout Mode & Scope */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Layout selector */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 shadow-2xs">
              <button
                type="button"
                onClick={() => { setLayoutMode('chronicle'); setOrientation('portrait'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'chronicle' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Chronique de bord</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('table'); setOrientation('landscape'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'table' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Registre compact (Tableau)</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('experience_review'); setOrientation('portrait'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'experience_review' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Bilan Réussites & Échecs</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('by_plant'); setOrientation('portrait'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'by_plant' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Par Plante / Culture</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('calendar'); setOrientation('landscape'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'calendar' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Calendrier</span>
              </button>
            </div>

            {/* Scope selector */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 text-xs shadow-2xs">
              <span className="text-stone-400 pl-2 pr-1 font-medium flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Périmètre :
              </span>
              <button
                type="button"
                onClick={() => setPrintScope('filtered')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printScope === 'filtered' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Filtre en cours ({filteredEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setPrintScope('all')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printScope === 'all' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Tout le journal ({entries.length})
              </button>
              <button
                type="button"
                onClick={() => setPrintScope('success_only')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printScope === 'success_only' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                ✅ Réussites ({entries.filter(e => e.success === true).length})
              </button>
              <button
                type="button"
                onClick={() => setPrintScope('failure_only')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  printScope === 'failure_only' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                ⚠️ Échecs ({entries.filter(e => e.success === false).length})
              </button>
            </div>

            {/* Date filter: Année, Trimestre, Mois, Tout */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 text-xs shadow-2xs">
              <span className="text-stone-400 pl-2 pr-1 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Période :
              </span>
              <button
                type="button"
                onClick={() => {
                  setPrintYear('all');
                  setPrintQuarter('all');
                  setPrintMonth('all');
                }}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer font-medium ${
                  printYear === 'all' && printQuarter === 'all' && printMonth === 'all'
                    ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
                title="Toutes les dates sans restriction"
              >
                Tout
              </button>

              <select
                value={printYear}
                onChange={e => setPrintYear(e.target.value)}
                className={`px-2 py-1 rounded-md border text-xs outline-none cursor-pointer ${
                  printYear !== 'all' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}
                title="Filtrer par année"
              >
                <option value="all">Toutes les années</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>Année {yr}</option>
                ))}
              </select>

              <select
                value={printQuarter}
                onChange={e => {
                  const q = e.target.value;
                  setPrintQuarter(q);
                  if (q !== 'all' && printMonth !== 'all') {
                    const qObj = JOURNAL_QUARTERS.find(x => x.value === q);
                    if (qObj && !qObj.months.includes(Number(printMonth))) {
                      setPrintMonth('all');
                    }
                  }
                }}
                className={`px-2 py-1 rounded-md border text-xs outline-none cursor-pointer ${
                  printQuarter !== 'all' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}
                title="Filtrer par trimestre"
              >
                <option value="all">Tous trimestres</option>
                {JOURNAL_QUARTERS.map(q => (
                  <option key={q.value} value={q.value}>{q.shortLabel}</option>
                ))}
              </select>

              <select
                value={printMonth}
                onChange={e => {
                  const m = e.target.value;
                  setPrintMonth(m);
                  if (m !== 'all') {
                    const monthNum = Number(m);
                    const q = monthNum <= 3 ? 'Q1' : monthNum <= 6 ? 'Q2' : monthNum <= 9 ? 'Q3' : 'Q4';
                    setPrintQuarter(q);
                  }
                }}
                className={`px-2 py-1 rounded-md border text-xs outline-none cursor-pointer ${
                  printMonth !== 'all' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}
                title="Filtrer par mois"
              >
                <option value="all">Tous mois</option>
                {JOURNAL_MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Print Settings & Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 pt-2 border-t border-stone-200/70">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Orientation */}
              <div className="flex items-center gap-2">
                <span className="text-stone-400 font-medium">Format :</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="journal_orientation"
                    checked={orientation === 'portrait'}
                    onChange={() => setOrientation('portrait')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Portrait (A4)</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="journal_orientation"
                    checked={orientation === 'landscape'}
                    onChange={() => setOrientation('landscape')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Paysage (A4)</span>
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

              {/* Photos Toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePhotos}
                  onChange={(e) => setIncludePhotos(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-stone-500" />
                  Inclure les photos
                </span>
              </label>

              {/* Status Badges */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showStatusBadges}
                  onChange={(e) => setShowStatusBadges(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Badges de réussite/échec</span>
              </label>

              {/* Field Notes Area */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showFieldNotes}
                  onChange={(e) => setShowFieldNotes(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Zone de notes manuscrites</span>
              </label>

              {/* Sort Order */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3 h-3 text-stone-400" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                  className="px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs outline-none"
                >
                  <option value="desc">Plus récent en premier</option>
                  <option value="asc">Ordre chronologique ancien</option>
                </select>
              </div>
            </div>

            <div className="text-stone-500 font-medium text-[11px] bg-stone-100 px-2.5 py-1 rounded-lg">
              {targetEntries.length} note(s) • {successCount} succès • {failureCount} échec(s)
            </div>
          </div>

          {/* Row 3: Document Title & Subtitle */}
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

        {/* Printable Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-100/70 custom-scrollbar">
          
          <div
            id="journal-printable-area"
            className="bg-white p-6 sm:p-8 rounded-xl shadow-md border border-stone-200 mx-auto max-w-full text-stone-900"
            style={{ minHeight: '650px' }}
          >
            {/* Printable Document Header */}
            <div className="border-b-2 border-emerald-700 pb-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-serif font-bold text-2xl shadow-xs">
                  📖
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
                <div className="flex flex-wrap items-center gap-1.5 mt-1 justify-end">
                  {dateFilterSummary && (
                    <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold px-2 py-0.5 rounded text-[10px]">
                      📅 {dateFilterSummary}
                    </span>
                  )}
                  <span className="bg-stone-100 text-stone-700 font-medium px-2 py-0.5 rounded text-[10px]">
                    {targetEntries.length} observation(s)
                  </span>
                  {successCount > 0 && (
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium px-2 py-0.5 rounded text-[10px]">
                      {successCount} réussite(s)
                    </span>
                  )}
                  {failureCount > 0 && (
                    <span className="bg-rose-50 text-rose-800 border border-rose-200 font-medium px-2 py-0.5 rounded text-[10px]">
                      {failureCount} échec(s)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Layout 1: Chronicle / Timeline Cards */}
            {layoutMode === 'chronicle' && (
              <div className="space-y-4">
                {targetEntries.length === 0 ? (
                  <div className="p-8 text-center text-stone-400 italic">
                    Aucune entrée du journal ne correspond aux critères sélectionnés.
                  </div>
                ) : (
                  targetEntries.map((entry, index) => {
                    const entryDate = new Date(entry.date);
                    const formattedDate = entryDate.toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                    const seasonName = getSeasonName(entry.seasonId);

                    return (
                      <div
                        key={entry.id || index}
                        className="page-break-inside-avoid border border-stone-200 rounded-xl p-4 bg-white shadow-2xs space-y-2.5"
                      >
                        {/* Entry Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-bold text-stone-900 text-sm capitalize">
                              {formattedDate}
                            </span>
                            {seasonName && (
                              <span className="text-[10px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded font-medium">
                                {seasonName}
                              </span>
                            )}
                            {entry.sourceName && (
                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                🌱 {entry.sourceName}
                              </span>
                            )}
                          </div>

                          {showStatusBadges && entry.success !== undefined && (
                            <div>
                              {entry.success ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                  Réussite
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                                  <XCircle className="w-3 h-3 text-rose-700" />
                                  Échec
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Title if present */}
                        {entry.title && (
                          <h4 className="text-xs font-bold text-stone-900 pt-1">
                            {entry.title}
                          </h4>
                        )}

                        {/* Tags if present */}
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {entry.tags.map(tag => (
                              <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Content text */}
                        <p className="text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">
                          {entry.content}
                        </p>

                        {/* Failure reason if any */}
                        {entry.failureReason && (
                          <div className="text-[11px] text-rose-900 bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Cause identifiée de l'échec :</span> {entry.failureReason}
                            </div>
                          </div>
                        )}

                        {/* Photos preview */}
                        {includePhotos && entry.photos && entry.photos.length > 0 && (
                          <div className="flex gap-2 flex-wrap pt-1">
                            {entry.photos.map((ph, pIdx) => (
                              <div
                                key={pIdx}
                                className="w-20 h-20 rounded-lg overflow-hidden border border-stone-200 bg-stone-50 shrink-0"
                              >
                                <img
                                  src={ph}
                                  alt="Photo de suivi"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Layout 2: Compact Dense Table */}
            {layoutMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs border border-stone-200">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 uppercase tracking-wider text-[10px] font-bold border-b border-stone-300">
                      <th className="py-2 px-2.5 w-28 border-r border-stone-200">Date</th>
                      <th className="py-2 px-2.5 w-48 border-r border-stone-200">Source / Plante</th>
                      <th className="py-2 px-2.5 w-28 border-r border-stone-200">Statut</th>
                      <th className="py-2 px-3 border-r border-stone-200">Observation / Note de bord</th>
                      {includePhotos && <th className="py-2 px-2 w-20 text-center">Photos</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {targetEntries.map((entry, idx) => (
                      <tr
                        key={entry.id || idx}
                        className={`border-b border-stone-200 page-break-inside-avoid ${idx % 2 === 1 ? 'bg-stone-50/50' : 'bg-white'}`}
                      >
                        <td className="py-2 px-2.5 border-r border-stone-200 font-medium text-stone-900 whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="py-2 px-2.5 border-r border-stone-200">
                          {entry.sourceName ? (
                            <span className="font-semibold text-emerald-900">{entry.sourceName}</span>
                          ) : (
                            <span className="text-stone-500 italic">Note générale</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 border-r border-stone-200">
                          {entry.success === true ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Réussite
                            </span>
                          ) : entry.success === false ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                              Échec
                            </span>
                          ) : (
                            <span className="text-stone-400 text-[10px]">Neutre</span>
                          )}
                        </td>
                        <td className="py-2 px-3 border-r border-stone-200 text-stone-800 whitespace-pre-wrap">
                          {entry.title && (
                            <div className="font-bold text-stone-900 text-xs mb-0.5">{entry.title}</div>
                          )}
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mb-1">
                              {entry.tags.map(tag => (
                                <span key={tag} className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div>{entry.content}</div>
                          {entry.failureReason && (
                            <div className="mt-1 text-[10px] text-rose-700 font-medium">
                              Cause : {entry.failureReason}
                            </div>
                          )}
                        </td>
                        {includePhotos && (
                          <td className="py-2 px-2 text-center align-middle">
                            {entry.photos && entry.photos.length > 0 ? (
                              <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
                                📷 {entry.photos.length}
                              </span>
                            ) : (
                              <span className="text-stone-300 text-[10px]">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Layout 3: Experience Review (Réussites & Échecs) */}
            {layoutMode === 'experience_review' && (
              <div className="space-y-6">
                {/* Section 1: Successes */}
                <div className="page-break-inside-avoid space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-600">
                    <h2 className="font-serif font-bold text-emerald-900 text-base flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Répertoire des Réussites & Bonnes Pratiques ({experienceSuccesses.length})</span>
                    </h2>
                    <span className="text-xs text-stone-500 italic">Variétés vigoureuses et techniques gagnantes</span>
                  </div>

                  {experienceSuccesses.length === 0 ? (
                    <p className="text-xs text-stone-400 italic py-2">Aucune note de réussite enregistrée.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {experienceSuccesses.map((e, idx) => (
                        <div
                          key={e.id || idx}
                          className="page-break-inside-avoid p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-bold text-emerald-900">
                            <span>{e.sourceName || 'Observation'}</span>
                            <span className="text-[10px] font-normal text-stone-500">
                              {new Date(e.date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <p className="text-stone-700 whitespace-pre-wrap">{e.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Failures & Lessons */}
                <div className="page-break-inside-avoid space-y-3 pt-4">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-rose-500">
                    <h2 className="font-serif font-bold text-rose-900 text-base flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>Retours d'Échecs & Enseignements ({experienceFailures.length})</span>
                    </h2>
                    <span className="text-xs text-stone-500 italic">Problèmes rencontrés, maladies et aléas à corriger</span>
                  </div>

                  {experienceFailures.length === 0 ? (
                    <p className="text-xs text-stone-400 italic py-2">Aucun échec enregistré.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {experienceFailures.map((e, idx) => (
                        <div
                          key={e.id || idx}
                          className="page-break-inside-avoid p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-bold text-rose-900">
                            <span>{e.sourceName || 'Observation'}</span>
                            <span className="text-[10px] font-normal text-stone-500">
                              {new Date(e.date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <p className="text-stone-700 whitespace-pre-wrap">{e.content}</p>
                          {e.failureReason && (
                            <div className="text-[11px] text-rose-800 bg-rose-100/70 p-1.5 rounded font-medium">
                              Cause : {e.failureReason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 3: Other observations */}
                {experienceObservations.length > 0 && (
                  <div className="page-break-inside-avoid space-y-3 pt-4">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                      <h2 className="font-serif font-bold text-stone-800 text-base flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-stone-600" />
                        <span>Autres observations générales ({experienceObservations.length})</span>
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {experienceObservations.map((e, idx) => (
                        <div
                          key={e.id || idx}
                          className="page-break-inside-avoid p-3 rounded-xl border border-stone-200 bg-stone-50 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-semibold text-stone-800">
                            <span>{e.sourceName || 'Note générale'}</span>
                            <span className="text-[10px] text-stone-500 font-normal">
                              {new Date(e.date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <p className="text-stone-600 whitespace-pre-wrap">{e.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Layout 4: Grouped by Plant / Crop */}
            {layoutMode === 'by_plant' && (
              <div className="space-y-6">
                {entriesByPlant.map(([plantName, plantEntries]) => (
                  <div key={plantName} className="page-break-inside-avoid space-y-2 border border-stone-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200 bg-stone-50/60 -mx-4 -mt-4 px-4 pt-3 rounded-t-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-stone-900 text-sm">
                          🌱 {plantName}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          ({plantEntries.length} note{plantEntries.length > 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {plantEntries.filter(p => p.success === true).length > 0 && (
                          <span className="text-emerald-700 font-semibold mr-2">
                            ✓ {plantEntries.filter(p => p.success === true).length} succès
                          </span>
                        )}
                        {plantEntries.filter(p => p.success === false).length > 0 && (
                          <span className="text-rose-700 font-semibold">
                            ✗ {plantEntries.filter(p => p.success === false).length} échec
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {plantEntries.map((pe, pIdx) => (
                        <div key={pe.id || pIdx} className="text-xs border-b border-stone-100 last:border-0 pb-2.5 last:pb-0 space-y-1">
                          <div className="flex items-center justify-between text-stone-500 text-[10px]">
                            <span className="font-semibold text-stone-700">
                              {new Date(pe.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                            {pe.success === true && (
                              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                                Réussite
                              </span>
                            )}
                            {pe.success === false && (
                              <span className="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded">
                                Échec
                              </span>
                            )}
                          </div>
                          <p className="text-stone-800 whitespace-pre-wrap">{pe.content}</p>
                          {pe.failureReason && (
                            <div className="text-[10px] text-rose-800 bg-rose-50 p-1.5 rounded">
                              Cause d'échec : {pe.failureReason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Layout 4: Calendar Grid */}
            {layoutMode === 'calendar' && (
              <div className="space-y-8">
                {Array.from(new Set(targetEntries.map(e => {
                  const d = new Date(e.date);
                  return !isNaN(d.getTime()) ? `${d.getFullYear()}-${d.getMonth()}` : null;
                }).filter(Boolean))).sort().map(monthKey => {
                  if (!monthKey) return null;
                  const [yearStr, monthStr] = monthKey.split('-');
                  const year = parseInt(yearStr, 10);
                  const month = parseInt(monthStr, 10);
                  
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const firstDayOfMonth = new Date(year, month, 1).getDay();
                  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                  
                  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                  const blanks = Array.from({ length: startOffset }, (_, i) => i);
                  
                  const monthName = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                  const formattedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                  
                  return (
                    <div key={monthKey} className="page-break-inside-avoid border border-stone-200 rounded-lg overflow-hidden mb-6">
                      <div className="bg-stone-100 px-4 py-2 border-b border-stone-200">
                        <h3 className="font-bold text-stone-800 text-sm uppercase tracking-wider">{formattedMonthName}</h3>
                      </div>
                      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                          <div key={day} className="py-1.5 text-center text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 bg-stone-200 gap-px">
                        {blanks.map(blank => (
                          <div key={`blank-${blank}`} className="bg-white min-h-[80px]" />
                        ))}
                        {days.map(day => {
                          const dayEntries = targetEntries.filter(e => {
                            const d = new Date(e.date);
                            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
                          });
                          
                          return (
                            <div key={day} className="bg-white min-h-[80px] p-1 flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-stone-400 mb-1">{day}</span>
                              {dayEntries.map((entry, eIdx) => (
                                <div key={entry.id ? `${entry.id}-${eIdx}` : eIdx} className="text-[8px] leading-tight p-0.5 bg-stone-50 border border-stone-100 rounded text-stone-700 truncate">
                                  <span className="font-bold">
                                    {entry.type === 'seedling' ? entry.sourceName : 'Note'}
                                  </span>
                                  {' '}
                                  {entry.success === true ? '✅' : entry.success === false ? '❌' : ''}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                        {Array.from({ length: (7 - ((blanks.length + days.length) % 7)) % 7 }).map((_, i) => (
                          <div key={`end-blank-${i}`} className="bg-white min-h-[80px]" />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {targetEntries.length === 0 && (
                  <div className="text-center py-8 text-stone-500 italic text-sm">
                    Aucune donnée à afficher dans le calendrier pour cette sélection.
                  </div>
                )}
              </div>
            )}

            {/* Optional Field Notes area */}
            {showFieldNotes && (
              <div className="page-break-inside-avoid mt-8 pt-4 border-t-2 border-stone-200">
                <div className="flex items-center gap-2 mb-2 font-serif font-bold text-stone-900 text-sm">
                  <PenLine className="w-4 h-4 text-emerald-700" />
                  <span>Notes manuscrites & Observations futures :</span>
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
                Mon Potager • Journal de bord • Imprimé le {new Date().toLocaleDateString('fr-FR')}
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
            Conseil : Pour enregistrer en PDF, choisissez <strong>« Enregistrer au format PDF »</strong> comme imprimante de destination.
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
