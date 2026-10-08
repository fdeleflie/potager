import { useFirebaseData, fb, getFirebaseWriteCount, getFirebaseQuotaStats, syncPriorityCollections, setManualEconomyMode, QuotaStats } from '../hooks/useFirebaseData';
import React, { useState, useEffect, useMemo } from 'react';
import { db, ConfigItem } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { Settings, Plus, Trash2, Edit2, Palette, XCircle, CheckCircle2, Trees, BookOpen, Info, Activity, Calendar, RefreshCw, Sparkles, AlertCircle, AlertTriangle, Zap, ShieldCheck, Database, HardDrive, CheckCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { ConfirmModal } from '../components/Modals';
import { ICON_LIST, ICON_MAP, GARDEN_EMOJIS, GARDEN_EMOJI_CATEGORIES } from '../constants';
import { getDistinctColor } from '../utils/colors';
import { PLANT_CATALOG } from '../catalog';
import { WeatherSettings } from './WeatherSettings';
import { useSeason } from '../contexts/SeasonContext';
import { EmojiLogoPicker, extractEmoji } from '../components/EmojiLogoPicker';
import { 
  normalizeCategoryKey, 
  areCategoriesEqual, 
  deduplicateCategories, 
  DEFAULT_PLANT_CATEGORIES, 
  getCanonicalCategory 
} from '../utils/categories';
import { DEFAULT_WEATHER_INDICATORS, PRESET_WEATHER_COLOR_PALETTES } from '../utils/weatherIndicators';

export function Config({ onNavigate, initialTab }: { onNavigate?: (view: any) => void; initialTab?: string }) {
  const { seasons, currentSeasonId, setCurrentSeasonId, createNewSeason, updateSeason, deleteSeason } = useSeason();
  const { data: rawConfig, error: configError } = useFirebaseData<any>('config');
  const { data: rawEncyclopedia } = useFirebaseData<any>('encyclopedia');
  const { data: rawTrees } = useFirebaseData<any>('trees');
  const config = rawConfig;
  const encyclopedia = rawEncyclopedia;
  const trees = rawTrees;

  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);

  // Auto-seed default perpetual task categories if none exist
  useEffect(() => {
    if (config && config.length > 0) {
      const perpetualCategories = config.filter((c: any) => c.type === 'perpetual_task_category');
      
      // Automatic deduplication & initial seeding
      if (perpetualCategories.length === 0) {
        const seedDefaults = async () => {
          const defaults = [
            'Bouturage & Multiplication',
            'Semis',
            'Plantation & Repiquage',
            'Taille & Pincement',
            'Soin & Traitement',
            'Récolte',
            'Entretien & Paillage',
            'Autre geste'
          ];
          for (const label of defaults) {
            await fb.add<any>('config', { type: 'perpetual_task_category', value: label });
          }
        };
        seedDefaults();
      } else {
        // Cleanup duplicates (caused by strict mode double-firing during seeding)
        const seen = new Set<string>();
        const toDelete: string[] = [];
        
        perpetualCategories.forEach((c: any) => {
          const normalized = c.value.toLowerCase().trim();
          if (seen.has(normalized)) {
            toDelete.push(c.id);
          } else {
            seen.add(normalized);
          }
        });

        if (toDelete.length > 0) {
          toDelete.forEach(id => {
            fb.delete('config', id);
          });
        }
      }
    }
  }, [config]);

  // Auto-seed default journal tags if none exist
  useEffect(() => {
    if (config && config.length > 0) {
      const journalTags = config.filter((c: any) => c.type === 'journal_tag');
      
      if (journalTags.length === 0) {
        const seedDefaults = async () => {
          const defaults = [
            '💧 Arrosage',
            '🌱 Semis',
            '🪴 Plantation & Repiquage',
            '🌿 Désherbage',
            '✂️ Taille & Pincement',
            '🧺 Récolte',
            '🍂 Paillage',
            '🧪 Traitement & Soin',
            '🪱 Compost & Engrais',
            '🔍 Observation',
            '❄️ Météo & Gelée',
            '🔨 Bricolage & Tuteurage'
          ];
          for (const label of defaults) {
            await fb.add<any>('config', { type: 'journal_tag', value: label });
          }
        };
        seedDefaults();
      } else {
        // Cleanup duplicates if any
        const seen = new Set<string>();
        const toDelete: string[] = [];
        journalTags.forEach((c: any) => {
          const normalized = (c.value || '').toLowerCase().trim();
          if (seen.has(normalized)) {
            toDelete.push(c.id);
          } else {
            seen.add(normalized);
          }
        });
        if (toDelete.length > 0) {
          toDelete.forEach(id => {
            fb.delete('config', id);
          });
        }
      }
    }
  }, [config]);

  // Auto-seed default weather indicators if none exist
  useEffect(() => {
    if (config && config.length > 0) {
      const weatherIndicators = config.filter((c: any) => c.type === 'weather_indicator');
      
      if (weatherIndicators.length === 0) {
        const seedDefaults = async () => {
          for (const def of DEFAULT_WEATHER_INDICATORS) {
            const pal = PRESET_WEATHER_COLOR_PALETTES.find(p => p.colorClass === def.colorClass) || PRESET_WEATHER_COLOR_PALETTES[0];
            await fb.put('config', {
              id: def.id,
              type: 'weather_indicator',
              value: `${def.emoji} ${def.label}`,
              attributes: {
                emoji: def.emoji,
                label: def.label,
                palette: pal.name,
                colorClass: def.colorClass,
                activeClass: def.activeClass,
                conditionKey: def.conditionKey
              }
            });
          }
        };
        seedDefaults();
      } else {
        // Cleanup duplicates if any
        const seen = new Set<string>();
        const toDelete: string[] = [];
        weatherIndicators.forEach((c: any) => {
          const normalized = (c.value || '').toLowerCase().trim();
          if (seen.has(normalized)) {
            toDelete.push(c.id);
          } else {
            seen.add(normalized);
          }
        });
        if (toDelete.length > 0) {
          toDelete.forEach(id => {
            fb.delete('config', id);
          });
        }
      }
    }
  }, [config]);

  // Compute plants usage count per category (case and accent insensitive)
  const plantCategoryUsage = useMemo(() => {
    const map = new Map<string, number>();
    (encyclopedia || []).forEach((e: any) => {
      if (e.category && e.category.trim()) {
        const catKey = normalizeCategoryKey(e.category);
        map.set(catKey, (map.get(catKey) || 0) + 1);
      }
    });
    if (trees && trees.length > 0) {
      const treeKey = normalizeCategoryKey('Arbre fruitier');
      map.set(treeKey, (map.get(treeKey) || 0) + trees.length);
    }
    return map;
  }, [encyclopedia, trees]);

  // All known categories from encyclopedia, trees and defaults (harmonized & deduplicated)
  const allKnownPlantCategories = useMemo(() => {
    const raw: string[] = [];
    DEFAULT_PLANT_CATEGORIES.forEach(c => raw.push(c));
    (encyclopedia || []).forEach((e: any) => {
      if (e.category && e.category.trim()) raw.push(e.category.trim());
    });
    return deduplicateCategories(raw, config);
  }, [encyclopedia, config]);

  // Auto-deduplication of plant categories in background
  useEffect(() => {
    if (!config || config.length === 0) return;
    const categories = config.filter((c: any) => c.type === 'category');
    if (categories.length > 1) {
      const seen = new Map<string, any>();
      const toDelete: string[] = [];
      
      // Sort: keep best representation (prefer accented chars, then deterministic/alphabetical IDs)
      const sorted = [...categories].sort((a, b) => {
        const aAccents = (a.value.match(/[éèêëàâäôöîïùûüç]/gi) || []).length;
        const bAccents = (b.value.match(/[éèêëàâäôöîïùûüç]/gi) || []).length;
        if (bAccents !== aAccents) return bAccents - aAccents;
        return a.id.localeCompare(b.id);
      });

      sorted.forEach((c: any) => {
        const normalized = (c.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        if (!normalized) return;
        if (seen.has(normalized)) {
          toDelete.push(c.id);
        } else {
          seen.set(normalized, c);
        }
      });

      if (toDelete.length > 0) {
        toDelete.forEach(id => {
          fb.delete('config', id).catch(console.error);
        });
      }
    }
  }, [config]);

  // Auto-sync missing plant categories into config so they exist in Configuration
  useEffect(() => {
    if (!config || !encyclopedia || encyclopedia.length === 0) return;
    const existingConfigCategories = new Set(
      config.filter((c: any) => c.type === 'category').map((c: any) => 
        (c.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
      )
    );
    const missing = allKnownPlantCategories.filter(cat => {
      const norm = cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      return norm && !existingConfigCategories.has(norm);
    });

    if (missing.length > 0) {
      missing.forEach(cat => {
        const norm = cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        const safeId = `cat_${norm.replace(/[^a-z0-9]/g, '_')}`;
        fb.put('config', {
          id: safeId,
          type: 'category',
          value: cat.trim()
        }).catch(console.error);
      });
    }
  }, [config, encyclopedia, allKnownPlantCategories]);

  const [newValue, setNewValue] = useState('');
  const [newEmoji, setNewEmoji] = useState<string>('💧');
  const [newParentId, setNewParentId] = useState('');
  const [activeTab, setActiveTab] = useState<'season' | 'journal_tag' | 'state' | 'location' | 'zone' | 'terrain' | 'variety_option' | 'variety_attr_type' | 'weather' | 'expense_category' | 'category' | 'perpetual_task_category' | 'quota'>((initialTab as any) || 'season');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'journal_tag') setNewEmoji('💧');
    else if (activeTab === 'category') setNewEmoji('🥕');
    else if (activeTab === 'perpetual_task_category') setNewEmoji('✂️');
    else if (activeTab === 'expense_category') setNewEmoji('🛒');
    else setNewEmoji('');
  }, [activeTab]);
  const [selectedAttrType, setSelectedAttrType] = useState<string>('');
  const [newSeasonName, setNewSeasonName] = useState('');
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editingSeasonName, setEditingSeasonName] = useState('');

  const [writeCount, setWriteCount] = useState(getFirebaseWriteCount());
  const [quotaStats, setQuotaStats] = useState<QuotaStats>(getFirebaseQuotaStats);
  const [isSyncingPriority, setIsSyncingPriority] = useState(false);
  const [prioritySyncFeedback, setPrioritySyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setWriteCount(getFirebaseWriteCount());
      setQuotaStats(getFirebaseQuotaStats());
    };
    window.addEventListener('firebase_writes_updated', handleUpdate);
    window.addEventListener('firebase_reads_updated', handleUpdate);
    window.addEventListener('firebase_quota_warning', handleUpdate);
    window.addEventListener('firebase_priority_synced', handleUpdate);
    return () => {
      window.removeEventListener('firebase_writes_updated', handleUpdate);
      window.removeEventListener('firebase_reads_updated', handleUpdate);
      window.removeEventListener('firebase_quota_warning', handleUpdate);
      window.removeEventListener('firebase_priority_synced', handleUpdate);
    };
  }, []);

  const handlePrioritySync = async () => {
    setIsSyncingPriority(true);
    setPrioritySyncFeedback(null);
    try {
      const res = await syncPriorityCollections();
      if (res.success) {
        setPrioritySyncFeedback(`Journal, Calendrier perpétuel et données prioritaires synchronisés avec succès (${res.syncedCount} éléments à ${res.time})`);
      } else {
        setPrioritySyncFeedback(res.error || 'Erreur lors de la synchronisation');
      }
    } catch (e: any) {
      setPrioritySyncFeedback(e.message || 'Erreur');
    } finally {
      setIsSyncingPriority(false);
      setTimeout(() => setPrioritySyncFeedback(null), 6000);
    }
  };

  const handleToggleEconomy = (enabled: boolean) => {
    setManualEconomyMode(enabled);
    setQuotaStats(getFirebaseQuotaStats());
  };

  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');
  const [editingItemEmoji, setEditingItemEmoji] = useState('');

  // Zone edit state
  const [zoneAttrs, setZoneAttrs] = useState<any>({ type: 'serre', width: 100, height: 100 });

  // Terrain edit state
  const [terrainAttrs, setTerrainAttrs] = useState<any>({ width: 1000, height: 1000, shape: 'rectangle', points: [] }); // in cm (10m x 10m)
  const [pointsRaw, setPointsRaw] = useState('');
  const [terrainShapeType, setTerrainShapeType] = useState<'rectangle' | 'l-shape' | 'u-shape' | 'custom'>('rectangle');
  const [isDrawingTerrain, setIsDrawingTerrain] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(GARDEN_EMOJI_CATEGORIES[0].id);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const varietyAttrTypes = React.useMemo(() => 
    config?.filter(c => c.type === 'variety_attr_type').sort((a, b) => a.value.localeCompare(b.value)) || []
  , [config]);

  // Bootstrap default variety attribute types if missing
  React.useEffect(() => {
    if (config && config.length > 0 && varietyAttrTypes.length === 0) {
      const defaults = [
        { id: 'at1', type: 'variety_attr_type', value: 'Couleur' },
        { id: 'at2', type: 'variety_attr_type', value: 'Taille' },
        { id: 'at3', type: 'variety_attr_type', value: 'Goût' },
        { id: 'at4', type: 'variety_attr_type', value: 'Aspect' },
        { id: 'at5', type: 'variety_attr_type', value: 'Hauteur' },
        { id: 'at6', type: 'variety_attr_type', value: 'Origine' },
        { id: 'at7', type: 'variety_attr_type', value: 'Précocité' },
        { id: 'at8', type: 'variety_attr_type', value: 'Résistance maladie' },
      ];
      db.config.bulkAdd(defaults as ConfigItem[]);
    }
  }, [config, varietyAttrTypes.length]);

  // Initialize selectedAttrType if empty
  React.useEffect(() => {
    if (!selectedAttrType && varietyAttrTypes.length > 0) {
      setSelectedAttrType(varietyAttrTypes[0].id);
    }
  }, [selectedAttrType, varietyAttrTypes]);

  const detectedDuplicatesCount = useMemo(() => {
    if (!config) return 0;
    const currentItems = config.filter((c: any) => c.type === activeTab);
    const seen = new Set<string>();
    let count = 0;
    currentItems.forEach((item: any) => {
      const norm = (item.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      const key = activeTab === 'variety_option' ? `${item.parentId || ''}___${norm}` : norm;
      if (!key) return;
      if (seen.has(key)) {
        count++;
      } else {
        seen.add(key);
      }
    });
    return count;
  }, [config, activeTab]);

  if (configError) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-xl border border-red-200">
        <p className="text-red-700 font-medium">{configError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Rafraîchir
        </button>
      </div>
    );
  }

  if (!config) return <div className="p-8 text-center text-stone-500 italic">Chargement...</div>;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    const { emoji: detectedEmoji, cleanText } = extractEmoji(newValue.trim());
    const finalEmoji = newEmoji || detectedEmoji;
    const finalValue = finalEmoji ? `${finalEmoji} ${cleanText}` : cleanText;

    // Duplicate check with accent normalization
    const normalizedNew = cleanText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const isDuplicate = config.some(c => {
      if (c.type !== activeTab) return false;
      const { cleanText: cText } = extractEmoji(c.value || '');
      const norm = cText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      return norm === normalizedNew && (activeTab !== 'variety_option' || c.parentId === selectedAttrType);
    });

    if (isDuplicate) {
      alert(`Cet élément existe déjà dans la catégorie ${tabs.find(t => t.id === activeTab)?.label}.`);
      return;
    }

    const itemId = activeTab === 'category'
      ? `cat_${normalizedNew.replace(/[^a-z0-9]/g, '_')}`
      : uuidv4();

    const item: ConfigItem = {
      id: itemId,
      type: activeTab as any,
      value: finalValue,
      parentId: activeTab === 'variety_option' ? selectedAttrType : undefined,
      attributes: {
        ...(activeTab === 'terrain' ? { width: 1000, height: 1000 } : {}),
        ...(finalEmoji ? { emoji: finalEmoji } : {})
      }
    };

    if (activeTab === 'category') {
      await fb.put('config', item);
    } else {
      await fb.add('config', item);
    }

    setNewValue('');
    setNewParentId('');
  };

  const handleDelete = async (id: string, value: string) => {
    let warningMsg = 'Voulez-vous vraiment supprimer cet élément ?';
    if (activeTab === 'category') {
      const count = plantCategoryUsage.get(normalizeCategoryKey(value)) || 0;
      if (count > 0) {
        warningMsg = `Attention : ${count} plante(s) du catalogue utilisent actuellement la catégorie "${value}". Si vous la supprimez, vous devrez réassigner une autre catégorie à ces plantes. Voulez-vous continuer ?`;
      }
    }

    setConfirmState({
      isOpen: true,
      title: 'Supprimer l\'élément',
      message: warningMsg,
      isDanger: true,
      onConfirm: async () => {
        await fb.delete('config', id);
        if (activeTab === 'state' && defaultState === value) {
          await fb.delete('config', 'default_state');
        } else if (activeTab === 'location' && defaultLocation === value) {
          await fb.delete('config', 'default_location');
        }
      }
    });
  };

  const handleCleanDuplicates = async () => {
    if (!config) return;
    const currentItems = config.filter((c: any) => c.type === activeTab);
    const seen = new Map<string, any>();
    const toDelete: string[] = [];
    let mergedCount = 0;

    const sorted = [...currentItems].sort((a, b) => {
      const aAccents = (a.value.match(/[éèêëàâäôöîïùûüç]/gi) || []).length;
      const bAccents = (b.value.match(/[éèêëàâäôöîïùûüç]/gi) || []).length;
      if (bAccents !== aAccents) return bAccents - aAccents;
      return a.id.localeCompare(b.id);
    });

    for (const item of sorted) {
      const norm = (item.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      const key = activeTab === 'variety_option' ? `${item.parentId || ''}___${norm}` : norm;
      if (!key) continue;

      if (seen.has(key)) {
        const kept = seen.get(key);
        toDelete.push(item.id);
        mergedCount++;

        // If plants were using the variant name (e.g. unaccented 'Legume'), harmonize to kept ('Légume')
        if (activeTab === 'category' && encyclopedia && item.value !== kept.value) {
          const plantsToHarmonize = encyclopedia.filter((p: any) => areCategoriesEqual(p.category, item.value));
          for (const p of plantsToHarmonize) {
            await fb.update('encyclopedia', p.id, { category: kept.value });
          }
        }
      } else {
        seen.set(key, item);
      }
    }

    if (toDelete.length > 0) {
      for (const id of toDelete) {
        await fb.delete('config', id);
      }
      setCleanFeedback(`${mergedCount} doublon${mergedCount > 1 ? 's' : ''} nettoyé${mergedCount > 1 ? 's' : ''} avec succès !`);
    } else {
      setCleanFeedback('Aucun doublon trouvé dans cette liste.');
    }
    setTimeout(() => setCleanFeedback(null), 4000);
  };

  const handleSyncCategories = async () => {
    if (!config) return;
    const existingConfigCategories = new Set(
      config.filter((c: any) => c.type === 'category').map((c: any) => 
        (c.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
      )
    );
    let added = 0;
    for (const cat of allKnownPlantCategories) {
      const norm = cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      if (norm && !existingConfigCategories.has(norm)) {
        const safeId = `cat_${norm.replace(/[^a-z0-9]/g, '_')}`;
        await fb.put('config', {
          id: safeId,
          type: 'category',
          value: cat.trim()
        });
        existingConfigCategories.add(norm);
        added++;
      }
    }
    if (added > 0) {
      setCleanFeedback(`${added} catégorie${added > 1 ? 's' : ''} synchronisée${added > 1 ? 's' : ''} depuis le catalogue des plantes !`);
    } else {
      setCleanFeedback('Toutes les catégories sont déjà synchronisées.');
    }
    setTimeout(() => setCleanFeedback(null), 4000);
  };

  const handleSetDefault = async (type: 'state' | 'location', value: string) => {
    await fb.put('config', {
      id: `default_${type}`,
      type: 'setting',
      value: value
    });
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZoneId) return;
    await fb.update('config', editingZoneId, { attributes: zoneAttrs });
    setEditingZoneId(null);
  };

  const handleSaveTerrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZoneId) return; // Reusing editingZoneId for terrain
    await fb.update('config', editingZoneId, { attributes: terrainAttrs });
    setEditingZoneId(null);
  };

  const handleSaveItemName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItemId || !editingItemValue.trim()) return;
    const oldItem = config.find((c: any) => c.id === editingItemId);
    const { emoji: detectedEmoji, cleanText } = extractEmoji(editingItemValue.trim());
    const finalEmoji = editingItemEmoji || detectedEmoji;
    const finalValue = finalEmoji ? `${finalEmoji} ${cleanText}` : cleanText;

    await fb.update('config', editingItemId, {
      value: finalValue,
      attributes: {
        ...(oldItem?.attributes || {}),
        emoji: finalEmoji || undefined
      }
    });

    // If renaming a plant category, propagate to encyclopedia
    if (activeTab === 'category' && encyclopedia && oldItem) {
      for (const p of encyclopedia) {
        if (areCategoriesEqual(p.category, oldItem.value) || areCategoriesEqual(p.category, cleanText)) {
          await fb.update('encyclopedia', p.id, { category: finalValue });
        }
      }
    }

    setEditingItemId(null);
    setEditingItemEmoji('');
    setEditingItemValue('');
  };

  const handleQuickChangeEmoji = async (item: ConfigItem, nextEmoji: string) => {
    const { cleanText } = extractEmoji(item.value || '');
    const finalValue = nextEmoji ? `${nextEmoji} ${cleanText}` : cleanText;
    await fb.update('config', item.id, {
      value: finalValue,
      attributes: {
        ...(item.attributes || {}),
        emoji: nextEmoji || undefined
      }
    });

    if (activeTab === 'category' && encyclopedia) {
      for (const p of encyclopedia) {
        if (areCategoriesEqual(p.category, item.value)) {
          await fb.update('encyclopedia', p.id, { category: finalValue });
        }
      }
    }
  };

  let items = config.filter(c => c.type === activeTab);
  
  if (activeTab === 'variety_option' && selectedAttrType) {
    items = items.filter(i => i.parentId === selectedAttrType);
  }

  // Real-time duplicate check for UI feedback with accent normalization
  const isCurrentValueDuplicate = newValue.trim() !== '' && items.some(i => {
    const { cleanText: newClean } = extractEmoji(newValue.trim());
    const { cleanText: itemClean } = extractEmoji(i.value || '');
    return newClean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === 
      itemClean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() &&
      (activeTab !== 'variety_option' || i.parentId === selectedAttrType);
  });

  items.sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' }));

  const tabs = [
    { id: 'season', label: 'Saisons' },
    { id: 'journal_tag', label: 'Tags Journal' },
    { id: 'state', label: 'États' },
    { id: 'location', label: 'Emplacements' },
    { id: 'category', label: 'Catégories (Plantes)' },
    { id: 'perpetual_task_category', label: 'Types de Gestes' },
    { id: 'zone', label: 'Zones (Plan)' },
    { id: 'terrain', label: 'Terrains (Verger)' },
    { id: 'variety_attr_type', label: 'Champs Variétés' },
    { id: 'variety_option', label: 'Options de Champs' },
    { id: 'weather', label: 'Météo & Indicateurs' },
    { id: 'expense_category', label: 'Dépenses' },
    { id: 'quota', label: 'Quotas & Synchro' },
  ] as const;

  const varietyOptions = config.filter(c => c.type === 'variety_option');
  const defaultState = config.find(c => c.type === 'setting' && c.id === 'default_state')?.value;
  const defaultLocation = config.find(c => c.type === 'setting' && c.id === 'default_location')?.value;

  const suggestedVegetables: any[] = [];

  const suggestedVarieties: any[] = [];

  const handleAddSuggestion = async (value: string, type: 'vegetable' | 'variety', parentId?: string) => {
    const item = {
      id: uuidv4(),
      type,
      value,
      parentId,
      attributes: {}
    };
    await fb.add('config', item);
  };

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim()) return;
    await createNewSeason(newSeasonName.trim());
    setNewSeasonName('');
  };

  const handleUpdateSeason = async (id: string, name: string) => {
    if (!name.trim()) return;
    await updateSeason(id, name.trim());
    setEditingSeasonId(null);
    setEditingSeasonName('');
  };

  const handleDeleteSeason = (id: string, name: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Supprimer la saison',
      message: `Êtes-vous sûr de vouloir supprimer la saison "${name}" ? Cette action est irréversible.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteSeason(id);
        } catch (err: any) {
          alert(err.message || 'Erreur lors de la suppression de la saison');
        }
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText="Supprimer"
      />
      <header>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-serif font-medium text-stone-900 flex items-center gap-1.5">
                <Settings className="w-5 h-5 text-emerald-600" />
                Configuration
              </h1>
              <button 
                type="button"
                onClick={() => setActiveTab('quota')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-2xs ${
                  quotaStats.isQuotaExceeded 
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200' 
                    : quotaStats.isMarginActive 
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' 
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
                title="Consommation journalière Firebase Spark (cliquer pour détails & synchronisation)"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lectures : <strong className="font-semibold">{quotaStats.readsToday.toLocaleString('fr-FR')}</strong> / {quotaStats.maxDailyReads.toLocaleString('fr-FR')} ({quotaStats.readPercent}%)</span>
                <span className="text-stone-300">•</span>
                <span>Écritures : <strong className="font-semibold">{writeCount}</strong></span>
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">Gérez les listes déroulantes de l'application.</p>
          </div>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('encyclopedia')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-all text-xs font-bold"
            >
              <BookOpen className="w-4 h-4" />
              Accéder au Catalogue des Plantes
            </button>
          )}
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200/60 overflow-hidden">
        <div className="flex border-b border-stone-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setNewParentId('');
              }}
              className={`flex-1 min-w-max py-2 px-3 text-[11px] font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'border-b-2 border-emerald-500 text-emerald-600 bg-emerald-50/50' 
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-3">
          {activeTab === 'quota' ? (
            <div className="space-y-4">
              {/* Header card */}
              <div className={`p-4 rounded-xl border transition-all ${
                quotaStats.isQuotaExceeded 
                  ? 'bg-amber-50/90 border-amber-200 text-amber-950' 
                  : quotaStats.isMarginActive 
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950' 
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      quotaStats.isQuotaExceeded ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {quotaStats.isQuotaExceeded ? <AlertTriangle className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    </div>
                    <div>
                      <h2 className="font-semibold text-sm flex items-center gap-2">
                        <span>Gestion des Quotas & Priorité Journal / Calendrier Perpétuel</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          quotaStats.isQuotaExceeded 
                            ? 'bg-amber-200 text-amber-900' 
                            : 'bg-emerald-200 text-emerald-900'
                        }`}>
                          {quotaStats.isQuotaExceeded ? 'Mode Cache Local Actif' : 'Marge Sanctuarisée Active'}
                        </span>
                      </h2>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        Pour que votre <strong>Journal</strong> et votre <strong>Calendrier perpétuel</strong> soient toujours disponibles et synchronisés entre votre téléphone et votre ordinateur, une marge de <strong>15&nbsp;000 lectures</strong> leur est strictement sanctuarisée chaque jour.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePrioritySync}
                    disabled={isSyncingPriority}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPriority ? 'animate-spin' : ''}`} />
                    <span>{isSyncingPriority ? 'Synchronisation...' : 'Synchroniser en priorité'}</span>
                  </button>
                </div>

                {prioritySyncFeedback && (
                  <div className="mt-3 p-2.5 bg-white/90 border border-emerald-300 rounded-lg text-emerald-800 text-xs flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{prioritySyncFeedback}</span>
                    </div>
                    <button onClick={() => setPrioritySyncFeedback(null)} className="text-stone-400 hover:text-stone-600 p-0.5">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Jauges Quotas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Jauge Lectures */}
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-emerald-600" />
                      Lectures Quotidiennes (Spark)
                    </span>
                    <span className="text-xs font-bold text-stone-700">
                      {quotaStats.readPercent}%
                    </span>
                  </div>

                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden border border-stone-200/60">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        quotaStats.readPercent >= 90 ? 'bg-red-500' : quotaStats.readPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, quotaStats.readPercent)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                    <span>Estimé : <strong className="text-stone-800">{quotaStats.readsToday.toLocaleString('fr-FR')}</strong> lues</span>
                    <span>Max gratuit : {quotaStats.maxDailyReads.toLocaleString('fr-FR')}/jour</span>
                  </div>

                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-200/50 text-[11px] text-stone-600 leading-snug">
                    🛡️ <strong>15&nbsp;000 lectures sanctuarisées :</strong> Dès 35&nbsp;000 lectures atteintes, les données secondaires (encyclopédie) passent en cache local pour réserver la bande passante au Journal et au Perpétuel.
                  </div>
                </div>

                {/* Jauge Écritures */}
                <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-blue-600" />
                      Écritures & Enregistrements
                    </span>
                    <span className="text-xs font-bold text-stone-700">
                      {Math.round((writeCount / 20000) * 100)}%
                    </span>
                  </div>

                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden border border-stone-200/60">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((writeCount / 20000) * 100))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                    <span>Aujourd'hui : <strong className="text-stone-800">{writeCount}</strong> écritures</span>
                    <span>Max gratuit : 20&nbsp;000/jour</span>
                  </div>

                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-200/50 text-[11px] text-stone-600 leading-snug">
                    ✍️ <strong>Vos ajouts et modifications :</strong> Chaque nouvelle note de journal ou modification compte pour 1 écriture. Vous disposez d'une marge très large (20&nbsp;000/jour).
                  </div>
                </div>
              </div>

              {/* Tableau de Priorisation */}
              <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-3">
                <h3 className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Règle de Priorisation Intelligente des Données
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Priorité Haute (Journal & Perpétuel)</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Toujours synchronisés en priorité sur Firestore avec la marge réservée.
                    </p>
                    <ul className="text-[11px] text-emerald-900 space-y-1 list-disc list-inside font-medium pt-1">
                      <li>Journal du potager (notes, photos, météo)</li>
                      <li>Planning perpétuel (gestes, taille, boutures)</li>
                      <li>Semis & Cultures du potager</li>
                      <li>Arbres fruitiers & Verger</li>
                      <li>Tâches & Interventions</li>
                      <li>Configuration & Saisons</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-stone-800">
                      <span className="w-2 h-2 rounded-full bg-stone-400" />
                      <span>Mode Économique (Cache Local)</span>
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      Conservé dans le navigateur pour économiser jusqu'à 40&nbsp;000 lectures par jour.
                    </p>
                    <ul className="text-[11px] text-stone-700 space-y-1 list-disc list-inside font-medium pt-1">
                      <li>Catalogue des plantes (Encyclopédie)</li>
                      <li>Maladies & Ravageurs</li>
                      <li>Dépenses & Achats</li>
                      <li>Structures & Parcelles</li>
                      <li>Historique des sauvegardes</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Options avancées & Mode Économie permanente */}
              <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-3">
                <h3 className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-purple-600" />
                  Options d'Économie & Connexion
                </h3>

                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/70 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-stone-900">Mode Économie Permanente</p>
                    <p className="text-[11px] text-stone-500">
                      Réduit drastiquement les requêtes de fond. Idéal sur réseau mobile 4G/5G pour préserver 100% de votre quota pour le Journal.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      checked={quotaStats.manualEconomy} 
                      onChange={e => handleToggleEconomy(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 text-xs text-amber-900 space-y-2">
                  <p className="font-medium flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-700" />
                    Besoin de lever totalement les quotas gratuits ?
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Le forfait <strong>Firebase Blaze (Pay-as-you-go)</strong> offre les mêmes 50&nbsp;000 lectures gratuites par jour, mais ne bloque jamais l'application en cas de dépassement (quelques centimes d'euro pour 100&nbsp;000 lectures supplémentaires).
                  </p>
                  <a
                    href="https://console.firebase.google.com/project/gen-lang-client-0410975419/firestore/databases/ai-studio-5e99e311-d3dc-4085-9892-a0b63aed5f7a/data?openUpgradeDialog=true"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-2xs"
                  >
                    <span>Consulter / Passer en Blaze sur la console Firebase</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ) : activeTab === 'season' ? (
            <div className="space-y-4">
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Gestion des Saisons du Potager
                </p>
                <p className="text-emerald-700 leading-relaxed">
                  Les saisons vous permettent de séparer vos cultures, tâches et récoltes année après année tout en conservant vos parcelles, zones et configurations. Vous pouvez facilement renommer une saison ou supprimer un doublon.
                </p>
              </div>

              {/* Formulaire ajout saison */}
              <form onSubmit={handleCreateSeason} className="flex gap-2">
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={e => setNewSeasonName(e.target.value)}
                  placeholder="Ex: Saison 2026/2027"
                  className="flex-1 px-3 py-1.5 text-sm rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={!newSeasonName.trim()}
                  className="px-4 py-1.5 text-sm rounded-md font-medium shadow-sm transition-colors flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-stone-200 disabled:text-stone-400"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter une saison
                </button>
              </form>

              {/* Liste des saisons */}
              <div className="border border-stone-100 rounded-lg overflow-hidden divide-y divide-stone-100">
                {seasons.map(s => {
                  const isActive = s.id === currentSeasonId;
                  const isEditing = editingSeasonId === s.id;

                  return (
                    <div key={s.id} className={`p-3 flex items-center justify-between transition-colors ${isActive ? 'bg-emerald-50/50' : 'hover:bg-stone-50'}`}>
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1 mr-4">
                          <input
                            type="text"
                            autoFocus
                            value={editingSeasonName}
                            onChange={e => setEditingSeasonName(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm rounded border border-stone-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateSeason(s.id, editingSeasonName)}
                            className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700"
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSeasonId(null)}
                            className="px-2.5 py-1 text-xs bg-stone-200 text-stone-700 rounded font-medium hover:bg-stone-300"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm text-stone-900">{s.name}</span>
                          {isActive ? (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
                              Saison active
                            </span>
                          ) : (
                            <button
                              onClick={() => setCurrentSeasonId(s.id)}
                              className="text-xs text-stone-500 hover:text-emerald-600 font-medium underline"
                            >
                              Définir comme active
                            </button>
                          )}
                          {s.startDate && (
                            <span className="text-xs text-stone-400">
                              (Créée le {new Date(s.startDate).toLocaleDateString('fr-FR')})
                            </span>
                          )}
                        </div>
                      )}

                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSeasonId(s.id);
                              setEditingSeasonName(s.name);
                            }}
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded"
                            title="Renommer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {seasons.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSeason(s.id, s.name)}
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Supprimer la saison"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'weather' ? (
            <WeatherSettings />
          ) : (
            <>
              {/* Clean feedback toast */}
              {cleanFeedback && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 shadow-sm animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-medium">{cleanFeedback}</span>
                </div>
              )}

              {/* Duplicate alert banner */}
              {detectedDuplicatesCount > 0 && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 shadow-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      <strong>{detectedDuplicatesCount} doublon{detectedDuplicatesCount > 1 ? 's' : ''}</strong> détecté{detectedDuplicatesCount > 1 ? 's' : ''} dans vos {tabs.find(t => t.id === activeTab)?.label.toLowerCase()}.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCleanDuplicates}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-semibold text-xs transition-colors shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Nettoyer les doublons
                  </button>
                </div>
              )}

              {/* Category specific helper and sync header */}
              {activeTab === 'category' && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-stone-500 flex-shrink-0" />
                    <span>
                      Les catégories classent vos plantes dans l'encyclopédie, les semis et le verger.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncCategories}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-md font-medium text-xs transition-colors shadow-sm"
                      title="S'assurer que toutes les catégories présentes sur vos fiches de plantes sont listées ici"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
                      Synchroniser avec le catalogue
                    </button>
                    {detectedDuplicatesCount === 0 && (
                      <button
                        type="button"
                        onClick={handleCleanDuplicates}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-md font-medium text-xs transition-colors shadow-sm"
                        title="Vérifier et nettoyer les doublons éventuels"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Nettoyer doublons
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Journal Tag specific helper */}
              {activeTab === 'journal_tag' && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs text-emerald-900 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      Ces <strong>tags d'activités rapides</strong> apparaissent sous forme de boutons cliquables dans le Journal pour qualifier vos observations en un clic (ex : <em>💧 Arrosage</em>, <em>🌱 Semis</em>, <em>🧺 Récolte</em>, <em>✂️ Taille</em>...). Vous pouvez en ajouter, renommer ou supprimer selon vos besoins.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 mb-4">
                <form onSubmit={handleAdd} className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                {activeTab === 'variety_option' && (
                  <select
                    required
                    value={selectedAttrType}
                    onChange={e => setSelectedAttrType(e.target.value)}
                    className="px-3 py-1.5 text-sm rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white min-w-[160px]"
                  >
                    <option value="">Sélectionner un champ</option>
                    {varietyAttrTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.value}</option>
                    ))}
                  </select>
                )}
                {/* Logo / Emoji Picker for new element */}
                <EmojiLogoPicker
                  selectedEmoji={newEmoji}
                  onSelect={setNewEmoji}
                  title="Choisir un logo ou emoji pour cet élément"
                />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    required
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder={`Ajouter un élément (${tabs.find(t => t.id === activeTab)?.label.toLowerCase()})`}
                    className={`w-full px-3 py-1.5 text-sm rounded-md border focus:ring-2 outline-none transition-all ${
                      isCurrentValueDuplicate 
                        ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                        : 'border-stone-200 focus:ring-emerald-500'
                    }`}
                  />
                  {isCurrentValueDuplicate && (
                    <span className="absolute -bottom-4 left-0 text-[10px] font-bold text-red-600 uppercase tracking-tight">
                      Existe déjà
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isCurrentValueDuplicate}
                  className={`px-4 py-1.5 text-sm rounded-md font-medium shadow-sm transition-colors flex items-center gap-2 ${
                    isCurrentValueDuplicate
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-stone-500 italic text-sm text-center py-6">Aucun élément configuré.</p>
            ) : (
              <ul className="divide-y divide-stone-100 border border-stone-100 rounded-lg">
                {items.map(item => {
                  const { emoji: parsedEmoji, cleanText: parsedCleanText } = extractEmoji(item.value || '');
                  const currentEmoji = parsedEmoji || item.attributes?.emoji;

                  return (
                    <li key={item.id} className="flex flex-col p-2 hover:bg-stone-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          {editingItemId === item.id ? (
                            <form onSubmit={handleSaveItemName} className="flex flex-1 items-center gap-2 mr-4">
                              <EmojiLogoPicker
                                selectedEmoji={editingItemEmoji}
                                onSelect={setEditingItemEmoji}
                                title="Modifier le logo"
                              />
                              <input
                                type="text"
                                autoFocus
                                value={editingItemValue}
                                onChange={e => setEditingItemValue(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm rounded border border-stone-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                              <button type="submit" className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700">OK</button>
                              <button type="button" onClick={() => { setEditingItemId(null); setEditingItemEmoji(''); }} className="px-2.5 py-1 text-xs bg-stone-200 text-stone-700 rounded font-medium hover:bg-stone-300">Annuler</button>
                            </form>
                          ) : (
                            <>
                              <EmojiLogoPicker
                                selectedEmoji={currentEmoji}
                                onSelect={(nextEmoji) => handleQuickChangeEmoji(item, nextEmoji)}
                                title="Cliquer pour changer le logo"
                                size="sm"
                              />
                              <span className="font-medium text-sm text-stone-900">{parsedCleanText || item.value}</span>
                              {activeTab === 'variety_option' && item.parentId && (
                                <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                                  {varietyAttrTypes.find(t => t.id === item.parentId)?.value || 'Type inconnu'}
                                </span>
                              )}
                              {activeTab === 'zone' && item.attributes && (
                                <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                                  {item.attributes.type} - {item.attributes.width}x{item.attributes.height}cm
                                </span>
                              )}
                              {activeTab === 'terrain' && item.attributes && (
                                <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                                  {item.attributes.width}x{item.attributes.height}cm
                                </span>
                              )}
                              {activeTab === 'state' && defaultState === item.value && (
                                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Par défaut
                                </span>
                              )}
                              {activeTab === 'location' && defaultLocation === item.value && (
                                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Par défaut
                                </span>
                              )}
                              {activeTab === 'category' && (
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                                  (plantCategoryUsage.get(normalizeCategoryKey(item.value)) || 0) > 0
                                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
                                    : 'text-stone-400 bg-stone-100'
                                }`}>
                                  {plantCategoryUsage.get(normalizeCategoryKey(item.value)) || 0} plante{(plantCategoryUsage.get(normalizeCategoryKey(item.value)) || 0) > 1 ? 's' : ''}
                                </span>
                              )}
                              {activeTab === 'journal_tag' && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Tag d'activité
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {editingItemId !== item.id && (
                            <button
                              onClick={() => {
                                const { emoji, cleanText } = extractEmoji(item.value || '');
                                setEditingItemId(item.id);
                                setEditingItemEmoji(emoji || item.attributes?.emoji || '');
                                setEditingItemValue(cleanText || item.value);
                              }}
                              className="text-stone-400 hover:text-emerald-600 p-1.5 rounded-md hover:bg-emerald-50 transition-colors"
                              title="Renommer et modifier le logo"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        {activeTab === 'state' && defaultState !== item.value && (
                          <button
                            onClick={() => handleSetDefault('state', item.value)}
                            className="text-stone-400 hover:text-emerald-600 p-1.5 rounded-md hover:bg-emerald-50 transition-colors"
                            title="Définir comme état par défaut"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {activeTab === 'location' && defaultLocation !== item.value && (
                          <button
                            onClick={() => handleSetDefault('location', item.value)}
                            className="text-stone-400 hover:text-emerald-600 p-1.5 rounded-md hover:bg-emerald-50 transition-colors"
                            title="Définir comme emplacement par défaut"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}

                        {activeTab === 'zone' && (
                          <button
                            onClick={() => {
                              setEditingZoneId(item.id);
                              setZoneAttrs(item.attributes || { type: 'serre', width: 100, height: 100 });
                            }}
                            className="text-stone-400 hover:text-emerald-600 p-1.5 rounded-md hover:bg-emerald-50 transition-colors"
                            title="Modifier les dimensions"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {activeTab === 'terrain' && (
                          <button
                            onClick={() => {
                              setEditingZoneId(item.id);
                              const attrs = item.attributes || { width: 1000, height: 1000, shape: 'rectangle', points: [] };
                              setTerrainAttrs(attrs);
                              if (attrs.points && Array.isArray(attrs.points)) {
                                setPointsRaw(attrs.points.map((p: any) => `${p.x},${p.y}`).join('; '));
                              } else {
                                setPointsRaw('');
                              }
                            }}
                            className="text-stone-400 hover:text-emerald-600 p-1.5 rounded-md hover:bg-emerald-50 transition-colors"
                            title="Modifier les dimensions"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item.id, item.value)}
                          className="text-stone-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>



                    {/* Zone Edit Form */}
                    {activeTab === 'zone' && editingZoneId === item.id && (
                      <form onSubmit={handleSaveZone} className="mt-2 p-2 bg-stone-100 rounded-lg border border-stone-200 grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Type</label>
                          <select value={zoneAttrs.type || 'serre'} onChange={e => setZoneAttrs({...zoneAttrs, type: e.target.value})} className="w-full px-2 py-1.5 rounded-md border border-stone-200 text-xs bg-white">
                            <option value="serre">Serre</option>
                            <option value="exterieur">Extérieur</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Largeur (cm)</label>
                          <input type="number" min="1" value={zoneAttrs.width || ''} onChange={e => setZoneAttrs({...zoneAttrs, width: Number(e.target.value)})} className="w-full px-2 py-1.5 rounded-md border border-stone-200 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Longueur (cm)</label>
                          <input type="number" min="1" value={zoneAttrs.height || ''} onChange={e => setZoneAttrs({...zoneAttrs, height: Number(e.target.value)})} className="w-full px-2 py-1.5 rounded-md border border-stone-200 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Espacement (cm)</label>
                          <input type="number" min="1" value={zoneAttrs.scale || 10} onChange={e => setZoneAttrs({...zoneAttrs, scale: Number(e.target.value)})} className="w-full px-2 py-1.5 rounded-md border border-stone-200 text-xs" />
                        </div>
                        <div className="md:col-span-3 flex justify-end gap-2 mt-1">
                          <button type="button" onClick={() => setEditingZoneId(null)} className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-md">Annuler</button>
                          <button type="submit" className="px-3 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded-md">Enregistrer</button>
                        </div>
                      </form>
                    )}

                    {/* Terrain Edit Form */}
                    {activeTab === 'terrain' && editingZoneId === item.id && (
                      <div className="mt-2 p-3 bg-stone-100 rounded-lg border border-stone-200 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Modèle de forme</label>
                            <select 
                              value={terrainShapeType} 
                              onChange={e => {
                                const type = e.target.value as any;
                                setTerrainShapeType(type);
                                if (type !== 'custom') {
                                  const w = terrainAttrs.width || 1000;
                                  const h = terrainAttrs.height || 1000;
                                  let pts = [];
                                  if (type === 'rectangle') {
                                    pts = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:0,y:h}];
                                  } else if (type === 'l-shape') {
                                    pts = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:w/2,y:h}, {x:w/2,y:h/2}, {x:0,y:h/2}];
                                  } else if (type === 'u-shape') {
                                    pts = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:w*0.7,y:h}, {x:w*0.7,y:h*0.3}, {x:w*0.3,y:h*0.3}, {x:w*0.3,y:h}, {x:0,y:h}];
                                  }
                                  setTerrainAttrs({...terrainAttrs, shape: 'polygon', points: pts});
                                  setPointsRaw(pts.map(p => `${p.x},${p.y}`).join('; '));
                                }
                              }} 
                              className="w-full px-2 py-1.5 rounded-md border border-stone-200 text-xs bg-white"
                            >
                              <option value="rectangle">Rectangle simple</option>
                              <option value="l-shape">Forme en L</option>
                              <option value="u-shape">Forme en U</option>
                              <option value="custom">Sur mesure (Points)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Largeur Totale (cm)</label>
                            <input 
                              type="number" 
                              value={terrainAttrs.width || ''} 
                              onChange={e => {
                                const w = Number(e.target.value);
                                if (terrainShapeType !== 'custom') {
                                  const h = terrainAttrs.height || 1000;
                                  let pts = [];
                                  if (terrainShapeType === 'rectangle') pts = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:0,y:h}];
                                  else if (terrainShapeType === 'l-shape') pts = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:w/2,y:h}, {x:w/2,y:h/2}, {x:0,y:h/2}];
                                  else if (terrainShapeType === 'u-shape') pts = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:w*0.7,y:h}, {x:w*0.7,y:h*0.3}, {x:w*0.3,y:h*0.3}, {x:w*0.3,y:h}, {x:0,y:h}];
                                  setTerrainAttrs({...terrainAttrs, width: w, points: pts});
                                  setPointsRaw(pts.map(p => `${p.x},${p.y}`).join('; '));
                                } else {
                                  setTerrainAttrs({...terrainAttrs, width: w});
                                }
                              }} 
                              className="w-full px-2 py-1.5 rounded-md border border-stone-200 text-xs" 
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Longueur Totale (cm)</label>
                            <input 
                              type="number" 
                              value={terrainAttrs.height || ''} 
                              onChange={e => {
                                const h = Number(e.target.value);
                                if (terrainShapeType !== 'custom') {
                                  const w = terrainAttrs.width || 1000;
                                  let pts = [];
                                  if (terrainShapeType === 'rectangle') pts = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:0,y:h}];
                                  else if (terrainShapeType === 'l-shape') pts = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:w/2,y:h}, {x:w/2,y:h/2}, {x:0,y:h/2}];
                                  else if (terrainShapeType === 'u-shape') pts = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:w*0.7,y:h}, {x:w*0.7,y:h*0.3}, {x:w*0.3,y:h*0.3}, {x:w*0.3,y:h}, {x:0,y:h}];
                                  setTerrainAttrs({...terrainAttrs, height: h, points: pts});
                                  setPointsRaw(pts.map(p => `${p.x},${p.y}`).join('; '));
                                } else {
                                  setTerrainAttrs({...terrainAttrs, height: h});
                                }
                              }} 
                              className="w-full px-2 py-1.5 rounded-md border border-stone-200 text-xs" 
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Grille (cm)</label>
                            <select 
                              value={terrainAttrs.scale || 50} 
                              onChange={e => setTerrainAttrs({...terrainAttrs, scale: Number(e.target.value)})} 
                              className="w-full px-2 py-1.5 rounded-md border border-stone-200 text-xs bg-white"
                            >
                              <option value={50}>50x50 cm</option>
                              <option value={100}>1x1 m</option>
                              <option value={200}>2x2 m</option>
                              <option value={500}>5x5 m</option>
                            </select>
                          </div>
                        </div>

                        {terrainShapeType === 'custom' && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-stone-600 uppercase tracking-wider">Points (x,y; x,y; ...)</label>
                            <input 
                              type="text" 
                              placeholder="0,0; 1000,0; 1000,500; 0,500"
                              value={pointsRaw} 
                              onChange={e => {
                                const val = e.target.value;
                                setPointsRaw(val);
                                const pts = val.split(';').filter(p => p.trim() !== '').map(p => {
                                  const parts = p.trim().split(',');
                                  if (parts.length !== 2) return null;
                                  const x = parseFloat(parts[0]);
                                  const y = parseFloat(parts[1]);
                                  return isNaN(x) || isNaN(y) ? null : { x, y };
                                }).filter((p): p is {x: number, y: number} => p !== null);
                                setTerrainAttrs({...terrainAttrs, points: pts});
                              }} 
                              className="w-full px-2 py-1.5 rounded-md border border-stone-200 text-xs" 
                            />
                          </div>
                        )}

                        {/* Visual Preview / Drawing Area */}
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-stone-200 min-h-[200px]">
                           <div className="flex items-center justify-between w-full mb-2">
                             <p className="text-[10px] font-bold text-stone-400 uppercase">Aperçu / Dessin</p>
                             {terrainShapeType === 'custom' && (
                               <div className="flex gap-2">
                                 <button 
                                   type="button"
                                   onClick={() => {
                                     setTerrainAttrs({...terrainAttrs, points: []});
                                     setPointsRaw('');
                                   }}
                                   className="text-[10px] px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded border border-stone-200"
                                 >
                                   Effacer
                                 </button>
                                 <button 
                                   type="button"
                                   onClick={() => setIsDrawingTerrain(!isDrawingTerrain)}
                                   className={`text-[10px] px-2 py-1 rounded border transition-all ${isDrawingTerrain ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                                 >
                                   {isDrawingTerrain ? 'Terminer le dessin' : 'Dessiner à la souris'}
                                 </button>
                               </div>
                             )}
                           </div>
                           
                           <div 
                             className={`relative border-2 ${isDrawingTerrain ? 'border-emerald-400 bg-emerald-50/30 cursor-crosshair' : 'border-dashed border-stone-200 bg-stone-50'}`} 
                             style={{ width: '180px', height: '180px' }}
                           >
                              <svg 
                                viewBox={`0 0 ${terrainAttrs.width || 1000} ${terrainAttrs.height || 1000}`} 
                                className="w-full h-full drop-shadow-sm"
                                onClick={(e) => {
                                  if (!isDrawingTerrain) return;
                                  const svg = e.currentTarget;
                                  const rect = svg.getBoundingClientRect();
                                  const x = e.clientX - rect.left;
                                  const y = e.clientY - rect.top;
                                  
                                  // Scale back to cm
                                  const cmX = Math.round((x / rect.width) * (terrainAttrs.width || 1000));
                                  const cmY = Math.round((y / rect.height) * (terrainAttrs.height || 1000));
                                  
                                  const newPoints = [...(terrainAttrs.points || []), { x: cmX, y: cmY }];
                                  setTerrainAttrs({ ...terrainAttrs, points: newPoints });
                                  setPointsRaw(newPoints.map(p => `${p.x},${p.y}`).join('; '));
                                }}
                              >
                                {terrainAttrs.points && terrainAttrs.points.length > 0 && (
                                  <>
                                    {terrainAttrs.points.length >= 3 && (
                                      <polygon 
                                        points={terrainAttrs.points.map((p: any) => `${p.x},${p.y}`).join(' ')} 
                                        fill="#10b98130" 
                                        stroke="#10b981" 
                                        strokeWidth="20"
                                      />
                                    )}
                                    {terrainAttrs.points.map((p: any, idx: number) => (
                                      <circle 
                                        key={idx} 
                                        cx={p.x} 
                                        cy={p.y} 
                                        r="30" 
                                        fill={idx === 0 ? "#ef4444" : "#10b981"} 
                                      />
                                    ))}
                                    {terrainAttrs.points.length > 1 && terrainAttrs.points.map((p: any, idx: number) => {
                                      if (idx === 0) return null;
                                      const prev = terrainAttrs.points[idx-1];
                                      return (
                                        <line 
                                          key={`l-${idx}`} 
                                          x1={prev.x} y1={prev.y} 
                                          x2={p.x} y2={p.y} 
                                          stroke="#10b981" 
                                          strokeWidth="10" 
                                        />
                                      );
                                    })}
                                  </>
                                )}
                              </svg>
                              {isDrawingTerrain && terrainAttrs.points?.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <p className="text-[9px] text-emerald-600 font-medium text-center px-2">Cliquez ici pour placer le premier point</p>
                                </div>
                              )}
                           </div>
                           {isDrawingTerrain && (
                             <p className="mt-2 text-[9px] text-stone-500 italic">Cliquez pour ajouter des points. L'ordre des points définit la forme.</p>
                           )}
                        </div>

                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingZoneId(null)} className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-md">Annuler</button>
                          <button onClick={handleSaveTerrain} className="px-3 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded-md">Enregistrer la forme</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              </ul>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
