import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc, getDocs, deleteField } from 'firebase/firestore';
import { dbFirebase, auth } from '../firebase';

const globalCache = new Map<string, { data: any[], error: string | null }>();
const activeListeners = new Map<string, () => void>();
const updateCallbacks = new Map<string, Set<() => void>>();

auth.onAuthStateChanged((user) => {
  if (!user) {
    activeListeners.forEach(unsub => unsub());
    activeListeners.clear();
    globalCache.clear();
    updateCallbacks.forEach(cbs => cbs.forEach(cb => cb()));
  }
});

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
  const uid = auth.currentUser?.uid;
  const key = uid ? `${uid}_${collectionName}` : null;

  const [data, setData] = useState<T[]>(key ? (globalCache.get(key)?.data as T[]) || [] : []);
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

    if (globalCache.has(key)) {
      triggerUpdate();
    }

    if (!activeListeners.has(key)) {
      activeListeners.set(key, () => {}); 
      const q = query(collection(dbFirebase, `users/${uid}/${collectionName}`));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let currentData = globalCache.get(key)?.data || [];
        
        // S'il y a très peu de changements, on optimise en ne remplaçant que les éléments modifiés
        // Cela maintient l'indépendance de référence (shallow equality) pour les éléments identiques
        let needsUpdate = false;
        
        // Lors du tout premier chargement, snapshot.docChanges() contient tous les ajouts.
        if (currentData.length === 0 || snapshot.docChanges().length > snapshot.docs.length / 2) {
            // Chargement initial ou rechargement complet : on initialise tout
            const items = snapshot.docs.map(docSnapshot => ({
              ...docSnapshot.data(),
              id: docSnapshot.id
            }));
            globalCache.set(key, { data: items, error: null });
        } else {
            // Modification incrémentale : on mute localement la copie du tableau
            const newData = [...currentData];
            snapshot.docChanges().forEach((change) => {
              const docData = { ...change.doc.data(), id: change.doc.id };
              if (change.type === 'added') {
                newData.push(docData);
              }
              if (change.type === 'modified') {
                const index = newData.findIndex(item => item.id === change.doc.id);
                if (index !== -1) newData[index] = docData;
              }
              if (change.type === 'removed') {
                const index = newData.findIndex(item => item.id === change.doc.id);
                if (index !== -1) newData.splice(index, 1);
              }
            });
            globalCache.set(key, { data: newData, error: null });
        }
        
        // On notifie les composants
        updateCallbacks.get(key)?.forEach(cb => cb());
      }, (err: any) => {
        let errorMsg = err.message || 'Une erreur est survenue lors de la récupération des données.';
        if (err.message?.includes('quota') || err.code === 'resource-exhausted') {
          errorMsg = 'Quota Firebase dépassé. Veuillez patienter 24h ou passer au forfait Blaze.';
          console.warn(`Firebase quota warning for ${collectionName}: ${errorMsg}`);
        } else {
          console.error(`Error in useFirebaseData for ${collectionName}:`, err);
        }
        globalCache.set(key, { data: globalCache.get(key)?.data || [], error: errorMsg });
        updateCallbacks.get(key)?.forEach(cb => cb());
      });
      activeListeners.set(key, unsubscribe);
    }

    return () => {
      updateCallbacks.get(key)?.delete(triggerUpdate);
    };
  }, [collectionName, uid, key]);

  return { data, error };
}

export const fb = {
  getCollection: (collectionName: string) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    return collection(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`);
  },
  getDoc: (collectionName: string, id: string) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    return doc(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`, id);
  },
  add: async <T extends { id?: string }>(collectionName: string, data: T) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const id = data.id || crypto.randomUUID();
    const docRef = doc(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`, id);
    const dataToSave: any = { ...data, id, userId: auth.currentUser.uid };
    const cleanedData: any = {};
    for (const key in dataToSave) {
      if (dataToSave[key] !== undefined) {
        cleanedData[key] = dataToSave[key];
      }
    }
    await setDoc(docRef, cleanedData);
    trackFirebaseWrite();
    return id;
  },
  put: async <T extends { id: string }>(collectionName: string, data: T) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const docRef = doc(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`, data.id);
    const dataToSave: any = { ...data, userId: auth.currentUser.uid };
    const cleanedData: any = {};
    for (const key in dataToSave) {
      if (dataToSave[key] !== undefined) {
        cleanedData[key] = dataToSave[key];
      }
    }
    await setDoc(docRef, cleanedData);
    trackFirebaseWrite();
    return data.id;
  },
  update: async (collectionName: string, id: string, data: any) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const docRef = doc(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`, id);
    
    // Replace undefined values with deleteField()
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
  },
  delete: async (collectionName: string, id: string) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const docRef = doc(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`, id);
    await deleteDoc(docRef);
    trackFirebaseWrite();
  },
  get: async <T>(collectionName: string, id: string): Promise<T | undefined> => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const docRef = doc(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...docSnap.data(), id: docSnap.id } as T;
    }
    return undefined;
  },
  getAll: async <T>(collectionName: string): Promise<T[]> => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const q = query(collection(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
  }
};
