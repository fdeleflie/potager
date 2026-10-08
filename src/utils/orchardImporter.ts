import { v4 as uuidv4 } from 'uuid';
import { fb } from '../hooks/useFirebaseData';
import { ORCHARD_PDF_SPECIES, ORCHARD_PDF_VARIETIES } from '../data/orchardPdfData';
import { normalizeCategoryKey, areCategoriesEqual } from './categories';

export interface ImportResult {
  speciesAdded: number;
  varietiesAdded: number;
  alreadyExistingCount: number;
  speciesNamesAdded: string[];
  varietiesNamesAdded: string[];
}

/**
 * Feeds the database with all fruit trees and varieties from the user's PDF plan,
 * under the category "Arbre fruitier", strictly avoiding duplicates.
 */
export async function importOrchardPdfPlants(
  existingEncyclopedia: any[] = [],
  existingConfig: any[] = []
): Promise<ImportResult> {
  const result: ImportResult = {
    speciesAdded: 0,
    varietiesAdded: 0,
    alreadyExistingCount: 0,
    speciesNamesAdded: [],
    varietiesNamesAdded: []
  };

  // 1. Ensure category "Arbre fruitier" exists in config
  const hasCategory = existingConfig.some(
    c => c.type === 'category' && areCategoriesEqual(c.value, 'Arbre fruitier')
  );
  if (!hasCategory) {
    await fb.put('config', {
      id: 'cat_arbre_fruitier',
      type: 'category',
      value: 'Arbre fruitier'
    });
  }

  // 2. Map existing encyclopedia species by normalized name
  const speciesMap = new Map<string, any>();
  existingEncyclopedia.forEach(e => {
    if (e.name) {
      speciesMap.set(normalizeCategoryKey(e.name), e);
    }
  });

  // 3. Process each species
  for (const s of ORCHARD_PDF_SPECIES) {
    const key = normalizeCategoryKey(s.name);
    let speciesEntry = speciesMap.get(key);

    if (!speciesEntry) {
      // Add new species to encyclopedia
      const newId = uuidv4();
      const newEntry = {
        id: newId,
        name: s.name,
        category: 'Arbre fruitier',
        color: s.color,
        icon: s.icon,
        exposure: s.exposure,
        waterNeeds: s.waterNeeds,
        spacing: s.spacing,
        sowingPeriod: '',
        plantingPeriod: s.plantingPeriod,
        harvestPeriod: s.harvestPeriod,
        goodCompanions: [],
        badCompanions: [],
        tips: s.tips,
        updatedAt: new Date().toISOString()
      };

      await fb.add('encyclopedia', newEntry);
      speciesMap.set(key, newEntry);
      speciesEntry = newEntry;
      result.speciesAdded++;
      result.speciesNamesAdded.push(s.name);

      // Also ensure vegetable in config
      const hasVeg = existingConfig.some(
        c => c.type === 'vegetable' && normalizeCategoryKey(c.value) === key
      );
      if (!hasVeg) {
        await fb.add('config', {
          id: uuidv4(),
          type: 'vegetable',
          value: s.name,
          attributes: { color: s.color, icon: s.icon }
        });
      }
    } else {
      result.alreadyExistingCount++;
    }
  }

  // 4. Process each variety
  // Pre-index existing varieties in config
  const existingVarietiesSet = new Set<string>();
  
  // Map any parentId to its species name
  const parentIdToSpecies = new Map<string, string>();
  speciesMap.forEach((entry, key) => {
    if (entry.id) parentIdToSpecies.set(entry.id, key);
  });
  existingConfig.forEach(c => {
    if (c.type === 'vegetable' && c.id && c.value) {
      parentIdToSpecies.set(c.id, normalizeCategoryKey(c.value));
    }
  });

  existingConfig.forEach(c => {
    if (c.type === 'variety' && c.value) {
      const parent = c.parentId || '';
      const varKey = normalizeCategoryKey(c.value);
      existingVarietiesSet.add(`${parent}___${varKey}`);
      
      const parentSpeciesKey = parentIdToSpecies.get(parent);
      if (parentSpeciesKey) {
        existingVarietiesSet.add(`species_${parentSpeciesKey}___${varKey}`);
      }
    }
  });

  for (const item of ORCHARD_PDF_VARIETIES) {
    const speciesKey = normalizeCategoryKey(item.species);
    const speciesEntry = speciesMap.get(speciesKey);
    const parentId = speciesEntry ? speciesEntry.id : '';
    const varKey = normalizeCategoryKey(item.variety);

    const specificKey = `${parentId}___${varKey}`;
    const speciesVarietyKey = `species_${speciesKey}___${varKey}`;

    if (!existingVarietiesSet.has(specificKey) && !existingVarietiesSet.has(speciesVarietyKey)) {
      // Add variety to config
      await fb.add('config', {
        id: uuidv4(),
        type: 'variety',
        value: item.variety,
        parentId: parentId || undefined
      });

      existingVarietiesSet.add(specificKey);
      existingVarietiesSet.add(speciesVarietyKey);
      result.varietiesAdded++;
      result.varietiesNamesAdded.push(`${item.species} : ${item.variety}`);
    } else {
      result.alreadyExistingCount++;
    }
  }

  return result;
}
