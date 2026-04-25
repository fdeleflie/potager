import { useFirebaseData, fb } from '../hooks/useFirebaseData';
import React, { useState, useEffect, useMemo } from 'react';
import { db, Seedling } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { Search, Filter, Plus, Sprout, LayoutGrid, List, Printer, Edit, Trash2, Archive, CheckCircle2, Download, ChevronDown, ChevronUp, X, RefreshCw } from 'lucide-react';
import { ConfirmModal } from '../components/Modals';
import { getSeedlingDisplayPhoto } from '../utils/seedling';
import { ICON_MAP, GARDEN_EMOJIS } from '../constants';

import { printElement } from '../utils/print';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function SeedlingsList({ setCurrentView, initialFilter = 'active' }: { setCurrentView: (v: string) => void, initialFilter?: string }) {
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('seedlings_search') || '');
  const [filterState, setFilterState] = useState(() => sessionStorage.getItem('seedlings_filter_state') || 'all');
  const [filterVegetable, setFilterVegetable] = useState(() => sessionStorage.getItem('seedlings_filter_vegetable') || 'all');
  const [filterCategory, setFilterCategory] = useState(() => sessionStorage.getItem('seedlings_filter_category') || 'all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>(() => (sessionStorage.getItem('seedlings_view_mode') as any) || 'grid');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterVariety, setFilterVariety] = useState('all');
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});
  const [filterTasteRating, setFilterTasteRating] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState(() => sessionStorage.getItem('seedlings_filter_month') || 'all');
  const [filterYear, setFilterYear] = useState(() => sessionStorage.getItem('seedlings_filter_year') || 'all');
  
  // initialFilter can be 'active', 'archived', 'success', 'failure', 'all'
  const [filterArchived, setFilterArchived] = useState(() => {
    const saved = sessionStorage.getItem('seedlings_filter_archived');
    if (initialFilter === 'active' && saved) return saved;
    return ['success', 'failure'].includes(initialFilter) ? 'archived' : 
           ['active', 'archived', 'all'].includes(initialFilter) ? initialFilter : 'all';
  }); 
  
  const [filterSuccess, setFilterSuccess] = useState(() => {
    const saved = sessionStorage.getItem('seedlings_filter_success');
    if (initialFilter === 'active' && saved) return saved;
    return initialFilter === 'success' ? 'true' : 
           initialFilter === 'failure' ? 'false' : 'all';
  });

  const [selectedSeedlings, setSelectedSeedlings] = useState<string[]>([]);

  useEffect(() => {
    sessionStorage.setItem('seedlings_search', searchTerm);
    sessionStorage.setItem('seedlings_filter_state', filterState);
    sessionStorage.setItem('seedlings_filter_vegetable', filterVegetable);
    sessionStorage.setItem('seedlings_filter_category', filterCategory);
    sessionStorage.setItem('seedlings_filter_archived', filterArchived);
    sessionStorage.setItem('seedlings_filter_success', filterSuccess);
    sessionStorage.setItem('seedlings_view_mode', viewMode);
    sessionStorage.setItem('seedlings_filter_month', filterMonth);
    sessionStorage.setItem('seedlings_filter_year', filterYear);
  }, [searchTerm, filterState, filterVegetable, filterArchived, filterSuccess, viewMode, filterMonth, filterYear]);

  useEffect(() => {
    if (initialFilter && initialFilter !== 'active') {
      setFilterArchived(['success', 'failure'].includes(initialFilter) ? 'archived' : 
                        ['active', 'archived', 'all'].includes(initialFilter) ? initialFilter : 'all');
      setFilterSuccess(initialFilter === 'success' ? 'true' : 
                       initialFilter === 'failure' ? 'false' : 'all');
    }
  }, [initialFilter]);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [splitDropState, setSplitDropState] = useState<{
    isOpen: boolean;
    seedling: Seedling | null;
    newStateValue: string;
  }>({ isOpen: false, seedling: null, newStateValue: '' });
  const [splitDropQuantity, setSplitDropQuantity] = useState<number | ''>('');

  const executeMove = async (seedling: Seedling, newStateValue: string, splitQty?: number) => {
    const STATE_ORDER = ['Démarrage', 'Repiquage', 'Mise en terre', 'Vendu / Donné'];
    const oldIndex = STATE_ORDER.indexOf(seedling.state);
    const newIndex = STATE_ORDER.indexOf(newStateValue);

    const isSplitting = splitQty && splitQty > 0 && splitQty < (seedling.quantity || 0);
    const currentTotal = seedling.quantity || 0;

    const performUpdate = async () => {
      if (isSplitting) {
        const newSeedlingId = uuidv4();
        const newSeedling: Seedling = {
          ...seedling,
          id: newSeedlingId,
          quantity: splitQty,
          state: newStateValue,
          quantityTransplanted: seedling.quantityTransplanted ? splitQty : undefined,
          quantityPlanted: seedling.quantityPlanted ? splitQty : undefined,
          quantityLostSown: undefined,
          quantityLostTransplanted: undefined,
          positions: [],
          harvests: [],
        };

        if (newStateValue === 'Repiquage' && !newSeedling.dateTransplanted) {
          newSeedling.dateTransplanted = new Date().toISOString();
        }
        if (newStateValue === 'Mise en terre' && !newSeedling.datePlanted) {
          newSeedling.datePlanted = new Date().toISOString();
        }

        if (newIndex < 2) {
          newSeedling.datePlanted = undefined;
          newSeedling.quantityPlanted = undefined;
        }
        if (newIndex < 1) {
          newSeedling.dateTransplanted = undefined;
          newSeedling.quantityTransplanted = undefined;
        }

        const updatedOldSeedling = {
          ...seedling,
          quantity: Math.max(0, currentTotal - splitQty),
          quantityTransplanted: seedling.quantityTransplanted ? Math.max(0, seedling.quantityTransplanted - splitQty) : undefined,
          quantityPlanted: seedling.quantityPlanted ? Math.max(0, seedling.quantityPlanted - splitQty) : undefined,
        };

        await fb.put('seedlings', newSeedling);
        await fb.put('seedlings', updatedOldSeedling);
      } else {
        const updates: any = { state: newStateValue };
        if (newStateValue === 'Repiquage' && !seedling.dateTransplanted) {
          updates.dateTransplanted = new Date().toISOString();
        }
        if (newStateValue === 'Mise en terre' && !seedling.datePlanted) {
          updates.datePlanted = new Date().toISOString();
        }
        if (newIndex < 2) {
          updates.datePlanted = undefined;
          updates.quantityPlanted = undefined;
        }
        if (newIndex < 1) {
          updates.dateTransplanted = undefined;
          updates.quantityTransplanted = undefined;
        }
        await fb.update('seedlings', seedling.id, updates);
      }
    };

    if (oldIndex !== -1 && newIndex !== -1 && newIndex < oldIndex) {
      setConfirmState({
        isOpen: true,
        title: 'Retour en arrière',
        message: `Vous déplacez ce plant de "${seedling.state}" vers "${newStateValue}". Les dates et quantités des étapes suivantes seront effacées. Voulez-vous continuer ?`,
        isDanger: true,
        onConfirm: async () => {
          await performUpdate();
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      });
    } else {
      await performUpdate();
    }
  };

  const handleStateChangeDrop = async (seedlingId: string, newStateValue: string) => {
    const seedling = await db.seedlings.get(seedlingId);
    if (!seedling || seedling.state === newStateValue) return;

    if ((seedling.quantity || 0) > 1) {
      setSplitDropState({ isOpen: true, seedling, newStateValue });
      setSplitDropQuantity(seedling.quantity || 0);
    } else {
      await executeMove(seedling, newStateValue);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterState('all');
    setFilterVegetable('all');
    setFilterCategory('all');
    setFilterVariety('all');
    setFilterTasteRating('all');
    setFilterMonth('all');
    setFilterYear('all');
    
    setFilterArchived(['success', 'failure'].includes(initialFilter) ? 'archived' : 
                      ['active', 'archived', 'all'].includes(initialFilter) ? initialFilter : 'all');
    setFilterSuccess(initialFilter === 'success' ? 'true' : 
                     initialFilter === 'failure' ? 'false' : 'all');
                     
    setSelectedAttributes({});
    
    sessionStorage.removeItem('seedlings_search');
    sessionStorage.removeItem('seedlings_filter_state');
    sessionStorage.removeItem('seedlings_filter_vegetable');
    sessionStorage.removeItem('seedlings_filter_month');
    sessionStorage.removeItem('seedlings_filter_year');
    sessionStorage.removeItem('seedlings_filter_archived');
    sessionStorage.removeItem('seedlings_filter_success');
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: rawSeedlings, error: seedlingsError } = useFirebaseData<any>('seedlings');
  const { data: encyclopedia, error: encError } = useFirebaseData<any>('encyclopedia');
  const { data: config, error: configError } = useFirebaseData<any>('config');

  const error = seedlingsError || encError || configError;
  const seedlings = useMemo(() => (rawSeedlings || []), [rawSeedlings]).filter(s => !s.isDeleted);
  
  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-xl border border-red-200">
        <p className="text-red-700 font-medium">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Rafraîchir
        </button>
      </div>
    );
  }

  if (!rawSeedlings || !config || !encyclopedia) return <div className="p-8 text-center text-stone-500 italic flex items-center justify-center gap-2">
    <RefreshCw className="w-4 h-4 animate-spin" />
    Chargement des plants...
  </div>;

  const STATE_ORDER = ['Démarrage', 'Repiquage', 'Mise en terre', 'Vendu / Donné'];

  const states = (config || []).filter(c => c.type === 'state').sort((a, b) => {
    const indexA = STATE_ORDER.indexOf(a.value);
    const indexB = STATE_ORDER.indexOf(b.value);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' });
  });
  const vegetablesConfig = config.filter(c => c.type === 'vegetable');
  const varietiesConfig = config.filter(c => c.type === 'variety');
  const attrTypes = config.filter(c => c.type === 'variety_attr_type').sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' }));
  const categories = config.filter(c => c.type === 'category').sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' }));

  // Get unique vegetables and varieties from seedlings for the dropdowns
  const uniqueVegetables = Array.from(new Set(seedlings.map(s => s.vegetable))).sort();
  const uniqueVarieties = Array.from(new Set(
    seedlings
      .filter(s => filterVegetable === 'all' || s.vegetable === filterVegetable)
      .map(s => s.variety)
  )).sort();

  const filtered = Array.from(new Map<string, any>((seedlings || []).filter(s => {
    const matchesSearch = (s.vegetable || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.variety || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = filterState === 'all' || s.state === filterState;
    const matchesVegetable = filterVegetable === 'all' || s.vegetable === filterVegetable;
    
    // Category filtering
    const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (s.vegetable || '').toLowerCase().trim());
    const matchesCategory = filterCategory === 'all' || (encEntry && encEntry.category === filterCategory);

    const matchesArchived = filterArchived === 'all' || 
                            (filterArchived === 'active' && !s.isArchived) || 
                            (filterArchived === 'archived' && s.isArchived);
    const matchesSuccess = filterSuccess === 'all' ||
                           (filterSuccess === 'true' && s.success === true) ||
                           (filterSuccess === 'false' && s.success === false);
    
    const matchesVariety = filterVariety === 'all' || s.variety === filterVariety;

    // Advanced attributes filtering
    const vegEnc = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (s.vegetable || '').toLowerCase().trim());
    const vegConfig = vegetablesConfig?.find(v => v.value === s.vegetable);
    const variety = varietiesConfig?.find(v => v.value === s.variety && (v.parentId === vegConfig?.id || v.parentId === vegEnc?.id));
    
    const matchesAttributes = Object.entries(selectedAttributes).every(([attrTypeId, selectedValues]) => {
      if (!selectedValues || selectedValues.length === 0) return true;
      const varietyAttrValue = variety?.attributes?.[attrTypeId] || '';
      const varietyTags = typeof varietyAttrValue === 'string' ? varietyAttrValue.split(',').map((t: string) => t.trim().toLowerCase()) : [];
      return selectedValues.some(sv => varietyTags.includes(sv.toLowerCase()));
    });

    const matchesTaste = filterTasteRating === 'all' || 
                         (variety?.attributes?.tasteRating && variety.attributes.tasteRating.toString() === filterTasteRating);
                           
    const matchesMonthYear = () => {
      if (filterMonth === 'all' && filterYear === 'all') return true;
      
      const y1 = s.dateSown ? new Date(s.dateSown) : null;
      const y2 = s.dateTransplanted ? new Date(s.dateTransplanted) : null;
      const y3 = s.datePlanted ? new Date(s.datePlanted) : null;

      const checkDate = (d: Date | null) => {
        if (!d) return false;
        const mMatch = filterMonth === 'all' || d.getMonth().toString() === filterMonth;
        const yMatch = filterYear === 'all' || d.getFullYear().toString() === filterYear;
        return mMatch && yMatch;
      };

      return checkDate(y1) || checkDate(y2) || checkDate(y3);
    };

    return matchesSearch && matchesState && matchesVegetable && matchesCategory && matchesArchived && matchesSuccess && matchesVariety && matchesAttributes && matchesTaste && matchesMonthYear();
  }).map(s => [s.id, s])).values()).sort((a, b) => {
    const vegCompare = a.vegetable.localeCompare(b.vegetable, undefined, { numeric: true, sensitivity: 'base' });
    if (vegCompare !== 0) return vegCompare;
    return (a.variety || '').localeCompare(b.variety || '', undefined, { numeric: true, sensitivity: 'base' });
  });

  const totalSown = filtered.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  const totalTransplanted = filtered.reduce((sum, s) => sum + (Number(s.quantityTransplanted) || 0), 0);
  const totalPlanted = filtered.reduce((sum, s) => sum + (Number(s.quantityPlanted) || 0), 0);

  const getRemainingToTransplant = (s: Seedling) => {
    if (s.isArchived) return 0;
    if (s.quantityPlanted !== undefined && s.quantityTransplanted === undefined) return 0; // Planted directly
    const sown = Number(s.quantity) || 0;
    const trans = Number(s.quantityTransplanted) || 0;
    const lost = Number(s.quantityLostSown) || 0;
    return Math.max(0, sown - trans - lost);
  };

  const getRemainingToPlant = (s: Seedling) => {
    if (s.isArchived) return 0;
    const trans = Number(s.quantityTransplanted) || 0;
    const planted = Number(s.quantityPlanted) || 0;
    const lost = Number(s.quantityLostTransplanted) || 0;
    return Math.max(0, trans - planted - lost);
  };

  const totalToTransplant = filtered.reduce((sum, s) => sum + getRemainingToTransplant(s), 0);
  const totalToPlant = filtered.reduce((sum, s) => sum + getRemainingToPlant(s), 0);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: 'Mettre à la corbeille',
      message: 'Voulez-vous vraiment mettre ce semis à la corbeille ?',
      isDanger: true,
      onConfirm: async () => {
        await fb.update('seedlings', id, { isDeleted: true });
      }
    });
  };

  const handleArchive = async (id: string, isArchived: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    await fb.update('seedlings', id, { isArchived: !isArchived });
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) return;

    const headers = [
      'Légume', 'Variété', 'État', 'Emplacement', 
      'Date Semis', 'Quantité Semée', 
      'Date Repiquage', 'Quantité Repiquée', 
      'Date Mise en Terre', 'Quantité Mise en Terre',
      'Action', 'Archivé', 'Succès'
    ];

    const rows = filtered.map(s => [
      s.vegetable,
      s.variety,
      s.state,
      s.location,
      s.dateSown ? new Date(s.dateSown).toLocaleDateString() : '',
      s.quantity || 0,
      s.dateTransplanted ? new Date(s.dateTransplanted).toLocaleDateString() : '',
      s.quantityTransplanted || 0,
      s.datePlanted ? new Date(s.datePlanted).toLocaleDateString() : '',
      s.quantityPlanted || 0,
      s.action || '',
      s.isArchived ? 'Oui' : 'Non',
      s.success === true ? 'Oui' : s.success === false ? 'Non' : ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `export_semis_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (filtered.length === 0) return;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Liste des Semis', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Généré le ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Légume", "Variété", "État", "Qté", "Semis", "Repiquage", "Plantation"];
    const tableRows = filtered.map(s => [
      s.vegetable,
      s.variety || '-',
      s.state,
      s.quantity?.toString() || '-',
      s.dateSown ? new Date(s.dateSown).toLocaleDateString() : '-',
      s.dateTransplanted ? new Date(s.dateTransplanted).toLocaleDateString() : '-',
      s.datePlanted ? new Date(s.datePlanted).toLocaleDateString() : '-'
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      alternateRowStyles: { fillColor: [249, 250, 251] }
    });

    doc.save(`export_semis_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleBulkStateChange = async (newState: string) => {
    const dateField = newState === 'Repiquage' ? 'dateTransplanted' : 'datePlanted';
    const now = new Date().toISOString();
    
    for (const id of selectedIds) {
      const seedling = seedlings.find(s => s.id === id);
      if (!seedling) continue;
      
      const updates: any = { state: newState };
      if (!seedling[dateField as keyof Seedling]) {
        updates[dateField] = now;
      }
      await fb.update('seedlings', id, updates);
    }
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    setConfirmState({
      isOpen: true,
      title: 'Suppression multiple',
      message: `Voulez-vous vraiment mettre ces ${selectedIds.size} semis à la corbeille ?`,
      isDanger: true,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await fb.update('seedlings', id, { isDeleted: true });
        }
        setSelectedIds(new Set());
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBulkArchive = async () => {
    for (const id of selectedIds) {
      const seedling = seedlings.find(s => s.id === id);
      if (seedling) {
        await fb.update('seedlings', id, { isArchived: !seedling.isArchived });
      }
    }
    setSelectedIds(new Set());
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  };

  return (
    <div className="space-y-3" id="seedlings-list-print-area">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText="Confirmer"
      />

      {/* Split Drop Modal */}
      {splitDropState.isOpen && splitDropState.seedling && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center">
              <h3 className="font-serif font-medium text-lg text-stone-900">Déplacement de lot</h3>
              <button onClick={() => setSplitDropState(prev => ({ ...prev, isOpen: false }))} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const qty = splitDropQuantity === '' ? undefined : Number(splitDropQuantity);
              await executeMove(splitDropState.seedling!, splitDropState.newStateValue, qty);
              setSplitDropState(prev => ({ ...prev, isOpen: false }));
            }} className="p-4 space-y-4">
              <p className="text-sm text-stone-600">
                Vous déplacez ce lot vers <strong>{splitDropState.newStateValue}</strong>.
                Voulez-vous déplacer l'intégralité du lot ou seulement une partie ?
              </p>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Nombre de plants à déplacer (sur {splitDropState.seedling.quantity || 0} au total)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={splitDropState.seedling.quantity || 0}
                  value={splitDropQuantity}
                  onChange={e => setSplitDropQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder={`Ex: ${splitDropState.seedling.quantity || 0}`}
                />
                <p className="text-xs text-stone-500 mt-1">
                  Si vous indiquez un nombre inférieur au total, le lot sera divisé en deux fiches distinctes.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSplitDropState(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <header className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-serif font-medium text-stone-900">Mes Semis</h1>
          <div className="flex flex-wrap gap-3 text-[11px]">
            {totalToTransplant > 0 && (
              <span className="text-amber-600 font-medium flex items-center gap-1" title="Nombre de plants semés qui n'ont pas encore été repiqués ou perdus">
                <Edit className="w-3 h-3" /> {totalToTransplant} reste à repiquer
              </span>
            )}
            {totalToPlant > 0 && (
              <span className="text-blue-600 font-medium flex items-center gap-1" title="Nombre de plants repiqués qui n'ont pas encore été mis en terre ou perdus">
                <CheckCircle2 className="w-3 h-3" /> {totalToPlant} reste à planter
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={handleExportCSV}
            className="p-1 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors print:hidden"
            title="Exporter en CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleExportPDF}
            className="p-1 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors print:hidden"
            title="Exporter en PDF"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
          </button>
          <button 
            onClick={() => printElement('seedlings-list-print-area', 'Liste des Semis')}
            className="p-1 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors print:hidden"
            title="Imprimer la liste"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <div className="flex bg-stone-100 rounded-lg p-0.5 print:hidden">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-emerald-600' : 'text-stone-500 hover:text-stone-700'}`}
              title="Vue grille"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-emerald-600' : 'text-stone-500 hover:text-stone-700'}`}
              title="Vue liste"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`p-1 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-emerald-600' : 'text-stone-500 hover:text-stone-700'}`}
              title="Vue Kanban"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-kanban"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M8 4v16"/><path d="M16 4v16"/><path d="M4 10h4"/><path d="M16 14h4"/><path d="M16 10h4"/></svg>
            </button>
          </div>
          <button 
            onClick={() => setCurrentView('seedling-new')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-xs font-medium shadow-sm transition-colors flex items-center gap-1 print:hidden"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau
          </button>
        </div>
      </header>

      <div className="bg-white p-2.5 rounded-xl shadow-sm border border-stone-200/60 space-y-2.5 print:hidden">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
            <input 
              type="text" 
              placeholder="Rechercher un légume, une variété..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
            <div className="flex gap-2">
            <select 
              value={filterCategory} 
              onChange={e => setFilterCategory(e.target.value)}
              className="px-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-stone-600"
            >
              <option value="all">Toutes les catégories</option>
              {categories.map(c => (
                <option key={c.id} value={c.value}>{c.value}</option>
              ))}
            </select>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-2 py-1 text-xs rounded-lg border transition-all flex items-center gap-1 font-medium ${
                showAdvancedFilters || Object.values(selectedAttributes).some(v => v.length > 0) || filterVariety !== 'all' || filterVegetable !== 'all' || filterTasteRating !== 'all' || filterMonth !== 'all' || filterYear !== 'all'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtres
              {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={resetFilters}
              className="px-2 py-1 text-xs rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition-all flex items-center gap-1 font-medium"
              title="Réinitialiser les filtres"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <select 
              value={filterState} 
              onChange={e => {
                const val = e.target.value;
                setFilterState(val);
                if (val === 'Vendu / Donné' && filterArchived === 'active') {
                  setFilterArchived('all');
                }
              }}
              className="px-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-stone-600"
            >
              <option value="all">Tous les états</option>
              {states.map(state => (
                <option key={state.id} value={state.value}>{state.value}</option>
              ))}
              <option value="Vendu / Donné">Vendu / Donné</option>
            </select>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="pt-3 border-t border-stone-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Mois</label>
              <select 
                value={filterMonth} 
                onChange={e => setFilterMonth(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-xs"
              >
                <option value="all">Tous les mois</option>
                {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                  <option key={i} value={i.toString()}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Année</label>
              <select 
                value={filterYear} 
                onChange={e => setFilterYear(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-xs"
              >
                <option value="all">Toutes les années</option>
                {Array.from(new Set(seedlings.flatMap(s => [
                  s.dateSown ? new Date(s.dateSown).getFullYear() : null,
                  s.dateTransplanted ? new Date(s.dateTransplanted).getFullYear() : null,
                  s.datePlanted ? new Date(s.datePlanted).getFullYear() : null
                ]).filter(Boolean))).sort((a, b) => (b as number) - (a as number)).map(y => (
                  <option key={y as number} value={y?.toString()}>{y}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Légume</label>
              <select 
                value={filterVegetable} 
                onChange={e => {
                  setFilterVegetable(e.target.value);
                  setFilterVariety('all');
                  setSelectedAttributes({});
                }}
                className="w-full px-2 py-1 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-xs"
              >
                <option value="all">Tous les légumes</option>
                {uniqueVegetables.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Variété</label>
              <select 
                value={filterVariety} 
                onChange={e => setFilterVariety(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-xs"
              >
                <option value="all">Toutes les variétés</option>
                {uniqueVarieties.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {attrTypes.map(attrType => {
              // Get all options defined in config for this attribute type
              const configuredOptions = config
                .filter(c => c.type === 'variety_option' && c.parentId === attrType.id)
                .map(c => c.value);

              // Also include any custom ones currently used by varieties
              const usedOptions = varietiesConfig
                  .map(v => v.attributes?.[attrType.id])
                  .filter(Boolean)
                  .flatMap(attr => attr.split(',').map((s: string) => s.trim()));

              const options = Array.from(new Set([...configuredOptions, ...usedOptions])).sort();

              return (
                <div key={attrType.id} className="space-y-1">
                  <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">{attrType.value}</label>
                  <div className="flex flex-wrap gap-1 min-h-[32px] p-1 rounded-lg border border-stone-200 bg-stone-50/50">
                    {options.length > 0 ? options.map(opt => {
                      const isSelected = selectedAttributes[attrType.id]?.includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => {
                            setSelectedAttributes(prev => {
                              const current = prev[attrType.id] || [];
                              const next = current.includes(opt)
                                ? current.filter(c => c !== opt)
                                : [...current, opt];
                              return { ...prev, [attrType.id]: next };
                            });
                          }}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            isSelected 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-white text-stone-600 border border-stone-200 hover:border-emerald-300'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    }) : (
                      <span className="text-xs text-stone-400 italic flex items-center px-1">Aucune option (voir Config)</span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Note gustative</label>
              <select 
                value={filterTasteRating} 
                onChange={e => setFilterTasteRating(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-xs"
              >
                <option value="all">Toutes les notes</option>
                {[10,9,8,7,6,5,4,3,2,1].map(n => (
                  <option key={n} value={n.toString()}>{n} / 10</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Archivage</label>
              <select 
                value={filterArchived} 
                onChange={e => setFilterArchived(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-xs"
              >
                <option value="active">En cours</option>
                <option value="archived">Archivés</option>
                <option value="all">Tous</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Résultats</label>
              <select 
                value={filterSuccess} 
                onChange={e => setFilterSuccess(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-xs"
              >
                <option value="all">Tous</option>
                <option value="true">Réussites</option>
                <option value="false">Échecs</option>
              </select>
            </div>

            <div className="lg:col-span-4 flex justify-end pt-1">
              <button
                onClick={() => {
                  setFilterVegetable('all');
                  setFilterVariety('all');
                  setSelectedAttributes({});
                  setFilterTasteRating('all');
                  setFilterState('all');
                  setFilterArchived('active');
                  setFilterSuccess('all');
                  setFilterMonth('all');
                  setFilterYear('all');
                  setSearchTerm('');
                }}
                className="text-xs font-medium text-stone-400 hover:text-red-500 flex items-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" />
                Réinitialiser tous les filtres
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-emerald-800">{selectedIds.size} sélectionné(s)</span>
            <div className="hidden sm:block h-4 w-px bg-emerald-200"></div>
            <button onClick={() => handleBulkStateChange('Repiquage')} className="text-xs font-medium text-emerald-700 hover:text-emerald-900 bg-white px-2 py-1 rounded border border-emerald-200 hover:border-emerald-300 transition-colors">Marquer comme repiqué</button>
            <button onClick={() => handleBulkStateChange('Mise en terre')} className="text-xs font-medium text-emerald-700 hover:text-emerald-900 bg-white px-2 py-1 rounded border border-emerald-200 hover:border-emerald-300 transition-colors">Marquer comme mis en terre</button>
            <button onClick={handleBulkArchive} className="text-xs font-medium text-stone-600 hover:text-stone-900 bg-white px-2 py-1 rounded border border-stone-200 hover:border-stone-300 transition-colors">Archiver / Désarchiver</button>
            <button onClick={handleBulkDelete} className="text-xs font-medium text-red-600 hover:text-red-800 bg-white px-2 py-1 rounded border border-red-200 hover:border-red-300 transition-colors">Supprimer</button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="text-emerald-600 hover:text-emerald-800 p-1 rounded hover:bg-emerald-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(s => (
            <div 
              key={s.id} 
              onClick={() => setCurrentView(`seedling-detail-${s.id}`)}
              className="bg-white rounded-xl shadow-sm border border-stone-200/60 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="h-28 bg-stone-100 relative">
                <div className="absolute top-2 left-2 z-10 print:hidden" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(s.id)}
                    onChange={(e) => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer bg-white"
                  />
                </div>
                {(() => {
                  const displayPhoto = getSeedlingDisplayPhoto(s);
                  return displayPhoto ? (
                    <img src={displayPhoto} alt={s.vegetable} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <Sprout className="w-12 h-12" />
                    </div>
                  );
                })()}
                {s.isArchived && (
                  <div className="absolute bottom-2 right-2 bg-stone-900/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                    Archivé
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCurrentView(`seedling-edit-${s.id}`); }}
                    className="p-1 bg-white/90 hover:bg-white text-stone-700 rounded shadow-sm transition-colors"
                    title="Modifier"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => handleArchive(s.id, s.isArchived, e)}
                    className="p-1 bg-white/90 hover:bg-white text-stone-700 rounded shadow-sm transition-colors"
                    title={s.isArchived ? "Désarchiver" : "Archiver"}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(s.id, e)}
                    className="p-1 bg-white/90 hover:bg-white text-red-600 rounded shadow-sm transition-colors"
                    title="Mettre à la corbeille"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-2.5">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex gap-2 items-start">
                    {(() => {
                      const encEntry = encyclopedia?.find(e => e.name.toLowerCase().trim() === s.vegetable.toLowerCase().trim());
                      const color = encEntry?.color || '#10b981';
                      const Icon = ICON_MAP[encEntry?.icon || ''] || ICON_MAP['Trees'];
                      return (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow-inner shrink-0 mt-0.5" 
                          style={{ 
                            background: `radial-gradient(circle at 30% 30%, ${color}, ${color}dd)`,
                            boxShadow: `0 2px 4px ${color}40`
                          }}
                        >
                          {GARDEN_EMOJIS.includes(encEntry?.icon || '') ? (
                            <span className="text-lg">{encEntry?.icon}</span>
                          ) : (
                            <Icon className="w-4 h-4 text-white drop-shadow-sm" />
                          )}
                        </div>
                      );
                    })()}
                    <div>
                      <h3 className="text-base font-serif font-medium text-stone-900 group-hover:text-emerald-600 transition-colors leading-tight">
                        {s.vegetable}
                      </h3>
                      <p className="text-[11px] text-stone-500 font-medium">{s.variety}</p>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                    {s.state}
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 mt-1.5 flex flex-col gap-0.5">
                  {s.dateSown && <span>Semé le {new Date(s.dateSown).toLocaleDateString()}</span>}
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {s.quantity !== undefined && (
                      <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                        S: {s.quantity}
                        {getRemainingToTransplant(s) > 0 && (
                          <span className="text-amber-600 font-bold">({getRemainingToTransplant(s)} reste à repiquer)</span>
                        )}
                      </span>
                    )}
                    {s.quantityTransplanted !== undefined && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                        R: {s.quantityTransplanted}
                        {getRemainingToPlant(s) > 0 && (
                          <span className="text-blue-600 font-bold">({getRemainingToPlant(s)} reste à planter)</span>
                        )}
                      </span>
                    )}
                    {s.quantityPlanted !== undefined && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                        P: {s.quantityPlanted}
                      </span>
                    )}
                  </div>
                  {s.action && <span className="whitespace-pre-wrap line-clamp-1 italic text-stone-400 mt-0.5">Action: {s.action}</span>}
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded">{s.location}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 text-stone-500 uppercase font-medium text-[10px]">
                <tr>
                  <th className="px-3 py-2 w-10 print:hidden">
                    <input 
                      type="checkbox" 
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2">Légume</th>
                  <th className="px-3 py-2">Variété</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">État</th>
                  <th className="px-3 py-2">Emplacement</th>
                  <th className="px-3 py-2">Quantité</th>
                  <th className="px-3 py-2 print:hidden text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-stone-50 transition-colors cursor-pointer" onClick={() => setCurrentView(`seedling-detail-${s.id}`)}>
                    <td className="px-3 py-2 print:hidden" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(s.id)}
                        onChange={(e) => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-stone-900 flex items-center gap-1.5">
                      {s.isArchived && <Archive className="w-3 h-3 text-stone-400" />}
                      {s.vegetable}
                    </td>
                    <td className="px-3 py-2">{s.variety}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5 text-[10px]">
                        {s.dateSown && <span>Semis: {new Date(s.dateSown).toLocaleDateString()}</span>}
                        {s.action && <span className="whitespace-pre-wrap line-clamp-2 italic text-stone-400">Action: {s.action}</span>}
                        {s.dateTransplanted && <span>Repiquage: {new Date(s.dateTransplanted).toLocaleDateString()}</span>}
                        {s.datePlanted && <span>Mise en terre: {new Date(s.datePlanted).toLocaleDateString()}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                        {s.state}
                      </span>
                    </td>
                    <td className="px-3 py-2">{s.location}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5 text-[10px]">
                        {s.quantity !== undefined && (
                          <span className="flex justify-between gap-2">
                            <span>Semés: {s.quantity}</span>
                            {getRemainingToTransplant(s) > 0 && (
                              <span className="text-amber-600 font-medium">({getRemainingToTransplant(s)} reste à repiquer)</span>
                            )}
                          </span>
                        )}
                        {s.quantityTransplanted !== undefined && (
                          <span className="flex justify-between gap-2">
                            <span>Repiqués: {s.quantityTransplanted}</span>
                            {getRemainingToPlant(s) > 0 && (
                              <span className="text-blue-600 font-medium">({getRemainingToPlant(s)} reste à planter)</span>
                            )}
                          </span>
                        )}
                        {s.quantityPlanted !== undefined && <span>En terre: {s.quantityPlanted}</span>}
                        {s.quantity === undefined && s.quantityTransplanted === undefined && s.quantityPlanted === undefined && <span>-</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 print:hidden text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setCurrentView(`seedling-edit-${s.id}`); }}
                          className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => handleArchive(s.id, s.isArchived, e)}
                          className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded transition-colors"
                          title={s.isArchived ? "Désarchiver" : "Archiver"}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(s.id, e)}
                          className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Mettre à la corbeille"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-stone-50 text-stone-900 border-t border-stone-200">
                  <tr>
                    <td className="print:hidden"></td>
                    <td colSpan={5} className="px-3 py-2 text-right font-medium text-xs">
                      Total pour la sélection :
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5 text-[10px] font-medium">
                        {totalSown > 0 && <span>Semés: {totalSown}</span>}
                        {totalTransplanted > 0 && <span>Repiqués: {totalTransplanted}</span>}
                        {totalPlanted > 0 && <span>En terre: {totalPlanted}</span>}
                        {totalSown === 0 && totalTransplanted === 0 && totalPlanted === 0 && <span>-</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 print:hidden"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x items-start">
          {[...states, { id: 'vendu-donne', value: 'Vendu / Donné', type: 'state' }].map(state => {
            const stateSeedlings = filtered.filter(s => s.state === state.value);
            return (
              <div 
                key={state.id} 
                className="flex-shrink-0 w-72 bg-stone-100/50 rounded-xl border border-stone-200/60 flex flex-col max-h-[calc(100vh-12rem)] snap-center"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('bg-emerald-50', 'border-emerald-200');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('bg-emerald-50', 'border-emerald-200');
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('bg-emerald-50', 'border-emerald-200');
                  const id = e.dataTransfer.getData('seedlingId');
                  if (id) {
                    await handleStateChangeDrop(id, state.value);
                  }
                }}
              >
                <div className="p-3 border-b border-stone-200/60 bg-stone-100/80 rounded-t-xl flex justify-between items-center sticky top-0">
                  <h3 className="font-medium text-stone-800">{state.value}</h3>
                  <span className="text-xs font-medium bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full">{stateSeedlings.length}</span>
                </div>
                <div className="p-3 overflow-y-auto flex-1 space-y-3">
                  {stateSeedlings.map(s => (
                    <div 
                      key={s.id} 
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('seedlingId', s.id);
                      }}
                      onClick={() => setCurrentView(`seedling-detail-${s.id}`)} 
                      className="bg-white p-3 rounded-lg shadow-sm border border-stone-200/60 cursor-grab active:cursor-grabbing hover:border-emerald-400 transition-colors group relative"
                    >
                      <div className="absolute top-2 right-2 z-10 print:hidden" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(s.id)}
                          onChange={(e) => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(s.id);
                              else next.delete(s.id);
                              return next;
                            });
                          }}
                          className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex justify-between items-start mb-2 pr-6">
                        <div>
                          <h4 className="font-medium text-stone-900 leading-tight">{s.vegetable}</h4>
                          <p className="text-[10px] text-stone-500">{s.variety}</p>
                        </div>
                        {s.isArchived && <Archive className="w-3.5 h-3.5 text-stone-400" />}
                      </div>
                      <div className="text-[10px] text-stone-600 space-y-1">
                        {s.quantity !== undefined && <div>Semés: {s.quantity}</div>}
                        {s.quantityTransplanted !== undefined && <div>Repiqués: {s.quantityTransplanted}</div>}
                        {s.quantityPlanted !== undefined && <div>En terre: {s.quantityPlanted}</div>}
                      </div>
                      <div className="mt-2 pt-2 border-t border-stone-100 flex justify-between items-center">
                        <span className="text-[9px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-500">{s.location}</span>
                      </div>
                    </div>
                  ))}
                  {stateSeedlings.length === 0 && (
                    <div className="text-center py-6 text-stone-400 text-xs italic border-2 border-dashed border-stone-200 rounded-lg">
                      Glissez un plant ici
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {filtered.length === 0 && (
        <div className="text-center py-8 bg-white rounded-2xl border border-stone-200 border-dashed">
          <Sprout className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-stone-900">Aucun semis trouvé</h3>
          <p className="text-xs text-stone-500 mt-0.5">Modifiez vos filtres ou créez un nouveau semis.</p>
        </div>
      )}
    </div>
  );
}
