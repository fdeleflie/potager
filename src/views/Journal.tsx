import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, JournalEntry } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, Plus, Save, Trash2, Search, Filter, Edit, X, Camera } from 'lucide-react';
import { ConfirmModal } from '../components/Modals';

export interface CombinedEntry {
  id: string;
  date: string;
  content: string;
  photos?: string[];
  isDeleted: boolean;
  type: 'journal' | 'seedling' | 'tree';
  sourceId?: string;
  sourceName?: string;
}

export function Journal({ setCurrentView }: { setCurrentView: (view: string) => void }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState<'all' | 'year' | 'month' | 'day'>('all');
  const [filterType, setFilterType] = useState<'all' | 'journal' | 'seedling' | 'tree'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'alpha'>('desc');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const entries = useLiveQuery(async () => {
    const journalEntries = await db.journal.filter(e => !e.isDeleted).toArray();
    const seedlings = await db.seedlings.filter(s => !s.isDeleted).toArray();
    const trees = await db.trees.filter(t => !t.isDeleted).toArray();

    const combined: CombinedEntry[] = journalEntries.map(e => ({ ...e, type: 'journal' }));
    
    seedlings.forEach(s => {
      if (s.notes) {
        s.notes.forEach(n => {
          combined.push({
            id: n.id,
            date: n.date,
            content: n.text,
            isDeleted: false,
            type: 'seedling',
            sourceId: s.id,
            sourceName: `${s.vegetable} - ${s.variety || 'Sans variété'}`
          });
        });
      }
    });

    trees.forEach(t => {
      if (t.notes) {
        t.notes.forEach(n => {
          combined.push({
            id: n.id,
            date: n.date,
            content: n.text,
            isDeleted: false,
            type: 'tree',
            sourceId: t.id,
            sourceName: `${t.species} - ${t.variety || 'Sans variété'}`
          });
        });
      }
    });

    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditPhotos(prev => [...prev, reader.result as string]);
        } else {
          setPhotos(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const entry: JournalEntry = {
      id: uuidv4(),
      date,
      content,
      photos,
      isDeleted: false,
    };

    await db.journal.add(entry);
    setContent('');
    setPhotos([]);
  };

  const handleStartEdit = (entry: CombinedEntry) => {
    if (entry.type !== 'journal') return;
    setEditingId(entry.id);
    setEditContent(entry.content);
    setEditDate(entry.date);
    setEditPhotos(entry.photos || []);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditDate('');
    setEditPhotos([]);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    await db.journal.update(id, {
      content: editContent,
      date: editDate,
      photos: editPhotos
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string, type: string) => {
    if (type !== 'journal') return;
    setConfirmState({
      isOpen: true,
      title: 'Supprimer la note',
      message: 'Voulez-vous vraiment supprimer cette note du journal ?',
      isDanger: true,
      onConfirm: async () => {
        await db.journal.update(id, { isDeleted: true });
      }
    });
  };

  if (!entries) return <div>Chargement...</div>;

  const years = Array.from(new Set(entries.map(e => new Date(e.date).getFullYear().toString()))).sort((a, b) => b.localeCompare(a));

  const filteredEntries = entries.filter(e => {
    const matchesSearch = e.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || 
                        (filterType === 'journal' && e.type === 'journal') || 
                        (filterType === 'seedling' && (e.type === 'seedling' || e.type === 'tree'));
    const d = new Date(e.date);
    const now = new Date();
    if (filterDate === 'all') return matchesSearch && matchesType;
    if (filterDate === 'year') return matchesSearch && matchesType && d.getFullYear() === now.getFullYear();
    if (filterDate === 'month') return matchesSearch && matchesType && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (filterDate === 'day') return matchesSearch && matchesType && d.toDateString() === now.toDateString();
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    if (sortOrder === 'alpha') {
      return a.content.localeCompare(b.content);
    }
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-serif font-medium text-stone-900 flex items-center gap-1.5">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            Journal du potager
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">Notez vos observations, la météo, les réussites et les échecs.</p>
        </div>
      </header>

      <form onSubmit={handleSave} className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60 space-y-2">
        <div className="flex items-center gap-2">
          <input 
            type="date" 
            required
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <h2 className="text-sm font-medium text-stone-700">Nouvelle entrée</h2>
        </div>
        <textarea 
          required
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
          placeholder="Aujourd'hui, j'ai observé que..."
        />
        {photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo, index) => (
              <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0">
                <img src={photo} alt="Aperçu" className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                  className="absolute top-1 right-1 p-0.5 bg-white/80 hover:bg-white rounded-full text-stone-700 shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center pt-1">
          <label className="cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors">
            <Camera className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">Ajouter photo(s)</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={e => handlePhotoUpload(e, false)} 
            />
          </label>
          <button 
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Enregistrer
          </button>
        </div>
      </form>

      <div className="bg-white p-2.5 rounded-xl shadow-sm border border-stone-200/60 flex flex-col md:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
          <input 
            type="text" 
            placeholder="Rechercher dans le journal..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex items-center">
            <Filter className="absolute left-2 text-stone-400 w-3.5 h-3.5" />
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value as any)}
              className="pl-7 pr-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="all">Tous les types</option>
              <option value="journal">Journal uniquement</option>
              <option value="seedling">Notes de semis/plants</option>
            </select>
          </div>
          <div className="relative flex items-center">
            <Filter className="absolute left-2 text-stone-400 w-3.5 h-3.5" />
            <select 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value as any)}
              className="pl-7 pr-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="all">Toutes les dates</option>
              <option value="year">Par année</option>
              <option value="month">Par mois</option>
              <option value="day">Par jour</option>
            </select>
          </div>
          <select 
            value={sortOrder} 
            onChange={e => setSortOrder(e.target.value as 'desc' | 'asc' | 'alpha')}
            className="px-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
          >
            <option value="desc">Plus récent d'abord</option>
            <option value="asc">Plus ancien d'abord</option>
            <option value="alpha">Par ordre alphabétique</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-6 bg-white rounded-xl border border-stone-200 border-dashed">
            <BookOpen className="w-6 h-6 text-stone-300 mx-auto mb-1.5" />
            <h3 className="text-sm font-medium text-stone-900">Aucune entrée trouvée</h3>
            <p className="text-xs text-stone-500 mt-0.5">Modifiez vos filtres ou ajoutez une nouvelle note.</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div key={entry.id} className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60 flex gap-3 group">
              {editingId === entry.id ? (
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      required
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="px-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <textarea 
                    required
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  />
                  {editPhotos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {editPhotos.map((photo, index) => (
                        <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0">
                          <img src={photo} alt="Aperçu" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => setEditPhotos(prev => prev.filter((_, i) => i !== index))}
                            className="absolute top-1 right-1 p-0.5 bg-white/80 hover:bg-white rounded-full text-stone-700 shadow-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1">
                    <label className="cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors">
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Modifier photo(s)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => handlePhotoUpload(e, true)} 
                      />
                    </label>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={handleCancelEdit}
                        className="px-2 py-1 text-[11px] text-stone-600 hover:bg-stone-100 rounded-lg font-medium transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Annuler
                      </button>
                      <button 
                        onClick={() => handleSaveEdit(entry.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-[11px] font-medium shadow-sm transition-colors flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-xl font-serif font-medium text-emerald-600 leading-none">
                      {new Date(entry.date).getDate()}
                    </div>
                    <div className="text-[9px] font-medium text-stone-500 uppercase tracking-wider mt-0.5">
                      {new Date(entry.date).toLocaleString('fr-FR', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex-1 border-l border-stone-100 pl-3 space-y-2">
                    {entry.type !== 'journal' && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-medium">
                          {entry.type === 'seedling' ? 'Semis/Plant' : 'Arbre'}
                        </span>
                        {entry.type === 'seedling' && (
                          <button 
                            onClick={() => setCurrentView(`seedling-detail-${entry.sourceId}`)}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                          >
                            Voir la fiche : {entry.sourceName}
                          </button>
                        )}
                        {entry.type === 'tree' && (
                          <span className="text-[10px] text-stone-500 font-medium">
                            {entry.sourceName}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-stone-800 whitespace-pre-wrap">{entry.content}</p>
                    {entry.photos && entry.photos.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {entry.photos.map((photo, index) => (
                          <img key={index} src={photo} alt="Photo du journal" className="rounded-lg max-h-40 object-cover border border-stone-200" />
                        ))}
                      </div>
                    )}
                  </div>
                  {entry.type === 'journal' && (
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0 self-start">
                      <button 
                        onClick={() => handleStartEdit(entry)}
                        className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(entry.id, entry.type)}
                        className="p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Mettre à la corbeille"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
