import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Save, Upload, Download, Image as ImageIcon, ImageOff, History, RotateCcw, Trash2, Settings } from 'lucide-react';
import { ConfirmModal, AlertModal } from '../components/Modals';
import { backupService } from '../backupService';

export function Backup() {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
    showMergeOption?: boolean;
    onMergeConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });

  const [autoFreqLight, setAutoFreqLight] = useState(localStorage.getItem('potager_backup_frequency_light') || 'daily');
  const [autoFreqFull, setAutoFreqFull] = useState(localStorage.getItem('potager_backup_frequency_full') || 'weekly');

  const autoBackups = useLiveQuery(() => db.backups.where('type').equals('auto').sortBy('date'));

  const handleFreqLightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAutoFreqLight(val);
    localStorage.setItem('potager_backup_frequency_light', val);
    backupService.initAutoBackup();
  };

  const handleFreqFullChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAutoFreqFull(val);
    localStorage.setItem('potager_backup_frequency_full', val);
    backupService.initAutoBackup();
  };

  const handleExport = async (includePhotos: boolean) => {
    try {
      const seedlings = await db.seedlings.toArray();
      const journal = await db.journal.toArray();
      const config = await db.config.toArray();
      const trees = await db.trees.toArray();
      const structures = await db.structures.toArray();

      let exportData = { seedlings, journal, config, trees, structures, version: 1 };

      if (!includePhotos) {
        exportData.seedlings = exportData.seedlings.map(s => {
          const { photo, notes, ...rest } = s;
          const notesWithoutPhotos = notes ? notes.map(n => {
            const { photos: notePhotos, ...noteRest } = n;
            return noteRest;
          }) : [];
          return { ...rest, notes: notesWithoutPhotos } as any;
        });
        exportData.journal = exportData.journal.map(j => {
          const { photos, ...rest } = j;
          return rest as any;
        });
        exportData.trees = exportData.trees.map(t => {
          const { photo, notes, ...rest } = t;
          const notesWithoutPhotos = notes ? notes.map(n => {
            const { photos: notePhotos, ...noteRest } = n;
            return noteRest;
          }) : [];
          return { ...rest, notes: notesWithoutPhotos } as any;
        });
      }

      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const filename = `potager_backup_${new Date().toISOString().split('T')[0]}${includePhotos ? '_full' : '_simple'}.json`;

      try {
        if ('showSaveFilePicker' in window) {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'Fichier de sauvegarde JSON',
              accept: { 'application/json': ['.json'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          
          setAlertState({
            isOpen: true,
            title: "Succès",
            message: "Sauvegarde exportée avec succès."
          });
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled the picker
        console.warn('showSaveFilePicker failed, falling back to standard download', err);
      }

      // Fallback
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute("download", filename);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
      
      setAlertState({
        isOpen: true,
        title: "Succès",
        message: "Sauvegarde exportée avec succès."
      });
    } catch (error) {
      console.error("Erreur lors de l'export", error);
      setAlertState({
        isOpen: true,
        title: "Erreur d'export",
        message: "Une erreur est survenue lors de l'export."
      });
    }
  };

  const handleImportClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmState({
      isOpen: true,
      title: 'Attention',
      message: "L'importation remplacera toutes vos données actuelles. Voulez-vous continuer ou fusionner avec les données existantes ?",
      isDanger: true,
      showMergeOption: true,
      onConfirm: () => processImport(file, false),
      onMergeConfirm: () => processImport(file, true)
    });
  };

  const processImport = async (file: File, merge: boolean = false) => {
    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        if (data.seedlings || data.journal || data.config) {
          await db.transaction('rw', [db.seedlings, db.journal, db.config, db.trees, db.structures], async () => {
            if (!merge) {
              await db.seedlings.clear();
              await db.journal.clear();
              await db.config.clear();
              await db.trees.clear();
              await db.structures.clear();
            }
            
            if (data.seedlings) await db.seedlings.bulkPut(data.seedlings);
            if (data.journal) await db.journal.bulkPut(data.journal);
            if (data.config) await db.config.bulkPut(data.config);
            if (data.trees) await db.trees.bulkPut(data.trees);
            if (data.structures) await db.structures.bulkPut(data.structures);
          });
          
          setAlertState({
            isOpen: true,
            title: "Succès",
            message: "Importation réussie ! L'application va se recharger."
          });
          setTimeout(() => window.location.reload(), 2000);
        } else {
          setAlertState({
            isOpen: true,
            title: "Erreur",
            message: "Le fichier ne semble pas être une sauvegarde valide."
          });
        }
      } catch (err) {
        console.error("Erreur de parsing JSON", err);
        setAlertState({
          isOpen: true,
          title: "Erreur",
          message: "Le fichier est corrompu ou invalide."
        });
      } finally {
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setAlertState({
        isOpen: true,
        title: "Erreur",
        message: "Impossible de lire le fichier."
      });
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleRestoreAuto = async (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Restaurer une sauvegarde automatique',
      message: "Voulez-vous remplacer toutes vos données actuelles ou les fusionner avec cette sauvegarde ?",
      isDanger: true,
      showMergeOption: true,
      onConfirm: async () => {
        try {
          await backupService.restoreFromBackup(id, false);
          setAlertState({
            isOpen: true,
            title: "Succès",
            message: "Restauration réussie ! L'application va se recharger."
          });
          setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
          console.error("Erreur de restauration", error);
          setAlertState({
            isOpen: true,
            title: "Erreur",
            message: "Une erreur est survenue lors de la restauration."
          });
        }
      },
      onMergeConfirm: async () => {
        try {
          await backupService.restoreFromBackup(id, true);
          setAlertState({
            isOpen: true,
            title: "Succès",
            message: "Fusion réussie ! L'application va se recharger."
          });
          setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
          console.error("Erreur de fusion", error);
          setAlertState({
            isOpen: true,
            title: "Erreur",
            message: "Une erreur est survenue lors de la fusion."
          });
        }
      }
    });
  };

  const handleDeleteBackup = async (id: string) => {
    await db.backups.delete(id);
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
        confirmText="Remplacer"
        showMergeOption={confirmState.showMergeOption}
        onMergeConfirm={confirmState.onMergeConfirm}
        mergeText="Fusionner"
      />
      
      <AlertModal 
        isOpen={alertState.isOpen}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
        title={alertState.title}
        message={alertState.message}
      />

      <header>
        <h1 className="text-xl font-serif font-medium text-stone-900 flex items-center gap-1.5">
          <Save className="w-5 h-5 text-emerald-600" />
          Sauvegarde & Restauration
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">Exportez vos données pour les sécuriser ou les transférer.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 space-y-3 md:col-span-2">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Settings className="w-5 h-5" />
            <h2 className="text-lg font-serif font-medium text-stone-900">Configuration des sauvegardes automatiques</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-stone-700">Sauvegarde légère (sans photos)</label>
              <select 
                value={autoFreqLight} 
                onChange={handleFreqLightChange} 
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                <option value="never">Désactivé</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">Tous les jours</option>
                <option value="weekly">Toutes les semaines</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-stone-700">Sauvegarde complète (avec photos)</label>
              <select 
                value={autoFreqFull} 
                onChange={handleFreqFullChange} 
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                <option value="never">Désactivé</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">Tous les jours</option>
                <option value="weekly">Toutes les semaines</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <Download className="w-5 h-5" />
            <h2 className="text-lg font-serif font-medium text-stone-900">Exporter</h2>
          </div>
          <p className="text-xs text-stone-600">Téléchargez une copie de votre base de données sur votre appareil.</p>
          
          <div className="space-y-2 pt-1">
            <button 
              onClick={() => handleExport(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Sauvegarde Complète (avec photos)
            </button>
            <button 
              onClick={() => handleExport(false)}
              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <ImageOff className="w-3.5 h-3.5" />
              Sauvegarde Simple (sans photos)
            </button>
            <p className="text-[10px] text-stone-500 text-center mt-1">
              La sauvegarde simple est plus légère et idéale pour un archivage long terme si vous n'avez pas besoin des photos.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Upload className="w-5 h-5" />
            <h2 className="text-lg font-serif font-medium text-stone-900">Importer</h2>
          </div>
          <p className="text-xs text-stone-600">Restaurez une sauvegarde précédente. <strong className="text-red-600">Attention, cela écrasera vos données actuelles.</strong></p>
          
          <div className="pt-1">
            <label htmlFor="import-file" className={`w-full ${importing ? 'bg-stone-200 cursor-not-allowed' : 'bg-amber-100 hover:bg-amber-200 cursor-pointer'} text-amber-900 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5`}>
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Importation en cours...' : 'Sélectionner un fichier .json'}
              <input 
                id="import-file"
                type="file" 
                accept=".json" 
                className="sr-only" 
                onChange={handleImportClick}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                disabled={importing}
                ref={fileInputRef}
              />
            </label>
          </div>
        </div>
      </div>

      {autoBackups && autoBackups.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 space-y-3">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <History className="w-5 h-5" />
            <h2 className="text-lg font-serif font-medium text-stone-900">Historique des Sauvegardes Automatiques</h2>
          </div>
          <p className="text-xs text-stone-600">L'application conserve automatiquement vos 10 dernières sauvegardes selon la fréquence choisie.</p>
          
          <div className="overflow-hidden rounded-lg border border-stone-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-[11px] uppercase tracking-wider">
                  <th className="px-4 py-2 font-semibold">Date</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {autoBackups.slice().reverse().map(backup => (
                  <tr key={backup.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-2 text-xs text-stone-700">
                      {new Date(backup.date).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {backup.includePhotos !== false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                          <ImageIcon className="w-3 h-3" />
                          Complète
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-600 text-[11px] font-medium">
                          <ImageOff className="w-3 h-3" />
                          Légère
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right space-x-1.5">
                      <button 
                        onClick={() => handleRestoreAuto(backup.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-[11px] font-medium"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restaurer
                      </button>
                      <button 
                        onClick={() => handleDeleteBackup(backup.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-[11px] font-medium"
                      >
                        <Trash2 className="w-3 h-3" />
                        Supprimer
                      </button>
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
