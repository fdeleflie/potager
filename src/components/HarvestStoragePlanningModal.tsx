import React, { useState, useMemo } from 'react';
import { 
  X, Printer, Calendar, Clock, ArrowUpDown, Layers, 
  Search, Filter, Edit2, Check, Sparkles, Leaf, Trees, 
  ChevronDown, RotateCcw, Info, Globe
} from 'lucide-react';
import { printElement } from '../utils/print';
import { fb } from '../hooks/useFirebaseData';
import { 
  HarvestStorageScheduleItem, 
  MONTH_ABBR_FR, 
  MONTH_NAMES_FR,
  sortScheduleByPeriod, 
  sortScheduleByVariety,
  KNOWN_HARVEST_STORAGE_DATA
} from '../utils/harvestStorageData';
import { ICON_MAP, isEmoji } from '../constants';
import { normalizeSpeciesName, normalizeVarietyKey } from '../utils/varietyNormalizer';

export interface HarvestStoragePlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: HarvestStorageScheduleItem[];
  filteredItems: HarvestStorageScheduleItem[];
  activeFilterCategory?: string | string[];
  searchTerm?: string;
}

export function HarvestStoragePlanningModal({
  isOpen,
  onClose,
  allItems,
  filteredItems,
  activeFilterCategory,
  searchTerm: parentSearchTerm
}: HarvestStoragePlanningModalProps) {
  // Navigation & View Controls
  const [sortMode, setSortMode] = useState<'period' | 'variety'>('period');
  const [scope, setScope] = useState<'all' | 'filtered'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'temporary'>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<HarvestStorageScheduleItem | null>(null);
  const [editHarvestMonths, setEditHarvestMonths] = useState<number[]>([]);
  const [editStorageMonths, setEditStorageMonths] = useState<number[]>([]);
  const [editIsTemporary, setEditIsTemporary] = useState(false);
  const [editingIsManual, setEditingIsManual] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Available categories for secondary filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [allItems]);

  const temporaryCount = useMemo(() => {
    return allItems.filter(i => i.isTemporary).length;
  }, [allItems]);

  // Target items based on scope, search, category, and status
  const targetItems = useMemo(() => {
    let base = scope === 'filtered' ? filteredItems : allItems;

    if (statusFilter === 'confirmed') {
      base = base.filter(i => !i.isTemporary);
    } else if (statusFilter === 'temporary') {
      base = base.filter(i => i.isTemporary);
    }

    if (selectedCategory !== 'all') {
      base = base.filter(i => i.category === selectedCategory);
    }

    if (localSearch.trim()) {
      const q = localSearch.toLowerCase().trim();
      base = base.filter(i => 
        i.displayName.toLowerCase().includes(q) ||
        i.species.toLowerCase().includes(q) ||
        i.variety.toLowerCase().includes(q)
      );
    }

    return sortMode === 'period' ? sortScheduleByPeriod(base) : sortScheduleByVariety(base);
  }, [scope, filteredItems, allItems, statusFilter, selectedCategory, localSearch, sortMode]);

  if (!isOpen) return null;

  const handleOpenEdit = (item: HarvestStorageScheduleItem) => {
    setEditingItem(item);
    setEditHarvestMonths([...item.harvestMonths]);
    setEditStorageMonths([...item.storageMonths]);
    setEditIsTemporary(Boolean(item.isTemporary));
    setEditingIsManual(Boolean(item.isManualHarvest));
  };

  const handleToggleMonth = (month: number, type: 'harvest' | 'storage') => {
    setEditingIsManual(true);
    if (type === 'harvest') {
      if (editHarvestMonths.includes(month)) {
        setEditHarvestMonths(editHarvestMonths.filter(m => m !== month));
      } else {
        setEditHarvestMonths([...editHarvestMonths, month].sort((a, b) => a - b));
      }
    } else {
      if (editStorageMonths.includes(month)) {
        setEditStorageMonths(editStorageMonths.filter(m => m !== month));
      } else {
        setEditStorageMonths([...editStorageMonths, month].sort((a, b) => a - b));
      }
    }
  };

  const handleSaveItemPeriods = async () => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      if (editingItem.varietyConfigId) {
        // Update variety attributes in config
        await fb.update('config', editingItem.varietyConfigId, {
          attributes: {
            harvestMonths: editHarvestMonths,
            storageMonths: editStorageMonths,
            isTemporary: editIsTemporary,
            status: editIsTemporary ? 'temporary' : 'confirmed',
            harvestSource: editingIsManual ? 'manual' : 'reference',
            isManualHarvest: editingIsManual
          }
        });
      }
      // Update local item reference
      editingItem.harvestMonths = editHarvestMonths;
      editingItem.storageMonths = editStorageMonths;
      editingItem.isTemporary = editIsTemporary;
      editingItem.status = editIsTemporary ? 'temporary' : 'confirmed';
      editingItem.harvestSource = editingIsManual ? 'manual' : 'reference';
      editingItem.isManualHarvest = editingIsManual;
      setEditingItem(null);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde des périodes:', err);
      alert('Impossible d’enregistrer la modification.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePromoteToCatalog = async (item: HarvestStorageScheduleItem) => {
    if (!item.varietyConfigId) return;
    try {
      await fb.update('config', item.varietyConfigId, {
        attributes: {
          isTemporary: false,
          status: 'confirmed'
        }
      });
      item.isTemporary = false;
      item.status = 'confirmed';
    } catch (err) {
      console.error('Erreur lors de la validation au catalogue:', err);
      alert('Impossible de valider la variété.');
    }
  };

  const handlePrint = () => {
    const title = `Planning Récolte et Conservation - ${sortMode === 'period' ? 'Classé par Période' : 'Classé par Variétés'}`;
    printElement('harvest-storage-schedule-printable', title, {
      orientation: 'landscape',
      scale: 90,
      hideHeader: true,
      extraStyles: `
        @media print {
          @page {
            size: landscape;
            margin: 8mm 6mm;
          }
          body {
            background-color: white !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full-width {
            width: 100% !important;
            max-width: none !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `
    });
  };

  const renderIcon = (item: HarvestStorageScheduleItem) => {
    if (item.icon && isEmoji(item.icon)) {
      return <span className="text-sm leading-none shrink-0">{item.icon}</span>;
    }
    const IconComp = ICON_MAP[item.icon || 'Trees'] || Trees;
    return <IconComp className="w-3.5 h-3.5 shrink-0 text-stone-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-semibold text-stone-900">
                  Planning Récolte & Conservation
                </h2>
                <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-semibold">
                  {targetItems.length} variété{targetItems.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Gantt annuel des fenêtres de cueillette et de stockage du catalogue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Imprimer ou exporter en PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer (PDF)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="p-3 sm:px-5 bg-stone-50/60 border-b border-stone-200 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Sorting / View Mode Selector */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-stone-500">Vue :</span>
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-stone-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setSortMode('period')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  sortMode === 'period' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-red-400" />
                <span>Classé par Période</span>
              </button>
              <button
                type="button"
                onClick={() => setSortMode('variety')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  sortMode === 'variety' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Classé par Variétés</span>
              </button>
            </div>
          </div>

          {/* Scope Selector: Au Global vs Sélection Actuelle */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-stone-500">Périmètre :</span>
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-stone-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                  scope === 'all' ? 'bg-emerald-600 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Au global ({allItems.length})
              </button>
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                  scope === 'filtered' ? 'bg-emerald-600 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
                title="Filtré par la sélection active du catalogue"
              >
                {activeFilterCategory ? `Sélection : ${Array.isArray(activeFilterCategory) ? activeFilterCategory.join(', ') : activeFilterCategory} (${filteredItems.length})` : `Sélection actuelle (${filteredItems.length})`}
              </button>
            </div>
          </div>

          {/* Status Filter: Tous vs Catalogue vs En projet */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-stone-500">Statut :</span>
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-stone-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('confirmed')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                  statusFilter === 'confirmed' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Catalogue ({allItems.filter(i => !i.isTemporary).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('temporary')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  statusFilter === 'temporary' ? 'bg-amber-600 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span>⏳ En projet</span>
                {temporaryCount > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${statusFilter === 'temporary' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800 font-bold'}`}>
                    {temporaryCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Rechercher variété..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-8 pr-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs w-36 sm:w-44 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>

            {categories.length > 1 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 outline-none cursor-pointer"
              >
                <option value="all">Toutes catégories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Scrollable Printable Timeline Container */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-stone-100/40">
          
          <div 
            id="harvest-storage-schedule-printable" 
            className="bg-white rounded-xl border border-stone-200 p-4 sm:p-6 shadow-xs max-w-6xl mx-auto"
          >
            {/* Header & Legend inside document (exactly matching the user images) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-stone-100 gap-3">
              <div>
                <h1 className="text-base sm:text-lg font-serif font-bold text-stone-900 tracking-tight">
                  Calendrier MÀJ {sortMode === 'period' ? '- Classé par Période' : '- Classé par Variétés'}
                </h1>
                <p className="text-xs text-stone-500">
                  {scope === 'all' ? 'Catalogue global' : `Sélection catalogue (${targetItems.length} variétés)`}
                </p>
              </div>

              {/* Legend Box */}
              <div className="flex items-center gap-4 bg-stone-50 p-2 sm:px-3 rounded-lg border border-stone-200 text-xs shrink-0 self-start sm:self-auto">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-3 bg-[#ef4444] rounded-[2px] inline-block shadow-2xs" />
                  <span className="font-medium text-stone-700">Période de Récolte</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-3 bg-[#a5f3fc] border border-[#67e8f9] rounded-[2px] inline-block shadow-2xs" />
                  <span className="font-medium text-stone-700">Période de Conservation / Stockage</span>
                </div>
              </div>
            </div>

            {/* Timeline Table */}
            <div className="w-full border border-stone-300 rounded-lg overflow-hidden bg-white">
              
              {/* Header Months */}
              <div className="grid grid-cols-[220px_repeat(12,1fr)] bg-stone-50 border-b border-stone-300 text-xs font-semibold text-stone-700 text-center select-none">
                <div className="p-2.5 text-left pl-3 border-r border-stone-300 text-stone-500 font-medium">
                  Espèce & Variété
                </div>
                {MONTH_ABBR_FR.map((m, idx) => (
                  <div 
                    key={m} 
                    className={`py-2 px-1 border-r border-stone-200 last:border-r-0 ${
                      [6, 7, 8, 9].includes(idx) ? 'bg-amber-50/40 text-stone-900' : ''
                    }`}
                  >
                    {m}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div className="divide-y divide-stone-200 text-xs">
                {targetItems.length === 0 ? (
                  <div className="p-8 text-center text-stone-400">
                    Aucune variété trouvée pour les critères sélectionnés.
                  </div>
                ) : (
                  targetItems.map((item) => {
                    const hasHarvest = item.harvestMonths && item.harvestMonths.length > 0;
                    const hasStorage = item.storageMonths && item.storageMonths.length > 0;

                    return (
                      <div 
                        key={item.id}
                        className="grid grid-cols-[220px_repeat(12,1fr)] hover:bg-stone-50/70 transition-colors group relative"
                      >
                        {/* Variety Label on Left */}
                        <div className="p-2 pl-3 border-r border-stone-300 flex items-center justify-between gap-1.5 overflow-hidden">
                          <div className="flex items-center gap-1.5 truncate">
                            {renderIcon(item)}
                            <span 
                              className="font-medium text-stone-800 truncate"
                              title={item.displayName}
                            >
                              {item.displayName}
                            </span>
                            {item.isTemporary && (
                              <span 
                                className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-[9px] font-bold shrink-0 tracking-tight"
                                title="Variété à l'essai / En projet"
                              >
                                ⏳ Projet
                              </span>
                            )}
                            {item.isManualHarvest ? (
                              <span 
                                className="px-1 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 rounded text-[9px] font-semibold shrink-0"
                                title="Dates modifiées manuellement"
                              >
                                ✏️ Manuel
                              </span>
                            ) : (
                              <span 
                                className="px-1 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-medium shrink-0"
                                title="Dates issues de la référence internet / botanique"
                              >
                                🌐 Réf.
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            {item.isTemporary && item.varietyConfigId && (
                              <button
                                type="button"
                                onClick={() => handlePromoteToCatalog(item)}
                                className="opacity-0 group-hover:opacity-100 text-emerald-700 hover:text-emerald-800 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-[10px] font-semibold transition-opacity no-print cursor-pointer"
                                title="Valider et intégrer définitivement au catalogue"
                              >
                                ✨ Valider
                              </button>
                            )}
                            {/* Quick Edit Action (hover) */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-700 p-1 hover:bg-stone-200/50 rounded transition-opacity no-print shrink-0 cursor-pointer"
                              title="Modifier les mois de récolte et conservation"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* 12 Month Cells */}
                        {MONTH_ABBR_FR.map((_, idx) => {
                          const monthNum = idx + 1;
                          const isHarvest = item.harvestMonths?.includes(monthNum);
                          const isStorage = item.storageMonths?.includes(monthNum);

                          return (
                            <div 
                              key={monthNum}
                              className="py-1 px-0.5 border-r border-dashed border-stone-200 last:border-r-0 flex items-center justify-center min-h-[30px]"
                            >
                              {isHarvest && isStorage ? (
                                // Dual bar if both exist in the same month
                                <div className="w-full flex flex-col gap-0.5 px-0.5">
                                  <div 
                                    className="h-2.5 bg-[#ef4444] rounded-[2px] shadow-2xs" 
                                    title="Récolte" 
                                  />
                                  <div 
                                    className="h-2.5 bg-[#a5f3fc] border border-[#67e8f9] rounded-[2px] shadow-2xs" 
                                    title="Conservation" 
                                  />
                                </div>
                              ) : isHarvest ? (
                                <div 
                                  className="w-full h-5 mx-0.5 bg-[#ef4444] rounded-[2px] shadow-2xs transition-transform group-hover:scale-y-105"
                                  title={`${item.displayName} - Récolte en ${MONTH_NAMES_FR[idx]}`}
                                />
                              ) : isStorage ? (
                                <div 
                                  className="w-full h-5 mx-0.5 bg-[#a5f3fc] border border-[#67e8f9] rounded-[2px] shadow-2xs transition-transform group-hover:scale-y-105"
                                  title={`${item.displayName} - Conservation en ${MONTH_NAMES_FR[idx]}`}
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* Document Footer */}
            <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
              <span>Potager & Verger • Généré le {new Date().toLocaleDateString('fr-FR')}</span>
              <span>{targetItems.length} variétés programmées</span>
            </div>
          </div>

        </div>

        {/* Edit Modal Popup */}
        {editingItem && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-xl border border-stone-200 w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <h3 className="font-semibold text-stone-900 text-sm">
                    Modifier les périodes
                  </h3>
                  <p className="text-xs text-stone-500 font-medium">
                    {editingItem.displayName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="p-1 text-stone-400 hover:text-stone-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Source Indicator & Reset button in Planning Modal */}
              <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-stone-500 font-medium">Origine :</span>
                  {editingIsManual ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                      <Edit2 className="w-2.5 h-2.5 text-amber-600" />
                      Modifié manuellement
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <Globe className="w-2.5 h-2.5 text-emerald-600" />
                      Réf. Internet / Botanique
                    </span>
                  )}
                </div>
                {editingItem.defaultHarvestMonths && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditHarvestMonths([...(editingItem.defaultHarvestMonths || [])]);
                      setEditStorageMonths([...(editingItem.defaultStorageMonths || [])]);
                      setEditingIsManual(false);
                    }}
                    className="text-stone-600 hover:text-stone-900 text-[11px] font-medium hover:underline flex items-center gap-1 cursor-pointer"
                    title="Rétablir les mois calculés depuis la base de référence internet"
                  >
                    <RotateCcw className="w-3 h-3 text-stone-400" />
                    <span>Rétablir réf.</span>
                  </button>
                )}
              </div>

              {/* Harvest Months Selector */}
              <div>
                <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5 mb-2">
                  <span className="w-3 h-3 bg-[#ef4444] rounded-[2px] inline-block" />
                  Mois de Récolte :
                </label>
                <div className="grid grid-cols-6 gap-1.5 text-xs">
                  {MONTH_ABBR_FR.map((m, idx) => {
                    const mNum = idx + 1;
                    const isSelected = editHarvestMonths.includes(mNum);
                    return (
                      <button
                        key={mNum}
                        type="button"
                        onClick={() => handleToggleMonth(mNum, 'harvest')}
                        className={`py-1.5 px-1 rounded border text-center font-medium transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-red-500 text-white border-red-600 font-bold' 
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Storage Months Selector */}
              <div>
                <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5 mb-2">
                  <span className="w-3 h-3 bg-[#a5f3fc] border border-[#67e8f9] rounded-[2px] inline-block" />
                  Mois de Conservation / Stockage :
                </label>
                <div className="grid grid-cols-6 gap-1.5 text-xs">
                  {MONTH_ABBR_FR.map((m, idx) => {
                    const mNum = idx + 1;
                    const isSelected = editStorageMonths.includes(mNum);
                    return (
                      <button
                        key={mNum}
                        type="button"
                        onClick={() => handleToggleMonth(mNum, 'storage')}
                        className={`py-1.5 px-1 rounded border text-center font-medium transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-sky-400 text-white border-sky-500 font-bold' 
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Temporary Candidate Variety Checkbox */}
              <div className="pt-1 border-t border-stone-100">
                <label className="flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsTemporary}
                    onChange={(e) => setEditIsTemporary(e.target.checked)}
                    className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5">
                    <span>⏳ Variété temporaire / En projet (sauvegarder à l'essai)</span>
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 text-xs">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 text-stone-600 hover:bg-stone-100 rounded-lg font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveItemPeriods}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
