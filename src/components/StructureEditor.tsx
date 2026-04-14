import React from 'react';
import { X, Trash2 } from 'lucide-react';

interface Structure {
  id: string;
  name: string;
  type: string;
  color?: string;
  width?: number;
  height?: number;
}

interface StructureEditorProps {
  structure: Structure;
  onUpdate: (data: Partial<Structure>) => void;
  onClose: () => void;
  onRemove: (e: React.MouseEvent) => void;
}

export const StructureEditor = ({ structure, onUpdate, onClose, onRemove }: StructureEditorProps) => {
  const [name, setName] = React.useState(structure.name);
  const [width, setWidth] = React.useState(structure.width || 50);
  const [height, setHeight] = React.useState(structure.height || 50);

  React.useEffect(() => {
    setName(structure.name);
    setWidth(structure.width || 50);
    setHeight(structure.height || 50);
  }, [structure.id]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    onUpdate({ name: e.target.value });
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setWidth(val);
    onUpdate({ width: val });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setHeight(val);
    onUpdate({ height: val });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium text-stone-900">Modifier l'élément</h4>
        <button 
          onClick={onClose}
          className="text-stone-400 hover:text-stone-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Nom</label>
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Type</label>
        <select
          value={structure.type}
          onChange={(e) => onUpdate({ type: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
        >
          <option value="building">Bâtiment / Abri</option>
          <option value="water">Point d'eau</option>
          <option value="path">Chemin / Allée</option>
          <option value="fence">Clôture / Mur</option>
          <option value="other">Autre</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Largeur (cm)</label>
          <input
            type="number"
            value={width}
            onChange={handleWidthChange}
            className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Hauteur (cm)</label>
          <input
            type="number"
            value={height}
            onChange={handleHeightChange}
            className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Couleur</label>
        <div className="flex flex-wrap gap-2">
          {['#78716c', '#059669', '#0284c7', '#7c3aed', '#db2777', '#ea580c', '#ca8a04'].map(c => (
            <button
              key={c}
              onClick={() => onUpdate({ color: c })}
              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${structure.color === c ? 'border-stone-900 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="pt-4 flex gap-3">
        <button
          onClick={onRemove}
          className="flex-1 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-medium hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Supprimer
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
};
