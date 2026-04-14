import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
          <h3 className="text-lg font-medium text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">
            &times;
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirmer", cancelText = "Annuler", isDanger = false, showMergeOption = false, onMergeConfirm, mergeText = "Fusionner" }: any) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-stone-600 mb-6 whitespace-pre-wrap">{message}</p>
      <div className="flex justify-end gap-3 flex-wrap">
        <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-stone-600 hover:bg-stone-100 transition-colors">
          {cancelText}
        </button>
        {showMergeOption && onMergeConfirm && (
          <button 
            onClick={() => { onMergeConfirm(); onClose(); }} 
            className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {mergeText}
          </button>
        )}
        <button 
          onClick={() => { onConfirm(); onClose(); }} 
          className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

export function AlertModal({ isOpen, onClose, title, message }: any) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-stone-600 mb-6 whitespace-pre-wrap">{message}</p>
      <div className="flex justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
          OK
        </button>
      </div>
    </Modal>
  );
}

export function PromptModal({ isOpen, onClose, onSubmit, title, message, placeholder = "" }: any) {
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    if (isOpen) setValue("");
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-stone-600 mb-4">{message}</p>
      <input 
        type="text" 
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none mb-6"
        autoFocus
      />
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-stone-600 hover:bg-stone-100 transition-colors">
          Annuler
        </button>
        <button 
          onClick={() => { onSubmit(value); onClose(); }} 
          className="px-4 py-2 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
        >
          Valider
        </button>
      </div>
    </Modal>
  );
}

export function HarvestModal({ isOpen, onClose, onSubmit }: any) {
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = React.useState('');
  const [unit, setUnit] = React.useState('kg');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setQuantity('');
      setUnit('kg');
      setNotes('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || isNaN(Number(quantity))) return;
    onSubmit({
      date,
      quantity: Number(quantity),
      unit,
      notes
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter une récolte">
      <form onSubmit={handleSubmit} className="space-y-4">
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
        
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-stone-700 mb-1">Quantité</label>
            <input 
              type="number" 
              step="0.01"
              min="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div className="w-1/3">
            <label className="block text-sm font-medium text-stone-700 mb-1">Unité</label>
            <select 
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="pièces">pièces</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Notes (optionnel)</label>
          <input 
            type="text" 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Belle taille, un peu abîmé..."
            className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-stone-600 hover:bg-stone-100 transition-colors">
            Annuler
          </button>
          <button 
            type="submit" 
            className="px-4 py-2 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
            disabled={!quantity || isNaN(Number(quantity))}
          >
            Ajouter
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SellModal({ isOpen, onClose, onSubmit, title, message, maxQuantity }: any) {
  const [quantity, setQuantity] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      setQuantity("");
      setPrice("");
      setComment("");
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-stone-600 mb-4">{message}</p>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Quantité *</label>
          <input 
            type="number" 
            min="1"
            max={maxQuantity}
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder={`Ex: ${maxQuantity}`}
            className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            autoFocus
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Prix de vente total (optionnel)</label>
          <div className="relative">
            <input 
              type="number" 
              min="0"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="Ex: 5.00"
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">€</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Commentaire (optionnel)</label>
          <textarea 
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Ex: Vendu au marché, donné à un voisin..."
            className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-20"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-stone-600 hover:bg-stone-100 transition-colors">
          Annuler
        </button>
        <button 
          onClick={() => { 
            if (quantity && Number(quantity) > 0) {
              onSubmit({ quantity: Number(quantity), price: price ? Number(price) : undefined, comment }); 
              onClose(); 
            }
          }} 
          disabled={!quantity || Number(quantity) <= 0 || Number(quantity) > maxQuantity}
          className="px-4 py-2 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Valider
        </button>
      </div>
    </Modal>
  );
}
