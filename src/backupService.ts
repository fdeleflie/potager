import { db } from './db';
import { v4 as uuidv4 } from 'uuid';

let backupInterval: number | null = null;

export const backupService = {
  async createBackup(type: 'auto' | 'manual' = 'auto', includePhotos: boolean = true) {
    try {
      let seedlings = await db.seedlings.toArray();
      let journal = await db.journal.toArray();
      const config = await db.config.toArray();
      let trees = await db.trees.toArray();
      const structures = await db.structures.toArray();

      if (!includePhotos) {
        seedlings = seedlings.map(s => {
          const { photo, notes, ...rest } = s;
          const notesWithoutPhotos = notes ? notes.map(n => {
            const { photos, ...noteRest } = n;
            return noteRest;
          }) : [];
          return { ...rest, notes: notesWithoutPhotos } as any;
        });
        journal = journal.map(j => {
          const { photos, ...rest } = j;
          return rest as any;
        });
        trees = trees.map(t => {
          const { photo, notes, ...rest } = t;
          const notesWithoutPhotos = notes ? notes.map(n => {
            const { photos, ...noteRest } = n;
            return noteRest;
          }) : [];
          return { ...rest, notes: notesWithoutPhotos } as any;
        });
      }

      const exportData = {
        seedlings,
        journal,
        config,
        trees,
        structures,
        version: 1,
        timestamp: new Date().toISOString()
      };

      const backup = {
        id: uuidv4(),
        date: new Date().toISOString(),
        data: JSON.stringify(exportData),
        type,
        includePhotos
      };

      await db.backups.add(backup);

      // Keep only last 10 auto backups of each type
      if (type === 'auto') {
        const autoBackups = await db.backups
          .where('type')
          .equals('auto')
          .sortBy('date');
        
        const sameTypeBackups = autoBackups.filter(b => b.includePhotos === includePhotos);
        
        if (sameTypeBackups.length > 10) {
          const toDelete = sameTypeBackups.slice(0, sameTypeBackups.length - 10);
          await db.backups.bulkDelete(toDelete.map(b => b.id));
        }
      }

      console.log(`[BackupService] ${type} backup created successfully. Photos: ${includePhotos}`);
    } catch (error) {
      console.error('[BackupService] Error creating backup:', error);
    }
  },

  async restoreFromBackup(backupId: string, merge: boolean = false) {
    const backup = await db.backups.get(backupId);
    if (!backup) throw new Error('Sauvegarde non trouvée');

    const data = JSON.parse(backup.data);
    
    await db.transaction('rw', [db.seedlings, db.journal, db.config, db.trees, db.structures], async () => {
      if (!merge) {
        await db.seedlings.clear();
        await db.journal.clear();
        await db.config.clear();
        await db.trees.clear();
        await db.structures.clear();
      }

      if (data.seedlings) await db.seedlings.bulkPut(data.seedlings);
      if (data.journal) await db.journal.bulkPut(data.journal);
      if (data.config) await db.config.bulkPut(data.config);
      if (data.trees) await db.trees.bulkPut(data.trees);
      if (data.structures) await db.structures.bulkPut(data.structures);
    });

    return true;
  },

  async checkAndRunAutoBackup() {
    const freqLight = localStorage.getItem('potager_backup_frequency_light') || 'daily';
    const freqFull = localStorage.getItem('potager_backup_frequency_full') || 'weekly';

    const checkAndRun = async (isFull: boolean, frequency: string) => {
      if (frequency === 'never') return;

      const backups = await db.backups.where('type').equals('auto').toArray();
      const specificBackups = backups
        .filter(b => b.includePhotos === isFull)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const lastBackup = specificBackups[0];

      const now = new Date().getTime();
      const lastTime = lastBackup ? new Date(lastBackup.date).getTime() : 0;
      
      let intervalMs = 24 * 60 * 60 * 1000; // daily
      if (frequency === '4h') intervalMs = 4 * 60 * 60 * 1000;
      if (frequency === 'weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;

      if (now - lastTime > intervalMs) {
        await this.createBackup('auto', isFull);
      }
    };

    await checkAndRun(false, freqLight);
    await checkAndRun(true, freqFull);
  },

  initAutoBackup() {
    this.checkAndRunAutoBackup();
    
    if (backupInterval) {
      window.clearInterval(backupInterval);
    }
    
    // Check every 15 minutes if a backup is needed while app is open
    backupInterval = window.setInterval(() => {
      this.checkAndRunAutoBackup();
    }, 15 * 60 * 1000);
    
    return () => {
      if (backupInterval) window.clearInterval(backupInterval);
    };
  }
};
