import React, { useState, useMemo } from 'react';
import { 
  X, Download, Copy, Check, FileSpreadsheet, FileJson, 
  Layers, Filter, Eye, Sparkles, Stethoscope, Leaf
} from 'lucide-react';
import { 
  ExportPlantItem, 
  ExportHealthItem, 
  generatePlantsSummaryCSV, 
  generatePlantVarietiesDetailedCSV, 
  generateHealthIssuesCSV, 
  generateCatalogJSON, 
  downloadFile 
} from '../utils/catalogExport';

export interface PlantCatalogExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plants: ExportPlantItem[];
  filteredPlants: ExportPlantItem[];
  selectedPlant: ExportPlantItem | null;
  healthIssues: ExportHealthItem[];
  attributeTypes?: Array<{ id: string; value: string }>;
  activeFilterCategory?: string;
  searchTerm?: string;
}

type ExportType = 'summary_csv' | 'detailed_csv' | 'json' | 'health_csv';
type ExportScope = 'all' | 'filtered' | 'selected';

export function PlantCatalogExportModal({
  isOpen,
  onClose,
  plants,
  filteredPlants,
  selectedPlant,
  healthIssues,
  attributeTypes = [],
  activeFilterCategory,
  searchTerm
}: PlantCatalogExportModalProps) {
  const [exportType, setExportType] = useState<ExportType>('summary_csv');
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [delimiter, setDelimiter] = useState<';' | ','>(';');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Determine target plants based on scope
  const targetPlants = useMemo(() => {
    if (exportScope === 'selected' && selectedPlant) {
      return [selectedPlant];
    }
    if (exportScope === 'filtered') {
      return filteredPlants;
    }
    return plants;
  }, [exportScope, selectedPlant, filteredPlants, plants]);

  // Generate exported content according to selections
  const generatedContent = useMemo(() => {
    if (exportType === 'summary_csv') {
      return generatePlantsSummaryCSV(targetPlants, delimiter);
    }
    if (exportType === 'detailed_csv') {
      return generatePlantVarietiesDetailedCSV(targetPlants, attributeTypes, delimiter);
    }
    if (exportType === 'health_csv') {
      return generateHealthIssuesCSV(healthIssues, delimiter);
    }
    if (exportType === 'json') {
      return generateCatalogJSON(targetPlants, exportScope === 'all' ? healthIssues : []);
    }
    return '';
  }, [exportType, targetPlants, healthIssues, attributeTypes, delimiter, exportScope]);

  if (!isOpen) return null;

  const totalVarietiesCount = targetPlants.reduce((acc, p) => acc + (p.varieties?.length || 0), 0);

  const getSuggestedFilename = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const categorySuffix = activeFilterCategory && exportScope === 'filtered' 
      ? `_${activeFilterCategory.toLowerCase().replace(/[^a-z0-9]/g, '_')}` 
      : '';
    
    if (exportType === 'summary_csv') {
      return `catalogue_plantes_synthese${categorySuffix}_${dateStr}.csv`;
    }
    if (exportType === 'detailed_csv') {
      return `catalogue_varietes_detaille${categorySuffix}_${dateStr}.csv`;
    }
    if (exportType === 'health_csv') {
      return `catalogue_fiches_sante_${dateStr}.csv`;
    }
    if (exportType === 'json') {
      return `catalogue_plantes_complet${categorySuffix}_${dateStr}.json`;
    }
    return `export_catalogue_${dateStr}.txt`;
  };

  const handleDownload = () => {
    const filename = getSuggestedFilename();
    const mimeType = exportType === 'json' 
      ? 'application/json;charset=utf-8;' 
      : 'text/csv;charset=utf-8;';
    downloadFile(generatedContent, filename, mimeType);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">
                Exporter le Catalogue des Plantes
              </h3>
              <p className="text-xs text-stone-500">
                Transférez vos données vers Excel, Google Sheets, Notion ou un autre outil
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          
          {/* Format selection */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">
              1. Format d'exportation
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              <button
                type="button"
                onClick={() => setExportType('summary_csv')}
                className={`p-3.5 text-left rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                  exportType === 'summary_csv'
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className={`w-4 h-4 ${exportType === 'summary_csv' ? 'text-emerald-600' : 'text-stone-500'}`} />
                  <span className="text-sm font-semibold text-stone-900">Tableur CSV Synthétique</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full ml-auto">Recommandé</span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  1 ligne par plante avec ses variétés regroupées, calendrier, besoins, compagnonnage et conseils.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportType('detailed_csv')}
                className={`p-3.5 text-left rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                  exportType === 'detailed_csv'
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className={`w-4 h-4 ${exportType === 'detailed_csv' ? 'text-emerald-600' : 'text-stone-500'}`} />
                  <span className="text-sm font-semibold text-stone-900">Tableur CSV par Variété</span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  1 ligne par variété avec colonnes d'attributs détaillés (couleur, époque, forme, etc.).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportType('json')}
                className={`p-3.5 text-left rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                  exportType === 'json'
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileJson className={`w-4 h-4 ${exportType === 'json' ? 'text-emerald-600' : 'text-stone-500'}`} />
                  <span className="text-sm font-semibold text-stone-900">Format JSON Structuré</span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Export complet universel avec toutes les métadonnées pour importation logicielle ou API.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportType('health_csv')}
                className={`p-3.5 text-left rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                  exportType === 'health_csv'
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Stethoscope className={`w-4 h-4 ${exportType === 'health_csv' ? 'text-rose-600' : 'text-stone-500'}`} />
                  <span className="text-sm font-semibold text-stone-900">Santé & Ravageurs (CSV)</span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Export des fiches ravageurs, maladies, symptômes et solutions naturelles ({healthIssues.length} fiches).
                </p>
              </button>

            </div>
          </div>

          {/* Scope selection (if not health_csv) */}
          {exportType !== 'health_csv' && (
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">
                2. Périmètre des données à exporter
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left flex items-center justify-between ${
                    exportScope === 'all'
                      ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900 font-semibold'
                      : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Leaf className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Tout le catalogue</span>
                  </div>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full shrink-0">
                    {plants.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('filtered')}
                  disabled={filteredPlants.length === plants.length && !activeFilterCategory && !searchTerm}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left flex items-center justify-between ${
                    exportScope === 'filtered'
                      ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900 font-semibold'
                      : 'border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Filter className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      {activeFilterCategory ? `Catégorie : ${activeFilterCategory}` : (searchTerm ? `Recherche : "${searchTerm}"` : 'Filtre actuel')}
                    </span>
                  </div>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full shrink-0">
                    {filteredPlants.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('selected')}
                  disabled={!selectedPlant}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left flex items-center justify-between ${
                    exportScope === 'selected'
                      ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900 font-semibold'
                      : 'border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{selectedPlant ? selectedPlant.name : 'Plante ouverte'}</span>
                  </div>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full shrink-0">
                    {selectedPlant ? '1' : '0'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* CSV Delimiter (only for CSV exports) */}
          {exportType !== 'json' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">
                3. Séparateur CSV
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="radio"
                    name="csv_delimiter"
                    checked={delimiter === ';'}
                    onChange={() => setDelimiter(';')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Point-virgule (<strong>;</strong>) — Recommandé pour Excel français</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="radio"
                    name="csv_delimiter"
                    checked={delimiter === ','}
                    onChange={() => setDelimiter(',')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Virgule (<strong>,</strong>) — Recommandé pour Google Sheets / Notion</span>
                </label>
              </div>
            </div>
          )}

          {/* Quick Summary Info Box */}
          <div className="p-3.5 bg-stone-50 border border-stone-200/80 rounded-xl flex items-center justify-between text-xs text-stone-600">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>
                Export prêt : <strong>{exportType === 'health_csv' ? healthIssues.length : targetPlants.length}</strong> {exportType === 'health_csv' ? 'fiches santé' : 'espèces'}
                {exportType !== 'health_csv' && ` (${totalVarietiesCount} variétés répertoriées)`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? 'Masquer l\'aperçu' : 'Aperçu des données'}</span>
            </button>
          </div>

          {/* Code preview */}
          {showPreview && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Aperçu brut (extrait)</label>
              <pre className="p-3 bg-stone-900 text-stone-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 custom-scrollbar whitespace-pre">
                {generatedContent.split('\n').slice(0, 15).join('\n')}
                {generatedContent.split('\n').length > 15 ? '\n... (suite dans le fichier téléchargé)' : ''}
              </pre>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copié dans le presse-papier !</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-stone-500" />
                <span>Copier dans le presse-papier</span>
              </>
            )}
          </button>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium rounded-xl transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le fichier</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
