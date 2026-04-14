import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

// Simple distinct color generator if not available
const getDistinctColor = (existingColors: string[]): string => {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', 
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', 
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
  ];
  const availableColors = colors.filter(c => !existingColors.includes(c));
  if (availableColors.length > 0) {
    return availableColors[Math.floor(Math.random() * availableColors.length)];
  }
  return colors[Math.floor(Math.random() * colors.length)]; // Fallback
};

export const reconcileVegetables = async () => {
  try {
    const configVegetables = await db.config.filter(c => c.type === 'vegetable').toArray();
    const encyclopediaEntries = await db.encyclopedia.toArray();

    const existingColors = encyclopediaEntries.map(v => v.color).filter(Boolean) as string[];

    // 1. Ensure all config vegetables have an encyclopedia entry
    for (const configVeg of configVegetables) {
      const existsInEncyclopedia = encyclopediaEntries.some(
        e => e.name.toLowerCase().trim() === configVeg.value.toLowerCase().trim()
      );

      if (!existsInEncyclopedia) {
        await db.encyclopedia.add({
          id: uuidv4(),
          name: configVeg.value,
          category: 'Légume',
          sowingPeriod: '',
          plantingPeriod: '',
          harvestPeriod: '',
          exposure: 'Plein soleil',
          waterNeeds: 'Moyen',
          spacing: '',
          goodCompanions: [],
          badCompanions: [],
          tips: '',
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 2. Ensure all encyclopedia entries (that are vegetables) have a config entry
    for (const entry of encyclopediaEntries) {
      // Assuming all encyclopedia entries are vegetables for now, or check category
      if (entry.category.toLowerCase() !== 'légume' && entry.category.toLowerCase() !== 'legume') {
        continue; // Skip non-vegetables if any
      }

      const existsInConfig = configVegetables.some(
        c => c.value.toLowerCase().trim() === entry.name.toLowerCase().trim()
      );

      if (!existsInConfig) {
        const newColor = getDistinctColor(existingColors);
        existingColors.push(newColor);
        
        await db.config.add({
          id: uuidv4(),
          type: 'vegetable',
          value: entry.name,
          attributes: {
            color: newColor
          }
        });
      }
    }
    console.log('Vegetable reconciliation completed successfully.');
  } catch (error) {
    console.error('Error during vegetable reconciliation:', error);
  }
};
