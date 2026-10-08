import { useFirebaseData, fb } from '../hooks/useFirebaseData';
import React, { useState, useMemo, useEffect } from 'react';
import { db, EncyclopediaEntry, HealthIssue, ConfigItem } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { 
  BookOpen, Search, Plus, Trash2, Edit2, X, Save, 
  Sun, Droplets, Move, Users, Info, Bug, Stethoscope, 
  AlertTriangle, CheckCircle2, ShieldCheck, Leaf,
  ThumbsUp, ThumbsDown, Calendar, Maximize2, ChevronRight, ChevronLeft,
  List, Wand2, Trees, RefreshCw, Sparkles, Layers, MapPin, MapPinOff,
  Printer, Download, FileSpreadsheet
} from 'lucide-react';
import { ConfirmModal } from '../components/Modals';
import { DuplicateDetectorModal } from '../components/DuplicateDetectorModal';
import { DeletePlantModal } from '../components/DeletePlantModal';
import { PlantCatalogExportModal } from '../components/PlantCatalogExportModal';
import { PlantCatalogPrintModal } from '../components/PlantCatalogPrintModal';
import { ExportPlantItem, ExportHealthItem } from '../utils/catalogExport';
import { detectSimilarVarieties } from '../utils/fuzzyMatching';
import { GARDEN_EMOJI_CATEGORIES, ICON_LIST, GARDEN_EMOJIS, ICON_MAP, isEmoji } from '../constants';
import { 
  getCanonicalCategory, 
  areCategoriesEqual, 
  deduplicateCategories, 
  normalizeCategoryKey, 
  DEFAULT_PLANT_CATEGORIES 
} from '../utils/categories';
import { importOrchardPdfPlants, ImportResult } from '../utils/orchardImporter';
import { isTechnicalId } from '../utils/varietyNormalizer';

type Tab = 'vegetables' | 'health';
type PlantSubTab = 'culture' | 'varieties';

export function EncyclopediaView({ setCurrentView }: { setCurrentView?: (view: string) => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('vegetables');
  const [plantSubTab, setPlantSubTab] = useState<PlantSubTab>('culture');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedVegId, setSelectedVegId] = useState<string | null>(null);
  const [selectedHealthId, setSelectedHealthId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Orchard PDF Import states
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importReportModal, setImportReportModal] = useState<ImportResult | null>(null);

  // Global & Variety Duplicate Cleaning states
  const [isCleaningAll, setIsCleaningAll] = useState(false);
  const [isCleaningPlantVarieties, setIsCleaningPlantVarieties] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fuzzy Duplicate / Near-Spelling Detector Modal state
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateModalPlantFilter, setDuplicateModalPlantFilter] = useState<string | undefined>(undefined);

  // Smart Plant Deletion / Reassignment modal state
  const [plantToDelete, setPlantToDelete] = useState<any | null>(null);
  const [isDeletePlantModalOpen, setIsDeletePlantModalOpen] = useState(false);

  // Plant Catalog Export & Print modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printInitialPlant, setPrintInitialPlant] = useState<ExportPlantItem | null>(null);
  
  // Data
  const { data: encyclopedia, error: encError } = useFirebaseData<any>('encyclopedia');
  const { data: healthIssues, error: healthError } = useFirebaseData<any>('healthIssues');
  const { data: config, error: configError } = useFirebaseData<any>('config');
  const { data: trees, error: treesError } = useFirebaseData<any>('trees');
  const { data: seedlings, error: seedlingsError } = useFirebaseData<any>('seedlings');

  const error = encError || healthError || configError || treesError || seedlingsError;

  const [editForm, setEditForm] = useState<any>({});
  const [healthForm, setHealthForm] = useState<Partial<HealthIssue>>({});
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [newVarietyName, setNewVarietyName] = useState('');
  const [varietyError, setVarietyError] = useState<string | null>(null);
  const [editingVarietyId, setEditingVarietyId] = useState<string | null>(null);
  const [varietyEditForm, setVarietyEditForm] = useState<{name: string, attributes: any}>({name: '', attributes: {}});

  // Confirmation modal state for reliable deletions in iframe
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
    confirmText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirmer',
    isDanger: false
  });

  // Automatically harmonize encyclopedia plant categories in database
  // E.g. plants saved with "Legume" or "legume" are harmonized to canonical "Légume"
  useEffect(() => {
    if (!encyclopedia || encyclopedia.length === 0) return;
    
    const harmonizeDatabaseCategories = async () => {
      for (const plant of encyclopedia) {
        if (!plant.category || !plant.category.trim()) continue;
        const canonical = getCanonicalCategory(plant.category, config);
        if (plant.category !== canonical) {
          try {
            await fb.update('encyclopedia', plant.id, { category: canonical });
          } catch (err) {
            console.error('Failed to harmonize plant category:', err);
          }
        }
      }
    };

    harmonizeDatabaseCategories();
  }, [encyclopedia, config]);

  const handleManualImportOrchard = async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const res = await importOrchardPdfPlants(encyclopedia || [], config || []);
      localStorage.setItem('orchard_pdf_plants_auto_synced_v3', 'true');
      setImportReportModal(res);
    } catch (err) {
      console.error('Manual import error:', err);
      alert('Une erreur est survenue lors de la synchronisation.');
    } finally {
      setIsImporting(false);
    }
  };

  const unifiedPlants = useMemo(() => {
    if (!config || !encyclopedia) return [];
    const configVegetables = config.filter((c: any) => c.type === 'vegetable');
    const encyclopediaEntries = encyclopedia;

    const allNames = Array.from(new Set([
      ...configVegetables.map((c: any) => (c.value || '').toLowerCase().trim()),
      ...encyclopediaEntries.map((e: any) => (e.name || '').toLowerCase().trim()),
    ])).filter(Boolean);

    return allNames.map(nameLower => {
      const conf = configVegetables.find((c: any) => (c.value || '').toLowerCase().trim() === nameLower);
      const enc = encyclopediaEntries.find((e: any) => (e.name || '').toLowerCase().trim() === nameLower);
      const treeSample = trees?.find((t: any) => (t.species || '').toLowerCase().trim() === nameLower);

      const displayName = enc?.name || conf?.value || treeSample?.species || '';
      const rawCategory = enc?.category || (treeSample ? 'Arbre fruitier' : 'Légume');
      const category = getCanonicalCategory(rawCategory, config);
      const icon = enc?.icon || (category === 'Arbre fruitier' ? (treeSample?.icon || 'Trees') : 'Sprout');
      const color = enc?.color || treeSample?.color || '#10b981';

      // Use a prefixed ID to avoid collisions between config and encyclopedia tables
      const id = conf ? `c-${conf.id}` : (enc ? `e-${enc.id}` : `v-${uuidv4()}`);

      return {
        id,
        name: displayName,
        configId: conf?.id,
        encyclopediaId: enc?.id,
        category,
        sowingPeriod: enc?.sowingPeriod || '',
        plantingPeriod: enc?.plantingPeriod || '',
        harvestPeriod: enc?.harvestPeriod || '',
        exposure: enc?.exposure || 'Plein soleil',
        waterNeeds: enc?.waterNeeds || 'Moyen',
        spacing: enc?.spacing || (treeSample?.spacing ? `${treeSample.spacing}` : ''),
        pricePerKg: enc?.pricePerKg,
        goodCompanions: enc?.goodCompanions || [],
        badCompanions: enc?.badCompanions || [],
        tips: enc?.tips || '',
        color,
        icon
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [config, encyclopedia, trees]);

  const availableCategories = useMemo(() => {
    const rawCategories: string[] = [];
    config?.filter((c: any) => c.type === 'category').forEach((c: any) => {
      if (c.value && c.value.trim()) rawCategories.push(c.value.trim());
    });
    unifiedPlants.forEach(p => {
      if (p.category && p.category.trim()) rawCategories.push(p.category.trim());
    });
    DEFAULT_PLANT_CATEGORIES.forEach(c => rawCategories.push(c));
    return deduplicateCategories(rawCategories, config);
  }, [config, unifiedPlants]);

  const filteredPlants = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return unifiedPlants.filter(item => {
      let matchesSearch = true;
      if (term) {
        const matchesName = (item.name || '').toLowerCase().includes(term);
        const matchesCategory = (item.category || '').toLowerCase().includes(term);
        
        // Search inside varieties of this plant
        const plantVars = config?.filter((c: any) => 
          c.type === 'variety' && 
          (c.parentId === item.configId || c.parentId === item.encyclopediaId)
        ) || [];
        const matchesVariety = plantVars.some((v: any) => (v.value || '').toLowerCase().includes(term));
        
        matchesSearch = matchesName || matchesCategory || matchesVariety;
      }
      const matchesCategory = filterCategory === '' || areCategoriesEqual(item.category, filterCategory);
      return matchesSearch && matchesCategory;
    });
  }, [unifiedPlants, searchTerm, filterCategory, config]);

  const filteredHealth = useMemo(() => healthIssues?.filter((item: any) => 
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.type || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')) || [], [healthIssues, searchTerm]);

  const selectedVeg = useMemo(() => unifiedPlants.find(v => v.id === selectedVegId), [unifiedPlants, selectedVegId]);
  const selectedHealth = useMemo(() => healthIssues?.find((h: any) => h.id === selectedHealthId), [healthIssues, selectedHealthId]);
  
  // All IDs (configId and encyclopediaId) that correspond to this plant name
  const allIdsForSelectedPlant = useMemo(() => {
    if (!selectedVeg) return new Set<string>();
    const plantName = (selectedVeg.name || '').trim().toLowerCase();
    const ids = new Set<string>();
    if (selectedVeg.configId) ids.add(selectedVeg.configId);
    if (selectedVeg.encyclopediaId) ids.add(selectedVeg.encyclopediaId);

    encyclopedia?.forEach((e: any) => {
      if ((e.name || '').trim().toLowerCase() === plantName && e.id) {
        ids.add(e.id);
      }
    });

    config?.filter((c: any) => c.type === 'vegetable').forEach((c: any) => {
      if ((c.value || '').trim().toLowerCase() === plantName && c.id) {
        ids.add(c.id);
      }
    });

    return ids;
  }, [selectedVeg, encyclopedia, config]);

  // Varieties for the selected plant (matching by all associated IDs)
  const plantVarieties = useMemo(() => {
    if (!config || !selectedVeg) return [];
    return config.filter((c: any) => 
      c.type === 'variety' && allIdsForSelectedPlant.has(c.parentId) && !isTechnicalId(c.value)
    ).sort((a: any, b: any) => (a.value || '').localeCompare(b.value || ''));
  }, [config, selectedVeg, allIdsForSelectedPlant]);

  // Duplicate variety keys and specific duplicate IDs for current selected plant
  const duplicateVarietyKeys = useMemo(() => {
    const counts = new Map<string, number>();
    plantVarieties.forEach((v: any) => {
      const key = (v.value || '').trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([_, count]) => count > 1).map(([k]) => k));
  }, [plantVarieties]);

  const currentPlantDuplicateVarietyIds = useMemo(() => {
    const seen = new Set<string>();
    const toDelete: string[] = [];
    plantVarieties.forEach((v: any) => {
      const key = (v.value || '').trim().toLowerCase();
      if (!key) return;
      if (seen.has(key)) {
        toDelete.push(v.id);
      } else {
        seen.add(key);
      }
    });
    return toDelete;
  }, [plantVarieties]);

  // Orchard trees placed on terrain for the selected plant
  const plantOrchardTrees = useMemo(() => {
    if (!trees || !selectedVeg) return [];
    const nameLower = (selectedVeg.name || '').toLowerCase().trim();
    return trees.filter((t: any) => !t.isDeleted && (t.species || '').toLowerCase().trim() === nameLower);
  }, [trees, selectedVeg]);

  // Full Export and Print Data mapping
  const exportPlantsData: ExportPlantItem[] = useMemo(() => {
    if (!unifiedPlants || !config) return [];
    return unifiedPlants.map(p => {
      const plantName = (p.name || '').trim().toLowerCase();
      const ids = new Set<string>();
      if (p.configId) ids.add(p.configId);
      if (p.encyclopediaId) ids.add(p.encyclopediaId);
      encyclopedia?.forEach((e: any) => {
        if ((e.name || '').trim().toLowerCase() === plantName && e.id) ids.add(e.id);
      });
      config?.filter((c: any) => c.type === 'vegetable').forEach((c: any) => {
        if ((c.value || '').trim().toLowerCase() === plantName && c.id) ids.add(c.id);
      });

      const vars = config
        .filter((c: any) => c.type === 'variety' && ids.has(c.parentId))
        .map((v: any) => ({
          id: v.id,
          name: v.value,
          attributes: v.attributes || {}
        }));

      const orchardTreeCount = trees?.filter((t: any) => !t.isDeleted && (t.species || '').toLowerCase().trim() === plantName).length || 0;

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        sowingPeriod: p.sowingPeriod,
        plantingPeriod: p.plantingPeriod,
        harvestPeriod: p.harvestPeriod,
        exposure: p.exposure,
        waterNeeds: p.waterNeeds,
        spacing: p.spacing,
        pricePerKg: p.pricePerKg,
        goodCompanions: p.goodCompanions,
        badCompanions: p.badCompanions,
        tips: p.tips,
        color: p.color,
        icon: p.icon,
        varieties: vars,
        orchardTreeCount
      };
    });
  }, [unifiedPlants, config, encyclopedia, trees]);

  const exportFilteredPlantsData = useMemo(() => {
    const filteredIds = new Set(filteredPlants.map(p => p.id));
    return exportPlantsData.filter(p => filteredIds.has(p.id));
  }, [exportPlantsData, filteredPlants]);

  const exportSelectedPlantData = useMemo(() => {
    if (!selectedVegId) return null;
    return exportPlantsData.find(p => p.id === selectedVegId) || null;
  }, [exportPlantsData, selectedVegId]);

  const exportHealthData: ExportHealthItem[] = useMemo(() => {
    if (!healthIssues) return [];
    return healthIssues.map((h: any) => ({
      id: h.id,
      name: h.name,
      type: h.type,
      symptoms: h.symptoms,
      solutions: h.solutions || [],
      prevention: h.prevention,
      affectedPlants: h.affectedPlants || []
    }));
  }, [healthIssues]);

  const getVarietyTreeCount = (varietyName: string) => {
    if (!plantOrchardTrees.length) return 0;
    const vLower = (varietyName || '').toLowerCase().trim();
    return plantOrchardTrees.filter((t: any) => (t.variety || '').toLowerCase().trim() === vLower).length;
  };

  const handlePlaceOnOrchardPlan = (plant: any, varietyName?: string) => {
    const placementData = {
      species: plant.name,
      variety: varietyName || '',
      color: plant.color || '#10b981',
      icon: plant.icon || 'Trees',
      spacing: parseInt(plant.spacing) || 200,
      timestamp: Date.now()
    };
    localStorage.setItem('orchard_pending_placement', JSON.stringify(placementData));
    if (setCurrentView) {
      setCurrentView('orchard');
    }
  };

  const handleCleanPlantDuplicateVarieties = async () => {
    if (currentPlantDuplicateVarietyIds.length === 0 || isCleaningPlantVarieties) return;
    setIsCleaningPlantVarieties(true);
    try {
      await fb.batchDelete('config', currentPlantDuplicateVarietyIds);
      setSuccessToast(`${currentPlantDuplicateVarietyIds.length} copie(s) de variété en doublon supprimée(s) pour ${selectedVeg?.name}.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err) {
      console.error('Failed to clean varieties:', err);
      alert('Une erreur est survenue lors de la suppression des doublons.');
    } finally {
      setIsCleaningPlantVarieties(false);
    }
  };

  // Detect fuzzy / near-spelling duplicate varieties across the entire database
  const allSimilarVarietyGroups = useMemo(() => {
    return detectSimilarVarieties(config, encyclopedia, trees, seedlings, 75);
  }, [config, encyclopedia, trees, seedlings]);

  // Detect fuzzy / near-spelling duplicate varieties for the selected plant
  const selectedPlantSimilarGroups = useMemo(() => {
    if (!selectedVeg) return [];
    return detectSimilarVarieties(config, encyclopedia, trees, seedlings, 75, selectedVeg.name);
  }, [config, encyclopedia, trees, seedlings, selectedVeg]);

  // --- GLOBAL DEDUPLICATION (PLANTS & VARIETIES ACROSS THE WHOLE CATALOG) ---

  // 1. Duplicate plant entries in encyclopedia
  const globalDuplicateEncyclopediaIds = useMemo(() => {
    if (!encyclopedia) return [];
    const groups = new Map<string, any[]>();
    encyclopedia.forEach((e: any) => {
      const k = (e.name || '').trim().toLowerCase();
      if (!k) return;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    });

    const toDelete: string[] = [];
    groups.forEach((entries) => {
      if (entries.length > 1) {
        // Keep the most comprehensive entry (tips, plantingPeriod, harvestPeriod, etc.)
        entries.sort((a, b) => {
          const scoreA = (a.tips?.length || 0) + (a.plantingPeriod ? 10 : 0) + (a.harvestPeriod ? 10 : 0);
          const scoreB = (b.tips?.length || 0) + (b.plantingPeriod ? 10 : 0) + (b.harvestPeriod ? 10 : 0);
          return scoreB - scoreA;
        });
        for (let i = 1; i < entries.length; i++) {
          toDelete.push(entries[i].id);
        }
      }
    });
    return toDelete;
  }, [encyclopedia]);

  // 2. Duplicate vegetable entries in config
  const globalDuplicateConfigVegetableIds = useMemo(() => {
    if (!config) return [];
    const groups = new Map<string, any[]>();
    config.filter((c: any) => c.type === 'vegetable').forEach((c: any) => {
      const k = (c.value || '').trim().toLowerCase();
      if (!k) return;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(c);
    });

    const toDelete: string[] = [];
    groups.forEach((entries) => {
      if (entries.length > 1) {
        for (let i = 1; i < entries.length; i++) {
          toDelete.push(entries[i].id);
        }
      }
    });
    return toDelete;
  }, [config]);

  // 3. Duplicate variety entries in config across ALL plants
  const globalDuplicateVarietyIds = useMemo(() => {
    if (!config) return [];
    const parentIdToPlantName = new Map<string, string>();
    if (encyclopedia) {
      encyclopedia.forEach((e: any) => {
        if (e.id && e.name) parentIdToPlantName.set(e.id, (e.name || '').trim().toLowerCase());
      });
    }
    config.filter((c: any) => c.type === 'vegetable').forEach((c: any) => {
      if (c.id && c.value) parentIdToPlantName.set(c.id, (c.value || '').trim().toLowerCase());
    });

    const groups = new Map<string, any[]>();
    config.filter((c: any) => c.type === 'variety').forEach((v: any) => {
      const varName = (v.value || '').trim().toLowerCase();
      if (!varName) return;
      const plantKey = parentIdToPlantName.get(v.parentId) || v.parentId || 'orphan';
      const key = `${plantKey}___${varName}`;

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    });

    const toDelete: string[] = [];
    groups.forEach((entries) => {
      if (entries.length > 1) {
        // Keep the one with attributes or first created
        entries.sort((a, b) => {
          const hasAttrA = a.attributes && Object.keys(a.attributes).length > 0 ? 1 : 0;
          const hasAttrB = b.attributes && Object.keys(b.attributes).length > 0 ? 1 : 0;
          return hasAttrB - hasAttrA;
        });
        for (let i = 1; i < entries.length; i++) {
          toDelete.push(entries[i].id);
        }
      }
    });
    return toDelete;
  }, [config, encyclopedia]);

  const totalPlantDuplicates = globalDuplicateEncyclopediaIds.length + globalDuplicateConfigVegetableIds.length;
  const totalVarietyDuplicates = globalDuplicateVarietyIds.length;
  const totalGlobalDuplicates = totalPlantDuplicates + totalVarietyDuplicates;

  const handleCleanAllDuplicates = async () => {
    if (totalGlobalDuplicates === 0 || isCleaningAll) return;
    setIsCleaningAll(true);
    try {
      if (globalDuplicateEncyclopediaIds.length > 0) {
        await fb.batchDelete('encyclopedia', globalDuplicateEncyclopediaIds);
      }
      const configIdsToDelete = [
        ...globalDuplicateConfigVegetableIds,
        ...globalDuplicateVarietyIds
      ];
      if (configIdsToDelete.length > 0) {
        await fb.batchDelete('config', configIdsToDelete);
      }
      setSuccessToast(`Catalogue nettoyé ! ${totalGlobalDuplicates} doublon(s) supprimé(s) (${totalPlantDuplicates} plantes et ${totalVarietyDuplicates} variétés).`);
      setTimeout(() => setSuccessToast(null), 6000);
    } catch (err) {
      console.error('Error batch cleaning duplicates:', err);
      alert('Une erreur est survenue lors du nettoyage des doublons.');
    } finally {
      setIsCleaningAll(false);
    }
  };

  const handleStartEdit = (veg?: any) => {
    setIsCustomCategory(false);
    setCustomCategoryName('');
    if (veg) {
      setEditForm({
        ...veg,
        category: getCanonicalCategory(veg.category, config)
      });
    } else {
      const canonicalFilter = filterCategory ? getCanonicalCategory(filterCategory, config) : 'Légume';
      const isFruit = canonicalFilter === 'Arbre fruitier' || canonicalFilter === 'Petits fruits';
      setEditForm({
        name: '',
        category: canonicalFilter,
        sowingPeriod: '',
        plantingPeriod: '',
        harvestPeriod: '',
        exposure: 'Plein soleil',
        waterNeeds: 'Moyen',
        spacing: isFruit ? '200' : '',
        goodCompanions: [],
        badCompanions: [],
        tips: '',
        pricePerKg: undefined,
        color: '#10b981',
        icon: isFruit ? 'Trees' : 'Sprout'
      });
    }
    setIsEditing(true);
  };

  const handleStartHealthEdit = (item?: HealthIssue) => {
    if (item) {
      setHealthForm(item);
    } else {
      setHealthForm({
        name: '',
        type: 'Ravageur',
        symptoms: '',
        solutions: [],
        prevention: '',
        affectedPlants: []
      });
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editForm.name) return;

    let encId = editForm.encyclopediaId;
    const canonicalCategory = getCanonicalCategory(editForm.category || 'Légume', config);
    const encData = {
      name: editForm.name.trim(),
      category: canonicalCategory,
      sowingPeriod: editForm.sowingPeriod || '',
      plantingPeriod: editForm.plantingPeriod || '',
      harvestPeriod: editForm.harvestPeriod || '',
      exposure: editForm.exposure || 'Plein soleil',
      waterNeeds: editForm.waterNeeds || 'Moyen',
      spacing: editForm.spacing || '',
      pricePerKg: editForm.pricePerKg ? Number(editForm.pricePerKg) : undefined,
      goodCompanions: editForm.goodCompanions || [],
      badCompanions: editForm.badCompanions || [],
      tips: editForm.tips || '',
      color: editForm.color || '#10b981',
      icon: editForm.icon || (canonicalCategory === 'Arbre fruitier' ? 'Trees' : 'Sprout'),
      updatedAt: new Date().toISOString()
    };

    if (encId) {
      await fb.update('encyclopedia', encId, encData);
    } else {
      encId = uuidv4();
      await fb.add('encyclopedia', { id: encId, ...encData });
    }

    // Ensure category exists in config (accent- and case-insensitively)
    if (canonicalCategory) {
      const existsInConfig = config?.some((c: any) => 
        c.type === 'category' && areCategoriesEqual(c.value, canonicalCategory)
      );
      if (!existsInConfig) {
        const catKey = normalizeCategoryKey(canonicalCategory);
        const catId = `cat_${catKey.replace(/[^a-z0-9]/g, '_')}`;
        await fb.put('config', {
          id: catId,
          type: 'category',
          value: canonicalCategory
        });
      }
    }

    // Propagate updated appearance to matching trees in "Mon Verger" if applicable
    if (editForm.category === 'Arbre fruitier' && trees) {
      const matchingTrees = trees.filter((t: any) => (t.species || '').toLowerCase().trim() === editForm.name.toLowerCase().trim());
      for (const t of matchingTrees) {
        if (t.color !== editForm.color || t.icon !== editForm.icon) {
          await fb.update('trees', t.id, {
            color: editForm.color,
            icon: editForm.icon
          });
        }
      }
    }

    // Set the selected ID with the correct prefix
    setSelectedVegId(`e-${encId}`);
    setIsEditing(false);
  };

  const handleSaveHealth = async () => {
    if (!healthForm.name) return;

    const entry: HealthIssue = {
      id: healthForm.id || uuidv4(),
      name: healthForm.name,
      type: healthForm.type || 'Ravageur',
      symptoms: healthForm.symptoms || '',
      solutions: healthForm.solutions || [],
      prevention: healthForm.prevention || '',
      affectedPlants: healthForm.affectedPlants || [],
      updatedAt: new Date().toISOString()
    };

    if (healthForm.id) {
      const { id, ...updateData } = entry;
      await fb.update('healthIssues', id, updateData);
    } else {
      await fb.add('healthIssues', entry);
      setSelectedHealthId(entry.id);
    }
    setIsEditing(false);
  };

  const handleDelete = (veg: any) => {
    setPlantToDelete(veg);
    setIsDeletePlantModalOpen(true);
  };

  const handleDeleteHealth = (id: string, name?: string) => {
    setConfirmState({
      isOpen: true,
      title: "Supprimer la fiche santé",
      message: `Voulez-vous vraiment supprimer cette fiche santé ${name ? `"${name}"` : ''} ?`,
      isDanger: true,
      confirmText: "Supprimer",
      onConfirm: async () => {
        await fb.delete('healthIssues', id);
        if (selectedHealthId === id) setSelectedHealthId(null);
      }
    });
  };

  const handleAddVariety = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newVarietyName.trim();
    if (!trimmed || (!selectedVeg?.configId && !selectedVeg?.encyclopediaId)) return;

    // Check for duplicate variety name for this plant
    const alreadyExists = plantVarieties.some(
      (v: any) => (v.value || '').trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      setVarietyError(`La variété "${trimmed}" existe déjà pour cette plante.`);
      return;
    }
    setVarietyError(null);

    // Prefer canonical encyclopedia ID
    const targetParentId = selectedVeg.encyclopediaId || selectedVeg.configId;
    await fb.add('config', {
      id: uuidv4(),
      type: "variety",
      value: trimmed,
      parentId: targetParentId
    });
    setNewVarietyName("");
  };

  const handleDeleteVariety = (varietyOrId: any) => {
    const variety = typeof varietyOrId === 'string' ? plantVarieties.find(v => v.id === varietyOrId) : varietyOrId;
    const varietyName = variety?.value || 'cette variété';
    const varietyId = typeof varietyOrId === 'string' ? varietyOrId : varietyOrId?.id;
    if (!varietyId) return;

    setConfirmState({
      isOpen: true,
      title: "Supprimer la variété",
      message: `Voulez-vous vraiment supprimer la variété "${varietyName}" ?`,
      isDanger: true,
      confirmText: "Supprimer",
      onConfirm: async () => {
        await fb.delete('config', varietyId);
      }
    });
  };

  const varietyAttrTypes = useMemo(() => 
    config?.filter(c => c.type === 'variety_attr_type').sort((a, b) => a.value.localeCompare(b.value)) || []
  , [config]);

  const varietyOptions = useMemo(() => 
    config?.filter(c => c.type === 'variety_option') || []
  , [config]);

  const handleSaveVariety = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVarietyId) return;

    // Save new options to config
    for (const attrTypeId of Object.keys(varietyEditForm.attributes)) {
      const value = varietyEditForm.attributes[attrTypeId];
      if (typeof value === 'string' && value.trim() && !['other'].includes(attrTypeId)) {
        const attrType = varietyAttrTypes.find(t => t.id === attrTypeId);
        if (attrType) {
          const parts = value.split(',').map(p => p.trim()).filter(p => p);
          for (const part of parts) {
            const existingOption = varietyOptions.find(o => 
              o.parentId === attrTypeId && 
              o.value.toLowerCase().trim() === part.toLowerCase().trim()
            );
            if (!existingOption) {
              await fb.add('config', {
                id: uuidv4(),
                type: 'variety_option',
                value: part,
                parentId: attrTypeId
              });
            }
          }
        }
      }
    }

    await fb.update('config', editingVarietyId, { value: varietyEditForm.name, attributes: varietyEditForm.attributes });
    setEditingVarietyId(null);
  };

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-xl border border-red-200">
        <p className="text-red-700 font-medium">{error}</p>
        <p className="text-red-600 text-sm mt-2">Dépassement de quota possible. Veuillez patienter ou vérifier votre console Firebase.</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Rafraîchir
        </button>
      </div>
    );
  }

  if (!encyclopedia && !config && !error) return <div className="p-8 text-center text-stone-500 italic">Chargement du catalogue...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {successToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-sm flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {importStatus && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-sm flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{importStatus}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setFilterCategory('Arbre fruitier'); setImportStatus(null); }}
              className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
            >
              Voir les fruitiers
            </button>
            <button onClick={() => setImportStatus(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-medium text-stone-900">Catalogue des Plantes</h1>
            <p className="text-xs text-stone-500">Gérez vos légumes, variétés et fiches santé</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setPrintInitialPlant(exportSelectedPlantData);
              setIsPrintModalOpen(true);
            }}
            className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Imprimer le catalogue, une fiche culture ou le livret récapitulatif"
          >
            <Printer className="w-3.5 h-3.5 text-stone-600" />
            <span>Imprimer</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Exporter les données du catalogue au format Excel, CSV ou JSON"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exporter</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDuplicateModalPlantFilter(undefined);
              setIsDuplicateModalOpen(true);
            }}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Ouvrir le détecteur de doublons et fusionner les variantes d'orthographe"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Détecteur de similarités</span>
            {allSimilarVarietyGroups.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full text-[10px] font-bold">
                {allSimilarVarietyGroups.length}
              </span>
            )}
          </button>

          {totalGlobalDuplicates > 0 && (
            <button
              type="button"
              disabled={isCleaningAll}
              onClick={() => {
                setConfirmState({
                  isOpen: true,
                  title: "Nettoyer tous les doublons du catalogue",
                  message: `Voulez-vous supprimer les ${totalGlobalDuplicates} doublon(s) identifié(s) (${totalPlantDuplicates} plante(s) et ${totalVarietyDuplicates} variété(s)) ?\nChaque plante ou variété sera conservée en un exemplaire unique et propre avec toutes ses données.`,
                  isDanger: true,
                  confirmText: isCleaningAll ? "Nettoyage..." : `Nettoyer ${totalGlobalDuplicates} doublons`,
                  onConfirm: handleCleanAllDuplicates
                });
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              title="Supprimer immédiatement tous les doublons de plantes et de variétés du catalogue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCleaningAll ? 'animate-spin' : ''}`} />
              <span>{isCleaningAll ? 'Nettoyage...' : `Nettoyer ${totalGlobalDuplicates} doublon(s)`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleManualImportOrchard}
            disabled={isImporting}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Alimenter et synchroniser les 46 fruitiers et variétés relevés sur le plan du verger"
          >
            <Trees className={`w-4 h-4 text-emerald-600 ${isImporting ? 'animate-spin' : ''}`} />
            <span>{isImporting ? 'Alimentation...' : 'Fruitiers du Plan (46)'}</span>
          </button>

          <div className="flex bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => { setActiveTab("vegetables"); setSelectedHealthId(null); setIsEditing(false); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === "vegetables" ? "bg-white text-emerald-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <Leaf className="w-4 h-4" />
              Plantes & Variétés
            </button>
            <button
              onClick={() => { setActiveTab("health"); setSelectedVegId(null); setIsEditing(false); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === "health" ? "bg-white text-rose-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              Santé & Ravageurs
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar List */}
        <div className={`lg:col-span-4 space-y-4 ${(selectedVegId || selectedHealthId) ? "hidden lg:block" : "block"}`}>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder={activeTab === "vegetables" ? "Rechercher une plante..." : "Rechercher un ravageur/maladie..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            
            {activeTab === "vegetables" && (
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="">Toutes les catégories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => activeTab === "vegetables" ? handleStartEdit() : handleStartHealthEdit()}
              className={`w-full py-2 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-sm ${
                activeTab === "vegetables" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
              }`}
            >
              <Plus className="w-4 h-4" />
              {activeTab === "vegetables" ? "Ajouter une plante" : "Ajouter une fiche santé"}
            </button>

            {totalGlobalDuplicates > 0 && activeTab === "vegetables" && (
              <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-900 space-y-2.5 shadow-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-900">
                      {totalGlobalDuplicates} doublon(s) détecté(s)
                    </p>
                    <p className="text-[11px] text-amber-700 leading-tight mt-0.5">
                      {totalPlantDuplicates > 0 && `${totalPlantDuplicates} plante(s)`}
                      {totalPlantDuplicates > 0 && totalVarietyDuplicates > 0 && ' • '}
                      {totalVarietyDuplicates > 0 && `${totalVarietyDuplicates} variété(s)`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isCleaningAll}
                  onClick={() => {
                    setConfirmState({
                      isOpen: true,
                      title: "Nettoyer tous les doublons du catalogue",
                      message: `Voulez-vous supprimer les ${totalGlobalDuplicates} doublon(s) identifié(s) (${totalPlantDuplicates} plante(s) et ${totalVarietyDuplicates} variété(s)) ?\nChaque élément sera conservé en un exemplaire unique avec toutes ses données.`,
                      isDanger: true,
                      confirmText: isCleaningAll ? "Nettoyage..." : `Nettoyer ${totalGlobalDuplicates} doublons`,
                      onConfirm: handleCleanAllDuplicates
                    });
                  }}
                  className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCleaningAll ? 'animate-spin' : ''}`} />
                  <span>{isCleaningAll ? 'Nettoyage en cours...' : `Nettoyer tous les doublons (${totalGlobalDuplicates})`}</span>
                </button>
              </div>
            )}

            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {activeTab === "vegetables" ? (
                filteredPlants.map(item => {
                  const treeCount = trees?.filter((t: any) => !t.isDeleted && (t.species || '').toLowerCase().trim() === (item.name || '').toLowerCase().trim()).length || 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setSelectedVegId(item.id); setIsEditing(false); setPlantSubTab("culture"); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between group ${
                        selectedVegId === item.id ? "bg-emerald-50 text-emerald-700 font-medium" : "text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{item.name}</span>
                        {treeCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0" title={`${treeCount} arbre(s) au verger`}>
                            <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                            {treeCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 group-hover:text-emerald-500 shrink-0 ml-2">{item.category}</span>
                    </button>
                  );
                })
              ) : (
                filteredHealth.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedHealthId(item.id); setIsEditing(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between group ${
                      selectedHealthId === item.id ? "bg-rose-50 text-rose-700 font-medium" : "text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      item.type === "Ravageur" ? "bg-amber-100 text-amber-700" : 
                      item.type === "Maladie" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {item.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className={`lg:col-span-8 ${(selectedVegId || selectedHealthId || isEditing) ? "block" : "hidden lg:block"}`}>
          {(selectedVegId || selectedHealthId || isEditing) && (
            <button
              onClick={() => { setSelectedVegId(null); setSelectedHealthId(null); setIsEditing(false); }}
              className="lg:hidden mb-4 flex items-center gap-2 text-stone-500 font-medium text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour à la liste
            </button>
          )}
          {isEditing ? (
            activeTab === "vegetables" ? (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-serif font-medium text-stone-900">
                    {editForm.id ? "Modifier la plante" : "Ajouter une plante"}
                  </h2>
                  <button type="button" onClick={() => setIsEditing(false)} className="p-2 text-stone-400 hover:text-stone-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Nom de la plante</label>
                    <input
                      required
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-500 uppercase">Catégorie</label>
                      {!isCustomCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(true);
                            setCustomCategoryName('');
                          }}
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                        >
                          + Autre catégorie
                        </button>
                      )}
                    </div>
                    {isCustomCategory ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nom de la catégorie..."
                          value={customCategoryName}
                          onChange={e => {
                            setCustomCategoryName(e.target.value);
                            setEditForm({ ...editForm, category: e.target.value });
                          }}
                          className="flex-1 px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customCategoryName.trim()) {
                              const canonical = getCanonicalCategory(customCategoryName.trim(), config);
                              setEditForm({ ...editForm, category: canonical });
                            }
                            setIsCustomCategory(false);
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition-colors"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(false);
                            setCustomCategoryName('');
                          }}
                          className="p-2 text-stone-400 hover:text-stone-600 transition-colors"
                          title="Annuler"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={getCanonicalCategory(editForm.category, config) || ''}
                        onChange={e => {
                          if (e.target.value === '__new__') {
                            setIsCustomCategory(true);
                            setCustomCategoryName('');
                          } else {
                            setEditForm({ ...editForm, category: getCanonicalCategory(e.target.value, config) });
                          }
                        }}
                        className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="">Sélectionner</option>
                        {availableCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        {editForm.category && !availableCategories.some(c => areCategoriesEqual(c, editForm.category)) && (
                          <option value={editForm.category}>{editForm.category}</option>
                        )}
                        <option value="__new__">+ Ajouter une nouvelle catégorie...</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Période Semis</label>
                    <input
                      type="text"
                      placeholder="ex: Mars - Avril"
                      value={editForm.sowingPeriod}
                      onChange={e => setEditForm({ ...editForm, sowingPeriod: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Période Plantation</label>
                    <input
                      type="text"
                      placeholder="ex: Mai"
                      value={editForm.plantingPeriod}
                      onChange={e => setEditForm({ ...editForm, plantingPeriod: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Période Récolte</label>
                    <input
                      type="text"
                      placeholder="ex: Juillet - Oct"
                      value={editForm.harvestPeriod}
                      onChange={e => setEditForm({ ...editForm, harvestPeriod: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Exposition</label>
                    <select
                      value={editForm.exposure}
                      onChange={e => setEditForm({ ...editForm, exposure: e.target.value as any })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    >
                      <option>Plein soleil</option>
                      <option>Mi-ombre</option>
                      <option>Ombre</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Besoins en eau</label>
                    <select
                      value={editForm.waterNeeds}
                      onChange={e => setEditForm({ ...editForm, waterNeeds: e.target.value as any })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    >
                      <option>Faible</option>
                      <option>Moyen</option>
                      <option>Élevé</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Espacement sur plan (Ø en cm)</label>
                    <input
                      type="number"
                      placeholder="ex: 40"
                      value={editForm.spacing}
                      onChange={e => setEditForm({ ...editForm, spacing: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Prix estimé (€/kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="ex: 3.5"
                      value={editForm.pricePerKg || ""}
                      onChange={e => setEditForm({ ...editForm, pricePerKg: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Bons compagnons (séparés par virgule)</label>
                    <input
                      type="text"
                      value={editForm.goodCompanions?.join(", ")}
                      onChange={e => setEditForm({ ...editForm, goodCompanions: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Mauvais compagnons (séparés par virgule)</label>
                    <input
                      type="text"
                      value={editForm.badCompanions?.join(", ")}
                      onChange={e => setEditForm({ ...editForm, badCompanions: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-500 uppercase">Couleur</label>
                      <button
                        type="button"
                        onClick={() => {
                          const existingColors = unifiedPlants.map(p => p.color).filter(Boolean) as string[];
                          const extendedColors = [
                            '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', 
                            '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#71717a',
                            '#fbbf24', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#818cf8',
                            '#a78bfa', '#e879f9', '#fb7185', '#9ca3af', '#b45309', '#4d7c0f',
                            '#047857', '#0f766e', '#1d4ed8', '#4338ca', '#6d28d9', '#a21caf',
                            '#be123c', '#3f3f46'
                          ];
                          
                          // Convert hex to RGB for distance calculation
                          const hexToRgb = (hex: string) => {
                            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                            return result ? {
                              r: parseInt(result[1], 16),
                              g: parseInt(result[2], 16),
                              b: parseInt(result[3], 16)
                            } : { r: 0, g: 0, b: 0 };
                          };

                          const colorDistance = (c1: string, c2: string) => {
                            const rgb1 = hexToRgb(c1);
                            const rgb2 = hexToRgb(c2);
                            return Math.sqrt(
                              Math.pow(rgb1.r - rgb2.r, 2) +
                              Math.pow(rgb1.g - rgb2.g, 2) +
                              Math.pow(rgb1.b - rgb2.b, 2)
                            );
                          };

                          let bestColor = extendedColors[0];
                          let maxMinDistance = -1;

                          for (const candidate of extendedColors) {
                            let minDistance = Infinity;
                            for (const existing of existingColors) {
                              const dist = colorDistance(candidate, existing);
                              if (dist < minDistance) {
                                minDistance = dist;
                              }
                            }
                            if (minDistance > maxMinDistance) {
                              maxMinDistance = minDistance;
                              bestColor = candidate;
                            }
                          }

                          setEditForm({ ...editForm, color: bestColor });
                        }}
                        className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                      >
                        <Wand2 className="w-3 h-3" />
                        Auto
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={editForm.color || '#10b981'}
                        onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                      />
                      <div className="flex flex-wrap gap-1">
                        {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditForm({ ...editForm, color: c })}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${editForm.color === c ? 'border-stone-900 scale-110' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 col-span-1 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-500 uppercase">Icône (Emoji ou Symbole)</label>
                      <button
                        type="button"
                        onClick={() => {
                          const allEmojis = GARDEN_EMOJI_CATEGORIES.flatMap(c => c.emojis);
                          const randomEmoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
                          setEditForm({ ...editForm, icon: randomEmoji });
                        }}
                        className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                      >
                        <Wand2 className="w-3 h-3" />
                        Auto
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner overflow-hidden" style={{ background: `radial-gradient(circle at 30% 30%, ${editForm.color || '#10b981'}, ${(editForm.color || '#10b981')}dd)` }}>
                        {editForm.icon && isEmoji(editForm.icon) ? (
                          <span className="text-2xl drop-shadow-sm">{editForm.icon}</span>
                        ) : (
                          React.createElement(ICON_MAP[editForm.icon || 'Sprout'] || ICON_MAP['Sprout'], { className: "w-6 h-6 text-white drop-shadow-sm" })
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={editForm.icon || 'Sprout'}
                          onChange={e => setEditForm({ ...editForm, icon: e.target.value })}
                          className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 mb-1"
                          placeholder="Emoji libre ou nom d'icône"
                        />
                        <p className="text-[10px] text-stone-500 italic pl-1 leading-tight">
                          💡 Astuce : <b>Touche Windows + .</b> ou <b>Cmd + Ctrl + Espace</b> (Mac) pour chercher l'émoji "courgette" 🥒 !
                        </p>
                      </div>
                    </div>

                    <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 h-48 overflow-y-auto custom-scrollbar">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Minimalistes</label>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(32px,1fr))] gap-1">
                            {ICON_LIST.map(({ id, icon: Icon }) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setEditForm({ ...editForm, icon: id })}
                                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                                  editForm.icon === id 
                                    ? 'shadow-sm text-white scale-110 z-10' 
                                    : 'bg-white border-stone-200 text-stone-600 hover:border-emerald-300 hover:scale-105'
                                }`}
                                style={editForm.icon === id ? { backgroundColor: editForm.color || '#10b981', borderColor: editForm.color || '#10b981' } : {}}
                                title={id}
                              >
                                <Icon className="w-4 h-4" />
                              </button>
                            ))}
                          </div>
                        </div>

                        {GARDEN_EMOJI_CATEGORIES.map(cat => (
                          <div key={cat.id} className="space-y-2">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{cat.label}</label>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(32px,1fr))] gap-1">
                              {cat.emojis.map(emoji => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => setEditForm({ ...editForm, icon: emoji })}
                                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all bg-white border ${
                                    editForm.icon === emoji 
                                      ? 'border-emerald-500 shadow-sm scale-110 z-10' 
                                      : 'border-stone-200 hover:border-emerald-300 hover:scale-105'
                                  }`}
                                  style={editForm.icon === emoji ? { backgroundColor: `${editForm.color || '#10b981'}20` } : {}}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase">Conseils & Astuces</label>
                  <textarea
                    rows={4}
                    value={editForm.tips}
                    onChange={e => setEditForm({ ...editForm, tips: e.target.value })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={handleSave}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Enregistrer la plante
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-3 bg-stone-100 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-200 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-serif font-medium text-stone-900">
                    {healthForm.id ? "Modifier la fiche santé" : "Ajouter une fiche santé"}
                  </h2>
                  <button type="button" onClick={() => setIsEditing(false)} className="p-2 text-stone-400 hover:text-stone-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Nom</label>
                    <input
                      required
                      type="text"
                      value={healthForm.name}
                      onChange={e => setHealthForm({ ...healthForm, name: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-500 uppercase">Type</label>
                    <select
                      value={healthForm.type}
                      onChange={e => setHealthForm({ ...healthForm, type: e.target.value as any })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    >
                      <option>Ravageur</option>
                      <option>Maladie</option>
                      <option>Carence</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase">Symptômes</label>
                  <textarea
                    rows={3}
                    value={healthForm.symptoms}
                    onChange={e => setHealthForm({ ...healthForm, symptoms: e.target.value })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase">Solutions (séparées par virgule)</label>
                  <input
                    type="text"
                    value={healthForm.solutions?.join(", ")}
                    onChange={e => setHealthForm({ ...healthForm, solutions: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase">Prévention</label>
                  <textarea
                    rows={2}
                    value={healthForm.prevention}
                    onChange={e => setHealthForm({ ...healthForm, prevention: e.target.value })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase">Plantes affectées (séparées par virgule)</label>
                  <input
                    type="text"
                    value={healthForm.affectedPlants?.join(", ")}
                    onChange={e => setHealthForm({ ...healthForm, affectedPlants: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={handleSaveHealth}
                    className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Enregistrer la fiche santé
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-3 bg-stone-100 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-200 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )
          ) : activeTab === "vegetables" ? (
            selectedVeg ? (
              <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="p-6 bg-emerald-600 text-white">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full mb-2 inline-block">
                        {selectedVeg.category}
                      </span>
                      <h2 className="text-3xl font-serif font-medium">{selectedVeg.name}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {setCurrentView && (
                        <button
                          onClick={() => handlePlaceOnOrchardPlan(selectedVeg)}
                          className="px-3 py-2 bg-white/20 hover:bg-white/30 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 backdrop-blur-xs border border-white/20 shadow-xs cursor-pointer"
                          title="Intégrer / Placer un arbre de cette espèce sur le plan du verger"
                        >
                          <Trees className="w-4 h-4 text-emerald-200" />
                          <span>Placer au verger</span>
                          {plantOrchardTrees.length > 0 && (
                            <span className="bg-white/25 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                              {plantOrchardTrees.length}
                            </span>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPrintInitialPlant(exportSelectedPlantData);
                          setIsPrintModalOpen(true);
                        }}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white cursor-pointer"
                        title="Imprimer cette fiche de culture"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleStartEdit(selectedVeg)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                        title="Modifier"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(selectedVeg)}
                        className="p-2 bg-white/10 hover:bg-rose-500/40 rounded-xl transition-all"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Tabs for Plant Details */}
                  <div className="flex gap-4 mt-6 border-b border-white/20">
                    <button
                      onClick={() => setPlantSubTab("culture")}
                      className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                        plantSubTab === "culture" ? "border-white text-white" : "border-transparent text-emerald-100 hover:text-white"
                      }`}
                    >
                      Fiche Culture
                    </button>
                    <button
                      onClick={() => setPlantSubTab("varieties")}
                      className={`pb-2 text-sm font-medium transition-all border-b-2 flex items-center gap-2 ${
                        plantSubTab === "varieties" 
                          ? "border-white text-white" 
                          : "border-transparent text-emerald-100 hover:text-white"
                      }`}
                    >
                      Variétés
                      {plantVarieties.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-white/20 rounded-md text-[10px] font-bold">
                          {plantVarieties.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {plantSubTab === "culture" ? (
                  <div className="p-6 space-y-8">
                    <div className="grid grid-cols-3 gap-4 pb-6 border-b border-stone-100">
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <Sun className="w-4 h-4 text-amber-500" />
                        <span>{selectedVeg.exposure}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span>Eau : {selectedVeg.waterNeeds}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <Move className="w-4 h-4 text-stone-400" />
                        <span>{selectedVeg.spacing || "Espacement non défini"}</span>
                      </div>
                    </div>

                    {/* Calendrier */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Semis</p>
                        <p className="text-sm font-medium text-stone-800">{selectedVeg.sowingPeriod || "Non renseigné"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Plantation</p>
                        <p className="text-sm font-medium text-stone-800">{selectedVeg.plantingPeriod || "Non renseigné"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Récolte</p>
                        <p className="text-sm font-medium text-stone-800">{selectedVeg.harvestPeriod || "Non renseigné"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Prix estimé</p>
                        <p className="text-sm font-medium text-stone-800">{selectedVeg.pricePerKg ? `${selectedVeg.pricePerKg} €/kg` : "Non renseigné"}</p>
                      </div>
                    </div>

                    {/* Compagnonnage */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                          <ThumbsUp className="w-4 h-4" />
                          Bons compagnons
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedVeg.goodCompanions.length > 0 ? (
                            selectedVeg.goodCompanions.map((c, i) => (
                              <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-stone-400 italic">Aucune association connue</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                          <ThumbsDown className="w-4 h-4" />
                          Mauvais compagnons
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedVeg.badCompanions.length > 0 ? (
                            selectedVeg.badCompanions.map((c, i) => (
                              <span key={i} className="px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-medium border border-rose-100">
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-stone-400 italic">Aucune incompatibilité connue</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Conseils */}
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 space-y-2">
                      <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                        <Info className="w-4 h-4 text-stone-400" />
                        Conseils de culture
                      </h3>
                      <p className="text-sm text-stone-600 leading-relaxed italic">
                        "{selectedVeg.tips || "Aucun conseil pour le moment."}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                        <List className="w-4 h-4 text-stone-400" />
                        Variétés de {selectedVeg.name}
                      </h3>
                    </div>

                    {(!selectedVeg.configId && !selectedVeg.encyclopediaId) ? (
                      <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Veuillez d'abord modifier et enregistrer cette plante pour pouvoir lui ajouter des variétés.
                      </div>
                    ) : (
                      <>
                        <form onSubmit={handleAddVariety} className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Ajouter une variété (ex: Marmande)"
                              value={newVarietyName}
                              onChange={(e) => { setNewVarietyName(e.target.value); setVarietyError(null); }}
                              className="flex-1 px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                            <button
                              type="submit"
                              disabled={!newVarietyName.trim()}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Ajouter
                            </button>
                          </div>
                          {varietyError && (
                            <p className="text-xs text-rose-500 font-medium px-1">{varietyError}</p>
                          )}
                        </form>

                        {currentPlantDuplicateVarietyIds.length > 0 && (
                          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs shadow-sm">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                <strong>{currentPlantDuplicateVarietyIds.length}</strong> copie(s) de variété en doublon pour cette plante.
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={isCleaningPlantVarieties}
                              onClick={handleCleanPlantDuplicateVarieties}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg font-semibold transition-all text-xs shrink-0 shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isCleaningPlantVarieties ? 'animate-spin' : ''}`} />
                              <span>{isCleaningPlantVarieties ? 'Nettoyage...' : `Nettoyer les doublons (${currentPlantDuplicateVarietyIds.length})`}</span>
                            </button>
                          </div>
                        )}

                        {selectedPlantSimilarGroups.length > 0 && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs shadow-xs gap-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                <strong>{selectedPlantSimilarGroups.length} groupe(s) de variantes ou orthographes proches</strong> détecté(s) pour {selectedVeg.name}.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setDuplicateModalPlantFilter(selectedVeg.name);
                                setIsDuplicateModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg font-semibold transition-all text-xs shrink-0 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Examiner & Fusionner</span>
                            </button>
                          </div>
                        )}

                        <div className="space-y-2">
                          {plantVarieties.length === 0 ? (
                            <p className="text-sm text-stone-500 italic text-center py-4">Aucune variété enregistrée pour cette plante.</p>
                          ) : (
                            plantVarieties.map(variety => (
                              <div key={variety.id} className="bg-stone-50 rounded-xl border border-stone-100 overflow-hidden">
                                {editingVarietyId === variety.id ? (
                                  <form onSubmit={handleSaveVariety} className="p-4 space-y-4">
                                    <div>
                                      <label className="block text-xs font-medium text-stone-500 mb-1">Nom de la variété</label>
                                      <input
                                        type="text"
                                        value={varietyEditForm.name}
                                        onChange={e => setVarietyEditForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                        required
                                      />
                                    </div>
                                    
                                    {varietyAttrTypes.map(attrType => {
                                      const options = varietyOptions.filter(o => o.parentId === attrType.id);
                                      const isEmoji = attrType.value.toLowerCase().includes('emoji');

                                      return (
                                        <div key={attrType.id} className="space-y-1">
                                          <div className="flex items-center justify-between">
                                            <label className="block text-xs font-medium text-stone-500">{attrType.value}</label>
                                            {isEmoji && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (isEmoji) {
                                                    const allEmojis = GARDEN_EMOJI_CATEGORIES.flatMap(c => c.emojis);
                                                    const randomEmoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
                                                    setVarietyEditForm(prev => ({
                                                      ...prev,
                                                      attributes: { ...prev.attributes, [attrType.id]: randomEmoji }
                                                    }));
                                                  }
                                                }}
                                                className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                                              >
                                                <Wand2 className="w-3 h-3" />
                                                Auto
                                              </button>
                                            )}
                                          </div>
                                          
                                          {isEmoji ? (
                                            <div className="space-y-2">
                                              <div className="flex flex-wrap gap-1 p-2 bg-white border border-stone-200 rounded-lg max-h-32 overflow-y-auto">
                                                {GARDEN_EMOJI_CATEGORIES.map(cat => (
                                                  <div key={cat.id} className="w-full mb-1">
                                                    <div className="text-[10px] text-stone-400 mb-1">{cat.label}</div>
                                                    <div className="flex flex-wrap gap-1">
                                                      {cat.emojis.slice(0, 15).map(emoji => (
                                                        <button
                                                          key={emoji}
                                                          type="button"
                                                          onClick={() => setVarietyEditForm(prev => ({
                                                            ...prev,
                                                            attributes: { ...prev.attributes, [attrType.id]: emoji }
                                                          }))}
                                                          className={`w-7 h-7 flex items-center justify-center rounded hover:bg-stone-100 transition-colors ${varietyEditForm.attributes[attrType.id] === emoji ? 'bg-emerald-100 ring-1 ring-emerald-500' : ''}`}
                                                        >
                                                          {emoji}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                              <input
                                                type="text"
                                                value={varietyEditForm.attributes[attrType.id] || ''}
                                                onChange={e => setVarietyEditForm(prev => ({
                                                  ...prev,
                                                  attributes: { ...prev.attributes, [attrType.id]: e.target.value }
                                                }))}
                                                placeholder="Ou saisir un emoji..."
                                                className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm"
                                              />
                                            </div>
                                          ) : (
                                            <>
                                              <input
                                                type="text"
                                                list={`options-${attrType.id}`}
                                                value={varietyEditForm.attributes[attrType.id] || ''}
                                                onChange={e => setVarietyEditForm(prev => ({
                                                  ...prev,
                                                  attributes: { ...prev.attributes, [attrType.id]: e.target.value }
                                                }))}
                                                placeholder={`Sélectionner ou saisir des options (séparées par des virgules)`}
                                                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                              />
                                              <datalist id={`options-${attrType.id}`}>
                                                {options.map(opt => (
                                                  <option key={opt.id} value={opt.value} />
                                                ))}
                                              </datalist>
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}
                                    
                                    <div className="flex justify-end gap-2 pt-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingVarietyId(null)}
                                        className="px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-200 bg-stone-100 rounded-lg transition-colors"
                                      >
                                        Annuler
                                      </button>
                                      <button
                                        type="submit"
                                        className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                                      >
                                        Enregistrer
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <div className="flex items-center justify-between p-3 gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium text-stone-700 block">{variety.value}</span>
                                        {(() => {
                                          const varietyTreesCount = getVarietyTreeCount(variety.value);
                                          if (varietyTreesCount > 0) {
                                            return (
                                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200" title={`${varietyTreesCount} arbre(s) de cette variété sur le plan du verger`}>
                                                <MapPin className="w-3 h-3 text-emerald-600" />
                                                {varietyTreesCount} sur le plan
                                              </span>
                                            );
                                          }
                                          return (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full border border-stone-200">
                                              <MapPinOff className="w-2.5 h-2.5" />
                                              Non placé
                                            </span>
                                          );
                                        })()}
                                        {duplicateVarietyKeys.has((variety.value || '').trim().toLowerCase()) && (
                                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                            Doublon
                                          </span>
                                        )}
                                      </div>
                                      {variety.attributes && Object.keys(variety.attributes).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {Object.entries(variety.attributes).map(([key, val]) => {
                                            const attrType = varietyAttrTypes.find(t => t.id === key);
                                            if (!attrType || !val) return null;
                                            const isColor = attrType.value.toLowerCase().includes('couleur');
                                            const isEmoji = attrType.value.toLowerCase().includes('emoji');
                                            
                                            if (isColor) {
                                              return (
                                                <span key={key} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-stone-200 text-stone-600 rounded">
                                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: val as string }} />
                                                  {val as string}
                                                </span>
                                              );
                                            }
                                            if (isEmoji) {
                                              return (
                                                <span key={key} className="text-sm" title={attrType.value}>
                                                  {val as string}
                                                </span>
                                              );
                                            }
                                            return (
                                              <span key={key} className="text-[10px] px-1.5 py-0.5 bg-stone-200 text-stone-600 rounded">
                                                {attrType.value}: {val as string}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {setCurrentView && (
                                        <button
                                          type="button"
                                          onClick={() => handlePlaceOnOrchardPlan(selectedVeg, variety.value)}
                                          className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 hover:border-emerald-600 rounded-lg transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                          title={`Placer un exemplaire de ${selectedVeg.name} (${variety.value}) sur le plan du verger`}
                                        >
                                          <MapPin className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">Placer sur le plan</span>
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          setEditingVarietyId(variety.id);
                                          setVarietyEditForm({ name: variety.value, attributes: variety.attributes || {} });
                                        }}
                                        className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Modifier la variété"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteVariety(variety.id)}
                                        className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Supprimer la variété"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 bg-white rounded-2xl shadow-sm border border-stone-200/60 p-12 text-center">
                <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-serif">Sélectionnez une plante pour voir ses détails</p>
                <p className="text-sm mt-2">Ou utilisez la recherche pour trouver une plante spécifique</p>
              </div>
            )
          ) : (
            selectedHealth ? (
              <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className={`p-6 text-white ${
                  selectedHealth.type === "Ravageur" ? "bg-amber-600" : 
                  selectedHealth.type === "Maladie" ? "bg-rose-600" : "bg-blue-600"
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full mb-2 inline-block">
                        {selectedHealth.type}
                      </span>
                      <h2 className="text-3xl font-serif font-medium">{selectedHealth.name}</h2>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartHealthEdit(selectedHealth)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                        title="Modifier"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteHealth(selectedHealth.id)}
                        className="p-2 bg-white/10 hover:bg-rose-500/40 rounded-xl transition-all"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-8">
                  {/* Symptômes */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Symptômes & Identification
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-100">
                      {selectedHealth.symptoms || "Non renseigné"}
                    </p>
                  </div>

                  {/* Solutions */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Solutions Naturelles
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedHealth.solutions.length > 0 ? (
                        selectedHealth.solutions.map((s, i) => (
                          <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-stone-400 italic">Aucune solution renseignée</span>
                      )}
                    </div>
                  </div>

                  {/* Prévention */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Prévention
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed italic">
                      {selectedHealth.prevention || "Non renseigné"}
                    </p>
                  </div>

                  {/* Plantes affectées */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                      <Bug className="w-4 h-4 text-stone-400" />
                      Plantes sensibles
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedHealth.affectedPlants.length > 0 ? (
                        selectedHealth.affectedPlants.map((p, i) => (
                          <span key={i} className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-medium border border-stone-200">
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-stone-400 italic">Non spécifié</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 bg-white rounded-2xl shadow-sm border border-stone-200/60 p-12 text-center">
                <Stethoscope className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-serif">Sélectionnez une fiche santé pour voir les détails</p>
                <p className="text-sm mt-2">Identifiez les ravageurs et maladies de votre potager</p>
              </div>
            )
          )}
        </div>
      </div>

      <DuplicateDetectorModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        config={config}
        encyclopedia={encyclopedia}
        trees={trees}
        seedlings={seedlings}
        initialPlantFilter={duplicateModalPlantFilter}
        onSuccessToast={(msg) => {
          setSuccessToast(msg);
          setTimeout(() => setSuccessToast(null), 6000);
        }}
      />

      <DeletePlantModal
        isOpen={isDeletePlantModalOpen}
        onClose={() => {
          setIsDeletePlantModalOpen(false);
          setPlantToDelete(null);
        }}
        plant={plantToDelete}
        allPlants={unifiedPlants}
        trees={trees}
        seedlings={seedlings}
        config={config}
        encyclopedia={encyclopedia}
        onDeleted={(plantName, actionDesc) => {
          if (selectedVegId && (selectedVeg?.name?.toLowerCase().trim() === plantName.toLowerCase().trim())) {
            setSelectedVegId(null);
          }
          setSuccessToast(`Plante « ${plantName} » ${actionDesc}.`);
          setTimeout(() => setSuccessToast(null), 6000);
        }}
      />

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText={confirmState.confirmText || "Confirmer"}
      />

      <PlantCatalogExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        plants={exportPlantsData}
        filteredPlants={exportFilteredPlantsData}
        selectedPlant={exportSelectedPlantData}
        healthIssues={exportHealthData}
        attributeTypes={varietyAttrTypes}
        activeFilterCategory={filterCategory}
        searchTerm={searchTerm}
      />

      <PlantCatalogPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        plants={exportPlantsData}
        filteredPlants={exportFilteredPlantsData}
        selectedPlant={printInitialPlant || exportSelectedPlantData}
        healthIssues={exportHealthData}
        activeFilterCategory={filterCategory}
        searchTerm={searchTerm}
      />

      {importReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Trees className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-medium text-stone-900">Alimentation des Fruitiers du Verger</h3>
                  <p className="text-xs text-stone-500">Plan aérien du verger (Catégorie : Arbre fruitier)</p>
                </div>
              </div>
              <button
                onClick={() => setImportReportModal(null)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <p className="text-xs text-emerald-600 font-medium">Espèces ajoutées</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{importReportModal.speciesAdded}</p>
                </div>
                <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl">
                  <p className="text-xs text-teal-600 font-medium">Variétés ajoutées</p>
                  <p className="text-2xl font-bold text-teal-700 mt-1">{importReportModal.varietiesAdded}</p>
                </div>
              </div>

              {importReportModal.alreadyExistingCount > 0 && (
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center gap-2 text-xs text-stone-600">
                  <ShieldCheck className="w-4 h-4 text-stone-500 shrink-0" />
                  <span><strong>{importReportModal.alreadyExistingCount}</strong> élément(s) déjà présent(s) ignoré(s) pour garantir zéro doublon.</span>
                </div>
              )}

              {importReportModal.speciesNamesAdded.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">Espèces fruitières créées</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {importReportModal.speciesNamesAdded.map((name, i) => (
                      <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs rounded-lg font-medium">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {importReportModal.varietiesNamesAdded.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">Variétés ajoutées</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {importReportModal.varietiesNamesAdded.map((name, i) => (
                      <div key={i} className="text-xs text-stone-600 bg-stone-50 px-2.5 py-1 rounded-md border border-stone-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setFilterCategory('Arbre fruitier');
                  setImportReportModal(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl shadow-sm transition-colors"
              >
                Filtrer sur les Arbres fruitiers
              </button>
              <button
                type="button"
                onClick={() => setImportReportModal(null)}
                className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium rounded-xl transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
