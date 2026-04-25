import { useFirebaseData, fb } from '../hooks/useFirebaseData';
import React, { useState, useMemo } from 'react';
import { db, HarvestEvent, Seedling } from '../db';
import { HarvestStats } from './HarvestStats';
import { Plus, Search, Calendar, Scale, Sprout, Edit2, Trash2, Leaf } from 'lucide-react';
import { Modal, ConfirmModal } from '../components/Modals';
import { v4 as uuidv4 } from 'uuid';

function GlobalHarvestModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [selectedSeedlingId, setSelectedSeedlingId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [notes, setNotes] = useState('');

  const { data: rawSeedlings } = useFirebaseData<any>('seedlings');
  const seedlings = (rawSeedlings || []).filter(s => !s.isDeleted && !s.isArchived);

  React.useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setQuantity('');
      setUnit('kg');
      setNotes('');
      setSelectedSeedlingId('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeedlingId || !quantity || isNaN(Number(quantity))) return;
    
    const seedling = await db.seedlings.get(selectedSeedlingId);
    if (seedling) {
      const newHarvest = {
        id: uuidv4(),
        date,
        quantity: Number(quantity),
        unit,
        notes
      };
      
      const harvests = seedling.harvests ? [...seedling.harvests, newHarvest] : [newHarvest];
      await fb.update('seedlings', selectedSeedlingId, { harvests });
    }
    
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Saisir une récolte">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Culture</label>
          <select 
            value={selectedSeedlingId}
            onChange={e => setSelectedSeedlingId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-stone-50"
            required
          >
            <option value="" disabled>Sélectionnez une culture...</option>
            {seedlings?.sort((a, b) => a.vegetable.localeCompare(b.vegetable)).map(s => (
              <option key={s.id} value={s.id}>
                {s.vegetable} {s.variety ? `- ${s.variety}` : ''} {s.state === 'Mise en terre' ? '(En terre)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Date</label>
          <input 
            type="date" 
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Quantité</label>
            <input 
              type="number" 
              step="0.01"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Unité</label>
            <select 
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-stone-50"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="pièces">pièces</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Notes (Optionnel)</label>
          <input 
            type="text" 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Qualité, particularités..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!selectedSeedlingId || !quantity}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function HarvestsView() {
  const [activeTab, setActiveTab] = useState<'log' | 'stats'>('log');
  const [isNewHarvestOpen, setIsNewHarvestOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVegetable, setFilterVegetable] = useState<string>('all');
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, isDanger?: boolean}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const { data: rawSeedlings, error } = useFirebaseData<any>('seedlings');
  const seedlings = (rawSeedlings || []).filter(s => !s.isDeleted);

  // Flatten all harvests
  const allHarvests = useMemo(() => {
    if (!seedlings) return [];
    const h: { harvest: HarvestEvent, seedling: Seedling }[] = [];
    seedlings.forEach(s => {
      s.harvests?.forEach(harvest => {
        h.push({ harvest, seedling: s });
      });
    });
    return h.sort((a, b) => new Date(b.harvest.date).getTime() - new Date(a.harvest.date).getTime());
  }, [seedlings]);

  const harvestedVegetables = useMemo(() => {
    const vegs = new Set<string>();
    allHarvests.forEach(h => vegs.add(h.seedling.vegetable));
    return Array.from(vegs).sort();
  }, [allHarvests]);

  const filteredHarvests = useMemo(() => {
    return allHarvests.filter(h => {
      const matchesVegetable = filterVegetable === 'all' || h.seedling.vegetable === filterVegetable;
      const searchStr = `${h.seedling.vegetable} ${h.seedling.variety || ''} ${h.harvest.notes || ''}`.toLowerCase();
      return matchesVegetable && searchStr.includes(searchTerm.toLowerCase());
    });
  }, [allHarvests, searchTerm, filterVegetable]);
  
  const totalVolume = useMemo(() => {
    return filteredHarvests.reduce((acc, { harvest }) => {
      if (harvest.unit === 'kg') return acc + harvest.quantity;
      if (harvest.unit === 'g') return acc + (harvest.quantity / 1000);
      return acc;
    }, 0);
  }, [filteredHarvests]);

  const handleDeleteHarvest = (seedlingId: string, harvestId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Supprimer la récolte',
      message: 'Êtes-vous sûr de vouloir supprimer cette récolte ?',
      isDanger: true,
      onConfirm: async () => {
        const seedling = await db.seedlings.get(seedlingId);
        if (seedling) {
          const harvests = seedling.harvests?.filter(h => h.id !== harvestId) || [];
          await fb.update('seedlings', seedlingId, { harvests });
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60">
        <div>
          <h1 className="text-2xl font-serif font-medium text-stone-900">Module Récoltes</h1>
          <p className="text-stone-500 text-sm">Pilotez et suivez la production de votre potager</p>
        </div>
        <button
          onClick={() => setIsNewHarvestOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Saisir une récolte</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-stone-200/60 p-1 w-full max-w-sm">
        <button
          onClick={() => setActiveTab('log')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'log' ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          Historique
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'stats' ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          Statistiques
        </button>
      </div>

      {activeTab === 'log' && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden">
          <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="font-medium text-stone-900">Registre détaillé</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <select
                value={filterVegetable}
                onChange={e => setFilterVegetable(e.target.value)}
                className="px-4 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
              >
                <option value="all">Tous les légumes</option>
                {harvestedVegetables.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input 
                  type="text" 
                  placeholder="Rechercher..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {filteredHarvests.length === 0 ? (
              <div className="p-12 text-center text-stone-500">
                <Leaf className="w-12 h-12 text-stone-200 mx-auto mb-3" />
                <p>Aucune récolte enregistrée pour le moment.</p>
                <p className="text-sm mt-1">Utilisez le bouton "Saisir une récolte" pour commencer.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-stone-600">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500 font-medium">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Culture</th>
                    <th className="px-6 py-3">Quantité</th>
                    <th className="px-6 py-3">Notes</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredHarvests.map(({ harvest, seedling }) => (
                    <tr key={harvest.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-stone-900">
                        {new Date(harvest.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-800">{seedling.vegetable}</span>
                          {seedling.variety && (
                            <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full">
                              {seedling.variety}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-600">
                        {harvest.quantity} {harvest.unit}
                      </td>
                      <td className="px-6 py-4 text-stone-500 italic max-w-xs truncate">
                        {harvest.notes || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteHarvest(seedling.id, harvest.id)}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer la récolte"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filterVegetable !== 'all' && filteredHarvests.length > 0 && (
                  <tfoot className="bg-stone-50/80 border-t border-stone-200">
                    <tr>
                      <td colSpan={2} className="px-6 py-4 font-bold text-stone-900 text-right">Total :</td>
                      <td colSpan={3} className="px-6 py-4 font-bold text-emerald-600">
                        {totalVolume.toFixed(2)} kg
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <HarvestStats />
      )}

      <GlobalHarvestModal 
        isOpen={isNewHarvestOpen} 
        onClose={() => setIsNewHarvestOpen(false)} 
      />

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText="Supprimer"
      />
    </div>
  );
}
