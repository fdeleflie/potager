import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
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
        const items = snapshot.docs.map(docSnapshot => ({
          ...docSnapshot.data(),
          id: docSnapshot.id
        }));
        globalCache.set(key, { data: items, error: null });
        updateCallbacks.get(key)?.forEach(cb => cb());
      }, (err: any) => {
        console.error(`Error in useFirebaseData for ${collectionName}:`, err);
        let errorMsg = err.message || 'Une erreur est survenue lors de la récupération des données.';
        if (err.message?.includes('quota') || err.code === 'resource-exhausted') {
          errorMsg = 'Quota Firebase dépassé. Veuillez patienter 24h ou passer au forfait Blaze.';
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
    const dataToSave = { ...data, id, userId: auth.currentUser.uid };
    await setDoc(docRef, dataToSave);
    return id;
  },
  put: async <T extends { id: string }>(collectionName: string, data: T) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const docRef = doc(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`, data.id);
    const dataToSave = { ...data, userId: auth.currentUser.uid };
    await setDoc(docRef, dataToSave);
    return data.id;
  },
  update: async (collectionName: string, id: string, data: any) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const docRef = doc(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`, id);
    await updateDoc(docRef, data);
  },
  delete: async (collectionName: string, id: string) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const docRef = doc(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`, id);
    await deleteDoc(docRef);
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
