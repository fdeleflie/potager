import {
  useFirebaseData,
  fb,
  getFirebaseQuotaStats,
  getLocalOnlyMode,
  setLocalOnlyMode,
  getPendingCloudSync,
  setPendingCloudSync,
  setBulkOperationActive,
  getTargetUid
} from '../hooks/useFirebaseData';
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import {
  Save,
  Upload,
  Download,
  Image as ImageIcon,
  ImageOff,
  History,
  RotateCcw,
  Trash2,
  Settings,
  XCircle,
  HardDrive,
  Cloud,
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Clock,
  Play,
  Info,
  BellRing
} from 'lucide-react';
import { ConfirmModal, AlertModal, Modal } from '../components/Modals';
import {
  backupService,
  AutoBackupSummary,
  AutoBackupFrequency,
  AUTO_BACKUP_UPDATED_EVENT,
  MANUAL_EXPORT_UPDATED_EVENT,
  ManualExportReminderStatus,
  formatBackupSize,
  getFrequencyIntervalMs
} from '../backupService';
import { getAllIdbCollectionsForUid } from '../services/localCacheDb';

const PROJECT_BACKUP_URL = '/assets/aistudio/potager_backup_2026-11-15_full_58d55c02.json';
const PROJECT_BACKUP_LABEL = 'potager_backup_2026-11-15_full_58d55c02.json';

const BACKUP_COLLECTIONS = [
  { key: 'config', label: 'Configuration & Variétés' },
  { key: 'encyclopedia', label: 'Catalogue des plantes' },
  { key: 'trees', label: 'Verger' },
  { key: 'structures', label: 'Structures & Plan' },
  { key: 'seasons', label: 'Saisons' },
  { key: 'healthIssues', label: 'Fiches santé' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'perpetualTasks', label: 'Calendrier perpétuel' },
  { key: 'expenses', label: 'Dépenses' },
  { key: 'seedlings', label: 'Semis & Cultures' },
  { key: 'journal', label: 'Journal de bord' },
] as const;

type ImportStrategy = 'two-step' | 'local-only' | 'text-only';

interface ParsedImportPreview {
  sourceName: string;
  fileSizeMB: number;
  data: any;
  totalItems: number;
  textSizeKB: number;
  photoSizeMB: number;
  photoDocCount: number;
}

const isBase64Image = (val: unknown): val is string =>
  typeof val === 'string' && val.startsWith('data:image/');

const itemHasPhotos = (item: any): boolean => {
  if (!item || typeof item !== 'object') return false;
  if (isBase64Image(item.photo)) return true;
  if (Array.isArray(item.photos) && item.photos.some(isBase64Image)) return true;
  if (Array.isArray(item.notes)) {
    for (const n of item.notes) {
      if (isBase64Image(n?.photo)) return true;
      if (Array.isArray(n?.photos) && n.photos.some(isBase64Image)) return true;
    }
  }
  return false;
};

const stripPhotosFromItem = (item: any): any => {
  if (!item || typeof item !== 'object') return item;
  const clone: any = { ...item };
  if ('photo' in clone) delete clone.photo;
  if ('photos' in clone) delete clone.photos;
  if (Array.isArray(clone.notes)) {
    clone.notes = clone.notes.map((n: any) => {
      if (!n || typeof n !== 'object') return n;
      const { photo: _p, photos: _ps, ...restNote } = n;
      return restNote;
    });
  }
  return clone;
};

const compressBase64Image = (dataUrl: string, maxDim = 800, quality = 0.65): Promise<string> => {
  return new Promise((resolve) => {
    if (!isBase64Image(dataUrl)) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    const timer = setTimeout(() => resolve(dataUrl), 4000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
};

const compressItemPhotosForFirestore = async (item: any): Promise<any> => {
  if (!item || typeof item !== 'object') return item;
  const rawLen = JSON.stringify(item).length;
  if (rawLen <= 120_000) return item;

  const clone = JSON.parse(JSON.stringify(item));
  const passes = [
    { maxDim: 800, quality: 0.65, minStrLen: 80_000 },
    { maxDim: 560, quality: 0.52, minStrLen: 40_000 },
    { maxDim: 400, quality: 0.42, minStrLen: 20_000 }
  ];

  for (const pass of passes) {
    if (isBase64Image(clone.photo) && clone.photo.length > pass.minStrLen) {
      clone.photo = await compressBase64Image(clone.photo, pass.maxDim, pass.quality);
    }
    if (Array.isArray(clone.photos)) {
      clone.photos = await Promise.all(
        clone.photos.map((p: any) =>
          isBase64Image(p) && p.length > pass.minStrLen
            ? compressBase64Image(p, pass.maxDim, pass.quality)
            : p
        )
      );
    }
    if (Array.isArray(clone.notes)) {
      for (const note of clone.notes) {
        if (note && isBase64Image(note.photo) && note.photo.length > pass.minStrLen) {
          note.photo = await compressBase64Image(note.photo, pass.maxDim, pass.quality);
        }
        if (note && Array.isArray(note.photos)) {
          note.photos = await Promise.all(
            note.photos.map((p: any) =>
              isBase64Image(p) && p.length > pass.minStrLen
                ? compressBase64Image(p, pass.maxDim, pass.quality)
                : p
            )
          );
        }
      }
    }
    if (JSON.stringify(clone).length <= 280_000) return clone;
  }

  return clone;
};

export function Backup() {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    phase: string;
    percent: number;
    detail: string;
  } | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const reloadAfterAlertRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projectBackupAvailable, setProjectBackupAvailable] = useState(false);
  const [isLoadingProjectBackup, setIsLoadingProjectBackup] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedImportPreview | null>(null);
  const [importMergeMode, setImportMergeMode] = useState<boolean>(false);
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('two-step');

  const [localOnlyMode, setLocalOnlyState] = useState<boolean>(getLocalOnlyMode);
  const [pendingCloudSync, setPendingCloudState] = useState<boolean>(getPendingCloudSync);
  const [idbStats, setIdbStats] = useState<{ count: number; approxMB: number } | null>(null);

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

  const [autoEnabled, setAutoEnabled] = useState<boolean>(() =>
    backupService.isAutoBackupEnabled()
  );
  const [autoFreqLight, setAutoFreqLight] = useState<AutoBackupFrequency>(() =>
    backupService.getLightFrequency()
  );
  const [autoFreqFull, setAutoFreqFull] = useState<AutoBackupFrequency>(() =>
    backupService.getFullFrequency()
  );
  const [mergedAutoBackups, setMergedAutoBackups] = useState<AutoBackupSummary[]>([]);
  const [runningAutoType, setRunningAutoType] = useState<'light' | 'full' | null>(null);
  const [autoFeedback, setAutoFeedback] = useState<{
    kind: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const [manualReminder, setManualReminder] = useState<ManualExportReminderStatus>(() =>
    backupService.getManualExportReminderStatus()
  );

  const { data: rawBackups, error: backupsError } = useFirebaseData<any>('backups');

  const refreshAutoBackupsList = async (cloudList?: any[]) => {
    try {
      const list = await backupService.listMergedAutoBackups(cloudList ?? rawBackups);
      setMergedAutoBackups(list);
    } catch (err) {
      console.warn('Could not refresh auto backups list:', err);
    }
  };

  useEffect(() => {
    void refreshAutoBackupsList(rawBackups);
  }, [rawBackups]);

  const refreshLocalStatus = async () => {
    setLocalOnlyState(getLocalOnlyMode());
    setPendingCloudState(getPendingCloudSync());
    try {
      const uid = await getTargetUid();
      if (uid) {
        const colls = await getAllIdbCollectionsForUid(uid);
        let count = 0;
        let bytes = 0;
        for (const items of Object.values(colls)) {
          count += items.length;
          bytes += JSON.stringify(items).length;
        }
        setIdbStats({ count, approxMB: bytes / (1024 * 1024) });
      }
    } catch {}
  };

  useEffect(() => {
    fetch(PROJECT_BACKUP_URL, { method: 'HEAD' })
      .then((res) => {
        if (res.ok) setProjectBackupAvailable(true);
      })
      .catch(() => {});

    void refreshLocalStatus();

    const handleStatusChange = () => {
      void refreshLocalStatus();
    };
    const handleAutoBackupUpdate = () => {
      setAutoEnabled(backupService.isAutoBackupEnabled());
      setAutoFreqLight(backupService.getLightFrequency());
      setAutoFreqFull(backupService.getFullFrequency());
      void refreshAutoBackupsList();
    };
    const handleManualExportUpdate = () => {
      setManualReminder(backupService.getManualExportReminderStatus());
    };
    window.addEventListener('potager_local_sync_status_changed', handleStatusChange);
    window.addEventListener('firebase_reads_updated', handleStatusChange);
    window.addEventListener(AUTO_BACKUP_UPDATED_EVENT, handleAutoBackupUpdate);
    window.addEventListener(MANUAL_EXPORT_UPDATED_EVENT, handleManualExportUpdate);
    return () => {
      window.removeEventListener('potager_local_sync_status_changed', handleStatusChange);
      window.removeEventListener('firebase_reads_updated', handleStatusChange);
      window.removeEventListener(AUTO_BACKUP_UPDATED_EVENT, handleAutoBackupUpdate);
      window.removeEventListener(MANUAL_EXPORT_UPDATED_EVENT, handleManualExportUpdate);
    };
  }, []);

  const handleToggleAutoEnabled = () => {
    const next = !autoEnabled;
    backupService.setAutoBackupEnabled(next);
    setAutoEnabled(next);
    setAutoFreqLight(backupService.getLightFrequency());
    setAutoFreqFull(backupService.getFullFrequency());
    setAutoFeedback({
      kind: 'info',
      text: next
        ? 'Sauvegardes automatiques activées. Elles tourneront en arrière-plan selon les fréquences choisies.'
        : 'Sauvegardes automatiques mises en pause.'
    });
  };

  const handleFreqLightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as AutoBackupFrequency;
    setAutoFreqLight(val);
    backupService.setLightFrequency(val);
    if (val !== 'never') setAutoEnabled(true);
  };

  const handleFreqFullChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as AutoBackupFrequency;
    setAutoFreqFull(val);
    backupService.setFullFrequency(val);
    if (val !== 'never') setAutoEnabled(true);
  };

  const handleRunAutoNow = async (includePhotos: boolean) => {
    const kind = includePhotos ? 'full' : 'light';
    setRunningAutoType(kind);
    setAutoFeedback(null);
    try {
      const res = await backupService.createBackup('auto', includePhotos);
      await refreshAutoBackupsList();
      if (!res.created) {
        setAutoFeedback({
          kind: 'error',
          text:
            res.reason === 'empty'
              ? 'Aucune donnée à sauvegarder pour le moment (le cache est encore vide).'
              : res.reason === 'no_user'
                ? 'Veuillez être connecté(e) pour créer une sauvegarde.'
                : `Sauvegarde non créée : ${res.reason || 'erreur inconnue'}`
        });
      } else {
        const sizeLabel = formatBackupSize(res.sizeBytes || 0);
        const destLabel = res.savedCloud
          ? 'enregistrée en local (IndexedDB) + copiée sur Firestore Cloud'
          : 'enregistrée dans votre stockage local IndexedDB (sans limite de 1 Mo)';
        setAutoFeedback({
          kind: 'success',
          text: `Sauvegarde ${includePhotos ? 'complète (avec photos)' : 'légère'} créée (${res.itemCount} fiches, ${sizeLabel}) et ${destLabel}.`
        });
      }
    } catch (err: any) {
      setAutoFeedback({
        kind: 'error',
        text: `Erreur lors de la sauvegarde : ${err?.message || 'Erreur inconnue'}`
      });
    } finally {
      setRunningAutoType(null);
    }
  };

  const handleExport = async (includePhotos: boolean) => {
    try {
      const res = await backupService.exportJsonFile(includePhotos);
      if (res.cancelled) return;

      setAlertState({
        isOpen: true,
        title: 'Succès',
        message: `Sauvegarde exportée avec succès (${res.totalItems} fiches, ${formatBackupSize(
          res.sizeBytes
        )}).`
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

  const preparePreviewFromText = (rawText: string, sourceName: string, fileSizeBytes: number) => {
    const data = JSON.parse(rawText);
    const hasKnownCollection = BACKUP_COLLECTIONS.some((c) => Array.isArray(data?.[c.key]));
    if (!hasKnownCollection) {
      setAlertState({
        isOpen: true,
        title: 'Erreur',
        message: 'Le fichier ne semble pas être une sauvegarde valide.'
      });
      return;
    }

    let totalItems = 0;
    let totalTextBytes = 0;
    let photoDocCount = 0;

    for (const col of BACKUP_COLLECTIONS) {
      const arr = data[col.key];
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        totalItems++;
        if (itemHasPhotos(item)) photoDocCount++;
        totalTextBytes += JSON.stringify(stripPhotosFromItem(item)).length;
      }
    }

    const totalBytes = fileSizeBytes || rawText.length;
    const photoBytes = Math.max(0, totalBytes - totalTextBytes);

    setImportMergeMode(false);
    setImportStrategy('two-step');
    setImportPreview({
      sourceName,
      fileSizeMB: totalBytes / (1024 * 1024),
      data,
      totalItems,
      textSizeKB: Math.round(totalTextBytes / 1024),
      photoSizeMB: photoBytes / (1024 * 1024),
      photoDocCount
    });
  };

  const handleImportClick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      preparePreviewFromText(rawText, file.name, file.size);
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        title: 'Erreur',
        message:
          err instanceof SyntaxError
            ? 'Le fichier JSON est corrompu ou invalide.'
            : `Impossible de lire le fichier : ${err?.message || 'Erreur inconnue'}`
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadProjectBackup = async () => {
    setIsLoadingProjectBackup(true);
    try {
      const res = await fetch(PROJECT_BACKUP_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rawText = await res.text();
      preparePreviewFromText(rawText, PROJECT_BACKUP_LABEL, rawText.length);
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        title: 'Erreur',
        message: `Impossible de charger la sauvegarde du projet : ${err?.message || 'Erreur'}`
      });
    } finally {
      setIsLoadingProjectBackup(false);
    }
  };

  const handleCancelImport = () => {
    importAbortRef.current?.abort();
  };

  const normalizeCollections = (data: any): { key: string; label: string; items: any[] }[] => {
    const idRemap = new Map<string, string>();
    const registerNormalizedId = (rawId: any): string => {
      if (rawId === undefined || rawId === null || rawId === '') return crypto.randomUUID();
      const str = String(rawId).trim();
      if (/^[a-zA-Z0-9_-]{1,128}$/.test(str)) return str;
      if (idRemap.has(str)) return idRemap.get(str)!;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
      }
      const safe = `${
        str
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 96) || 'item'
      }_${Math.abs(hash).toString(36)}`;
      idRemap.set(str, safe);
      return safe;
    };

    const collectionsToImport: { key: string; label: string; items: any[] }[] = [];
    for (const col of BACKUP_COLLECTIONS) {
      const rawItems = data[col.key];
      if (!Array.isArray(rawItems) || rawItems.length === 0) continue;
      const normalized = rawItems
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any) => ({ ...item, id: registerNormalizedId(item.id) }));
      collectionsToImport.push({ key: col.key, label: col.label, items: normalized });
    }

    const resolveRef = (val: any) => {
      if (val === undefined || val === null || val === '') return val;
      const s = String(val).trim();
      return idRemap.get(s) || s;
    };

    for (const col of collectionsToImport) {
      col.items = col.items.map((item: any) => {
        const next = { ...item };
        if (next.parentId !== undefined) next.parentId = resolveRef(next.parentId);
        if (next.terrainId !== undefined) next.terrainId = resolveRef(next.terrainId);
        if (next.zoneId !== undefined) next.zoneId = resolveRef(next.zoneId);
        if (next.seedlingId !== undefined) next.seedlingId = resolveRef(next.seedlingId);
        if (next.seasonId !== undefined) next.seasonId = resolveRef(next.seasonId);
        return next;
      });
    }

    return collectionsToImport;
  };

  const executeImport = async (
    data: any,
    merge: boolean,
    strategy: ImportStrategy
  ) => {
    const controller = new AbortController();
    importAbortRef.current = controller;
    reloadAfterAlertRef.current = false;
    setImporting(true);
    setBulkOperationActive(true);
    setImportProgress({
      phase: 'Préparation des données...',
      percent: 5,
      detail: 'Normalisation des fiches'
    });

    try {
      await new Promise((r) => setTimeout(r, 20));
      const collectionsToImport = normalizeCollections(data);
      const totalItems = collectionsToImport.reduce((acc, c) => acc + c.items.length, 0);

      // STEP 1: Save immediately to IndexedDB local cache (unlimited storage, ~1-2 seconds!)
      let localSaved = 0;
      if (!merge) {
        for (const col of BACKUP_COLLECTIONS) {
          if (col.key === 'seasons' && !Array.isArray(data.seasons)) continue;
          const hasCol = collectionsToImport.some((c) => c.key === col.key);
          if (!hasCol) {
            await fb.clearLocalCollection(col.key);
          }
        }
      }

      for (const col of collectionsToImport) {
        if (controller.signal.aborted) throw new Error('OPERATION_ABORTED');
        const itemsToStoreLocally =
          strategy === 'text-only' ? col.items.map(stripPhotosFromItem) : col.items;

        setImportProgress({
          phase: `Sauvegarde locale (IndexedDB) : ${col.label}`,
          percent: Math.min(25, 5 + Math.round((localSaved / Math.max(1, totalItems)) * 20)),
          detail: `${itemsToStoreLocally.length} fiches`
        });

        await fb.batchPut(col.key, itemsToStoreLocally, {
          localOnly: true,
          replaceLocal: !merge,
          signal: controller.signal
        });
        localSaved += itemsToStoreLocally.length;
      }

      await refreshLocalStatus();

      // If user chose Local-Only mode: done immediately!
      if (strategy === 'local-only') {
        setLocalOnlyMode(true);
        setPendingCloudSync(true);
        setImportProgress({
          phase: 'Restauration locale terminée !',
          percent: 100,
          detail: `${localSaved} fiches (avec photos) sauvegardées dans IndexedDB`
        });
        reloadAfterAlertRef.current = true;
        setAlertState({
          isOpen: true,
          title: 'Restauration locale réussie !',
          message: `${localSaved} fiches (avec toutes vos photos) ont été restaurées instantanément dans le stockage local IndexedDB.\n\nLe mode « Local uniquement » est activé pour protéger vos données. Quand votre quota Firebase sera disponible, vous pourrez cliquer sur « Envoyer vers le Cloud (Firestore) » sur cette page.`
        });
        return;
      }

      // Protect local IndexedDB until Cloud sync completes cleanly
      setPendingCloudSync(true);

      // Leaving local-only mode for Cloud sync
      setLocalOnlyMode(false);

      // Optional clean of obsolete remote docs only when replacing and quota is NOT already exceeded
      const quotaExceededNow = getFirebaseQuotaStats().isQuotaExceeded;
      if (!merge && !quotaExceededNow) {
        setImportProgress({
          phase: 'Nettoyage Cloud préalable...',
          percent: 28,
          detail: 'Vérification des anciennes entrées Firestore'
        });

        for (const col of BACKUP_COLLECTIONS) {
          if (controller.signal.aborted) throw new Error('OPERATION_ABORTED');
          if (col.key === 'seasons' && !Array.isArray(data.seasons)) continue;
          const importedIds = new Set(
            (collectionsToImport.find((c) => c.key === col.key)?.items || []).map((x) => String(x.id))
          );
          const remoteIds = await fb.listRemoteIds(col.key);
          const obsoleteIds = remoteIds.filter((id) => id && !importedIds.has(String(id)));

          if (obsoleteIds.length > 0) {
            await fb.batchDelete(col.key, obsoleteIds, {
              signal: controller.signal
            });
          }
        }
      }

      // STEP 2: Push lightweight text-only data (~230 KB total!) to Firestore
      let textSaved = 0;
      let textFailed = 0;
      let quotaBlocked = false;
      const cloudErrors: string[] = [];

      let textDone = 0;
      for (const col of collectionsToImport) {
        if (controller.signal.aborted) throw new Error('OPERATION_ABORTED');
        const textItems = col.items.map(stripPhotosFromItem);

        setImportProgress({
          phase: `Étape 1/2 Cloud (Texte) : ${col.label}`,
          percent: Math.min(60, 30 + Math.round((textDone / Math.max(1, totalItems)) * 30)),
          detail: `${textItems.length} fiches (~légères)`
        });

        const res = await fb.batchPut(col.key, textItems, {
          signal: controller.signal,
          skipLocalUpdate: true, // Keep original photos intact in IndexedDB!
          maxBatchOps: 25,
          maxBatchBytes: 350_000,
          onProgress: (done, total) => {
            const overall = textDone + done;
            setImportProgress({
              phase: `Étape 1/2 Cloud (Texte) : ${col.label}`,
              percent: Math.min(60, 30 + Math.round((overall / Math.max(1, totalItems)) * 30)),
              detail: `${done} / ${total} fiches texte`
            });
          }
        });

        textSaved += res.saved;
        textFailed += res.failed;
        if (res.quotaHit) quotaBlocked = true;
        if (res.errors.length > 0) cloudErrors.push(...res.errors.slice(0, 2));
        textDone += textItems.length;
        if (quotaBlocked) break;
      }

      if (strategy === 'text-only' || quotaBlocked) {
        setPendingCloudSync(quotaBlocked || textFailed > 0);
        setImportProgress({
          phase: quotaBlocked
            ? 'Données sauvegardées en local (Quota Cloud atteint)'
            : 'Synchronisation Cloud terminée',
          percent: 100,
          detail: `${localSaved} en local • ${textSaved} sur Firestore`
        });
        reloadAfterAlertRef.current = true;
        setAlertState({
          isOpen: true,
          title: quotaBlocked
            ? 'Données sauvées en local (Quota Firestore atteint)'
            : 'Importation réussie !',
          message: quotaBlocked
            ? `Vos ${localSaved} fiches (avec photos) sont 100 % en sécurité dans votre stockage local IndexedDB.\n\nFirestore a signalé un quota atteint (${textSaved} fiches texte envoyées). Vous pouvez utiliser l'application dès maintenant et relancer la synchro Cloud plus tard.`
            : `${textSaved} fiches texte restaurées en local et synchronisées sur Firestore !`
        });
        return;
      }

      // STEP 3: Compress & upload only the items that actually have photos, in tiny safe chunks
      const photoBatches: { key: string; label: string; items: any[] }[] = [];
      let totalPhotoDocs = 0;
      for (const col of collectionsToImport) {
        const withPhotos = col.items.filter(itemHasPhotos);
        if (withPhotos.length > 0) {
          photoBatches.push({ key: col.key, label: col.label, items: withPhotos });
          totalPhotoDocs += withPhotos.length;
        }
      }

      let photoSaved = 0;
      let photoFailed = 0;
      let photoProcessed = 0;

      for (const batchCol of photoBatches) {
        if (controller.signal.aborted) throw new Error('OPERATION_ABORTED');
        if (quotaBlocked) break;

        const compressedItems: any[] = [];
        for (let i = 0; i < batchCol.items.length; i++) {
          if (controller.signal.aborted) throw new Error('OPERATION_ABORTED');
          setImportProgress({
            phase: `Étape 2/2 Compression photos : ${batchCol.label}`,
            percent: Math.min(
              78,
              60 + Math.round(((photoProcessed + i * 0.4) / Math.max(1, totalPhotoDocs)) * 18)
            ),
            detail: `Photo ${i + 1} / ${batchCol.items.length}`
          });
          compressedItems.push(await compressItemPhotosForFirestore(batchCol.items[i]));
        }

        const res = await fb.batchPut(batchCol.key, compressedItems, {
          signal: controller.signal,
          skipLocalUpdate: true, // Keep originals in IndexedDB
          maxBatchOps: 4,
          maxBatchBytes: 300_000,
          onProgress: (done, total) => {
            const overall = photoProcessed + done;
            setImportProgress({
              phase: `Étape 2/2 Envoi photos Cloud : ${batchCol.label}`,
              percent: Math.min(99, 78 + Math.round((overall / Math.max(1, totalPhotoDocs)) * 21)),
              detail: `${done} / ${total} fiches avec photos`
            });
          }
        });

        photoSaved += res.saved;
        photoFailed += res.failed;
        if (res.quotaHit) quotaBlocked = true;
        if (res.errors.length > 0) cloudErrors.push(...res.errors.slice(0, 2));
        photoProcessed += batchCol.items.length;
      }

      const anyCloudFailures = quotaBlocked || textFailed > 0 || photoFailed > 0;
      setPendingCloudSync(anyCloudFailures);

      setImportProgress({
        phase: 'Restauration terminée !',
        percent: 100,
        detail: `${localSaved} fiches locales • ${textSaved} texte + ${photoSaved} photos sur Cloud`
      });

      reloadAfterAlertRef.current = true;
      if (anyCloudFailures) {
        setAlertState({
          isOpen: true,
          title: 'Local complet OK • Sync Cloud partielle',
          message: `Toutes vos ${localSaved} fiches et photos sont restaurées et utilisables en local (IndexedDB).\n\nSur Firestore : ${textSaved} fiches texte envoyées et ${photoSaved} fiches photos envoyées (${textFailed + photoFailed} en attente).\n\n${cloudErrors.slice(0, 2).join('\n')}`
        });
      } else {
        setAlertState({
          isOpen: true,
          title: 'Restauration complète réussie !',
          message: `${localSaved} fiches restaurées en local et synchronisées sur Firestore (${photoSaved} fiches avec photos compressées envoyées). L'application va se recharger.`
        });
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err: any) {
      if (err?.message === 'OPERATION_ABORTED') {
        setAlertState({
          isOpen: true,
          title: 'Importation interrompue',
          message:
            "L'importation a été annulée. Les données déjà copiées en local restent accessibles dans IndexedDB."
        });
      } else {
        console.error("Erreur lors de l'importation", err);
        setAlertState({
          isOpen: true,
          title: 'Erreur',
          message: `Une erreur est survenue lors de l'importation : ${err?.message || 'Erreur inconnue'}`
        });
      }
    } finally {
      setBulkOperationActive(false);
      importAbortRef.current = null;
      setImporting(false);
      setImportProgress(null);
      await refreshLocalStatus();
    }
  };

  const handleSyncLocalCacheToFirestore = async (includePhotos: boolean) => {
    const uid = await getTargetUid();
    if (!uid) {
      setAlertState({
        isOpen: true,
        title: 'Connexion requise',
        message: 'Veuillez vous connecter avec votre compte Google pour synchroniser vers Firestore.'
      });
      return;
    }

    const colls = await getAllIdbCollectionsForUid(uid);
    const data: any = { version: 1 };
    let hasData = false;
    for (const col of BACKUP_COLLECTIONS) {
      if (colls[col.key] && colls[col.key].length > 0) {
        data[col.key] = colls[col.key];
        hasData = true;
      }
    }

    if (!hasData) {
      setAlertState({
        isOpen: true,
        title: 'Aucune donnée locale',
        message: 'Le cache IndexedDB local est vide pour le moment.'
      });
      return;
    }

    await executeImport(data, true, includePhotos ? 'two-step' : 'text-only');
  };

  const handleRestoreAuto = async (backup: AutoBackupSummary) => {
    try {
      const payload = await backupService.getBackupPayload(backup.id);
      if (!payload) {
        setAlertState({
          isOpen: true,
          title: 'Sauvegarde introuvable',
          message: 'Impossible de charger le contenu de cette sauvegarde automatique.'
        });
        return;
      }
      const dateStr = new Date(backup.date).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      preparePreviewFromText(
        payload.rawText,
        `Sauvegarde auto (${backup.includePhotos ? 'Complète' : 'Légère'}) du ${dateStr}`,
        payload.rawText.length
      );
    } catch (error: any) {
      console.error('Erreur ouverture sauvegarde auto', error);
      setAlertState({
        isOpen: true,
        title: 'Erreur',
        message: `Impossible de lire la sauvegarde : ${error?.message || 'Erreur inconnue'}`
      });
    }
  };

  const handleDownloadAutoBackup = async (backup: AutoBackupSummary) => {
    try {
      const payload = await backupService.getBackupPayload(backup.id);
      if (!payload) {
        setAlertState({
          isOpen: true,
          title: 'Sauvegarde introuvable',
          message: 'Le contenu de cette sauvegarde est introuvable.'
        });
        return;
      }
      const dateTag = new Date(backup.date).toISOString().split('T')[0];
      const filename = `potager_autobackup_${dateTag}_${backup.includePhotos ? 'full' : 'light'}.json`;
      const blob = new Blob([payload.rawText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      backupService.markManualExportDone();
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        title: 'Erreur',
        message: `Téléchargement impossible : ${err?.message || 'Erreur'}`
      });
    }
  };

  const handleDeleteBackup = async (id: string) => {
    await backupService.deleteAutoBackup(id);
    await refreshAutoBackupsList();
  };

  const latestLightAuto = mergedAutoBackups.find((b) => !b.includePhotos) || null;
  const latestFullAuto = mergedAutoBackups.find((b) => b.includePhotos) || null;

  const formatNextRun = (lastDateStr: string | undefined, freq: AutoBackupFrequency): string => {
    if (!autoEnabled || freq === 'never') return 'Désactivée';
    if (!lastDateStr) return 'Dès le prochain cycle automatique';
    const nextMs = new Date(lastDateStr).getTime() + getFrequencyIntervalMs(freq);
    if (nextMs <= Date.now()) return 'Imminente (au prochain passage)';
    return new Date(nextMs).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
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
        onClose={() => {
          setAlertState((prev) => ({ ...prev, isOpen: false }));
          if (reloadAfterAlertRef.current) {
            reloadAfterAlertRef.current = false;
            window.location.reload();
          }
        }}
        title={alertState.title}
        message={alertState.message}
      />

      {/* Import Options Modal */}
      <Modal
        isOpen={Boolean(importPreview)}
        onClose={() => setImportPreview(null)}
        title="Options de restauration"
      >
        {importPreview && (
          <div className="space-y-4 text-xs text-stone-700">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
              <p className="font-semibold text-stone-900 truncate">{importPreview.sourceName}</p>
              <p className="text-[11px] text-stone-600">
                <strong>{importPreview.totalItems}</strong> fiches •{' '}
                <strong>{importPreview.fileSizeMB.toFixed(2)} Mo</strong> au total (
                <span className="text-emerald-700 font-medium">
                  {importPreview.textSizeKB} Ko texte
                </span>{' '}
                +{' '}
                <span className="text-amber-700 font-medium">
                  {importPreview.photoSizeMB.toFixed(2)} Mo sur {importPreview.photoDocCount} fiches
                  photos
                </span>
                )
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold text-stone-800">1. Action sur vos données actuelles :</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImportMergeMode(false)}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    !importMergeMode
                      ? 'bg-red-50 border-red-300 text-red-900 font-semibold'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  Remplacer tout
                </button>
                <button
                  type="button"
                  onClick={() => setImportMergeMode(true)}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    importMergeMode
                      ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  Fusionner
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold text-stone-800">2. Méthode de restauration :</p>

              <label
                className={`block p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  importStrategy === 'two-step'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                    : 'bg-white border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="importStrategy"
                    checked={importStrategy === 'two-step'}
                    onChange={() => setImportStrategy('two-step')}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-semibold">
                      Recommandé : Local complet + Cloud Firestore en 2 étapes
                    </p>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Restaure d'abord les {importPreview.fileSizeMB.toFixed(1)} Mo en local
                      (IndexedDB), puis envoie les données texte ({importPreview.textSizeKB} Ko)
                      sur Firestore, puis les photos compressées par petits lots.
                    </p>
                  </div>
                </div>
              </label>

              <label
                className={`block p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  importStrategy === 'local-only'
                    ? 'bg-amber-50 border-amber-400 text-amber-950'
                    : 'bg-white border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="importStrategy"
                    checked={importStrategy === 'local-only'}
                    onChange={() => setImportStrategy('local-only')}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-semibold">
                      Local uniquement (IndexedDB — 0 quota Firebase, instantané)
                    </p>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Restaure 100 % des fiches et photos originales dans ce navigateur sans toucher
                      à Firestore. Idéal si votre quota Firebase est bloqué aujourd'hui.
                    </p>
                  </div>
                </div>
              </label>

              <label
                className={`block p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  importStrategy === 'text-only'
                    ? 'bg-blue-50 border-blue-400 text-blue-950'
                    : 'bg-white border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="importStrategy"
                    checked={importStrategy === 'text-only'}
                    onChange={() => setImportStrategy('text-only')}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-semibold">
                      Sans les photos ({importPreview.textSizeKB} Ko — Local + Cloud ultra-rapide)
                    </p>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Restaure uniquement les textes, variétés, journal, verger et planning (passe
                      en 3 secondes sur Firestore).
                    </p>
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="px-3.5 py-2 rounded-lg font-medium text-stone-600 hover:bg-stone-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const preview = importPreview;
                  setImportPreview(null);
                  void executeImport(preview.data, importMergeMode, importStrategy);
                }}
                className="px-4 py-2 rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
              >
                Lancer la restauration
              </button>
            </div>
          </div>
        )}
      </Modal>

      <header>
        <h1 className="text-xl font-serif font-medium text-stone-900 flex items-center gap-1.5">
          <Save className="w-5 h-5 text-emerald-600" />
          Sauvegarde & Restauration
        </h1>
        {backupsError && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            {backupsError}
          </div>
        )}
        <p className="text-xs text-stone-500 mt-0.5">
          Exportez vos données, restaurez en stockage local illimité (IndexedDB) et synchronisez
          vers le Cloud Firestore.
        </p>
      </header>

      {/* IndexedDB & Cloud Sync Status Card */}
      <div
        className={`p-4 rounded-xl border shadow-sm space-y-2.5 ${
          localOnlyMode || pendingCloudSync
            ? 'bg-amber-50/90 border-amber-200'
            : 'bg-emerald-50/70 border-emerald-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2.5">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                localOnlyMode || pendingCloudSync
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {localOnlyMode ? <HardDrive className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2 flex-wrap">
                <span>Stockage Local IndexedDB & Synchro Firestore</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    localOnlyMode
                      ? 'bg-amber-200 text-amber-900'
                      : pendingCloudSync
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-emerald-200 text-emerald-900'
                  }`}
                >
                  {localOnlyMode
                    ? 'Mode Local Uniquement'
                    : pendingCloudSync
                      ? 'En attente de synchro Cloud'
                      : 'Cloud + Cache IndexedDB Actifs'}
                </span>
              </h2>
              <p className="text-xs text-stone-600 mt-0.5">
                {idbStats
                  ? `Cache local IndexedDB : ${idbStats.count} fiches (${idbStats.approxMB.toFixed(
                      2
                    )} Mo stockés sans limite de 5 Mo).`
                  : 'Cache local IndexedDB prêt (haute capacité pour sauvegardes > 20 Mo).'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {localOnlyMode ? (
              <button
                type="button"
                onClick={() => setLocalOnlyMode(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-800 text-xs font-medium hover:bg-stone-50"
              >
                Réactiver le mode Cloud
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLocalOnlyMode(true)}
                className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-50"
              >
                Basculer en Local uniquement
              </button>
            )}
          </div>
        </div>

        {idbStats && idbStats.count > 0 && (
          <div className="pt-1 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={importing}
              onClick={() => void handleSyncLocalCacheToFirestore(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium shadow-xs cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Envoyer le local vers Firestore (Texte seul, ultra-léger)
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => void handleSyncLocalCacheToFirestore(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 text-emerald-900 text-xs font-medium cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Envoyer tout + photos compressées vers Firestore
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 space-y-3.5 md:col-span-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  autoEnabled && (autoFreqLight !== 'never' || autoFreqFull !== 'never')
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-stone-100 text-stone-500'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-medium text-stone-900 flex items-center gap-2 flex-wrap">
                  <span>Sauvegardes automatiques</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      autoEnabled && (autoFreqLight !== 'never' || autoFreqFull !== 'never')
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {autoEnabled && (autoFreqLight !== 'never' || autoFreqFull !== 'never')
                      ? 'Actives'
                      : 'En pause'}
                  </span>
                </h2>
                <p className="text-xs text-stone-500">
                  Choisissez vos fréquences ci-dessous : les sauvegardes se déclenchent automatiquement
                  lorsque l'application est ouverte, sans consommer de quota de lectures Firestore.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleAutoEnabled}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                autoEnabled
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {autoEnabled ? 'Activé (cliquez pour suspendre)' : 'En pause (cliquez pour activer)'}
            </button>
          </div>

          {autoFeedback && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                autoFeedback.kind === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : autoFeedback.kind === 'error'
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{autoFeedback.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Sauvegarde légère */}
            <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-800">
                    1. Sauvegarde légère (sans photos)
                  </label>
                  <p className="text-[11px] text-stone-500">
                    Stockage double : IndexedDB local + Cloud Firestore
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/70 shrink-0">
                  Cloud + Local
                </span>
              </div>

              <select
                value={autoFreqLight}
                onChange={handleFreqLightChange}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                <option value="never">Désactivé</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">Tous les jours (Recommandé)</option>
                <option value="weekly">Toutes les semaines</option>
              </select>

              <div className="text-[11px] text-stone-600 space-y-0.5 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span>Dernière :</span>
                  <span className="font-medium text-stone-800">
                    {latestLightAuto
                      ? `${new Date(latestLightAuto.date).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} (${formatBackupSize(latestLightAuto.sizeBytes)})`
                      : 'Aucune encore'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Prochaine :</span>
                  <span className="font-medium text-stone-700">
                    {formatNextRun(latestLightAuto?.date, autoFreqLight)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={runningAutoType !== null}
                onClick={() => void handleRunAutoNow(false)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 disabled:opacity-50 text-stone-800 text-xs font-medium cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3 text-blue-600" />
                {runningAutoType === 'light'
                  ? 'Sauvegarde en cours...'
                  : 'Créer une sauvegarde légère maintenant'}
              </button>
            </div>

            {/* Sauvegarde complète */}
            <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-800">
                    2. Sauvegarde complète (avec photos)
                  </label>
                  <p className="text-[11px] text-stone-500">
                    Stockage local IndexedDB (sans limite de 1 Mo)
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                  Local illimité
                </span>
              </div>

              <select
                value={autoFreqFull}
                onChange={handleFreqFullChange}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                <option value="never">Désactivé</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">Tous les jours</option>
                <option value="weekly">Toutes les semaines (Recommandé)</option>
              </select>

              <div className="text-[11px] text-stone-600 space-y-0.5 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span>Dernière :</span>
                  <span className="font-medium text-stone-800">
                    {latestFullAuto
                      ? `${new Date(latestFullAuto.date).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} (${formatBackupSize(latestFullAuto.sizeBytes)})`
                      : 'Aucune encore'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Prochaine :</span>
                  <span className="font-medium text-stone-700">
                    {formatNextRun(latestFullAuto?.date, autoFreqFull)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={runningAutoType !== null}
                onClick={() => void handleRunAutoNow(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 disabled:opacity-50 text-stone-800 text-xs font-medium cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3 text-emerald-600" />
                {runningAutoType === 'full'
                  ? 'Sauvegarde en cours...'
                  : 'Créer une sauvegarde complète maintenant'}
              </button>
            </div>
          </div>

          {/* Guide clair anti-perte de données */}
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/70 space-y-1.5 text-xs text-blue-950">
            <div className="flex items-center gap-1.5 font-semibold text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Comment être sûr de ne plus jamais perdre vos données ?</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-[11px] text-blue-900/90">
              <li>
                <strong>Enregistrement continu :</strong> chaque fiche modifiée est écrite
                immédiatement dans votre navigateur (IndexedDB) et sur Firestore (si le mode Cloud
                est actif).
              </li>
              <li>
                <strong>Points de restauration automatiques :</strong> dès que vous réglez une
                fréquence (et que le statut est <strong>Actives</strong>), l'application vérifie au
                démarrage puis toutes les 15 min s'il faut créer un instantané. Les{' '}
                <strong>légères</strong> (&lt; 900 Ko) sont copiées sur Firestore (5 conservées) et
                en local (10 conservées) ; les <strong>complètes avec photos</strong> (&gt; 20 Mo)
                sont gardées en IndexedDB local (5 conservées) car Firestore bloque tout document
                dépassant 1 Mo.
              </li>
              <li>
                <strong>Sécurité absolue hors navigateur :</strong> si vous changez d'ordinateur ou
                videz les données du navigateur, les sauvegardes IndexedDB locales sont effacées.
                Téléchargez de temps en temps un fichier <strong>.json</strong> sur votre PC ou
                Google Drive via « Exporter » ou le bouton « Télécharger » ci-dessous.
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <Download className="w-5 h-5" />
            <h2 className="text-lg font-serif font-medium text-stone-900">Exporter</h2>
          </div>
          <p className="text-xs text-stone-600">
            Téléchargez une copie de votre base de données sur votre appareil.
          </p>

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
              La sauvegarde simple est plus légère et idéale pour un archivage long terme si vous
              n'avez pas besoin des photos.
            </p>
          </div>

          <div className="pt-3 border-t border-stone-100 space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
              <BellRing className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Rappel périodique d'export manuel (.json)</span>
            </label>
            <select
              value={String(manualReminder.intervalDays)}
              onChange={(e) => {
                const days = parseInt(e.target.value, 10);
                backupService.setManualExportReminderDays(days);
                setManualReminder(backupService.getManualExportReminderStatus());
              }}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="7">Toutes les semaines (Recommandé)</option>
              <option value="14">Toutes les 2 semaines</option>
              <option value="30">Tous les mois</option>
              <option value="0">Désactivé</option>
            </select>
            <p className="text-[11px] text-stone-500">
              Dernier export manuel :{' '}
              <strong className="text-stone-700">
                {manualReminder.lastExportAt
                  ? new Date(manualReminder.lastExportAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Aucun enregistré'}
              </strong>
              {manualReminder.intervalDays > 0 && manualReminder.lastExportAt
                ? ` • Prochain rappel dans ${Math.max(
                    0,
                    manualReminder.intervalDays - (manualReminder.daysSinceLastExport ?? 0)
                  )} j`
                : ''}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Upload className="w-5 h-5" />
            <h2 className="text-lg font-serif font-medium text-stone-900">Importer</h2>
          </div>
          <p className="text-xs text-stone-600">
            Restaurez une sauvegarde (même de plus de 20 Mo) sans blocage grâce au cache IndexedDB
            et à l'envoi Cloud en 2 étapes.
          </p>

          <div className="pt-1 space-y-2.5">
            {projectBackupAvailable && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Sauvegarde complète du 15/11/2026 disponible (21,68 Mo)</span>
                </div>
                <button
                  type="button"
                  disabled={importing || isLoadingProjectBackup}
                  onClick={() => void handleLoadProjectBackup()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {isLoadingProjectBackup
                    ? 'Chargement du fichier...'
                    : 'Restaurer la sauvegarde du 15/11/2026'}
                </button>
              </div>
            )}

            <label
              htmlFor="import-file"
              className={`w-full ${
                importing
                  ? 'bg-stone-200 cursor-not-allowed text-stone-500'
                  : 'bg-amber-100 hover:bg-amber-200 cursor-pointer text-amber-900'
              } px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5`}
            >
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Importation en cours...' : 'Sélectionner un fichier .json'}
              <input
                id="import-file"
                type="file"
                accept=".json"
                className="sr-only"
                onChange={handleImportClick}
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = '';
                }}
                disabled={importing}
                ref={fileInputRef}
              />
            </label>

            {importing && importProgress && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-amber-950 gap-2">
                  <span className="truncate">{importProgress.phase}</span>
                  <span className="shrink-0 tabular-nums">{importProgress.percent}%</span>
                </div>
                <div className="w-full h-2 bg-amber-200/70 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-600 transition-all duration-200"
                    style={{ width: `${importProgress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-amber-800">
                  <span className="truncate">{importProgress.detail}</span>
                  <button
                    type="button"
                    onClick={handleCancelImport}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-amber-300 text-red-700 hover:bg-red-50 transition-colors shrink-0 font-medium"
                  >
                    <XCircle className="w-3 h-3" />
                    Interrompre
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200/60 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-blue-600">
            <History className="w-5 h-5" />
            <h2 className="text-lg font-serif font-medium text-stone-900">
              Historique des Sauvegardes Automatiques ({mergedAutoBackups.length})
            </h2>
          </div>
          <span className="text-[11px] text-stone-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            10 légères + 5 complètes avec photos conservées en local
          </span>
        </div>

        {mergedAutoBackups.length === 0 ? (
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-600 text-center space-y-1">
            <p className="font-medium text-stone-800">
              Aucune sauvegarde automatique enregistrée pour le moment.
            </p>
            <p>
              Utilisez les boutons « Créer une sauvegarde légère / complète maintenant » ci-dessus
              pour générer votre premier instantané immédiatement.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-500 text-[11px] uppercase tracking-wider">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Type & Taille</th>
                  <th className="px-3 py-2 font-semibold">Stockage</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {mergedAutoBackups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-3 py-2 text-xs text-stone-700 whitespace-nowrap">
                      {new Date(backup.date).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {backup.includePhotos ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                            <ImageIcon className="w-3 h-3" />
                            Complète (photos)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-[11px] font-medium">
                            <ImageOff className="w-3 h-3" />
                            Légère
                          </span>
                        )}
                        <span className="text-[11px] text-stone-500 tabular-nums">
                          {formatBackupSize(backup.sizeBytes)}
                          {backup.itemCount > 0 ? ` • ${backup.itemCount} fiches` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {backup.hasLocal && backup.hasCloud ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-medium">
                          <Cloud className="w-3 h-3" />
                          Local + Cloud
                        </span>
                      ) : backup.hasCloud ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-medium">
                          <Cloud className="w-3 h-3" />
                          Cloud Firestore
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px] font-medium">
                          <HardDrive className="w-3 h-3" />
                          IndexedDB local
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => void handleRestoreAuto(backup)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-[11px] font-medium cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDownloadAutoBackup(backup)}
                        title="Télécharger cette sauvegarde en fichier .json sur votre ordinateur"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-[11px] font-medium cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        .json
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBackup(backup.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-[11px] font-medium cursor-pointer"
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
        )}
      </div>
    </div>
  );
}
