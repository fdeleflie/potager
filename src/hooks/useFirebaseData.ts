import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { dbFirebase, auth } from '../firebase';

export function useFirebaseData<T>(collectionName: string) {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    if (!auth.currentUser) {
      setData([]);
      return;
    }

    const q = query(collection(dbFirebase, `users/${auth.currentUser.uid}/${collectionName}`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsMap = new Map();
      snapshot.docs.forEach(docSnapshot => {
        const id = docSnapshot.id;
        itemsMap.set(id, {
          ...docSnapshot.data(),
          id
        });
      });
      const items = Array.from(itemsMap.values());
      setData(items as T[]);
    });

    return () => unsubscribe();
  }, [collectionName]);

  return data;
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
