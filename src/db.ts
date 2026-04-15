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

export class GardenDB extends Dexie {
  seedlings!: Table<Seedling, string>;
  journal!: Table<JournalEntry, string>;
  config!: Table<ConfigItem, string>;
  trees!: Table<Tree, string>;
  structures!: Table<Structure, string>;
  backups!: Table<BackupEntry, string>;
  tasks!: Table<Task, string>;
  encyclopedia!: Table<EncyclopediaEntry, string>;
  healthIssues!: Table<HealthIssue, string>;
  expenses!: Table<Expense, string>;

  constructor() {
    super('GardenDB');
    this.version(1).stores({
      seedlings: 'id, vegetable, state, isArchived, isDeleted',
      journal: 'id, date, isDeleted',
      config: 'id, type, value, parentId'
    });
    this.version(2).stores({
      trees: 'id, species, isDeleted'
    }).upgrade(tx => {
      // Upgrade logic if needed
    });
    this.version(3).stores({
      structures: 'id, terrainId'
    });
    this.version(4).stores({
      backups: 'id, date, type'
    });
    this.version(5).stores({
      structures: 'id, terrainId, zoneId'
    });
    this.version(6).stores({
      tasks: 'id, isCompleted, isDeleted, type, seedlingId'
    });
    this.version(7).stores({
      encyclopedia: 'id, name, category'
    });
    this.version(8).stores({
      healthIssues: 'id, name, type'
    });
    this.version(9).stores({
      expenses: 'id, date, category'
    });
  }
}

export const db = new GardenDB();

export const pendingDeletesFromFirestore = new Set<string>();

import { auth, db as firestoreDb } from './firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

const tables = [
  'seedlings', 'journal', 'config', 'trees', 'structures', 
  'tasks', 'encyclopedia', 'healthIssues', 'expenses'
];

tables.forEach(tableName => {
  db.table(tableName).hook('creating', (primKey, obj, trans) => {
    if (obj._fromFirestore) {
      delete obj._fromFirestore;
      return;
    }
    trans.on('complete', () => {
      const user = auth?.currentUser;
      if (!user) return;
      const cleanObj = Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
      setDoc(doc(firestoreDb, `users/${user.uid}/${tableName}`, primKey), cleanObj).catch(console.error);
    });
  });

  db.table(tableName).hook('updating', (mods, primKey, obj, trans) => {
    if (mods._fromFirestore) {
      return { _fromFirestore: undefined };
    }
    trans.on('complete', () => {
      const user = auth?.currentUser;
      if (!user) return;
      const updatedObj = { ...obj, ...mods };
      delete updatedObj._fromFirestore;
      const cleanObj = Object.fromEntries(Object.entries(updatedObj).filter(([_, v]) => v !== undefined));
      setDoc(doc(firestoreDb, `users/${user.uid}/${tableName}`, primKey), cleanObj, { merge: true }).catch(console.error);
    });
  });

  db.table(tableName).hook('deleting', (primKey, obj, trans) => {
    if (pendingDeletesFromFirestore.has(primKey)) {
      pendingDeletesFromFirestore.delete(primKey);
      return;
    }
    trans.on('complete', () => {
      const user = auth?.currentUser;
      if (!user) return;
      deleteDoc(doc(firestoreDb, `users/${user.uid}/${tableName}`, primKey)).catch(console.error);
    });
  });
});

// Initial data population if empty
db.on('populate', () => {
  db.config.bulkAdd([
    { id: 'v1', type: 'vegetable', value: 'Tomate' },
    { id: 'v2', type: 'vegetable', value: 'Courgette' },
    { id: 'v3', type: 'vegetable', value: 'Salade' },
    { id: 'var1', type: 'variety', value: 'Marmande', parentId: 'v1' },
    { id: 'var2', type: 'variety', value: 'Cœur de Bœuf', parentId: 'v1' },
    { id: 's1', type: 'state', value: 'Démarrage' },
    { id: 's2', type: 'state', value: 'Repiquage' },
    { id: 's3', type: 'state', value: 'Mise en terre' },
    { id: 's4', type: 'state', value: 'Vendu / Donné' },
    { id: 'l1', type: 'location', value: 'Mini-serre (Lumière artificielle)' },
    { id: 'l2', type: 'location', value: 'Extérieur' },
    { id: 'l3', type: 'location', value: 'Serre froide' },
    // Default settings
    { id: 'default_state', type: 'setting', value: 'Démarrage' },
    { id: 'default_location', type: 'setting', value: 'Mini-serre (Lumière artificielle)' },
    // Default variety attribute types
    { id: 'at1', type: 'variety_attr_type', value: 'Couleur' },
    { id: 'at2', type: 'variety_attr_type', value: 'Taille' },
    { id: 'at3', type: 'variety_attr_type', value: 'Goût' },
    { id: 'at4', type: 'variety_attr_type', value: 'Aspect' },
    { id: 'at5', type: 'variety_attr_type', value: 'Hauteur' },
    { id: 'at6', type: 'variety_attr_type', value: 'Origine' },
    { id: 'at7', type: 'variety_attr_type', value: 'Précocité' },
    { id: 'at8', type: 'variety_attr_type', value: 'Résistance maladie' },
    { id: 'at9', type: 'variety_attr_type', value: 'Emoji' },
    // Default expense categories
    { id: 'ec1', type: 'expense_category', value: 'Graines' },
    { id: 'ec2', type: 'expense_category', value: 'Terreau' },
    { id: 'ec3', type: 'expense_category', value: 'Outils' },
    { id: 'ec4', type: 'expense_category', value: 'Eau' },
    { id: 'ec5', type: 'expense_category', value: 'Engrais' },
    { id: 'ec6', type: 'expense_category', value: 'Autre' },
    // Default categories
    { id: 'cat1', type: 'category', value: 'Fruit' },
    { id: 'cat2', type: 'category', value: 'Légume' },
    { id: 'cat3', type: 'category', value: 'Aromate' },
    { id: 'cat4', type: 'category', value: 'Fleur' },
  ]);
});
