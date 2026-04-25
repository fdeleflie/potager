import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Structure } from '../db';
import { useFirebaseData } from '../hooks/useFirebaseData';
import { StructureEditor } from '../components/StructureEditor';
import { Map as MapIcon, Sprout, Leaf, Flower2, Trees, Apple, Grape, Carrot, Cherry, Citrus, Wheat, Shrub, Palmtree, TreePine, ZoomIn, ZoomOut, Magnet, Home, Square, X, Printer, Trash2, List, Grid3X3, Ruler, BookOpen, CheckCircle2, Type } from 'lucide-react';
import { ConfirmModal } from '../components/Modals';
import { ICON_MAP, GARDEN_EMOJIS } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { printElement } from '../utils/print';
import { getDistinctColor } from '../utils/colors';

// Default spacing in cm for various vegetables
const VEGETABLE_SPACING: Record<string, number> = {
  'Tomate': 60,
  'Courgette': 100,
  'Salade': 25,
  'Radis': 5,
  'Carotte': 5,
  'Haricot': 40,
  'Aubergine': 50,
  'Poivron': 50,
  'Chou': 60,
  'Fraise': 30,
  'Melon': 100,
  'Concombre': 60,
  'Poireau': 15,
  'Oignon': 10,
  'Ail': 10,
  'Pomme de terre': 40,
  'Epinard': 20,
  'Blette': 40,
  'Céleri': 30,
  'Navet': 15,
  'Betterave': 20,
  'Mâche': 10,
  'Coriandre': 20,
  'Persil': 20,
  'Basilic': 30,
  'Menthe': 40,
  'Ciboulette': 20,
  'Thym': 30,
  'Romarin': 60,
  'Sauge': 50,
  'Estragon': 40,
  'Aneth': 30,
  'Fenouil': 40,
  'Artichaut': 100,
  'Asperge': 50,
  'Rhubarbe': 100,
  'Pois': 30,
  'Fève': 30,
  'Maïs': 40,
  'Tournesol': 50,
  'Courge': 150,
  'Potiron': 150,
  'Pastèque': 100,
  'Patate douce': 50,
  'Topinambour': 50,
  'Piment': 50,
  'Physalis': 50,
  'Arachide': 30,
  'Moutarde': 20,
  'Roquette': 15,
  'Cresson': 15,
  'Pourpier': 20,
  'Tétragone': 40,
  'Panais': 15,
  'Salsifis': 15,
  'Scorsonère': 15,
  'Rutabaga': 20,
  'Chou-rave': 25,
  'Brocoli': 60,
  'Chou-fleur': 60,
  'Chou de Bruxelles': 60,
  'Chou frisé': 50,
  'Chou chinois': 40,
  'Bok choy': 30,
};

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}



export function GardenPlan({ setCurrentView }: { setCurrentView?: (view: string) => void }) {
  const { data: rawConfig, error: configError } = useFirebaseData<any>('config');
  const zones = useMemo(() => rawConfig?.filter((z:any) => z.type === 'zone').sort((a:any, b:any) => String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: 'base' })) || [], [rawConfig]);
  const terrains = useMemo(() => rawConfig?.filter((t:any) => t.type === 'terrain').sort((a:any, b:any) => String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: 'base' })) || [], [rawConfig]);

  const { data: rawSeedlings, error: seedlingsError } = useFirebaseData<any>('seedlings');
  const seedlings = useMemo(() => rawSeedlings?.filter((s:any) => !s.isDeleted && !s.isArchived) || [], [rawSeedlings]);

  const { data: rawTrees, error: treesError } = useFirebaseData<any>('trees');
  const trees = useMemo(() => rawTrees?.filter((t:any) => !t.isDeleted) || [], [rawTrees]);

  const { data: structures, error: structuresError } = useFirebaseData<any>('structures');
  const config = rawConfig;
  const { data: encyclopedia, error: encError } = useFirebaseData<any>('encyclopedia');

  const error = configError || seedlingsError || treesError || structuresError || encError;

  const [selectedZoneId, setSelectedZoneId] = useState<string>(() => localStorage.getItem('garden_plan_selected_zone') || '');
  const [selectedSeedlingId, setSelectedSeedlingId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState<boolean>(() => {
    const saved = localStorage.getItem('gardenPlanShowLabels');
    return saved === 'true';
  });
  const [zoom, setZoom] = useState<number>(() => {
    const savedZoom = localStorage.getItem('gardenPlanZoom');
    return savedZoom ? parseFloat(savedZoom) : 2;
  });
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(10); // in cm
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureStart, setMeasureStart] = useState<{x: number, y: number} | null>(null);
  const [printScale, setPrintScale] = useState<number>(100);
  const [draggingStructureId, setDraggingStructureId] = useState<string | null>(null);
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);
  const [draggingPlant, setDraggingPlant] = useState<{ seedlingId: string, positionIndex: number } | null>(null);
  const [selectedPlantDetails, setSelectedPlantDetails] = useState<{ seedlingId: string, positionIndex: number, x: number, y: number } | null>(null);
  const [hoveredPlant, setHoveredPlant] = useState<{ seedlingId: string, positionIndex: number, x: number, y: number } | null>(null);
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  const [isAddingStructure, setIsAddingStructure] = useState(false);
  const [newStructure, setNewStructure] = useState<{ name: string, type: string, color: string, width: number, height: number }>({
    name: '',
    type: 'building',
    color: '#78716c',
    width: 50,
    height: 50
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const selectedZone = useMemo(() => zones?.find(z => z.id === selectedZoneId), [zones, selectedZoneId]);

  useEffect(() => {
    if (selectedZoneId) {
      localStorage.setItem('garden_plan_selected_zone', selectedZoneId);
    }
  }, [selectedZoneId]);

  useEffect(() => {
    localStorage.setItem('gardenPlanZoom', zoom.toString());
  }, [zoom]);

  useEffect(() => {
    localStorage.setItem('gardenPlanShowLabels', showLabels.toString());
  }, [showLabels]);

  useEffect(() => {
    if (zones && zones.length > 0) {
      const zoneExists = zones.some(z => z.id === selectedZoneId);
      if (!selectedZoneId || !zoneExists) {
        setSelectedZoneId(zones[0].id);
      }
    }
  }, [zones, selectedZoneId]);

  useEffect(() => {
    if (selectedZoneId) {
      localStorage.setItem('garden_plan_selected_zone', selectedZoneId);
    }
  }, [selectedZoneId]);

  const terrainBounds = useMemo(() => {
    if (selectedZone?.attributes?.shape === 'polygon' && Array.isArray(selectedZone.attributes?.points) && selectedZone.attributes.points.length > 0) {
      const points = selectedZone.attributes.points;
      return {
        minX: Math.min(...points.map((p: any) => p.x)),
        maxX: Math.max(...points.map((p: any) => p.x)),
        minY: Math.min(...points.map((p: any) => p.y)),
        maxY: Math.max(...points.map((p: any) => p.y))
      };
    }
    return {
      minX: 0,
      maxX: selectedZone?.attributes?.width || 1000,
      minY: 0,
      maxY: selectedZone?.attributes?.height || 1000
    };
  }, [selectedZone]);

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

  if (!zones || !seedlings || !rawConfig) return <div className="p-8 text-center text-stone-500 italic">Chargement...</div>;

  if (zones.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 border-dashed">
        <MapIcon className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-stone-900">Aucune zone définie</h3>
        <p className="text-stone-500 mt-1">Allez dans la configuration pour créer vos serres et espaces extérieurs.</p>
      </div>
    );
  }
  
  const vegetablesInPlan = Array.from(new Set((seedlings || []).map(s => s.vegetable || ''))).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const legendColors = (vegetablesInPlan || []).reduce((acc, veg) => {
    const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (veg || '').toLowerCase().trim());
    acc[veg] = encEntry?.color || stringToColor(veg);
    return acc;
  }, {} as Record<string, string>);

  const legendIcons = (vegetablesInPlan || []).reduce((acc, veg) => {
    const encEntry = encyclopedia?.find(e => (e.name || '').toLowerCase().trim() === (veg || '').toLowerCase().trim());
    acc[veg] = ICON_MAP[encEntry?.icon || ''] || Sprout;
    return acc;
  }, {} as Record<string, any>);

  const seedlingsInCurrentZone = Array.from(new Map<string, any>(seedlings.filter(s => s.zoneId === selectedZoneId && s.positions && s.positions.length > 0).map(s => [s.id, s])).values());
  
  const getMaxQuantity = (s: any) => {
    if (s.quantityPlanted !== undefined) return s.quantityPlanted;
    if (s.quantityTransplanted !== undefined) return s.quantityTransplanted;
    if (s.quantity !== undefined) return s.quantity;
    return 1;
  };

  const unplacedSeedlings = Array.from(new Map<string, any>(seedlings.filter(s => {
    if (s.state !== 'Mise en terre') return false;
    if (!s.zoneId) return true;
    const maxQuantity = getMaxQuantity(s);
    if (!s.positions || s.positions.length < maxQuantity) return true;
    return false;
  }).map(s => [s.id, s])).values());

  const snapStep = gridSize >= 10 ? gridSize / 2 : gridSize;

  const getCompanionshipStatus = (seedling: any, p: {x: number, y: number}) => {
    if (!encyclopedia) return 'neutral';
    
    const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling.vegetable);
    const spacing = vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling.vegetable] || 30;
    
    const entry = encyclopedia.find(e => e.name === seedling.vegetable);
    if (!entry) return 'neutral';

    let hasGood = false;
    let hasBad = false;

    seedlingsInCurrentZone.forEach(otherSeedling => {
      if (otherSeedling.id === seedling.id) return;
      
      const otherVegConfig = config?.find(c => c.type === 'vegetable' && c.value === otherSeedling.vegetable);
      const otherSpacing = otherVegConfig?.attributes?.spacing || VEGETABLE_SPACING[otherSeedling.vegetable] || 30;
      
      otherSeedling.positions?.forEach(otherP => {
        const dx = p.x - otherP.x;
        const dy = p.y - otherP.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if they are close enough to be considered neighbors (e.g., within their combined spacing + a small buffer)
        const threshold = (spacing / 2) + (otherSpacing / 2) + 20; 
        
        if (distance <= threshold) {
          if (entry.badCompanions?.includes(otherSeedling.vegetable)) {
            hasBad = true;
          } else if (entry.goodCompanions?.includes(otherSeedling.vegetable)) {
            hasGood = true;
          }
        }
      });
    });

    if (hasBad) return 'bad';
    if (hasGood) return 'good';
    return 'neutral';
  };

  const getCompanionshipDetails = (seedling: any, p: {x: number, y: number}) => {
    if (!encyclopedia) return { good: [], bad: [] };
    
    const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling.vegetable);
    const spacing = vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling.vegetable] || 30;
    
    const entry = encyclopedia.find(e => e.name === seedling.vegetable);
    if (!entry) return { good: [], bad: [] };

    const goodCompanions = new Set<string>();
    const badCompanions = new Set<string>();

    seedlingsInCurrentZone.forEach(otherSeedling => {
      if (otherSeedling.id === seedling.id) return;
      
      const otherVegConfig = config?.find(c => c.type === 'vegetable' && c.value === otherSeedling.vegetable);
      const otherSpacing = otherVegConfig?.attributes?.spacing || VEGETABLE_SPACING[otherSeedling.vegetable] || 30;
      
      otherSeedling.positions?.forEach(otherP => {
        const dx = p.x - otherP.x;
        const dy = p.y - otherP.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const threshold = (spacing / 2) + (otherSpacing / 2) + 20; 
        
        if (distance <= threshold) {
          if (entry.badCompanions?.includes(otherSeedling.vegetable)) {
            badCompanions.add(otherSeedling.vegetable);
          } else if (entry.goodCompanions?.includes(otherSeedling.vegetable)) {
            goodCompanions.add(otherSeedling.vegetable);
          }
        }
      });
    });

    return {
      good: Array.from(goodCompanions),
      bad: Array.from(badCompanions)
    };
  };

  const handleCanvasClick = async (e: React.MouseEvent) => {
    if (!containerRef.current) return;

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
      // Suggest a color if it's a new structure? No, use default.
      await db.structures.add({
        id: uuidv4(),
        terrainId: selectedZoneId, // Using terrainId for both zone and terrain
        zoneId: selectedZoneId,
        name: newStructure.name || 'Élément fixe',
        type: newStructure.type,
        positions: [{ x: cmX, y: cmY }],
        width: newStructure.width,
        height: newStructure.height,
        color: newStructure.color
      });
      setIsAddingStructure(false);
      setMousePos(null);
      return;
    }

    if (!selectedSeedlingId) return;

    const seedlingToPlace = seedlings?.find(s => s.id === selectedSeedlingId);
    if (!seedlingToPlace) return;

    const currentPositions = seedlingToPlace.positions || [];
    const maxQuantity = getMaxQuantity(seedlingToPlace);
    
    if (currentPositions.length >= maxQuantity) return;

    await db.seedlings.update(selectedSeedlingId, {
      zoneId: selectedZoneId,
      positions: [...currentPositions, { x: cmX, y: cmY }]
    });
    
    if (currentPositions.length + 1 >= maxQuantity) {
      setSelectedSeedlingId(null);
      setMousePos(null);
    }
  };

  const getTerrainBoundsAtPoint = (cmX: number, cmY: number) => {
    if (selectedZone?.attributes?.shape === 'polygon' && Array.isArray(selectedZone.attributes?.points) && selectedZone.attributes.points.length > 2) {
      const points = selectedZone.attributes.points as {x: number, y: number}[];
      
      let minX = terrainBounds.minX;
      let maxX = terrainBounds.maxX;
      let minY = terrainBounds.minY;
      let maxY = terrainBounds.maxY;

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

  const getNearestElementDistance = (cmX: number, cmY: number, ghostRadius: number, excludeId?: string, excludePlant?: {seedlingId: string, positionIndex: number}) => {
    let minDist = Infinity;
    let nearestName = '';

    seedlingsInCurrentZone.forEach(s => {
      s.positions?.forEach((p, idx) => {
        if (excludePlant && excludePlant.seedlingId === s.id && excludePlant.positionIndex === idx) return;
        const dist = Math.sqrt(Math.pow(p.x - cmX, 2) + Math.pow(p.y - cmY, 2));
        const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === s.vegetable);
        const spacing = vegConfig?.attributes?.spacing || VEGETABLE_SPACING[s.vegetable] || 30;
        const actualDist = Math.max(0, dist - spacing / 2 - ghostRadius);
        if (actualDist < minDist) {
          minDist = actualDist;
          nearestName = s.vegetable;
        }
      });
    });

    structures?.filter(s => s.zoneId === selectedZoneId).forEach(s => {
      if (s.id === excludeId) return;
      s.positions.forEach(p => {
        const dist = Math.sqrt(Math.pow(p.x - cmX, 2) + Math.pow(p.y - cmY, 2));
        const width = s.width || 50;
        const height = s.height || 50;
        const radius = Math.min(width, height) / 2;
        const actualDist = Math.max(0, dist - radius - ghostRadius);
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
    if (selectedSeedlingId || isAddingStructure || draggingStructureId || draggingPlant) {
      if (draggingStructureId || draggingPlant) setIsActuallyDragging(true);
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

    if (!selectedSeedlingId && !isAddingStructure && !draggingStructureId && !draggingPlant && !isMeasuring) return;
    
    let cmX = mouseX / zoom;
    let cmY = mouseY / zoom;

    if (snapToGrid) {
      const snapStep = gridSize / 2;
      cmX = Math.round(cmX / snapStep) * snapStep;
      cmY = Math.round(cmY / snapStep) * snapStep;
    }

    setMousePos({ x: cmX * zoom, y: cmY * zoom });
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    if (draggingPlant && containerRef.current) {
      if (isActuallyDragging) {
        const rect = containerRef.current.getBoundingClientRect();
        let cmX = Math.round((e.clientX - rect.left) / zoom);
        let cmY = Math.round((e.clientY - rect.top) / zoom);
        
        if (snapToGrid) {
          cmX = Math.round(cmX / snapStep) * snapStep;
          cmY = Math.round(cmY / snapStep) * snapStep;
        }

        const seedling = seedlings?.find(s => s.id === draggingPlant.seedlingId);
        if (seedling && seedling.positions) {
          const newPositions = [...seedling.positions];
          newPositions[draggingPlant.positionIndex] = { x: cmX, y: cmY };
          await db.seedlings.update(draggingPlant.seedlingId, {
            positions: newPositions
          });
        }
      }
      
      setDraggingPlant(null);
      setIsActuallyDragging(false);
      setMousePos(null);
      return;
    }

    if (draggingStructureId && containerRef.current) {
      if (isActuallyDragging) {
        const rect = containerRef.current.getBoundingClientRect();
        let cmX = Math.round((e.clientX - rect.left) / zoom);
        let cmY = Math.round((e.clientY - rect.top) / zoom);
        
        if (snapToGrid) {
          cmX = Math.round(cmX / snapStep) * snapStep;
          cmY = Math.round(cmY / snapStep) * snapStep;
        }

        await db.structures.update(draggingStructureId, {
          positions: [{ x: cmX, y: cmY }]
        });
      }
      setDraggingStructureId(null);
      setIsActuallyDragging(false);
      setMousePos(null);
    }
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    setDraggingStructureId(null);
    setDraggingPlant(null);
    setIsActuallyDragging(false);
  };

  const handlePlantMouseDown = (e: React.MouseEvent, seedlingId: string, positionIndex: number) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click
    setDraggingPlant({ seedlingId, positionIndex });
    setIsActuallyDragging(false);
  };

  const handleRemovePlant = (e: React.MouseEvent, seedlingId: string, x: number, y: number) => {
    e.stopPropagation(); // Prevent canvas click
    if (draggingPlant) return; // Don't trigger click if dragging
    const existingSeedling = seedlings.find(s => s.id === seedlingId);
    if (!existingSeedling) return;

    setConfirmState({
      isOpen: true,
      title: 'Détails du plant',
      message: `Légume : ${existingSeedling.vegetable}\nVariété : ${existingSeedling.variety || 'Non spécifiée'}\n\nVoulez-vous retirer ce plant de cet emplacement ?`,
      isDanger: true,
      onConfirm: async () => {
        const newPositions = existingSeedling.positions?.filter(p => !(p.x === x && p.y === y)) || [];
        if (newPositions.length === 0) {
          await db.seedlings.update(existingSeedling.id, {
            zoneId: undefined,
            positions: []
          });
        } else {
          await db.seedlings.update(existingSeedling.id, {
            positions: newPositions
          });
        }
      }
    });
  };

  const handleStructureClick = (e: React.MouseEvent, structureId: string) => {
    e.stopPropagation();
    // Allow opening the editor even if draggingStructureId is set,
    // as long as we are not actually dragging (isActuallyDragging is false)
    if (isActuallyDragging) return;
    setEditingStructureId(structureId);
  };

  const handleUpdateStructure = async (updatedData: any) => {
    if (!editingStructureId) return;
    await db.structures.update(editingStructureId, updatedData);
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
        await db.structures.delete(structureId);
        setEditingStructureId(null);
      }
    });
  };

  const zoneWidth = selectedZone?.attributes?.width || 100;
  const zoneHeight = selectedZone?.attributes?.height || 100;
  
  // Background grid pattern
  const gridPatternSize = gridSize * zoom;

  const selectedSeedling = seedlings?.find(s => s.id === selectedSeedlingId);
  const selectedSeedlingConfig = config?.find(c => c.type === 'vegetable' && c.value === selectedSeedling?.vegetable);
  const ghostSpacing = selectedSeedling ? (selectedSeedlingConfig?.attributes?.spacing || VEGETABLE_SPACING[selectedSeedling.vegetable] || 30) : 30;
  const ghostRadius = (ghostSpacing / 2) * zoom;

  const vegetablesInCurrentZone = Array.from(new Set(seedlingsInCurrentZone.map(s => s.vegetable))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText="Retirer"
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
            <MapIcon className="w-8 h-8 text-emerald-600" />
            Plan du potager
          </h1>
          <p className="text-stone-500 mt-2">Placez vos plantations librement dans vos zones.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-stone-200">
            <Grid3X3 className="w-4 h-4 text-stone-400" />
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
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
            onClick={() => setIsMeasuring(!isMeasuring)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${isMeasuring ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-stone-200 text-stone-600'}`}
            title={isMeasuring ? "Outil de mesure activé" : "Outil de mesure"}
          >
            <Ruler className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Mesurer</span>
          </button>
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${snapToGrid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-stone-200 text-stone-600'}`}
            title={snapToGrid ? "Magnétisme activé" : "Magnétisme désactivé"}
          >
            <Magnet className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Magnétisme</span>
          </button>
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${showLabels ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-stone-200 text-stone-600'}`}
            title={showLabels ? "Masquer les noms" : "Afficher les noms"}
          >
            <Type className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Noms</span>
          </button>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-stone-200">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))} className="p-1 hover:bg-stone-100 rounded text-stone-600">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-stone-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(5, z + 0.5))} className="p-1 hover:bg-stone-100 rounded text-stone-600">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <select 
            value={selectedZoneId} 
            onChange={e => {
              setSelectedZoneId(e.target.value);
              setSelectedSeedlingId(null);
              setIsAddingStructure(false);
            }}
            className="px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
          >
            <optgroup label="Potager (Zones)">
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.value} ({z.attributes?.type})</option>
              ))}
            </optgroup>
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
            onClick={() => setCurrentView?.('encyclopedia')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors h-[42px]"
            title="Guide des associations"
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium hidden xl:inline">Guide</span>
          </button>

          <button 
            onClick={() => printElement('garden-plan-print-area', `Plan du Potager - ${selectedZone?.value}`, printScale)}
            className="p-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-stone-200 bg-white h-[42px] w-[42px] flex items-center justify-center"
            title="Imprimer"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="garden-plan-print-area">
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 flex flex-col print:border-none print:shadow-none print:p-0">
          <div className="mb-4 flex justify-between items-start flex-wrap gap-4 print:hidden">
            <div className="flex gap-4 flex-wrap flex-1">
              <h3 className="font-medium text-stone-900 w-full text-sm uppercase tracking-wider">Légende (Zone actuelle)</h3>
              {vegetablesInCurrentZone.length === 0 && <span className="text-sm text-stone-500 italic">Aucun plant dans cette zone</span>}
              {vegetablesInCurrentZone.map(veg => (
                <div key={veg} className="flex items-center gap-2 text-sm px-3 py-1.5 bg-stone-50 rounded-full border border-stone-100">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: legendColors[veg] }}>
                    {React.createElement(legendIcons[veg], { className: "w-2.5 h-2.5 text-white" })}
                  </div>
                  <span className="text-stone-700">{veg}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setIsAddingStructure(!isAddingStructure);
                setSelectedSeedlingId(null);
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

          <div className="print:block hidden mb-8">
            <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">Plan du Potager: {selectedZone?.value}</h1>
            <p className="text-stone-500 text-sm">Généré le {new Date().toLocaleDateString()}</p>
          </div>

          {isAddingStructure && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Nom de l'élément</label>
                <input 
                  type="text" 
                  value={newStructure.name} 
                  onChange={e => setNewStructure({...newStructure, name: e.target.value})}
                  placeholder="ex: Table, Chemin..."
                  className="w-40 px-3 py-1.5 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Largeur (cm)</label>
                <input 
                  type="number" 
                  value={newStructure.width} 
                  onChange={e => setNewStructure({...newStructure, width: parseInt(e.target.value) || 50})}
                  className="w-24 px-3 py-1.5 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Hauteur (cm)</label>
                <input 
                  type="number" 
                  value={newStructure.height} 
                  onChange={e => setNewStructure({...newStructure, height: parseInt(e.target.value) || 50})}
                  className="w-24 px-3 py-1.5 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Couleur</label>
                <input 
                  type="color" 
                  value={newStructure.color} 
                  onChange={e => setNewStructure({...newStructure, color: e.target.value})}
                  className="w-12 h-8 rounded-lg border border-stone-200 p-0.5 bg-white cursor-pointer"
                />
              </div>
              <div className="text-sm text-emerald-700 font-medium pb-1.5">
                Cliquez sur le plan pour placer l'élément.
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto bg-stone-100 rounded-xl border border-stone-200 relative">
            <div 
              ref={containerRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              className="relative cursor-crosshair"
              style={{ 
                width: zoneWidth * zoom, 
                height: zoneHeight * zoom,
                backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)`,
                backgroundSize: `${gridPatternSize}px ${gridPatternSize}px`,
                backgroundPosition: '0 0',
                backgroundColor: '#f5f5f4',
                clipPath: selectedZone?.attributes?.shape === 'polygon' && Array.isArray(selectedZone.attributes?.points) && selectedZone.attributes.points.length >= 3
                  ? `polygon(${selectedZone.attributes.points.map((p: any) => `${p.x * zoom}px ${p.y * zoom}px`).join(', ')})`
                  : 'none'
              }}
            >
              {/* Render structures */}
              {structures?.filter(s => s.terrainId === selectedZoneId || s.zoneId === selectedZoneId).map(structure => {
                return structure.positions.map((p, idx) => {
                  const width = (structure.width || 50) * zoom;
                  const height = (structure.height || 50) * zoom;
                  const isDragging = draggingStructureId === structure.id;

                  // Center the structure on the click point
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
                        backgroundColor: `${structure.color || '#78716c'}80`,
                        border: `2px solid ${structure.color || '#78716c'}`,
                        borderRadius: '8px'
                      }}
                      title={`${structure.name}\n${structure.width}x${structure.height}cm\nGlissez pour déplacer, Cliquez pour retirer`}
                    >
                      <span className="text-xs font-medium text-white drop-shadow-md px-1 text-center leading-tight">{structure.name}</span>
                    </div>
                  );
                });
              })}

              {/* Render placed seedlings */}
              {seedlingsInCurrentZone.map(seedling => {
                const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling.vegetable);
                const spacing = vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling.vegetable] || 30;
                const radius = (spacing / 2) * zoom;
                const color = legendColors[seedling.vegetable];
                const Icon = legendIcons[seedling.vegetable];

                return seedling.positions?.map((p, idx) => {
                  // If old data has very small x/y (grid coords), they will just appear clustered.
                  // We treat all x/y as cm.
                  const left = (p.x * zoom) - radius;
                  const top = (p.y * zoom) - radius;
                  const compStatus = getCompanionshipStatus(seedling, p);
                  
                  let ringClass = '';
                  if (compStatus === 'bad') ringClass = 'ring-2 ring-red-500 ring-offset-1';
                  else if (compStatus === 'good') ringClass = 'ring-2 ring-emerald-500 ring-offset-1';

                      return (
                        <div
                          key={`${seedling.id}-${idx}`}
                          onMouseDown={(e) => handlePlantMouseDown(e, seedling.id, idx)}
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentSeedling = seedlings?.find(s => s.id === seedling.id);
                            if (!currentSeedling) return;
                            setSelectedPlantDetails({
                              seedlingId: seedling.id,
                              positionIndex: idx,
                              x: e.clientX,
                              y: e.clientY
                            });
                          }}
                          className={`absolute rounded-full flex items-center justify-center shadow-md cursor-move hover:z-10 transition-all group hover:scale-110 ${ringClass} ${draggingPlant?.seedlingId === seedling.id && draggingPlant?.positionIndex === idx ? 'opacity-0' : ''}`}
                          style={{
                            left,
                            top,
                            width: spacing * zoom,
                            height: spacing * zoom,
                            backgroundColor: `${color}30`,
                            border: `2px solid ${color}`,
                          }}
                          onMouseEnter={(e) => {
                            setHoveredPlant({
                              seedlingId: seedling.id,
                              positionIndex: idx,
                              x: e.clientX,
                              y: e.clientY
                            });
                          }}
                          onMouseLeave={() => setHoveredPlant(null)}
                          title={`${seedling.vegetable}${seedling.variety ? ` - ${seedling.variety}` : ''}`}
                        >
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity shadow-inner relative" 
                        style={{ 
                          background: `radial-gradient(circle at 30% 30%, ${color}, ${color}dd)`,
                          boxShadow: `0 1px 3px rgba(0,0,0,0.2)`
                        }}
                      >
                        {GARDEN_EMOJIS.includes(vegConfig?.attributes?.icon) ? (
                          <span className="text-sm">{vegConfig.attributes.icon}</span>
                        ) : (
                          <Icon className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                        )}
                        {compStatus === 'bad' && (
                          <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                            <X className="w-2.5 h-2.5 text-red-500" />
                          </div>
                        )}
                        {compStatus === 'good' && (
                          <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                          </div>
                        )}
                      </div>
                      {showLabels && zoom >= 0.6 && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 flex flex-col items-center pointer-events-none whitespace-nowrap z-10 transition-opacity">
                          <div className="bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded shadow-sm border border-stone-200/50 flex flex-col items-center">
                            <span className="text-[9px] font-bold text-stone-800 leading-tight">
                              {seedling.vegetable}
                            </span>
                            {seedling.variety && (
                              <span className="text-[8px] font-medium text-stone-600 leading-tight">
                                {seedling.variety}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })}

                {/* Render ghost seedling when placing */}
                {mousePos && (
                  <div
                    className="absolute rounded-full pointer-events-none z-20 flex items-center justify-center"
                    style={
                      draggingPlant ? (() => {
                        const seedling = seedlings?.find(s => s.id === draggingPlant.seedlingId);
                        const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                        const spacing = vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30;
                        const color = legendColors[seedling?.vegetable || ''];
                        return {
                          left: mousePos.x - (spacing / 2) * zoom,
                          top: mousePos.y - (spacing / 2) * zoom,
                          width: spacing * zoom,
                          height: spacing * zoom,
                          backgroundColor: `${color}60`,
                          border: `2px dashed ${color}`,
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
                      } : selectedSeedlingId ? (() => {
                        const seedling = seedlings?.find(s => s.id === selectedSeedlingId);
                        const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                        const spacing = vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30;
                        const color = legendColors[seedling?.vegetable || ''];
                        return {
                          left: mousePos.x - (spacing / 2) * zoom,
                          top: mousePos.y - (spacing / 2) * zoom,
                          width: spacing * zoom,
                          height: spacing * zoom,
                          backgroundColor: `${color}60`,
                          border: `2px dashed ${color}`,
                        };
                      })() : {}
                    }
                  >
                    {draggingPlant && (() => {
                      const seedling = seedlings?.find(s => s.id === draggingPlant.seedlingId);
                      const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                      const color = legendColors[seedling?.vegetable || ''];
                      const icon = vegConfig?.attributes?.icon;
                      
                      const compStatus = getCompanionshipStatus(seedling, { x: mousePos.x / zoom, y: mousePos.y / zoom });
                      let ringClass = '';
                      if (compStatus === 'bad') ringClass = 'ring-2 ring-red-500 ring-offset-1';
                      else if (compStatus === 'good') ringClass = 'ring-2 ring-emerald-500 ring-offset-1';

                      return (
                        <>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center relative ${ringClass}`} style={{ backgroundColor: color }}>
                          {GARDEN_EMOJIS.includes(icon) ? (
                            <span className="text-sm">{icon}</span>
                          ) : (
                            React.createElement(legendIcons[seedling?.vegetable || ''], { className: "w-3.5 h-3.5 text-white" })
                          )}
                          {compStatus === 'bad' && (
                            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                              <X className="w-2.5 h-2.5 text-red-500" />
                            </div>
                          )}
                          {compStatus === 'good' && (
                            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            </div>
                          )}
                        </div>
                        {showLabels && zoom >= 0.6 && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 flex flex-col items-center pointer-events-none whitespace-nowrap z-10 transition-opacity">
                            <div className="bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded shadow-sm border border-stone-200/50 flex flex-col items-center">
                              <span className="text-[9px] font-bold text-stone-800 leading-tight">
                                {seedling?.vegetable}
                              </span>
                              {seedling?.variety && (
                                <span className="text-[8px] font-medium text-stone-600 leading-tight">
                                  {seedling.variety}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {selectedSeedlingId && (() => {
                    const seedling = seedlings?.find(s => s.id === selectedSeedlingId);
                    const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                    const color = legendColors[seedling?.vegetable || ''];
                    const icon = vegConfig?.attributes?.icon;

                    const compStatus = getCompanionshipStatus(seedling, { x: mousePos.x / zoom, y: mousePos.y / zoom });
                    let ringClass = '';
                    if (compStatus === 'bad') ringClass = 'ring-2 ring-red-500 ring-offset-1';
                    else if (compStatus === 'good') ringClass = 'ring-2 ring-emerald-500 ring-offset-1';

                    return (
                      <>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center relative ${ringClass}`} style={{ backgroundColor: color }}>
                          {GARDEN_EMOJIS.includes(icon) ? (
                            <span className="text-sm">{icon}</span>
                          ) : (
                            React.createElement(legendIcons[seedling?.vegetable || ''], { className: "w-3.5 h-3.5 text-white" })
                          )}
                          {compStatus === 'bad' && (
                            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                              <X className="w-2.5 h-2.5 text-red-500" />
                            </div>
                          )}
                          {compStatus === 'good' && (
                            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            </div>
                          )}
                        </div>
                        {showLabels && zoom >= 0.6 && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 flex flex-col items-center pointer-events-none whitespace-nowrap z-10 transition-opacity">
                            <div className="bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded shadow-sm border border-stone-200/50 flex flex-col items-center">
                              <span className="text-[9px] font-bold text-stone-800 leading-tight">
                                {seedling?.vegetable}
                              </span>
                              {seedling?.variety && (
                                <span className="text-[8px] font-medium text-stone-600 leading-tight">
                                  {seedling.variety}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                    <div 
                      className={`absolute bg-stone-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap flex flex-col items-center gap-0.5 shadow-lg z-50 ${mousePos.y > (containerRef.current?.clientHeight || 0) / 2 ? '-top-24' : '-bottom-24'}`}
                    >
                      <div className="font-bold border-b border-white/20 pb-0.5 mb-0.5 w-full text-center">
                        Centre: {Math.round(mousePos.x / zoom)}cm, {Math.round(mousePos.y / zoom)}cm
                      </div>
                      <div className="flex flex-col gap-0.5 opacity-90">
                        <div className="flex justify-between gap-4">
                          <span>Bord G: {Math.round((mousePos.x - getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).minX * zoom - (() => {
                            if (draggingPlant) {
                              const seedling = seedlings?.find(s => s.id === draggingPlant.seedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return ((vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.width || 50) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.width || 50) / 2) * zoom;
                            if (selectedSeedlingId) {
                              const seedling = seedlings?.find(s => s.id === selectedSeedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return ((vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2) * zoom;
                            }
                            return 0;
                          })()) / zoom)}cm</span>
                          <span>Bord D: {Math.round((getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).maxX * zoom - (mousePos.x + (() => {
                            if (draggingPlant) {
                              const seedling = seedlings?.find(s => s.id === draggingPlant.seedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return ((vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.width || 50) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.width || 50) / 2) * zoom;
                            if (selectedSeedlingId) {
                              const seedling = seedlings?.find(s => s.id === selectedSeedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return ((vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2) * zoom;
                            }
                            return 0;
                          })())) / zoom)}cm</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Bord H: {Math.round((mousePos.y - getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).minY * zoom - (() => {
                            if (draggingPlant) {
                              const seedling = seedlings?.find(s => s.id === draggingPlant.seedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return ((vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.height || 50) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.height || 50) / 2) * zoom;
                            if (selectedSeedlingId) {
                              const seedling = seedlings?.find(s => s.id === selectedSeedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return ((vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2) * zoom;
                            }
                            return 0;
                          })()) / zoom)}cm</span>
                          <span>Bord B: {Math.round((getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).maxY * zoom - (mousePos.y + (() => {
                            if (draggingPlant) {
                              const seedling = seedlings?.find(s => s.id === draggingPlant.seedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return ((vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.height || 50) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.height || 50) / 2) * zoom;
                            if (selectedSeedlingId) {
                              const seedling = seedlings?.find(s => s.id === selectedSeedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return ((vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2) * zoom;
                            }
                            return 0;
                          })())) / zoom)}cm</span>
                        </div>
                        {(() => {
                          const ghostRadius = (() => {
                            if (draggingPlant) {
                              const seedling = seedlings?.find(s => s.id === draggingPlant.seedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return (vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return Math.min(structure?.width || 50, structure?.height || 50) / 2;
                            }
                            if (isAddingStructure) return Math.min(newStructure.width || 50, newStructure.height || 50) / 2;
                            if (selectedSeedlingId) {
                              const seedling = seedlings?.find(s => s.id === selectedSeedlingId);
                              const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === seedling?.vegetable);
                              return (vegConfig?.attributes?.spacing || VEGETABLE_SPACING[seedling?.vegetable || ''] || 30) / 2;
                            }
                            return 0;
                          })();
                          const nearest = getNearestElementDistance(mousePos.x / zoom, mousePos.y / zoom, ghostRadius, draggingStructureId || undefined, draggingPlant || undefined);
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
          <p className="text-xs text-stone-400 mt-4 text-center print:hidden">
            La grille de fond représente des carrés de {gridSize}x{gridSize} cm. Sélectionnez un plant à droite et cliquez sur le plan pour le placer librement.
          </p>

          <div className="mt-8 bg-stone-50 p-6 rounded-2xl border border-stone-200/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-stone-900">Légende du plan</h3>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Récapitulatif</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {vegetablesInCurrentZone.map(veg => {
                const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === veg);
                const color = legendColors[veg];
                const Icon = legendIcons[veg];
                const count = seedlingsInCurrentZone.filter(s => s.vegetable === veg).reduce((acc, s) => acc + (s.positions?.length || 0), 0);
                
                return (
                  <div key={veg} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-stone-100 shadow-sm transition-all hover:shadow-md">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-inner shrink-0" 
                      style={{ 
                        background: `radial-gradient(circle at 30% 30%, ${color}, ${color}dd)`,
                        boxShadow: `0 2px 4px ${color}40`
                      }}
                    >
                      {GARDEN_EMOJIS.includes(vegConfig?.attributes?.icon) ? (
                        <span className="text-xl">{vegConfig.attributes.icon}</span>
                      ) : (
                        <Icon className="w-5 h-5 text-white drop-shadow-sm" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-stone-800 font-semibold text-sm leading-tight">{veg}</span>
                      <span className="text-stone-500 text-[10px] font-medium uppercase tracking-tighter">{count} plant{count > 1 ? 's' : ''} placé{count > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 h-fit max-h-[800px] overflow-y-auto print:hidden">
          <h3 className="font-medium text-stone-900 mb-4">Plants à placer</h3>
          {unplacedSeedlings.length === 0 ? (
            <p className="text-sm text-stone-500 italic">
              Aucun plant en statut "Mise en terre" en attente de placement.
            </p>
          ) : (
            <div className="space-y-2">
              {unplacedSeedlings.map(s => {
                const vegConfig = config?.find(c => c.type === 'vegetable' && c.value === s.vegetable);
                const spacing = vegConfig?.attributes?.spacing || VEGETABLE_SPACING[s.vegetable] || 30;
                return (
                  <div 
                    key={s.id}
                    onClick={() => {
                      setSelectedSeedlingId(s.id === selectedSeedlingId ? null : s.id);
                      setIsAddingStructure(false);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center gap-3
                      ${selectedSeedlingId === s.id ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:border-emerald-300 hover:bg-stone-50'}
                    `}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: legendColors[s.vegetable] }}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{s.vegetable}</p>
                      <p className="text-xs text-stone-500 truncate">{s.variety}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">Ø {spacing}cm</p>
                    </div>
                    <span className="text-xs font-medium bg-stone-100 px-2 py-1 rounded-md">
                      {s.positions?.length || 0}/{getMaxQuantity(s)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recapitulatif */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 print:mt-8">
        <h3 className="font-serif text-xl font-medium text-stone-900 mb-4">Récapitulatif de la zone</h3>
        {seedlingsInCurrentZone.length === 0 ? (
          <p className="text-sm text-stone-500 italic">Aucune plantation dans cette zone.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-stone-600">
              <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 font-medium rounded-tl-lg">Légume</th>
                  <th className="px-4 py-3 font-medium">Variété</th>
                  <th className="px-4 py-3 font-medium text-right">Quantité placée</th>
                  <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Objectif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {seedlingsInCurrentZone.map(s => (
                  <tr key={s.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-stone-900 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: legendColors[s.vegetable] }}></div>
                      {s.vegetable}
                    </td>
                    <td className="px-4 py-3">{s.variety || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{s.positions?.length || 0}</td>
                    <td className="px-4 py-3 text-right text-stone-500">{getMaxQuantity(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Hovered Plant Tooltip */}
      {hoveredPlant && !selectedPlantDetails && !draggingPlant && (
        <div 
          className="fixed z-50 bg-stone-900/90 text-white rounded-lg shadow-xl border border-stone-700 p-3 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{ 
            left: Math.min(hoveredPlant.x + 15, window.innerWidth - 200), 
            top: Math.min(hoveredPlant.y + 15, window.innerHeight - 100) 
          }}
        >
          {(() => {
            const s = seedlings?.find(s => s.id === hoveredPlant.seedlingId);
            if (!s) return null;
            return (
              <div className="space-y-1">
                <p className="font-medium text-sm">{s.vegetable}</p>
                {s.variety && <p className="text-xs text-stone-300">{s.variety}</p>}
              </div>
            );
          })()}
        </div>
      )}

      {/* Plant Details Popover */}
      {selectedPlantDetails && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setSelectedPlantDetails(null)}
          />
          <div 
            className="fixed z-50 bg-white rounded-xl shadow-xl border border-stone-200 p-4 w-64"
            style={{ 
              left: Math.min(selectedPlantDetails.x + 10, window.innerWidth - 270), 
              top: Math.min(selectedPlantDetails.y + 10, window.innerHeight - 200) 
            }}
          >
            {(() => {
              const s = seedlings?.find(s => s.id === selectedPlantDetails.seedlingId);
              if (!s) return null;
              return (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-stone-900">{s.vegetable}</h4>
                    <button 
                      onClick={() => setSelectedPlantDetails(null)}
                      className="text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-stone-600 mb-3">{s.variety || 'Sans variété'}</p>
                  
                  <div className="space-y-2 text-xs text-stone-500 mb-4">
                    {s.datePlanted && (
                      <p>Planté le: {new Date(s.datePlanted).toLocaleDateString()}</p>
                    )}
                    <p>Récoltes: {s.harvests?.length || 0}</p>
                    
                    {(() => {
                      const pos = s.positions?.[selectedPlantDetails.positionIndex];
                      if (!pos) return null;
                      const compDetails = getCompanionshipDetails(s, pos);
                      if (compDetails.good.length === 0 && compDetails.bad.length === 0) return null;
                      
                      return (
                        <div className="mt-3 pt-3 border-t border-stone-100">
                          <p className="font-medium text-stone-700 mb-1">Associations à proximité :</p>
                          {compDetails.good.length > 0 && (
                            <div className="flex items-start gap-1.5 text-emerald-600 mt-1">
                              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>{compDetails.good.join(', ')}</span>
                            </div>
                          )}
                          {compDetails.bad.length > 0 && (
                            <div className="flex items-start gap-1.5 text-red-600 mt-1">
                              <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>{compDetails.bad.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-stone-100">
                    <button
                      onClick={() => {
                        if (setCurrentView) {
                          setCurrentView(`seedling-detail-${s.id}`);
                        }
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Voir détails
                    </button>
                    <button
                      onClick={() => {
                        const newPositions = s.positions?.filter((_, i) => i !== selectedPlantDetails.positionIndex) || [];
                        db.seedlings.update(s.id, { positions: newPositions });
                        setSelectedPlantDetails(null);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Retirer du plan
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}

