import React, { useState, useMemo } from 'react';
import { useFirebaseData, fb } from '../hooks/useFirebaseData';
import { Tree, EncyclopediaEntry, ConfigItem } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { 
  Plus, Trash2, Calendar as CalendarIcon, Check, Leaf, Trees, 
  Apple, Sparkles, Filter, Search, Layers, ChevronDown, ChevronUp, 
  Edit2, Info, ArrowUpDown, Clock, HelpCircle, CheckCircle2, RotateCcw,
  Printer
} from 'lucide-react';
import { ConfirmModal } from '../components/Modals';
import { HarvestCalendarPrintModal } from '../components/HarvestCalendarPrintModal';
import { normalizeCategoryKey, getCanonicalCategory } from '../utils/categories';
import { 
  normalizeSpeciesName, 
  normalizeVarietyKey, 
  areVarietiesEquivalent,
  extractVarietyTokens,
  SPECIES_CANONICAL_MAP,
  isTechnicalId,
  isFruitCategory,
  isFruitSpecies,
  cleanDisplayName
} from '../utils/varietyNormalizer';
import { PLANT_CATALOG } from '../catalog';
import { ICON_MAP, isEmoji } from '../constants';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MONTH_ABBR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
];

// Helper to format quinzaine list into human-friendly French text
export function formatHarvestPeriodSummary(months: number[] = []): string {
  if (!months || months.length === 0) return 'Non définie';
  
  // Normalize and sort
  const normalized = Array.from(new Set(months.flatMap(m => {
    if (Number.isInteger(m)) {
      // If pure integer, check if decimal counterpart also exists or expand
      return [m];
    }
    return [m];
  }))).sort((a, b) => a - b);

  if (normalized.length === 0) return 'Non définie';
  if (normalized.length === 24) return 'Toute l’année';

  const formatQuinzaineName = (val: number): string => {
    const monthIndex = Math.floor(val) - 1;
    const isSecondHalf = !Number.isInteger(val);
    const mName = MONTH_ABBR[monthIndex] || `M${monthIndex + 1}`;
    return isSecondHalf ? `Fin ${mName}` : `Début ${mName}`;
  };

  // Group continuous spans
  const spans: { start: number; end: number }[] = [];
  let currentStart = normalized[0];
  let currentEnd = normalized[0];

  const getNextStep = (v: number) => {
    return Number.isInteger(v) ? v + 0.5 : v + 0.5;
  };

  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const curr = normalized[i];
    const expected = getNextStep(prev);
    
    // Check if consecutive
    if (Math.abs(curr - expected) < 0.01) {
      currentEnd = curr;
    } else {
      spans.push({ start: currentStart, end: currentEnd });
      currentStart = curr;
      currentEnd = curr;
    }
  }
  spans.push({ start: currentStart, end: currentEnd });

  return spans.map(s => {
    if (s.start === s.end) {
      return formatQuinzaineName(s.start);
    }
    const startM = Math.floor(s.start) - 1;
    const endM = Math.floor(s.end) - 1;
    const isStartFirst = Number.isInteger(s.start);
    const isEndSecond = !Number.isInteger(s.end);
    
    // If exact whole month
    if (startM === endM && isStartFirst && isEndSecond) {
      return `${MONTH_NAMES[startM]}`;
    }
    return `${formatQuinzaineName(s.start)} → ${formatQuinzaineName(s.end)}`;
  }).join(', ');
}

export function HarvestCalendar() {
  const { data: trees } = useFirebaseData<Tree>('trees');
  const { data: encyclopedia } = useFirebaseData<EncyclopediaEntry>('encyclopedia');
  const { data: config } = useFirebaseData<ConfigItem>('config');

  const [viewMode, setViewMode] = useState<'variety' | 'tree'>('variety');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'planted' | 'planned'>('all');
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string>('all');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{
    type: 'variety' | 'tree';
    species: string;
    variety: string;
    treeId?: string;
    status?: 'planted' | 'planned';
    expectedYield?: number | '';
    expectedYieldUnit?: string;
    harvestMonths: number[];
    varietyConfigId?: string;
    trees?: Tree[];
    spellingVariants?: string[];
  } | null>(null);

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

  // Active trees from orchard
  const activeTrees = useMemo(() => {
    if (!trees) return [];
    return trees.filter(t => !t.isDeleted);
  }, [trees]);

  // Helper to resolve parentId or tree technical IDs to botanical species
  const resolveSpecies = useMemo(() => {
    return (parentId?: string | null): { name: string; category?: string; icon?: string; color?: string; harvestMonths?: number[] } | null => {
      if (!parentId) return null;
      const cleanId = parentId.trim();
      if (!cleanId) return null;

      const strippedId = cleanId.replace(/^[cev]-/, '');

      // 1. Check encyclopedia by ID or stripped ID
      const encById = encyclopedia?.find(e => e.id === cleanId || e.id === strippedId);
      if (encById && encById.name && !isTechnicalId(encById.name)) {
        return {
          name: encById.name,
          category: encById.category,
          icon: encById.icon,
          color: encById.color,
          harvestMonths: encById.harvestMonths
        };
      }

      // 2. Check encyclopedia by name
      const encByName = encyclopedia?.find(e => normalizeSpeciesName(e.name) === normalizeSpeciesName(cleanId));
      if (encByName && encByName.name && !isTechnicalId(encByName.name)) {
        return {
          name: encByName.name,
          category: encByName.category,
          icon: encByName.icon,
          color: encByName.color,
          harvestMonths: encByName.harvestMonths
        };
      }

      // 3. Check config vegetables by ID or stripped ID
      const vegById = config?.find(cg => (cg.type === 'vegetable' || cg.type === 'category') && (cg.id === cleanId || cg.id === strippedId));
      if (vegById && vegById.value && !isTechnicalId(vegById.value)) {
        return {
          name: vegById.value,
          category: vegById.attributes?.category,
          icon: vegById.attributes?.icon,
          color: vegById.attributes?.color,
          harvestMonths: vegById.attributes?.harvestMonths
        };
      }

      // 4. Check config vegetables by name
      const vegByName = config?.find(cg => (cg.type === 'vegetable' || cg.type === 'category') && normalizeSpeciesName(cg.value) === normalizeSpeciesName(cleanId));
      if (vegByName && vegByName.value && !isTechnicalId(vegByName.value)) {
        return {
          name: vegByName.value,
          category: vegByName.attributes?.category,
          icon: vegByName.attributes?.icon,
          color: vegByName.attributes?.color,
          harvestMonths: vegByName.attributes?.harvestMonths
        };
      }

      // 5. Check PLANT_CATALOG by ID or stripped ID
      const catById = PLANT_CATALOG.find(p => p.id === cleanId || p.id === strippedId);
      if (catById && catById.name && !isTechnicalId(catById.name)) {
        return {
          name: catById.name,
          category: catById.category,
          icon: catById.emoji
        };
      }

      // 6. Check PLANT_CATALOG by name
      const catByName = PLANT_CATALOG.find(p => normalizeSpeciesName(p.name) === normalizeSpeciesName(cleanId));
      if (catByName && catByName.name && !isTechnicalId(catByName.name)) {
        return {
          name: catByName.name,
          category: catByName.category,
          icon: catByName.emoji
        };
      }

      // 7. Check trees by ID or stripped ID
      const treeById = activeTrees.find(t => t.id === cleanId || t.id === strippedId);
      if (treeById && treeById.species && !isTechnicalId(treeById.species)) {
        return {
          name: treeById.species
        };
      }

      // 8. If cleanId is already a recognized botanical name (and not a technical ID)
      if (!isTechnicalId(cleanId) && Boolean(SPECIES_CANONICAL_MAP[normalizeSpeciesName(cleanId)])) {
        return {
          name: cleanId
        };
      }

      return null;
    };
  }, [encyclopedia, config, activeTrees]);

  // Encyclopedia fruit species list (strictly excluding vegetables and technical IDs)
  const encyclopediaFruitSpecies = useMemo(() => {
    if (!encyclopedia) return [];
    return encyclopedia.filter(e => {
      if (!e.name || isTechnicalId(e.name)) return false;
      return isFruitSpecies(e.name, e.category);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [encyclopedia]);

  // All unique species present in trees or encyclopedia (deduplicated by normalized name)
  const allSpeciesList = useMemo(() => {
    const map = new Map<string, string>();
    encyclopediaFruitSpecies.forEach(e => {
      if (e.name && e.name.trim() && !isTechnicalId(e.name)) {
        const norm = normalizeSpeciesName(e.name);
        if (!map.has(norm)) map.set(norm, e.name.trim());
      }
    });
    activeTrees.forEach(t => {
      let spec = (t.species || '').trim();
      if (!spec) return;
      if (isTechnicalId(spec)) {
        const resolved = resolveSpecies(spec);
        if (resolved && resolved.name && !isTechnicalId(resolved.name)) {
          spec = resolved.name;
        } else {
          return;
        }
      }
      const norm = normalizeSpeciesName(spec);
      if (!map.has(norm)) map.set(norm, spec);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [activeTrees, encyclopediaFruitSpecies, resolveSpecies]);

  // Map of variety attributes stored in config
  const varietyConfigMap = useMemo(() => {
    const map = new Map<string, ConfigItem>();
    if (!config) return map;
    config.filter(c => c.type === 'variety').forEach(c => {
      if (c.value && !isTechnicalId(c.value)) {
        const key = `${c.parentId || ''}___${normalizeVarietyKey(c.value)}`;
        map.set(key, c);
      }
    });
    return map;
  }, [config]);

  // Group trees & fruit items by Variety, harmonizing spelling variants and accents
  const varietyGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      species: string;
      variety: string;
      displayName: string;
      icon: string;
      color: string;
      plantedCount: number;
      plannedCount: number;
      totalTrees: number;
      trees: Tree[];
      expectedYield: number;
      expectedYieldUnit: string;
      harvestMonths: number[];
      varietyConfigId?: string;
      spellingVariants?: string[];
    }> = [];

    const findGroup = (speciesName: string, varietyName: string) => {
      const normSpec = normalizeSpeciesName(speciesName);
      return groups.find(g => 
        normalizeSpeciesName(g.species) === normSpec &&
        areVarietiesEquivalent(g.variety, varietyName)
      );
    };

    // 1. FIRST incorporate varieties registered in catalog for fruit species (canonical reference)
    if (config) {
      config.filter(c => c.type === 'variety').forEach(c => {
        const variety = (c.value || '').trim();
        // Skip if variety is empty or a technical ID / UUID
        if (!variety || isTechnicalId(variety)) return;

        // Resolve parent species
        const resolved = resolveSpecies(c.parentId);
        // If parent cannot be resolved to a human species name, NEVER display a raw UUID code
        if (!resolved || !resolved.name || isTechnicalId(resolved.name)) return;

        // Prefer canonical encyclopedia tree name if available (e.g. "Pommier" instead of "Pomme")
        const encByNorm = encyclopedia?.find(e => normalizeSpeciesName(e.name) === normalizeSpeciesName(resolved.name));
        const species = encByNorm?.name || resolved.name.trim();

        const category = encByNorm?.category || resolved.category;
        // Verify this is genuinely an orchard fruit species
        if (!isFruitSpecies(species, category)) return;

        const customMonths = c.attributes?.harvestMonths ? (c.attributes.harvestMonths as number[]) : [];
        const encMonths = ((encByNorm?.harvestMonths || resolved.harvestMonths) || []).flatMap(m => Number.isInteger(m) ? [m, m + 0.5] : [m]);

        const existingGroup = findGroup(species, variety);
        if (!existingGroup) {
          const key = `${normalizeSpeciesName(species)}___${normalizeVarietyKey(variety)}`;
          groups.push({
            key,
            species,
            variety,
            displayName: `${species} - ${variety}`,
            icon: encByNorm?.icon || resolved.icon || 'Trees',
            color: encByNorm?.color || resolved.color || '#10b981',
            plantedCount: 0,
            plannedCount: 0,
            totalTrees: 0,
            trees: [],
            expectedYield: 0,
            expectedYieldUnit: 'kg',
            harvestMonths: customMonths.length > 0 ? customMonths : encMonths,
            varietyConfigId: c.id,
            spellingVariants: []
          });
        } else {
          if (!existingGroup.varietyConfigId) existingGroup.varietyConfigId = c.id;
          if (existingGroup.harvestMonths.length === 0 && customMonths.length > 0) {
            existingGroup.harvestMonths = customMonths;
          }
          // Promote more complete name if catalog variety is longer or has more tokens (e.g. "Golden Delicious" > "Golden")
          const existingTokens = extractVarietyTokens(existingGroup.variety);
          const newTokens = extractVarietyTokens(variety);
          if (newTokens.length > existingTokens.length || (newTokens.length === existingTokens.length && variety.length > existingGroup.variety.length)) {
            const oldVar = existingGroup.variety;
            existingGroup.variety = variety;
            existingGroup.displayName = `${existingGroup.species} - ${variety}`;
            if (!existingGroup.spellingVariants) existingGroup.spellingVariants = [];
            if (!existingGroup.spellingVariants.includes(oldVar) && oldVar !== 'Variété standard' && !isTechnicalId(oldVar)) {
              existingGroup.spellingVariants.push(oldVar);
            }
          }
        }
      });
    }

    // 2. SECOND, map existing trees in orchard to their varieties
    activeTrees.forEach(tree => {
      let rawSpecies = (tree.species || '').trim();
      let rawVariety = (tree.variety || '').trim();

      // If tree.species is a technical ID (UUID), try resolving it
      if (isTechnicalId(rawSpecies)) {
        const resolved = resolveSpecies(rawSpecies);
        if (resolved && resolved.name && !isTechnicalId(resolved.name)) {
          rawSpecies = resolved.name;
        } else {
          // If totally unresolvable, fallback to human label 'Arbre fruitier' instead of displaying raw hex code
          rawSpecies = 'Arbre fruitier';
        }
      }

      // If tree.variety is a technical ID, ignore it and treat as standard
      if (isTechnicalId(rawVariety) || !rawVariety) {
        rawVariety = 'Variété standard';
      }

      const encEntry = encyclopedia?.find(e => normalizeSpeciesName(e.name) === normalizeSpeciesName(rawSpecies));
      const species = encEntry?.name || rawSpecies;

      const treeHarvestMonths = tree.harvestMonths || [];
      const encMonths = (encEntry?.harvestMonths || []).flatMap(m => Number.isInteger(m) ? [m, m + 0.5] : [m]);

      let group = findGroup(species, rawVariety);

      if (!group) {
        const key = `${normalizeSpeciesName(species)}___${normalizeVarietyKey(rawVariety)}`;
        group = {
          key,
          species,
          variety: rawVariety,
          displayName: rawVariety === 'Variété standard' ? species : `${species} - ${rawVariety}`,
          icon: encEntry?.icon || 'Trees',
          color: encEntry?.color || '#10b981',
          plantedCount: 0,
          plannedCount: 0,
          totalTrees: 0,
          trees: [],
          expectedYield: 0,
          expectedYieldUnit: tree.expectedYieldUnit || 'kg',
          harvestMonths: treeHarvestMonths.length > 0 ? treeHarvestMonths : encMonths,
          spellingVariants: []
        };
        groups.push(group);
      } else {
        const groupTokens = extractVarietyTokens(group.variety);
        const treeTokens = extractVarietyTokens(rawVariety);
        if (treeTokens.length > groupTokens.length && !group.varietyConfigId) {
          const oldVar = group.variety;
          group.variety = rawVariety;
          group.displayName = rawVariety === 'Variété standard' ? group.species : `${group.species} - ${rawVariety}`;
          if (!group.spellingVariants) group.spellingVariants = [];
          if (!group.spellingVariants.includes(oldVar) && oldVar !== 'Variété standard' && !isTechnicalId(oldVar)) {
            group.spellingVariants.push(oldVar);
          }
        }
      }

      group.trees.push(tree);
      group.totalTrees++;
      if (tree.status === 'planned') {
        group.plannedCount++;
      } else {
        group.plantedCount++;
      }
      if (tree.expectedYield) {
        group.expectedYield += Number(tree.expectedYield);
      }
      if (group.harvestMonths.length === 0 && treeHarvestMonths.length > 0) {
        group.harvestMonths = treeHarvestMonths;
      }

      // Track orthographic spelling differences (e.g. bennedict, golden, golden delicous vs Golden Delicious)
      if (rawVariety !== group.variety && rawVariety !== 'Variété standard' && !isTechnicalId(rawVariety)) {
        if (!group.spellingVariants) group.spellingVariants = [];
        if (!group.spellingVariants.includes(rawVariety)) {
          group.spellingVariants.push(rawVariety);
        }
      }
    });

    return groups
      .filter(g => !isTechnicalId(g.species) && !isTechnicalId(g.variety))
      .sort((a, b) => {
        const specComp = a.species.localeCompare(b.species, undefined, { sensitivity: 'base' });
        if (specComp !== 0) return specComp;
        return a.variety.localeCompare(b.variety, undefined, { sensitivity: 'base' });
      });
  }, [activeTrees, encyclopedia, config, resolveSpecies]);

  // Filtered varieties
  const filteredVarieties = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return varietyGroups.filter(vg => {
      const matchesSearch = !term || 
        vg.species.toLowerCase().includes(term) || 
        vg.variety.toLowerCase().includes(term) ||
        (vg.spellingVariants || []).some(v => v.toLowerCase().includes(term));

      const matchesSpecies = selectedSpeciesFilter === 'all' || 
        normalizeSpeciesName(vg.species) === normalizeSpeciesName(selectedSpeciesFilter);

      let matchesStatus = true;
      if (filterStatus === 'planted') {
        matchesStatus = vg.plantedCount > 0;
      } else if (filterStatus === 'planned') {
        matchesStatus = vg.plannedCount > 0 || vg.totalTrees === 0;
      }

      return matchesSearch && matchesSpecies && matchesStatus;
    });
  }, [varietyGroups, searchTerm, selectedSpeciesFilter, filterStatus]);

  // Filtered individual trees
  const filteredTrees = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return activeTrees.filter(t => {
      const spec = isTechnicalId(t.species)
        ? (resolveSpecies(t.species)?.name || 'Arbre fruitier')
        : (t.species || 'Arbre fruitier');
      const varName = !isTechnicalId(t.variety) ? (t.variety || '') : '';

      const matchesSearch = !term || 
        spec.toLowerCase().includes(term) || 
        varName.toLowerCase().includes(term) ||
        (t.comments || '').toLowerCase().includes(term);

      const matchesSpecies = selectedSpeciesFilter === 'all' || 
        normalizeSpeciesName(spec) === normalizeSpeciesName(selectedSpeciesFilter);

      let matchesStatus = true;
      if (filterStatus === 'planted') {
        matchesStatus = t.status !== 'planned';
      } else if (filterStatus === 'planned') {
        matchesStatus = t.status === 'planned';
      }

      return matchesSearch && matchesSpecies && matchesStatus;
    }).sort((a, b) => {
      const specA = isTechnicalId(a.species) ? (resolveSpecies(a.species)?.name || 'Arbre fruitier') : (a.species || '');
      const specB = isTechnicalId(b.species) ? (resolveSpecies(b.species)?.name || 'Arbre fruitier') : (b.species || '');
      const specComp = specA.localeCompare(specB, undefined, { sensitivity: 'base' });
      if (specComp !== 0) return specComp;
      const varA = !isTechnicalId(a.variety) ? (a.variety || '') : '';
      const varB = !isTechnicalId(b.variety) ? (b.variety || '') : '';
      return varA.localeCompare(varB, undefined, { sensitivity: 'base' });
    });
  }, [activeTrees, searchTerm, selectedSpeciesFilter, filterStatus, resolveSpecies]);

  // Direct toggle of a single 15-day Quinzaine on a Variety (or Tree)
  const handleToggleQuinzaineOnVariety = async (varietyGroup: any, quinzaineValue: number) => {
    const currentMonths = varietyGroup.harvestMonths || [];
    const exists = currentMonths.some((m: number) => Math.abs(m - quinzaineValue) < 0.01);
    const updatedMonths = exists
      ? currentMonths.filter((m: number) => Math.abs(m - quinzaineValue) >= 0.01)
      : [...currentMonths, quinzaineValue].sort((a: number, b: number) => a - b);

    // 1. Update all existing trees of this variety & harmonize spelling
    if (varietyGroup.trees && varietyGroup.trees.length > 0) {
      for (const t of varietyGroup.trees) {
        await fb.update('trees', t.id, { 
          harvestMonths: updatedMonths,
          species: varietyGroup.species, // Harmonize species name (e.g. Pomme -> Pommier)
          variety: varietyGroup.variety // Harmonize variant spellings (e.g. golden, golden delicous -> Golden Delicious)
        });
      }
    }

    // 2. Also save to variety config item if exists or create one
    if (varietyGroup.varietyConfigId) {
      const existing = config?.find(c => c.id === varietyGroup.varietyConfigId);
      await fb.update('config', varietyGroup.varietyConfigId, {
        attributes: { ...(existing?.attributes || {}), harvestMonths: updatedMonths }
      });
    } else {
      // Find parent enc or config vegetable to link variety
      const enc = encyclopedia?.find(e => normalizeSpeciesName(e.name) === normalizeSpeciesName(varietyGroup.species));
      if (enc && varietyGroup.variety && varietyGroup.variety !== 'Variété standard' && !isTechnicalId(varietyGroup.variety)) {
        await fb.add('config', {
          id: uuidv4(),
          type: 'variety',
          value: varietyGroup.variety,
          parentId: enc.id,
          attributes: { harvestMonths: updatedMonths }
        });
      }
    }
  };

  // Direct toggle on individual tree
  const handleToggleQuinzaineOnTree = async (tree: Tree, quinzaineValue: number) => {
    const currentMonths = tree.harvestMonths || [];
    const exists = currentMonths.some(m => Math.abs(m - quinzaineValue) < 0.01);
    const updatedMonths = exists
      ? currentMonths.filter(m => Math.abs(m - quinzaineValue) >= 0.01)
      : [...currentMonths, quinzaineValue].sort((a, b) => a - b);

    await fb.update('trees', tree.id, { harvestMonths: updatedMonths });
  };

  // Open full editor modal
  const handleOpenEditModal = (target: { type: 'variety' | 'tree'; item: any }) => {
    if (target.type === 'variety') {
      const v = target.item;
      setEditingTarget({
        type: 'variety',
        species: v.species,
        variety: v.variety === 'Variété standard' ? '' : v.variety,
        expectedYield: v.expectedYield || '',
        expectedYieldUnit: v.expectedYieldUnit || 'kg',
        harvestMonths: v.harvestMonths || [],
        varietyConfigId: v.varietyConfigId,
        trees: v.trees,
        spellingVariants: (v.spellingVariants || []).filter((s: string) => !isTechnicalId(s))
      });
    } else {
      const t = target.item;
      const cleanSpecies = isTechnicalId(t.species)
        ? (resolveSpecies(t.species)?.name || 'Arbre fruitier')
        : (t.species || 'Arbre fruitier');
      const cleanVariety = !isTechnicalId(t.variety) ? (t.variety || '') : '';
      setEditingTarget({
        type: 'tree',
        treeId: t.id,
        species: cleanSpecies,
        variety: cleanVariety,
        status: t.status || 'planted',
        expectedYield: t.expectedYield || '',
        expectedYieldUnit: t.expectedYieldUnit || 'kg',
        harvestMonths: t.harvestMonths || []
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenNewModal = () => {
    setEditingTarget({
      type: 'tree',
      species: '',
      variety: '',
      status: 'planned',
      expectedYield: '',
      expectedYieldUnit: 'kg',
      harvestMonths: []
    });
    setIsModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!editingTarget || !editingTarget.species || isTechnicalId(editingTarget.species)) return;
    const cleanSpecies = editingTarget.species.trim();
    const cleanVariety = isTechnicalId(editingTarget.variety) ? '' : (editingTarget.variety || '').trim();

    if (editingTarget.type === 'variety') {
      // Find all trees with this species and variety (including spelling variants)
      const matchingTrees = activeTrees.filter(t => {
        const tSpec = isTechnicalId(t.species) ? resolveSpecies(t.species)?.name : t.species;
        return normalizeSpeciesName(tSpec) === normalizeSpeciesName(cleanSpecies) &&
          areVarietiesEquivalent(t.variety, cleanVariety);
      });

      for (const t of matchingTrees) {
        await fb.update('trees', t.id, {
          harvestMonths: editingTarget.harvestMonths,
          species: cleanSpecies, // Harmonize tree species (e.g. Pomme -> Pommier)
          variety: cleanVariety, // Harmonize tree variety name
          expectedYield: editingTarget.expectedYield === '' ? undefined : Number(editingTarget.expectedYield),
          expectedYieldUnit: editingTarget.expectedYieldUnit
        });
      }

      // Also persist to config variety
      const enc = encyclopedia?.find(e => normalizeSpeciesName(e.name) === normalizeSpeciesName(cleanSpecies));
      const confVariety = config?.find(c => 
        c.type === 'variety' && 
        areVarietiesEquivalent(c.value, cleanVariety) &&
        (enc ? (c.parentId === enc.id || !c.parentId) : true)
      );

      if (confVariety) {
        await fb.update('config', confVariety.id, {
          value: cleanVariety || confVariety.value, // Ensure canonical spelling
          attributes: { ...(confVariety.attributes || {}), harvestMonths: editingTarget.harvestMonths }
        });
      } else if (enc && cleanVariety) {
        await fb.add('config', {
          id: uuidv4(),
          type: 'variety',
          value: cleanVariety,
          parentId: enc.id,
          attributes: { harvestMonths: editingTarget.harvestMonths }
        });
      }
    } else {
      // Individual tree update or creation
      const data = {
        species: cleanSpecies,
        variety: cleanVariety,
        status: editingTarget.status || 'planned',
        harvestMonths: editingTarget.harvestMonths,
        expectedYield: editingTarget.expectedYield === '' ? undefined : Number(editingTarget.expectedYield),
        expectedYieldUnit: editingTarget.expectedYieldUnit || 'kg'
      };

      if (editingTarget.treeId) {
        await fb.update('trees', editingTarget.treeId, data);
      } else {
        await fb.add('trees', {
          id: uuidv4(),
          terrainId: 'default',
          datePlanted: new Date().toISOString(),
          comments: '',
          isDeleted: false,
          notes: [],
          ...data
        });
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteTree = (id: string, name: string) => {
    setConfirmState({
      isOpen: true,
      title: "Supprimer l'arbre",
      message: `Voulez-vous vraiment retirer "${name}" du verger ?`,
      isDanger: true,
      confirmText: "Supprimer",
      onConfirm: async () => {
        await fb.update('trees', id, { isDeleted: true });
      }
    });
  };

  // Helper to render the interactive 24-quinzaine bar
  const renderQuinzaineTimeline = (
    harvestMonths: number[] = [], 
    onToggle: (quinzaineVal: number) => void,
    isPlanned: boolean = false
  ) => {
    return (
      <div className="flex flex-1 h-9 rounded-xl overflow-hidden bg-stone-100/90 border border-stone-200/90 shadow-inner">
        {MONTH_NAMES.map((monthName, mIdx) => {
          const monthNum = mIdx + 1;
          const q1 = monthNum;        // 1-15
          const q2 = monthNum + 0.5;  // 16-31

          const isQ1Active = harvestMonths.some(m => Math.abs(m - q1) < 0.01);
          const isQ2Active = harvestMonths.some(m => Math.abs(m - q2) < 0.01);

          return (
            <div key={mIdx} className="flex-1 flex border-r border-stone-200/60 last:border-r-0 relative group/month">
              {/* 1ère Quinzaine (1-15) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(q1);
                }}
                title={`${monthName} (1ère quinzaine : 1-15 ${MONTH_ABBR[mIdx]}) : Cliquez pour ${isQ1Active ? 'retirer' : 'ajouter'}`}
                className={`flex-1 h-full transition-all duration-150 relative flex items-center justify-center border-r border-stone-200/30 ${
                  isQ1Active 
                    ? isPlanned ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold' : 'bg-emerald-500 hover:bg-emerald-600 text-white font-bold'
                    : 'hover:bg-emerald-100/50 text-transparent hover:text-stone-400'
                }`}
              >
                <span className="text-[9px] select-none opacity-0 hover:opacity-100 transition-opacity">1</span>
              </button>

              {/* 2ème Quinzaine (16-31) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(q2);
                }}
                title={`${monthName} (2ème quinzaine : 16-31 ${MONTH_ABBR[mIdx]}) : Cliquez pour ${isQ2Active ? 'retirer' : 'ajouter'}`}
                className={`flex-1 h-full transition-all duration-150 relative flex items-center justify-center ${
                  isQ2Active 
                    ? isPlanned ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold' : 'bg-emerald-500 hover:bg-emerald-600 text-white font-bold'
                    : 'hover:bg-emerald-100/50 text-transparent hover:text-stone-400'
                }`}
              >
                <span className="text-[9px] select-none opacity-0 hover:opacity-100 transition-opacity">2</span>
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-stone-200/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-stone-900">
              Calendrier des Récoltes par Variété
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-semibold">
              Précision à la Quinzaine (15 jours)
            </span>
          </div>
          <p className="text-stone-500 text-sm mt-1">
            Cliquez directement sur les cases de chaque quinzaine (1-15 ou 16-31) pour ajuster les périodes de récolte de vos arbres et variétés.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="bg-stone-100 p-1 rounded-xl flex items-center gap-1 border border-stone-200/60">
            <button
              onClick={() => setViewMode('variety')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'variety' ? 'bg-white text-stone-900 shadow-sm font-semibold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Par Variété ({filteredVarieties.length})
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'tree' ? 'bg-white text-stone-900 shadow-sm font-semibold' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Par Arbre ({filteredTrees.length})
            </button>
          </div>

          {/* Module d'impression */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/90 rounded-xl transition shadow-2xs text-sm font-medium hover:border-emerald-500/40 hover:text-emerald-700"
            title="Ouvrir le module d'impression du calendrier des récoltes"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>Imprimer</span>
          </button>

          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-sm text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un arbre / variété</span>
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input 
              type="text" 
              placeholder="Rechercher une espèce, une variété..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
            />
          </div>

          <select
            value={selectedSpeciesFilter}
            onChange={e => setSelectedSpeciesFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Toutes les espèces ({allSpeciesList.length})</option>
            {allSpeciesList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Tous statuts</option>
            <option value="planted">🌿 Arbres plantés</option>
            <option value="planned">📅 Projets / Planifiés</option>
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-stone-600 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200/60">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block shadow-sm"></span>
            <span>Planté</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-400 inline-block shadow-sm"></span>
            <span>Projet</span>
          </div>
          <div className="flex items-center gap-1 text-stone-400">
            <span className="font-mono text-[10px]">1 = 1-15 / 2 = 16-31</span>
          </div>
        </div>
      </div>

      {/* Main Calendar Matrix Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col">
        <div className="overflow-auto max-h-[calc(100vh-230px)] min-h-[420px] scroll-smooth">
          <div className="min-w-[840px] px-4 sm:px-6 pb-6">
            {/* Sticky Calendar Header with 12 Months & 24 Quinzaines Subdivisions */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md pt-4 pb-3 mb-2 border-b border-stone-200 px-2 flex items-end gap-3 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
              {/* Left Column Header */}
              <div className="w-60 pr-2 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  {viewMode === 'variety' ? 'Espèce & Variété' : 'Arbre / Verger'}
                </span>
                <span className="text-[10px] text-stone-500 font-medium bg-stone-100 px-2 py-0.5 rounded-full">
                  {viewMode === 'variety' ? `${filteredVarieties.length} var.` : `${filteredTrees.length} arbres`}
                </span>
              </div>

              {/* 12 Months with 24 Quinzaines Header */}
              <div className="flex-1 flex gap-0.5">
                {MONTH_ABBR.map((m, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-1">
                      {m}
                    </span>
                    <div className="w-full flex text-[9px] font-mono text-stone-500 border-t border-stone-200 pt-0.5">
                      <span className="flex-1 text-center font-medium">1-15</span>
                      <span className="flex-1 text-center font-medium">16-31</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right actions spacer to match row layout */}
              <div className="w-10 shrink-0" />
            </div>

            {/* View Mode: Grouped by Variety */}
            {viewMode === 'variety' && (
              <div className="divide-y divide-stone-100">
                {filteredVarieties.length === 0 ? (
                  <div className="text-center py-16 text-stone-400">
                    <Trees className="w-12 h-12 mx-auto mb-2 text-stone-300 stroke-[1.5]" />
                    <p className="font-medium text-stone-600">Aucune variété ne correspond à votre recherche.</p>
                    <p className="text-xs text-stone-400 mt-1">Modifiez vos filtres ou ajoutez une nouvelle variété au verger.</p>
                  </div>
                ) : (
                  filteredVarieties.map(vg => {
                    const hasPlanted = vg.plantedCount > 0;
                    const isPureProject = vg.totalTrees > 0 && !hasPlanted;
                    const IconComponent = ICON_MAP[vg.icon] || Trees;

                    return (
                      <div 
                        key={vg.key} 
                        className="flex items-center py-3 group hover:bg-stone-50/70 rounded-xl px-2 transition-colors gap-3"
                      >
                        {/* Variety Info Column */}
                        <div 
                          className="w-60 pr-2 cursor-pointer"
                          onClick={() => handleOpenEditModal({ type: 'variety', item: vg })}
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                              style={{ backgroundColor: `${vg.color}20`, color: vg.color }}
                            >
                              {isEmoji(vg.icon) ? (
                                <span className="text-xs">{vg.icon}</span>
                              ) : (
                                <IconComponent className="w-4 h-4" />
                              )}
                            </div>
                            <div className="truncate flex-1">
                              <div className="font-semibold text-stone-900 text-sm truncate group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                                <span>{vg.species}</span>
                                {vg.variety && vg.variety !== 'Variété standard' && (
                                  <span className="text-stone-600 font-normal truncate">({vg.variety})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs mt-0.5">
                                {vg.plantedCount > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                                    <Leaf className="w-3 h-3" />
                                    {vg.plantedCount} planté{vg.plantedCount > 1 ? 's' : ''}
                                  </span>
                                )}
                                {vg.plannedCount > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                                    <CalendarIcon className="w-3 h-3" />
                                    {vg.plannedCount} projet{vg.plannedCount > 1 ? 's' : ''}
                                  </span>
                                )}
                                {vg.spellingVariants && vg.spellingVariants.length > 0 && (
                                  <span 
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200/70"
                                    title={`Variantes détectées sur vos arbres : ${vg.spellingVariants.join(', ')}`}
                                  >
                                    <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                    <span>inclut {vg.spellingVariants.join(', ')}</span>
                                  </span>
                                )}
                                {vg.totalTrees === 0 && (
                                  <span className="text-[11px] text-stone-400 italic">
                                    Catalogue
                                  </span>
                                )}
                                <span className="text-stone-300">•</span>
                                <span className="text-stone-500 text-[11px] truncate" title={formatHarvestPeriodSummary(vg.harvestMonths)}>
                                  {formatHarvestPeriodSummary(vg.harvestMonths)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Quinzaine Timeline */}
                        {renderQuinzaineTimeline(
                          vg.harvestMonths,
                          (qVal) => handleToggleQuinzaineOnVariety(vg, qVal),
                          isPureProject
                        )}

                        {/* Action buttons */}
                        <div className="w-10 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEditModal({ type: 'variety', item: vg })}
                            className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Modifier les détails de la variété"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* View Mode: Tree by Tree */}
            {viewMode === 'tree' && (
              <div className="divide-y divide-stone-100">
                {filteredTrees.length === 0 ? (
                  <div className="text-center py-16 text-stone-400">
                    <Trees className="w-12 h-12 mx-auto mb-2 text-stone-300 stroke-[1.5]" />
                    <p className="font-medium text-stone-600">Aucun arbre enregistré.</p>
                  </div>
                ) : (
                  filteredTrees.map(tree => {
                    const isPlanned = tree.status === 'planned';
                    const treeHarvestMonths = tree.harvestMonths || [];

                    return (
                      <div 
                        key={tree.id} 
                        className="flex items-center py-3 group hover:bg-stone-50/70 rounded-xl px-2 transition-colors gap-3"
                      >
                        {(() => {
                          const displaySpecies = isTechnicalId(tree.species)
                            ? (resolveSpecies(tree.species)?.name || 'Arbre fruitier')
                            : (tree.species || 'Arbre fruitier');
                          const displayVariety = !isTechnicalId(tree.variety) ? (tree.variety || '') : '';
                          const fullName = `${displaySpecies}${displayVariety ? ` - ${displayVariety}` : ''}`;

                          return (
                            <>
                              {/* Tree Info Column */}
                              <div 
                                className="w-60 pr-2 cursor-pointer"
                                onClick={() => handleOpenEditModal({ type: 'tree', item: tree })}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPlanned ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                                  <div className="truncate flex-1">
                                    <div className="font-semibold text-stone-900 text-sm truncate group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                                      <span>{displaySpecies}</span>
                                      {displayVariety && (
                                        <span className="text-stone-600 font-normal truncate">({displayVariety})</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                                      <span className={`text-[11px] font-medium ${isPlanned ? 'text-amber-700' : 'text-emerald-700'}`}>
                                        {isPlanned ? 'Projet' : 'Planté'}
                                      </span>
                                      {tree.expectedYield && (
                                        <>
                                          <span className="text-stone-300">•</span>
                                          <span className="text-stone-600 font-medium text-[11px]">
                                            {tree.expectedYield} {tree.expectedYieldUnit || 'kg'}
                                          </span>
                                        </>
                                      )}
                                      <span className="text-stone-300">•</span>
                                      <span className="text-stone-400 text-[11px] truncate">
                                        {formatHarvestPeriodSummary(treeHarvestMonths)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Interactive Quinzaine Timeline */}
                              {renderQuinzaineTimeline(
                                treeHarvestMonths,
                                (qVal) => handleToggleQuinzaineOnTree(tree, qVal),
                                isPlanned
                              )}

                              {/* Action buttons */}
                              <div className="w-10 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleOpenEditModal({ type: 'tree', item: tree })}
                                  className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTree(tree.id, fullName)}
                                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal for detailed Quinzaine Selection & Parameters */}
      {isModalOpen && editingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-stone-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-serif font-medium text-stone-900">
                  {editingTarget.type === 'variety' 
                    ? `Période de récolte : ${editingTarget.species || 'Variété'}`
                    : (editingTarget.treeId ? "Modifier l'arbre" : "Ajouter un arbre fruitier / projet")}
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                  Indiquez précisément les quinzaines de récolte (par tranche de 15 jours).
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                {editingTarget.harvestMonths.length} quinzaine{editingTarget.harvestMonths.length > 1 ? 's' : ''} active{editingTarget.harvestMonths.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Species & Variety selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Espèce d'arbre / fruit
                  </label>
                  <input
                    type="text"
                    list="species-select-list"
                    value={editingTarget.species}
                    onChange={e => {
                      const val = e.target.value;
                      setEditingTarget(prev => prev ? { ...prev, species: val } : null);
                    }}
                    placeholder="ex: Pommier, Cerisier, Poirier..."
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  />
                  <datalist id="species-select-list">
                    {allSpeciesList.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Variété
                  </label>
                  <input 
                    type="text"
                    value={editingTarget.variety}
                    onChange={e => setEditingTarget(prev => prev ? { ...prev, variety: e.target.value } : null)}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    placeholder="ex: Burlat, Reine des Reinettes, Conference..."
                  />
                </div>
              </div>

              {/* Spelling variants note */}
              {editingTarget.spellingVariants && editingTarget.spellingVariants.length > 0 && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-950">
                      Variante(s) d'orthographe regroupée(s) :
                    </p>
                    <p className="mt-0.5 text-amber-800">
                      Vos arbres contiennent l'orthographe : {editingTarget.spellingVariants.map(v => `« ${v} »`).join(', ')}.
                    </p>
                    <p className="mt-1 text-[11px] text-amber-700">
                      En enregistrant, vos arbres seront harmonisés sous l'appellation « {editingTarget.variety} ».
                    </p>
                  </div>
                </div>
              )}

              {/* Status and Yield (if tree mode) */}
              {editingTarget.type === 'tree' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/60">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Statut</label>
                    <select
                      value={editingTarget.status || 'planted'}
                      onChange={e => setEditingTarget(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm outline-none"
                    >
                      <option value="planted">🌿 Arbre planté</option>
                      <option value="planned">📅 Projet futur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Rendement estimé</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={editingTarget.expectedYield}
                      onChange={e => setEditingTarget(prev => prev ? { ...prev, expectedYield: e.target.value ? Number(e.target.value) : '' } : null)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm outline-none"
                      placeholder="ex: 20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Unité</label>
                    <select
                      value={editingTarget.expectedYieldUnit || 'kg'}
                      onChange={e => setEditingTarget(prev => prev ? { ...prev, expectedYieldUnit: e.target.value } : null)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm outline-none"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="pièces">pièces</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 24 Quinzaines Calendar Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Période de récolte par quinzaines
                  </label>
                  <span className="text-xs text-stone-500 font-medium">
                    {formatHarvestPeriodSummary(editingTarget.harvestMonths)}
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Été: Juin (6, 6.5), Juillet (7, 7.5), Août (8, 8.5)
                      setEditingTarget(prev => prev ? { ...prev, harvestMonths: [6, 6.5, 7, 7.5, 8, 8.5] } : null);
                    }}
                    className="px-2.5 py-1 text-xs bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg hover:bg-amber-100 transition"
                  >
                    ☀️ Été (Juin – Août)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Automne: Septembre (9, 9.5), Octobre (10, 10.5), Novembre (11, 11.5)
                      setEditingTarget(prev => prev ? { ...prev, harvestMonths: [9, 9.5, 10, 10.5, 11, 11.5] } : null);
                    }}
                    className="px-2.5 py-1 text-xs bg-orange-50 text-orange-800 border border-orange-200/80 rounded-lg hover:bg-orange-100 transition"
                  >
                    🍂 Automne (Sep – Nov)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Printemps: Mars (3, 3.5), Avril (4, 4.5), Mai (5, 5.5)
                      setEditingTarget(prev => prev ? { ...prev, harvestMonths: [3, 3.5, 4, 4.5, 5, 5.5] } : null);
                    }}
                    className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg hover:bg-emerald-100 transition"
                  >
                    🌱 Printemps (Mar – Mai)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTarget(prev => prev ? { ...prev, harvestMonths: [] } : null);
                    }}
                    className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-200 transition"
                  >
                    Effacer tout
                  </button>
                </div>

                {/* 12 Month Cards with Quinzaine Toggles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {MONTH_NAMES.map((monthName, mIdx) => {
                    const monthNum = mIdx + 1;
                    const q1 = monthNum;
                    const q2 = monthNum + 0.5;
                    const isQ1 = editingTarget.harvestMonths.some(m => Math.abs(m - q1) < 0.01);
                    const isQ2 = editingTarget.harvestMonths.some(m => Math.abs(m - q2) < 0.01);
                    const isFullMonth = isQ1 && isQ2;

                    return (
                      <div 
                        key={mIdx} 
                        className={`p-2 rounded-xl border transition-all ${
                          isFullMonth 
                            ? 'bg-emerald-50/70 border-emerald-300' 
                            : (isQ1 || isQ2) ? 'bg-emerald-50/30 border-emerald-200' : 'bg-stone-50 border-stone-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-stone-800">
                            {MONTH_ABBR[mIdx]}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTarget(prev => {
                                if (!prev) return null;
                                let updated = [...prev.harvestMonths];
                                if (isFullMonth) {
                                  updated = updated.filter(m => Math.abs(m - q1) >= 0.01 && Math.abs(m - q2) >= 0.01);
                                } else {
                                  if (!isQ1) updated.push(q1);
                                  if (!isQ2) updated.push(q2);
                                }
                                return { ...prev, harvestMonths: updated.sort((a, b) => a - b) };
                              });
                            }}
                            className="text-[10px] text-stone-400 hover:text-emerald-700 font-medium transition"
                            title="Activer/désactiver le mois complet"
                          >
                            {isFullMonth ? 'Retirer' : 'Tout'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1">
                          {/* 1ère quinzaine */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTarget(prev => {
                                if (!prev) return null;
                                const updated = isQ1 
                                  ? prev.harvestMonths.filter(m => Math.abs(m - q1) >= 0.01)
                                  : [...prev.harvestMonths, q1].sort((a, b) => a - b);
                                return { ...prev, harvestMonths: updated };
                              });
                            }}
                            className={`py-1.5 px-1 rounded-lg text-xs font-medium transition-all text-center ${
                              isQ1 
                                ? 'bg-emerald-600 text-white shadow-sm font-semibold' 
                                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                            }`}
                          >
                            1-15
                          </button>

                          {/* 2ème quinzaine */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTarget(prev => {
                                if (!prev) return null;
                                const updated = isQ2 
                                  ? prev.harvestMonths.filter(m => Math.abs(m - q2) >= 0.01)
                                  : [...prev.harvestMonths, q2].sort((a, b) => a - b);
                                return { ...prev, harvestMonths: updated };
                              });
                            }}
                            className={`py-1.5 px-1 rounded-lg text-xs font-medium transition-all text-center ${
                              isQ2 
                                ? 'bg-emerald-600 text-white shadow-sm font-semibold' 
                                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                            }`}
                          >
                            16-31
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-stone-100 flex items-center justify-between bg-stone-50/80">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-200 rounded-xl transition text-sm"
              >
                Annuler
              </button>
              <button 
                type="button"
                onClick={handleSaveModal}
                disabled={!editingTarget.species}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition text-sm shadow-sm disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Enregistrer la période</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText={confirmState.confirmText || "Supprimer"}
      />

      {/* Module d'impression du Calendrier des Récoltes */}
      <HarvestCalendarPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        varietyGroups={varietyGroups}
        filteredVarieties={filteredVarieties}
        trees={activeTrees}
        filteredTrees={filteredTrees}
        activeSpeciesFilter={selectedSpeciesFilter}
        activeStatusFilter={filterStatus}
        searchTerm={searchTerm}
      />
    </div>
  );
}
