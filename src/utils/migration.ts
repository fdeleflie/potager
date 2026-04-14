import { db as localDb } from '../db';
import { db as firestoreDb, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export const migrateToCloud = async (onProgress: (msg: string) => void) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Vous devez être connecté pour migrer les données.");
  }

  const userId = user.uid;
  onProgress("Démarrage de la migration...");

  try {
    const migrateTable = async (tableName: string, getItems: () => Promise<any[]>) => {
      onProgress(`Lecture de ${tableName}...`);
      const items = await getItems();
      let count = 0;
      for (const item of items) {
        const docRef = doc(firestoreDb, `users/${userId}/${tableName}`, item.id);
        
        // Remove undefined values to avoid Firestore errors
        const cleanItem = Object.fromEntries(
          Object.entries(item).filter(([_, v]) => v !== undefined)
        );

        await setDoc(docRef, cleanItem);
        count++;
        if (count % 10 === 0 || count === items.length) {
          onProgress(`Migration de ${tableName}... (${count}/${items.length})`);
        }
      }
    };

    await migrateTable('seedlings', () => localDb.seedlings.toArray());
    await migrateTable('journal', () => localDb.journal.toArray());
    await migrateTable('config', () => localDb.config.toArray());
    await migrateTable('trees', () => localDb.trees.toArray());
    await migrateTable('structures', () => localDb.structures.toArray());
    await migrateTable('tasks', () => localDb.tasks.toArray());
    await migrateTable('encyclopedia', () => localDb.encyclopedia.toArray());
    await migrateTable('healthIssues', () => localDb.healthIssues.toArray());
    await migrateTable('expenses', () => localDb.expenses.toArray());

    onProgress("Migration terminée avec succès !");
  } catch (error) {
    console.error("Erreur lors de la migration:", error);
    throw error;
  }
};
