import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Tree, Note, Structure, ConfigItem } from '../db';
import { StructureEditor } from '../components/StructureEditor';
import { 
  Trees, Plus, Map as MapIcon, Image as ImageIcon, Trash2, Edit2, 
  Camera, XCircle, Sprout, Leaf, Flower2, Apple, Grape, Carrot, 
  Cherry, Citrus, Wheat, Shrub, Palmtree, TreePine, List, Printer, 
  Home, Square, Save, X, Palette, ZoomIn, ZoomOut, Magnet, Lock, Unlock,
  MousePointer2, MapPin, Grid3X3, Ruler
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmModal } from '../components/Modals';
import { ICON_MAP, ICON_LIST, GARDEN_EMOJIS, GARDEN_EMOJI_CATEGORIES } from '../constants';
import { printElement } from '../utils/print';
import { getDistinctColor } from '../utils/colors';



export function Orchard() {
  const terrains = useLiveQuery(async () => {
    const t = await db.config.where('type').equals('terrain').toArray();
    return t.sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' }));
  });
  const trees = useLiveQuery(() => db.trees.toArray());
  const structures = useLiveQuery(() => db.structures.toArray());
  const config = useLiveQuery(() => db.config.toArray());
  const encyclopedia = useLiveQuery(() => db.encyclopedia.toArray());

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
  
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [isAddingTree, setIsAddingTree] = useState(false);
  const [isEditingTree, setIsEditingTree] = useState(false);
  const [isMovingTree, setIsMovingTree] = useState(false);
  const [isCopyingTree, setIsCopyingTree] = useState(false);
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
    const filtered = trees?.filter(t => t.terrainId === selectedTerrainId) || [];
    return Array.from(new Map<string, any>(filtered.map(t => [t.id, t])).values());
  }, [trees, selectedTerrainId]);
  const structuresInCurrentTerrain = useMemo(() => {
    const filtered = structures?.filter(s => s.terrainId === selectedTerrainId) || [];
    return Array.from(new Map<string, any>(filtered.map(s => [s.id, s])).values());
  }, [structures, selectedTerrainId]);

  const getVarietiesForSpecies = (species: string) => {
    const varieties = new Set<string>();
    
    // 1. From existing trees
    if (trees) {
      trees.forEach(t => {
        if (t.species?.toLowerCase() === species?.toLowerCase() && t.variety) {
          varieties.add(t.variety);
        }
      });
    }

    // 2. From config table (catalog)
    if (config) {
      const speciesEnc = encyclopedia?.find(e => e.name?.toLowerCase().trim() === species?.toLowerCase().trim());
      const speciesConfig = config.find(c => c.type === 'vegetable' && c.value?.toLowerCase().trim() === species?.toLowerCase().trim());
      
      config.filter(c => {
        if (c.type !== 'variety') return false;
        
        // Match by ID
        if (c.parentId === speciesEnc?.id || c.parentId === speciesConfig?.id) return true;
        
        // Match by Name
        if (c.parentId?.toLowerCase().trim() === species?.toLowerCase().trim()) return true;
        
        // Match via parent config item
        const parentVegConfig = config.find(v => v.id === c.parentId && v.type === 'vegetable');
        if (parentVegConfig && parentVegConfig.value?.toLowerCase().trim() === species?.toLowerCase().trim()) {
          return true;
        }

        // Match via parent encyclopedia entry
        const parentVegEnc = encyclopedia?.find(e => e.id === c.parentId);
        if (parentVegEnc && parentVegEnc.name?.toLowerCase().trim() === species?.toLowerCase().trim()) {
          return true;
        }

        return false;
      }).forEach(v => varieties.add(v.value));
    }

    return Array.from(varieties).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  };

  // Set default terrain if none selected
  useEffect(() => {
    if (terrains && terrains.length > 0) {
      const terrainExists = terrains.some(t => t.id === selectedTerrainId);
      if (!selectedTerrainId || !terrainExists) {
        setSelectedTerrainId(terrains[0].id);
      }
    }
  }, [terrains, selectedTerrainId]);

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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPhotoPreview(base64String);
        setNewTree({ ...newTree, photo: base64String });
      };
      reader.readAsDataURL(file);
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
      await db.structures.add({
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
      await db.trees.update(selectedTreeId, { positionX: cmX, positionY: cmY });
      setIsMovingTree(false);
      return;
    }

    if (isCopyingTree && selectedTreeId) {
      const sourceTree = treesInCurrentTerrain.find(t => t.id === selectedTreeId);
      if (sourceTree) {
        const { id, ...rest } = sourceTree;
        await db.trees.add({
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

    // If in add mode, start adding a tree
    setSelectedTreeId(null);
    setNewTree({ positionX: cmX, positionY: cmY });
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
    const availableWidth = containerRect.width - padding;
    const availableHeight = containerRect.height - padding;
    
    const zoomX = availableWidth / terrainWidth;
    const zoomY = availableHeight / terrainHeight;
    
    const optimalZoom = Math.min(zoomX, zoomY);
    setZoom(Math.max(0.05, Math.min(5, optimalZoom)));
  };

  const wasDraggingRef = useRef(false);

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

        await db.trees.update(draggingTreeId, {
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

        await db.structures.update(draggingStructureId, {
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

  const handleSaveTree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerrainId || !newTree.species || newTree.positionX === undefined) return;

    // Check if species exists in encyclopedia, if not add it
    let encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim());
    let speciesId = encEntry?.id;
    if (!speciesId) {
      speciesId = uuidv4();
      const existingColors = encyclopedia?.map(v => v.color).filter(Boolean) as string[] || [];
      await db.encyclopedia.add({
        id: speciesId,
        name: newTree.species,
        color: newTree.color || getDistinctColor(existingColors),
        icon: newTree.icon || 'Trees',
        category: 'Arbre fruitier',
        sowingPeriod: '',
        plantingPeriod: '',
        harvestPeriod: '',
        exposure: 'Plein soleil',
        waterNeeds: 'Moyen',
        spacing: '',
        goodCompanions: [],
        badCompanions: [],
        tips: '',
        updatedAt: new Date().toISOString()
      });
    }

    // Check if variety exists in config for this species, if not add it
    if (newTree.variety && speciesId) {
      const existingVariety = config?.find(c => {
        if (c.type !== 'variety') return false;
        if (c.value?.toLowerCase().trim() !== newTree.variety?.toLowerCase().trim()) return false;
        if (c.parentId === speciesId) return true;
        
        // Check if parent is a vegetable config item with the same name
        const parentVegConfig = config.find(v => v.id === c.parentId && v.type === 'vegetable');
        if (parentVegConfig && parentVegConfig.value?.toLowerCase().trim() === newTree.species?.toLowerCase().trim()) {
          return true;
        }

        // Check if parent is an encyclopedia entry with the same name
        const parentVegEnc = encyclopedia?.find(e => e.id === c.parentId);
        if (parentVegEnc && parentVegEnc.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim()) {
          return true;
        }
        
        return false;
      });
      if (!existingVariety) {
        await db.config.add({
          id: uuidv4(),
          type: 'variety',
          value: newTree.variety.trim(),
          parentId: speciesId
        });
      }
    }

    const tree: Tree = {
      id: uuidv4(),
      terrainId: selectedTerrainId,
      species: newTree.species,
      variety: newTree.variety || '',
      datePlanted: newTree.datePlanted || new Date().toISOString().split('T')[0],
      comments: newTree.comments || '',
      photo: newTree.photo,
      positionX: newTree.positionX,
      positionY: newTree.positionY,
      spacing: newTree.spacing || 200,
      isDeleted: false,
      notes: []
    };

    await db.trees.add(tree);
    setIsAddingTree(false);
    setNewTree({});
    setPhotoPreview(null);
  };

  const handleUpdateTree = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingTreeId || selectedTreeId;
    if (!id || !editTreeData.species) return;

    // Check if species exists in encyclopedia, if not add it
    let encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === editTreeData.species?.toLowerCase().trim());
    let speciesId = encEntry?.id;
    if (!speciesId) {
      speciesId = uuidv4();
      const existingColors = encyclopedia?.map(v => v.color).filter(Boolean) as string[] || [];
      await db.encyclopedia.add({
        id: speciesId,
        name: editTreeData.species,
        color: editTreeData.color || getDistinctColor(existingColors),
        icon: editTreeData.icon || 'Trees',
        category: 'Arbre fruitier',
        sowingPeriod: '',
        plantingPeriod: '',
        harvestPeriod: '',
        exposure: 'Plein soleil',
        waterNeeds: 'Moyen',
        spacing: '',
        goodCompanions: [],
        badCompanions: [],
        tips: '',
        updatedAt: new Date().toISOString()
      });
    }

    // Check if variety exists in config for this species, if not add it
    if (editTreeData.variety && speciesId) {
      const existingVariety = config?.find(c => {
        if (c.type !== 'variety') return false;
        if (c.value?.toLowerCase().trim() !== editTreeData.variety?.toLowerCase().trim()) return false;
        if (c.parentId === speciesId) return true;
        
        // Check if parent is a vegetable config item with the same name
        const parentVegConfig = config.find(v => v.id === c.parentId && v.type === 'vegetable');
        if (parentVegConfig && parentVegConfig.value?.toLowerCase().trim() === editTreeData.species?.toLowerCase().trim()) {
          return true;
        }

        // Check if parent is an encyclopedia entry with the same name
        const parentVegEnc = encyclopedia?.find(e => e.id === c.parentId);
        if (parentVegEnc && parentVegEnc.name?.toLowerCase().trim() === editTreeData.species?.toLowerCase().trim()) {
          return true;
        }
        
        return false;
      });
      if (!existingVariety) {
        await db.config.add({
          id: uuidv4(),
          type: 'variety',
          value: editTreeData.variety.trim(),
          parentId: speciesId
        });
      }
    }

    await db.trees.update(id, {
      species: editTreeData.species,
      variety: editTreeData.variety,
      datePlanted: editTreeData.datePlanted,
      comments: editTreeData.comments,
      photo: editTreeData.photo,
      spacing: editTreeData.spacing || 200,
      isLocked: editTreeData.isLocked
    });

    // Update species config if it exists
    if (speciesId) {
      await db.config.update(speciesId, {
        attributes: {
          color: editTreeData.color || '#10b981',
          icon: editTreeData.icon || 'Trees'
        }
      });
    }

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
        await db.trees.delete(id);
        setSelectedTreeId(null);
      }
    });
  };

  const handleNotePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewNotePhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
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

    await db.trees.update(selectedTreeId, {
      notes: [...(tree.notes || []), newNote]
    });

    setNewNoteText('');
    setNewNotePhotos([]);
    setShowNoteForm(false);
  };

  const speciesLegend = Array.from(new Set(treesInCurrentTerrain.map(t => t.species))).sort();

  if (!terrains || !trees) return <div>Chargement...</div>;

  if (terrains.length === 0) {
    return (
      <div className="text-center py-12">
        <Trees className="w-16 h-16 text-stone-300 mx-auto mb-4" />
        <h2 className="text-xl font-medium text-stone-900 mb-2">Aucun terrain configuré</h2>
        <p className="text-stone-500">Allez dans la configuration pour ajouter un terrain (Verger).</p>
      </div>
    );
  }



  const selectedTreeDetails = trees.find(t => t.id === selectedTreeId);

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
                  await db.config.update(selectedTerrainId, { attributes: updatedAttributes });
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
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${toolMode === 'select' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'}`}
              title="Mode Sélection"
            >
              <MousePointer2 className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Sélection</span>
            </button>
            <button
              onClick={() => {
                setToolMode('add');
                setSelectedTreeId(null);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${toolMode === 'add' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'}`}
              title="Mode Ajout"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Ajouter</span>
            </button>
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

      {viewMode === 'plan' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="orchard-plan-print-area">
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 overflow-x-auto print:border-none print:shadow-none print:p-0">
            <div className="mb-4 flex justify-between items-start flex-wrap gap-4 print:hidden">
              <div>
                <h3 className="font-medium text-stone-900">Plan du terrain: {selectedTerrain?.value}</h3>
                <p className="text-sm text-stone-500">Cliquez sur le plan pour ajouter un arbre ou un élément fixe.</p>
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
                        await db.config.update(selectedTerrainId, { attributes: updatedAttributes });
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
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = reader.result as string;
                          const updatedAttributes = { ...selectedTerrain.attributes, backgroundImage: base64 };
                          await db.config.update(selectedTerrainId, { attributes: updatedAttributes });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
                {selectedTerrain?.attributes?.backgroundImage && (
                  <button
                    onClick={async () => {
                      if (selectedTerrainId) {
                        const updatedAttributes = { ...selectedTerrain.attributes, backgroundImage: undefined };
                        await db.config.update(selectedTerrainId, { attributes: updatedAttributes });
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

            <div className="flex-1 overflow-auto bg-stone-100 rounded-xl border border-stone-200 relative">
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
                {treesInCurrentTerrain.map(tree => {
                  const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === tree.species?.toLowerCase().trim());
                  const spacing = tree.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200); // Use tree-specific spacing if available
                  const radius = (spacing / 2) * zoom;
                  const customColor = encEntry?.color || '#059669';
                  const IconComponent = ICON_MAP[encEntry?.icon || ''] || Trees;
                  const isSelected = tree.id === selectedTreeId;

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
                        border: `2px solid ${customColor}`,
                        boxShadow: isSelected ? `0 0 15px ${customColor}60` : 'none'
                      }}
                      title={`${tree.species} - ${tree.variety || 'Sans variété'}\nEspacement: ${spacing}cm\nPosition: ${tree.positionX}cm, ${tree.positionY}cm\n${tree.isLocked ? 'Verrouillé' : 'Cliquez pour sélectionner'}`}
                    >
                      {showCoordinates && (
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-emerald-800/90 text-white text-[9px] px-1.5 py-0.5 rounded-md shadow-sm whitespace-nowrap pointer-events-none z-20 font-mono border border-emerald-600">
                          {Math.round(tree.positionX)}, {Math.round(tree.positionY)}
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
                        ) : GARDEN_EMOJIS.includes(encEntry?.icon || '') ? (
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
                      {GARDEN_EMOJIS.includes(newTree.icon) ? (
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
                        const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === tree?.species?.toLowerCase().trim());
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
                        const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim());
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
                      const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === tree?.species?.toLowerCase().trim());
                      const color = encEntry?.color || '#10b981';
                      const icon = encEntry?.icon || 'Trees';
                      return (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                          {GARDEN_EMOJIS.includes(icon) ? (
                            <span className="text-xl">{icon}</span>
                          ) : (
                            React.createElement(ICON_MAP[icon] || Trees, { className: "w-5 h-5 text-white" })
                          )}
                        </div>
                      );
                    })()}
                    {(isAddingTree || isMovingTree || isCopyingTree) && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: newTree.color || '#10b981' }}>
                        {GARDEN_EMOJIS.includes(newTree.icon) ? (
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
                              const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === tree?.species?.toLowerCase().trim());
                              return ((tree?.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200)) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.width || 200) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.width || 200) / 2) * zoom;
                            return ((newTree.spacing || (newTree.species ? (encyclopedia?.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim())?.spacing ? parseInt(encyclopedia.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim())!.spacing!) : 200) : 200)) / 2) * zoom;
                          })()) / zoom)}cm</span>
                          <span>Bord D: {Math.round((getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).maxX * zoom - (mousePos.x + (() => {
                            if (draggingTreeId) {
                              const tree = trees?.find(t => t.id === draggingTreeId);
                              const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === tree?.species?.toLowerCase().trim());
                              return ((tree?.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200)) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.width || 200) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.width || 200) / 2) * zoom;
                            return ((newTree.spacing || (newTree.species ? (encyclopedia?.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim())?.spacing ? parseInt(encyclopedia.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim())!.spacing!) : 200) : 200)) / 2) * zoom;
                          })())) / zoom)}cm</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Bord H: {Math.round((mousePos.y - getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).minY * zoom - (() => {
                            if (draggingTreeId) {
                              const tree = trees?.find(t => t.id === draggingTreeId);
                              const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === tree?.species?.toLowerCase().trim());
                              return ((tree?.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200)) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.height || 200) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.height || 200) / 2) * zoom;
                            return ((newTree.spacing || (newTree.species ? (encyclopedia?.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim())?.spacing ? parseInt(encyclopedia.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim())!.spacing!) : 200) : 200)) / 2) * zoom;
                          })()) / zoom)}cm</span>
                          <span>Bord B: {Math.round((getTerrainBoundsAtPoint(mousePos.x / zoom, mousePos.y / zoom).maxY * zoom - (mousePos.y + (() => {
                            if (draggingTreeId) {
                              const tree = trees?.find(t => t.id === draggingTreeId);
                              const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === tree?.species?.toLowerCase().trim());
                              return ((tree?.spacing || (encEntry?.spacing ? parseInt(encEntry.spacing) : 200)) / 2) * zoom;
                            }
                            if (draggingStructureId) {
                              const structure = structures?.find(s => s.id === draggingStructureId);
                              return ((structure?.height || 200) / 2) * zoom;
                            }
                            if (isAddingStructure) return ((newStructure.height || 200) / 2) * zoom;
                            return ((newTree.spacing || (newTree.species ? (encyclopedia?.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim())?.spacing ? parseInt(encyclopedia.find(e => e.name?.toLowerCase().trim() === newTree.species?.toLowerCase().trim())!.spacing!) : 200) : 200)) / 2) * zoom;
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
                  const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === species?.toLowerCase().trim());
                  const customColor = encEntry?.color || '#10b981';
                  const IconComponent = ICON_MAP[encEntry?.icon || ''] || Trees;
                  return (
                    <div key={`print-legend-${species}-${idx}`} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: customColor }}>
                        {GARDEN_EMOJIS.includes(encEntry?.icon || '') ? (
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
                    const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === species?.toLowerCase().trim());
                    const customColor = encEntry?.color || '#10b981';
                    const IconComponent = ICON_MAP[encEntry?.icon || ''] || Trees;

                    return (
                      <div key={`legend-${species}-${idx}`} className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 rounded-full border border-stone-100">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: customColor }}>
                          {GARDEN_EMOJIS.includes(encEntry?.icon || '') ? (
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
                <h2 className="text-lg font-medium text-stone-900 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-600" />
                  Ajouter un arbre
                </h2>
                <form onSubmit={handleSaveTree} className="space-y-4">
                  <div className="text-sm text-stone-500 mb-2">
                    Position: {newTree.positionX}cm, {newTree.positionY}cm
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Espèce *</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          required
                          value={newTree.species || ''}
                          onChange={e => {
                            const val = e.target.value;
                            const existing = encyclopedia?.find(c => c.name?.toLowerCase() === val?.toLowerCase());
                            if (existing) {
                              setNewTree({
                                ...newTree, 
                                species: val, 
                                color: existing.color || '#10b981',
                                icon: existing.icon || 'Trees'
                              });
                            } else {
                              setNewTree({...newTree, species: val});
                            }
                          }}
                          placeholder="ex: Pommier, Poirier..."
                          className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        {encyclopedia?.filter(c => c.name?.toLowerCase().includes(newTree.species?.toLowerCase() || '')).length > 0 && newTree.species && !encyclopedia.find(c => c.name?.toLowerCase() === newTree.species?.toLowerCase()) && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                            {encyclopedia.filter(c => c.name?.toLowerCase().includes(newTree.species?.toLowerCase()))
                              .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                              .map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setNewTree({
                                  ...newTree, 
                                  species: c.name,
                                  color: c.color || '#10b981',
                                  icon: c.icon || 'Trees'
                                })}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2"
                              >
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#10b981' }}></div>
                                {c.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSpeciesCustomization(!showSpeciesCustomization)}
                        className={`p-2 rounded-xl border transition-colors ${showSpeciesCustomization ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-stone-200 text-stone-400 hover:text-emerald-600'}`}
                        title="Personnaliser l'apparence"
                      >
                        <Palette className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {showSpeciesCustomization && (
                    <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Couleur</label>
                        <div className="flex gap-2 items-center">
                          <input 
                            type="color" 
                            value={newTree.color || '#10b981'} 
                            onChange={e => setNewTree({...newTree, color: e.target.value})}
                            className="h-8 w-12 rounded border border-stone-200 bg-white p-0.5 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const existingColors = encyclopedia?.map(v => v.color).filter(Boolean) as string[] || [];
                              setNewTree({...newTree, color: getDistinctColor(existingColors)});
                            }}
                            className="p-1.5 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md border border-stone-200 transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight"
                            title="Proposer la couleur la plus éloignée"
                          >
                            <Palette className="w-3.5 h-3.5" />
                            Suggérer
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Envergure (cm)</label>
                        <input
                          type="number"
                          min="50"
                          step="10"
                          value={newTree.spacing || 200}
                          onChange={e => setNewTree({...newTree, spacing: parseInt(e.target.value) || 200})}
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-stone-600 mb-1">Icône (Lucide)</label>
                          <div className="grid grid-cols-7 gap-1">
                            {ICON_LIST.map(({ id, icon: Icon }) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setNewTree({...newTree, icon: id})}
                                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
                                  newTree.icon === id 
                                    ? 'text-white shadow-sm' 
                                    : 'bg-white border-stone-200 text-stone-600 hover:border-emerald-300'
                                }`}
                                style={newTree.icon === id ? { backgroundColor: newTree.color || '#10b981' } : {}}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-stone-600 mb-1">Émojis Réalistes</label>
                          
                          <div className="flex flex-wrap gap-1 mb-2">
                            {GARDEN_EMOJI_CATEGORIES.map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveEmojiCategory(cat.id)}
                                className={`px-2 py-0.5 text-[10px] rounded-full border transition-all ${
                                  activeEmojiCategory === cat.id
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                }`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-1 max-h-32 overflow-y-auto p-1 bg-white rounded-lg border border-stone-200">
                            {GARDEN_EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory)?.emojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setNewTree({...newTree, icon: emoji})}
                                className={`p-1.5 text-lg rounded-lg flex items-center justify-center transition-all ${
                                  newTree.icon === emoji 
                                    ? 'bg-emerald-50 shadow-sm ring-1 ring-emerald-500' 
                                    : 'hover:bg-stone-50'
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Variété</label>
                    <input
                      type="text"
                      value={newTree.variety || ''}
                      onChange={e => setNewTree({...newTree, variety: e.target.value})}
                      placeholder="ex: Golden, Conférence..."
                      className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    {newTree.species && (() => {
                      const speciesVarieties = getVarietiesForSpecies(newTree.species);
                      const filtered = speciesVarieties.filter(v => v?.toLowerCase().includes((newTree.variety || '')?.toLowerCase()));
                      const exactMatch = speciesVarieties.some(v => v?.toLowerCase() === (newTree.variety || '')?.toLowerCase());
                      
                      if (newTree.variety && filtered.length > 0 && !exactMatch) {
                        return (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                            {filtered.map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setNewTree({ ...newTree, variety: v })}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 block text-stone-700"
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
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
                      onClick={() => { setIsAddingTree(false); setNewTree({}); setPhotoPreview(null); }}
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
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-stone-600">Espèce</label>
                          <button
                            type="button"
                            onClick={() => setShowSpeciesCustomization(!showSpeciesCustomization)}
                            className={`p-1 rounded-lg border transition-colors ${showSpeciesCustomization ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-stone-200 text-stone-400 hover:text-emerald-600'}`}
                            title="Personnaliser l'apparence"
                          >
                            <Palette className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          value={editTreeData.species || ''}
                          onChange={e => {
                            const val = e.target.value;
                            const existing = encyclopedia?.find(c => c.name?.toLowerCase() === val?.toLowerCase());
                            setEditTreeData({
                              ...editTreeData,
                              species: val,
                              color: existing?.color || editTreeData.color,
                              icon: existing?.icon || editTreeData.icon
                            });
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {showSpeciesCustomization && (
                        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Couleur & Icône</label>
                            <div className="flex gap-2 items-center mb-2">
                              <input 
                                type="color" 
                                value={editTreeData.color || '#10b981'} 
                                onChange={e => setEditTreeData({...editTreeData, color: e.target.value})}
                                className="h-8 w-12 rounded border border-stone-200 bg-white p-0.5 cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const existingColors = encyclopedia?.map(v => v.color).filter(Boolean) as string[] || [];
                                  setEditTreeData({...editTreeData, color: getDistinctColor(existingColors)});
                                }}
                                className="p-1.5 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md border border-stone-200 transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight"
                                title="Proposer la couleur la plus éloignée"
                              >
                                <Palette className="w-3.5 h-3.5" />
                                Suggérer
                              </button>
                              <div className="grid grid-cols-7 gap-1 flex-1 ml-2">
                                {ICON_LIST.slice(0, 14).map(({ id, icon: Icon }) => (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => setEditTreeData({...editTreeData, icon: id})}
                                    className={`p-1 rounded-md border transition-all flex items-center justify-center ${
                                      editTreeData.icon === id 
                                        ? 'text-white shadow-sm' 
                                        : 'bg-white border-stone-200 text-stone-600 hover:border-emerald-300'
                                    }`}
                                    style={editTreeData.icon === id ? { backgroundColor: editTreeData.color || '#10b981' } : {}}
                                  >
                                    <Icon className="w-3 h-3" />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Émojis Réalistes</label>
                              
                              <div className="flex flex-wrap gap-1 mb-2">
                                {GARDEN_EMOJI_CATEGORIES.map(cat => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setActiveEmojiCategory(cat.id)}
                                    className={`px-2 py-0.5 text-[9px] rounded-full border transition-all ${
                                      activeEmojiCategory === cat.id
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                    }`}
                                  >
                                    {cat.label}
                                  </button>
                                ))}
                              </div>

                              <div className="grid grid-cols-7 gap-1 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-stone-200">
                                {GARDEN_EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory)?.emojis.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setEditTreeData({...editTreeData, icon: emoji})}
                                    className={`p-1 text-base rounded-md flex items-center justify-center transition-all ${
                                      editTreeData.icon === emoji 
                                        ? 'bg-emerald-50 shadow-sm ring-1 ring-emerald-500' 
                                        : 'hover:bg-stone-50'
                                    }`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="relative">
                        <label className="block text-xs font-medium text-stone-600 mb-1">Variété</label>
                        <input
                          type="text"
                          value={editTreeData.variety || ''}
                          onChange={e => setEditTreeData({...editTreeData, variety: e.target.value})}
                          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {editTreeData.species && (() => {
                          const speciesVarieties = getVarietiesForSpecies(editTreeData.species);
                          const filtered = speciesVarieties.filter(v => v?.toLowerCase().includes((editTreeData.variety || '')?.toLowerCase()));
                          const exactMatch = speciesVarieties.some(v => v?.toLowerCase() === (editTreeData.variety || '')?.toLowerCase());
                          
                          if (editTreeData.variety && filtered.length > 0 && !exactMatch) {
                            return (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                                {filtered.map(v => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => setEditTreeData({ ...editTreeData, variety: v })}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 block text-stone-700"
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}
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
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          setEditTreeData({ ...editTreeData, photo: reader.result as string });
                                        };
                                        reader.readAsDataURL(file);
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
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-medium text-stone-900">{selectedTreeDetails.species}</h2>
                            {selectedTreeDetails.isLocked && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-wider rounded-full border border-amber-100 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                Figé
                              </span>
                            )}
                          </div>
                          {selectedTreeDetails.variety && <p className="text-stone-500">{selectedTreeDetails.variety}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === selectedTreeDetails.species?.toLowerCase().trim());
                              setIsEditingTree(true);
                              setEditTreeData({
                                ...selectedTreeDetails,
                                color: encEntry?.color || '#10b981',
                                icon: encEntry?.icon || 'Trees'
                              });
                            }}
                            className="text-stone-400 hover:text-emerald-600 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                            title="Modifier l'arbre"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={async () => {
                              await db.trees.update(selectedTreeDetails.id, { isLocked: !selectedTreeDetails.isLocked });
                            }}
                            className={`p-2 rounded-lg transition-colors ${selectedTreeDetails.isLocked ? 'text-amber-600 bg-amber-50' : 'text-stone-400 hover:text-amber-600 hover:bg-amber-50'}`}
                            title={selectedTreeDetails.isLocked ? "Déverrouiller l'arbre" : "Verrouiller l'arbre"}
                          >
                            {selectedTreeDetails.isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => {
                              setIsMovingTree(true);
                              setIsCopyingTree(false);
                            }}
                            className={`p-2 rounded-lg transition-colors ${isMovingTree ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                            title="Déplacer l'arbre"
                          >
                            <MapIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setIsCopyingTree(true);
                              setIsMovingTree(false);
                            }}
                            className={`p-2 rounded-lg transition-colors ${isCopyingTree ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                            title="Copier l'arbre"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTree(selectedTreeDetails.id)}
                            className="text-stone-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Supprimer l'arbre"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

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
                      [...selectedTreeDetails.notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((note) => (
                        <div key={note.id} className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60">
                          <div className="flex items-center justify-between mb-2">
                            <time className="text-xs font-medium text-emerald-600">
                              {new Date(note.date).toLocaleDateString()}
                            </time>
                            <button 
                              onClick={() => {
                                setConfirmState({
                                  isOpen: true,
                                  title: 'Supprimer la note',
                                  message: 'Voulez-vous vraiment supprimer cette note ?',
                                  isDanger: true,
                                  onConfirm: async () => {
                                    await db.trees.update(selectedTreeId!, {
                                      notes: selectedTreeDetails.notes!.filter(n => n.id !== note.id)
                                    });
                                  }
                                });
                              }}
                              className="text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {note.text && <p className="text-stone-700 text-sm whitespace-pre-wrap mb-2">{note.text}</p>}
                          {note.photos && note.photos.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {note.photos.map((photo, index) => (
                                <img key={index} src={photo} alt="Note" className="rounded-lg border border-stone-100" />
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {!isAddingTree && !selectedTreeDetails && (
              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200/60 text-center">
                <Trees className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">Sélectionnez un arbre sur le plan pour voir ses détails, ou cliquez sur une case vide pour en ajouter un.</p>
              </div>
            )}
          </div>
        </div>

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
                const encEntry = encyclopedia?.find(e => e.name?.toLowerCase().trim() === species?.toLowerCase().trim());
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
                      {GARDEN_EMOJIS.includes(encEntry?.icon || '') ? (
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
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden" id="orchard-list-print-area">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Espèce / Variété</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Planté le</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {treesInCurrentTerrain.sort((a, b) => a.species.localeCompare(b.species)).map(tree => (
                  <tr key={tree.id} className="hover:bg-stone-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-stone-900">{tree.species}</p>
                        <p className="text-sm text-stone-500">{tree.variety || 'Variété inconnue'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-stone-600">
                        {tree.datePlanted ? new Date(tree.datePlanted).toLocaleDateString() : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium bg-stone-100 text-stone-600 px-2 py-1 rounded-md">
                        {tree.positionX}cm, {tree.positionY}cm
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
