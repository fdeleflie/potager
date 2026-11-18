import Dexie, { Table } from 'dexie';

export interface CachedCollectionRecord {
  key: string;
  items: any[];
  updatedAt: number;
}

export interface LocalAutoBackupRecord {
  id: string;
  uid: string;
  date: string;
  type: 'auto' | 'manual';
  includePhotos: boolean;
  sizeBytes: number;
  itemCount: number;
  data: string;
}

class PotagerLocalCacheDatabase extends Dexie {
  collections!: Table<CachedCollectionRecord, string>;
  autoBackups!: Table<LocalAutoBackupRecord, string>;

  constructor() {
    super('potager_local_cache_v1');
    this.version(1).stores({
      collections: 'key, updatedAt'
    });
    this.version(2).stores({
      collections: 'key, updatedAt',
      autoBackups: 'id, uid, date, includePhotos'
    });
  }
}

const localCacheDb = new PotagerLocalCacheDatabase();

const migrateLegacyLocalStorageKey = async (key: string): Promise<any[] | null> => {
  try {
    const lsKey = `potager_cache_${key}`;
    const raw = localStorage.getItem(lsKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      await localCacheDb.collections.put({
        key,
        items: parsed,
        updatedAt: Date.now()
      });
      localStorage.removeItem(lsKey);
      return parsed;
    }
    localStorage.removeItem(lsKey);
  } catch (err) {
    console.warn('Legacy localStorage migration warning for', key, err);
  }
  return null;
};

export const cleanupLegacyLocalStorageCaches = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('potager_cache_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Could not clean legacy localStorage caches', err);
  }
};

export const getCollectionFromIdb = async (key: string): Promise<any[] | null> => {
  try {
    const record = await localCacheDb.collections.get(key);
    if (record && Array.isArray(record.items)) {
      return record.items;
    }
    return await migrateLegacyLocalStorageKey(key);
  } catch (err) {
    console.warn('Could not read from IndexedDB cache:', key, err);
    return null;
  }
};

export const setCollectionInIdb = async (key: string, items: any[]): Promise<void> => {
  try {
    await localCacheDb.collections.put({
      key,
      items: Array.isArray(items) ? items : [],
      updatedAt: Date.now()
    });
    // Ensure old localStorage entry is cleared so 5MB quota never overflows
    try {
      localStorage.removeItem(`potager_cache_${key}`);
    } catch {}
  } catch (err) {
    console.warn('Could not save to IndexedDB cache:', key, err);
  }
};

export const clearCollectionInIdb = async (key: string): Promise<void> => {
  try {
    await localCacheDb.collections.delete(key);
    try {
      localStorage.removeItem(`potager_cache_${key}`);
      localStorage.removeItem(`potager_sync_time_${key}`);
    } catch {}
  } catch (err) {
    console.warn('Could not delete from IndexedDB cache:', key, err);
  }
};

export const getAllIdbCollectionsForUid = async (uid: string): Promise<Record<string, any[]>> => {
  const result: Record<string, any[]> = {};
  try {
    const prefix = `${uid}_`;
    const all = await localCacheDb.collections.toArray();
    for (const rec of all) {
      if (rec.key.startsWith(prefix) && Array.isArray(rec.items)) {
        const collName = rec.key.slice(prefix.length);
        result[collName] = rec.items;
      }
    }
  } catch (err) {
    console.warn('Could not list IndexedDB collections:', err);
  }
  return result;
};

export const saveAutoBackupInIdb = async (record: LocalAutoBackupRecord): Promise<void> => {
  await localCacheDb.autoBackups.put(record);
};

export const listAutoBackupsFromIdb = async (uid: string): Promise<LocalAutoBackupRecord[]> => {
  try {
    const records = await localCacheDb.autoBackups.where('uid').equals(uid).toArray();
    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (err) {
    console.warn('Could not list IndexedDB auto backups:', err);
    return [];
  }
};

export const getAutoBackupFromIdb = async (id: string): Promise<LocalAutoBackupRecord | undefined> => {
  try {
    return await localCacheDb.autoBackups.get(id);
  } catch (err) {
    console.warn('Could not read IndexedDB auto backup:', err);
    return undefined;
  }
};

export const deleteAutoBackupFromIdb = async (id: string): Promise<void> => {
  try {
    await localCacheDb.autoBackups.delete(id);
  } catch (err) {
    console.warn('Could not delete IndexedDB auto backup:', err);
  }
};

export const pruneAutoBackupsInIdb = async (
  uid: string,
  includePhotos: boolean,
  keepCount: number
): Promise<void> => {
  try {
    const all = await listAutoBackupsFromIdb(uid);
    const matching = all.filter((b) => Boolean(b.includePhotos) === Boolean(includePhotos));
    if (matching.length > keepCount) {
      const toDelete = matching.slice(keepCount).map((b) => b.id);
      await localCacheDb.autoBackups.bulkDelete(toDelete);
    }
  } catch (err) {
    console.warn('Could not prune IndexedDB auto backups:', err);
  }
};
