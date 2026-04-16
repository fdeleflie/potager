import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Note, Seedling, HarvestEvent } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Edit, Archive, Trash2, Plus, Camera, CheckCircle2, XCircle, Printer, Split, ShoppingBag, BookOpen } from 'lucide-react';
import { ConfirmModal, PromptModal, SellModal, HarvestModal, AlertModal } from '../components/Modals';
import { getSeedlingDisplayPhoto } from '../utils/seedling';

import { printElement } from '../utils/print';

export function SeedlingDetail({ setCurrentView, seedlingId, onBack }: { setCurrentView: (v: string) => void, seedlingId: string, onBack?: () => void }) {
  const seedling = useLiveQuery(() => db.seedlings.get(seedlingId), [seedlingId]);
  const varieties = useLiveQuery(() => db.config.where('type').equals('variety').toArray());
  const vegetables = useLiveQuery(() => db.config.where('type').equals('vegetable').toArray());
  const encyclopedia = useLiveQuery(() => db.encyclopedia.toArray());
  const varietyAttrTypes = useLiveQuery(() => db.config.where('type').equals('variety_attr_type').toArray());
  
  const varietyConfig = varieties?.find(v => {
    if (v.value !== seedling?.variety) return false;
    
    const vegEnc = encyclopedia?.find(e => e.name?.toLowerCase().trim() === seedling?.vegetable?.toLowerCase().trim());
    const vegConfig = vegetables?.find(c => c.value?.toLowerCase().trim() === seedling?.vegetable?.toLowerCase().trim());
    
    // 1. Direct ID match
    if (v.parentId === vegEnc?.id || v.parentId === vegConfig?.id) return true;
    
    // 2. Name match
    if (seedling?.vegetable && v.parentId?.toLowerCase().trim() === seedling.vegetable?.toLowerCase().trim()) return true;
    
    // 3. Match via parent vegetable config item
    const parentVegConfig = vegetables?.find(c => c.id === v.parentId);
    if (parentVegConfig && parentVegConfig.value?.toLowerCase().trim() === seedling?.vegetable?.toLowerCase().trim()) {
      return true;
    }
    
    // 4. Match via parent encyclopedia entry
    const parentVegEnc = encyclopedia?.find(e => e.id === v.parentId);
    if (parentVegEnc && parentVegEnc.name?.toLowerCase().trim() === seedling?.vegetable?.toLowerCase().trim()) {
      return true;
    }
    
    return false;
  });
  const varietyAttrs = varietyConfig?.attributes;
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePhotos, setNewNotePhotos] = useState<string[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showVarietyModal, setShowVarietyModal] = useState(false);
  const [filterDate, setFilterDate] = useState<'all' | 'year' | 'month' | 'day'>('all');

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onSubmit: (value: string) => void;
  }>({ isOpen: false, title: '', message: '', onSubmit: () => {} });

  const [splitBatchState, setSplitBatchState] = useState<{
    isOpen: boolean;
  }>({ isOpen: false });

  const [splitQuantity, setSplitQuantity] = useState<number | ''>('');

  const [sellModalState, setSellModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    maxQuantity: number;
    onSubmit: (data: { quantity: number, price?: number, comment?: string }) => void;
  }>({ isOpen: false, title: '', message: '', maxQuantity: 1, onSubmit: () => {} });

  const [harvestModalState, setHarvestModalState] = useState<{
    isOpen: boolean;
    onSubmit: (data: { date: string, quantity: number, unit: string, notes: string }) => void;
  }>({ isOpen: false, onSubmit: () => {} });

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });

  const handleSplitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedling || splitQuantity === '' || splitQuantity <= 0) return;

    const currentTotal = seedling.quantity || 0;
    if (splitQuantity >= currentTotal) {
      setAlertState({
        isOpen: true,
        title: "Quantité invalide",
        message: "La quantité à extraire doit être inférieure à la quantité totale du lot."
      });
      return;
    }

    const newSeedlingId = uuidv4();
    
    // Create new seedling
    const newSeedling: Seedling = {
      ...seedling,
      id: newSeedlingId,
      quantity: splitQuantity,
      quantityTransplanted: seedling.quantityTransplanted ? splitQuantity : undefined,
      quantityPlanted: seedling.quantityPlanted ? splitQuantity : undefined,
      quantityLostSown: undefined, // Losses stay with the original batch
      quantityLostTransplanted: undefined,
      positions: [], // Reset positions for the new batch
      harvests: [], // Reset harvests for the new batch
    };

    // Update old seedling
    const updatedOldSeedling = {
      ...seedling,
      quantity: Math.max(0, currentTotal - splitQuantity),
      quantityTransplanted: seedling.quantityTransplanted ? Math.max(0, seedling.quantityTransplanted - splitQuantity) : undefined,
      quantityPlanted: seedling.quantityPlanted ? Math.max(0, seedling.quantityPlanted - splitQuantity) : undefined,
    };

    await db.seedlings.put(newSeedling);
    await db.seedlings.put(updatedOldSeedling);

    setSplitBatchState({ isOpen: false });
    setSplitQuantity('');
    setCurrentView(`seedling-detail-${newSeedlingId}`);
  };

  if (!seedling) return <div>Chargement...</div>;

  const handleAddHarvest = async (data: { date: string, quantity: number, unit: string, notes: string }) => {
    const newHarvest: HarvestEvent = {
      id: uuidv4(),
      date: data.date,
      quantity: data.quantity,
      unit: data.unit,
      notes: data.notes
    };

    await db.seedlings.update(seedlingId, {
      harvests: [...(seedling.harvests || []), newHarvest]
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!newNoteText.trim() && newNotePhotos.length === 0) return;

    const newNote: Note = {
      id: uuidv4(),
      date: new Date().toISOString(),
      text: newNoteText,
      photos: newNotePhotos,
    };

    await db.seedlings.update(seedlingId, {
      notes: [...seedling.notes, newNote]
    });

    setNewNoteText('');
    setNewNotePhotos([]);
    setShowNoteForm(false);
  };

  const handleArchive = async () => {
    await db.seedlings.update(seedlingId, { isArchived: !seedling.isArchived });
  };

  const handleDelete = async () => {
    setConfirmState({
      isOpen: true,
      title: 'Mettre à la corbeille',
      message: 'Voulez-vous vraiment mettre ce semis à la corbeille ?',
      isDanger: true,
      onConfirm: async () => {
        await db.seedlings.update(seedlingId, { isDeleted: true });
        setCurrentView('seedlings');
      }
    });
  };

  const handleSuccess = async (success: boolean) => {
    if (success) {
      await db.seedlings.update(seedlingId, { 
        success, 
        failureReason: undefined,
        isArchived: true
      });
    } else {
      setPromptState({
        isOpen: true,
        title: "Bilan d'échec",
        message: "Quelle est la raison de l'échec ?",
        onSubmit: async (reason) => {
          await db.seedlings.update(seedlingId, { 
            success, 
            failureReason: reason || undefined,
            isArchived: true
          });
        }
      });
    }
  };

  const getRemainingToTransplant = (s: Seedling) => {
    if (s.isArchived) return 0;
    const sown = Number(s.quantity) || 0;
    const lost = Number(s.quantityLostSown) || 0;
    
    if (s.quantityTransplanted === undefined && s.quantityPlanted !== undefined) {
      const planted = Number(s.quantityPlanted) || 0;
      return Math.max(0, sown - planted - lost);
    }
    
    const trans = Number(s.quantityTransplanted) || 0;
    return Math.max(0, sown - trans - lost);
  };

  const getRemainingToPlant = (s: Seedling) => {
    if (s.isArchived) return 0;
    const trans = Number(s.quantityTransplanted) || 0;
    const planted = Number(s.quantityPlanted) || 0;
    const lost = Number(s.quantityLostTransplanted) || 0;
    return Math.max(0, trans - planted - lost);
  };

  const handleCancelRemaining = async (stage: 'sown' | 'transplanted') => {
    setConfirmState({
      isOpen: true,
      title: 'Marquer le reste comme perdu',
      message: `Voulez-vous marquer les plants non ${stage === 'sown' ? 'repiqués' : 'plantés'} comme perdus ? Ils seront comptabilisés comme échecs dans les statistiques.`,
      onConfirm: async () => {
        if (stage === 'sown') {
          const lost = getRemainingToTransplant(seedling!);
          await db.seedlings.update(seedlingId, {
            quantityLostSown: (seedling!.quantityLostSown || 0) + lost
          });
        } else {
          const lost = getRemainingToPlant(seedling!);
          await db.seedlings.update(seedlingId, {
            quantityLostTransplanted: (seedling!.quantityLostTransplanted || 0) + lost
          });
        }
      }
    });
  };

  const handleSplitAndArchiveLost = async (stage: 'sown' | 'transplanted') => {
    const lostQty = stage === 'sown' ? (seedling.quantityLostSown || 0) : (seedling.quantityLostTransplanted || 0);
    if (lostQty <= 0) return;

    const totalRemaining = getRemainingToTransplant(seedling) + getRemainingToPlant(seedling) + (seedling.quantityPlanted || 0);
    const otherLosses = stage === 'sown' ? (seedling.quantityLostTransplanted || 0) : (seedling.quantityLostSown || 0);

    // If the lost quantity is all that's left, no need to split, just archive the whole lot.
    if (totalRemaining === 0 && otherLosses === 0) {
      setConfirmState({
        isOpen: true,
        title: 'Archiver comme échec',
        message: `La totalité des plants restants de ce lot est perdue (${lostQty}). Voulez-vous archiver cette fiche comme échec ?`,
        onConfirm: async () => {
          await db.seedlings.update(seedlingId, {
            isArchived: true,
            success: false,
            failureReason: stage === 'sown' ? 'Perte avant repiquage' : 'Perte avant plantation',
            quantityLostSown: undefined,
            quantityLostTransplanted: undefined
          });
        }
      });
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Archiver les pertes',
      message: `Voulez-vous extraire ces ${lostQty} plants perdus vers une nouvelle fiche archivée (échec) ?`,
      onConfirm: async () => {
        const newSeedling: Seedling = {
          ...seedling,
          id: uuidv4(),
          quantity: lostQty,
          quantityTransplanted: stage === 'transplanted' ? lostQty : undefined,
          quantityPlanted: undefined,
          quantityLostSown: undefined,
          quantityLostTransplanted: undefined,
          isArchived: true,
          success: false,
          failureReason: stage === 'sown' ? 'Perte avant repiquage' : 'Perte avant plantation',
          harvests: [],
          notes: [{
            id: uuidv4(),
            date: new Date().toISOString(),
            text: `Lot scindé depuis le lot d'origine suite à une perte de ${lostQty} plants.`,
          }]
        };

        await db.seedlings.add(newSeedling);
        
        if (stage === 'sown') {
          const updates: any = { quantityLostSown: 0 };
          if (seedling.quantity !== undefined) {
            let finalQty = Math.max(0, seedling.quantity - lostQty);
            if (seedling.quantityTransplanted !== undefined && finalQty < seedling.quantityTransplanted) finalQty = seedling.quantityTransplanted;
            if (seedling.quantityPlanted !== undefined && finalQty < seedling.quantityPlanted) finalQty = seedling.quantityPlanted;
            updates.quantity = finalQty;
          }

          await db.seedlings.update(seedlingId, updates);
        } else {
          const updates: any = { quantityLostTransplanted: 0 };
          
          let finalQty = seedling.quantity !== undefined ? Math.max(0, seedling.quantity - lostQty) : undefined;
          let finalTransplanted = seedling.quantityTransplanted !== undefined ? Math.max(0, seedling.quantityTransplanted - lostQty) : undefined;

          if (finalTransplanted !== undefined && finalQty !== undefined && finalQty < finalTransplanted) finalQty = finalTransplanted;
          if (seedling.quantityPlanted !== undefined && finalQty !== undefined && finalQty < seedling.quantityPlanted) finalQty = seedling.quantityPlanted;
          if (seedling.quantityPlanted !== undefined && finalTransplanted !== undefined && finalTransplanted < seedling.quantityPlanted) finalTransplanted = seedling.quantityPlanted;

          if (finalQty !== undefined) updates.quantity = finalQty;
          if (finalTransplanted !== undefined) updates.quantityTransplanted = finalTransplanted;

          await db.seedlings.update(seedlingId, updates);
        }
      }
    });
  };

  const handleSell = async (stage: 'sown' | 'transplanted' | 'planted') => {
    let available = 0;
    if (stage === 'sown') available = getRemainingToTransplant(seedling);
    if (stage === 'transplanted') available = getRemainingToPlant(seedling);
    if (stage === 'planted') available = seedling.quantityPlanted || 0;

    if (available <= 0) return;

    let stageName = stage === 'sown' ? 'semis' : stage === 'transplanted' ? 'repiqués' : 'plantés';

    setSellModalState({
      isOpen: true,
      title: 'Vendre ou Donner',
      message: `Vente ou don de plants ${stageName}.`,
      maxQuantity: available,
      onSubmit: async ({ quantity: qtyToSell, price, comment }) => {
        if (isNaN(qtyToSell) || qtyToSell <= 0 || qtyToSell > available) return;

        const actionText = price !== undefined ? `vendue (${price}€)` : 'donnée';
        const notesText = `La totalité du lot (${qtyToSell} plants) a été ${actionText}.${comment ? ` Commentaire: ${comment}` : ''}`;
        const splitNotesText = `Lot scindé depuis le lot d'origine suite à une vente/don de ${qtyToSell} plants${price !== undefined ? ` (${price}€)` : ''}.${comment ? ` Commentaire: ${comment}` : ''}`;

        const totalRemaining = getRemainingToTransplant(seedling) + getRemainingToPlant(seedling) + (seedling.quantityPlanted || 0);
        const hasUnarchivedLosses = (seedling.quantityLostSown || 0) > 0 || (seedling.quantityLostTransplanted || 0) > 0;

        if (qtyToSell === available && totalRemaining === available && !hasUnarchivedLosses) {
           await db.seedlings.update(seedlingId, {
             isArchived: true,
             success: true,
             state: 'Vendu / Donné',
             salePrice: price,
             saleComment: comment,
             notes: [...seedling.notes, {
               id: uuidv4(),
               date: new Date().toISOString(),
               text: notesText
             }]
           });
           return;
        }

        const newSeedling: Seedling = {
          ...seedling,
          id: uuidv4(),
          quantity: qtyToSell,
          quantityTransplanted: (stage === 'transplanted' || stage === 'planted') ? qtyToSell : undefined,
          quantityPlanted: stage === 'planted' ? qtyToSell : undefined,
          quantityLostSown: undefined,
          quantityLostTransplanted: undefined,
          isArchived: true,
          success: true,
          state: 'Vendu / Donné',
          salePrice: price,
          saleComment: comment,
          harvests: [],
          notes: [{
            id: uuidv4(),
            date: new Date().toISOString(),
            text: splitNotesText,
          }]
        };

        await db.seedlings.add(newSeedling);

        const updates: any = {};
        
        if (seedling.quantity !== undefined) {
          updates.quantity = Math.max(0, seedling.quantity - qtyToSell);
        }
        
        if (stage === 'transplanted' || stage === 'planted') {
          if (seedling.quantityTransplanted !== undefined) {
            updates.quantityTransplanted = Math.max(0, seedling.quantityTransplanted - qtyToSell);
          }
        }
        if (stage === 'planted') {
          if (seedling.quantityPlanted !== undefined) {
            updates.quantityPlanted = Math.max(0, seedling.quantityPlanted - qtyToSell);
          }
        }

        // Ensure data consistency if initial data was anomalous
        const newTransplanted = updates.quantityTransplanted !== undefined ? updates.quantityTransplanted : seedling.quantityTransplanted;
        const newPlanted = updates.quantityPlanted !== undefined ? updates.quantityPlanted : seedling.quantityPlanted;
        
        if (updates.quantity !== undefined) {
          if (newTransplanted !== undefined && updates.quantity < newTransplanted) {
            updates.quantity = newTransplanted;
          }
          if (newPlanted !== undefined && updates.quantity < newPlanted) {
            updates.quantity = newPlanted;
          }
        }
        
        if (updates.quantityTransplanted !== undefined) {
          if (newPlanted !== undefined && newTransplanted !== undefined && newTransplanted < newPlanted) {
            updates.quantityTransplanted = newPlanted;
          }
        }

        updates.notes = [...seedling.notes, {
          id: uuidv4(),
          date: new Date().toISOString(),
          text: `${qtyToSell} plants ont été extraits suite à une vente/don.`
        }];

        await db.seedlings.update(seedlingId, updates);
      }
    });
  };

  const handleSplit = async () => {
    const remainingSown = getRemainingToTransplant(seedling);
    const remainingTrans = getRemainingToPlant(seedling);
    const isPlanted = seedling.quantityPlanted || 0;

    let maxToSplit = 0;
    let splitContext = "";

    if (remainingSown > 0 && (remainingTrans > 0 || isPlanted > 0)) {
      // Case: Some are sown, some are more advanced
      maxToSplit = remainingTrans + isPlanted;
      splitContext = `Vous avez ${remainingSown} plants en "Semis" et ${maxToSplit} plants plus avancés. Combien de plants avancés voulez-vous extraire vers une nouvelle fiche ? (Maximum: ${maxToSplit})`;
    } else if (remainingTrans > 0 && isPlanted > 0) {
      // Case: Some are transplanted, some are planted
      maxToSplit = isPlanted;
      splitContext = `Vous avez ${remainingTrans} plants en "Repiquage" et ${isPlanted} plants en "Mise en terre". Combien de plants en terre voulez-vous extraire vers une nouvelle fiche ? (Maximum: ${maxToSplit})`;
    } else {
      // Simple case: all at the same stage
      const total = remainingSown + remainingTrans + isPlanted;
      maxToSplit = total > 1 ? total - 1 : 0;
      splitContext = `Combien de plants voulez-vous extraire de ce lot ? (Maximum: ${maxToSplit})`;
    }

    if (maxToSplit <= 0) return;

    setPromptState({
      isOpen: true,
      title: "Scinder le lot",
      message: splitContext,
      onSubmit: async (value) => {
        const qtyToMove = Number(value);
        if (isNaN(qtyToMove) || qtyToMove <= 0 || qtyToMove > maxToSplit) return;

        // Determine what we are moving
        let movingPlanted = 0;
        let movingTransplanted = 0;
        let movingSown = 0;

        if (remainingSown > 0 && (remainingTrans > 0 || isPlanted > 0)) {
          // Moving advanced plants
          movingPlanted = Math.min(qtyToMove, isPlanted);
          movingTransplanted = qtyToMove - movingPlanted;
        } else if (remainingTrans > 0 && isPlanted > 0) {
          // Moving planted plants
          movingPlanted = qtyToMove;
        } else {
          // Moving from the single stage
          if (isPlanted > 0) movingPlanted = qtyToMove;
          else if (remainingTrans > 0) movingTransplanted = qtyToMove;
          else movingSown = qtyToMove;
        }

        const newSeedling: Seedling = {
          ...seedling,
          id: uuidv4(),
          quantity: movingSown + movingTransplanted + movingPlanted,
          quantityTransplanted: (movingTransplanted + movingPlanted) > 0 ? (movingTransplanted + movingPlanted) : undefined,
          quantityPlanted: movingPlanted > 0 ? movingPlanted : undefined,
          quantityLostSown: undefined,
          quantityLostTransplanted: undefined,
          harvests: [],
          notes: [{
            id: uuidv4(),
            date: new Date().toISOString(),
            text: `Lot scindé depuis le lot d'origine (extrait ${qtyToMove} plants).`,
          }]
        };

        await db.seedlings.add(newSeedling);
        
        // Update original
        let finalQty = seedling.quantity !== undefined ? Math.max(0, seedling.quantity - qtyToMove) : undefined;
        let finalTransplanted = seedling.quantityTransplanted !== undefined ? Math.max(0, seedling.quantityTransplanted - (movingTransplanted + movingPlanted)) : undefined;
        let finalPlanted = seedling.quantityPlanted !== undefined ? Math.max(0, seedling.quantityPlanted - movingPlanted) : undefined;

        if (finalTransplanted !== undefined && finalQty !== undefined && finalQty < finalTransplanted) finalQty = finalTransplanted;
        if (finalPlanted !== undefined && finalQty !== undefined && finalQty < finalPlanted) finalQty = finalPlanted;
        if (finalPlanted !== undefined && finalTransplanted !== undefined && finalTransplanted < finalPlanted) finalTransplanted = finalPlanted;

        const updates: any = {};
        if (finalQty !== undefined) updates.quantity = finalQty;
        if (finalTransplanted !== undefined) updates.quantityTransplanted = finalTransplanted;
        if (finalPlanted !== undefined) updates.quantityPlanted = finalPlanted;

        await db.seedlings.update(seedlingId, updates);
        
        setCurrentView(`seedling-detail-${newSeedling.id}`);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="seedling-detail-print-area">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText="Confirmer"
      />
      
      <PromptModal
        isOpen={promptState.isOpen}
        onClose={() => setPromptState(prev => ({ ...prev, isOpen: false }))}
        title={promptState.title}
        message={promptState.message}
        onSubmit={promptState.onSubmit}
        placeholder="Trop d'eau, gel, maladie..."
      />

      {/* Split Batch Modal */}
      {splitBatchState.isOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center">
              <h3 className="font-serif font-medium text-lg text-stone-900">Diviser le lot</h3>
              <button onClick={() => setSplitBatchState({ isOpen: false })} className="text-stone-400 hover:text-stone-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSplitBatch} className="p-4 space-y-4">
              <p className="text-sm text-stone-600">
                Vous pouvez extraire une partie de ce lot pour créer une nouvelle fiche indépendante. 
                Pratique si vous mettez en terre seulement une partie de vos plants !
              </p>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Nombre de plants à extraire (sur {seedling.quantity || 0} au total)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={(seedling.quantity || 0) - 1}
                  value={splitQuantity}
                  onChange={e => setSplitQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: 1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSplitBatchState({ isOpen: false })}
                  className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Diviser
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variety Details Modal */}
      {showVarietyModal && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center">
              <h3 className="font-serif font-medium text-lg text-stone-900">
                {seedling.vegetable} - {seedling.variety}
              </h3>
              <button onClick={() => setShowVarietyModal(false)} className="text-stone-400 hover:text-stone-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {varietyAttrs?.description ? (
                <div className="prose prose-sm text-stone-700">
                  <p className="whitespace-pre-wrap">{varietyAttrs.description}</p>
                </div>
              ) : (
                <p className="text-sm text-stone-500 italic">
                  Aucune description complète n'a été renseignée pour cette variété. Vous pouvez l'ajouter dans la Configuration.
                </p>
              )}
              
              <div className="pt-4 border-t border-stone-100">
                <h4 className="text-sm font-medium text-stone-900 mb-3">Caractéristiques</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {varietyAttrTypes?.map(attrType => {
                    const value = varietyAttrs?.[attrType.id];
                    if (!value) return null;
                    return (
                      <div key={attrType.id}>
                        <span className="block text-[10px] font-medium text-stone-500 uppercase tracking-wider">{attrType.value}</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {typeof value === 'string' && value.includes(',') ? (
                            value.split(',').map((v: string) => (
                              <span key={v} className="px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded text-[10px] border border-stone-200">
                                {v.trim()}
                              </span>
                            ))
                          ) : (
                            <span className="text-stone-900">{value}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {varietyAttrs?.tasteRating && (
                    <div>
                      <span className="block text-[10px] font-medium text-stone-500 uppercase tracking-wider">Note gustative</span>
                      <span className="text-stone-900">{varietyAttrs.tasteRating}/10</span>
                    </div>
                  )}
                  {varietyAttrs?.isHybrid && (
                    <div>
                      <span className="block text-[10px] font-medium text-stone-500 uppercase tracking-wider">Type</span>
                      <span className="text-stone-900">Hybride F1</span>
                    </div>
                  )}
                  {varietyAttrs?.other && (
                    <div className="col-span-2">
                      <span className="block text-[10px] font-medium text-stone-500 uppercase tracking-wider">Autre</span>
                      <span className="text-stone-900">{varietyAttrs.other}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end">
              <button
                onClick={() => setShowVarietyModal(false)}
                className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onBack ? onBack() : setCurrentView('seedlings')}
            className="p-1.5 hover:bg-stone-200 rounded-full transition-colors print:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-serif font-medium text-stone-900 flex items-center gap-2">
              {seedling.vegetable} 
              <button 
                onClick={() => setShowVarietyModal(true)}
                className="text-stone-400 font-sans text-lg font-normal hover:text-emerald-600 transition-colors"
                title="Voir le descriptif complet de la variété"
              >
                | {seedling.variety}
              </button>
            </h1>
            <div className="text-stone-500 mt-0.5 flex flex-col gap-0.5 text-xs">
              {seedling.dateSown && <span>Semé le {new Date(seedling.dateSown).toLocaleDateString()}</span>}
              {seedling.action && <span className="whitespace-pre-wrap italic text-stone-400">Action : {seedling.action}</span>}
              {seedling.dateTransplanted && <span>Repiqué le {new Date(seedling.dateTransplanted).toLocaleDateString()}</span>}
              {seedling.datePlanted && <span>Mis en terre le {new Date(seedling.datePlanted).toLocaleDateString()}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!seedling.isArchived && (
            <>
              <button 
                onClick={() => setSplitBatchState({ isOpen: true })}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors print:hidden flex items-center gap-1 font-medium text-sm"
                title="Diviser ce lot"
              >
                <Split className="w-4 h-4" />
                <span className="hidden sm:inline">Diviser</span>
              </button>
              <button 
                onClick={() => {
                  const availablePlanted = seedling.quantityPlanted || 0;
                  const availableTransplanted = getRemainingToPlant(seedling);
                  const availableSown = getRemainingToTransplant(seedling);
                  
                  if (availablePlanted > 0) handleSell('planted');
                  else if (availableTransplanted > 0) handleSell('transplanted');
                  else if (availableSown > 0) handleSell('sown');
                }}
                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors print:hidden flex items-center gap-1 font-medium text-sm"
                title="Vendre ou donner"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">Vendre</span>
              </button>
            </>
          )}
          <button 
            onClick={() => setCurrentView('encyclopedia')}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors print:hidden flex items-center gap-1 font-medium text-sm"
            title="Voir dans le guide"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Guide</span>
          </button>
          <button 
            onClick={() => printElement('seedling-detail-print-area', `Fiche Semis - ${seedling.vegetable}`, 100, () => {
              setAlertState({
                isOpen: true,
                title: "Pop-ups bloqués",
                message: "Veuillez autoriser les pop-ups pour imprimer."
              });
            })}
            className="p-1.5 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors print:hidden"
            title="Imprimer la fiche"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setCurrentView(`seedling-edit-${seedling.id}`)}
            className="p-1.5 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors print:hidden"
            title="Modifier"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setHarvestModalState({ isOpen: true, onSubmit: handleAddHarvest })}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors print:hidden"
            title="Ajouter une récolte"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wheat"><path d="M2 22 22 2"/><path d="M3.4 16.2 6.2 19"/><path d="M5.5 12.7 9.8 17"/><path d="M8.4 9.8 14.1 15.5"/><path d="M12 7 18.4 13.4"/><path d="M16.2 4.9 21.2 9.9"/></svg>
          </button>
          <button 
            onClick={handleArchive}
            className={`p-1.5 rounded-lg transition-colors print:hidden ${seedling.isArchived ? 'bg-amber-100 text-amber-700' : 'text-stone-600 hover:bg-stone-200'}`}
            title={seedling.isArchived ? "Désarchiver" : "Archiver"}
          >
            <Archive className="w-4 h-4" />
          </button>
          {(seedling.quantity || 0) > 1 && (
            <button 
              onClick={handleSplit}
              className="p-1.5 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors print:hidden"
              title="Scinder le lot"
            >
              <Split className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={handleDelete}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors print:hidden"
            title="Mettre à la corbeille"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200/60 overflow-hidden">
            {(() => {
              const displayPhoto = getSeedlingDisplayPhoto(seedling as Seedling);
              return displayPhoto ? (
                <img src={displayPhoto} alt={seedling.vegetable} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-stone-100 flex items-center justify-center text-stone-400">
                  <Camera className="w-8 h-8 opacity-50" />
                </div>
              );
            })()}
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider mb-0.5">Origine</p>
                <p className="text-sm text-stone-900">{seedling.origin || 'Semis'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider mb-0.5">État actuel</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-medium text-stone-900">{seedling.state}</p>
                  {seedling.state === 'Vendu / Donné' && seedling.salePrice !== undefined && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                      {seedling.salePrice} €
                    </span>
                  )}
                </div>
                {seedling.state === 'Vendu / Donné' && seedling.saleComment && (
                  <p className="text-xs text-stone-500 mt-1 italic">"{seedling.saleComment}"</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider mb-0.5">Emplacement</p>
                <p className="text-sm text-stone-900">{seedling.location}</p>
              </div>
              {seedling.quantity !== undefined && (
                <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                  <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider mb-0.5">Semis</p>
                  <div className="flex justify-between items-end">
                    <p className="text-base font-semibold text-stone-900">{seedling.quantity} <span className="text-xs font-normal text-stone-500">au total</span></p>
                    <div className="flex flex-col items-end gap-1">
                      {seedling.quantityLostSown ? (
                        <button 
                          onClick={() => handleSplitAndArchiveLost('sown')}
                          className="text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 group/btn"
                          title="Scinder et archiver ces pertes (échec)"
                        >
                          {seedling.quantityLostSown} perdus
                          <Split className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                        </button>
                      ) : null}
                      {getRemainingToTransplant(seedling) > 0 && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleSell('sown')}
                            className="text-[10px] font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 group/btn"
                            title="Vendre ou donner ces plants"
                          >
                            Vendre
                            <ShoppingBag className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                          </button>
                          <button 
                            onClick={() => handleCancelRemaining('sown')}
                            className="text-[10px] font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 group/btn"
                            title="Marquer le reste comme perdu"
                          >
                            {getRemainingToTransplant(seedling)} reste à repiquer
                            <XCircle className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {seedling.quantityTransplanted !== undefined && (
                <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                  <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider mb-0.5">Repiquage</p>
                  <div className="flex justify-between items-end">
                    <p className="text-base font-semibold text-stone-900">{seedling.quantityTransplanted} <span className="text-xs font-normal text-stone-500">repiqués</span></p>
                    <div className="flex flex-col items-end gap-1">
                      {seedling.quantityLostTransplanted ? (
                        <button 
                          onClick={() => handleSplitAndArchiveLost('transplanted')}
                          className="text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 group/btn"
                          title="Scinder et archiver ces pertes (échec)"
                        >
                          {seedling.quantityLostTransplanted} perdus
                          <Split className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                        </button>
                      ) : null}
                      {getRemainingToPlant(seedling) > 0 && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleSell('transplanted')}
                            className="text-[10px] font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 group/btn"
                            title="Vendre ou donner ces plants"
                          >
                            Vendre
                            <ShoppingBag className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                          </button>
                          <button 
                            onClick={() => handleCancelRemaining('transplanted')}
                            className="text-[10px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 group/btn"
                            title="Marquer le reste comme perdu"
                          >
                            {getRemainingToPlant(seedling)} reste à planter
                            <XCircle className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {seedling.quantityPlanted !== undefined && (
                <div className="p-2.5 bg-blue-50/30 rounded-lg border border-blue-100/30">
                  <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider mb-0.5">Mise en terre</p>
                  <div className="flex justify-between items-end">
                    <p className="text-base font-semibold text-stone-900">{seedling.quantityPlanted} <span className="text-xs font-normal text-stone-500">plantés</span></p>
                    {!seedling.isArchived && seedling.quantityPlanted > 0 && (
                      <button 
                        onClick={() => handleSell('planted')}
                        className="text-[10px] font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 group/btn"
                        title="Vendre ou donner ces plants"
                      >
                        Vendre
                        <ShoppingBag className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {seedling.comments && (
                <div>
                  <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider mb-0.5">Commentaires initiaux</p>
                  <p className="text-stone-700 text-xs whitespace-pre-wrap">{seedling.comments}</p>
                </div>
              )}
            </div>
          </div>

          {varietyAttrs && Object.keys(varietyAttrs).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-stone-200/60 p-4 space-y-3">
              <h3 className="font-serif font-medium text-base text-stone-900">Détails de la variété</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {varietyAttrTypes?.map(attrType => {
                  const value = varietyAttrs[attrType.id];
                  if (!value) return null;
                  return (
                    <div key={attrType.id}>
                      <span className="block text-[10px] font-medium text-stone-500 uppercase tracking-wider">{attrType.value}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {typeof value === 'string' && value.includes(',') ? (
                          value.split(',').map((v: string) => (
                            <span key={v} className="px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded text-[10px] border border-stone-200">
                              {v.trim()}
                            </span>
                          ))
                        ) : (
                          <span className="text-stone-900">{value}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {varietyAttrs.tasteRating !== undefined && (
                  <div>
                    <span className="block text-[10px] font-medium text-stone-500 uppercase tracking-wider">Note gustative</span>
                    <span className="text-stone-900">{varietyAttrs.tasteRating}/10</span>
                  </div>
                )}
                {varietyAttrs.isHybrid && (
                  <div className="col-span-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                      Hybride F1
                    </span>
                  </div>
                )}
                {varietyAttrs.other && (
                  <div className="col-span-2">
                    <span className="block text-[10px] font-medium text-stone-500 uppercase tracking-wider">Autre</span>
                    <p className="text-stone-900 whitespace-pre-wrap">{varietyAttrs.other}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {seedling.isArchived && (
            <div className="bg-white rounded-xl shadow-sm border border-stone-200/60 p-4 space-y-3">
              <h3 className="font-serif font-medium text-base">Bilan de culture</h3>
              {seedling.success === undefined ? (
                <div className="flex gap-2 text-sm">
                  <button onClick={() => handleSuccess(true)} className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Succès
                  </button>
                  <button onClick={() => handleSuccess(false)} className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                    <XCircle className="w-4 h-4" /> Échec
                  </button>
                </div>
              ) : (
                <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${seedling.success ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
                  {seedling.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                  <div>
                    <p className="font-medium">{seedling.success ? 'Culture réussie' : 'Culture échouée'}</p>
                    {seedling.failureReason && <p className="text-xs mt-0.5 opacity-80">Raison : {seedling.failureReason}</p>}
                    <button onClick={() => db.seedlings.update(seedlingId, { success: undefined, failureReason: undefined })} className="text-[10px] underline mt-1 opacity-70 hover:opacity-100">Modifier le bilan</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-stone-200/60 overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
              <h2 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wheat text-emerald-600"><path d="M2 22 22 2"/><path d="M3.4 16.2 6.2 19"/><path d="M5.5 12.7 9.8 17"/><path d="M8.4 9.8 14.1 15.5"/><path d="M12 7 18.4 13.4"/><path d="M16.2 4.9 21.2 9.9"/></svg>
                Récoltes
              </h2>
              <button 
                onClick={() => setHarvestModalState({ isOpen: true, onSubmit: handleAddHarvest })}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </div>
            
            <div className="p-4">
              {(!seedling.harvests || seedling.harvests.length === 0) ? (
                <p className="text-stone-500 text-sm italic text-center py-4">Aucune récolte enregistrée.</p>
              ) : (
                <div className="space-y-3">
                  {seedling.harvests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((harvest) => (
                    <div key={harvest.id} className="flex items-start justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-stone-900">{harvest.quantity} {harvest.unit}</span>
                          <span className="text-[10px] font-medium text-stone-500 bg-stone-200/50 px-1.5 py-0.5 rounded">{new Date(harvest.date).toLocaleDateString()}</span>
                        </div>
                        {harvest.notes && <p className="text-xs text-stone-600">{harvest.notes}</p>}
                      </div>
                      <button 
                        onClick={() => {
                          setConfirmState({
                            isOpen: true,
                            title: 'Supprimer la récolte',
                            message: 'Voulez-vous vraiment supprimer cette récolte ?',
                            isDanger: true,
                            onConfirm: async () => {
                              await db.seedlings.update(seedlingId, {
                                harvests: seedling.harvests?.filter(h => h.id !== harvest.id)
                              });
                            }
                          });
                        }}
                        className="text-stone-400 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  
                  <div className="pt-3 mt-3 border-t border-stone-100 flex justify-between items-center">
                    <span className="text-xs font-medium text-stone-500 uppercase">Total récolté</span>
                    <span className="text-sm font-semibold text-emerald-700">
                      {Object.entries(seedling.harvests.reduce((acc, h) => {
                        const unit = h.unit;
                        if (!acc[unit]) acc[unit] = 0;
                        acc[unit] += h.quantity;
                        return acc;
                      }, {} as Record<string, number>)).map(([unit, qty]) => `${qty} ${unit}`).join(' + ')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-medium text-stone-900">Suivi & Notes</h2>
            <div className="flex items-center gap-2">
              <select 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value as any)}
                className="px-2 py-1.5 rounded-lg border border-stone-200 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                <option value="all">Toutes les dates</option>
                <option value="year">Par année</option>
                <option value="month">Par mois</option>
                <option value="day">Par jour</option>
              </select>
              <button 
                onClick={() => setShowNoteForm(!showNoteForm)}
                className="bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-1.5 text-xs print:hidden"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une note
              </button>
            </div>
          </div>

          {showNoteForm && (
            <form onSubmit={handleAddNote} className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 border-dashed space-y-3">
              <textarea 
                value={newNoteText}
                onChange={e => setNewNoteText(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                placeholder="Que s'est-il passé aujourd'hui ?"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 cursor-pointer transition-colors">
                    <Camera className="w-4 h-4" />
                    <span>Ajouter photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  {newNotePhotos.length > 0 && (
                    <span className="text-[10px] text-stone-500">{newNotePhotos.length} photo(s) ajoutée(s)</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowNoteForm(false)} className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
                    Annuler
                  </button>
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-colors">
                    Enregistrer la note
                  </button>
                </div>
              </div>
              {newNotePhotos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {newNotePhotos.map((photo, index) => (
                    <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0">
                      <img src={photo} alt="Aperçu" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setNewNotePhotos(prev => prev.filter((_, i) => i !== index))}
                        className="absolute top-1 right-1 p-0.5 bg-white/80 hover:bg-white rounded-full text-stone-700 shadow-sm"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </form>
          )}

          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-stone-200 before:to-transparent">
            {seedling.notes.length === 0 ? (
              <p className="text-stone-500 text-sm italic text-center py-6">Aucune note pour le moment.</p>
            ) : (
              [...seedling.notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .filter(note => {
                if (filterDate === 'all') return true;
                const d = new Date(note.date);
                const now = new Date();
                if (filterDate === 'year') return d.getFullYear() === now.getFullYear();
                if (filterDate === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                if (filterDate === 'day') return d.toDateString() === now.toDateString();
                return true;
              })
              .map((note) => (
                <div key={note.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border border-white bg-stone-200 text-stone-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                  </div>
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] bg-white p-4 rounded-xl shadow-sm border border-stone-200/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <time className="text-xs font-medium text-emerald-600">{new Date(note.date).toLocaleDateString()} à {new Date(note.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
                      <button 
                        onClick={() => {
                          setConfirmState({
                            isOpen: true,
                            title: 'Supprimer la note',
                            message: 'Voulez-vous vraiment supprimer cette note ?',
                            isDanger: true,
                            onConfirm: async () => {
                              await db.seedlings.update(seedlingId, {
                                notes: seedling.notes.filter(n => n.id !== note.id)
                              });
                            }
                          });
                        }}
                        className="text-stone-400 hover:text-red-500 transition-colors print:hidden"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {note.text && <p className="text-stone-700 text-xs whitespace-pre-wrap mb-2">{note.text}</p>}
                    {note.photos && note.photos.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {note.photos.map((photo, index) => (
                          <img key={index} src={photo} alt="Note" className="rounded-lg border border-stone-100" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <SellModal
        isOpen={sellModalState.isOpen}
        onClose={() => setSellModalState(prev => ({ ...prev, isOpen: false }))}
        onSubmit={sellModalState.onSubmit}
        title={sellModalState.title}
        message={sellModalState.message}
        maxQuantity={sellModalState.maxQuantity}
      />
      
      <HarvestModal
        isOpen={harvestModalState.isOpen}
        onClose={() => setHarvestModalState(prev => ({ ...prev, isOpen: false }))}
        onSubmit={harvestModalState.onSubmit}
      />

      <AlertModal
        isOpen={alertState.isOpen}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
      />
    </div>
  );
}
