import { db as localDb, pendingDeletesFromFirestore } from './db';
import { db as firestoreDb } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';

let unsubscribes: (() => void)[] = [];

export const startSync = (userId: string) => {
  stopSync(); // Ensure no duplicates
  const tables = [
    'seedlings', 'journal', 'config', 'trees', 'structures', 
    'tasks', 'encyclopedia', 'healthIssues', 'expenses'
  ];

  tables.forEach(tableName => {
    const unsub = onSnapshot(collection(firestoreDb, `users/${userId}/${tableName}`), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        if (change.type === 'added' || change.type === 'modified') {
          const obj = { ...data, _fromFirestore: true };
          await localDb.table(tableName).put(obj);
        }
        if (change.type === 'removed') {
          pendingDeletesFromFirestore.add(change.doc.id);
          await localDb.table(tableName).delete(change.doc.id);
        }
      });
    }, (error) => {
      console.error(`Sync error for ${tableName}:`, error);
    });
    unsubscribes.push(unsub);
  });
};

export const stopSync = () => {
  unsubscribes.forEach(unsub => unsub());
  unsubscribes = [];
};

export const clearLocalDb = async () => {
  const tables = [
    'seedlings', 'journal', 'config', 'trees', 'structures', 
    'tasks', 'encyclopedia', 'healthIssues', 'expenses'
  ];
  for (const table of tables) {
    await localDb.table(table).clear();
  }
};
