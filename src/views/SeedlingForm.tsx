import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Seedling } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Camera, Save, CheckCircle } from 'lucide-react';
import { stringToColor, getDistinctColor } from '../utils/colors';
import { PLANT_CATALOG } from '../catalog';

export function SeedlingForm({ setCurrentView, seedlingId, onBack }: { setCurrentView: (v: string) => void, seedlingId?: string, onBack?: () => void }) {
  const [vegetable, setVegetable] = useState('');
  const [variety, setVariety] = useState('');
  const [origin, setOrigin] = useState('Semis');
  const [dateSown, setDateSown] = useState(new Date().toISOString().split('T')[0]);
  const [action, setAction] = useState('');
  const [dateTransplanted, setDateTransplanted] = useState('');
  const [datePlanted, setDatePlanted] = useState('');
  const [state, setState] = useState('');
  const [location, setLocation] = useState('');
  const [comments, setComments] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [quantityTransplanted, setQuantityTransplanted] = useState<number | ''>('');
  const [quantityPlanted, setQuantityPlanted] = useState<number | ''>('');
  const [quantityLostSown, setQuantityLostSown] = useState<number | ''>('');
  const [quantityLostTransplanted, setQuantityLostTransplanted] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [saveSummary, setSaveSummary] = useState<{ mainId: string; message: string; details: string[] } | null>(null);

  const defaultsApplied = useRef(false);

  const config = useLiveQuery(() => db.config.toArray());
  const encyclopedia = useLiveQuery(() => db.encyclopedia.toArray());
  const existingSeedling = useLiveQuery(() => seedlingId ? db.seedlings.get(seedlingId) : undefined, [seedlingId]);

  useEffect(() => {
    if (existingSeedling) {
      setVegetable(existingSeedling.vegetable);
      setVariety(existingSeedling.variety);
      setOrigin(existingSeedling.origin || 'Semis');
      setDateSown(existingSeedling.dateSown);
      setAction(existingSeedling.action || '');
      setDateTransplanted(existingSeedling.dateTransplanted || '');
      setDatePlanted(existingSeedling.datePlanted || '');
      setState(existingSeedling.state);
      setLocation(existingSeedling.location);
      setComments(existingSeedling.comments);
      setPhoto(existingSeedling.photo);
      setQuantity(existingSeedling.quantity ?? '');
      setQuantityTransplanted(existingSeedling.quantityTransplanted ?? '');
      setQuantityPlanted(existingSeedling.quantityPlanted ?? '');
      setQuantityLostSown(existingSeedling.quantityLostSown ?? '');
      setQuantityLostTransplanted(existingSeedling.quantityLostTransplanted ?? '');
    } else if (config && !seedlingId && !defaultsApplied.current) {
      const defaultState = config.find(c => c.type === 'setting' && c.id === 'default_state')?.value;
      const defaultLocation = config.find(c => c.type === 'setting' && c.id === 'default_location')?.value;
      
      if (defaultState) {
        setState(defaultState);
      }
      if (defaultLocation) {
        setLocation(defaultLocation);
      }
      defaultsApplied.current = true;
    }
  }, [existingSeedling, config, seedlingId]);

  if (!config || !encyclopedia) return <div>Chargement...</div>;

  const catalogVegetables = PLANT_CATALOG.map(p => p.name);
  const encyclopediaVegetables = encyclopedia.map(e => e.name);
  const allVegetables = Array.from(new Set([...encyclopediaVegetables, ...catalogVegetables])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const selectedVegEntry = encyclopedia.find(e => e.name?.toLowerCase().trim() === vegetable?.toLowerCase().trim());
  const selectedVegConfig = config.find(c => c.type === 'vegetable' && c.value?.toLowerCase().trim() === vegetable?.toLowerCase().trim());
  
  const configuredVarieties = config.filter(c => {
    if (c.type !== 'variety') return false;
    
    // 1. Direct ID match
    if (c.parentId === selectedVegEntry?.id || c.parentId === selectedVegConfig?.id) return true;
    
    // 2. Name match (if parentId is actually the name of the vegetable)
    if (vegetable && c.parentId?.toLowerCase().trim() === vegetable?.toLowerCase().trim()) return true;
    
    // 3. Match via parent vegetable config item
    const parentVegConfig = config.find(v => v.id === c.parentId && v.type === 'vegetable');
    if (parentVegConfig && parentVegConfig.value?.toLowerCase().trim() === vegetable?.toLowerCase().trim()) {
      return true;
    }
    
    // 4. Match via parent encyclopedia entry
    const parentVegEnc = encyclopedia.find(e => e.id === c.parentId);
    if (parentVegEnc && parentVegEnc.name?.toLowerCase().trim() === vegetable?.toLowerCase().trim()) {
      return true;
    }
    
    return false;
  }).map(c => c.value);
  // Filter out catalog varieties as requested by the user ("je ne veux que celles que je mets")
  const allVarieties = Array.from(new Set([...configuredVarieties])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const states = config.filter(c => c.type === 'state').sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' }));
  const locations = config.filter(c => c.type === 'location').sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' }));

  const handleDateTransplantedChange = (val: string) => {
    setDateTransplanted(val);
    if (val) {
      const repiquageState = states.find(s => s.value?.toLowerCase().includes('repiquage') || s.value?.toLowerCase().includes('repiqué'));
      if (repiquageState && !datePlanted && !quantityPlanted) {
        setState(repiquageState.value);
      }
    }
  };

  const handleDatePlantedChange = (val: string) => {
    setDatePlanted(val);
    if (val) {
      const plantedState = states.find(s => s.value?.toLowerCase().includes('terre') || s.value?.toLowerCase().includes('planté') || s.value?.toLowerCase().includes('plantation'));
      if (plantedState) {
        setState(plantedState.value);
      }
    }
  };

  const handleQuantityTransplantedChange = (val: number | '') => {
    setQuantityTransplanted(val);
    if (val !== '') {
      const repiquageState = states.find(s => s.value?.toLowerCase().includes('repiquage') || s.value?.toLowerCase().includes('repiqué'));
      if (repiquageState && !datePlanted && !quantityPlanted) {
        setState(repiquageState.value);
      }
    }
  };

  const handleQuantityPlantedChange = (val: number | '') => {
    setQuantityPlanted(val);
    if (val !== '') {
      const plantedState = states.find(s => s.value?.toLowerCase().includes('terre') || s.value?.toLowerCase().includes('planté') || s.value?.toLowerCase().includes('plantation'));
      if (plantedState) {
        setState(plantedState.value);
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantityTransplanted !== '' && Number(quantityTransplanted) > 0 && !dateTransplanted) {
      setError("Veuillez indiquer une date de repiquage si vous avez saisi une quantité repiquée.");
      return;
    }
    if (state?.toLowerCase().includes('repiquage') && !dateTransplanted) {
      setError("Veuillez indiquer une date de repiquage pour l'état 'Repiquage'.");
      return;
    }
    if (quantityPlanted !== '' && Number(quantityPlanted) > 0 && !datePlanted) {
      setError("Veuillez indiquer une date de plantation si vous avez saisi une quantité plantée.");
      return;
    }
    if (state?.toLowerCase().includes('terre') && !datePlanted) {
      setError("Veuillez indiquer une date de plantation pour l'état 'Mise en terre'.");
      return;
    }

    const parsedQuantity = quantity === '' ? 0 : Number(quantity);
    const parsedTransplanted = quantityTransplanted === '' ? 0 : Number(quantityTransplanted);
    const parsedPlanted = quantityPlanted === '' ? 0 : Number(quantityPlanted);
    const parsedLostSown = quantityLostSown === '' ? 0 : Number(quantityLostSown);
    const parsedLostTransplanted = quantityLostTransplanted === '' ? 0 : Number(quantityLostTransplanted);

    if (parsedLostSown > 0 && parsedQuantity === 0) {
      setError(`Vous ne pouvez pas avoir de pertes avant repiquage si vous n'avez pas indiqué de quantité semée.`);
      return;
    }

    if (parsedQuantity > 0) {
      const effectiveTransplanted = parsedTransplanted > 0 ? parsedTransplanted : parsedPlanted;
      if (parsedLostSown + effectiveTransplanted > parsedQuantity) {
        setError(`Le nombre de plants perdus avant repiquage (${parsedLostSown}) et repiqués/plantés (${effectiveTransplanted}) ne peut pas dépasser le nombre de plants semés (${parsedQuantity}).`);
        return;
      }
    }

    if (parsedLostTransplanted > 0 && parsedTransplanted === 0) {
      setError(`Vous ne pouvez pas avoir de pertes avant plantation si vous n'avez pas indiqué de quantité repiquée.`);
      return;
    }

    if (parsedTransplanted > 0) {
      if (parsedLostTransplanted + parsedPlanted > parsedTransplanted) {
        setError(`Le nombre de plants perdus avant plantation (${parsedLostTransplanted}) et plantés (${parsedPlanted}) ne peut pas dépasser le nombre de plants repiqués (${parsedTransplanted}).`);
        return;
      }
    }

    // Add new vegetable to encyclopedia if it doesn't exist
    let currentVegetableId = encyclopedia.find(e => e.name?.toLowerCase().trim() === vegetable?.toLowerCase().trim())?.id;
    if (vegetable.trim() && !currentVegetableId) {
      currentVegetableId = uuidv4();
      const catalogItem = PLANT_CATALOG.find(p => p.name?.toLowerCase() === vegetable.trim()?.toLowerCase());
      const existingColors = encyclopedia.map(v => v.color).filter(Boolean) as string[] || [];
      await db.encyclopedia.add({
        id: currentVegetableId,
        name: vegetable.trim(),
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
        updatedAt: new Date().toISOString(),
        color: getDistinctColor(existingColors),
        icon: catalogItem ? catalogItem.emoji : 'Sprout'
      } as any);
    }

    // Add new variety to config if it doesn't exist
    if (variety.trim() && currentVegetableId) {
      const existingVariety = config.find(v => {
        if (v.type !== 'variety') return false;
        if (v.value?.toLowerCase().trim() !== variety?.toLowerCase().trim()) return false;
        
        if (v.parentId === currentVegetableId) return true;
        
        const parentVeg = config.find(c => c.id === v.parentId && c.type === 'vegetable');
        if (parentVeg && parentVeg.value?.toLowerCase().trim() === vegetable?.toLowerCase().trim()) {
          return true;
        }
        
        return false;
      });
      
      if (!existingVariety) {
        await db.config.add({
          id: uuidv4(),
          type: 'variety',
          value: variety.trim(),
          parentId: currentVegetableId
        });
      }
    }

    let finalQuantity = quantity === '' ? undefined : Number(quantity);
    let finalQuantityTransplanted = quantityTransplanted === '' ? undefined : Number(quantityTransplanted);
    let finalQuantityPlanted = quantityPlanted === '' ? undefined : Number(quantityPlanted);
    let lostSown = quantityLostSown === '' ? 0 : Number(quantityLostSown);
    let lostTransplanted = quantityLostTransplanted === '' ? 0 : Number(quantityLostTransplanted);

    const initialLostSown = lostSown;
    const initialLostTransplanted = lostTransplanted;
    let isTotalLoss = false;

    const baseSeedling = {
      id: seedlingId || uuidv4(),
      vegetable,
      variety,
      origin,
      dateSown,
      action,
      dateTransplanted: dateTransplanted || undefined,
      datePlanted: datePlanted || undefined,
      state,
      location,
      comments,
      photo,
      isArchived: existingSeedling?.isArchived || false,
      isDeleted: false,
      notes: existingSeedling?.notes || [],
      success: existingSeedling?.success,
      failureReason: existingSeedling?.failureReason,
      zoneId: existingSeedling?.zoneId,
      positions: existingSeedling?.positions,
    };

    const seedlingsToAdd: Seedling[] = [];

    // Check if it's a total loss at sown stage
    if (lostSown > 0 && finalQuantity !== undefined && lostSown >= finalQuantity) {
      baseSeedling.isArchived = true;
      baseSeedling.success = false;
      baseSeedling.failureReason = 'Perte avant repiquage';
      lostSown = 0;
      isTotalLoss = true;
    } 
    // Partial loss at sown stage
    else if (lostSown > 0) {
      seedlingsToAdd.push({
        ...baseSeedling,
        id: uuidv4(),
        quantity: lostSown,
        quantityTransplanted: undefined,
        quantityPlanted: undefined,
        quantityLostSown: undefined,
        quantityLostTransplanted: undefined,
        isArchived: true,
        success: false,
        failureReason: 'Perte avant repiquage',
        notes: [{
          id: uuidv4(),
          date: new Date().toISOString(),
          text: `Lot scindé depuis le lot d'origine suite à une perte de ${lostSown} plants.`,
        }]
      });
      if (finalQuantity !== undefined) {
        finalQuantity = Math.max(0, finalQuantity - lostSown);
      }
      lostSown = 0;
    }

    // Check if it's a total loss at transplanted stage
    if (lostTransplanted > 0 && finalQuantity !== undefined && lostTransplanted >= finalQuantity) {
      baseSeedling.isArchived = true;
      baseSeedling.success = false;
      baseSeedling.failureReason = 'Perte avant plantation';
      lostTransplanted = 0;
      isTotalLoss = true;
    }
    // Partial loss at transplanted stage
    else if (lostTransplanted > 0) {
      seedlingsToAdd.push({
        ...baseSeedling,
        id: uuidv4(),
        quantity: lostTransplanted,
        quantityTransplanted: lostTransplanted,
        quantityPlanted: undefined,
        quantityLostSown: undefined,
        quantityLostTransplanted: undefined,
        isArchived: true,
        success: false,
        failureReason: 'Perte avant plantation',
        notes: [{
          id: uuidv4(),
          date: new Date().toISOString(),
          text: `Lot scindé depuis le lot d'origine suite à une perte de ${lostTransplanted} plants.`,
        }]
      });
      if (finalQuantity !== undefined) {
        finalQuantity = Math.max(0, finalQuantity - lostTransplanted);
      }
      if (finalQuantityTransplanted !== undefined) {
        finalQuantityTransplanted = Math.max(0, finalQuantityTransplanted - lostTransplanted);
      }
      lostTransplanted = 0;
    }

    const mainSeedling: Seedling = {
      ...baseSeedling,
      quantity: finalQuantity,
      quantityTransplanted: finalQuantityTransplanted,
      quantityPlanted: finalQuantityPlanted,
      quantityLostSown: lostSown > 0 ? lostSown : undefined,
      quantityLostTransplanted: lostTransplanted > 0 ? lostTransplanted : undefined,
    };

    if (seedlingId) {
      await db.seedlings.put(mainSeedling);
    } else {
      await db.seedlings.add(mainSeedling);
    }

    for (const s of seedlingsToAdd) {
      await db.seedlings.add(s);
    }
    
    const details: string[] = [];
    
    if (isTotalLoss) {
      details.push(`La totalité du lot a été perdue et la fiche a été archivée comme échec.`);
    } else {
      if (initialLostSown > 0 && seedlingsToAdd.some(s => s.failureReason === 'Perte avant repiquage')) {
        details.push(`${initialLostSown} plant(s) perdu(s) avant repiquage séparé(s) et archivé(s) comme échec.`);
      }
      if (initialLostTransplanted > 0 && seedlingsToAdd.some(s => s.failureReason === 'Perte avant plantation')) {
        details.push(`${initialLostTransplanted} plant(s) perdu(s) avant plantation séparé(s) et archivé(s) comme échec.`);
      }
    }

    if (details.length > 0) {
      setSaveSummary({
        mainId: mainSeedling.id,
        message: 'Modifications enregistrées avec succès.',
        details
      });
    } else {
      // Si pas de séparation complexe, on redirige vers la fiche détaillée pour confirmer l'action visuellement
      setCurrentView(`seedling-detail-${mainSeedling.id}`);
    }
  };

  if (saveSummary) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-serif font-medium text-stone-900">{saveSummary.message}</h2>
          <div className="text-sm text-stone-600 bg-stone-50 p-4 rounded-xl text-left space-y-2">
            {saveSummary.details.map((detail, i) => (
              <p key={i} className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>{detail}</span>
              </p>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => setCurrentView(`seedling-detail-${saveSummary.mainId}`)}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            Voir la fiche mise à jour
          </button>
          <button
            onClick={() => onBack ? onBack() : setCurrentView('seedlings')}
            className="w-full py-2.5 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-1.5">
      <header className="flex items-center gap-1.5">
        <button 
          onClick={() => onBack ? onBack() : setCurrentView('seedlings')}
          className="p-1 hover:bg-stone-200 rounded-full transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <h1 className="text-base font-serif font-medium text-stone-900">
          {seedlingId ? 'Modifier le semis' : 'Ajouter un semis'}
        </h1>
      </header>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white p-2.5 rounded-xl shadow-sm border border-stone-200/60 space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-x-2 gap-y-1.5">
          
          {/* Row 1: Légume, Variété */}
          <div className="space-y-1 md:col-span-3">
            <label className="block text-[11px] font-medium text-stone-700">Légume *</label>
            <input 
              list="vegetable-list"
              required
              value={vegetable} 
              onChange={e => setVegetable(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              placeholder="Sélectionner ou saisir"
            />
            <datalist id="vegetable-list">
              {allVegetables.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>

          <div className="space-y-1 md:col-span-3">
            <label className="block text-[11px] font-medium text-stone-700">Variété (optionnel)</label>
            <input 
              list="variety-list"
              value={variety} 
              onChange={e => setVariety(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              placeholder="Sélectionner ou saisir"
            />
            <datalist id="variety-list">
              {allVarieties.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>

          {/* Row 1.5: Origine */}
          <div className="space-y-1 md:col-span-6">
            <label className="block text-[11px] font-medium text-stone-700">Méthode de multiplication (Origine) *</label>
            <select 
              required
              value={origin} 
              onChange={e => setOrigin(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="Semis">Semis (Graine)</option>
              <option value="Bouturage">Bouturage</option>
              <option value="Marcottage">Marcottage</option>
              <option value="Division">Division</option>
              <option value="Achat">Achat de plant</option>
            </select>
          </div>

          {/* Row 2: État, Emplacement */}
          <div className="space-y-1 md:col-span-3">
            <label className="block text-[11px] font-medium text-stone-700">État actuel *</label>
            <select 
              required
              value={state} 
              onChange={e => setState(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="">Sélectionner</option>
              {states.map(s => <option key={s.id} value={s.value}>{s.value}</option>)}
              {state && !states.find(s => s.value === state) && (
                <option value={state}>{state}</option>
              )}
            </select>
          </div>

          <div className="space-y-1 md:col-span-3">
            <label className="block text-[11px] font-medium text-stone-700">Emplacement *</label>
            <select 
              required
              value={location} 
              onChange={e => setLocation(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="">Sélectionner</option>
              {locations.map(l => <option key={l.id} value={l.value}>{l.value}</option>)}
            </select>
          </div>

          {/* Row 3: Dates */}
          <div className="space-y-1 md:col-span-2">
            <label className="block text-[11px] font-medium text-stone-700">Date de démarrage *</label>
            <input 
              type="date" 
              required
              value={dateSown}
              onChange={e => setDateSown(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-[11px] font-medium text-stone-700">Date repiquage</label>
            <input 
              type="date" 
              value={dateTransplanted}
              onChange={e => handleDateTransplantedChange(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-[11px] font-medium text-stone-700">Date plantation</label>
            <input 
              type="date" 
              value={datePlanted}
              onChange={e => handleDatePlantedChange(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Row 4: Quantities */}
          <div className="space-y-1 md:col-span-2">
            <label className="block text-[11px] font-medium text-stone-700">Qté semée (optionnel)</label>
            <input 
              type="number" 
              min="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 10"
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-[11px] font-medium text-stone-700">Qté repiquée (optionnel)</label>
            <input 
              type="number" 
              min="0"
              value={quantityTransplanted}
              onChange={e => handleQuantityTransplantedChange(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 8"
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-[11px] font-medium text-stone-700">Qté plantée (optionnel)</label>
            <input 
              type="number" 
              min="0"
              value={quantityPlanted}
              onChange={e => handleQuantityPlantedChange(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 5"
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Row 4.5: Lost Quantities */}
          <div className="space-y-1 md:col-span-3">
            <label className="block text-[11px] font-medium text-stone-700">Pertes (avant repiquage)</label>
            <input 
              type="number" 
              min="0"
              value={quantityLostSown}
              onChange={e => setQuantityLostSown(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 2"
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>

          <div className="space-y-1 md:col-span-3">
            <label className="block text-[11px] font-medium text-stone-700">Pertes (avant plantation)</label>
            <input 
              type="number" 
              min="0"
              value={quantityLostTransplanted}
              onChange={e => setQuantityLostTransplanted(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 1"
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-red-500 outline-none"
            />
          </div>

          {/* Row 5: Action & Comments */}
          <div className="space-y-1 md:col-span-3">
            <label className="block text-[11px] font-medium text-stone-700">Action</label>
            <input 
              type="text"
              value={action}
              onChange={e => setAction(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Ex: Semis en godets..."
            />
          </div>

          <div className="space-y-1 md:col-span-3">
            <label className="block text-[11px] font-medium text-stone-700">Commentaires</label>
            <input 
              type="text"
              value={comments}
              onChange={e => setComments(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded-md border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Notes initiales..."
            />
          </div>

          {/* Row 6: Photo */}
          <div className="space-y-1 md:col-span-6 flex items-center gap-3 mt-1">
            <label className="block text-[11px] font-medium text-stone-700 w-12">Photo</label>
            {photo && (
              <img src={photo} alt="Aperçu" className="w-8 h-8 object-cover rounded-md border border-stone-200" />
            )}
            <label className="flex items-center justify-center gap-1.5 px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs rounded-md cursor-pointer transition-colors border border-stone-200 border-dashed">
              <Camera className="w-3.5 h-3.5" />
              <span>{photo ? 'Changer' : 'Ajouter'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
            {photo && (
              <button type="button" onClick={() => setPhoto(undefined)} className="text-red-500 text-[11px] hover:underline">
                Supprimer
              </button>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
          <button 
            type="button"
            onClick={() => onBack ? onBack() : setCurrentView('seedlings')}
            className="px-3 py-1 rounded-md text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
          >
            Annuler
          </button>
          <button 
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1 rounded-md text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
