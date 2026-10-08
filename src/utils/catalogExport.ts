/**
 * Plant Catalog & Health Issues Export Utility
 * Generates Excel-friendly CSV (with UTF-8 BOM) and structured JSON exports
 */

export interface ExportPlantItem {
  id: string;
  name: string;
  category: string;
  sowingPeriod?: string;
  plantingPeriod?: string;
  harvestPeriod?: string;
  exposure?: string;
  waterNeeds?: string;
  spacing?: string;
  pricePerKg?: number;
  goodCompanions?: string[];
  badCompanions?: string[];
  tips?: string;
  color?: string;
  icon?: string;
  varieties?: Array<{
    id?: string;
    name: string;
    attributes?: Record<string, any>;
  }>;
  orchardTreeCount?: number;
}

export interface ExportHealthItem {
  id?: string;
  name: string;
  type: string;
  symptoms?: string;
  solutions?: string[];
  prevention?: string;
  affectedPlants?: string[];
}

/**
 * Escapes a cell value for CSV format
 */
function escapeCsvValue(val: any, delimiter: string = ';'): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // If string contains delimiter, double quote, or newlines, wrap in quotes and escape quotes
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Creates a CSV string with UTF-8 BOM for proper accented character rendering in Excel
 */
function buildCsv(rows: string[][], delimiter: string = ';'): string {
  const csvContent = rows.map(row => row.map(cell => escapeCsvValue(cell, delimiter)).join(delimiter)).join('\r\n');
  return '\uFEFF' + csvContent; // UTF-8 BOM for Excel
}

/**
 * Triggers file download in browser
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  
  // Try modern File System Access API if available
  if ('showSaveFilePicker' in window) {
    (window as any).showSaveFilePicker({
      suggestedName: filename,
      types: [{
        description: filename.endsWith('.json') ? 'Fichier JSON' : 'Fichier CSV',
        accept: { [mimeType]: [filename.endsWith('.json') ? '.json' : '.csv'] },
      }],
    }).then(async (handle: any) => {
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    }).catch((err: any) => {
      if (err.name === 'AbortError') return;
      fallbackDownload(blob, filename);
    });
    return;
  }

  fallbackDownload(blob, filename);
}

function fallbackDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports summary plant list (one row per plant with grouped varieties)
 */
export function generatePlantsSummaryCSV(
  plants: ExportPlantItem[],
  delimiter: string = ';'
): string {
  const headers = [
    'Nom de la plante',
    'Catégorie',
    'Nombre de variétés',
    'Variétés répertoriées',
    'Période de semis',
    'Période de plantation',
    'Période de récolte',
    'Exposition',
    'Besoins en eau',
    'Espacement (cm)',
    'Prix estimé (€/kg)',
    'Bons compagnons',
    'Mauvais compagnons',
    'Conseils de culture',
    'Arbres au verger (nb)'
  ];

  const rows: string[][] = [headers];

  plants.forEach(plant => {
    const varietyNames = (plant.varieties || []).map(v => v.name).join(', ');
    const varietyCount = (plant.varieties || []).length;

    rows.push([
      plant.name || '',
      plant.category || '',
      String(varietyCount),
      varietyNames,
      plant.sowingPeriod || '',
      plant.plantingPeriod || '',
      plant.harvestPeriod || '',
      plant.exposure || '',
      plant.waterNeeds || '',
      plant.spacing || '',
      plant.pricePerKg ? String(plant.pricePerKg) : '',
      (plant.goodCompanions || []).join(', '),
      (plant.badCompanions || []).join(', '),
      plant.tips || '',
      String(plant.orchardTreeCount || 0)
    ]);
  });

  return buildCsv(rows, delimiter);
}

/**
 * Exports detailed plant varieties list (one row per variety)
 */
export function generatePlantVarietiesDetailedCSV(
  plants: ExportPlantItem[],
  attributeTypes: Array<{ id: string; value: string }> = [],
  delimiter: string = ';'
): string {
  const dynamicAttrHeaders = attributeTypes.map(at => at.value);
  
  const headers = [
    'Nom de la plante',
    'Catégorie',
    'Nom de la variété',
    ...dynamicAttrHeaders,
    'Période de semis',
    'Période de plantation',
    'Période de récolte',
    'Exposition',
    'Besoins en eau',
    'Espacement (cm)',
    'Prix estimé (€/kg)',
    'Bons compagnons',
    'Mauvais compagnons',
    'Conseils de culture'
  ];

  const rows: string[][] = [headers];

  plants.forEach(plant => {
    const varieties = plant.varieties || [];
    if (varieties.length === 0) {
      // Row with plant only
      const attrValues = attributeTypes.map(() => '');
      rows.push([
        plant.name || '',
        plant.category || '',
        '(Toutes / Sans variété spécifique)',
        ...attrValues,
        plant.sowingPeriod || '',
        plant.plantingPeriod || '',
        plant.harvestPeriod || '',
        plant.exposure || '',
        plant.waterNeeds || '',
        plant.spacing || '',
        plant.pricePerKg ? String(plant.pricePerKg) : '',
        (plant.goodCompanions || []).join(', '),
        (plant.badCompanions || []).join(', '),
        plant.tips || ''
      ]);
    } else {
      varieties.forEach(v => {
        const attrValues = attributeTypes.map(at => {
          const val = v.attributes?.[at.id];
          return val ? String(val) : '';
        });

        rows.push([
          plant.name || '',
          plant.category || '',
          v.name || '',
          ...attrValues,
          plant.sowingPeriod || '',
          plant.plantingPeriod || '',
          plant.harvestPeriod || '',
          plant.exposure || '',
          plant.waterNeeds || '',
          plant.spacing || '',
          plant.pricePerKg ? String(plant.pricePerKg) : '',
          (plant.goodCompanions || []).join(', '),
          (plant.badCompanions || []).join(', '),
          plant.tips || ''
        ]);
      });
    }
  });

  return buildCsv(rows, delimiter);
}

/**
 * Exports health issues (pests, diseases, deficiencies) to CSV
 */
export function generateHealthIssuesCSV(
  healthIssues: ExportHealthItem[],
  delimiter: string = ';'
): string {
  const headers = [
    'Nom',
    'Type',
    'Symptômes & Identification',
    'Solutions Naturelles',
    'Prévention',
    'Plantes Sensibles'
  ];

  const rows: string[][] = [headers];

  healthIssues.forEach(item => {
    rows.push([
      item.name || '',
      item.type || '',
      item.symptoms || '',
      (item.solutions || []).join(', '),
      item.prevention || '',
      (item.affectedPlants || []).join(', ')
    ]);
  });

  return buildCsv(rows, delimiter);
}

/**
 * Generates full JSON representation
 */
export function generateCatalogJSON(
  plants: ExportPlantItem[],
  healthIssues: ExportHealthItem[] = []
): string {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    totalPlants: plants.length,
    totalVarieties: plants.reduce((acc, p) => acc + (p.varieties?.length || 0), 0),
    totalHealthIssues: healthIssues.length,
    plants,
    healthIssues
  };

  return JSON.stringify(data, null, 2);
}
