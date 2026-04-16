/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { SeedlingsList } from './views/SeedlingsList';
import { SeedlingForm } from './views/SeedlingForm';
import { SeedlingDetail } from './views/SeedlingDetail';
import { Journal } from './views/Journal';
import { Config } from './views/Config';
import { Trash } from './views/Trash';
import { Backup } from './views/Backup';
import { GardenPlan } from './views/GardenPlan';
import { Orchard } from './views/Orchard';
import { CalendarView } from './views/CalendarView';
import { HarvestStats } from './views/HarvestStats';
import { TasksView } from './views/TasksView';
import { EncyclopediaView } from './views/EncyclopediaView';
import { backupService } from './backupService';
import { db } from './db';
import { v4 as uuidv4 } from 'uuid';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { startSync, stopSync, clearLocalDb } from './sync';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        startSync(user.uid);
      } else {
        stopSync();
        // Optionnel : vider la base locale à la déconnexion pour la confidentialité
        // await clearLocalDb();
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle navigation with history
  const handleNavigate = (view: string, replace = false) => {
    if (view === currentView) return;
    
    if (replace) {
      window.history.replaceState({ view }, '');
    } else {
      window.history.pushState({ view }, '');
    }
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    window.history.back();
  };

  // Sync with browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setCurrentView(event.state.view);
      } else {
        setCurrentView('dashboard');
      }
      window.scrollTo(0, 0);
    };
    
    // Set initial state
    window.history.replaceState({ view: currentView }, '');
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    backupService.initAutoBackup();
    
    // Create the specific L-shaped terrain if it doesn't exist
    const setupTerrain = async () => {
      const existingTerrain = await db.config.where('value').equals('Mon terrain en L').and(item => item.type === 'terrain').first();
      
      const attributes = {
        width: 3700,
        height: 11200,
        shape: 'polygon',
        points: [
          { x: 800, y: 0 },
          { x: 3700, y: 0 },
          { x: 3700, y: 11200 },
          { x: 0, y: 11200 },
          { x: 0, y: 3800 },
          { x: 800, y: 3800 }
        ]
      };

      if (!existingTerrain) {
        await db.config.add({
          id: uuidv4(),
          type: 'terrain',
          value: 'Mon terrain en L',
          attributes
        });
      } else if (!existingTerrain.attributes || existingTerrain.attributes.shape !== 'polygon') {
        // Update if it was created without the right attributes
        await db.config.update(existingTerrain.id, { attributes });
      }

      // Cleanup: Remove the zone version if it was accidentally created
      const existingZone = await db.config.where('value').equals('Mon terrain en L').and(item => item.type === 'zone').first();
      if (existingZone) {
        await db.config.delete(existingZone.id);
      }
    };
    setupTerrain();

    // Migration for states and origin
    const migrateStates = async () => {
      const seedlings = await db.seedlings.toArray();
      const updates = seedlings.map(s => {
        let needsUpdate = false;
        const updateData: any = {};
        
        if (s.state === 'Semis' || s.state === 'Semé') {
          updateData.state = 'Démarrage';
          needsUpdate = true;
        } else if (s.state === 'Bouturage / Marcotage' || s.state === 'Bouturage' || s.state === 'Marcottage') {
          updateData.state = 'Démarrage';
          updateData.origin = s.state.includes('Marcotage') || s.state.includes('Marcottage') ? 'Marcottage' : 'Bouturage';
          needsUpdate = true;
        } else if (s.state === 'Repiqué') {
          updateData.state = 'Repiquage';
          needsUpdate = true;
        }

        if (!s.origin && !updateData.origin) {
          updateData.origin = 'Semis';
          needsUpdate = true;
        }

        return needsUpdate ? { id: s.id, ...updateData } : null;
      }).filter(Boolean);

      for (const update of updates) {
        await db.seedlings.update(update.id, update);
      }

      // Update config states
      const states = await db.config.where('type').equals('state').toArray();
      for (const state of states) {
        if (state.value === 'Semis' || state.value === 'Semé') {
          await db.config.update(state.id, { value: 'Démarrage' });
        } else if (state.value === 'Bouturage / Marcotage' || state.value === 'Bouturage' || state.value === 'Marcottage') {
          await db.config.delete(state.id);
        } else if (state.value === 'Repiqué') {
          await db.config.update(state.id, { value: 'Repiquage' });
        }
      }

      // Update default setting if needed
      const defaultState = await db.config.where('id').equals('default_state').first();
      if (defaultState && (defaultState.value === 'Semis' || defaultState.value === 'Semé')) {
        await db.config.update(defaultState.id, { value: 'Démarrage' });
      }
    };
    migrateStates();

    // Function to deduplicate entries
    const deduplicate = async () => {
      const allEntries = await db.encyclopedia.toArray();
      const seen = new Set<string>();
      const toDelete: string[] = [];
      
      allEntries.forEach(entry => {
        const nameKey = entry.name?.toLowerCase().trim();
        if (seen.has(nameKey)) {
          toDelete.push(entry.id);
        } else {
          seen.add(nameKey);
        }
      });

      if (toDelete.length > 0) {
        await db.encyclopedia.bulkDelete(toDelete);
      }

      const allHealth = await db.healthIssues.toArray();
      const seenHealth = new Set<string>();
      const toDeleteHealth: string[] = [];

      allHealth.forEach(entry => {
        const nameKey = entry.name?.toLowerCase().trim();
        if (seenHealth.has(nameKey)) {
          toDeleteHealth.push(entry.id);
        } else {
          seenHealth.add(nameKey);
        }
      });

      if (toDeleteHealth.length > 0) {
        await db.healthIssues.bulkDelete(toDeleteHealth);
      }
    };

    // Populate Encyclopedia if empty
    const populateEncyclopedia = async () => {
      await db.transaction('rw', db.encyclopedia, async () => {
        const count = await db.encyclopedia.count();
        if (count === 0) {
          const initialData = [
            {
              id: uuidv4(),
              name: 'Tomate',
              category: 'Fruit',
              sowingPeriod: 'Février - Mars (au chaud)',
              plantingPeriod: 'Mai - Juin',
              harvestPeriod: 'Juillet - Octobre',
              exposure: 'Plein soleil',
              waterNeeds: 'Élevé',
              spacing: '50 x 80 cm',
              goodCompanions: ['Basilic', 'Carotte', 'Oignon', 'Persil', 'Ail'],
              badCompanions: ['Pomme de terre', 'Chou', 'Betterave', 'Fenouil'],
              tips: 'Supprimez les gourmands pour favoriser les fruits. Arrosez au pied sans mouiller le feuillage.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Courgette',
              category: 'Fruit',
              sowingPeriod: 'Avril - Mai',
              plantingPeriod: 'Mai - Juin',
              harvestPeriod: 'Juillet - Septembre',
              exposure: 'Plein soleil',
              waterNeeds: 'Élevé',
              spacing: '100 x 100 cm',
              goodCompanions: ['Haricot', 'Maïs', 'Oignon', 'Pois'],
              badCompanions: ['Concombre', 'Pomme de terre'],
              tips: 'Récoltez régulièrement pour encourager la production de nouvelles fleurs.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Carotte',
              category: 'Racine',
              sowingPeriod: 'Mars - Juillet',
              plantingPeriod: 'Direct en place',
              harvestPeriod: 'Juillet - Novembre',
              exposure: 'Plein soleil',
              waterNeeds: 'Moyen',
              spacing: '10 x 25 cm',
              goodCompanions: ['Poireau', 'Oignon', 'Laitue', 'Tomate', 'Pois'],
              badCompanions: ['Betterave', 'Aneth'],
              tips: 'Le poireau et l\'oignon éloignent la mouche de la carotte.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Laitue',
              category: 'Feuille',
              sowingPeriod: 'Février - Septembre',
              plantingPeriod: 'Mars - Octobre',
              harvestPeriod: 'Avril - Novembre',
              exposure: 'Mi-ombre',
              waterNeeds: 'Élevé',
              spacing: '25 x 25 cm',
              goodCompanions: ['Carotte', 'Radis', 'Fraise', 'Concombre'],
              badCompanions: ['Persil', 'Tournesol'],
              tips: 'Échelonnez les semis toutes les 3 semaines pour en avoir toute la saison.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Poivron',
              category: 'Fruit',
              sowingPeriod: 'Février - Mars (au chaud)',
              plantingPeriod: 'Mai - Juin',
              harvestPeriod: 'Août - Octobre',
              exposure: 'Plein soleil',
              waterNeeds: 'Moyen',
              spacing: '40 x 50 cm',
              goodCompanions: ['Basilic', 'Carotte', 'Origan', 'Oignon'],
              badCompanions: ['Fenouil', 'Chou-fleur'],
              tips: 'A besoin de beaucoup de chaleur pour mûrir.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Haricot vert',
              category: 'Légumineuse',
              sowingPeriod: 'Mai - Juillet',
              plantingPeriod: 'Direct en place',
              harvestPeriod: 'Juillet - Octobre',
              exposure: 'Plein soleil',
              waterNeeds: 'Moyen',
              spacing: '10 x 40 cm',
              goodCompanions: ['Maïs', 'Courge', 'Pomme de terre', 'Carotte'],
              badCompanions: ['Ail', 'Oignon', 'Poireau', 'Échalote'],
              tips: 'Butter les pieds quand ils atteignent 20 cm de haut.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Radis',
              category: 'Racine',
              sowingPeriod: 'Mars - Septembre',
              plantingPeriod: 'Direct en place',
              harvestPeriod: 'Avril - Octobre',
              exposure: 'Mi-ombre',
              waterNeeds: 'Moyen',
              spacing: '3 x 15 cm',
              goodCompanions: ['Laitue', 'Carotte', 'Pois', 'Haricot'],
              badCompanions: ['Chou', 'Hysope'],
              tips: 'Arrosez régulièrement pour éviter qu\'ils ne deviennent trop piquants.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Aubergine',
              category: 'Fruit',
              sowingPeriod: 'Février - Mars (au chaud)',
              plantingPeriod: 'Mai - Juin',
              harvestPeriod: 'Août - Octobre',
              exposure: 'Plein soleil',
              waterNeeds: 'Élevé',
              spacing: '50 x 60 cm',
              goodCompanions: ['Haricot', 'Poivron', 'Thym', 'Souci'],
              badCompanions: ['Pomme de terre', 'Oignon'],
              tips: 'Nécessite une terre riche et beaucoup de soleil.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Poireau',
              category: 'Bulbe',
              sowingPeriod: 'Janvier - Mai',
              plantingPeriod: 'Mai - Juillet',
              harvestPeriod: 'Septembre - Avril',
              exposure: 'Plein soleil',
              waterNeeds: 'Moyen',
              spacing: '15 x 30 cm',
              goodCompanions: ['Carotte', 'Fraise', 'Tomate', 'Laitue'],
              badCompanions: ['Pois', 'Haricot', 'Betterave'],
              tips: 'Coupez les racines et le haut des feuilles avant la plantation pour favoriser la reprise.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Pomme de terre',
              category: 'Tubercule',
              sowingPeriod: 'Mars - Avril',
              plantingPeriod: 'Mars - Avril',
              harvestPeriod: 'Juin - Octobre',
              exposure: 'Plein soleil',
              waterNeeds: 'Moyen',
              spacing: '40 x 60 cm',
              goodCompanions: ['Haricot', 'Pois', 'Maïs', 'Chou'],
              badCompanions: ['Tomate', 'Courgette', 'Aubergine', 'Tournesol'],
              tips: 'Buttez les pieds régulièrement pour augmenter le rendement et éviter le verdissement.',
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Fraise',
              category: 'Fruit',
              sowingPeriod: 'Août - Septembre',
              plantingPeriod: 'Août - Octobre',
              harvestPeriod: 'Mai - Juillet',
              exposure: 'Plein soleil',
              waterNeeds: 'Moyen',
              spacing: '30 x 40 cm',
              goodCompanions: ['Poireau', 'Oignon', 'Laitue', 'Épinard'],
              badCompanions: ['Chou'],
              tips: 'Paillez le sol pour garder les fruits propres et limiter l\'évaporation.',
              updatedAt: new Date().toISOString()
            }
          ];
          await db.encyclopedia.bulkAdd(initialData as any);
        }
      });
    };

    const populateHealthIssues = async () => {
      await db.transaction('rw', db.healthIssues, async () => {
        const count = await db.healthIssues.count();
        if (count === 0) {
          const initialHealthData = [
            {
              id: uuidv4(),
              name: 'Pucerons',
              type: 'Ravageur',
              symptoms: 'Feuilles recroquevillées, présence de miellat collant, colonies d\'insectes verts ou noirs.',
              solutions: ['Savon noir dilué', 'Purin d\'ortie', 'Favoriser les coccinelles'],
              prevention: 'Éviter les excès d\'azote, planter des capucines comme pièges.',
              affectedPlants: ['Tomate', 'Laitue', 'Rosier', 'Fève'],
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Mildiou',
              type: 'Maladie',
              symptoms: 'Taches brunes sur les feuilles, feutrage blanc au revers, pourriture des fruits.',
              solutions: ['Bouillie bordelaise (modérément)', 'Supprimer les parties atteintes', 'Bicarbonate de soude'],
              prevention: 'Ne pas mouiller le feuillage, espacer les plants, choisir des variétés résistantes.',
              affectedPlants: ['Tomate', 'Pomme de terre', 'Vigne'],
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Limaces et Escargots',
              type: 'Ravageur',
              symptoms: 'Trous irréguliers dans les feuilles, traces de mucus brillant.',
              solutions: ['Barrières physiques (cendres, coquilles d\'oeufs)', 'Pièges à bière', 'Ramassage nocturne'],
              prevention: 'Favoriser les hérissons et les crapauds, arroser le matin plutôt que le soir.',
              affectedPlants: ['Laitue', 'Courgette', 'Jeunes semis'],
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Oïdium',
              type: 'Maladie',
              symptoms: 'Feutrage blanc poudreux sur les feuilles et les tiges.',
              solutions: ['Lait dilué (10%)', 'Soufre mouillable', 'Supprimer les feuilles malades'],
              prevention: 'Éviter les arrosages excessifs du feuillage, favoriser une bonne circulation d\'air.',
              affectedPlants: ['Courgette', 'Concombre', 'Rosier'],
              updatedAt: new Date().toISOString()
            },
            {
              id: uuidv4(),
              name: 'Carence en Azote',
              type: 'Carence',
              symptoms: 'Feuilles jaunissantes (chlorose), croissance ralentie.',
              solutions: ['Purin d\'ortie', 'Sang séché', 'Compost mûr'],
              prevention: 'Rotation des cultures, apport régulier de matière organique.',
              affectedPlants: ['Toutes les plantes'],
              updatedAt: new Date().toISOString()
            }
          ];
          await db.healthIssues.bulkAdd(initialHealthData as any);
        }
      });
    };

    const migrateVegetablesToEncyclopedia = async () => {
      const configVegetables = await db.config.where('type').equals('vegetable').toArray();
      if (configVegetables.length === 0) return;

      const encyclopediaEntries = await db.encyclopedia.toArray();
      
      for (const configVeg of configVegetables) {
        const existingEntry = encyclopediaEntries.find(e => e.name?.toLowerCase() === configVeg.value?.toLowerCase());
        
        if (existingEntry) {
          // Update existing entry with color and icon
          await db.encyclopedia.update(existingEntry.id, {
            color: configVeg.attributes?.color || existingEntry.color,
            icon: configVeg.attributes?.icon || existingEntry.icon,
            spacing: configVeg.attributes?.spacing ? `${configVeg.attributes.spacing} x ${configVeg.attributes.spacing} cm` : existingEntry.spacing
          });
        } else {
          // Create new entry
          await db.encyclopedia.add({
            id: uuidv4(),
            name: configVeg.value,
            category: 'Autre', // Default category
            sowingPeriod: '',
            plantingPeriod: '',
            harvestPeriod: '',
            exposure: 'Plein soleil',
            waterNeeds: 'Moyen',
            spacing: configVeg.attributes?.spacing ? `${configVeg.attributes.spacing} x ${configVeg.attributes.spacing} cm` : '',
            goodCompanions: [],
            badCompanions: [],
            tips: '',
            updatedAt: new Date().toISOString(),
            color: configVeg.attributes?.color,
            icon: configVeg.attributes?.icon
          });
        }

        // Update varieties to point to the encyclopedia entry name instead of config id
        // Wait, varieties currently point to configVeg.id.
        // If we remove configVeg, we need to update varieties to point to the encyclopedia entry ID.
        // Let's find the encyclopedia entry ID.
        const entryId = existingEntry ? existingEntry.id : (await db.encyclopedia.where('name').equals(configVeg.value).first())?.id;
        
        if (entryId) {
          const varieties = await db.config.where('parentId').equals(configVeg.id).toArray();
          for (const variety of varieties) {
            await db.config.update(variety.id, { parentId: entryId });
          }
        }

        // Delete the config item
        await db.config.delete(configVeg.id);
      }
    };

    const fixVarieties = async () => {
      const varieties = await db.config.where('type').equals('variety').toArray();
      const encyclopedia = await db.encyclopedia.toArray();
      const seedlings = await db.seedlings.toArray();
      const trees = await db.trees.toArray();
      
      for (const v of varieties) {
        // Check if parent exists in encyclopedia
        const parentExists = encyclopedia.some(e => e.id === v.parentId);
        if (!parentExists) {
          // 1. Try to find matching seedling to discover parent vegetable
          const matchingSeedling = seedlings.find(s => s.variety === v.value);
          if (matchingSeedling) {
            const parentEnc = encyclopedia.find(e => e.name?.toLowerCase().trim() === matchingSeedling.vegetable?.toLowerCase().trim());
            if (parentEnc) {
              await db.config.update(v.id, { parentId: parentEnc.id });
              continue;
            }
          }
          
          // 2. Try to find matching tree to discover parent species
          const matchingTree = trees.find(t => t.variety === v.value);
          if (matchingTree && matchingTree.species) {
            const parentEnc = encyclopedia.find(e => e.name?.toLowerCase().trim() === matchingTree.species?.toLowerCase().trim());
            if (parentEnc) {
              await db.config.update(v.id, { parentId: parentEnc.id });
              continue;
            }
          }
          
          // 3. If parentId is a string that matches an encyclopedia name, update it to the ID
          const parentByName = encyclopedia.find(e => e.name?.toLowerCase().trim() === String(v.parentId)?.toLowerCase().trim());
          if (parentByName) {
             await db.config.update(v.id, { parentId: parentByName.id });
          }
        }
      }
    };

    const init = async () => {
      await deduplicate();
      await populateEncyclopedia();
      await populateHealthIssues();
      await migrateVegetablesToEncyclopedia();
      await fixVarieties();
    };

    init();
  }, []);

  const renderView = () => {
    if (currentView === 'dashboard') return <Dashboard setCurrentView={handleNavigate} />;
    if (currentView === 'seedlings') return <SeedlingsList setCurrentView={handleNavigate} />;
    if (currentView.startsWith('seedlings-filter-')) {
      const filter = currentView.split('seedlings-filter-')[1];
      return <SeedlingsList setCurrentView={handleNavigate} initialFilter={filter} />;
    }
    if (currentView === 'seedling-new') return <SeedlingForm setCurrentView={handleNavigate} onBack={handleBack} />;
    if (currentView.startsWith('seedling-edit-')) {
      const id = currentView.split('seedling-edit-')[1];
      return <SeedlingForm setCurrentView={handleNavigate} seedlingId={id} onBack={handleBack} />;
    }
    if (currentView.startsWith('seedling-detail-')) {
      const id = currentView.split('seedling-detail-')[1];
      return <SeedlingDetail setCurrentView={handleNavigate} seedlingId={id} onBack={handleBack} />;
    }
    if (currentView === 'journal') return <Journal setCurrentView={handleNavigate} />;
    if (currentView === 'config') return <Config onNavigate={handleNavigate} />;
    if (currentView === 'calendar') return <CalendarView setCurrentView={handleNavigate} />;
    if (currentView === 'stats') return <HarvestStats />;
    if (currentView === 'tasks') return <TasksView setCurrentView={handleNavigate} />;
    if (currentView === 'encyclopedia') return <EncyclopediaView />;
    if (currentView === 'plan') return <GardenPlan setCurrentView={handleNavigate} />;
    if (currentView === 'orchard') return <Orchard />;
    if (currentView === 'trash') return <Trash />;
    if (currentView === 'backup') return <Backup />;
    
    return <Dashboard setCurrentView={handleNavigate} />;
  };

  return (
    <Layout 
      currentView={currentView} 
      setCurrentView={(view) => handleNavigate(view)}
      onBack={handleBack}
      canGoBack={currentView !== 'dashboard'}
    >
      {renderView()}
    </Layout>
  );
}

