import { db } from '../db';
import { dbFirebase, auth } from '../firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';

export async function migrateLocalDataToFirebase(logCallback?: (msg: string) => void) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be logged in to migrate data.");
  }

  const log = (msg: string) => {
    console.log(msg);
    if (logCallback) logCallback(msg);
  }

  log("Starting migration to Firebase for user: " + user.email);

  // Fetch all local data
  const seedlings = await db.seedlings.toArray();
  const journal = await db.journal.toArray();
  const config = await db.config.toArray();
  const trees = await db.trees.toArray();
  const structures = await db.structures.toArray();
  const tasks = await db.tasks.toArray();
  const encyclopedia = await db.encyclopedia.toArray();
  const healthIssues = await db.healthIssues.toArray();
  const expenses = await db.expenses.toArray();

  const collectionsData = [
    { name: 'seedlings', data: seedlings },
    { name: 'journal', data: journal },
    { name: 'config', data: config },
    { name: 'trees', data: trees },
    { name: 'structures', data: structures },
    { name: 'tasks', data: tasks },
    { name: 'encyclopedia', data: encyclopedia },
    { name: 'healthIssues', data: healthIssues },
    { name: 'expenses', data: expenses }
  ];

  let batch = writeBatch(dbFirebase);
  let opCount = 0;
  const MAX_BATCH_SIZE = 5; // Reduced to 5 because base64 photos are large

  for (const coll of collectionsData) {
    log(`Migrating collection: ${coll.name} (${coll.data.length} records)`);
    for (const item of coll.data) {
      const docRef = doc(dbFirebase, `users/${user.uid}/${coll.name}/${item.id}`);
      
      // Ensure there are no undefined values
      const scrubbedItem = JSON.parse(JSON.stringify(item));
      // Remove local Dexie id if needed, but keeping it is fine.
      // We must add userId just in case, though the rules enforce it.
      scrubbedItem.userId = user.uid;

      // Firestore document limit is 1MB. Base64 photos can exceed this.
      // Strip photos if they are too large or entirely for now to ensure migration succeeds.
      const docStringSize = JSON.stringify(scrubbedItem).length;
      if (docStringSize > 800000) { // roughly 800KB
        log(`Warning: Document ${item.id} is very large. Stripping photos...`);
        if (scrubbedItem.photo) {
          scrubbedItem.photo = null;
        }
        if (scrubbedItem.photos) {
          scrubbedItem.photos = [];
        }
        if (scrubbedItem.notes) {
          scrubbedItem.notes = scrubbedItem.notes.map((n: any) => ({ ...n, photos: [] }));
        }
      }

      batch.set(docRef, scrubbedItem);
      opCount++;

      if (opCount >= MAX_BATCH_SIZE) {
        log(`Committing batch of ${opCount} writes...`);
        await batch.commit();
        batch = writeBatch(dbFirebase);
        opCount = 0;
      }
    }
  }

  if (opCount > 0) {
    log(`Committing final batch of ${opCount} writes...`);
    await batch.commit();
  }

  log("Migration completed successfully.");
}
