import { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  deleteField,
  writeBatch
} from 'firebase/firestore';
import { dbFirebase, auth } from '../firebase';
import {
  getCollectionFromIdb,
  setCollectionInIdb,
  clearCollectionInIdb,
  cleanupLegacyLocalStorageCaches,
  getAllIdbCollectionsForUid
} from '../services/localCacheDb';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function logFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const isQuotaError = (err: any): boolean => {
  const msg = String(err?.message || '');
  return (
    msg.includes('Quota') ||
    msg.includes('quota') ||
    msg.includes('Free daily read units') ||
    err?.code === 'resource-exhausted'
  );
};

// Free up bloated legacy localStorage keys at startup so stats & settings never fail
cleanupLegacyLocalStorageCaches();

const globalCache = new Map<string, { data: any[]; error: string | null; source?: 'idb' | 'server' | 'memory' }>();
const activeListeners = new Map<string, () => void>();
const updateCallbacks = new Map<string, Set<() => void>>();
const idbHydrationPromises = new Map<string, Promise<any[] | null>>();

let resolvedTargetUid: string | null = null;
let resolvePromise: Promise<string | null> | null = null;
let bulkOperationActive = false;

export const setBulkOperationActive = (active: boolean) => {
  bulkOperationActive = active;
};

export const getLocalOnlyMode = (): boolean => {
  try {
    return localStorage.getItem('potager_local_only_mode') === 'true';
  } catch {
    return false;
  }
};

export const setLocalOnlyMode = (enabled: boolean) => {
  try {
    localStorage.setItem('potager_local_only_mode', enabled ? 'true' : 'false');
    window.dispatchEvent(new Event('firebase_reads_updated'));
  } catch {}
};

export const getPendingCloudSync = (): boolean => {
  try {
    return localStorage.getItem('potager_pending_cloud_sync') === 'true';
  } catch {
    return false;
  }
};

export const setPendingCloudSync = (pending: boolean) => {
  try {
    if (pending) {
      localStorage.setItem('potager_pending_cloud_sync', 'true');
    } else {
      localStorage.removeItem('potager_pending_cloud_sync');
    }
    window.dispatchEvent(new Event('potager_local_sync_status_changed'));
  } catch {}
};

export const deduplicateById = <T extends { id?: string }>(items: T[]): T[] => {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item) continue;
    const id = item.id;
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    result.push(item);
  }
  return result;
};

export const getLocalCache = (key: string): any[] | null => {
  const inMem = globalCache.get(key)?.data;
  if (inMem) return deduplicateById(inMem);
  try {
    const raw = localStorage.getItem(`potager_cache_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? deduplicateById(parsed) : null;
  } catch {
    return null;
  }
};

export const setLocalCache = (key: string, data: any[]) => {
  const cleaned = Array.isArray(data) ? deduplicateById(data) : [];
  // Persist asynchronously into IndexedDB (no 5MB limit)
  void setCollectionInIdb(key, cleaned);
};

const hydrateKeyFromIdb = async (key: string): Promise<any[] | null> => {
  if (globalCache.has(key)) {
    return globalCache.get(key)!.data;
  }
  if (!idbHydrationPromises.has(key)) {
    const p = getCollectionFromIdb(key)
      .then((items) => {
        if (items && Array.isArray(items)) {
          const cleaned = deduplicateById(items);
          const existing = globalCache.get(key);
          // Do not overwrite if server already populated globalCache with fresher data
          if (!existing || existing.source !== 'server') {
            globalCache.set(key, { data: cleaned, error: null, source: 'idb' });
            updateCallbacks.get(key)?.forEach((cb) => cb());
          }
          return cleaned;
        }
        return null;
      })
      .finally(() => {
        idbHydrationPromises.delete(key);
      });
    idbHydrationPromises.set(key, p);
  }
  return idbHydrationPromises.get(key)!;
};

export const getTargetUid = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  if (resolvedTargetUid) return resolvedTargetUid;

  if (user.email === 'kdeleflie@gmail.com') {
    if (!resolvePromise) {
      resolvePromise = (async () => {
        try {
          const ref = doc(dbFirebase, 'public_shares', 'fdeleflie');
          const snap = await getDoc(ref);
          if (snap.exists()) {
            return snap.data().uid;
          }
        } catch (e) {
          console.error('Failed to load francois UID', e);
        }
        return user.uid; // fallback
      })();
    }
    resolvedTargetUid = await resolvePromise;
    return resolvedTargetUid;
  }

  resolvedTargetUid = user.uid;
  return resolvedTargetUid;
};

auth.onAuthStateChanged((user) => {
  if (!user) {
    resolvedTargetUid = null;
    resolvePromise = null;
    activeListeners.forEach((unsub) => unsub());
    activeListeners.clear();
    globalCache.clear();
    updateCallbacks.forEach((cbs) => cbs.forEach((cb) => cb()));
  } else {
    getTargetUid().then(async (uid) => {
      if (uid) {
        try {
          const idbCollections = await getAllIdbCollectionsForUid(uid);
          for (const [collName, items] of Object.entries(idbCollections)) {
            const key = `${uid}_${collName}`;
            if (!globalCache.has(key)) {
              globalCache.set(key, { data: deduplicateById(items), error: null, source: 'idb' });
            }
          }
        } catch (err) {
          console.warn('Pre-hydration from IndexedDB failed:', err);
        }
      }
      window.dispatchEvent(new Event('targetUidResolved'));
    });
  }
});

export const PRIORITY_COLLECTIONS = ['journal', 'perpetualTasks', 'seedlings', 'trees', 'tasks', 'config'];
export const SECONDARY_COLLECTIONS = ['encyclopedia', 'healthIssues', 'expenses', 'structures', 'backups'];

export const SPARK_DAILY_READ_LIMIT = 50000;
export const MARGIN_THRESHOLD_READS = 35000;
export const MARGIN_RESERVED_READS = 15000;

export interface QuotaStats {
  readsToday: number;
  writesToday: number;
  maxDailyReads: number;
  maxDailyWrites: number;
  readPercent: number;
  isQuotaExceeded: boolean;
  isMarginActive: boolean;
  manualEconomy: boolean;
  remainingReads: number;
  marginReservedReads: number;
  lastPrioritySyncTime: string | null;
}

export const getFirebaseQuotaStats = (): QuotaStats => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const readsStr = localStorage.getItem('firebase_reads_stats');
    const writesStr = localStorage.getItem('firebase_writes_stats');
    const manualEconomy = localStorage.getItem('firebase_force_economy_mode') === 'true';
    const quotaExceededFlag = sessionStorage.getItem('firebase_quota_exceeded_today') === today;
    const lastPrioritySyncTime = localStorage.getItem('firebase_last_priority_sync');

    let readsToday = 0;
    if (readsStr) {
      const stats = JSON.parse(readsStr);
      readsToday = stats[today] || 0;
    }

    let writesToday = 0;
    if (writesStr) {
      const stats = JSON.parse(writesStr);
      writesToday = stats[today] || 0;
    }

    const isQuotaExceeded = quotaExceededFlag || readsToday >= SPARK_DAILY_READ_LIMIT;
    const isMarginActive = isQuotaExceeded || manualEconomy || readsToday >= MARGIN_THRESHOLD_READS;
    const readPercent = Math.min(100, Math.round((readsToday / SPARK_DAILY_READ_LIMIT) * 100));
    const remainingReads = Math.max(0, SPARK_DAILY_READ_LIMIT - readsToday);

    return {
      readsToday,
      writesToday,
      maxDailyReads: SPARK_DAILY_READ_LIMIT,
      maxDailyWrites: 20000,
      readPercent,
      isQuotaExceeded,
      isMarginActive,
      manualEconomy,
      remainingReads,
      marginReservedReads: MARGIN_RESERVED_READS,
      lastPrioritySyncTime,
    };
  } catch (e) {
    console.error('Failed to get firebase quota stats', e);
    return {
      readsToday: 0,
      writesToday: 0,
      maxDailyReads: SPARK_DAILY_READ_LIMIT,
      maxDailyWrites: 20000,
      readPercent: 0,
      isQuotaExceeded: false,
      isMarginActive: false,
      manualEconomy: false,
      remainingReads: SPARK_DAILY_READ_LIMIT,
      marginReservedReads: MARGIN_RESERVED_READS,
      lastPrioritySyncTime: null,
    };
  }
};

export const trackFirebaseRead = (count: number = 1) => {
  if (count <= 0) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const readsStr = localStorage.getItem('firebase_reads_stats');
    let stats: Record<string, number> = {};
    if (readsStr) {
      stats = JSON.parse(readsStr);
    }
    stats[today] = (stats[today] || 0) + count;
    localStorage.setItem('firebase_reads_stats', JSON.stringify(stats));

    window.dispatchEvent(
      new CustomEvent('firebase_reads_updated', {
        detail: { readsToday: stats[today], added: count },
      })
    );
  } catch (e) {
    console.error('Failed to track firebase read', e);
  }
};

export const setManualEconomyMode = (enabled: boolean) => {
  localStorage.setItem('firebase_force_economy_mode', enabled ? 'true' : 'false');
  window.dispatchEvent(new Event('firebase_reads_updated'));
};

export const getFirebaseWriteCount = () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsStr = localStorage.getItem('firebase_writes_stats');
    if (statsStr) {
      const stats = JSON.parse(statsStr);
      return stats[today] || 0;
    }
  } catch (e) {
    console.error('Failed to get firebase write count', e);
  }
  return 0;
};

const trackFirebaseWrite = (count: number = 1) => {
  if (count <= 0) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsStr = localStorage.getItem('firebase_writes_stats');
    let stats: Record<string, number> = {};
    if (statsStr) {
      stats = JSON.parse(statsStr);
    }
    stats[today] = (stats[today] || 0) + count;
    localStorage.setItem('firebase_writes_stats', JSON.stringify(stats));

    window.dispatchEvent(new Event('firebase_writes_updated'));
  } catch (e) {
    console.error('Failed to track firebase write', e);
  }
};

export function useFirebaseData<T>(collectionName: string) {
  const [uid, setUid] = useState<string | null>(resolvedTargetUid);

  useEffect(() => {
    if (!resolvedTargetUid && auth.currentUser) {
      getTargetUid().then((resolved) => setUid(resolved));
    } else {
      setUid(resolvedTargetUid);
    }

    const handleUidResolve = () => setUid(resolvedTargetUid);
    window.addEventListener('targetUidResolved', handleUidResolve);
    return () => window.removeEventListener('targetUidResolved', handleUidResolve);
  }, []);

  const key = uid ? `${uid}_${collectionName}` : null;

  const [data, setData] = useState<T[]>(() => {
    if (!key) return [];
    const inMem = globalCache.get(key)?.data;
    if (inMem) return inMem as T[];
    return [];
  });
  const [error, setError] = useState<string | null>(key ? globalCache.get(key)?.error || null : null);

  useEffect(() => {
    if (!uid || !key) {
      setData([]);
      setError(null);
      return;
    }

    let isCancelled = false;

    const triggerUpdate = () => {
      if (isCancelled) return;
      const state = globalCache.get(key);
      if (state) {
        setData(state.data as T[]);
        setError(state.error);
      }
    };

    if (!updateCallbacks.has(key)) {
      updateCallbacks.set(key, new Set());
    }
    updateCallbacks.get(key)!.add(triggerUpdate);

    const setupListener = async () => {
      // 1. Hydrate from IndexedDB first (fast, supports 20MB+ backups with photos)
      if (globalCache.has(key)) {
        triggerUpdate();
      } else {
        await hydrateKeyFromIdb(key);
        triggerUpdate();
      }

      if (isCancelled) return;

      const isPriority = PRIORITY_COLLECTIONS.includes(collectionName);
      const quotaStats = getFirebaseQuotaStats();
      const localOnlyMode = getLocalOnlyMode();
      const cachedItems = globalCache.get(key)?.data || [];
      const hasLocalData = cachedItems.length > 0;
      const cacheTimestamp = localStorage.getItem(`potager_sync_time_${key}`);
      const isRecentlySynced =
        cacheTimestamp && Date.now() - parseInt(cacheTimestamp, 10) < 24 * 60 * 60 * 1000;

      // Skip live Firestore listener if:
      // - Local-only mode is enabled and we have data
      // - Quota is exceeded and we already have local IndexedDB data
      // - Secondary collection already cached & (margin active or recently synced within 24h)
      if (localOnlyMode && hasLocalData) {
        return;
      }
      if (quotaStats.isQuotaExceeded && hasLocalData) {
        return;
      }
      if (!isPriority && hasLocalData && (quotaStats.isMarginActive || isRecentlySynced)) {
        return;
      }

      if (!activeListeners.has(key)) {
        activeListeners.set(key, () => {});
        const collPath = `users/${uid}/${collectionName}`;
        try {
          const q = query(collection(dbFirebase, collPath));
          const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              // While a bulk import/restore is running, avoid overwriting local IndexedDB from intermediate snapshots
              if (bulkOperationActive) return;

              const isFromCache = snapshot.metadata?.fromCache === true;
              const currentData = deduplicateById(globalCache.get(key)?.data || []);

              // If Firestore returned 0 documents while IndexedDB has pending unsynced data or snapshot came from stale offline SDK cache, keep local data safe
              if (snapshot.docs.length === 0 && currentData.length > 0 && (getPendingCloudSync() || isFromCache)) {
                return;
              }

              let updatedItems: any[] = [];
              let docsReadCount = 0;

              if (
                currentData.length === 0 ||
                snapshot.docChanges().length > snapshot.docs.length / 2
              ) {
                updatedItems = deduplicateById(
                  snapshot.docs.map((docSnapshot) => ({
                    ...docSnapshot.data(),
                    id: docSnapshot.id,
                  }))
                );
                docsReadCount = snapshot.docs.length;
              } else {
                const newData = [...currentData];
                snapshot.docChanges().forEach((change) => {
                  const docData = { ...change.doc.data(), id: change.doc.id };
                  const index = newData.findIndex((item) => item.id === change.doc.id);
                  if (change.type === 'added' || change.type === 'modified') {
                    if (index !== -1) {
                      newData[index] = docData;
                    } else {
                      newData.push(docData);
                    }
                  }
                  if (change.type === 'removed') {
                    if (index !== -1) newData.splice(index, 1);
                  }
                });
                updatedItems = deduplicateById(newData);
                docsReadCount = snapshot.docChanges().length;
              }

              // Only count actual server reads (never IndexedDB/persistentLocalCache snapshots!)
              if (!isFromCache && docsReadCount > 0) {
                trackFirebaseRead(docsReadCount);
              }

              globalCache.set(key, {
                data: updatedItems,
                error: null,
                source: isFromCache ? 'idb' : 'server',
              });
              void setCollectionInIdb(key, updatedItems);
              if (!isFromCache) {
                try {
                  localStorage.setItem(`potager_sync_time_${key}`, Date.now().toString());
                } catch {}
              }
              updateCallbacks.get(key)?.forEach((cb) => cb());
            },
            (err: any) => {
              let errorMsg =
                err.message || 'Une erreur est survenue lors de la récupération des données.';
              const isQuota = isQuotaError(err);

              if (isQuota) {
                const today = new Date().toISOString().split('T')[0];
                sessionStorage.setItem('firebase_quota_exceeded_today', today);
                errorMsg = 'Quota Firebase dépassé. L’application utilise le cache local.';
                console.warn(`Firebase quota warning for ${collectionName}: ${errorMsg}`);
                window.dispatchEvent(
                  new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
                );
              } else {
                logFirestoreError(err, OperationType.LIST, collPath);
              }

              const fallbackData = deduplicateById(globalCache.get(key)?.data || []);
              globalCache.set(key, {
                data: fallbackData,
                error: isQuota ? null : errorMsg,
                source: 'idb',
              });
              updateCallbacks.get(key)?.forEach((cb) => cb());
            }
          );
          activeListeners.set(key, unsubscribe);
        } catch (err: any) {
          console.warn(`Could not attach listener for ${collectionName}:`, err);
        }
      }
    };

    void setupListener();

    return () => {
      isCancelled = true;
      updateCallbacks.get(key)?.delete(triggerUpdate);
    };
  }, [collectionName, uid, key]);

  return { data, error };
}

export const fb = {
  getCollection: async (collectionName: string) => {
    const targetUid = await getTargetUid();
    if (!targetUid) throw new Error('No user logged in');
    return collection(dbFirebase, `users/${targetUid}/${collectionName}`);
  },
  getDoc: async (collectionName: string, id: string) => {
    const targetUid = await getTargetUid();
    if (!targetUid) throw new Error('No user logged in');
    return doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
  },
  add: async <T extends { id?: string }>(collectionName: string, data: T) => {
    const targetUid = await getTargetUid();
    const id = data.id || crypto.randomUUID();
    const dataToSave: any = { ...data, id, userId: targetUid || 'local' };
    const cleanedData: any = {};
    for (const key in dataToSave) {
      if (dataToSave[key] !== undefined) {
        cleanedData[key] = dataToSave[key];
      }
    }

    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const current = deduplicateById(
        globalCache.get(cacheKey)?.data || (await hydrateKeyFromIdb(cacheKey)) || []
      );
      const idx = current.findIndex((item: any) => item.id === id);
      const updated =
        idx !== -1
          ? current.map((item: any, i: number) => (i === idx ? cleanedData : item))
          : [...current, cleanedData];
      globalCache.set(cacheKey, { data: updated, error: null, source: 'memory' });
      await setCollectionInIdb(cacheKey, updated);
      updateCallbacks.get(cacheKey)?.forEach((cb) => cb());
    }

    if (targetUid && !getLocalOnlyMode()) {
      const docPath = `users/${targetUid}/${collectionName}/${id}`;
      try {
        const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
        await setDoc(docRef, cleanedData);
        trackFirebaseWrite(1);
      } catch (err: any) {
        console.warn(`Firestore add failed for ${docPath} (saved in IndexedDB):`, err);
        if (isQuotaError(err)) {
          const today = new Date().toISOString().split('T')[0];
          sessionStorage.setItem('firebase_quota_exceeded_today', today);
          setPendingCloudSync(true);
          window.dispatchEvent(
            new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
          );
        } else {
          logFirestoreError(err, OperationType.CREATE, docPath);
          setPendingCloudSync(true);
        }
      }
    } else if (targetUid) {
      setPendingCloudSync(true);
    }
    return id;
  },
  put: async <T extends { id: string }>(collectionName: string, data: T) => {
    const targetUid = await getTargetUid();
    const dataToSave: any = { ...data, userId: targetUid || 'local' };
    const cleanedData: any = {};
    for (const key in dataToSave) {
      if (dataToSave[key] !== undefined) {
        cleanedData[key] = dataToSave[key];
      }
    }

    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const current = deduplicateById(
        globalCache.get(cacheKey)?.data || (await hydrateKeyFromIdb(cacheKey)) || []
      );
      const idx = current.findIndex((item: any) => item.id === data.id);
      const updated =
        idx !== -1
          ? current.map((item: any, i: number) => (i === idx ? cleanedData : item))
          : [...current, cleanedData];
      globalCache.set(cacheKey, { data: updated, error: null, source: 'memory' });
      await setCollectionInIdb(cacheKey, updated);
      updateCallbacks.get(cacheKey)?.forEach((cb) => cb());
    }

    if (targetUid && !getLocalOnlyMode()) {
      const docPath = `users/${targetUid}/${collectionName}/${data.id}`;
      try {
        const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, data.id);
        await setDoc(docRef, cleanedData);
        trackFirebaseWrite(1);
      } catch (err: any) {
        console.warn(`Firestore put failed for ${docPath} (saved in IndexedDB):`, err);
        if (isQuotaError(err)) {
          const today = new Date().toISOString().split('T')[0];
          sessionStorage.setItem('firebase_quota_exceeded_today', today);
          setPendingCloudSync(true);
          window.dispatchEvent(
            new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
          );
        } else {
          logFirestoreError(err, OperationType.WRITE, docPath);
          setPendingCloudSync(true);
        }
      }
    } else if (targetUid) {
      setPendingCloudSync(true);
    }
    return data.id;
  },
  update: async (collectionName: string, id: string, data: any) => {
    const targetUid = await getTargetUid();

    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const current = deduplicateById(
        globalCache.get(cacheKey)?.data || (await hydrateKeyFromIdb(cacheKey)) || []
      );
      const idx = current.findIndex((item: any) => item.id === id);
      if (idx !== -1) {
        const updatedItem = { ...current[idx], ...data };
        const updated = current.map((item: any, i: number) => (i === idx ? updatedItem : item));
        globalCache.set(cacheKey, { data: updated, error: null, source: 'memory' });
        await setCollectionInIdb(cacheKey, updated);
        updateCallbacks.get(cacheKey)?.forEach((cb) => cb());
      }
    }

    if (targetUid && !getLocalOnlyMode()) {
      const docPath = `users/${targetUid}/${collectionName}/${id}`;
      try {
        const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
        const updateData: any = {};
        for (const key in data) {
          if (data[key] === undefined) {
            updateData[key] = deleteField();
          } else {
            updateData[key] = data[key];
          }
        }
        await updateDoc(docRef, updateData);
        trackFirebaseWrite(1);
      } catch (err: any) {
        console.warn(`Firestore update failed for ${docPath} (saved in IndexedDB):`, err);
        if (isQuotaError(err)) {
          const today = new Date().toISOString().split('T')[0];
          sessionStorage.setItem('firebase_quota_exceeded_today', today);
          setPendingCloudSync(true);
          window.dispatchEvent(
            new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
          );
        } else {
          logFirestoreError(err, OperationType.UPDATE, docPath);
          setPendingCloudSync(true);
        }
      }
    } else if (targetUid) {
      setPendingCloudSync(true);
    }
  },
  delete: async (collectionName: string, id: string) => {
    const targetUid = await getTargetUid();

    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const current = deduplicateById(
        globalCache.get(cacheKey)?.data || (await hydrateKeyFromIdb(cacheKey)) || []
      );
      const updated = current.filter((item: any) => item.id !== id);
      globalCache.set(cacheKey, { data: updated, error: null, source: 'memory' });
      await setCollectionInIdb(cacheKey, updated);
      updateCallbacks.get(cacheKey)?.forEach((cb) => cb());
    }

    if (targetUid && !getLocalOnlyMode()) {
      const docPath = `users/${targetUid}/${collectionName}/${id}`;
      try {
        const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
        await deleteDoc(docRef);
        trackFirebaseWrite(1);
      } catch (err: any) {
        console.warn(`Firestore delete failed for ${docPath} (removed in IndexedDB):`, err);
        if (isQuotaError(err)) {
          const today = new Date().toISOString().split('T')[0];
          sessionStorage.setItem('firebase_quota_exceeded_today', today);
          window.dispatchEvent(
            new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
          );
        } else {
          logFirestoreError(err, OperationType.DELETE, docPath);
        }
      }
    }
  },
  clearLocalCollection: async (collectionName: string) => {
    const targetUid = await getTargetUid();
    if (!targetUid) return;
    const cacheKey = `${targetUid}_${collectionName}`;
    globalCache.set(cacheKey, { data: [], error: null, source: 'idb' });
    await clearCollectionInIdb(cacheKey);
    updateCallbacks.get(cacheKey)?.forEach((cb) => cb());
  },
  batchDelete: async (
    collectionName: string,
    ids: string[],
    options?: {
      onProgress?: (done: number, total: number) => void;
      signal?: AbortSignal;
      localOnly?: boolean;
    }
  ) => {
    const targetUid = await getTargetUid();
    if (!ids || ids.length === 0) return;

    const validIds = ids.map((id) => (id == null ? '' : String(id))).filter(Boolean);
    if (validIds.length === 0) return;

    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const idSet = new Set(validIds);
      const current = deduplicateById(
        globalCache.get(cacheKey)?.data || (await hydrateKeyFromIdb(cacheKey)) || []
      );
      const updated = current.filter((item: any) => !idSet.has(String(item.id)));
      globalCache.set(cacheKey, { data: updated, error: null, source: 'memory' });
      await setCollectionInIdb(cacheKey, updated);
      updateCallbacks.get(cacheKey)?.forEach((cb) => cb());
    }

    if (targetUid && !options?.localOnly && !getLocalOnlyMode()) {
      const CHUNK_SIZE = 200;
      let done = 0;
      for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
        if (options?.signal?.aborted) {
          throw new Error('OPERATION_ABORTED');
        }
        const chunk = validIds.slice(i, i + CHUNK_SIZE);
        try {
          const batch = writeBatch(dbFirebase);
          for (const id of chunk) {
            const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
            batch.delete(docRef);
          }
          await Promise.race([
            batch.commit(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Délai dépassé lors de la suppression (${collectionName})`)),
                25000
              )
            ),
          ]);
          trackFirebaseWrite(chunk.length);
        } catch (err: any) {
          console.warn(`Firestore batchDelete failed for ${collectionName} chunk:`, err);
          if (isQuotaError(err)) {
            const today = new Date().toISOString().split('T')[0];
            sessionStorage.setItem('firebase_quota_exceeded_today', today);
            window.dispatchEvent(
              new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
            );
            break;
          } else {
            for (const id of chunk) {
              if (options?.signal?.aborted) throw new Error('OPERATION_ABORTED');
              try {
                const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
                await Promise.race([
                  deleteDoc(docRef),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 10000)
                  ),
                ]);
                trackFirebaseWrite(1);
              } catch (singleErr) {
                console.warn(`Single delete failed for ${collectionName}/${id}:`, singleErr);
              }
            }
          }
        }
        done += chunk.length;
        options?.onProgress?.(done, validIds.length);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  },
  batchPut: async <T extends { id?: any }>(
    collectionName: string,
    items: T[],
    options?: {
      onProgress?: (done: number, total: number) => void;
      signal?: AbortSignal;
      localOnly?: boolean;
      replaceLocal?: boolean;
      skipLocalUpdate?: boolean;
      maxBatchOps?: number;
      maxBatchBytes?: number;
    }
  ): Promise<{ saved: number; failed: number; quotaHit?: boolean; errors: string[] }> => {
    const targetUid = await getTargetUid();
    if (!items || items.length === 0) return { saved: 0, failed: 0, errors: [] };

    const sanitizeValue = (val: any): any => {
      if (val === undefined) return undefined;
      if (val === null || typeof val === 'boolean' || typeof val === 'string') return val;
      if (typeof val === 'number') return Number.isFinite(val) ? val : null;
      if (val instanceof Date) return val.toISOString();
      if (Array.isArray(val)) {
        return val.map(sanitizeValue).filter((v) => v !== undefined);
      }
      if (typeof val === 'object') {
        const obj: any = {};
        for (const key of Object.keys(val)) {
          const v = sanitizeValue(val[key]);
          if (v !== undefined) obj[key] = v;
        }
        return obj;
      }
      return undefined;
    };

    const normalizeId = (rawId: any): string => {
      if (rawId === undefined || rawId === null || rawId === '') {
        return crypto.randomUUID();
      }
      const str = String(rawId).trim();
      if (/^[a-zA-Z0-9_-]{1,128}$/.test(str)) return str;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
      }
      const safe =
        str
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 96) || 'item';
      return `${safe}_${Math.abs(hash).toString(36)}`;
    };

    const dedupMap = new Map<string, any>();
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const id = normalizeId(item.id);
      const rawObj: any = { ...item, id, userId: targetUid || 'local' };
      const cleaned = sanitizeValue(rawObj);
      if (cleaned) {
        dedupMap.set(id, cleaned);
      }
    }

    const cleanedItems = Array.from(dedupMap.values());
    if (cleanedItems.length === 0) return { saved: 0, failed: 0, errors: [] };

    // Update IndexedDB + in-memory cache once (no 5MB localStorage limit!)
    if (targetUid && !options?.skipLocalUpdate) {
      const cacheKey = `${targetUid}_${collectionName}`;
      let updated: any[];
      if (options?.replaceLocal) {
        updated = cleanedItems;
      } else {
        const existing = deduplicateById(
          globalCache.get(cacheKey)?.data || (await hydrateKeyFromIdb(cacheKey)) || []
        );
        const mergedMap = new Map<string, any>();
        for (const ex of existing) {
          if (ex?.id) mergedMap.set(String(ex.id), ex);
        }
        for (const item of cleanedItems) {
          mergedMap.set(item.id, item);
        }
        updated = Array.from(mergedMap.values());
      }
      globalCache.set(cacheKey, { data: updated, error: null, source: 'memory' });
      await setCollectionInIdb(cacheKey, updated);
      updateCallbacks.get(cacheKey)?.forEach((cb) => cb());
    }

    if (!targetUid || options?.localOnly || getLocalOnlyMode()) {
      options?.onProgress?.(cleanedItems.length, cleanedItems.length);
      return { saved: cleanedItems.length, failed: 0, errors: [] };
    }

    let saved = 0;
    let failed = 0;
    let quotaHit = false;
    const errors: string[] = [];

    // Conservative batch bounds (<= 20 docs and <= 350 KB) so Firestore commits rapidly without 45s timeouts
    const MAX_BATCH_OPS = options?.maxBatchOps ?? 20;
    const MAX_BATCH_BYTES = options?.maxBatchBytes ?? 350_000;
    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentBytes = 0;

    for (const item of cleanedItems) {
      const approxBytes = JSON.stringify(item).length;
      if (
        currentChunk.length > 0 &&
        (currentChunk.length >= MAX_BATCH_OPS || currentBytes + approxBytes > MAX_BATCH_BYTES)
      ) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentBytes = 0;
      }
      currentChunk.push(item);
      currentBytes += approxBytes;
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);

    let processed = 0;
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      if (options?.signal?.aborted) {
        throw new Error('OPERATION_ABORTED');
      }

      if (quotaHit) {
        failed += chunk.length;
        processed += chunk.length;
        options?.onProgress?.(processed, cleanedItems.length);
        continue;
      }

      try {
        const batch = writeBatch(dbFirebase);
        for (const item of chunk) {
          const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, item.id);
          batch.set(docRef, item);
        }
        await Promise.race([
          batch.commit(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Délai dépassé lors de l'écriture (${collectionName})`)),
              25000
            )
          ),
        ]);
        trackFirebaseWrite(chunk.length);
        saved += chunk.length;
      } catch (err: any) {
        console.warn(`Firestore batchPut failed for ${collectionName} chunk, falling back:`, err);
        if (isQuotaError(err)) {
          const today = new Date().toISOString().split('T')[0];
          sessionStorage.setItem('firebase_quota_exceeded_today', today);
          window.dispatchEvent(
            new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
          );
          quotaHit = true;
          failed += chunk.length;
          errors.push(
            `${collectionName} : quota Firestore atteint (données conservées dans IndexedDB locale).`
          );
        } else {
          // Retry per-item so one problematic doc doesn't block the chunk
          for (const item of chunk) {
            if (options?.signal?.aborted) throw new Error('OPERATION_ABORTED');
            try {
              const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, item.id);
              await Promise.race([
                setDoc(docRef, item),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Délai dépassé')), 15000)
                ),
              ]);
              trackFirebaseWrite(1);
              saved += 1;
            } catch (singleErr: any) {
              if (isQuotaError(singleErr)) {
                quotaHit = true;
                const today = new Date().toISOString().split('T')[0];
                sessionStorage.setItem('firebase_quota_exceeded_today', today);
                window.dispatchEvent(
                  new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
                );
              }
              failed += 1;
              const reason = singleErr?.message || 'Erreur inconnue';
              errors.push(`${collectionName}/${item.id} : ${reason}`);
              console.warn(`Single put failed for ${collectionName}/${item.id}:`, singleErr);
            }
          }
        }
      }

      processed += chunk.length;
      options?.onProgress?.(processed, cleanedItems.length);
      // Small breathing delay between batches to keep browser & Firestore stream responsive
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    return { saved, failed, quotaHit, errors };
  },
  get: async <T>(collectionName: string, id: string): Promise<T | undefined> => {
    const targetUid = await getTargetUid();
    if (!targetUid) return undefined;

    const cacheKey = `${targetUid}_${collectionName}`;
    const inMem = globalCache.get(cacheKey)?.data?.find((x: any) => x.id === id);
    if (inMem) return inMem as T;

    const inIdb = (await hydrateKeyFromIdb(cacheKey))?.find((x: any) => x.id === id);
    if (inIdb) return inIdb as T;

    if (getLocalOnlyMode()) return undefined;

    const docPath = `users/${targetUid}/${collectionName}/${id}`;
    try {
      const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.metadata.fromCache) {
        trackFirebaseRead(1);
      }
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as T;
      }
    } catch (err: any) {
      console.warn(`Firestore get failed for ${docPath} (using fallback):`, err);
      if (isQuotaError(err)) {
        const today = new Date().toISOString().split('T')[0];
        sessionStorage.setItem('firebase_quota_exceeded_today', today);
        window.dispatchEvent(
          new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
        );
      } else {
        logFirestoreError(err, OperationType.GET, docPath);
      }
    }
    return undefined;
  },
  getAll: async <T>(collectionName: string, forceFresh: boolean = false): Promise<T[]> => {
    const targetUid = await getTargetUid();
    if (!targetUid) {
      const fallback = (await getCollectionFromIdb(`anonymous_${collectionName}`)) || [];
      return fallback as T[];
    }

    const cacheKey = `${targetUid}_${collectionName}`;
    if (!forceFresh || getLocalOnlyMode()) {
      const inMem = globalCache.get(cacheKey)?.data;
      if (inMem && inMem.length > 0) {
        return inMem as T[];
      }

      const inIdb = await hydrateKeyFromIdb(cacheKey);
      if (inIdb && inIdb.length > 0) {
        return inIdb as T[];
      }

      if (getLocalOnlyMode()) {
        return [];
      }
    }

    const collPath = `users/${targetUid}/${collectionName}`;
    try {
      const q = query(collection(dbFirebase, collPath));
      const querySnapshot = await Promise.race([
        getDocs(q),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout lecture Firestore (${collectionName})`)), 15000)
        ),
      ]);
      if (!querySnapshot.metadata.fromCache) {
        trackFirebaseRead(querySnapshot.docs.length);
      }
      const items = deduplicateById(
        querySnapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id } as T))
      );
      globalCache.set(cacheKey, {
        data: items,
        error: null,
        source: querySnapshot.metadata.fromCache ? 'idb' : 'server',
      });
      await setCollectionInIdb(cacheKey, items);
      if (!querySnapshot.metadata.fromCache) {
        try {
          localStorage.setItem(`potager_sync_time_${cacheKey}`, Date.now().toString());
        } catch {}
      }
      return items;
    } catch (err: any) {
      console.warn(`Firestore getAll failed for ${collPath} (using fallback):`, err);
      if (isQuotaError(err)) {
        const today = new Date().toISOString().split('T')[0];
        sessionStorage.setItem('firebase_quota_exceeded_today', today);
        window.dispatchEvent(
          new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
        );
      } else {
        logFirestoreError(err, OperationType.LIST, collPath);
      }
      const fallback = globalCache.get(cacheKey)?.data || (await hydrateKeyFromIdb(cacheKey)) || [];
      return fallback as T[];
    }
  },
  listRemoteIds: async (collectionName: string): Promise<string[]> => {
    const targetUid = await getTargetUid();
    if (!targetUid || getLocalOnlyMode()) return [];
    const collPath = `users/${targetUid}/${collectionName}`;
    try {
      const q = query(collection(dbFirebase, collPath));
      const snap = await Promise.race([
        getDocs(q),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout listRemoteIds (${collectionName})`)), 15000)
        ),
      ]);
      if (!snap.metadata.fromCache) {
        trackFirebaseRead(snap.docs.length);
      }
      return snap.docs.map((d) => d.id);
    } catch (err: any) {
      console.warn(`Firestore listRemoteIds failed for ${collPath}:`, err);
      if (isQuotaError(err)) {
        const today = new Date().toISOString().split('T')[0];
        sessionStorage.setItem('firebase_quota_exceeded_today', today);
        window.dispatchEvent(
          new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } })
        );
      }
      return [];
    }
  },
};

/**
 * Synchronise en priorité absolue le Journal, le Calendrier Perpétuel, les Semis, les Arbres, les Tâches et la Config.
 */
export const syncPriorityCollections = async (): Promise<{
  success: boolean;
  syncedCount: number;
  collections: string[];
  time: string;
  error?: string;
}> => {
  const targetUid = await getTargetUid();
  const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (!targetUid) {
    return {
      success: false,
      syncedCount: 0,
      collections: [],
      time: timeStr,
      error: 'Utilisateur non connecté',
    };
  }

  let totalDocs = 0;
  const syncedCollections: string[] = [];

  try {
    for (const collName of PRIORITY_COLLECTIONS) {
      const cacheKey = `${targetUid}_${collName}`;
      const q = query(collection(dbFirebase, `users/${targetUid}/${collName}`));
      const querySnapshot = await getDocs(q);
      const items = deduplicateById(
        querySnapshot.docs.map((docSnapshot) => ({
          ...docSnapshot.data(),
          id: docSnapshot.id,
        }))
      );

      if (!querySnapshot.metadata.fromCache) {
        trackFirebaseRead(querySnapshot.docs.length);
      }
      totalDocs += querySnapshot.docs.length;
      syncedCollections.push(collName);

      globalCache.set(cacheKey, { data: items, error: null, source: 'server' });
      await setCollectionInIdb(cacheKey, items);
      try {
        localStorage.setItem(`potager_sync_time_${cacheKey}`, Date.now().toString());
      } catch {}
      updateCallbacks.get(cacheKey)?.forEach((cb) => cb());
    }

    sessionStorage.removeItem('firebase_quota_exceeded_today');
    localStorage.setItem('firebase_last_priority_sync', timeStr);
    window.dispatchEvent(
      new CustomEvent('firebase_priority_synced', {
        detail: { totalDocs, time: timeStr, collections: syncedCollections },
      })
    );

    return {
      success: true,
      syncedCount: totalDocs,
      collections: syncedCollections,
      time: timeStr,
    };
  } catch (err: any) {
    console.error('Error in syncPriorityCollections:', err);
    if (isQuotaError(err)) {
      const today = new Date().toISOString().split('T')[0];
      sessionStorage.setItem('firebase_quota_exceeded_today', today);
      window.dispatchEvent(
        new CustomEvent('firebase_quota_warning', { detail: { collection: 'priority_sync' } })
      );
    }
    return {
      success: false,
      syncedCount: totalDocs,
      collections: syncedCollections,
      time: timeStr,
      error: err.message || 'Erreur réseau ou quota',
    };
  }
};

/**
 * Réinitialise l'avertissement de dépassement de quota
 */
export const resetQuotaExceededWarning = () => {
  sessionStorage.removeItem('firebase_quota_exceeded_today');
  window.dispatchEvent(new CustomEvent('firebase_quota_warning'));
  window.dispatchEvent(new Event('firebase_reads_updated'));
};

/**
 * Teste la connectivité directe avec le serveur Firestore (contourne le cache local)
 */
export const testFirebaseConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const targetUid = await getTargetUid();
    if (!targetUid) {
      return { success: false, message: 'Utilisateur non connecté' };
    }
    const testDoc = doc(dbFirebase, `users/${targetUid}/config`, 'default_state');
    await getDocFromServer(testDoc);
    trackFirebaseRead(1);
    sessionStorage.removeItem('firebase_quota_exceeded_today');
    window.dispatchEvent(new CustomEvent('firebase_quota_warning'));
    window.dispatchEvent(new Event('firebase_reads_updated'));
    return {
      success: true,
      message: 'Connexion serveur Firestore active ! Vos données peuvent être synchronisées.',
    };
  } catch (err: any) {
    if (isQuotaError(err)) {
      const today = new Date().toISOString().split('T')[0];
      sessionStorage.setItem('firebase_quota_exceeded_today', today);
      window.dispatchEvent(new CustomEvent('firebase_quota_warning'));
      return {
        success: false,
        message:
          'Le serveur Google Firestore confirme que le quota de 50 000 lectures/jour est atteint. Le cache IndexedDB local reste 100% actif.',
      };
    }
    return {
      success: false,
      message: `Erreur de communication : ${err.message || 'Réseau indisponible'}`,
    };
  }
};
