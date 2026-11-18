import { v4 as uuidv4 } from 'uuid';
import {
  fb,
  getFirebaseQuotaStats,
  getLocalOnlyMode,
  getTargetUid
} from './hooks/useFirebaseData';
import {
  saveAutoBackupInIdb,
  listAutoBackupsFromIdb,
  getAutoBackupFromIdb,
  deleteAutoBackupFromIdb,
  pruneAutoBackupsInIdb,
  LocalAutoBackupRecord
} from './services/localCacheDb';

export type AutoBackupFrequency = 'never' | '4h' | 'daily' | 'weekly';

export interface AutoBackupSummary {
  id: string;
  date: string;
  type: 'auto' | 'manual';
  includePhotos: boolean;
  sizeBytes: number;
  itemCount: number;
  hasLocal: boolean;
  hasCloud: boolean;
}

export interface AutoBackupCreateResult {
  created: boolean;
  reason?: string;
  id?: string;
  date?: string;
  sizeBytes?: number;
  itemCount?: number;
  savedLocal?: boolean;
  savedCloud?: boolean;
}

const ALL_BACKUP_COLLECTIONS = [
  'seedlings',
  'journal',
  'config',
  'trees',
  'structures',
  'tasks',
  'encyclopedia',
  'healthIssues',
  'expenses',
  'perpetualTasks',
  'seasons'
] as const;

const LS_ENABLED_KEY = 'potager_auto_backup_enabled';
const LS_FREQ_LIGHT_KEY = 'potager_backup_frequency_light';
const LS_FREQ_FULL_KEY = 'potager_backup_frequency_full';
const LS_LAST_LIGHT_KEY = 'potager_last_auto_backup_light';
const LS_LAST_FULL_KEY = 'potager_last_auto_backup_full';

const LS_MANUAL_REMINDER_DAYS_KEY = 'potager_manual_export_reminder_days';
const LS_LAST_MANUAL_EXPORT_KEY = 'potager_last_manual_export_at';
const LS_MANUAL_SNOOZE_UNTIL_KEY = 'potager_manual_export_snooze_until';

export const AUTO_BACKUP_UPDATED_EVENT = 'potager_autobackup_updated';
export const MANUAL_EXPORT_UPDATED_EVENT = 'potager_manual_export_updated';

export interface ManualExportReminderStatus {
  intervalDays: number;
  lastExportAt: string | null;
  daysSinceLastExport: number | null;
  snoozedUntil: number | null;
  isDue: boolean;
}

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

export const getFrequencyIntervalMs = (frequency: string): number => {
  switch (frequency) {
    case '4h':
      return 4 * 60 * 60 * 1000;
    case 'daily':
      return 24 * 60 * 60 * 1000;
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000;
    case 'never':
    default:
      return Number.POSITIVE_INFINITY;
  }
};

export const formatBackupSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
};

let activeBackupRunPromise: Promise<AutoBackupCreateResult> | null = null;
let schedulerCleanup: (() => void) | null = null;
let lastVisibilityCheckAt = 0;

export const backupService = {
  getManualExportReminderDays(): number {
    try {
      const raw = localStorage.getItem(LS_MANUAL_REMINDER_DAYS_KEY);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
    } catch {}
    return 7; // Weekly by default
  },

  setManualExportReminderDays(days: number) {
    try {
      localStorage.setItem(LS_MANUAL_REMINDER_DAYS_KEY, String(Math.max(0, days)));
      localStorage.removeItem(LS_MANUAL_SNOOZE_UNTIL_KEY);
    } catch {}
    window.dispatchEvent(new CustomEvent(MANUAL_EXPORT_UPDATED_EVENT));
  },

  getLastManualExportAt(): string | null {
    try {
      return localStorage.getItem(LS_LAST_MANUAL_EXPORT_KEY);
    } catch {
      return null;
    }
  },

  markManualExportDone(dateIso: string = new Date().toISOString()) {
    try {
      localStorage.setItem(LS_LAST_MANUAL_EXPORT_KEY, dateIso);
      localStorage.removeItem(LS_MANUAL_SNOOZE_UNTIL_KEY);
    } catch {}
    window.dispatchEvent(new CustomEvent(MANUAL_EXPORT_UPDATED_EVENT));
  },

  snoozeManualExportReminder(hours: number = 24) {
    try {
      const until = Date.now() + hours * 60 * 60 * 1000;
      localStorage.setItem(LS_MANUAL_SNOOZE_UNTIL_KEY, String(until));
    } catch {}
    window.dispatchEvent(new CustomEvent(MANUAL_EXPORT_UPDATED_EVENT));
  },

  getManualExportReminderStatus(): ManualExportReminderStatus {
    const intervalDays = this.getManualExportReminderDays();
    const lastExportAt = this.getLastManualExportAt();
    let snoozedUntil: number | null = null;
    try {
      const rawSnooze = localStorage.getItem(LS_MANUAL_SNOOZE_UNTIL_KEY);
      if (rawSnooze) {
        const parsed = parseInt(rawSnooze, 10);
        if (Number.isFinite(parsed) && parsed > Date.now()) {
          snoozedUntil = parsed;
        }
      }
    } catch {}

    let daysSinceLastExport: number | null = null;
    if (lastExportAt) {
      const lastMs = new Date(lastExportAt).getTime();
      if (Number.isFinite(lastMs)) {
        daysSinceLastExport = Math.max(0, Math.floor((Date.now() - lastMs) / (24 * 60 * 60 * 1000)));
      }
    }

    const isSnoozed = snoozedUntil !== null && snoozedUntil > Date.now();
    const isDue =
      intervalDays > 0 &&
      !isSnoozed &&
      (daysSinceLastExport === null || daysSinceLastExport >= intervalDays);

    return {
      intervalDays,
      lastExportAt,
      daysSinceLastExport,
      snoozedUntil,
      isDue
    };
  },

  async exportJsonFile(includePhotos: boolean = true): Promise<{
    cancelled?: boolean;
    filename: string;
    totalItems: number;
    sizeBytes: number;
  }> {
    const results = await Promise.all(
      ALL_BACKUP_COLLECTIONS.map((col) => fb.getAll<any>(col, false))
    );
    const rawMap: Record<string, any[]> = {};
    let totalItems = 0;
    ALL_BACKUP_COLLECTIONS.forEach((col, index) => {
      const arr = Array.isArray(results[index]) ? results[index] : [];
      rawMap[col] = arr;
      totalItems += arr.length;
    });

    const exportData: Record<string, any> = {
      seedlings: includePhotos ? rawMap.seedlings : rawMap.seedlings.map(stripPhotosFromItem),
      journal: includePhotos ? rawMap.journal : rawMap.journal.map(stripPhotosFromItem),
      config: rawMap.config,
      trees: includePhotos ? rawMap.trees : rawMap.trees.map(stripPhotosFromItem),
      structures: rawMap.structures,
      tasks: rawMap.tasks,
      encyclopedia: rawMap.encyclopedia,
      healthIssues: rawMap.healthIssues,
      expenses: rawMap.expenses,
      perpetualTasks: includePhotos
        ? rawMap.perpetualTasks
        : rawMap.perpetualTasks.map(stripPhotosFromItem),
      seasons: rawMap.seasons,
      version: 1,
      includePhotos,
      timestamp: new Date().toISOString()
    };

    const jsonString = JSON.stringify(exportData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `potager_backup_${new Date().toISOString().split('T')[0]}${
      includePhotos ? '_full' : '_simple'
    }.json`;

    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Fichier de sauvegarde JSON',
              accept: { 'application/json': ['.json'] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.markManualExportDone();
        return { filename, totalItems, sizeBytes: jsonString.length };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { cancelled: true, filename, totalItems, sizeBytes: jsonString.length };
      }
      console.warn('showSaveFilePicker failed, falling back to standard download', err);
    }

    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', url);
    downloadAnchorNode.setAttribute('download', filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);

    this.markManualExportDone();
    return { filename, totalItems, sizeBytes: jsonString.length };
  },
  isAutoBackupEnabled(): boolean {
    try {
      return localStorage.getItem(LS_ENABLED_KEY) !== 'false';
    } catch {
      return true;
    }
  },

  setAutoBackupEnabled(enabled: boolean) {
    try {
      localStorage.setItem(LS_ENABLED_KEY, enabled ? 'true' : 'false');
      if (enabled) {
        const light = this.getLightFrequency();
        const full = this.getFullFrequency();
        if (light === 'never' && full === 'never') {
          localStorage.setItem(LS_FREQ_LIGHT_KEY, 'daily');
          localStorage.setItem(LS_FREQ_FULL_KEY, 'weekly');
        }
      }
    } catch {}
    window.dispatchEvent(new CustomEvent(AUTO_BACKUP_UPDATED_EVENT));
    this.initAutoBackup();
  },

  getLightFrequency(): AutoBackupFrequency {
    try {
      const val = localStorage.getItem(LS_FREQ_LIGHT_KEY);
      if (val === 'never' || val === '4h' || val === 'daily' || val === 'weekly') return val;
    } catch {}
    return 'daily';
  },

  getFullFrequency(): AutoBackupFrequency {
    try {
      const val = localStorage.getItem(LS_FREQ_FULL_KEY);
      if (val === 'never' || val === '4h' || val === 'daily' || val === 'weekly') return val;
    } catch {}
    return 'weekly';
  },

  setLightFrequency(freq: AutoBackupFrequency) {
    try {
      localStorage.setItem(LS_FREQ_LIGHT_KEY, freq);
      if (freq !== 'never') {
        localStorage.setItem(LS_ENABLED_KEY, 'true');
      }
    } catch {}
    window.dispatchEvent(new CustomEvent(AUTO_BACKUP_UPDATED_EVENT));
    this.initAutoBackup();
  },

  setFullFrequency(freq: AutoBackupFrequency) {
    try {
      localStorage.setItem(LS_FREQ_FULL_KEY, freq);
      if (freq !== 'never') {
        localStorage.setItem(LS_ENABLED_KEY, 'true');
      }
    } catch {}
    window.dispatchEvent(new CustomEvent(AUTO_BACKUP_UPDATED_EVENT));
    this.initAutoBackup();
  },

  async createBackup(
    type: 'auto' | 'manual' = 'auto',
    includePhotos: boolean = false
  ): Promise<AutoBackupCreateResult> {
    if (activeBackupRunPromise) {
      return activeBackupRunPromise;
    }

    const run = async (): Promise<AutoBackupCreateResult> => {
      try {
        const uid = await getTargetUid();
        if (!uid) {
          return { created: false, reason: 'no_user' };
        }

        const results = await Promise.all(
          ALL_BACKUP_COLLECTIONS.map((col) => fb.getAll<any>(col, false))
        );

        const rawMap: Record<string, any[]> = {};
        let totalItems = 0;
        ALL_BACKUP_COLLECTIONS.forEach((col, index) => {
          const arr = Array.isArray(results[index]) ? results[index] : [];
          rawMap[col] = arr;
          totalItems += arr.length;
        });

        // Never overwrite valid auto-backups with an empty unhydrated dataset
        if (totalItems === 0) {
          return { created: false, reason: 'empty' };
        }

        const exportData: Record<string, any> = {
          seedlings: includePhotos
            ? rawMap.seedlings
            : rawMap.seedlings.map(stripPhotosFromItem),
          journal: includePhotos
            ? rawMap.journal
            : rawMap.journal.map(stripPhotosFromItem),
          config: rawMap.config,
          trees: includePhotos
            ? rawMap.trees
            : rawMap.trees.map(stripPhotosFromItem),
          structures: rawMap.structures,
          tasks: rawMap.tasks,
          encyclopedia: rawMap.encyclopedia,
          healthIssues: rawMap.healthIssues,
          expenses: rawMap.expenses,
          perpetualTasks: includePhotos
            ? rawMap.perpetualTasks
            : rawMap.perpetualTasks.map(stripPhotosFromItem),
          seasons: rawMap.seasons,
          version: 1,
          includePhotos,
          timestamp: new Date().toISOString()
        };

        const dataString = JSON.stringify(exportData);
        const sizeBytes = dataString.length;
        const id = uuidv4();
        const date = new Date().toISOString();

        // 1. Always save locally in IndexedDB (no 1MB limit -> supports >20MB full backups with photos)
        const idbRecord: LocalAutoBackupRecord = {
          id,
          uid,
          date,
          type,
          includePhotos,
          sizeBytes,
          itemCount: totalItems,
          data: dataString
        };
        await saveAutoBackupInIdb(idbRecord);
        await pruneAutoBackupsInIdb(uid, includePhotos, includePhotos ? 5 : 10);

        // 2. Also save lightweight copy (< 900 KB) to Firestore Cloud when enabled & under quota
        let savedCloud = false;
        const quotaStats = getFirebaseQuotaStats();
        if (
          !includePhotos &&
          sizeBytes <= 900_000 &&
          !getLocalOnlyMode() &&
          !quotaStats.isQuotaExceeded
        ) {
          try {
            await fb.put('backups', {
              id,
              date,
              data: dataString,
              type,
              includePhotos: false,
              sizeBytes,
              itemCount: totalItems
            });
            savedCloud = true;

            // Keep last 5 lightweight auto-backups in Firestore
            const allCloud = await fb.getAll<any>('backups', false);
            const cloudAutos = allCloud
              .filter((b) => b.type === 'auto' && !b.includePhotos)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            if (cloudAutos.length > 5) {
              const obsoleteIds = cloudAutos.slice(5).map((b) => String(b.id));
              await fb.batchDelete('backups', obsoleteIds);
            }
          } catch (cloudErr) {
            console.warn('[BackupService] Cloud save skipped (saved in IndexedDB):', cloudErr);
          }
        }

        try {
          localStorage.setItem(includePhotos ? LS_LAST_FULL_KEY : LS_LAST_LIGHT_KEY, date);
        } catch {}

        window.dispatchEvent(new CustomEvent(AUTO_BACKUP_UPDATED_EVENT));
        console.log(
          `[BackupService] ${type} backup created (${formatBackupSize(sizeBytes)}, ${totalItems} fiches, photos=${includePhotos}, local=true, cloud=${savedCloud}).`
        );

        return {
          created: true,
          id,
          date,
          sizeBytes,
          itemCount: totalItems,
          savedLocal: true,
          savedCloud
        };
      } catch (error) {
        console.error('[BackupService] Error creating backup:', error);
        return {
          created: false,
          reason: error instanceof Error ? error.message : 'unknown_error'
        };
      } finally {
        activeBackupRunPromise = null;
      }
    };

    activeBackupRunPromise = run();
    return activeBackupRunPromise;
  },

  async listMergedAutoBackups(cloudBackups?: any[]): Promise<AutoBackupSummary[]> {
    const uid = await getTargetUid();
    const idbList = uid ? await listAutoBackupsFromIdb(uid) : [];
    const cloudList = Array.isArray(cloudBackups)
      ? cloudBackups
      : await fb.getAll<any>('backups', false);

    const byId = new Map<string, AutoBackupSummary>();

    for (const rec of idbList) {
      if (rec.type !== 'auto') continue;
      byId.set(rec.id, {
        id: rec.id,
        date: rec.date,
        type: rec.type,
        includePhotos: Boolean(rec.includePhotos),
        sizeBytes: rec.sizeBytes || rec.data?.length || 0,
        itemCount: rec.itemCount || 0,
        hasLocal: true,
        hasCloud: false
      });
    }

    for (const rec of cloudList || []) {
      if (!rec || rec.type !== 'auto') continue;
      const existing = byId.get(rec.id);
      if (existing) {
        existing.hasCloud = true;
      } else {
        byId.set(rec.id, {
          id: rec.id,
          date: rec.date,
          type: 'auto',
          includePhotos: Boolean(rec.includePhotos),
          sizeBytes: rec.sizeBytes || (typeof rec.data === 'string' ? rec.data.length : 0),
          itemCount: rec.itemCount || 0,
          hasLocal: false,
          hasCloud: true
        });
      }
    }

    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  async getBackupPayload(id: string): Promise<{ rawText: string; data: any } | null> {
    const localRec = await getAutoBackupFromIdb(id);
    if (localRec?.data) {
      return {
        rawText: localRec.data,
        data: JSON.parse(localRec.data)
      };
    }

    const cloudRec = await fb.get<any>('backups', id);
    if (cloudRec?.data) {
      return {
        rawText: cloudRec.data,
        data: JSON.parse(cloudRec.data)
      };
    }

    return null;
  },

  async deleteAutoBackup(id: string): Promise<void> {
    await deleteAutoBackupFromIdb(id);
    try {
      const cloudRec = await fb.get<any>('backups', id);
      if (cloudRec) {
        await fb.delete('backups', id);
      }
    } catch {}
    window.dispatchEvent(new CustomEvent(AUTO_BACKUP_UPDATED_EVENT));
  },

  async restoreFromBackup(backupId: string, merge: boolean = false) {
    const payload = await this.getBackupPayload(backupId);
    if (!payload) throw new Error('Sauvegarde non trouvée');
    const { data } = payload;

    for (const col of ALL_BACKUP_COLLECTIONS) {
      if (!merge) {
        if (col === 'seasons' && !Array.isArray(data.seasons)) continue;
        await fb.clearLocalCollection(col);
      }
      if (Array.isArray(data[col]) && data[col].length > 0) {
        await fb.batchPut(col, data[col], { replaceLocal: !merge });
      }
    }

    return true;
  },

  async checkAndRunAutoBackup(): Promise<{ ranLight: boolean; ranFull: boolean }> {
    if (!this.isAutoBackupEnabled()) {
      return { ranLight: false, ranFull: false };
    }

    const uid = await getTargetUid();
    if (!uid) {
      return { ranLight: false, ranFull: false };
    }

    const freqLight = this.getLightFrequency();
    const freqFull = this.getFullFrequency();
    const idbBackups = await listAutoBackupsFromIdb(uid);

    const checkOne = async (includePhotos: boolean, frequency: AutoBackupFrequency): Promise<boolean> => {
      if (frequency === 'never') return false;
      const intervalMs = getFrequencyIntervalMs(frequency);

      const latestRecord = idbBackups.find(
        (b) => b.type === 'auto' && Boolean(b.includePhotos) === includePhotos
      );
      const lsDate = localStorage.getItem(includePhotos ? LS_LAST_FULL_KEY : LS_LAST_LIGHT_KEY);
      const latestDateStr = latestRecord?.date || lsDate;
      const lastTime = latestDateStr ? new Date(latestDateStr).getTime() : 0;

      if (!Number.isFinite(lastTime) || Date.now() - lastTime >= intervalMs) {
        const res = await this.createBackup('auto', includePhotos);
        return res.created;
      }
      return false;
    };

    const ranLight = await checkOne(false, freqLight);
    const ranFull = await checkOne(true, freqFull);
    return { ranLight, ranFull };
  },

  initAutoBackup() {
    if (schedulerCleanup) {
      schedulerCleanup();
      schedulerCleanup = null;
    }

    if (!this.isAutoBackupEnabled()) {
      return () => {};
    }

    const startupTimer = window.setTimeout(() => {
      void this.checkAndRunAutoBackup();
    }, 8000);

    const periodicTimer = window.setInterval(() => {
      void this.checkAndRunAutoBackup();
    }, 15 * 60 * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastVisibilityCheckAt > 5 * 60 * 1000) {
          lastVisibilityCheckAt = now;
          void this.checkAndRunAutoBackup();
        }
      }
    };

    const handleUidResolved = () => {
      window.setTimeout(() => {
        void this.checkAndRunAutoBackup();
      }, 4000);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('targetUidResolved', handleUidResolved);

    const cleanup = () => {
      window.clearTimeout(startupTimer);
      window.clearInterval(periodicTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('targetUidResolved', handleUidResolved);
    };

    schedulerCleanup = cleanup;
    return cleanup;
  }
};
