import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc, getDocs, deleteField, writeBatch } from 'firebase/firestore';
import { dbFirebase, auth } from '../firebase';

const globalCache = new Map<string, { data: any[], error: string | null }>();
const activeListeners = new Map<string, () => void>();
const updateCallbacks = new Map<string, Set<() => void>>();

let resolvedTargetUid: string | null = null;
let resolvePromise: Promise<string | null> | null = null;

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
  try {
    const cleaned = Array.isArray(data) ? deduplicateById(data) : [];
    localStorage.setItem(`potager_cache_${key}`, JSON.stringify(cleaned));
  } catch (e) {
    console.warn("Could not save to localStorage cache", e);
  }
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
        } catch(e) {
             console.error("Failed to load francois UID", e);
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
    activeListeners.forEach(unsub => unsub());
    activeListeners.clear();
    globalCache.clear();
    updateCallbacks.forEach(cbs => cbs.forEach(cb => cb()));
  } else {
    // Proactively resolve
    getTargetUid().then(() => {
        // We will trigger all useFirebaseData hooks to re-evaluate the UID
        window.dispatchEvent(new Event('targetUidResolved'));
    });
  }
});

export const PRIORITY_COLLECTIONS = ['journal', 'perpetualTasks', 'seedlings', 'trees', 'tasks', 'config'];
export const SECONDARY_COLLECTIONS = ['encyclopedia', 'healthIssues', 'expenses', 'structures', 'backups'];

export const SPARK_DAILY_READ_LIMIT = 50000;
export const MARGIN_THRESHOLD_READS = 35000; // Seuil à 70% pour sanctuariser la marge Journal/Perpétuel
export const MARGIN_RESERVED_READS = 15000; // 15 000 lectures exclusivement réservées au Journal et Perpétuel

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
      lastPrioritySyncTime
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
      lastPrioritySyncTime: null
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

    window.dispatchEvent(new CustomEvent('firebase_reads_updated', {
      detail: { readsToday: stats[today], added: count }
    }));
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
  } catch(e) {
    console.error('Failed to get firebase write count', e);
  }
  return 0;
};

const trackFirebaseWrite = () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsStr = localStorage.getItem('firebase_writes_stats');
    let stats: Record<string, number> = {};
    if (statsStr) {
      stats = JSON.parse(statsStr);
    }
    stats[today] = (stats[today] || 0) + 1;
    localStorage.setItem('firebase_writes_stats', JSON.stringify(stats));
    
    // Dispatch an event so the configuration tab can react to it in real-time
    window.dispatchEvent(new Event('firebase_writes_updated'));
  } catch(e) {
    console.error('Failed to track firebase write', e);
  }
};

export function useFirebaseData<T>(collectionName: string) {
  const [uid, setUid] = useState<string | null>(resolvedTargetUid);
  
  useEffect(() => {
    if (!resolvedTargetUid && auth.currentUser) {
       getTargetUid().then(uid => setUid(uid));
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
    const inLocal = getLocalCache(key);
    if (inLocal) {
      globalCache.set(key, { data: inLocal, error: null });
      return inLocal as T[];
    }
    return [];
  });
  const [error, setError] = useState<string | null>(key ? (globalCache.get(key)?.error) || null : null);

  useEffect(() => {
    if (!uid || !key) {
      setData([]);
      setError(null);
      return;
    }

    const triggerUpdate = () => {
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

    // Initial cache population if not already loaded in state
    if (globalCache.has(key)) {
      triggerUpdate();
    } else {
      const local = getLocalCache(key);
      if (local) {
        globalCache.set(key, { data: local, error: null });
        triggerUpdate();
      }
    }

    const isPriority = PRIORITY_COLLECTIONS.includes(collectionName);
    const quotaStats = getFirebaseQuotaStats();

    // Check if this is a secondary/heavy collection (e.g. encyclopedia, healthIssues, etc.)
    // If the margin mode is active (quota >= 35 000 reads or quota exceeded or manual economy):
    // OR if we already have local cache that was synced recently (within 24 hours):
    const local = getLocalCache(key);
    const cacheTimestamp = localStorage.getItem(`potager_sync_time_${key}`);
    const isRecentlySynced = cacheTimestamp && (Date.now() - parseInt(cacheTimestamp, 10)) < 24 * 60 * 60 * 1000;

    if (!isPriority && local && local.length > 0 && (quotaStats.isMarginActive || isRecentlySynced)) {
      if (!globalCache.has(key)) {
        globalCache.set(key, { data: local, error: null });
        triggerUpdate();
      }
      return () => {
        updateCallbacks.get(key)?.delete(triggerUpdate);
      };
    }

    if (!activeListeners.has(key)) {
      activeListeners.set(key, () => {}); 
      try {
        const q = query(collection(dbFirebase, `users/${uid}/${collectionName}`));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          let currentData = deduplicateById(globalCache.get(key)?.data || getLocalCache(key) || []);
          
          let updatedItems: any[] = [];
          let docsReadCount = 0;
          if (currentData.length === 0 || snapshot.docChanges().length > snapshot.docs.length / 2) {
              updatedItems = deduplicateById(snapshot.docs.map(docSnapshot => ({
                ...docSnapshot.data(),
                id: docSnapshot.id
              })));
              docsReadCount = snapshot.docs.length;
          } else {
              const newData = [...currentData];
              snapshot.docChanges().forEach((change) => {
                const docData = { ...change.doc.data(), id: change.doc.id };
                const index = newData.findIndex(item => item.id === change.doc.id);
                if (change.type === 'added') {
                  if (index !== -1) {
                    newData[index] = docData;
                  } else {
                    newData.push(docData);
                  }
                }
                if (change.type === 'modified') {
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
          
          trackFirebaseRead(docsReadCount);
          globalCache.set(key, { data: updatedItems, error: null });
          setLocalCache(key, updatedItems);
          localStorage.setItem(`potager_sync_time_${key}`, Date.now().toString());
          updateCallbacks.get(key)?.forEach(cb => cb());
        }, (err: any) => {
          let errorMsg = err.message || 'Une erreur est survenue lors de la récupération des données.';
          const isQuota = err.message?.includes('Quota') || err.message?.includes('quota') || err.code === 'resource-exhausted' || err.message?.includes('Free daily read units');
          
          if (isQuota) {
            const today = new Date().toISOString().split('T')[0];
            sessionStorage.setItem('firebase_quota_exceeded_today', today);
            errorMsg = 'Quota Firebase dépassé. L’application utilise le cache local.';
            console.warn(`Firebase quota warning for ${collectionName}: ${errorMsg}`);
            window.dispatchEvent(new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } }));
          } else {
            console.error(`Error in useFirebaseData for ${collectionName}:`, err);
          }
          
          const fallbackData = deduplicateById(globalCache.get(key)?.data || getLocalCache(key) || []);
          globalCache.set(key, { data: fallbackData, error: isQuota ? null : errorMsg });
          updateCallbacks.get(key)?.forEach(cb => cb());
        });
        activeListeners.set(key, unsubscribe);
      } catch (err: any) {
        console.warn(`Could not attach listener for ${collectionName}:`, err);
      }
    }

    return () => {
      updateCallbacks.get(key)?.delete(triggerUpdate);
    };
  }, [collectionName, uid, key]);

  return { data, error };
}

export const fb = {
  getCollection: async (collectionName: string) => {
    const targetUid = await getTargetUid();
    if (!targetUid) throw new Error("No user logged in");
    return collection(dbFirebase, `users/${targetUid}/${collectionName}`);
  },
  getDoc: async (collectionName: string, id: string) => {
    const targetUid = await getTargetUid();
    if (!targetUid) throw new Error("No user logged in");
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

    // Optimistic local update
    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const current = deduplicateById(globalCache.get(cacheKey)?.data || getLocalCache(cacheKey) || []);
      const idx = current.findIndex((item: any) => item.id === id);
      const updated = idx !== -1
        ? current.map((item: any, i: number) => i === idx ? cleanedData : item)
        : [...current, cleanedData];
      globalCache.set(cacheKey, { data: updated, error: null });
      setLocalCache(cacheKey, updated);
      updateCallbacks.get(cacheKey)?.forEach(cb => cb());
    }

    if (targetUid) {
      try {
        const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
        await setDoc(docRef, cleanedData);
        trackFirebaseWrite();
      } catch (err: any) {
        console.warn(`Firestore add failed for ${collectionName}/${id} (saved in local cache):`, err);
        if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted') {
          window.dispatchEvent(new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } }));
        }
      }
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

    // Optimistic local update
    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const current = deduplicateById(globalCache.get(cacheKey)?.data || getLocalCache(cacheKey) || []);
      const idx = current.findIndex((item: any) => item.id === data.id);
      const updated = idx !== -1 ? current.map((item: any, i: number) => i === idx ? cleanedData : item) : [...current, cleanedData];
      globalCache.set(cacheKey, { data: updated, error: null });
      setLocalCache(cacheKey, updated);
      updateCallbacks.get(cacheKey)?.forEach(cb => cb());
    }

    if (targetUid) {
      try {
        const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, data.id);
        await setDoc(docRef, cleanedData);
        trackFirebaseWrite();
      } catch (err: any) {
        console.warn(`Firestore put failed for ${collectionName}/${data.id} (saved in local cache):`, err);
        if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted') {
          window.dispatchEvent(new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } }));
        }
      }
    }
    return data.id;
  },
  update: async (collectionName: string, id: string, data: any) => {
    const targetUid = await getTargetUid();
    
    // Optimistic local update
    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const current = deduplicateById(globalCache.get(cacheKey)?.data || getLocalCache(cacheKey) || []);
      const idx = current.findIndex((item: any) => item.id === id);
      if (idx !== -1) {
        const updatedItem = { ...current[idx], ...data };
        const updated = current.map((item: any, i: number) => i === idx ? updatedItem : item);
        globalCache.set(cacheKey, { data: updated, error: null });
        setLocalCache(cacheKey, updated);
        updateCallbacks.get(cacheKey)?.forEach(cb => cb());
      }
    }

    if (targetUid) {
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
        trackFirebaseWrite();
      } catch (err: any) {
        console.warn(`Firestore update failed for ${collectionName}/${id} (saved in local cache):`, err);
        if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted') {
          window.dispatchEvent(new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } }));
        }
      }
    }
  },
  delete: async (collectionName: string, id: string) => {
    const targetUid = await getTargetUid();

    // Optimistic local update
    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const current = deduplicateById(globalCache.get(cacheKey)?.data || getLocalCache(cacheKey) || []);
      const updated = current.filter((item: any) => item.id !== id);
      globalCache.set(cacheKey, { data: updated, error: null });
      setLocalCache(cacheKey, updated);
      updateCallbacks.get(cacheKey)?.forEach(cb => cb());
    }

    if (targetUid) {
      try {
        const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
        await deleteDoc(docRef);
        trackFirebaseWrite();
      } catch (err: any) {
        console.warn(`Firestore delete failed for ${collectionName}/${id} (removed in local cache):`, err);
        if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted') {
          window.dispatchEvent(new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } }));
        }
      }
    }
  },
  batchDelete: async (collectionName: string, ids: string[]) => {
    const targetUid = await getTargetUid();
    if (!ids || ids.length === 0) return;

    // Optimistic local update
    if (targetUid) {
      const cacheKey = `${targetUid}_${collectionName}`;
      const idSet = new Set(ids);
      const current = deduplicateById(globalCache.get(cacheKey)?.data || getLocalCache(cacheKey) || []);
      const updated = current.filter((item: any) => !idSet.has(item.id));
      globalCache.set(cacheKey, { data: updated, error: null });
      setLocalCache(cacheKey, updated);
      updateCallbacks.get(cacheKey)?.forEach(cb => cb());
    }

    if (targetUid) {
      try {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const chunk = ids.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(dbFirebase);
          for (const id of chunk) {
            const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
            batch.delete(docRef);
          }
          await batch.commit();
        }
        trackFirebaseWrite();
      } catch (err: any) {
        console.warn(`Firestore batchDelete failed for ${collectionName} (removed in local cache):`, err);
        if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted') {
          window.dispatchEvent(new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } }));
        }
      }
    }
  },
  get: async <T>(collectionName: string, id: string): Promise<T | undefined> => {
    const targetUid = await getTargetUid();
    if (!targetUid) return undefined;
    
    const cacheKey = `${targetUid}_${collectionName}`;
    const inMem = globalCache.get(cacheKey)?.data?.find((x: any) => x.id === id);
    if (inMem) return inMem as T;
    
    const inLocal = getLocalCache(cacheKey)?.find((x: any) => x.id === id);
    if (inLocal) return inLocal as T;

    try {
      const docRef = doc(dbFirebase, `users/${targetUid}/${collectionName}`, id);
      const docSnap = await getDoc(docRef);
      trackFirebaseRead(1);
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as T;
      }
    } catch (err: any) {
      console.warn(`Firestore get failed for ${collectionName}/${id} (using fallback):`, err);
      if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted') {
        window.dispatchEvent(new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } }));
      }
    }
    return undefined;
  },
  getAll: async <T>(collectionName: string, forceFresh: boolean = false): Promise<T[]> => {
    const targetUid = await getTargetUid();
    if (!targetUid) {
      const fallback = getLocalCache(`anonymous_${collectionName}`) || [];
      return fallback as T[];
    }

    const cacheKey = `${targetUid}_${collectionName}`;
    if (!forceFresh) {
      const inMem = globalCache.get(cacheKey)?.data;
      if (inMem && inMem.length > 0) {
        return inMem as T[];
      }

      const inLocal = getLocalCache(cacheKey);
      if (inLocal && inLocal.length > 0) {
        globalCache.set(cacheKey, { data: inLocal, error: null });
        return inLocal as T[];
      }
    }

    try {
      const q = query(collection(dbFirebase, `users/${targetUid}/${collectionName}`));
      const querySnapshot = await getDocs(q);
      trackFirebaseRead(querySnapshot.docs.length);
      const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
      globalCache.set(cacheKey, { data: items, error: null });
      setLocalCache(cacheKey, items);
      localStorage.setItem(`potager_sync_time_${cacheKey}`, Date.now().toString());
      return items;
    } catch (err: any) {
      console.warn(`Firestore getAll failed for ${collectionName} (using fallback):`, err);
      if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted' || err?.message?.includes('Free daily read units')) {
        const today = new Date().toISOString().split('T')[0];
        sessionStorage.setItem('firebase_quota_exceeded_today', today);
        window.dispatchEvent(new CustomEvent('firebase_quota_warning', { detail: { collection: collectionName } }));
      }
      return (globalCache.get(cacheKey)?.data || getLocalCache(cacheKey) || []) as T[];
    }
  }
};

/**
 * Synchronise en priorité absolue le Journal, le Calendrier Perpétuel, les Semis, les Arbres, les Tâches et la Config.
 * Télécharge l'état complet depuis Firestore et met à jour le cache local pour garantir que le téléphone
 * et l'ordinateur sont 100% synchronisés même en cas de rupture de quota ultérieure.
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
    return { success: false, syncedCount: 0, collections: [], time: timeStr, error: 'Utilisateur non connecté' };
  }

  let totalDocs = 0;
  const syncedCollections: string[] = [];

  try {
    for (const collName of PRIORITY_COLLECTIONS) {
      const cacheKey = `${targetUid}_${collName}`;
      const q = query(collection(dbFirebase, `users/${targetUid}/${collName}`));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(docSnapshot => ({
        ...docSnapshot.data(),
        id: docSnapshot.id
      }));

      trackFirebaseRead(querySnapshot.docs.length);
      totalDocs += querySnapshot.docs.length;
      syncedCollections.push(collName);

      globalCache.set(cacheKey, { data: items, error: null });
      setLocalCache(cacheKey, items);
      localStorage.setItem(`potager_sync_time_${cacheKey}`, Date.now().toString());
      updateCallbacks.get(cacheKey)?.forEach(cb => cb());
    }

    localStorage.setItem('firebase_last_priority_sync', timeStr);
    window.dispatchEvent(new CustomEvent('firebase_priority_synced', {
      detail: { totalDocs, time: timeStr, collections: syncedCollections }
    }));

    return {
      success: true,
      syncedCount: totalDocs,
      collections: syncedCollections,
      time: timeStr
    };
  } catch (err: any) {
    console.error('Error in syncPriorityCollections:', err);
    if (err?.message?.includes('Quota') || err?.message?.includes('quota') || err?.code === 'resource-exhausted' || err?.message?.includes('Free daily read units')) {
      const today = new Date().toISOString().split('T')[0];
      sessionStorage.setItem('firebase_quota_exceeded_today', today);
      window.dispatchEvent(new CustomEvent('firebase_quota_warning', { detail: { collection: 'priority_sync' } }));
    }
    return {
      success: false,
      syncedCount: totalDocs,
      collections: syncedCollections,
      time: timeStr,
      error: err.message || 'Erreur réseau ou quota'
    };
  }
};

