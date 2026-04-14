import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ConfigItem } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { Settings, Plus, Trash2, Edit2, Palette, XCircle, CheckCircle2, Trees, BookOpen, Info, Cloud, CloudUpload, LogOut, LogIn } from 'lucide-react';
import { ConfirmModal } from '../components/Modals';
import { ICON_LIST, ICON_MAP, GARDEN_EMOJIS, GARDEN_EMOJI_CATEGORIES } from '../constants';
import { getDistinctColor } from '../utils/colors';
import { PLANT_CATALOG } from '../catalog';
import { WeatherSettings } from './WeatherSettings';
import { migrateToCloud } from '../utils/migration';
import { auth, loginWithGoogle, logout } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export function Config({ onNavigate }: { onNavigate?: (view: any) => void }) {
  const config = useLiveQuery(() => db.config.toArray());
  const [newValue, setNewValue] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [activeTab, setActiveTab] = useState<'state' | 'location' | 'zone' | 'terrain' | 'variety_option' | 'variety_attr_type' | 'weather' | 'expense_category' | 'category' | 'cloud'>('state');
  const [selectedAttrType, setSelectedAttrType] = useState<string>('');

  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');

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

  const [user, setUser] = useState<any>(null);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
  const [migrationProgress, setMigrationProgress] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleMigration = async () => {
    if (!user) return;
    setMigrationStatus('migrating');
    setMigrationProgress('Initialisation...');
    try {
      await migrateToCloud((msg) => setMigrationProgress(msg));
      setMigrationStatus('success');
    } catch (error: any) {
      console.error(error);
      setMigrationStatus('error');
      setMigrationProgress(error.message || 'Une erreur est survenue.');
    }
  };

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

  if (!config) return <div>Chargement...</div>;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    const itemId = uuidv4();
    
    // Duplicate check
    const isDuplicate = config.some(c => 
      c.type === activeTab && 
      c.value.toLowerCase().trim() === newValue.toLowerCase().trim() &&
      
      (activeTab !== 'variety_option' || c.parentId === selectedAttrType)
    );

    if (isDuplicate) {
      alert(`Cet élément existe déjà dans la catégorie ${tabs.find(t => t.id === activeTab)?.label}.`);
      return;
    }

    const item: ConfigItem = {
      id: itemId,
      type: activeTab as any,
      value: newValue,
      parentId: activeTab === 'variety_option' ? selectedAttrType : undefined,
      attributes: activeTab === 'terrain' ? { width: 1000, height: 1000 } : 
                  false ? { 
                    color: getDistinctColor(config.filter(c => c.type === 'vegetable').map(v => v.attributes?.color).filter(Boolean)),
                    icon: PLANT_CATALOG.find(p => p.name.toLowerCase() === newValue.trim().toLowerCase())?.emoji || 'Sprout' 
                  } : undefined
    };

    await db.config.add(item);

    setNewValue('');
    setNewParentId('');
  };

  const handleDelete = async (id: string, value: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Supprimer l\'élément',
      message: 'Voulez-vous vraiment supprimer cet élément ?',
      isDanger: true,
      onConfirm: async () => {
        await db.config.delete(id);
        if (false) {
          const children = config.filter(c => c.parentId === id);
          for (const child of children) {
            await db.config.delete(child.id);
          }
        } else if (activeTab === 'state' && defaultState === value) {
          await db.config.delete('default_state');
        } else if (activeTab === 'location' && defaultLocation === value) {
          await db.config.delete('default_location');
        }
      }
    });
  };

  const handleSetDefault = async (type: 'state' | 'location', value: string) => {
    await db.config.put({
      id: `default_${type}`,
      type: 'setting',
      value: value
    });
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZoneId) return;
    await db.config.update(editingZoneId, { attributes: zoneAttrs });
    setEditingZoneId(null);
  };

  const handleSaveTerrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZoneId) return; // Reusing editingZoneId for terrain
    await db.config.update(editingZoneId, { attributes: terrainAttrs });
    setEditingZoneId(null);
  };

  const handleSaveItemName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItemId || !editingItemValue.trim()) return;
    await db.config.update(editingItemId, { value: editingItemValue });
    setEditingItemId(null);
  };

  let items = config.filter(c => c.type === activeTab);
  
  // Real-time duplicate check for UI feedback
  const isCurrentValueDuplicate = newValue.trim() !== '' && items.some(i => 
    i.value.toLowerCase().trim() === newValue.toLowerCase().trim() &&
    
    (activeTab !== 'variety_option' || i.parentId === selectedAttrType)
  );

  

  if (activeTab === 'variety_option' && selectedAttrType) {
    items = items.filter(i => i.parentId === selectedAttrType);
  }
  
  items.sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' }));

  const tabs = [
    { id: 'state', label: 'États' },
    { id: 'location', label: 'Emplacements' },
    { id: 'category', label: 'Catégories' },
    { id: 'zone', label: 'Zones (Plan)' },
    { id: 'terrain', label: 'Terrains (Verger)' },
    { id: 'variety_attr_type', label: 'Champs Variétés' },
    { id: 'variety_option', label: 'Options de Champs' },
    { id: 'weather', label: 'Météo & Alertes' },
    { id: 'expense_category', label: 'Dépenses' },
    { id: 'cloud', label: 'Cloud & Migration' },
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
    await db.config.add(item);
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
            <h1 className="text-xl font-serif font-medium text-stone-900 flex items-center gap-1.5">
              <Settings className="w-5 h-5 text-emerald-600" />
              Configuration
            </h1>
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
          {activeTab === 'cloud' ? (
            <div className="p-4 space-y-6">
              <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-stone-900">Migration vers le Cloud</h2>
                  <p className="text-sm text-stone-500">Sauvegardez vos données locales vers Firebase pour y accéder partout.</p>
                </div>
              </div>

              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <h3 className="text-sm font-medium text-stone-900 mb-2">1. Connexion</h3>
                {user ? (
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-stone-200">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profil" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold">
                          {user.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-stone-900">{user.displayName || 'Utilisateur'}</p>
                        <p className="text-xs text-stone-500">{user.email}</p>
                      </div>
                    </div>
                    <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors">
                      <LogOut className="w-3.5 h-3.5" />
                      Déconnexion
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-stone-600 mb-3">Vous devez être connecté avec un compte Google pour migrer vos données.</p>
                    <button onClick={loginWithGoogle} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium shadow-sm">
                      <LogIn className="w-4 h-4" />
                      Se connecter avec Google
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <h3 className="text-sm font-medium text-stone-900 mb-2">2. Migration des données</h3>
                <p className="text-xs text-stone-500 mb-4">
                  Cette opération va copier toutes vos données locales (semis, journal, configuration, etc.) vers votre base de données Cloud. Vos données locales ne seront pas supprimées.
                </p>
                
                <div className="flex flex-col items-center">
                  <button 
                    onClick={handleMigration}
                    disabled={!user || migrationStatus === 'migrating'}
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all ${
                      !user 
                        ? 'bg-stone-200 text-stone-400 cursor-not-allowed' 
                        : migrationStatus === 'migrating'
                          ? 'bg-blue-100 text-blue-700 cursor-wait'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <CloudUpload className={`w-4 h-4 ${migrationStatus === 'migrating' ? 'animate-bounce' : ''}`} />
                    {migrationStatus === 'migrating' ? 'Migration en cours...' : 'Lancer la migration'}
                  </button>

                  {migrationProgress && (
                    <div className={`mt-4 p-3 rounded-lg text-sm w-full text-center ${
                      migrationStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                      migrationStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {migrationProgress}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'weather' ? (
            <WeatherSettings />
          ) : (
            <>
              <div className="flex flex-col gap-2 mb-4">
                <form onSubmit={handleAdd} className="flex flex-col gap-2">
              <div className="flex gap-2">
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
              <ul className="divide-y divide-stone-100 border border-stone-100 rounded-lg overflow-hidden">
                {items.map(item => (
                  <li key={item.id} className="flex flex-col p-2 hover:bg-stone-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        {editingItemId === item.id ? (
                          <form onSubmit={handleSaveItemName} className="flex flex-1 gap-2 mr-4">
                            <input
                              type="text"
                              autoFocus
                              value={editingItemValue}
                              onChange={e => setEditingItemValue(e.target.value)}
                              className="flex-1 px-2 py-1 text-sm rounded border border-stone-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <button type="submit" className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">OK</button>
                            <button type="button" onClick={() => setEditingItemId(null)} className="px-2 py-1 text-xs bg-stone-200 text-stone-700 rounded hover:bg-stone-300">Annuler</button>
                          </form>
                        ) : (
                          <>
                            <span className="font-medium text-sm text-stone-900">{item.value}</span>
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
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {editingItemId !== item.id && (
                          <button
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditingItemValue(item.value);
                            }}
                            className="text-stone-400 hover:text-emerald-600 p-1.5 rounded-md hover:bg-emerald-50 transition-colors"
                            title="Renommer"
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
                ))}
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
