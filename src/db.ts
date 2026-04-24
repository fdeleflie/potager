import Dexie, { Table } from 'dexie';

export interface Note {
  id: string;
  date: string;
  text: string;
  photos?: string[]; // base64
}

export interface HarvestEvent {
  id: string;
  date: string;
  quantity: number;
  unit: string; // 'kg', 'g', 'pièces'
  notes?: string;
}

export interface Seedling {
  id: string;
  vegetable: string;
  variety: string;
  origin?: string; // e.g., 'Semis', 'Bouturage', 'Marcottage', 'Division', 'Achat'
  dateSown: string;
  action?: string;
  dateTransplanted?: string;
  datePlanted?: string;
  state: string;
  location: string;
  comments: string;
  photo?: string; // base64
  isArchived: boolean;
  isDeleted: boolean;
  notes: Note[];
  harvests?: HarvestEvent[];
  success?: boolean;
  failureReason?: string;
  quantity?: number; // Sown quantity
  quantityTransplanted?: number;
  quantityPlanted?: number;
  quantityLostSown?: number;
  quantityLostTransplanted?: number;
  zoneId?: string;
  positions?: {x: number, y: number}[];
  salePrice?: number;
  saleComment?: string;
}

export interface Tree {
  id: string;
  terrainId: string;
  species: string;
  variety: string;
  datePlanted: string;
  comments: string;
  photo?: string; // base64
  positionX: number; // grid x
  positionY: number; // grid y
  spacing?: number; // wingspan in cm
  isLocked?: boolean;
  isDeleted: boolean;
  notes: Note[];
}

export interface Structure {
  id: string;
  terrainId: string;
  zoneId?: string;
  name: string;
  type: string;
  positions: {x: number, y: number}[];
  width?: number;
  height?: number;
  color?: string;
  icon?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  photos?: string[]; // base64
  isDeleted: boolean;
}

export interface ConfigItem {
  id: string;
  type: 'vegetable' | 'variety' | 'state' | 'location' | 'zone' | 'terrain' | 'variety_option' | 'variety_attr_type' | 'setting' | 'expense_category' | 'category';
  value: string;
  parentId?: string; // e.g., vegetable id for a variety, or variety_attr_type id for a variety_option
  attributes?: any; // For variety details, zone dimensions, terrain dimensions
}

export interface BackupEntry {
  id: string;
  date: string;
  data: string; // JSON string
  type: 'auto' | 'manual';
  includePhotos?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dateCreated: string;
  dateDue?: string;
  dateCompleted?: string;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high';
  type: 'manual' | 'automatic';
  seedlingId?: string;
  isDeleted: boolean;
}

export interface EncyclopediaEntry {
  id: string;
  name: string;
  category: string;
  sowingPeriod: string;
  plantingPeriod: string;
  harvestPeriod: string;
  exposure: 'Plein soleil' | 'Mi-ombre' | 'Ombre';
  waterNeeds: 'Faible' | 'Moyen' | 'Élevé';
  spacing: string;
  goodCompanions: string[];
  badCompanions: string[];
  tips: string;
  updatedAt: string;
  pricePerKg?: number;
  color?: string;
  icon?: string;
}

export interface HealthIssue {
  id: string;
  name: string;
  type: 'Ravageur' | 'Maladie' | 'Carence';
  symptoms: string;
  solutions: string[];
  prevention: string;
  affectedPlants: string[];
  updatedAt: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string; // e.g., 'Graines', 'Terreau', 'Outils', 'Eau', 'Autre'
  amount: number;
  description: string;
}

interface FakeTable<T, Key> {
  toArray: () => Promise<T[]>;
  filter: (fn: (item: T) => boolean) => FakeTable<T, Key>;
  where: (field: string) => {
    equals: (val: any) => {
      toArray: () => Promise<T[]>;
      first: () => Promise<T | undefined>;
      and: (fn: (item: T) => boolean) => {
        first: () => Promise<T | undefined>;
      };
      sortBy: (sortField: string) => Promise<T[]>;
    }
  };
  add: (data: Partial<T>) => Promise<Key>;
  put: (data: Partial<T>) => Promise<Key>;
  update: (id: Key, data: Partial<T>) => Promise<any>;
  delete: (id: Key) => Promise<void>;
  get: (id: Key) => Promise<T | undefined>;
  clear: () => Promise<void>;
  bulkDelete: (ids: Key[]) => Promise<void>;
  bulkAdd: (items: Partial<T>[]) => Promise<void>;
  bulkPut: (items: Partial<T>[]) => Promise<void>;
  count: () => Promise<number>;
}

export const db = {
  seedlings: createFirebaseTable<Seedling, string>('seedlings'),
  journal: createFirebaseTable<JournalEntry, string>('journal'),
  config: createFirebaseTable<ConfigItem, string>('config'),
  trees: createFirebaseTable<Tree, string>('trees'),
  structures: createFirebaseTable<Structure, string>('structures'),
  tasks: createFirebaseTable<Task, string>('tasks'),
  encyclopedia: createFirebaseTable<EncyclopediaEntry, string>('encyclopedia'),
  healthIssues: createFirebaseTable<HealthIssue, string>('healthIssues'),
  expenses: createFirebaseTable<Expense, string>('expenses'),
  backups: createFirebaseTable<BackupEntry, string>('backups'),
  transaction: async (mode: string, tables: any, callback: () => Promise<void>) => {
    // Just execute the callback. We don't support real transactions here for simplicity.
    await callback();
  },
  on: (event: string, callback: () => void) => {
    // ignore
  }
};

function createFirebaseTable<T, Key>(collectionName: string): FakeTable<T, Key> {
  return {
    toArray: async () => {
      const { fb } = await import('./hooks/useFirebaseData');
      return await fb.getAll<T>(collectionName);
    },
    filter: (fn: any) => ({
      ...createFirebaseTable<T, Key>(collectionName),
      toArray: async () => {
        const { fb } = await import('./hooks/useFirebaseData');
        const all = await fb.getAll<T>(collectionName);
        return all.filter(fn);
      }
    }),
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: async () => {
          const { fb } = await import('./hooks/useFirebaseData');
          const all = await fb.getAll<T>(collectionName);
          return all.filter((x:any) => x[field] === val);
        },
        first: async () => {
          const { fb } = await import('./hooks/useFirebaseData');
          const all = await fb.getAll<T>(collectionName);
          return all.find((x:any) => x[field] === val);
        },
        and: (fn: any) => ({
          first: async () => {
            const { fb } = await import('./hooks/useFirebaseData');
            const all = await fb.getAll<T>(collectionName);
            return all.filter((x:any) => x[field] === val).find(fn);
          }
        }),
        sortBy: async (sortField: string) => {
          const { fb } = await import('./hooks/useFirebaseData');
          const all = await fb.getAll<T>(collectionName);
          return all.filter((x:any) => x[field] === val).sort((a:any, b:any) => String(a[sortField]).localeCompare(String(b[sortField])));
        }
      })
    }),
    add: async (data: any) => {
      const { fb } = await import('./hooks/useFirebaseData');
      return await fb.add(collectionName, data) as any;
    },
    put: async (data: any) => {
      const { fb } = await import('./hooks/useFirebaseData');
      return await fb.put(collectionName, data) as any;
    },
    update: async (id: Key, data: any) => {
      const { fb } = await import('./hooks/useFirebaseData');
      return await fb.update(collectionName, id as any, data);
    },
    delete: async (id: Key) => {
      const { fb } = await import('./hooks/useFirebaseData');
      return await fb.delete(collectionName, id as any);
    },
    get: async (id: Key) => {
      const { fb } = await import('./hooks/useFirebaseData');
      return await fb.get<T>(collectionName, id as any);
    },
    clear: async () => {
      const { fb } = await import('./hooks/useFirebaseData');
      const all = await fb.getAll<T>(collectionName);
      for (const item of all) {
        await fb.delete(collectionName, (item as any).id);
      }
    },
    bulkDelete: async (ids: Key[]) => {
      const { fb } = await import('./hooks/useFirebaseData');
      for (const id of ids) {
        await fb.delete(collectionName, id as any);
      }
    },
    bulkAdd: async (items: any[]) => {
      const { fb } = await import('./hooks/useFirebaseData');
      for (const item of items) {
        await fb.add(collectionName, item);
      }
    },
    bulkPut: async (items: any[]) => {
      const { fb } = await import('./hooks/useFirebaseData');
      for (const item of items) {
        await fb.put(collectionName, item);
      }
    },
    count: async () => {
      const { fb } = await import('./hooks/useFirebaseData');
      const all = await fb.getAll(collectionName);
      return all.length;
    }
  };
}
