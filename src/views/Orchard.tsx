import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Tree, Note, NoteUpdate, Structure, ConfigItem } from '../db';
import { useFirebaseData, fb } from '../hooks/useFirebaseData';
import { StructureEditor } from '../components/StructureEditor';
import { 
  Trees, Plus, Map as MapIcon, Image as ImageIcon, Trash2, Edit2, 
  Camera, CheckCircle2, XCircle, Sprout, Leaf, Flower2, Apple, Grape, Carrot, 
  Cherry, Citrus, Wheat, Shrub, Palmtree, TreePine, List, Printer, 
  Home, Square, Save, X, Palette, ZoomIn, ZoomOut, Magnet, Lock, Unlock,
  MousePointer2, MapPin, Grid3X3, Ruler, MapPinOff, Search, Sparkles,
  BookOpen, ChevronDown, ChevronUp, Check, ExternalLink, Filter, Layers, Info, History,
  AlertTriangle, ArrowRight, Link2
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmModal } from '../components/Modals';
import { NoteFollowUpModal } from '../components/NoteFollowUpModal';
import { ICON_MAP, ICON_LIST, GARDEN_EMOJIS, isEmoji, GARDEN_EMOJI_CATEGORIES } from '../constants';
import { printElement } from '../utils/print';
import { getDistinctColor } from '../utils/colors';
import { compressImage } from '../utils/image';
import { getCanonicalCategory, normalizeCategoryKey, isPlantEnabledForOrchardPlan } from '../utils/categories';
import { computeVarietySimilarity } from '../utils/fuzzyMatching';
import { getVarietyPlantings } from '../utils/varietyPlantings';
import { getSortedUpdates, getNoteLatestDate, formatDateShortFR, parseSafeDate } from '../utils/notes';

export function Orchard({ setCurrentView }: { setCurrentView?: (view: string) => void } = {}) {
  const { data: config, error: configError } = useFirebaseData<any>('config');
  const terrains = useMemo(() => {
    return (config || []).filter((t:any) => t.type === 'terrain').sort((a:any, b:any) => String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: 'base' })) || [];
  }, [config]);

  const { data: rawTrees, error: treesError } = useFirebaseData<any>('trees');
  const trees = rawTrees;
  const { data: structures, error: structuresError } = useFirebaseData<any>('structures');
  const { data: encyclopedia, error: encError } = useFirebaseData<any>('encyclopedia');

  const error = configError || treesError || structuresError || encError;

  const [selectedTerrainId, setSelectedTerrainId] = useState<string>(() => localStorage.getItem('orchard_selected_terrain') || '');
  const [viewMode, setViewMode] = useState<'plan' | 'list'>('plan');
  const [zoom, setZoom] = useState<number>(() => {
    const savedZoom = localStorage.getItem('orchard_zoom');
    return savedZoom ? parseFloat(savedZoom) : 2;
  }); // 1cm = 2px by default
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [isPlanLocked, setIsPlanLocked] = useState<boolean>(true);
  const [toolMode, setToolMode] = useState<'select' | 'add'>('select');
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureStart, setMeasureStart] = useState<{x: number, y: number} | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCoordinates, setShowCoordinates] = useState<boolean>(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(GARDEN_EMOJI_CATEGORIES[0].id);
  const [printScale, setPrintScale] = useState<number>(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasDraggingRef = useRef(false);
  
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [isAddingTree, setIsAddingTree] = useState(false);
  const [isEditingTree, setIsEditingTree] = useState(false);
  const [isMovingTree, setIsMovingTree] = useState(false);
  const [isCopyingTree, setIsCopyingTree] = useState(false);
  const [followUpNoteId, setFollowUpNoteId] = useState<string | null>(null);
  const [draggingTreeId, setDraggingTreeId] = useState<string | null>(null);
  const [draggingStructureId, setDraggingStructureId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [dragStartMousePos, setDragStartMousePos] = useState<{ x: number, y: number } | null>(null);
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);
  const [newTree, setNewTree] = useState<any>({
    species: '',
    color: '#10b981',
    icon: 'Trees'
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showSpeciesCustomization, setShowSpeciesCustomization] = useState(false);
  const [pendingPlacementNotice, setPendingPlacementNotice] = useState<string | null>(null);
  const [showReattachPanel, setShowReattachPanel] = useState(false);
  const [reattachSpecies, setReattachSpecies] = useState('');
  const [reattachVariety, setReattachVariety] = useState('');
  const [reattachFeedback, setReattachFeedback] = useState<string | null>(null);
  const [toPlaceSearch, setToPlaceSearch] = useState('');

  // List view specific states
  const [listSearch, setListSearch] = useState('');
  const [listFilterStatus, setListFilterStatus] = useState<'all' | 'placed' | 'unplaced'>('all');
  const [listLayout, setListLayout] = useState<'catalog' | 'table'>('catalog');
  const [expandedSpecies, setExpandedSpecies] = useState<Record<string, boolean>>({});

  const [isAddingStructure, setIsAddingStructure] = useState(false);
  const [newStructure, setNewStructure] = useState<{ name: string, type: string, color: string, width: number, height: number, icon?: string }>({
    name: '',
    type: 'building',
    color: '#78716c',
    width: 200,
    height: 200,
    icon: 'Home'
  });

  const [editingTreeId, setEditingTreeId] = useState<string | null>(null);
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  const [editTreeData, setEditTreeData] = useState<any>(null);

  // Notes state
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePhotos, setNewNotePhotos] = useState<string[]>([]);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const selectedTerrain = useMemo(() => terrains?.find(t => t.id === selectedTerrainId), [terrains, selectedTerrainId]);
  const treesInCurrentTerrain = useMemo(() => {
    const filtered = trees?.filter(t => !t.isDeleted && t.terrainId === selectedTerrainId) || [];
    return Array.from(new Map<string, any>(filtered.map(t => [t.id, t])).values());
  }, [trees, selectedTerrainId]);

  const orphanPlacedTrees = useMemo(() => {
    if (!trees || !terrains || terrains.length === 0) return [];
    const validTerrainIds = new Set(terrains.map((t: any) => t.id));
    return trees.filter(
      (t: any) =>
        !t.isDeleted &&
        t.status !== 'planned' &&
        t.positionX !== undefined &&
        (!t.terrainId || !validTerrainIds.has(t.terrainId))
    );
  }, [trees, terrains]);

  const placedTrees = useMemo(() => treesInCurrentTerrain.filter((t: any) => t.status !== "planned" && t.positionX !== undefined), [treesInCurrentTerrain]);

  const plannedTrees = useMemo(() => trees?.filter((t: any) => t.status === "planned" && !t.isDeleted) || [], [trees]);
  const structuresInCurrentTerrain = useMemo(() => {
    const filtered = structures?.filter(s => s.terrainId === selectedTerrainId) || [];
    return Array.from(new Map<string, any>(filtered.map(s => [s.id, s])).values());
  }, [structures, selectedTerrainId]);

  const getCatalogVarietyObjectsForSpecies = (species: string) => {
    const varieties = new Map<string, any>();
    const speciesLower = (species || '').toLowerCase().trim();
    if (!speciesLower) return [];

    const encEntry = encyclopedia?.find((e: any) => (e.name || '').toLowerCase().trim() === speciesLower);
    const configVeg = config?.find((c: any) => c.type === 'vegetable' && (c.value || '').toLowerCase().trim() === speciesLower);

    if (config) {
      config.forEach((c: any) => {
        if (c.type === 'variety' && (
          (encEntry && c.parentId === encEntry.id) ||
          (configVeg && c.parentId === configVeg.id)
        )) {
          const val = (c.value || '').trim();
          if (val && !varieties.has(val.toLowerCase())) {
            varieties.set(val.toLowerCase(), c);
          }
        }
      });
    }

    return Array.from(varieties.values()).sort((a, b) =>
      String(a.value || '').localeCompare(String(b.value || ''), undefined, { numeric: true, sensitivity: 'base' })
    );
  };

  const getCatalogVarietiesForSpecies = (species: string) => {
    return getCatalogVarietyObjectsForSpecies(species).map((v: any) => String(v.value || '').trim());
  };

  const getVarietiesForSpecies = (species: string) => {
    const varieties = new Map<string, string>();
    for (const v of getCatalogVarietiesForSpecies(species)) {
      varieties.set(v.toLowerCase(), v);
    }

    const speciesLower = (species || '').toLowerCase().trim();
    if (speciesLower && trees) {
      trees.forEach((t: any) => {
        if (!t.isDeleted && (t.species || '').toLowerCase().trim() === speciesLower && t.variety && t.variety.trim()) {
          const v = t.variety.trim();
          if (!varieties.has(v.toLowerCase())) {
            varieties.set(v.toLowerCase(), v);
          }
        }
      });
    }

    return Array.from(varieties.values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  };

  // Check if a plant was requested to be placed from the Encyclopedia / Catalog
  useEffect(() => {
    const raw = localStorage.getItem('orchard_pending_placement');
    if (raw) {
      try {
        const item = JSON.parse(raw);
        if (item.species) {
          setViewMode('plan');
          setToolMode('add');
          setIsAddingTree(true);
          setSelectedTreeId(null);
          setIsEditingTree(false);
          const defaultX = Math.round((selectedTerrain?.attributes?.width || 800) / 2);
          const defaultY = Math.round((selectedTerrain?.attributes?.height || 600) / 2);

          setNewTree({
            species: item.species,
            variety: item.variety || '',
            encyclopediaId: item.encyclopediaId || undefined,
            varietyId: item.varietyId || undefined,
            datePlanted: item.datePlanted || '',
            color: item.color || '#10b981',
            icon: item.icon || 'Trees',
            spacing: item.spacing || 200,
            positionX: defaultX,
            positionY: defaultY
          });
          setPendingPlacementNotice(`🌿 Placement de "${item.species}${item.variety ? ` (${item.variety})` : ''}" : Cliquez sur l'emplacement de votre choix sur le plan.`);
          localStorage.removeItem('orchard_pending_placement');
        }
      } catch (err) {
        console.error('Failed to parse orchard_pending_placement:', err);
      }
    }
  }, [selectedTerrain]);

  // Master Fruit Tree Catalog (Strictly from Catalog entries whose category has "Placement sur plan" enabled in Config)
  const catalogOrchardSpecies = useMemo(() => {
    const speciesMap = new Map<string, {
      id: string;
      name: string;
      category: string;
      color: string;
      icon: string;
      spacing: number;
      encyclopediaId?: string;
      configId?: string;
      rawEncyclopedia?: any;
    }>();

    // 1. From Encyclopedia (filtered by Config category placement setting)
    encyclopedia?.forEach((e: any) => {
      const rawCats: string[] = Array.isArray(e.categories) && e.categories.length > 0
        ? e.categories
        : [e.category || 'Légume'];
      const canonicalCats = rawCats.map((c: string) => getCanonicalCategory(c, config));
      const cat = canonicalCats[0] || 'Légume';

      if (isPlantEnabledForOrchardPlan({ category: cat, categories: canonicalCats }, config)) {
        const name = (e.name || '').trim();
        if (name) {
          speciesMap.set(name.toLowerCase(), {
            id: e.id,
            name,
            category: cat,
            color: e.color || '#10b981',
            icon: e.icon || 'Trees',
            spacing: parseInt(e.spacing) || 200,
            encyclopediaId: e.id,
            rawEncyclopedia: e
          });
        }
      }
    });

    // 2. From Config vegetables not yet in Encyclopedia (only if category is enabled for plan placement)
    config?.filter((c: any) => c.type === 'vegetable').forEach((c: any) => {
      const cat = getCanonicalCategory(c.attributes?.category || 'Légume', config);
      if (isPlantEnabledForOrchardPlan({ category: cat }, config)) {
        const name = (c.value || '').trim();
        if (name && !speciesMap.has(name.toLowerCase())) {
          speciesMap.set(name.toLowerCase(), {
            id: c.id,
            name,
            category: cat,
            color: c.attributes?.color || '#10b981',
            icon: c.attributes?.icon || 'Trees',
            spacing: c.attributes?.spacing || 200,
            configId: c.id
          });
        }
      }
    });

    return Array.from(speciesMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [encyclopedia, config]);

  const fruitTreeCatalog = catalogOrchardSpecies;

  const getTreeCatalogLinkInfo = (tree: any) => {
    const rawSpecies = (tree?.species || '').trim();
    const rawVariety = (tree?.variety || '').trim();
    const speciesLower = rawSpecies.toLowerCase();
    const varietyLower = rawVariety.toLowerCase();

    const matchedEnc =
      (tree?.encyclopediaId
        ? encyclopedia?.find((e: any) => e.id === tree.encyclopediaId)
        : undefined) ||
      encyclopedia?.find((e: any) => (e.name || '').toLowerCase().trim() === speciesLower);

    const matchedConfigVeg = !matchedEnc
      ? config?.find((c: any) => c.type === 'vegetable' && (c.value || '').toLowerCase().trim() === speciesLower)
      : undefined;

    const catalogEntry = matchedEnc || (matchedConfigVeg
      ? {
          id: matchedConfigVeg.id,
          name: matchedConfigVeg.value,
          category: matchedConfigVeg.attributes?.category || 'Légume',
          categories: [matchedConfigVeg.attributes?.category || 'Légume'],
        }
      : null);

    if (!catalogEntry) {
      return {
        status: 'legacy' as const,
        reason: `Espèce « ${rawSpecies || 'Non définie'} » absente du Catalogue des Plantes.`,
        matchedEnc: null,
        matchedVar: null,
        catalogVarieties: [] as any[],
        isCategoryAllowed: false,
      };
    }

    const rawCats: string[] = Array.isArray(catalogEntry.categories) && catalogEntry.categories.length > 0
      ? catalogEntry.categories
      : [catalogEntry.category || 'Légume'];
    const canonicalCats = rawCats.map((c: string) => getCanonicalCategory(c, config));
    const isCategoryAllowed = isPlantEnabledForOrchardPlan(
      { category: canonicalCats[0], categories: canonicalCats },
      config
    );

    const catalogVarieties = getCatalogVarietyObjectsForSpecies(catalogEntry.name);

    if (!isCategoryAllowed) {
      return {
        status: 'category_disabled' as const,
        reason: `Catégorie « ${canonicalCats[0]} » désactivée pour le placement sur plan (Configuration > Catégories).`,
        matchedEnc: catalogEntry,
        matchedVar: null,
        catalogVarieties,
        isCategoryAllowed: false,
      };
    }

    const matchedVar = rawVariety
      ? (tree?.varietyId
          ? catalogVarieties.find(
              (v: any) =>
                v.id === tree.varietyId &&
                (v.value || '').toLowerCase().trim() === varietyLower
            )
          : undefined) ||
        catalogVarieties.find((v: any) => (v.value || '').toLowerCase().trim() === varietyLower)
      : undefined;

    if (rawVariety && !matchedVar) {
      return {
        status: 'legacy' as const,
        reason: `Variété « ${rawVariety} » absente du catalogue pour ${catalogEntry.name}.`,
        matchedEnc: catalogEntry,
        matchedVar: null,
        catalogVarieties,
        isCategoryAllowed: true,
      };
    }

    if (!rawVariety && catalogVarieties.length > 0) {
      return {
        status: 'legacy' as const,
        reason: `Aucune variété attribuée (${catalogVarieties.length} variété(s) disponible(s) dans le catalogue).`,
        matchedEnc: catalogEntry,
        matchedVar: null,
        catalogVarieties,
        isCategoryAllowed: true,
      };
    }

    return {
      status: 'catalog' as const,
      reason: rawVariety
        ? `Lié à ${catalogEntry.name} → ${matchedVar?.value || rawVariety}`
        : `Lié à la fiche ${catalogEntry.name} (aucune variété définie au catalogue)`,
      matchedEnc: catalogEntry,
      matchedVar: matchedVar || null,
      catalogVarieties,
      isCategoryAllowed: true,
    };
  };

  // Total varieties count across all fruit tree species
  const totalCatalogVarieties = useMemo(() => {
    let count = 0;
    fruitTreeCatalog.forEach(species => {
      const vars = getVarietiesForSpecies(species.name);
      count += vars.length;
    });
    return count;
  }, [fruitTreeCatalog, config, trees, encyclopedia]);

  // Counts of species on current terrain vs not
  const speciesOnPlanCount = useMemo(() => {
    return fruitTreeCatalog.filter(species => {
      return treesInCurrentTerrain.some(t => (t.species || '').toLowerCase().trim() === species.name.toLowerCase().trim());
    }).length;
  }, [fruitTreeCatalog, treesInCurrentTerrain]);

  const speciesNotOnPlanCount = useMemo(() => {
    return Math.max(0, fruitTreeCatalog.length - speciesOnPlanCount);
  }, [fruitTreeCatalog.length, speciesOnPlanCount]);

  // Filtered fruit tree catalog based on user search & status filter
  const filteredCatalogSpecies = useMemo(() => {
    const q = (listSearch || '').toLowerCase().trim();
    return fruitTreeCatalog.filter(species => {
      const speciesNameLower = species.name.toLowerCase();
      const varieties = getVarietiesForSpecies(species.name);
      const matchesSearch = !q || 
        speciesNameLower.includes(q) || 
        varieties.some(v => v.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const placedCount = treesInCurrentTerrain.filter((t: any) => 
        (t.species || '').toLowerCase().trim() === speciesNameLower
      ).length;

      if (listFilterStatus === 'placed') return placedCount > 0;
      if (listFilterStatus === 'unplaced') return placedCount === 0;
      return true;
    });
  }, [fruitTreeCatalog, listSearch, listFilterStatus, treesInCurrentTerrain, config, trees, encyclopedia]);

  // Helper to place a tree directly from the catalog into the plan
  const handleStartPlaceTreeOnPlan = (
    speciesData: { name: string; encyclopediaId?: string; color?: string; icon?: string; spacing?: number },
    varietyName: string = '',
    varietyId?: string,
    datePlanted?: string
  ) => {
    setViewMode('plan');
    setToolMode('add');
    setIsAddingTree(true);
    setSelectedTreeId(null);
    setIsEditingTree(false);

    const catalogVars = getCatalogVarietyObjectsForSpecies(speciesData.name);
    const resolvedVarObj = varietyId
      ? catalogVars.find((v: any) => v.id === varietyId)
      : varietyName
        ? catalogVars.find((v: any) => (v.value || '').toLowerCase().trim() === varietyName.toLowerCase().trim())
        : undefined;
    const varPlantings = resolvedVarObj ? getVarietyPlantings(resolvedVarObj.attributes) : [];
    const resolvedDate =
      datePlanted ||
      varPlantings.find((p) => p.datePlanted)?.datePlanted ||
      resolvedVarObj?.attributes?.datePlanted ||
      '';

    const defaultX = Math.round((selectedTerrain?.attributes?.width || 800) / 2);
    const defaultY = Math.round((selectedTerrain?.attributes?.height || 600) / 2);

    setNewTree({
      species: speciesData.name,
      variety: resolvedVarObj?.value || varietyName,
      encyclopediaId: speciesData.encyclopediaId || undefined,
      varietyId: resolvedVarObj?.id || varietyId || undefined,
      datePlanted: resolvedDate,
      color: speciesData.color || '#10b981',
      icon: speciesData.icon || 'Trees',
      spacing: speciesData.spacing || 200,
      positionX: defaultX,
      positionY: defaultY
    });

    const displayVar = resolvedVarObj?.value || varietyName;
    setPendingPlacementNotice(`🌿 Vous placez "${speciesData.name}${displayVar ? ` (${displayVar})` : ''}". Cliquez sur le terrain pour fixer son emplacement.`);
  };

  const handleLocateTreeOnPlan = (tree: any) => {
    setSelectedTreeId(tree.id);
    setViewMode('plan');
    setToolMode('select');
    if (containerRef.current && containerRef.current.parentElement) {
      const parent = containerRef.current.parentElement;
      const targetLeft = (tree.positionX * zoom) - (parent.clientWidth / 2);
      const targetTop = (tree.positionY * zoom) - (parent.clientHeight / 2);
      parent.scrollTo({
        left: Math.max(0, targetLeft),
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      });
    }
  };

  const handleEditTreeFromList = (tree: any) => {
    setSelectedTreeId(tree.id);
    setEditingTreeId(tree.id);
    const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree.species || '').toLowerCase().trim());
    setEditTreeData({
      ...tree,
      color: tree.color || encEntry?.color || '#10b981',
      icon: tree.icon || encEntry?.icon || 'Trees'
    });
    setIsEditingTree(true);
    setViewMode('plan');
  };

  // Set default terrain if none selected (prefer terrain that contains trees)
  useEffect(() => {
    if (terrains && terrains.length > 0) {
      const terrainExists = terrains.some(t => t.id === selectedTerrainId);
      if (!selectedTerrainId || !terrainExists) {
        const terrainWithTrees = terrains.find(tr =>
          trees?.some((t: any) => !t.isDeleted && t.terrainId === tr.id)
        );
        setSelectedTerrainId((terrainWithTrees || terrains[0]).id);
      }
    }
  }, [terrains, selectedTerrainId, trees]);

  useEffect(() => {
    if (selectedTerrainId) {
      localStorage.setItem('orchard_selected_terrain', selectedTerrainId);
    }
  }, [selectedTerrainId]);

  // Persist zoom
  useEffect(() => {
    localStorage.setItem('orchard_zoom', zoom.toString());
  }, [zoom]);

  const terrainBounds = useMemo(() => {
    if (selectedTerrain?.attributes?.shape === 'polygon' && Array.isArray(selectedTerrain.attributes?.points) && selectedTerrain.attributes.points.length > 0) {
      const points = selectedTerrain.attributes.points;
      return {
        minX: Math.min(...points.map((p: any) => p.x)),
        maxX: Math.max(...points.map((p: any) => p.x)),
        minY: Math.min(...points.map((p: any) => p.y)),
        maxY: Math.max(...points.map((p: any) => p.y))
      };
    }
    return {
      minX: 0,
      maxX: selectedTerrain?.attributes?.width || 1000,
      minY: 0,
      maxY: selectedTerrain?.attributes?.height || 1000
    };
  }, [selectedTerrain]);

  const getTerrainBoundsAtPoint = (cmX: number, cmY: number) => {
    if (selectedTerrain?.attributes?.shape === 'polygon' && Array.isArray(selectedTerrain.attributes?.points) && selectedTerrain.attributes.points.length > 2) {
      const points = selectedTerrain.attributes.points as {x: number, y: number}[];
      
      let minX = terrainBounds.minX;
      let maxX = terrainBounds.maxX;
      let minY = terrainBounds.minY;
      let maxY = terrainBounds.maxY;

      // Find horizontal intersections (x values at y = cmY)
      const xIntersects: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        if ((p1.y <= cmY && p2.y > cmY) || (p2.y <= cmY && p1.y > cmY)) {
          const intersectX = p1.x + (cmY - p1.y) * (p2.x - p1.x) / (p2.y - p1.y);
          xIntersects.push(intersectX);
        } else if (p1.y === cmY && p2.y === cmY) {
          xIntersects.push(p1.x, p2.x);
        }
      }
      xIntersects.sort((a, b) => a - b);
      
      // Find the segment containing cmX
      let foundX = false;
      for (let i = 0; i < xIntersects.length; i += 2) {
        if (xIntersects[i+1] !== undefined && cmX >= xIntersects[i] && cmX <= xIntersects[i+1]) {
          minX = xIntersects[i];
          maxX = xIntersects[i+1];
          foundX = true;
          break;
        }
      }
      if (!foundX && xIntersects.length >= 2) {
        minX = xIntersects[0];
        maxX = xIntersects[xIntersects.length - 1];
      }

      // Find vertical intersections (y values at x = cmX)
      const yIntersects: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        if ((p1.x <= cmX && p2.x > cmX) || (p2.x <= cmX && p1.x > cmX)) {
          const intersectY = p1.y + (cmX - p1.x) * (p2.y - p1.y) / (p2.x - p1.x);
          yIntersects.push(intersectY);
        } else if (p1.x === cmX && p2.x === cmX) {
          yIntersects.push(p1.y, p2.y);
        }
      }
      yIntersects.sort((a, b) => a - b);
      
      let foundY = false;
      for (let i = 0; i < yIntersects.length; i += 2) {
        if (yIntersects[i+1] !== undefined && cmY >= yIntersects[i] && cmY <= yIntersects[i+1]) {
          minY = yIntersects[i];
          maxY = yIntersects[i+1];
          foundY = true;
          break;
        }
      }
      if (!foundY && yIntersects.length >= 2) {
        minY = yIntersects[0];
        maxY = yIntersects[yIntersects.length - 1];
      }

      return { minX, maxX, minY, maxY };
    }
    
    return terrainBounds;
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 800, 800, 0.7);
        setPhotoPreview(compressedBase64);
        setNewTree({ ...newTree, photo: compressedBase64 });
      } catch (error) {
        console.error("Failed to compress image:", error);
      }
    }
  };

  const gridSize = selectedTerrain?.attributes?.scale || 100;
  const snapStep = gridSize >= 10 ? gridSize / 2 : gridSize;

  const handleCanvasClick = async (e: React.MouseEvent) => {
    if (!selectedTerrainId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    let cmX = Math.round(clickX / zoom);
    let cmY = Math.round(clickY / zoom);

    if (snapToGrid) {
      cmX = Math.round(cmX / snapStep) * snapStep;
      cmY = Math.round(cmY / snapStep) * snapStep;
    }

    if (isMeasuring) {
      if (!measureStart) {
        setMeasureStart({ x: cmX, y: cmY });
      } else {
        setMeasureStart(null);
        setIsMeasuring(false);
      }
      return;
    }

    if (isAddingStructure) {
      await fb.add("structures", {
        id: uuidv4(),
        terrainId: selectedTerrainId,
        name: newStructure.name || (newStructure.type === 'landmark' ? 'Repère' : 'Élément fixe'),
        type: newStructure.type,
        positions: [{ x: cmX, y: cmY }],
        width: newStructure.width,
        height: newStructure.height,
        color: newStructure.color,
        icon: newStructure.icon
      } as any);
      setIsAddingStructure(false);
      setMousePos(null);
      return;
    }

    if (isMovingTree && selectedTreeId) {
      await fb.update("trees", selectedTreeId, { positionX: cmX, positionY: cmY, status: 'planted', terrainId: selectedTerrainId });
      setIsMovingTree(false);
      return;
    }

    if (isCopyingTree && selectedTreeId) {
      const sourceTree = treesInCurrentTerrain.find(t => t.id === selectedTreeId);
      if (sourceTree) {
        const { id, ...rest } = sourceTree;
        await fb.add("trees", {
          ...rest,
          id: uuidv4(),
          positionX: cmX,
          positionY: cmY,
          notes: []
        });
      }
      setIsCopyingTree(false);
      return;
    }

    // If in select mode, just deselect
    if (toolMode === 'select') {
      setSelectedTreeId(null);
      setIsAddingTree(false);
      setIsEditingTree(false);
      return;
    }

    // Add mode is only active when placing an existing species from Catalogue des Plantes
    if (!newTree?.species) {
      setToolMode('select');
      setIsAddingTree(false);
      return;
    }

    setSelectedTreeId(null);
    setNewTree((prev: any) => ({
      species: '',
      color: '#10b981',
      icon: 'Trees',
      spacing: 200,
      ...(prev || {}),
      positionX: cmX,
      positionY: cmY
    }));
    setPhotoPreview(null);
    setIsAddingTree(true);
  };

  const zoomToFit = () => {
    if (!containerRef.current || !selectedTerrain) return;
    const container = containerRef.current.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    
    let terrainWidth = selectedTerrain.attributes?.width || 1000;
    let terrainHeight = selectedTerrain.attributes?.height || 1000;

    if (selectedTerrain.attributes?.shape === 'polygon' && Array.isArray(selectedTerrain.attributes.points)) {
      terrainWidth = Math.max(...selectedTerrain.attributes.points.map((p: any) => p.x), 0) || 1000;
      terrainHeight = Math.max(...selectedTerrain.attributes.points.map((p: any) => p.y), 0) || 1000;
    }
    
    const padding = 60;
    const availableWidth = Math.max(200, containerRect.width - padding);
    const availableHeight = Math.max(200, containerRect.height - padding);
    
    const zoomX = availableWidth / terrainWidth;
    const zoomY = availableHeight / terrainHeight;
    
    const optimalZoom = Math.min(zoomX, zoomY);
    setZoom(Math.max(0.05, Math.min(5, optimalZoom)));
  };

  const centerOnOrchardContent = () => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const pts: Array<{ x: number; y: number }> = [];
    placedTrees.forEach((t: any) => {
      if (t.positionX !== undefined && t.positionY !== undefined) {
        pts.push({ x: t.positionX, y: t.positionY });
      }
    });
    structuresInCurrentTerrain.forEach((s: any) => {
      (s.positions || []).forEach((p: any) => {
        if (p?.x !== undefined && p?.y !== undefined) pts.push({ x: p.x, y: p.y });
      });
    });
    if (pts.length === 0) {
      zoomToFit();
      return;
    }
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    const contentW = Math.max(400, maxX - minX + 600);
    const contentH = Math.max(400, maxY - minY + 600);
    const rect = parent.getBoundingClientRect();
    const fitZoom = Math.max(0.08, Math.min(2, Math.min((rect.width - 40) / contentW, (rect.height - 40) / contentH)));
    setZoom(fitZoom);
    requestAnimationFrame(() => {
      const centerX = ((minX + maxX) / 2) * fitZoom;
      const centerY = ((minY + maxY) / 2) * fitZoom;
      parent.scrollTo({
        left: Math.max(0, centerX - parent.clientWidth / 2),
        top: Math.max(0, centerY - parent.clientHeight / 2),
        behavior: 'smooth'
      });
    });
  };

  const hasAutoCenteredRef = useRef<string>('');
  useEffect(() => {
    if (viewMode !== 'plan' || !selectedTerrainId || !containerRef.current) return;
    if (hasAutoCenteredRef.current === selectedTerrainId) return;
    if (placedTrees.length > 0 || structuresInCurrentTerrain.length > 0) {
      hasAutoCenteredRef.current = selectedTerrainId;
      const savedZoom = localStorage.getItem('orchard_zoom');
      // On first visit or if large terrain is zoomed in so trees are far off-screen, auto-center on trees
      if (!savedZoom || parseFloat(savedZoom) >= 1.5) {
        centerOnOrchardContent();
      }
    }
  }, [viewMode, selectedTerrainId, placedTrees.length, structuresInCurrentTerrain.length]);

  const getNearestElementDistance = (cmX: number, cmY: number, excludeId?: string) => {
    let minDist = Infinity;
    let nearestName = '';

    treesInCurrentTerrain.forEach(t => {
      if (t.id === excludeId) return;
      const dist = Math.sqrt(Math.pow(t.positionX - cmX, 2) + Math.pow(t.positionY - cmY, 2));
      const spacing = t.spacing || 200;
      const actualDist = Math.max(0, dist - spacing / 2);
      if (actualDist < minDist) {
        minDist = actualDist;
        nearestName = t.species;
      }
    });

    structuresInCurrentTerrain.forEach(s => {
      if (s.id === excludeId) return;
      s.positions.forEach(p => {
        const dist = Math.sqrt(Math.pow(p.x - cmX, 2) + Math.pow(p.y - cmY, 2));
        const width = s.width || 200;
        const height = s.height || 200;
        const radius = Math.min(width, height) / 2;
        const actualDist = Math.max(0, dist - radius);
        if (actualDist < minDist) {
          minDist = actualDist;
          nearestName = s.name;
        }
      });
    });

    return minDist === Infinity ? null : { dist: Math.round(minDist), name: nearestName };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Auto-scroll logic
    if (draggingTreeId || draggingStructureId || isAddingStructure || isAddingTree || isMovingTree || isCopyingTree) {
      const scrollThreshold = 50;
      const scrollSpeed = 10;
      const parent = containerRef.current.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        if (e.clientX < parentRect.left + scrollThreshold) parent.scrollLeft -= scrollSpeed;
        if (e.clientX > parentRect.right - scrollThreshold) parent.scrollLeft += scrollSpeed;
        if (e.clientY < parentRect.top + scrollThreshold) parent.scrollTop -= scrollSpeed;
        if (e.clientY > parentRect.bottom - scrollThreshold) parent.scrollTop += scrollSpeed;
      }
    }
    
    if (draggingTreeId && dragStartMousePos) {
      const dist = Math.sqrt(Math.pow(mouseX - dragStartMousePos.x, 2) + Math.pow(mouseY - dragStartMousePos.y, 2));
      if (!isActuallyDragging && dist > 5) {
        setIsActuallyDragging(true);
      }
      
      if (isActuallyDragging) {
        setMousePos({
          x: mouseX - dragOffset.x,
          y: mouseY - dragOffset.y
        });
      }
      return;
    }

    if (draggingStructureId && dragStartMousePos) {
      const dist = Math.sqrt(Math.pow(mouseX - dragStartMousePos.x, 2) + Math.pow(mouseY - dragStartMousePos.y, 2));
      if (!isActuallyDragging && dist > 5) {
        setIsActuallyDragging(true);
      }
      
      if (isActuallyDragging) {
        setMousePos({
          x: mouseX - dragOffset.x,
          y: mouseY - dragOffset.y
        });
      }
      return;
    }

    if (toolMode === 'add' || isAddingTree || isAddingStructure || isMovingTree || isCopyingTree || isMeasuring) {
      let cmX = Math.round(mouseX / zoom);
      let cmY = Math.round(mouseY / zoom);
      
      if (snapToGrid) {
        cmX = Math.round(cmX / snapStep) * snapStep;
        cmY = Math.round(cmY / snapStep) * snapStep;
      }
      
      setMousePos({
        x: cmX * zoom,
        y: cmY * zoom
      });
    } else {
      setMousePos(null);
    }
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    wasDraggingRef.current = isActuallyDragging;
    if (draggingTreeId && containerRef.current) {
      if (isActuallyDragging) {
        const rect = containerRef.current.getBoundingClientRect();
        let cmX = Math.round((e.clientX - rect.left - dragOffset.x) / zoom);
        let cmY = Math.round((e.clientY - rect.top - dragOffset.y) / zoom);
        
        if (snapToGrid) {
          cmX = Math.round(cmX / snapStep) * snapStep;
          cmY = Math.round(cmY / snapStep) * snapStep;
        }

        await fb.update("trees", draggingTreeId, {
          positionX: cmX,
          positionY: cmY
        });
      }
      setDraggingTreeId(null);
      setIsActuallyDragging(false);
      setDragStartMousePos(null);
      setMousePos(null);
      return;
    }

    if (draggingStructureId && containerRef.current) {
      if (isActuallyDragging) {
        const rect = containerRef.current.getBoundingClientRect();
        let cmX = Math.round((e.clientX - rect.left - dragOffset.x) / zoom);
        let cmY = Math.round((e.clientY - rect.top - dragOffset.y) / zoom);
        
        if (snapToGrid) {
          cmX = Math.round(cmX / snapStep) * snapStep;
          cmY = Math.round(cmY / snapStep) * snapStep;
        }

        await fb.update("structures", draggingStructureId, {
          positions: [{ x: cmX, y: cmY }]
        });
      }
      setDraggingStructureId(null);
      setIsActuallyDragging(false);
      setDragStartMousePos(null);
      setMousePos(null);
      return;
    }
    
    setIsActuallyDragging(false);
    setDragStartMousePos(null);
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    setDraggingStructureId(null);
    setDraggingTreeId(null);
    setIsActuallyDragging(false);
    setDragStartMousePos(null);
  };

  const handleTreeMouseDown = (e: React.MouseEvent, treeId: string) => {
    e.stopPropagation();
    if (isMovingTree || isCopyingTree || isAddingStructure) return;
    
    // Only start dragging if plan is not locked and tree is not locked
    const tree = trees?.find(t => t.id === treeId);
    if (!isPlanLocked && !tree?.isLocked && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const elementCenterX = tree.positionX * zoom;
      const elementCenterY = tree.positionY * zoom;
      
      setDragOffset({
        x: mouseX - elementCenterX,
        y: mouseY - elementCenterY
      });
      setDragStartMousePos({ x: mouseX, y: mouseY });
      setDraggingTreeId(treeId);
      setIsActuallyDragging(false);
    }
  };

  const handleTreeClick = (e: React.MouseEvent, treeId: string) => {
    e.stopPropagation();
    if (wasDraggingRef.current) return;
    setSelectedTreeId(treeId);
    setIsAddingTree(false);
    setIsEditingTree(false);
  };

  const handleStructureClick = (e: React.MouseEvent, structureId: string) => {
    e.stopPropagation();
    if (wasDraggingRef.current) return;
    setEditingStructureId(structureId);
  };

  const handleUpdateStructure = async (updatedData: any) => {
    if (!editingStructureId) return;
    await fb.update("structures", editingStructureId, updatedData);
  };

  const handleRemoveStructure = (e: React.MouseEvent, structureId: string) => {
    e.stopPropagation();
    const structure = structures?.find(s => s.id === structureId);
    if (!structure) return;

    setConfirmState({
      isOpen: true,
      title: 'Supprimer l\'élément',
      message: `Voulez-vous retirer l'élément "${structure.name}" ?`,
      isDanger: true,
      onConfirm: async () => {
        await fb.delete("structures", structureId);
        setEditingStructureId(null);
      }
    });
  };

  const handlePlacePlannedTree = (tree: Tree) => {
    setSelectedTreeId(tree.id);
    const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree.species || '').toLowerCase().trim());
    setNewTree({
      ...tree,
      color: encEntry?.color || '#10b981',
      icon: encEntry?.icon || 'Trees'
    });
    setIsMovingTree(true);
  };

  const handleSaveTree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerrainId || !newTree.species || newTree.positionX === undefined) return;

    const trimmedSpecies = newTree.species.trim();
    const encEntry = encyclopedia?.find((e: any) => (e.name || '').toLowerCase().trim() === trimmedSpecies.toLowerCase());
    const configVeg = config?.find((c: any) => c.type === 'vegetable' && (c.value || '').toLowerCase().trim() === trimmedSpecies.toLowerCase());
    const canonicalSpecies = encEntry?.name || configVeg?.value || trimmedSpecies;

    let canonicalVariety = '';
    let matchedVarietyObj: any = null;
    if (newTree.variety && newTree.variety.trim()) {
      const varietyTrimmed = newTree.variety.trim();
      const catalogVarObjs = getCatalogVarietyObjectsForSpecies(canonicalSpecies);
      matchedVarietyObj = catalogVarObjs.find((v: any) => (v.value || '').toLowerCase().trim() === varietyTrimmed.toLowerCase()) || null;
      canonicalVariety = matchedVarietyObj?.value || varietyTrimmed;
    }

    const newId = uuidv4();
    const tree: Tree = {
      id: newId,
      terrainId: selectedTerrainId,
      species: canonicalSpecies,
      variety: canonicalVariety,
      encyclopediaId: encEntry?.id || newTree.encyclopediaId || '',
      varietyId: matchedVarietyObj?.id || newTree.varietyId || '',
      datePlanted: newTree.datePlanted || new Date().toISOString().split('T')[0],
      comments: newTree.comments || '',
      photo: newTree.photo,
      positionX: newTree.positionX,
      positionY: newTree.positionY,
      spacing: newTree.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200) || 200,
      isDeleted: false,
      notes: []
    };

    await fb.add("trees", tree);
    setIsAddingTree(false);
    setToolMode('select');
    setPendingPlacementNotice(null);
    setNewTree({});
    setPhotoPreview(null);
    setSelectedTreeId(newId);
  };

  const handleUpdateTree = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingTreeId || selectedTreeId;
    if (!id || !editTreeData.species) return;

    const trimmedSpecies = editTreeData.species.trim();
    const encEntry = encyclopedia?.find((e: any) => (e.name || '').toLowerCase().trim() === trimmedSpecies.toLowerCase());
    const configVeg = config?.find((c: any) => c.type === 'vegetable' && (c.value || '').toLowerCase().trim() === trimmedSpecies.toLowerCase());
    const canonicalSpecies = encEntry?.name || configVeg?.value || trimmedSpecies;

    let canonicalVariety = '';
    let matchedVarietyObj: any = null;
    if (editTreeData.variety && editTreeData.variety.trim()) {
      const varietyTrimmed = editTreeData.variety.trim();
      const catalogVarObjs = getCatalogVarietyObjectsForSpecies(canonicalSpecies);
      matchedVarietyObj = catalogVarObjs.find((v: any) => (v.value || '').toLowerCase().trim() === varietyTrimmed.toLowerCase()) || null;
      canonicalVariety = matchedVarietyObj?.value || varietyTrimmed;
    }

    await fb.update("trees", id, {
      species: canonicalSpecies,
      variety: canonicalVariety,
      encyclopediaId: encEntry?.id || '',
      varietyId: matchedVarietyObj?.id || '',
      datePlanted: editTreeData.datePlanted,
      comments: editTreeData.comments,
      photo: editTreeData.photo,
      spacing: editTreeData.spacing || 200,
      isLocked: editTreeData.isLocked
    });

    setEditingTreeId(null);
    setIsEditingTree(false);
    setEditTreeData(null);
    setShowSpeciesCustomization(false);
  };

  const handleDeleteTree = async (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Supprimer l\'arbre',
      message: 'Voulez-vous vraiment supprimer cet arbre du verger ?',
      isDanger: true,
      onConfirm: async () => {
        await fb.delete("trees", id);
        setSelectedTreeId(null);
      }
    });
  };

  const handleNotePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 800, 800, 0.7);
        setNewNotePhotos(prev => [...prev, compressedBase64]);
      } catch (error) {
        console.error("Failed to compress image:", error);
      }
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTreeId || (!newNoteText.trim() && newNotePhotos.length === 0)) return;

    const tree = treesInCurrentTerrain.find(t => t.id === selectedTreeId);
    if (!tree) return;

    const newNote: Note = {
      id: uuidv4(),
      date: new Date().toISOString(),
      text: newNoteText,
      photos: newNotePhotos,
    };

    await fb.update("trees", selectedTreeId, {
      notes: [...(tree.notes || []), newNote]
    });

    setNewNoteText('');
    setNewNotePhotos([]);
    setShowNoteForm(false);
  };

  const handleSaveTreeNoteUpdates = async (noteId: string, nextUpdates: NoteUpdate[]) => {
    if (!selectedTreeId || !selectedTreeDetails || !selectedTreeDetails.notes) return;
    const updatedNotes = selectedTreeDetails.notes.map((n: Note) =>
      n.id === noteId ? { ...n, updates: nextUpdates } : n
    );
    await fb.update("trees", selectedTreeId, { notes: updatedNotes });
  };

  const handleSetTreeNoteSuccess = async (noteId: string, nextStatus: 'none' | 'success' | 'failure') => {
    if (!selectedTreeId || !selectedTreeDetails || !selectedTreeDetails.notes) return;
    const updatedNotes = selectedTreeDetails.notes.map((n: Note) =>
      n.id === noteId ? { ...n, successStatus: nextStatus } : n
    );
    await fb.update("trees", selectedTreeId, { notes: updatedNotes });
  };

  const speciesLegend = Array.from(new Set(treesInCurrentTerrain.map(t => t.species))).sort();

  const selectedTreeDetails = useMemo(
    () => (trees || []).find((t: any) => t.id === selectedTreeId),
    [trees, selectedTreeId]
  );

  const unlinkedTreesInTerrain = useMemo(
    () => placedTrees.filter((t: any) => getTreeCatalogLinkInfo(t).status !== 'catalog'),
    [placedTrees, encyclopedia, config]
  );

  const selectedTreeLinkInfo = useMemo(
    () => (selectedTreeDetails ? getTreeCatalogLinkInfo(selectedTreeDetails) : null),
    [selectedTreeDetails, encyclopedia, config]
  );

  // Catalog varieties (in categories enabled for orchard plan) still remaining to be positioned
  const remainingToPlaceItems = useMemo(() => {
    const allPlacedTrees = (trees || []).filter(
      (t: any) => !t.isDeleted && t.status !== 'planned' && t.positionX !== undefined
    );

    const items: Array<{
      key: string;
      speciesData: (typeof catalogOrchardSpecies)[number];
      variety: string;
      varietyId?: string;
      declaredQty: number;
      placedCount: number;
      remainingCount: number;
      datePlanted: string;
      rootstock: string;
      isSpeciesOnly: boolean;
    }> = [];

    for (const sp of catalogOrchardSpecies) {
      const allVars = getCatalogVarietyObjectsForSpecies(sp.name);
      const activeVars = allVars.filter(
        (v: any) => !(v.attributes?.isTemporary || v.attributes?.status === 'temporary')
      );

      if (activeVars.length > 0) {
        for (const v of activeVars) {
          const varName = String(v.value || '').trim();
          const declaredQty = Math.max(1, Number(v.attributes?.quantity ?? 1) || 1);
          const placedCount = allPlacedTrees.filter(
            (t: any) =>
              (v.id && t.varietyId === v.id) ||
              ((t.species || '').toLowerCase().trim() === sp.name.toLowerCase().trim() &&
                (t.variety || '').toLowerCase().trim() === varName.toLowerCase())
          ).length;

          const remainingCount = Math.max(0, declaredQty - placedCount);
          if (remainingCount > 0) {
            const plantings = getVarietyPlantings(v.attributes);
            const datePlanted =
              plantings.find((p) => p.datePlanted)?.datePlanted ||
              v.attributes?.datePlanted ||
              '';
            const rootstock = plantings.find((p) => p.rootstock)?.rootstock || '';

            items.push({
              key: `${sp.id}_${v.id}`,
              speciesData: sp,
              variety: varName,
              varietyId: v.id,
              declaredQty,
              placedCount,
              remainingCount,
              datePlanted,
              rootstock,
              isSpeciesOnly: false,
            });
          }
        }
      } else if (allVars.length === 0) {
        const placedForSp = allPlacedTrees.filter(
          (t: any) =>
            (sp.encyclopediaId && t.encyclopediaId === sp.encyclopediaId) ||
            (t.species || '').toLowerCase().trim() === sp.name.toLowerCase().trim()
        ).length;
        if (placedForSp === 0) {
          items.push({
            key: `${sp.id}_species`,
            speciesData: sp,
            variety: '',
            declaredQty: 1,
            placedCount: 0,
            remainingCount: 1,
            datePlanted: '',
            rootstock: '',
            isSpeciesOnly: true,
          });
        }
      }
    }

    return items;
  }, [catalogOrchardSpecies, trees, config, encyclopedia]);

  const totalRemainingPlantsToPlace = useMemo(
    () => remainingToPlaceItems.reduce((sum, item) => sum + item.remainingCount, 0),
    [remainingToPlaceItems]
  );

  const filteredRemainingToPlace = useMemo(() => {
    const q = toPlaceSearch.trim().toLowerCase();
    if (!q) return remainingToPlaceItems;
    return remainingToPlaceItems.filter(
      (item) =>
        item.speciesData.name.toLowerCase().includes(q) ||
        item.variety.toLowerCase().includes(q) ||
        item.rootstock.toLowerCase().includes(q)
    );
  }, [remainingToPlaceItems, toPlaceSearch]);

  useEffect(() => {
    if (!selectedTreeDetails) {
      setShowReattachPanel(false);
      setReattachSpecies('');
      setReattachVariety('');
      setReattachFeedback(null);
      return;
    }

    const info = getTreeCatalogLinkInfo(selectedTreeDetails);
    let initialSpecies = '';
    if (info.matchedEnc && info.isCategoryAllowed) {
      initialSpecies = info.matchedEnc.name;
    } else if (selectedTreeDetails.species && catalogOrchardSpecies.length > 0) {
      let bestSp = '';
      let bestScore = 0;
      for (const sp of catalogOrchardSpecies) {
        const score = computeVarietySimilarity(selectedTreeDetails.species, sp.name);
        if (score > bestScore) {
          bestScore = score;
          bestSp = sp.name;
        }
      }
      if (bestScore >= 70) {
        initialSpecies = bestSp;
      }
    }

    let initialVariety = '';
    if (info.matchedVar) {
      initialVariety = info.matchedVar.value;
    } else if (initialSpecies && selectedTreeDetails.variety) {
      const spVars = getCatalogVarietyObjectsForSpecies(initialSpecies);
      let bestVar = '';
      let bestScore = 0;
      for (const v of spVars) {
        const score = computeVarietySimilarity(selectedTreeDetails.variety, v.value || '');
        if (score > bestScore) {
          bestScore = score;
          bestVar = v.value;
        }
      }
      if (bestScore >= 75) {
        initialVariety = bestVar;
      }
    }

    setReattachSpecies(initialSpecies);
    setReattachVariety(initialVariety);
    setShowReattachPanel(info.status !== 'catalog');
    setReattachFeedback(null);
  }, [selectedTreeId]);

  const openPlantInCatalog = (
    speciesName?: string,
    encyclopediaId?: string,
    subTab: 'varieties' | 'culture' = 'varieties'
  ) => {
    try {
      localStorage.setItem(
        'encyclopedia_focus_plant',
        JSON.stringify({
          name: speciesName || '',
          encyclopediaId: encyclopediaId || '',
          subTab,
        })
      );
    } catch {}
    if (setCurrentView) {
      setCurrentView('encyclopedia');
    }
  };

  const selectNextUnlinkedTree = () => {
    if (unlinkedTreesInTerrain.length === 0) return;
    const currentIdx = unlinkedTreesInTerrain.findIndex((t: any) => t.id === selectedTreeId);
    const nextTree =
      currentIdx >= 0
        ? unlinkedTreesInTerrain[(currentIdx + 1) % unlinkedTreesInTerrain.length]
        : unlinkedTreesInTerrain[0];
    if (nextTree) {
      handleLocateTreeOnPlan(nextTree);
    }
  };

  const handleValidateReattach = async () => {
    if (!selectedTreeDetails || !reattachSpecies) return;
    const targetSp = catalogOrchardSpecies.find(
      (s) => s.name.toLowerCase() === reattachSpecies.toLowerCase()
    );
    if (!targetSp) return;

    const catalogVars = getCatalogVarietyObjectsForSpecies(targetSp.name);
    const targetVarObj = reattachVariety
      ? catalogVars.find((v: any) => (v.value || '').toLowerCase() === reattachVariety.toLowerCase()) || null
      : null;

    if (catalogVars.length > 0 && !targetVarObj) return;

    await fb.update('trees', selectedTreeDetails.id, {
      species: targetSp.name,
      variety: targetVarObj?.value || '',
      encyclopediaId: targetSp.encyclopediaId || targetSp.id || '',
      varietyId: targetVarObj?.id || '',
    });

    setReattachFeedback(
      `Rattachement validé : ${targetSp.name}${targetVarObj?.value ? ` → ${targetVarObj.value}` : ''}`
    );
    setShowReattachPanel(false);
  };

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

  if (!terrains || !trees || !config) return <div className="p-8 text-center text-stone-500 italic">Chargement...</div>;

  if (terrains.length === 0) {
    return (
      <div className="text-center py-12">
        <Trees className="w-16 h-16 text-stone-300 mx-auto mb-4" />
        <h2 className="text-xl font-medium text-stone-900 mb-2">Aucun terrain configuré</h2>
        <p className="text-stone-500">Allez dans la configuration pour ajouter un terrain (Verger).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText="Supprimer"
      />

      {editingStructureId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <h3 className="font-serif text-xl font-medium text-stone-900">Modifier l'élément</h3>
              <button onClick={() => setEditingStructureId(null)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {(() => {
                const structure = structures?.find(s => s.id === editingStructureId);
                if (!structure) return null;
                return (
                  <StructureEditor
                    structure={structure}
                    onUpdate={handleUpdateStructure}
                    onClose={() => setEditingStructureId(null)}
                    onRemove={(e) => handleRemoveStructure(e, structure.id)}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <header className="flex justify-between items-center flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-serif font-medium text-stone-900 flex items-center gap-3">
            <Trees className="w-8 h-8 text-emerald-600" />
            Mon Verger
          </h1>
          <p className="text-stone-500 mt-2">Gérez vos arbres fruitiers et arbustes sur votre terrain.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-stone-200">
            <Grid3X3 className="w-4 h-4 text-stone-400" />
            <select
              value={gridSize}
              onChange={async (e) => {
                const newSize = Number(e.target.value);
                if (selectedTerrainId) {
                  const updatedAttributes = { ...selectedTerrain.attributes, scale: newSize };
                  await fb.update("config", selectedTerrainId, { attributes: updatedAttributes });
                }
              }}
              className="text-sm border-none bg-transparent outline-none text-stone-600 font-medium cursor-pointer"
            >
              <option value={5}>Grille 5cm</option>
              <option value={10}>Grille 10cm</option>
              <option value={20}>Grille 20cm</option>
              <option value={50}>Grille 50cm</option>
              <option value={100}>Grille 1m</option>
            </select>
          </div>
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${snapToGrid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-stone-200 text-stone-600'}`}
            title={snapToGrid ? "Magnétisme activé" : "Magnétisme désactivé"}
          >
            <Magnet className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Magnétisme</span>
          </button>
          <button
            onClick={() => setIsPlanLocked(!isPlanLocked)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${isPlanLocked ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-stone-200 text-stone-600'}`}
            title={isPlanLocked ? "Plan verrouillé (clic pour sélectionner uniquement)" : "Plan déverrouillé (glisser-déposer activé)"}
          >
            {isPlanLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span className="text-sm font-medium hidden sm:inline">{isPlanLocked ? 'Verrouillé' : 'Édition'}</span>
          </button>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-stone-200">
            <button
              onClick={() => {
                setToolMode('select');
                setIsAddingTree(false);
                setPendingPlacementNotice(null);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${toolMode === 'select' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'}`}
              title="Mode Sélection"
            >
              <MousePointer2 className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Sélection</span>
            </button>
            {toolMode === 'add' ? (
              <button
                onClick={() => {
                  setToolMode('select');
                  setIsAddingTree(false);
                  setPendingPlacementNotice(null);
                  setNewTree({});
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                title="Annuler le placement en cours"
              >
                <X className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">Annuler placement</span>
              </button>
            ) : setCurrentView ? (
              <button
                onClick={() => setCurrentView('encyclopedia')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-emerald-700 hover:bg-emerald-50 font-medium cursor-pointer"
                title="Ajouter ou choisir un arbre depuis le Catalogue des Plantes (évite les doublons)"
              >
                <BookOpen className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">Ajouter via Catalogue</span>
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-stone-200">
            <button onClick={() => setZoom(z => Math.max(0.05, z - 0.1))} className="p-1 hover:bg-stone-100 rounded text-stone-600">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-stone-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="p-1 hover:bg-stone-100 rounded text-stone-600">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={zoomToFit}
              className="p-1 hover:bg-stone-100 rounded text-emerald-600 border border-emerald-100 ml-1"
              title="Zoom optimal (ajuster au terrain)"
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button 
              onClick={() => setViewMode('plan')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'plan' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <MapIcon className="w-4 h-4" />
              Plan
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <List className="w-4 h-4" />
              Liste
            </button>
          </div>
          <select 
            value={selectedTerrainId} 
            onChange={e => {
              setSelectedTerrainId(e.target.value);
              setSelectedTreeId(null);
              setIsAddingTree(false);
              setIsAddingStructure(false);
            }}
            className="px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
          >
            {terrains.map(t => (
              <option key={t.id} value={t.id}>{t.value}</option>
            ))}
          </select>
          
          <div className="flex items-center gap-2 bg-white rounded-lg border border-stone-200 px-2 py-1 h-[42px]">
            <span className="text-xs text-stone-500 font-medium whitespace-nowrap hidden sm:inline">Échelle impression:</span>
            <select 
              value={printScale}
              onChange={e => setPrintScale(Number(e.target.value))}
              className="text-sm font-medium text-stone-700 bg-transparent outline-none cursor-pointer"
            >
              <option value={100}>100%</option>
              <option value={75}>75%</option>
              <option value={50}>50%</option>
              <option value={35}>35%</option>
              <option value={25}>25%</option>
            </select>
          </div>

          <button 
            onClick={() => printElement(viewMode === 'plan' ? 'orchard-plan-print-area' : 'orchard-list-print-area', viewMode === 'plan' ? 'Plan du Verger' : 'Liste du Verger', printScale)}
            className="p-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-stone-200 bg-white h-[42px] w-[42px] flex items-center justify-center"
            title="Imprimer"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </header>

      {pendingPlacementNotice && (
        <div className="bg-emerald-700 text-white px-5 py-3.5 rounded-2xl shadow-md flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-emerald-100 animate-bounce" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">{pendingPlacementNotice}</p>
              <p className="text-xs text-emerald-100 mt-0.5">Cliquez sur le plan pour positionner l'arbre, ou complétez les informations dans le panneau latéral.</p>
            </div>
          </div>
          <button
            onClick={() => setPendingPlacementNotice(null)}
            className="p-1.5 hover:bg-white/20 rounded-lg text-emerald-100 hover:text-white transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {orphanPlacedTrees.length > 0 && selectedTerrain && (
        <div className="bg-amber-50 border border-amber-200 px-5 py-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-4 flex-wrap print:hidden">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {orphanPlacedTrees.length} arbre(s) du verger sont rattachés à un ancien identifiant de terrain.
              </p>
              <p className="text-xs text-amber-700">
                Cliquez pour les réafficher directement sur « {selectedTerrain.value} ».
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await Promise.all(
                orphanPlacedTrees.map((t: any) =>
                  fb.update('trees', t.id, { terrainId: selectedTerrain.id })
                )
              );
              hasAutoCenteredRef.current = '';
            }}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            Rattacher à « {selectedTerrain.value} »
          </button>
        </div>
      )}

      {viewMode === 'plan' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="orchard-plan-print-area">
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 overflow-x-auto print:border-none print:shadow-none print:p-0">
            <div className="mb-4 flex justify-between items-start flex-wrap gap-4 print:hidden">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-stone-900">Plan du terrain: {selectedTerrain?.value}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                    {placedTrees.length} arbre{placedTrees.length > 1 ? 's' : ''} • {structuresInCurrentTerrain.length} élément{structuresInCurrentTerrain.length > 1 ? 's' : ''}
                  </span>
                  {catalogOrchardSpecies.length > 0 && (
                    totalRemainingPlantsToPlace > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTreeId(null);
                          setIsAddingTree(false);
                          setIsEditingTree(false);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors cursor-pointer shadow-2xs"
                        title="Afficher la liste des plants du Catalogue restants à positionner sur le plan"
                      >
                        <Sprout className="w-3.5 h-3.5" />
                        <span>{totalRemainingPlantsToPlace} à positionner</span>
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"
                        title="Tous les plants du Catalogue (catégories activées) sont positionnés sur le plan"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tout est positionné</span>
                      </span>
                    )
                  )}
                  {placedTrees.length > 0 && (
                    unlinkedTreesInTerrain.length > 0 ? (
                      <button
                        type="button"
                        onClick={selectNextUnlinkedTree}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold transition-colors cursor-pointer"
                        title="Cliquer pour sélectionner le prochain arbre à rattacher au Catalogue des Plantes"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>{unlinkedTreesInTerrain.length} ancienne{unlinkedTreesInTerrain.length > 1 ? 's' : ''} fiche{unlinkedTreesInTerrain.length > 1 ? 's' : ''} à rattacher</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"
                        title="Tous les arbres de ce terrain sont rattachés au Catalogue des Plantes"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>100% lié au Catalogue</span>
                      </span>
                    )
                  )}
                  {placedTrees.length > 0 && (
                    <button
                      type="button"
                      onClick={centerOnOrchardContent}
                      className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-700 border border-stone-200 font-medium transition-colors cursor-pointer"
                      title="Ajuster le zoom et centrer sur vos arbres"
                    >
                      Centrer sur mes arbres
                    </button>
                  )}
                </div>
                <p className="text-sm text-stone-500">Tout nouvel arbre se place depuis le Catalogue des Plantes (« Placer au verger ») pour éviter les doublons.</p>
              </div>
              {(isMovingTree || isCopyingTree) && (
                <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl flex items-center gap-3 animate-pulse border border-emerald-200">
                  <span className="text-sm font-medium">
                    {isMovingTree ? "Mode déplacement : Cliquez sur le plan" : "Mode copie : Cliquez sur le plan"}
                  </span>
                  <button 
                    onClick={() => { setIsMovingTree(false); setIsCopyingTree(false); }}
                    className="p-1 hover:bg-emerald-200 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200">
                  <Grid3X3 className="w-4 h-4 text-stone-400" />
                  <select
                    value={gridSize}
                    onChange={async (e) => {
                      const newSize = Number(e.target.value);
                      if (selectedTerrainId) {
                        const updatedAttributes = { ...selectedTerrain.attributes, scale: newSize };
                        await fb.update("config", selectedTerrainId, { attributes: updatedAttributes });
                      }
                    }}
                    className="text-sm border-none bg-transparent outline-none text-stone-600 font-medium cursor-pointer"
                  >
                    <option value={2}>Grille 2cm</option>
                    <option value={5}>Grille 5cm</option>
                    <option value={10}>Grille 10cm</option>
                    <option value={20}>Grille 20cm</option>
                    <option value={25}>Grille 25cm</option>
                    <option value={50}>Grille 50cm</option>
                    <option value={100}>Grille 1m</option>
                  </select>
                </div>
                <button
                  onClick={() => setIsPlanLocked(!isPlanLocked)}
                  className={`p-2 rounded-xl border transition-all ${isPlanLocked ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-stone-200 text-stone-400 hover:text-stone-600'}`}
                  title={isPlanLocked ? "Plan verrouillé (cliquez pour déverrouiller)" : "Plan déverrouillé (cliquez pour verrouiller)"}
                >
                  {isPlanLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-2 rounded-xl border transition-all ${showGrid ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-stone-200 text-stone-400 hover:text-stone-600'}`}
                  title={showGrid ? "Grille affichée" : "Grille masquée"}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsMeasuring(!isMeasuring)}
                  className={`p-2 rounded-xl border transition-all ${isMeasuring ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-stone-200 text-stone-400 hover:text-stone-600'}`}
                  title={isMeasuring ? "Outil de mesure activé" : "Outil de mesure"}
                >
                  <Ruler className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowCoordinates(!showCoordinates)}
                  className={`p-2 rounded-xl border transition-all ${showCoordinates ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-stone-200 text-stone-400 hover:text-stone-600'}`}
                  title={showCoordinates ? "Coordonnées affichées" : "Coordonnées masquées"}
                >
                  <MapPin className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  className={`p-2 rounded-xl border transition-all ${snapToGrid ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-stone-200 text-stone-400 hover:text-stone-600'}`}
                  title={snapToGrid ? "Magnétisme grille activé" : "Magnétisme grille désactivé"}
                >
                  <Magnet className="w-4 h-4" />
                </button>
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 cursor-pointer transition-all">
                  <ImageIcon className="w-4 h-4" />
                  {selectedTerrain?.attributes?.backgroundImage ? 'Changer le fond' : 'Ajouter un fond'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && selectedTerrainId) {
                        try {
                          const base64 = await compressImage(file, 2048, 2048, 0.7);
                          const updatedAttributes = { ...selectedTerrain.attributes, backgroundImage: base64 };
                          await fb.update("config", selectedTerrainId, { attributes: updatedAttributes });
                        } catch (error) {
                          console.error("Failed to compress background:", error);
                        }
                      }
                    }}
                  />
                </label>
                {selectedTerrain?.attributes?.backgroundImage && (
                  <button
                    onClick={async () => {
                      if (selectedTerrainId) {
                        const updatedAttributes = { ...selectedTerrain.attributes, backgroundImage: undefined };
                        await fb.update("config", selectedTerrainId, { attributes: updatedAttributes });
                      }
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl border border-stone-200 bg-white"
                    title="Supprimer l'image de fond"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsAddingStructure(!isAddingStructure);
                    setIsAddingTree(false);
                    setSelectedTreeId(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isAddingStructure 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  {isAddingStructure ? 'Annuler l\'ajout' : 'Ajouter un élément fixe'}
                </button>
              </div>
            </div>

            {isAddingStructure && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-emerald-800">Ajouter un repère ou bâtiment</h4>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setNewStructure({...newStructure, type: 'building', icon: 'Home', color: '#78716c'})}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${newStructure.type === 'building' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                    >
                      <Home className="w-3.5 h-3.5" /> Bâtiment
                    </button>
                    <button 
                      onClick={() => setNewStructure({...newStructure, type: 'landmark', icon: 'MapPin', color: 'transparent'})}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${newStructure.type === 'landmark' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                    >
                      <MapIcon className="w-3.5 h-3.5" /> Repère visuel
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {newStructure.type === 'landmark' ? (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-stone-600 mb-2">Icône du repère</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'Home', icon: Home, label: 'Maison' },
                          { id: 'Square', icon: Square, label: 'Cabanon' },
                          { id: 'Trees', icon: Trees, label: 'Bosquet' },
                          { id: 'Flower2', icon: Flower2, label: 'Puits' },
                          { id: 'MapIcon', icon: MapIcon, label: 'Portail' },
                          { id: 'ImageIcon', icon: ImageIcon, label: 'Mur' },
                          { id: 'Shrub', icon: Shrub, label: 'Haie' },
                          { id: 'Palmtree', icon: Palmtree, label: 'Point d\'eau' }
                        ].map(item => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => setNewStructure({...newStructure, icon: item.id})}
                              className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${newStructure.icon === item.id ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-stone-200 text-stone-400 hover:bg-stone-50'}`}
                              title={item.label}
                            >
                              <Icon className="w-5 h-5" />
                              <span className="text-[10px]">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Couleur</label>
                      <div className="flex flex-wrap gap-2">
                        {['#78716c', '#44403c', '#0c4a6e', '#1e3a8a', '#701a75', '#831843'].map(c => (
                          <button 
                            key={c}
                            onClick={() => setNewStructure({...newStructure, color: c})}
                            className={`w-6 h-6 rounded-full border-2 ${newStructure.color === c ? 'border-emerald-500 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Largeur (cm)</label>
                        <input 
                          type="number" 
                          value={newStructure.width} 
                          onChange={e => setNewStructure({...newStructure, width: Number(e.target.value)})}
                          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Longueur (cm)</label>
                        <input 
                          type="number" 
                          value={newStructure.height} 
                          onChange={e => setNewStructure({...newStructure, height: Number(e.target.value)})}
                          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Nom de l'élément</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Maison, Portail..."
                        value={newStructure.name} 
                        onChange={e => setNewStructure({...newStructure, name: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
                      />
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-stone-500 italic flex items-center gap-2">
                  <MousePointer2 className="w-4 h-4" />
                  Cliquez sur le plan pour placer l'élément.
                </p>
              </div>
            )}

            <div className="print:block hidden mb-8">
              <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">Plan du Verger: {selectedTerrain?.value}</h1>
              <p className="text-stone-500 text-sm">Généré le {new Date().toLocaleDateString()}</p>
            </div>

            <div className="flex-1 overflow-auto max-h-[75vh] min-h-[420px] bg-stone-100 rounded-xl border border-stone-200 relative print:max-h-none">
              {/* Compass */}
              <div className="absolute top-4 right-4 z-10 flex flex-col items-center bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-sm border border-stone-200 pointer-events-none select-none">
                <div className="text-[10px] font-bold text-red-600 mb-1">N</div>
                <div className="w-0.5 h-8 bg-gradient-to-b from-red-500 to-stone-300 rounded-full"></div>
                <div className="text-[10px] font-bold text-stone-400 mt-1">S</div>
              </div>

              <div 
                ref={containerRef}
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                className="relative cursor-crosshair"
                style={{ 
                  width: (() => {
                    if (selectedTerrain?.attributes?.shape === 'polygon' && Array.isArray(selectedTerrain.attributes.points)) {
                      const maxX = Math.max(...selectedTerrain.attributes.points.map((p: any) => p.x), 0);
                      return (maxX || 1000) * zoom;
                    }
                    return (selectedTerrain?.attributes?.width || 1000) * zoom;
                  })(), 
                  height: (() => {
                    if (selectedTerrain?.attributes?.shape === 'polygon' && Array.isArray(selectedTerrain.attributes.points)) {
                      const maxY = Math.max(...selectedTerrain.attributes.points.map((p: any) => p.y), 0);
                      return (maxY || 1000) * zoom;
                    }
                    return (selectedTerrain?.attributes?.height || 1000) * zoom;
                  })(),
                  backgroundSize: [
                    showGrid ? `${(selectedTerrain?.attributes?.scale || 100) * zoom}px ${(selectedTerrain?.attributes?.scale || 100) * zoom}px` : null,
                    showGrid ? `${(selectedTerrain?.attributes?.scale || 100) * zoom}px ${(selectedTerrain?.attributes?.scale || 100) * zoom}px` : null,
                    selectedTerrain?.attributes?.backgroundImage ? 'contain' : null
                  ].filter(Boolean).join(', '),
                  backgroundPosition: [
                    showGrid ? '0 0' : null,
                    showGrid ? '0 0' : null,
                    selectedTerrain?.attributes?.backgroundImage ? 'center' : null
                  ].filter(Boolean).join(', '),
                  backgroundRepeat: [
                    showGrid ? 'repeat' : null,
                    showGrid ? 'repeat' : null,
                    selectedTerrain?.attributes?.backgroundImage ? 'no-repeat' : null
                  ].filter(Boolean).join(', '),
                  backgroundImage: [
                    showGrid ? `linear-gradient(to right, rgba(0,0,0,0.2) 1px, transparent 1px)` : null,
                    showGrid ? `linear-gradient(to bottom, rgba(0,0,0,0.2) 1px, transparent 1px)` : null,
                    selectedTerrain?.attributes?.backgroundImage ? `url(${selectedTerrain.attributes.backgroundImage})` : null
                  ].filter(Boolean).join(', '),
                  backgroundColor: '#f5f5f4',
                  clipPath: selectedTerrain?.attributes?.shape === 'polygon' && Array.isArray(selectedTerrain.attributes?.points) && selectedTerrain.attributes.points.length >= 3
                    ? `polygon(${selectedTerrain.attributes.points.map((p: any) => `${p.x * zoom}px ${p.y * zoom}px`).join(', ')})`
                    : 'none'
                }}
              >
                {/* Render structures */}
                {structuresInCurrentTerrain.map(structure => {
                  return structure.positions.map((p, idx) => {
                    const width = (structure.width || 200) * zoom;
                    const height = (structure.height || 200) * zoom;
                    const isDragging = draggingStructureId === structure.id;
                    const Icon = (structure.type === 'landmark' && structure.icon && ICON_MAP[structure.icon as keyof typeof ICON_MAP]) ? ICON_MAP[structure.icon as keyof typeof ICON_MAP] : null;
                    
                    const left = isDragging && mousePos 
                      ? mousePos.x - (width / 2)
                      : (p.x * zoom) - (width / 2);
                    const top = isDragging && mousePos
                      ? mousePos.y - (height / 2)
                      : (p.y * zoom) - (height / 2);
                    
                    return (
                      <div
                        key={`${structure.id}-${idx}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (e.button !== 0) return; // Only left click
                          if (isPlanLocked || !containerRef.current) return;
                          
                          const rect = containerRef.current.getBoundingClientRect();
                          const mouseX = e.clientX - rect.left;
                          const mouseY = e.clientY - rect.top;
                          
                          const elementCenterX = p.x * zoom;
                          const elementCenterY = p.y * zoom;
                          
                          setDragOffset({
                            x: mouseX - elementCenterX,
                            y: mouseY - elementCenterY
                          });
                          setDragStartMousePos({ x: mouseX, y: mouseY });
                          setDraggingStructureId(structure.id);
                          setIsActuallyDragging(false);
                        }}
                        onClick={(e) => handleStructureClick(e, structure.id)}
                        className={`absolute flex items-center justify-center shadow-sm cursor-move hover:ring-2 hover:ring-emerald-400 hover:z-10 transition-shadow group ${isDragging ? 'z-30 ring-2 ring-emerald-500 opacity-70' : ''}`}
                        style={{
                          left,
                          top,
                          width,
                          height,
                          backgroundColor: structure.type === 'landmark' ? 'transparent' : `${structure.color || '#78716c'}80`,
                          border: structure.type === 'landmark' ? 'none' : `2px solid ${structure.color || '#78716c'}`,
                          borderRadius: '8px'
                        }}
                        title={`${structure.name}\n${structure.width}x${structure.height}cm\nGlissez pour déplacer, Cliquez pour retirer`}
                      >
                        {Icon ? (
                          <Icon className="w-1/2 h-1/2 text-stone-600 opacity-80" />
                        ) : (
                          <span className="text-xs font-medium text-white drop-shadow-md px-1 text-center leading-tight">{structure.name}</span>
                        )}

                        {showCoordinates && (
                          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-stone-800/90 text-white text-[9px] px-1.5 py-0.5 rounded-md shadow-sm whitespace-nowrap pointer-events-none z-20 font-mono border border-stone-600">
                            {Math.round(p.x)}, {Math.round(p.y)}
                          </div>
                        )}
                      </div>
                    );
                  });
                })}

                {/* Render trees */}
                {placedTrees.map(tree => {
                  const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree.species || '').toLowerCase().trim());
                  const spacing = tree.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200); // Use tree-specific spacing if available
                  const radius = (spacing / 2) * zoom;
                  const customColor = encEntry?.color || '#059669';
                  const IconComponent = ICON_MAP[encEntry?.icon || ''] || Trees;
                  const isSelected = tree.id === selectedTreeId;
                  const linkInfo = getTreeCatalogLinkInfo(tree);
                  const isLegacyTree = linkInfo.status !== 'catalog';

                  const left = (tree.positionX * zoom) - radius;
                  const top = (tree.positionY * zoom) - radius;
                  
                  return (
                    <div
                      key={tree.id}
                      onMouseDown={(e) => handleTreeMouseDown(e, tree.id)}
                      onClick={(e) => handleTreeClick(e, tree.id)}
                      className={`absolute rounded-full flex items-center justify-center shadow-md cursor-pointer hover:ring-2 hover:ring-emerald-400 hover:z-10 transition-all group ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-1 z-10 scale-110' : ''} ${draggingTreeId === tree.id ? 'opacity-0' : ''}`}
                      style={{
                        left,
                        top,
                        width: spacing * zoom,
                        height: spacing * zoom,
                        backgroundColor: `${customColor}30`,
                        border: isLegacyTree ? '2px dashed #d97706' : `2px solid ${customColor}`,
                        boxShadow: isSelected ? `0 0 15px ${customColor}60` : 'none'
                      }}
                      title={`${tree.species} - ${tree.variety || 'Sans variété'}\nStatut: ${isLegacyTree ? `Ancienne fiche (${linkInfo.reason})` : 'Lié au Catalogue des Plantes'}\nEspacement: ${spacing}cm\nPosition: ${tree.positionX}cm, ${tree.positionY}cm\n${tree.isLocked ? 'Verrouillé' : 'Cliquez pour sélectionner'}`}
                    >
                      {showCoordinates && (
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-emerald-800/90 text-white text-[9px] px-1.5 py-0.5 rounded-md shadow-sm whitespace-nowrap pointer-events-none z-20 font-mono border border-emerald-600">
                          {Math.round(tree.positionX)}, {Math.round(tree.positionY)}
                        </div>
                      )}
                      {isLegacyTree && (
                        <div
                          className="absolute -top-1 -left-1 bg-amber-500 text-white w-4 h-4 rounded-full shadow-sm z-20 flex items-center justify-center border border-white"
                          title="Ancienne fiche / hors catalogue : cliquez sur l'arbre pour le rattacher au Catalogue"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                        </div>
                      )}
                      {tree.isLocked && (
                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full shadow-sm z-20">
                          <Lock className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity overflow-hidden shadow-inner" 
                        style={{ 
                          background: `radial-gradient(circle at 30% 30%, ${customColor}, ${customColor}dd)`,
                          boxShadow: `0 2px 4px rgba(0,0,0,0.2)`
                        }}
                      >
                        {tree.photo ? (
                          <img src={tree.photo} alt={tree.species} className="w-full h-full object-cover" />
                        ) : isEmoji(encEntry?.icon || '') ? (
                          <span className="text-xl">{encEntry?.icon}</span>
                        ) : (
                          <IconComponent className="w-5 h-5 text-white drop-shadow-sm" />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Render preview of tree being added */}
                {isAddingTree && newTree.positionX !== undefined && (
                  <div
                    className="absolute rounded-full flex items-center justify-center shadow-md opacity-60 ring-2 ring-emerald-400 ring-dashed z-20"
                    style={{
                      left: (newTree.positionX * zoom) - ((newTree.spacing || 200) / 2) * zoom,
                      top: (newTree.positionY * zoom) - ((newTree.spacing || 200) / 2) * zoom,
                      width: (newTree.spacing || 200) * zoom,
                      height: (newTree.spacing || 200) * zoom,
                      backgroundColor: `${newTree.color || '#10b981'}40`,
                      border: `2px dashed ${newTree.color || '#10b981'}`,
                    }}
                  >
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center" 
                      style={{ backgroundColor: newTree.color || '#10b981' }}
                    >
                      {isEmoji(newTree.icon) ? (
                        <span className="text-xl">{newTree.icon}</span>
                      ) : (
                        React.createElement(ICON_MAP[newTree.icon || 'Trees'] || Trees, { className: "w-5 h-5 text-white" })
                      )}
                    </div>
                  </div>
                )}

                {/* Ruler Tool */}
                {isMeasuring && measureStart && mousePos && (
                  <div className="absolute pointer-events-none z-30" style={{ left: 0, top: 0, width: '100%', height: '100%' }}>
                    <svg width="100%" height="100%" className="absolute inset-0 overflow-visible">
                      <line 
                        x1={measureStart.x * zoom} 
                        y1={measureStart.y * zoom} 
                        x2={mousePos.x} 
                        y2={mousePos.y} 
                        stroke="#3b82f6" 
                        strokeWidth="2" 
                        strokeDasharray="4 4" 
                      />
                      <circle cx={measureStart.x * zoom} cy={measureStart.y * zoom} r="4" fill="#3b82f6" />
                      <circle cx={mousePos.x} cy={mousePos.y} r="4" fill="#3b82f6" />
                    </svg>
                    <div 
                      className="absolute bg-blue-600 text-white text-[10px] px-2 py-1 rounded shadow-md font-mono whitespace-nowrap"
                      style={{ 
                        left: (measureStart.x * zoom + mousePos.x) / 2, 
                        top: (measureStart.y * zoom + mousePos.y) / 2 - 20,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      {Math.round(Math.sqrt(Math.pow(mousePos.x / zoom - measureStart.x, 2) + Math.pow(mousePos.y / zoom - measureStart.y, 2)))} cm
                    </div>
                  </div>
                )}

                {/* Render ghost element */}
                {mousePos && !isMeasuring && (
                  <div
                    className="absolute pointer-events-none z-20 flex items-center justify-center"
                    style={
                      draggingTreeId ? (() => {
                        const tree = trees?.find(t => t.id === draggingTreeId);
                        const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree?.species || '').toLowerCase().trim());
                        const spacing = tree?.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200);
                        const color = encEntry?.color || '#10b981';
                        return {
                          left: mousePos.x - (spacing / 2) * zoom,
                          top: mousePos.y - (spacing / 2) * zoom,
                          width: spacing * zoom,
                          height: spacing * zoom,
                          backgroundColor: `${color}60`,
                          border: `2px dashed ${color}`,
                          borderRadius: '50%'
                        };
                      })() : draggingStructureId ? (() => {
                        const structure = structures?.find(s => s.id === draggingStructureId);
                        return {
                          left: mousePos.x - ((structure?.width || 200) * zoom) / 2,
                          top: mousePos.y - ((structure?.height || 200) * zoom) / 2,
                          width: (structure?.width || 200) * zoom,
                          height: (structure?.height || 200) * zoom,
                          backgroundColor: `${structure?.color || '#78716c'}60`,
                          border: `2px dashed ${structure?.color || '#78716c'}`,
                          borderRadius: '8px'
                        };
                      })() : isAddingStructure ? {
                        left: mousePos.x - ((newStructure.width || 200) * zoom) / 2,
                        top: mousePos.y - ((newStructure.height || 200) * zoom) / 2,
                        width: (newStructure.width || 200) * zoom,
                        height: (newStructure.height || 200) * zoom,
                        backgroundColor: `${newStructure.color}60`,
                        border: `2px dashed ${newStructure.color}`,
                        borderRadius: '8px'
                      } : (toolMode === 'add' || isAddingTree || isMovingTree || isCopyingTree) ? (() => {
                        const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim());
                        const spacing = newTree.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200);
                        return {
                          left: mousePos.x - (spacing / 2) * zoom,
                          top: mousePos.y - (spacing / 2) * zoom,
                          width: spacing * zoom,
                          height: spacing * zoom,
                          backgroundColor: `${newTree.color || '#10b981'}60`,
                          border: `2px dashed ${newTree.color || '#10b981'}`,
                          borderRadius: '50%'
                        };
                      })() : {}
                    }
                  >
                    {draggingTreeId && (() => {
                      const tree = trees?.find(t => t.id === draggingTreeId);
                      const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree?.species || '').toLowerCase().trim());
                      const color = encEntry?.color || '#10b981';
                      const icon = encEntry?.icon || 'Trees';
                      return (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                          {isEmoji(icon) ? (
                            <span className="text-xl">{icon}</span>
                          ) : (
                            React.createElement(ICON_MAP[icon] || Trees, { className: "w-5 h-5 text-white" })
                          )}
                        </div>
                      );
                    })()}
                    {(isAddingTree || isMovingTree || isCopyingTree) && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: newTree.color || '#10b981' }}>
                        {isEmoji(newTree.icon) ? (
                          <span className="text-xl">{newTree.icon}</span>
                        ) : (
                          React.createElement(ICON_MAP[newTree.icon || 'Trees'] || Trees, { className: "w-5 h-5 text-white" })
                        )}
                      </div>
                    )}
                    <div 
                      className={`absolute bg-stone-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap flex flex-col items-center gap-0.5 shadow-lg z-50 ${mousePos.y > (containerRef.current?.clientHeight || 0) / 2 ? '-top-20' : '-bottom-20'}`}
                    >
                      <div className="font-bold border-b border-white/20 pb-0.5 mb-0.5 w-full text-center">
                        Centre: {Math.round(mousePos.x / zoom)}cm, {Math.round(mousePos.y / zoom)}cm
                      </div>
                      <div className="flex flex-col gap-0.5 opacity-90">
                        <div className="flex justify-between gap-4">
                          <span>Bord G: {Math.round((mousePos.x - getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).minX * zoom - (() => {
                            if (draggingTreeId) {
                              const tree = trees?.find(t => t.id === draggingTreeId);
                              const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree?.species || '').toLowerCase().trim());
                              return ((tree?.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200)) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.width || 200) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.width || 200) / 2) * zoom;
                            return ((newTree.spacing || (newTree.species ? (encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim())?.spacing ? parseInt(encyclopedia.find(e => (e.name || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim())!.spacing!) : 200) : 200)) / 2) * zoom;
                          })()) / zoom)}cm</span>
                          <span>Bord D: {Math.round((getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).maxX * zoom - (mousePos.x + (() => {
                            if (draggingTreeId) {
                              const tree = trees?.find(t => t.id === draggingTreeId);
                              const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree?.species || '').toLowerCase().trim());
                              return ((tree?.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200)) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.width || 200) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.width || 200) / 2) * zoom;
                            return ((newTree.spacing || (newTree.species ? (encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim())?.spacing ? parseInt(encyclopedia.find(e => (e.name || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim())!.spacing!) : 200) : 200)) / 2) * zoom;
                          })())) / zoom)}cm</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Bord H: {Math.round((mousePos.y - getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).minY * zoom - (() => {
                            if (draggingTreeId) {
                              const tree = trees?.find(t => t.id === draggingTreeId);
                              const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree?.species || '').toLowerCase().trim());
                              return ((tree?.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200)) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.height || 200) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.height || 200) / 2) * zoom;
                            return ((newTree.spacing || (newTree.species ? (encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim())?.spacing ? parseInt(encyclopedia.find(e => (e.name || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim())!.spacing!) : 200) : 200)) / 2) * zoom;
                          })()) / zoom)}cm</span>
                          <span>Bord B: {Math.round((getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).maxY * zoom - (mousePos.y + (() => {
                            if (draggingTreeId) {
                              const tree = trees?.find(t => t.id === draggingTreeId);
                              const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree?.species || '').toLowerCase().trim());
                              return ((tree?.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200)) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.height || 200) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.height || 200) / 2) * zoom;
                            return ((newTree.spacing || (newTree.species ? (encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim())?.spacing ? parseInt(encyclopedia.find(e => (e.name || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim())!.spacing!) : 200) : 200)) / 2) * zoom;
                          })())) / zoom)}cm</span>
                        </div>
                        {(() => {
                          const nearest = getNearestElementDistance(mousePos.x / zoom, mousePos.y / zoom, draggingTreeId || draggingStructureId || undefined);
                          if (nearest) {
                            return (
                              <div className="mt-0.5 pt-0.5 border-t border-white/20 text-emerald-400 font-medium text-center">
                                Proche de {nearest.name}: {nearest.dist}cm
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-stone-400 mt-4 text-center">
              La grille de fond représente des carrés de {gridSize}x{gridSize} cm. Cliquez sur le plan pour placer vos arbres ou éléments.
            </p>

            <div className="mt-8 print:block hidden">
              <h3 className="text-lg font-medium text-stone-900 mb-4">Légende</h3>
              <div className="grid grid-cols-2 gap-4">
                {speciesLegend.map((species, idx) => {
                  const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (species || '').toLowerCase().trim());
                  const customColor = encEntry?.color || '#10b981';
                  const IconComponent = ICON_MAP[encEntry?.icon || ''] || Trees;
                  return (
                    <div key={`print-legend-${species}-${idx}`} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: customColor }}>
                        {isEmoji(encEntry?.icon || '') ? (
                          <span className="text-sm">{encEntry?.icon}</span>
                        ) : (
                          <IconComponent className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className="text-stone-700 font-medium">{species}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6 print:hidden">
            {/* Legend */}
            {speciesLegend.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60">
                <h3 className="text-sm font-medium text-stone-900 mb-4 uppercase tracking-wider">Légende des espèces</h3>
                <div className="flex flex-wrap gap-3">
                  {speciesLegend.map((species, idx) => {
                    const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (species || '').toLowerCase().trim());
                    const customColor = encEntry?.color || '#10b981';
                    const IconComponent = ICON_MAP[encEntry?.icon || ''] || Trees;

                    return (
                      <div key={`legend-${species}-${idx}`} className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 rounded-full border border-stone-100">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: customColor }}>
                          {isEmoji(encEntry?.icon || '') ? (
                            <span className="text-[10px]">{encEntry?.icon}</span>
                          ) : (
                            <IconComponent className="w-2.5 h-2.5 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-stone-700">{species}</span>
                        <span className="text-xs text-stone-400 font-medium">
                          ({treesInCurrentTerrain.filter(t => t.species === species).length})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isAddingTree && newTree.positionX !== undefined && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60">
                <h2 className="text-lg font-medium text-stone-900 mb-1 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  Placer un arbre du catalogue
                </h2>
                <p className="text-xs text-stone-500 mb-4">
                  Sélection strictement liée au Catalogue des Plantes pour éviter tout doublon.
                </p>
                <form onSubmit={handleSaveTree} className="space-y-4">
                  <div className="text-xs text-stone-600 bg-stone-50 px-3 py-2 rounded-lg border border-stone-200/70">
                    Position sur le plan : <strong>{newTree.positionX}cm</strong>, <strong>{newTree.positionY}cm</strong> (cliquez sur le plan pour ajuster)
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Espèce (du catalogue) *</label>
                    <select
                      required
                      value={newTree.species || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const existing = encyclopedia?.find((c: any) => (c.name || '').toLowerCase() === val.toLowerCase());
                        const allowedVars = getCatalogVarietiesForSpecies(val);
                        const keepVariety = allowedVars.find(v => v.toLowerCase() === (newTree.variety || '').toLowerCase()) || '';
                        setNewTree({
                          ...newTree,
                          species: existing?.name || val,
                          variety: keepVariety,
                          color: existing?.color || '#10b981',
                          icon: existing?.icon || 'Trees',
                          spacing: existing?.spacing ? parseInt(existing.spacing) : (newTree.spacing || 200)
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                    >
                      <option value="">-- Choisir une espèce du catalogue --</option>
                      {(() => {
                        const optionsMap = new Map<string, string>();
                        fruitTreeCatalog.forEach(sp => {
                          optionsMap.set(sp.name.toLowerCase(), sp.name);
                        });
                        if (newTree.species && !optionsMap.has(newTree.species.toLowerCase())) {
                          optionsMap.set(newTree.species.toLowerCase(), newTree.species);
                        }
                        return Array.from(optionsMap.values())
                          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
                          .map(name => (
                            <option key={name} value={name}>{name}</option>
                          ));
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Variété (du catalogue)</label>
                    <select
                      value={newTree.variety || ''}
                      onChange={e => setNewTree({ ...newTree, variety: e.target.value })}
                      disabled={!newTree.species}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white disabled:bg-stone-100"
                    >
                      <option value="">Aucune variété spécifique</option>
                      {(() => {
                        const speciesVarieties = newTree.species ? getCatalogVarietiesForSpecies(newTree.species) : [];
                        const list = [...speciesVarieties];
                        if (newTree.variety && !list.some(v => v.toLowerCase() === newTree.variety.toLowerCase())) {
                          list.unshift(newTree.variety);
                        }
                        return list.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ));
                      })()}
                    </select>

                    {/* Variety chips for selected species */}
                    {newTree.species && (() => {
                      const speciesVarieties = getCatalogVarietiesForSpecies(newTree.species);
                      if (speciesVarieties.length === 0) return null;
                      return (
                        <div className="mt-2">
                          <span className="text-[11px] font-medium text-stone-400 block mb-1">Variétés du catalogue :</span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                            {speciesVarieties.map(v => {
                              const countOnPlan = treesInCurrentTerrain.filter((t: any) => 
                                (t.species || '').toLowerCase().trim() === (newTree.species || '').toLowerCase().trim() &&
                                (t.variety || '').toLowerCase().trim() === (v || '').toLowerCase().trim()
                              ).length;
                              const isSelected = (newTree.variety || '').toLowerCase().trim() === (v || '').toLowerCase().trim();
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setNewTree({ ...newTree, variety: v })}
                                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isSelected 
                                      ? 'bg-emerald-600 text-white shadow-xs' 
                                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
                                  }`}
                                >
                                  <span>{v}</span>
                                  {countOnPlan > 0 ? (
                                    <span className={`text-[10px] px-1 rounded-full font-bold flex items-center gap-0.5 ${
                                      isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      <MapPin className="w-2.5 h-2.5" />
                                      {countOnPlan}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-stone-400 opacity-70">
                                      0
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {setCurrentView && (
                      <button
                        type="button"
                        onClick={() => setCurrentView('encyclopedia')}
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Ajouter une espèce ou variété manquante dans le Catalogue des Plantes</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date de plantation</label>
                    <input
                      type="date"
                      value={newTree.datePlanted || ''}
                      onChange={e => setNewTree({...newTree, datePlanted: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Photo</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-stone-300 border-dashed rounded-xl hover:border-emerald-500 transition-colors">
                      <div className="space-y-1 text-center">
                        {photoPreview ? (
                          <div className="relative">
                            <img src={photoPreview} alt="Preview" className="mx-auto h-32 object-cover rounded-lg" />
                            <button
                              type="button"
                              onClick={() => { setPhotoPreview(null); setNewTree({...newTree, photo: undefined}); }}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="mx-auto h-12 w-12 text-stone-400" />
                            <div className="flex text-sm text-stone-600">
                              <label htmlFor="photo-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-emerald-500">
                                <span>Télécharger un fichier</span>
                                <input id="photo-upload" name="photo-upload" type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} />
                              </label>
                            </div>
                            <p className="text-xs text-stone-500">PNG, JPG, GIF jusqu'à 5MB</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Commentaires</label>
                    <textarea
                      value={newTree.comments || ''}
                      onChange={e => setNewTree({...newTree, comments: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTree(false);
                        setToolMode('select');
                        setPendingPlacementNotice(null);
                        setNewTree({});
                        setPhotoPreview(null);
                      }}
                      className="flex-1 px-4 py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium transition-colors"
                    >
                      Placer sur le plan
                    </button>
                  </div>
                </form>
              </div>
            )}

            {selectedTreeDetails && !isAddingTree && (
              <>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden">
                  {isEditingTree ? (
                    <form onSubmit={handleUpdateTree} className="space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-stone-900">Modifier l'arbre</h3>
                        <button 
                          type="button"
                          onClick={() => setIsEditingTree(false)}
                          className="text-stone-400 hover:text-stone-600"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Espèce (du catalogue)</label>
                        <select
                          required
                          value={editTreeData.species || ''}
                          onChange={e => {
                            const val = e.target.value;
                            const existing = encyclopedia?.find((c: any) => (c.name || '').toLowerCase() === val.toLowerCase());
                            const allowedVars = getCatalogVarietiesForSpecies(val);
                            const keepVar = allowedVars.find(v => v.toLowerCase() === (editTreeData.variety || '').toLowerCase()) || '';
                            setEditTreeData({
                              ...editTreeData,
                              species: existing?.name || val,
                              variety: keepVar,
                              color: existing?.color || editTreeData.color,
                              icon: existing?.icon || editTreeData.icon
                            });
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          {(() => {
                            const optionsMap = new Map<string, string>();
                            fruitTreeCatalog.forEach(sp => optionsMap.set(sp.name.toLowerCase(), sp.name));
                            if (editTreeData.species && !optionsMap.has(editTreeData.species.toLowerCase())) {
                              optionsMap.set(editTreeData.species.toLowerCase(), editTreeData.species);
                            }
                            return Array.from(optionsMap.values())
                              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
                              .map(name => (
                                <option key={name} value={name}>{name}</option>
                              ));
                          })()}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Variété (du catalogue)</label>
                        <select
                          value={editTreeData.variety || ''}
                          onChange={e => setEditTreeData({ ...editTreeData, variety: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          <option value="">Aucune variété spécifique</option>
                          {(() => {
                            const catalogVars = getCatalogVarietiesForSpecies(editTreeData.species || '');
                            const list = [...catalogVars];
                            const hasCurrentInCatalog = editTreeData.variety && list.some(v => v.toLowerCase() === editTreeData.variety.toLowerCase());
                            if (editTreeData.variety && !hasCurrentInCatalog) {
                              list.unshift(editTreeData.variety);
                            }
                            return list.map(v => {
                              const isLegacy = editTreeData.variety === v && !catalogVars.some(cv => cv.toLowerCase() === v.toLowerCase());
                              return (
                                <option key={v} value={v}>
                                  {isLegacy ? `${v} (actuelle — hors catalogue)` : v}
                                </option>
                              );
                            });
                          })()}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">Date de plantation</label>
                          <input
                            type="date"
                            value={editTreeData.datePlanted || ''}
                            onChange={e => setEditTreeData({...editTreeData, datePlanted: e.target.value})}
                            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">Envergure (cm)</label>
                          <input
                            type="number"
                            min="50"
                            step="10"
                            value={editTreeData.spacing || 200}
                            onChange={e => setEditTreeData({...editTreeData, spacing: parseInt(e.target.value) || 200})}
                            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Commentaires</label>
                        <textarea
                          value={editTreeData.comments || ''}
                          onChange={e => setEditTreeData({...editTreeData, comments: e.target.value})}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Photo</label>
                        <div className="mt-1 flex justify-center px-4 py-4 border-2 border-stone-200 border-dashed rounded-xl hover:border-emerald-500 transition-colors">
                          <div className="space-y-1 text-center">
                            {editTreeData.photo ? (
                              <div className="relative">
                                <img src={editTreeData.photo} alt="Preview" className="mx-auto h-24 object-cover rounded-lg" />
                                <button
                                  type="button"
                                  onClick={() => setEditTreeData({...editTreeData, photo: undefined})}
                                  className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <ImageIcon className="mx-auto h-8 w-8 text-stone-400 mb-1" />
                                <label className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 text-xs">
                                  <span>Télécharger une photo</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="sr-only" 
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          const compressedBase64 = await compressImage(file, 800, 800, 0.7);
                                          setEditTreeData({ ...editTreeData, photo: compressedBase64 });
                                        } catch (error) {
                                          console.error("Failed to compress image:", error);
                                        }
                                      }
                                    }} 
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
                        <div className="flex items-center gap-2">
                          {editTreeData.isLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-stone-400" />}
                          <span className="text-sm font-medium text-stone-700">Figer l'arbre</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditTreeData({...editTreeData, isLocked: !editTreeData.isLocked})}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${editTreeData.isLocked ? 'bg-amber-500' : 'bg-stone-200'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editTreeData.isLocked ? 'translate-x-6' : 'translate-x-1'}`}
                          />
                        </button>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingTree(false);
                            setShowSpeciesCustomization(false);
                          }}
                          className="flex-1 px-4 py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="flex-1 px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium transition-colors"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {totalRemainingPlantsToPlace > 0 && (
                        <div className="pb-2.5 mb-3 border-b border-stone-100">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTreeId(null);
                              setIsEditingTree(false);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                          >
                            <Sprout className="w-3.5 h-3.5 shrink-0" />
                            <span>← Liste à positionner ({totalRemainingPlantsToPlace})</span>
                          </button>
                        </div>
                      )}

                      <div className="space-y-3 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <h2 className="text-xl font-medium text-stone-900 break-words">{selectedTreeDetails.species}</h2>
                            {selectedTreeDetails.isLocked && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-wider rounded-full border border-amber-100 flex items-center gap-1 shrink-0">
                                <Lock className="w-2.5 h-2.5" />
                                Figé
                              </span>
                            )}
                          </div>
                          {selectedTreeDetails.variety ? (
                            <p className="text-stone-600 font-medium text-sm break-words">{selectedTreeDetails.variety}</p>
                          ) : (
                            <p className="text-stone-400 italic text-xs">Aucune variété attribuée</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1 bg-stone-50 p-1 rounded-xl border border-stone-200/70">
                          <button
                            type="button"
                            onClick={() => {
                              const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (selectedTreeDetails.species || '').toLowerCase().trim());
                              setIsEditingTree(true);
                              setEditTreeData({
                                ...selectedTreeDetails,
                                color: encEntry?.color || '#10b981',
                                icon: encEntry?.icon || 'Trees'
                              });
                            }}
                            className="flex-1 flex items-center justify-center text-stone-500 hover:text-emerald-600 py-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                            title="Modifier l'arbre"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fb.update("trees", selectedTreeDetails.id, { isLocked: !selectedTreeDetails.isLocked });
                            }}
                            className={`flex-1 flex items-center justify-center py-1.5 rounded-lg transition-colors cursor-pointer ${selectedTreeDetails.isLocked ? 'text-amber-600 bg-amber-100/80' : 'text-stone-500 hover:text-amber-600 hover:bg-white'}`}
                            title={selectedTreeDetails.isLocked ? "Déverrouiller l'arbre" : "Verrouiller l'arbre"}
                          >
                            {selectedTreeDetails.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsMovingTree(true);
                              setIsCopyingTree(false);
                            }}
                            className={`flex-1 flex items-center justify-center py-1.5 rounded-lg transition-colors cursor-pointer ${isMovingTree ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-500 hover:text-emerald-600 hover:bg-white'}`}
                            title="Déplacer l'arbre"
                          >
                            <MapIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCopyingTree(true);
                              setIsMovingTree(false);
                            }}
                            className={`flex-1 flex items-center justify-center py-1.5 rounded-lg transition-colors cursor-pointer ${isCopyingTree ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-500 hover:text-emerald-600 hover:bg-white'}`}
                            title="Copier l'arbre"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTree(selectedTreeDetails.id)}
                            className="flex-1 flex items-center justify-center text-stone-500 hover:text-red-500 py-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                            title="Supprimer l'arbre"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Catalog vs Legacy Status Banner + Validated Re-attachment */}
                      {selectedTreeLinkInfo && (
                        <div className={`mb-4 rounded-xl border p-3 text-xs space-y-2.5 ${
                          selectedTreeLinkInfo.status === 'catalog'
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            : 'bg-amber-50/90 border-amber-300 text-amber-950'
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              {selectedTreeLinkInfo.status === 'catalog' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0">
                                <div className="font-bold flex items-center gap-1.5 flex-wrap">
                                  <span>
                                    {selectedTreeLinkInfo.status === 'catalog'
                                      ? 'Lié au Catalogue des Plantes'
                                      : selectedTreeLinkInfo.status === 'category_disabled'
                                        ? 'Catégorie exclue du plan'
                                        : 'Ancienne fiche (hors catalogue)'}
                                  </span>
                                </div>
                                <p className={`text-[11px] mt-0.5 leading-snug ${
                                  selectedTreeLinkInfo.status === 'catalog' ? 'text-emerald-800' : 'text-amber-800'
                                }`}>
                                  {selectedTreeLinkInfo.reason}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {selectedTreeLinkInfo.matchedEnc && setCurrentView && (
                              <button
                                type="button"
                                onClick={() =>
                                  openPlantInCatalog(
                                    selectedTreeLinkInfo.matchedEnc.name,
                                    selectedTreeLinkInfo.matchedEnc.id,
                                    'varieties'
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 font-medium transition-colors cursor-pointer"
                              >
                                <BookOpen className="w-3 h-3 text-emerald-600" />
                                <span>Voir la fiche Catalogue</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowReattachPanel(prev => !prev)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                                selectedTreeLinkInfo.status === 'catalog'
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                              }`}
                            >
                              <Link2 className="w-3 h-3" />
                              <span>
                                {showReattachPanel
                                  ? 'Masquer le rattachement'
                                  : selectedTreeLinkInfo.status === 'catalog'
                                    ? 'Changer de variété Catalogue'
                                    : 'Rattacher au Catalogue'}
                              </span>
                            </button>
                            {unlinkedTreesInTerrain.length > 0 && (
                              <button
                                type="button"
                                onClick={selectNextUnlinkedTree}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold transition-colors cursor-pointer"
                                title="Passer à l'arbre suivant à rattacher sur ce terrain"
                              >
                                <span>Suivant ({unlinkedTreesInTerrain.length})</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {reattachFeedback && (
                            <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 font-semibold flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span>{reattachFeedback}</span>
                            </div>
                          )}

                          {showReattachPanel && (
                            <div className="pt-2.5 border-t border-stone-200/80 space-y-2.5 bg-white/90 rounded-xl p-2.5">
                              <div className="font-semibold text-stone-800 text-[11px] uppercase tracking-wider">
                                Attribution & Validation Catalogue
                              </div>

                              <div>
                                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                                  1. Espèce du Catalogue
                                </label>
                                <select
                                  value={reattachSpecies}
                                  onChange={(e) => {
                                    const nextSp = e.target.value;
                                    setReattachSpecies(nextSp);
                                    const nextVars = getCatalogVarietyObjectsForSpecies(nextSp);
                                    const exactVar = selectedTreeDetails.variety
                                      ? nextVars.find(
                                          (v: any) =>
                                            (v.value || '').toLowerCase().trim() ===
                                            selectedTreeDetails.variety.toLowerCase().trim()
                                        )
                                      : undefined;
                                    setReattachVariety(exactVar?.value || '');
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white text-stone-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                  <option value="">-- Sélectionner une espèce du Catalogue --</option>
                                  {catalogOrchardSpecies.map((sp) => (
                                    <option key={sp.id} value={sp.name}>
                                      {sp.name} ({sp.category})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {reattachSpecies && (() => {
                                const catalogVars = getCatalogVarietyObjectsForSpecies(reattachSpecies);
                                const targetSp = catalogOrchardSpecies.find(
                                  (s) => s.name.toLowerCase() === reattachSpecies.toLowerCase()
                                );
                                const bestFuzzyVar =
                                  selectedTreeDetails.variety && !reattachVariety
                                    ? catalogVars
                                        .map((v: any) => ({
                                          item: v,
                                          score: computeVarietySimilarity(
                                            selectedTreeDetails.variety,
                                            v.value || ''
                                          ),
                                        }))
                                        .sort((a, b) => b.score - a.score)
                                        .find((r) => r.score >= 60)
                                    : undefined;

                                const selectedVarObj = reattachVariety
                                  ? catalogVars.find(
                                      (v: any) =>
                                        (v.value || '').toLowerCase() === reattachVariety.toLowerCase()
                                    )
                                  : undefined;

                                const canValidate =
                                  Boolean(targetSp) &&
                                  (catalogVars.length === 0 || Boolean(selectedVarObj));

                                const alreadyPlacedForVar = selectedVarObj
                                  ? treesInCurrentTerrain.filter(
                                      (t: any) =>
                                        t.id !== selectedTreeDetails.id &&
                                        (t.species || '').toLowerCase().trim() ===
                                          reattachSpecies.toLowerCase().trim() &&
                                        (t.variety || '').toLowerCase().trim() ===
                                          (selectedVarObj.value || '').toLowerCase().trim()
                                    ).length
                                  : 0;
                                const declaredQty = selectedVarObj
                                  ? Math.max(1, Number(selectedVarObj.attributes?.quantity ?? 1) || 1)
                                  : 1;
                                const varPlantings = selectedVarObj
                                  ? getVarietyPlantings(selectedVarObj.attributes)
                                  : [];
                                const firstRootstock = varPlantings.find((p) => p.rootstock)?.rootstock;
                                const firstDate = varPlantings.find((p) => p.datePlanted)?.datePlanted;

                                return (
                                  <>
                                    <div>
                                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                                        2. Variété du Catalogue ({catalogVars.length} disponible{catalogVars.length > 1 ? 's' : ''})
                                      </label>
                                      {catalogVars.length > 0 ? (
                                        <select
                                          value={reattachVariety}
                                          onChange={(e) => setReattachVariety(e.target.value)}
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white text-stone-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        >
                                          <option value="">-- Choisir la variété exacte --</option>
                                          {catalogVars.map((v: any) => (
                                            <option key={v.id} value={v.value}>
                                              {v.value}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-[11px] text-stone-600">
                                          Aucune variété enregistrée pour « {reattachSpecies} » dans le Catalogue.
                                        </div>
                                      )}

                                      {bestFuzzyVar && (
                                        <button
                                          type="button"
                                          onClick={() => setReattachVariety(bestFuzzyVar.item.value)}
                                          className="mt-1.5 w-full text-left px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between gap-2 cursor-pointer"
                                        >
                                          <span>
                                            Suggestion proche : <strong>{bestFuzzyVar.item.value}</strong> ({bestFuzzyVar.score}%)
                                          </span>
                                          <span className="font-bold underline shrink-0">Sélectionner</span>
                                        </button>
                                      )}

                                      {setCurrentView && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openPlantInCatalog(
                                              reattachSpecies,
                                              targetSp?.encyclopediaId,
                                              'varieties'
                                            )
                                          }
                                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                                        >
                                          <Plus className="w-3 h-3" />
                                          <span>Variété manquante ? Ajouter dans le Catalogue des Plantes</span>
                                        </button>
                                      )}
                                    </div>

                                    {/* Before / After Validation Summary */}
                                    {canValidate && (
                                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 space-y-2">
                                        <div className="text-[11px] font-bold text-emerald-900">
                                          Vérification avant validation :
                                        </div>
                                        <div className="grid grid-cols-1 gap-1 text-[11px] bg-white rounded-md p-2 border border-emerald-100">
                                          <div className="text-stone-500">
                                            <span className="font-semibold text-stone-700">Actuel sur plan :</span>{' '}
                                            {selectedTreeDetails.species} —{' '}
                                            {selectedTreeDetails.variety || <em className="text-stone-400">(aucune)</em>}
                                          </div>
                                          <div className="text-emerald-800 font-semibold">
                                            <span>Cible Catalogue :</span>{' '}
                                            {targetSp?.name} — {selectedVarObj ? selectedVarObj.value : '(fiche espèce)'}
                                          </div>
                                        </div>

                                        {selectedVarObj && (
                                          <div className="text-[11px] text-stone-700 space-y-0.5">
                                            <div>
                                              • Quantité catalogue : <strong>{declaredQty}</strong> • Déjà sur le plan (autres) :{' '}
                                              <strong>{alreadyPlacedForVar}</strong> → après validation :{' '}
                                              <strong className={alreadyPlacedForVar + 1 > declaredQty ? 'text-amber-700' : 'text-emerald-700'}>
                                                {alreadyPlacedForVar + 1} / {declaredQty}
                                              </strong>
                                            </div>
                                            {firstRootstock && (
                                              <div>
                                                • Porte-greffe catalogue : <strong>{firstRootstock}</strong>
                                              </div>
                                            )}
                                            {firstDate && (
                                              <div>
                                                • Date catalogue : <strong>{formatDateShortFR(firstDate) || firstDate}</strong>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        <button
                                          type="button"
                                          onClick={handleValidateReattach}
                                          className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                        >
                                          <CheckCircle2 className="w-4 h-4" />
                                          <span>Valider ce rattachement au Catalogue</span>
                                        </button>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {selectedTreeDetails.photo && (
                        <img src={selectedTreeDetails.photo} alt={selectedTreeDetails.species} className="w-full h-48 object-cover rounded-xl mb-4" />
                      )}

                      <div className="space-y-3 text-sm">
                        {selectedTreeDetails.datePlanted && (
                          <div className="flex justify-between py-2 border-b border-stone-100">
                            <span className="text-stone-500">Planté le</span>
                            <span className="font-medium text-stone-900">
                              {new Date(selectedTreeDetails.datePlanted).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        )}
                        {selectedTreeDetails.spacing && (
                          <div className="flex justify-between py-2 border-b border-stone-100">
                            <span className="text-stone-500">Envergure</span>
                            <span className="font-medium text-stone-900">
                              {selectedTreeDetails.spacing} cm
                            </span>
                          </div>
                        )}
                        {selectedTreeDetails.positionX !== undefined && (
                          <div className="flex justify-between py-2 border-b border-stone-100">
                            <span className="text-stone-500">Position</span>
                            <span className="font-medium text-stone-900">
                              {selectedTreeDetails.positionX}cm, {selectedTreeDetails.positionY}cm
                            </span>
                          </div>
                        )}
                        {selectedTreeDetails.comments && (
                          <div className="py-2">
                            <span className="text-stone-500 block mb-1">Commentaires</span>
                            <p className="text-stone-900 whitespace-pre-wrap">{selectedTreeDetails.comments}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Notes Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-medium text-lg text-stone-900">Notes & Suivi</h3>
                    <button 
                      onClick={() => setShowNoteForm(!showNoteForm)}
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une note
                    </button>
                  </div>

                  {showNoteForm && (
                    <form onSubmit={handleAddNote} className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 border-dashed space-y-3">
                      <textarea 
                        value={newNoteText}
                        onChange={e => setNewNoteText(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                        placeholder="Comment se porte cet arbre ?"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 cursor-pointer transition-colors">
                            <Camera className="w-4 h-4" />
                            <span>{newNotePhotos.length > 0 ? `${newNotePhotos.length} photo(s)` : 'Photo'}</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleNotePhotoUpload} />
                          </label>
                          {newNotePhotos.length > 0 && (
                            <button type="button" onClick={() => setNewNotePhotos([])} className="text-red-500 text-[10px] hover:underline">
                              Retirer tout
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowNoteForm(false)} className="px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg">
                            Annuler
                          </button>
                          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-medium shadow-sm">
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {(!selectedTreeDetails.notes || selectedTreeDetails.notes.length === 0) ? (
                      <p className="text-stone-400 italic text-sm text-center py-4">Aucune note pour cet arbre.</p>
                    ) : (
                      [...selectedTreeDetails.notes].sort((a, b) => {
                        const ta = parseSafeDate(getNoteLatestDate(a.date, a.updates))?.getTime() ?? 0;
                        const tb = parseSafeDate(getNoteLatestDate(b.date, b.updates))?.getTime() ?? 0;
                        return tb - ta;
                      }).map((note) => {
                        const sortedUpdates = getSortedUpdates(note.updates);
                        const latestDate = getNoteLatestDate(note.date, sortedUpdates);
                        const hasUpdates = sortedUpdates.length > 0;
                        return (
                        <div key={note.id} className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60">
                          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {hasUpdates ? (
                                <>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                    <History className="w-3 h-3 text-amber-600" />
                                    MÀJ : {formatDateShortFR(latestDate)} ({sortedUpdates.length})
                                  </span>
                                  <time className="text-[11px] font-medium text-stone-500">
                                    Orig. : {formatDateShortFR(note.date) || new Date(note.date).toLocaleDateString('fr-FR')}
                                  </time>
                                </>
                              ) : (
                                <time className="text-xs font-medium text-emerald-600">
                                  {formatDateShortFR(note.date) || new Date(note.date).toLocaleDateString('fr-FR')}
                                </time>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const curr = note.successStatus || 'none';
                                  const next: 'none' | 'success' | 'failure' = curr === 'none' ? 'success' : curr === 'success' ? 'failure' : 'none';
                                  handleSetTreeNoteSuccess(note.id, next);
                                }}
                                title="Cliquer pour changer le statut (Réussite / Échec / Sans statut)"
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-all cursor-pointer ${
                                  note.successStatus === 'success'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                    : note.successStatus === 'failure'
                                    ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200/60'
                                }`}
                              >
                                {note.successStatus === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                {note.successStatus === 'failure' && <XCircle className="w-3 h-3 text-red-600" />}
                                {note.successStatus === 'success' ? 'Réussite' : note.successStatus === 'failure' ? 'Échec' : 'Sans statut'}
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFollowUpNoteId(note.id)}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors inline-flex items-center gap-1"
                                title="Ajouter ou consulter le suivi daté"
                              >
                                <History className="w-3 h-3" />
                                <span>+ Suivi</span>
                              </button>
                              <button 
                                onClick={() => {
                                  setConfirmState({
                                    isOpen: true,
                                    title: 'Supprimer la note',
                                    message: 'Voulez-vous vraiment supprimer cette note ?',
                                    isDanger: true,
                                    onConfirm: async () => {
                                      await fb.update("trees", selectedTreeId!, {
                                        notes: selectedTreeDetails.notes!.filter(n => n.id !== note.id)
                                      });
                                    }
                                  });
                                }}
                                className="text-stone-400 hover:text-red-500 transition-colors p-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {note.text && <p className="text-stone-700 text-sm whitespace-pre-wrap mb-2">{note.text}</p>}
                          {hasUpdates && (
                            <div className="mt-2 pt-2 border-t border-amber-100 space-y-1.5 border-l-2 border-amber-300 pl-2.5 ml-0.5 mb-2">
                              {sortedUpdates.map(u => (
                                <div key={u.id} className="text-xs text-stone-700 bg-amber-50/60 rounded-lg px-2 py-1.5 border border-amber-100">
                                  <span className="inline-block font-bold text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded text-[10px] mr-1.5">
                                    {formatDateShortFR(u.date) || u.date}
                                  </span>
                                  <span className="whitespace-pre-wrap">{u.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {note.photos && note.photos.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {note.photos.map((photo, index) => (
                                <img key={index} src={photo} alt="Note" className="rounded-lg border border-stone-100" />
                              ))}
                            </div>
                          )}
                        </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {!isAddingTree && !selectedTreeDetails && (
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-stone-100 bg-emerald-50/60">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-serif font-semibold text-sm text-stone-900">
                          À positionner sur le plan
                        </h3>
                        <p className="text-[11px] text-stone-500">
                          {totalRemainingPlantsToPlace > 0
                            ? `${totalRemainingPlantsToPlace} plant${totalRemainingPlantsToPlace > 1 ? 's' : ''} (${remainingToPlaceItems.length} variété${remainingToPlaceItems.length > 1 ? 's' : ''}) du Catalogue`
                            : 'Tout le catalogue verger est placé'}
                        </p>
                      </div>
                    </div>
                    {totalRemainingPlantsToPlace > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shrink-0">
                        {totalRemainingPlantsToPlace}
                      </span>
                    )}
                  </div>

                  {remainingToPlaceItems.length > 5 && (
                    <div className="relative mt-2.5">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={toPlaceSearch}
                        onChange={(e) => setToPlaceSearch(e.target.value)}
                        placeholder="Filtrer espèce ou variété..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-white rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      {toPlaceSearch && (
                        <button
                          type="button"
                          onClick={() => setToPlaceSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {remainingToPlaceItems.length === 0 ? (
                  <div className="p-5 text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Tous les plants enregistrés dans vos catégories de verger sont déjà positionnés sur le plan.
                    </p>
                  </div>
                ) : filteredRemainingToPlace.length === 0 ? (
                  <div className="p-5 text-center text-xs text-stone-500 italic">
                    Aucun plant à positionner ne correspond à « {toPlaceSearch} ».
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 max-h-[460px] overflow-y-auto">
                    {filteredRemainingToPlace.map((item) => {
                      const spColor = item.speciesData.color || '#10b981';
                      const SpIcon = ICON_MAP[item.speciesData.icon] || Trees;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            handleStartPlaceTreeOnPlan(
                              item.speciesData,
                              item.variety,
                              item.varietyId,
                              item.datePlanted
                            )
                          }
                          className="w-full text-left p-3 hover:bg-emerald-50/70 transition-colors flex items-center justify-between gap-2.5 group cursor-pointer"
                          title={`Cliquer pour placer ${item.speciesData.name}${item.variety ? ` (${item.variety})` : ''} sur le plan`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border"
                              style={{
                                backgroundColor: `${spColor}20`,
                                borderColor: spColor,
                              }}
                            >
                              {isEmoji(item.speciesData.icon) ? (
                                <span className="text-sm leading-none">{item.speciesData.icon}</span>
                              ) : (
                                <SpIcon className="w-3.5 h-3.5" style={{ color: spColor }} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-stone-900 truncate group-hover:text-emerald-800">
                                {item.speciesData.name}
                              </div>
                              <div className="text-[11px] font-medium text-stone-600 truncate">
                                {item.variety || (
                                  <span className="italic text-stone-400">Sans variété définie</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                  {item.remainingCount} à placer
                                </span>
                                {!item.isSpeciesOnly && (
                                  <span className="text-[10px] text-stone-400">
                                    ({item.placedCount}/{item.declaredQty} placé{item.placedCount > 1 ? 's' : ''})
                                  </span>
                                )}
                                {item.rootstock && (
                                  <span className="text-[10px] text-stone-500 truncate max-w-[130px]">
                                    • {item.rootstock}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className="px-2 py-1 rounded-lg bg-emerald-600 group-hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 shadow-2xs">
                            <Plus className="w-3 h-3" />
                            <span>Placer</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="p-3 bg-stone-50 border-t border-stone-100 space-y-2">
                  <p className="text-[11px] text-stone-500 text-center">
                    Cliquez sur un arbre existant du plan pour consulter sa fiche, ou ajoutez de nouvelles variétés dans le Catalogue.
                  </p>
                  {setCurrentView && (
                    <button
                      type="button"
                      onClick={() => setCurrentView('encyclopedia')}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ouvrir le Catalogue des Plantes</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Planned Trees (Wishlist) */}
        {plannedTrees.length > 0 && (
          <div className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200/60 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-medium text-amber-900 flex items-center gap-2">
                <List className="w-5 h-5 text-amber-600" />
                Projets de plantation
              </h3>
              <div className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest">En attente</div>
            </div>
            <p className="text-sm text-amber-700/80 mb-4">Ces arbres ont été planifiés depuis le calendrier des récoltes. Cliquez sur "Placer" pour les ajouter au verger.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plannedTrees.map(tree => {
                const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree.species || '').toLowerCase().trim());
                const color = encEntry?.color || '#f59e0b';
                const Icon = ICON_MAP[encEntry?.icon || ''] || Trees;
                
                return (
                  <div key={tree.id} className="flex flex-col bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
                          {isEmoji(encEntry?.icon || '') ? <span className="text-xl">{encEntry?.icon}</span> : <Icon className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-medium text-stone-900 leading-tight">{tree.species}</h4>
                          {tree.variety && <p className="text-xs text-stone-500 mt-0.5">{tree.variety}</p>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePlacePlannedTree(tree)}
                      className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-medium rounded-xl transition"
                    >
                      Placer sur le plan
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recapitulatif & Légende */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-xl font-medium text-stone-900">Légende et Récapitulatif</h3>
            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Verger</div>
          </div>
          
          {treesInCurrentTerrain.length === 0 ? (
            <p className="text-sm text-stone-500 italic text-center py-8 bg-stone-50 rounded-xl border border-dashed border-stone-200">Aucun arbre sur ce terrain.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(
                treesInCurrentTerrain.reduce((acc, tree) => {
                  if (!acc[tree.species]) {
                    acc[tree.species] = { species: tree.species, count: 0, varieties: new Set<string>() };
                  }
                  acc[tree.species].count++;
                  if (tree.variety) acc[tree.species].varieties.add(tree.variety);
                  return acc;
                }, {} as Record<string, { species: string, count: number, varieties: Set<string> }>)
              ).map(([species, data]: [string, any]) => {
                const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (species || '').toLowerCase().trim());
                const color = encEntry?.color || '#10b981';
                const Icon = ICON_MAP[encEntry?.icon || ''] || Trees;
                
                return (
                  <div key={species} className="flex items-center gap-4 bg-stone-50/50 p-4 rounded-2xl border border-stone-100 shadow-sm transition-all hover:shadow-md hover:bg-white">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center shadow-inner shrink-0" 
                      style={{ 
                        background: `radial-gradient(circle at 30% 30%, ${color}, ${color}dd)`,
                        boxShadow: `0 4px 6px ${color}30`
                      }}
                    >
                      {isEmoji(encEntry?.icon || '') ? (
                        <span className="text-2xl">{encEntry?.icon}</span>
                      ) : (
                        <Icon className="w-6 h-6 text-white drop-shadow-sm" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-stone-900 font-bold text-base leading-tight truncate">{species}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full">{data.count} arbre{data.count > 1 ? 's' : ''}</span>
                        {data.varieties.size > 0 && (
                          <span className="text-stone-400 text-[10px] font-medium truncate italic">
                            {Array.from(data.varieties).slice(0, 2).join(', ')}{data.varieties.size > 2 ? '...' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      ) : (
        <div className="space-y-6" id="orchard-list-print-area">
          {/* Summary Stats Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/70 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                <Trees className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-serif font-bold text-stone-900">{fruitTreeCatalog.length}</div>
                <div className="text-xs font-medium text-stone-500">Espèces fruitières au catalogue</div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/70 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-serif font-bold text-stone-900">{totalCatalogVarieties}</div>
                <div className="text-xs font-medium text-stone-500">Variétés répertoriées</div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/70 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-serif font-bold text-stone-900">{treesInCurrentTerrain.length}</div>
                <div className="text-xs font-medium text-stone-500">Arbres sur {selectedTerrain?.value || 'ce terrain'}</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/70 flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Rechercher une espèce (ex: Pommier, Cerisier...) ou une variété..."
                  className="w-full pl-10 pr-8 py-2 bg-stone-50 rounded-xl border border-stone-200 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
                {listSearch && (
                  <button
                    onClick={() => setListSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
                <button
                  onClick={() => setListFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    listFilterStatus === 'all'
                      ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Tous ({fruitTreeCatalog.length})
                </button>
                <button
                  onClick={() => setListFilterStatus('placed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    listFilterStatus === 'placed'
                      ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Sur le plan ({speciesOnPlanCount})
                </button>
                <button
                  onClick={() => setListFilterStatus('unplaced')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    listFilterStatus === 'unplaced'
                      ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <MapPinOff className="w-3.5 h-3.5 text-stone-400" />
                  Non placés ({speciesNotOnPlanCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {setCurrentView && (
                <button
                  onClick={() => setCurrentView('encyclopedia')}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Ouvrir le catalogue des plantes pour gérer les fiches"
                >
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Catalogue des Plantes</span>
                  <ExternalLink className="w-3 h-3 text-emerald-600/70" />
                </button>
              )}

              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
                <button
                  onClick={() => setListLayout('catalog')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    listLayout === 'catalog' ? 'bg-white text-emerald-700 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Vue fiches catalogue"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Fiches</span>
                </button>
                <button
                  onClick={() => setListLayout('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    listLayout === 'table' ? 'bg-white text-emerald-700 shadow-xs font-semibold' : 'text-stone-600 hover:text-stone-900'
                  }`}
                  title="Vue tableau d'inventaire"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Tableau</span>
                </button>
              </div>
            </div>
          </div>

          {unlinkedTreesInTerrain.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap print:hidden">
              <div className="flex items-center gap-2.5 text-xs text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{unlinkedTreesInTerrain.length} arbre{unlinkedTreesInTerrain.length > 1 ? 's' : ''}</strong> sur ce terrain proviennent d'une ancienne fiche ou ne sont pas encore rattachés à une variété du Catalogue des Plantes.
                </span>
              </div>
              <button
                type="button"
                onClick={selectNextUnlinkedTree}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Vérifier & rattacher sur le plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Catalog Layout: Rich Species Cards with Variety Trees & Badges */}
          {listLayout === 'catalog' ? (
            filteredCatalogSpecies.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 shadow-sm">
                <Trees className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-stone-800 mb-1">Aucun arbre fruitier trouvé</h3>
                <p className="text-sm text-stone-500 max-w-md mx-auto mb-4">
                  {listSearch 
                    ? `Aucun résultat pour "${listSearch}". Essayez un autre terme de recherche.`
                    : 'Aucun arbre fruitier ne correspond aux filtres sélectionnés.'}
                </p>
                {listSearch && (
                  <button
                    onClick={() => setListSearch('')}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium transition-colors"
                  >
                    Effacer la recherche
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCatalogSpecies.map((species) => {
                  const varieties = getVarietiesForSpecies(species.name);
                  const speciesPlacedTrees = treesInCurrentTerrain.filter((t: any) => 
                    (t.species || '').toLowerCase().trim() === species.name.toLowerCase().trim()
                  );
                  const isPlacedOnTerrain = speciesPlacedTrees.length > 0;
                  const Icon = ICON_MAP[species.icon] || Trees;
                  const isExpanded = expandedSpecies[species.name] !== false; // Default expanded

                  return (
                    <div 
                      key={species.id || species.name}
                      className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden transition-all hover:border-stone-300"
                    >
                      {/* Species Header */}
                      <div className="p-5 flex items-center justify-between flex-wrap gap-4 border-b border-stone-100 bg-stone-50/50">
                        <div className="flex items-center gap-3.5">
                          <div 
                            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0"
                            style={{ 
                              background: `radial-gradient(circle at 30% 30%, ${species.color}, ${species.color}dd)`,
                              boxShadow: `0 4px 6px ${species.color}30`
                            }}
                          >
                            {isEmoji(species.icon) ? (
                              <span className="text-2xl">{species.icon}</span>
                            ) : (
                              <Icon className="w-6 h-6 text-white drop-shadow-sm" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-serif text-lg font-bold text-stone-900">{species.name}</h3>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                                {species.category}
                              </span>
                              {species.spacing && (
                                <span className="text-[11px] text-stone-400 font-medium">
                                  Envergure: {species.spacing}cm
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {isPlacedOnTerrain ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                  {speciesPlacedTrees.length} arbre{speciesPlacedTrees.length > 1 ? 's' : ''} sur le plan
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500 border border-stone-200">
                                  <MapPinOff className="w-3.5 h-3.5 text-stone-400" />
                                  Non placé sur ce terrain
                                </span>
                              )}
                              <span className="text-xs text-stone-400">
                                • {varieties.length} variété{varieties.length > 1 ? 's' : ''} répertoriée{varieties.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartPlaceTreeOnPlan(species)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            title={`Placer un exemplaire de ${species.name} sur le plan`}
                          >
                            <Plus className="w-4 h-4" />
                            <span>Placer sur le plan</span>
                          </button>
                          
                          <button
                            onClick={() => setExpandedSpecies(prev => ({ ...prev, [species.name]: !isExpanded }))}
                            className="p-2 hover:bg-stone-200/60 rounded-xl text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                            title={isExpanded ? "Replier les variétés" : "Déplier les variétés"}
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Species Varieties & Placed Instances */}
                      {isExpanded && (
                        <div className="p-5 space-y-4">
                          {varieties.length === 0 ? (
                            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200/60 text-center">
                              <p className="text-sm text-stone-500 mb-2">Aucune variété spécifique cataloguée pour cette espèce.</p>
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleStartPlaceTreeOnPlan(species)}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Placer sans variété spécifique
                                </button>
                                {setCurrentView && (
                                  <button
                                    onClick={() => setCurrentView('encyclopedia')}
                                    className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-600 border border-stone-200 rounded-lg text-xs font-medium transition-all cursor-pointer"
                                  >
                                    Ajouter des variétés dans le catalogue
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {varieties.map((variety) => {
                                const varietyPlacedTrees = speciesPlacedTrees.filter((t: any) => 
                                  (t.variety || '').toLowerCase().trim() === variety.toLowerCase().trim()
                                );
                                const varietyCount = varietyPlacedTrees.length;

                                return (
                                  <div 
                                    key={variety}
                                    className={`p-4 rounded-xl border transition-all ${
                                      varietyCount > 0 
                                        ? 'bg-emerald-50/40 border-emerald-200/80 shadow-xs' 
                                        : 'bg-stone-50/50 border-stone-200/70 hover:bg-stone-50'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-stone-900 text-sm">{variety}</span>
                                          {varietyCount > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                              <MapPin className="w-3 h-3 text-emerald-600" />
                                              {varietyCount} sur le plan
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-400 border border-stone-200">
                                              <MapPinOff className="w-2.5 h-2.5" />
                                              Non placé
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-stone-500 mt-0.5">
                                          {varietyCount > 0 
                                            ? `${varietyCount} exemplaire${varietyCount > 1 ? 's' : ''} planté${varietyCount > 1 ? 's' : ''} sur ce terrain`
                                            : 'Prêt à être ajouté au plan'}
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => handleStartPlaceTreeOnPlan(species, variety)}
                                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                                        title={`Ajouter un exemplaire de ${variety} sur le plan`}
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>+ Placer</span>
                                      </button>
                                    </div>

                                    {/* Sublist of placed trees for this variety */}
                                    {varietyPlacedTrees.length > 0 && (
                                      <div className="mt-3 pt-2 border-t border-emerald-200/60 space-y-1.5">
                                        <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                                          Emplacement{varietyPlacedTrees.length > 1 ? 's' : ''} :
                                        </div>
                                        {varietyPlacedTrees.map((tree, idx) => (
                                          <div 
                                            key={tree.id}
                                            className="bg-white/80 p-2 rounded-lg border border-emerald-100 flex items-center justify-between text-xs gap-2"
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className="font-mono text-emerald-700 font-bold">#{idx + 1}</span>
                                              <span className="text-stone-600 truncate font-mono text-[11px]">
                                                X: {tree.positionX}cm, Y: {tree.positionY}cm
                                              </span>
                                              {tree.datePlanted && (
                                                <span className="text-stone-400 text-[10px] hidden sm:inline">
                                                  ({new Date(tree.datePlanted).toLocaleDateString()})
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <button
                                                onClick={() => handleLocateTreeOnPlan(tree)}
                                                className="p-1 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors"
                                                title="Voir et centrer sur le plan"
                                              >
                                                <MapPin className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => handleEditTreeFromList(tree)}
                                                className="p-1 hover:bg-stone-100 text-stone-600 rounded-md transition-colors"
                                                title="Modifier cet arbre"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setConfirmState({
                                                    isOpen: true,
                                                    title: "Supprimer l'arbre",
                                                    message: `Voulez-vous vraiment supprimer cet exemplaire de ${tree.species} (${tree.variety || 'Sans variété'}) ?`,
                                                    isDanger: true,
                                                    onConfirm: async () => {
                                                      await fb.delete("trees", tree.id);
                                                    }
                                                  });
                                                }}
                                                className="p-1 hover:bg-red-50 text-stone-400 hover:text-red-600 rounded-md transition-colors"
                                                title="Supprimer du verger"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Table Layout: Printable Table View */
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden">
              <div className="p-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-stone-900 text-sm">Inventaire du Verger : {selectedTerrain?.value}</h3>
                  <p className="text-xs text-stone-500">{treesInCurrentTerrain.length} arbre(s) planté(s)</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50/80 border-b border-stone-200">
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Espèce</th>
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Variété</th>
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Date de plantation</th>
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Position</th>
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider text-right print:hidden">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {treesInCurrentTerrain.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-stone-400 text-sm italic">
                          Aucun arbre placé sur ce terrain pour le moment.
                        </td>
                      </tr>
                    ) : (
                      treesInCurrentTerrain
                        .sort((a, b) => (a.species || '').localeCompare(b.species || ''))
                        .map(tree => {
                          const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (tree.species || '').toLowerCase().trim());
                          const color = encEntry?.color || tree.color || '#10b981';
                          const Icon = ICON_MAP[encEntry?.icon || tree.icon || ''] || Trees;

                          return (
                            <tr key={tree.id} className="hover:bg-stone-50/80 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${color}25`, border: `1.5px solid ${color}` }}
                                  >
                                    {isEmoji(encEntry?.icon || tree.icon) ? (
                                      <span className="text-sm">{encEntry?.icon || tree.icon}</span>
                                    ) : (
                                      <Icon className="w-4 h-4" style={{ color }} />
                                    )}
                                  </div>
                                  <span className="font-semibold text-stone-900">{tree.species}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-stone-700">{tree.variety || 'Variété non spécifiée'}</span>
                                  {getTreeCatalogLinkInfo(tree).status === 'catalog' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      Catalogue
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleLocateTreeOnPlan(tree)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                                      title={getTreeCatalogLinkInfo(tree).reason}
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      Ancienne fiche
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-stone-600">
                                  {tree.datePlanted ? new Date(tree.datePlanted).toLocaleDateString() : '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-mono font-medium bg-stone-100 text-stone-700 px-2 py-1 rounded-md">
                                  {tree.positionX}cm, {tree.positionY}cm
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right print:hidden">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleLocateTreeOnPlan(tree)}
                                    className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-colors"
                                    title="Voir sur le plan"
                                  >
                                    <MapPin className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEditTreeFromList(tree)}
                                    className="p-1.5 hover:bg-stone-100 text-stone-600 rounded-lg transition-colors"
                                    title="Modifier"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setConfirmState({
                                        isOpen: true,
                                        title: "Supprimer l'arbre",
                                        message: `Voulez-vous vraiment supprimer cet exemplaire de ${tree.species} ?`,
                                        isDanger: true,
                                        onConfirm: async () => {
                                          await fb.delete("trees", tree.id);
                                        }
                                      });
                                    }}
                                    className="p-1.5 hover:bg-red-50 text-stone-400 hover:text-red-600 rounded-lg transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {(() => {
        const activeFollowUpNote = followUpNoteId && selectedTreeDetails?.notes
          ? selectedTreeDetails.notes.find((n: Note) => n.id === followUpNoteId)
          : null;
        if (!activeFollowUpNote || !selectedTreeDetails) return null;
        return (
          <NoteFollowUpModal
            isOpen={true}
            onClose={() => setFollowUpNoteId(null)}
            sourceLabel={`${selectedTreeDetails.species}${selectedTreeDetails.variety ? ` (${selectedTreeDetails.variety})` : ''}`}
            originDate={activeFollowUpNote.date}
            originText={activeFollowUpNote.text || ''}
            updates={activeFollowUpNote.updates || []}
            onSaveUpdates={(nextUpdates) => handleSaveTreeNoteUpdates(activeFollowUpNote.id, nextUpdates)}
            successStatus={activeFollowUpNote.successStatus || 'none'}
            onChangeSuccessStatus={(next) => handleSetTreeNoteSuccess(activeFollowUpNote.id, next)}
          />
        );
      })()}
    </div>
  );
}
