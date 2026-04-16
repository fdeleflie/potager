import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, EncyclopediaEntry, HealthIssue, ConfigItem } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { 
  BookOpen, Search, Plus, Trash2, Edit2, X, Save, 
  Sun, Droplets, Move, Users, Info, Bug, Stethoscope, 
  AlertTriangle, CheckCircle2, ShieldCheck, Leaf,
  ThumbsUp, ThumbsDown, Calendar, Maximize2, ChevronRight, ChevronLeft,
  List, Wand2
} from 'lucide-react';
import { GARDEN_EMOJI_CATEGORIES } from '../constants';
import { getDistinctColor } from '../utils/colors';
import { ConfirmModal } from '../components/Modals';

type Tab = 'vegetables' | 'health';
type PlantSubTab = 'culture' | 'varieties';

export function EncyclopediaView() {
  const [activeTab, setActiveTab] = useState<Tab>('vegetables');
  const [plantSubTab, setPlantSubTab] = useState<PlantSubTab>('culture');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVegId, setSelectedVegId] = useState<string | null>(null);
  const [selectedHealthId, setSelectedHealthId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Data
  const encyclopedia = useLiveQuery(() => db.encyclopedia.toArray());
  const healthIssues = useLiveQuery(() => db.healthIssues.toArray());
  const config = useLiveQuery(() => db.config.toArray());

  const [editForm, setEditForm] = useState<any>({});
  const [healthForm, setHealthForm] = useState<Partial<HealthIssue>>({});
  const [newVarietyName, setNewVarietyName] = useState('');
  const [editingVarietyId, setEditingVarietyId] = useState<string | null>(null);
  const [varietyEditForm, setVarietyEditForm] = useState<{name: string, attributes: any}>({name: '', attributes: {}});
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const unifiedPlants = useMemo(() => {
    if (!config || !encyclopedia) return [];
    const configVegetables = config.filter(c => c.type === 'vegetable');
    const encyclopediaEntries = encyclopedia;

    const allNames = Array.from(new Set([
      ...configVegetables.map(c => c.value?.toLowerCase().trim()),
      ...encyclopediaEntries.map(e => e.name?.toLowerCase().trim())
    ]));

    return allNames.map(nameLower => {
      const conf = configVegetables.find(c => c.value?.toLowerCase().trim() === nameLower);
      const enc = encyclopediaEntries.find(e => e.name?.toLowerCase().trim() === nameLower);
      
      // Use a prefixed ID to avoid collisions between config and encyclopedia tables
      // Use nameLower as fallback to ensure ID stability if both conf and enc are missing (though they shouldn't be)
      const id = conf ? `c-${conf.id}` : (enc ? `e-${enc.id}` : `v-${encodeURIComponent(nameLower)}`);
      
      return {
        id,
        key: `plant-${id}`,
        name: conf?.value || enc?.name || '',
        configId: conf?.id,
        encyclopediaId: enc?.id,
        category: enc?.category || 'Légume',
        sowingPeriod: enc?.sowingPeriod || '',
        plantingPeriod: enc?.plantingPeriod || '',
        harvestPeriod: enc?.harvestPeriod || '',
        exposure: enc?.exposure || 'Plein soleil',
        waterNeeds: enc?.waterNeeds || 'Moyen',
        spacing: enc?.spacing || '',
        pricePerKg: enc?.pricePerKg,
        goodCompanions: enc?.goodCompanions || [],
        badCompanions: enc?.badCompanions || [],
        tips: enc?.tips || '',
        color: enc?.color || '#10b981',
        icon: enc?.icon || 'Sprout'
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [config, encyclopedia]);

  const filteredPlants = unifiedPlants.filter(item => 
    item.name?.toLowerCase().includes(searchTerm?.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm?.toLowerCase())
  );

  const filteredHealth = healthIssues?.filter(item => 
    item.name?.toLowerCase().includes(searchTerm?.toLowerCase()) ||
    item.type?.toLowerCase().includes(searchTerm?.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name)) || [];

  const selectedVeg = unifiedPlants.find(v => v.id === selectedVegId);
  const selectedHealth = healthIssues?.find(h => h.id === selectedHealthId);
  
  const plantVarieties = config?.filter(c => {
    if (c.type !== 'variety') return false;
    
    // 1. Direct ID match (Config ID or Encyclopedia ID)
    if (c.parentId === selectedVeg?.configId || c.parentId === selectedVeg?.encyclopediaId) return true;
    
    // 2. Name match (if parentId is actually the name of the vegetable)
    if (selectedVeg?.name && c.parentId?.toLowerCase().trim() === selectedVeg.name?.toLowerCase().trim()) return true;
    
    if (selectedVeg?.name) {
      // 3. Match via parent vegetable config item (if it still exists)
      const parentVegConfig = config.find(v => v.id === c.parentId && v.type === 'vegetable');
      if (parentVegConfig && parentVegConfig.value?.toLowerCase().trim() === selectedVeg.name?.toLowerCase().trim()) {
        return true;
      }
      
      // 4. Match via parent encyclopedia entry
      const parentVegEnc = encyclopedia?.find(e => e.id === c.parentId);
      if (parentVegEnc && parentVegEnc.name?.toLowerCase().trim() === selectedVeg.name?.toLowerCase().trim()) {
        return true;
      }
    }
    return false;
  }).sort((a, b) => a.value.localeCompare(b.value)) || [];

  const handleStartEdit = (veg?: any) => {
    setActiveTab("vegetables");
    setIsEditing(true);
    if (veg) {
      setEditForm({
        ...veg,
        // Make sure we pass the correct ID to update the encyclopedia entry
        encyclopediaId: veg.encyclopediaId || (veg.id && veg.id.startsWith('e-') ? veg.id.substring(2) : undefined)
      });
    } else {
      setEditForm({
        name: '',
        category: 'Légume',
        sowingPeriod: '',
        plantingPeriod: '',
        harvestPeriod: '',
        exposure: 'Plein soleil',
        waterNeeds: 'Moyen',
        spacing: '',
        goodCompanions: [],
        badCompanions: [],
        tips: '',
        pricePerKg: undefined,
        color: '#10b981',
        icon: 'Sprout'
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartHealthEdit = (item?: HealthIssue) => {
    setActiveTab("health");
    setIsEditing(true);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!editForm.name) return;

    let encId = editForm.encyclopediaId;
    const encData = {
      name: editForm.name,
      category: editForm.category || 'Légume',
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
      icon: editForm.icon || 'Sprout',
      updatedAt: new Date().toISOString()
    };

    if (encId) {
      await db.encyclopedia.update(encId, encData);
    } else {
      encId = uuidv4();
      await db.encyclopedia.add({ id: encId, ...encData });
    }

    // Find the merged entry in unifiedPlants to get the correct ID (c- or e-)
    // This ensures that the selection remains valid after saving
    const nameLower = encData.name.toLowerCase().trim();
    const conf = config?.find(c => c.type === 'vegetable' && c.value?.toLowerCase().trim() === nameLower);
    const finalId = conf ? `c-${conf.id}` : `e-${encId}`;

    setSelectedVegId(finalId);
    setIsEditing(false);
    window.scrollTo(0, 0);
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
      await db.healthIssues.update(id, updateData);
    } else {
      await db.healthIssues.add(entry);
      setSelectedHealthId(entry.id);
    }
    setIsEditing(false);
    window.scrollTo(0, 0);
  };

  const handleDelete = (veg: any) => {
    setConfirmDelete({
      isOpen: true,
      title: "Supprimer la plante",
      message: "Voulez-vous vraiment supprimer cette plante ? Cela supprimera également ses variétés.",
      onConfirm: async () => {
        if (veg.encyclopediaId) await db.encyclopedia.delete(veg.encyclopediaId);
        if (veg.configId) {
          await db.config.delete(veg.configId);
        }
        // Delete associated varieties
        const varieties = config?.filter(c => {
          if (c.type !== "variety") return false;
          if (c.parentId === veg.configId || c.parentId === veg.encyclopediaId) return true;
          
          const parentVeg = config.find(v => v.id === c.parentId && v.type === 'vegetable');
          if (parentVeg && parentVeg.value?.toLowerCase().trim() === veg.name?.toLowerCase().trim()) {
            return true;
          }
          return false;
        }) || [];
        for (const v of varieties) {
          await db.config.delete(v.id);
        }
        if (selectedVegId === veg.id) setSelectedVegId(null);
      }
    });
  };

  const handleDeleteHealth = (id: string) => {
    setConfirmDelete({
      isOpen: true,
      title: "Supprimer la fiche santé",
      message: "Voulez-vous vraiment supprimer cette fiche ?",
      onConfirm: async () => {
        await db.healthIssues.delete(id);
        if (selectedHealthId === id) setSelectedHealthId(null);
      }
    });
  };

  const handleAddVariety = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarietyName.trim() || (!selectedVeg?.configId && !selectedVeg?.encyclopediaId)) return;

    await db.config.add({
      id: uuidv4(),
      type: "variety",
      value: newVarietyName.trim(),
      parentId: selectedVeg.configId || selectedVeg.encyclopediaId
    });
    setNewVarietyName("");
  };

  const handleDeleteVariety = (id: string) => {
    setConfirmDelete({
      isOpen: true,
      title: "Supprimer la variété",
      message: "Supprimer cette variété ?",
      onConfirm: async () => {
        await db.config.delete(id);
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
              o.value?.toLowerCase().trim() === part?.toLowerCase().trim()
            );
            if (!existingOption) {
              await db.config.add({
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

    await db.config.update(editingVarietyId, { value: varietyEditForm.name, attributes: varietyEditForm.attributes });
    setEditingVarietyId(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar List */}
        <div className={`lg:col-span-4 space-y-4 ${(selectedVegId || selectedHealthId || isEditing) ? "hidden lg:block" : "block"}`}>
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

            <button
              onClick={() => activeTab === "vegetables" ? handleStartEdit() : handleStartHealthEdit()}
              className={`w-full py-2 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-sm ${
                activeTab === "vegetables" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
              }`}
            >
              <Plus className="w-4 h-4" />
              {activeTab === "vegetables" ? "Ajouter une plante" : "Ajouter une fiche santé"}
            </button>

            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {activeTab === "vegetables" ? (
                filteredPlants.map(item => (
                  <button
                    key={item.key || `plant-${item.id}`}
                    onClick={() => { setSelectedVegId(item.id); setIsEditing(false); setPlantSubTab("culture"); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between group ${
                      selectedVegId === item.id ? "bg-emerald-50 text-emerald-700 font-medium" : "text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-stone-400 group-hover:text-emerald-500">{item.category}</span>
                  </button>
                ))
              ) : (
                filteredHealth.map(item => (
                  <button
                    key={`health-${item.id}`}
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
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                    <label className="text-xs font-bold text-stone-500 uppercase">Catégorie</label>
                    <select
                      value={editForm.category}
                      onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">Sélectionner</option>
                      {config?.filter(c => c.type === 'category').map(c => (
                        <option key={`cat-opt-${c.id}`} value={c.value}>{c.value}</option>
                      ))}
                      {editForm.category && !config?.find(c => c.type === 'category' && c.value === editForm.category) && (
                        <option value={editForm.category}>{editForm.category}</option>
                      )}
                    </select>
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
                    <label className="text-xs font-bold text-stone-500 uppercase">Espacement</label>
                    <input
                      type="text"
                      placeholder="ex: 40 x 50 cm"
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
                          setEditForm({ ...editForm, color: getDistinctColor(existingColors) });
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
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-500 uppercase">Icône (Emoji)</label>
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
                    <input
                      type="text"
                      value={editForm.icon || 'Sprout'}
                      onChange={e => setEditForm({ ...editForm, icon: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
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
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200/60 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                    <div className="flex gap-2 relative z-10">
                      <button
                        type="button"
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
                              <span key={`good-${selectedVeg.id}-${i}`} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
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
                              <span key={`bad-${selectedVeg.id}-${i}`} className="px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-medium border border-rose-100">
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
                        <form onSubmit={handleAddVariety} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Ajouter une variété (ex: Marmande)"
                            value={newVarietyName}
                            onChange={(e) => setNewVarietyName(e.target.value)}
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
                        </form>

                        <div className="space-y-2">
                          {plantVarieties.length === 0 ? (
                            <p className="text-sm text-stone-500 italic text-center py-4">Aucune variété enregistrée pour cette plante.</p>
                          ) : (
                            plantVarieties.map(variety => (
                              <div key={variety.id} className="bg-stone-50 rounded-xl border border-stone-100 overflow-hidden">
                                {editingVarietyId === variety.id ? (
                                  <form onSubmit={handleSaveVariety} className="p-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="md:col-span-2">
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
                                        const isEmoji = attrType.value?.toLowerCase().includes('emoji');

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
                                                            key={`${cat.id}-${emoji}`}
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
                                              <div className="space-y-2">
                                                {options.length > 0 && (
                                                  <div className="flex flex-wrap gap-1">
                                                    {options.map(opt => {
                                                      const currentValue = varietyEditForm.attributes[attrType.id] || '';
                                                      const currentOptions = currentValue.split(',').map((s: string) => s.trim()).filter(Boolean);
                                                      const isSelected = currentOptions.includes(opt.value);
                                                      return (
                                                        <button
                                                          key={`var-opt-${opt.id}`}
                                                          type="button"
                                                          onClick={() => {
                                                            const nextValue = isSelected 
                                                              ? currentOptions.filter((o: string) => o !== opt.value).join(', ')
                                                              : [...currentOptions, opt.value].join(', ');
                                                            setVarietyEditForm(prev => ({
                                                              ...prev,
                                                              attributes: { ...prev.attributes, [attrType.id]: nextValue }
                                                            }));
                                                          }}
                                                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                                            isSelected 
                                                              ? 'bg-emerald-600 text-white' 
                                                              : 'bg-white text-stone-600 border border-stone-200 hover:border-emerald-300'
                                                          }`}
                                                        >
                                                          {opt.value}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                                <input
                                                  type="text"
                                                  value={varietyEditForm.attributes[attrType.id] || ''}
                                                  onChange={e => setVarietyEditForm(prev => ({
                                                    ...prev,
                                                    attributes: { ...prev.attributes, [attrType.id]: e.target.value }
                                                  }))}
                                                  placeholder={`Saisir des options...`}
                                                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
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
                                  <div className="flex items-center justify-between p-3">
                                    <div>
                                      <span className="text-sm font-medium text-stone-700 block">{variety.value}</span>
                                      {variety.attributes && Object.keys(variety.attributes).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {Object.entries(variety.attributes).map(([key, val]) => {
                                            const attrType = varietyAttrTypes.find(t => t.id === key);
                                            if (!attrType || !val) return null;
                                            const isColor = attrType.value?.toLowerCase().includes('couleur');
                                            const isEmoji = attrType.value?.toLowerCase().includes('emoji');
                                            
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
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          setEditingVarietyId(variety.id);
                                          setVarietyEditForm({ name: variety.value, attributes: variety.attributes || {} });
                                        }}
                                        className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteVariety(variety.id)}
                                        className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
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
                    <div className="flex gap-2 relative z-10">
                      <button
                        type="button"
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
                          <span key={`sol-${selectedHealth.id}-${i}`} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100">
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
                          <span key={`aff-${selectedHealth.id}-${i}`} className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-medium border border-stone-200">
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

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDelete.onConfirm}
        title={confirmDelete.title}
        message={confirmDelete.message}
        isDanger={true}
      />
    </div>
  );
}
