import React, { useState, useMemo } from 'react';
import { 
  X, Printer, LayoutGrid, Table, FileText, Stethoscope, 
  Sun, Droplets, Move, ThumbsUp, ThumbsDown, Info, 
  Filter, Check, Sparkles, MapPin, Leaf, Layers
} from 'lucide-react';
import { ExportPlantItem, ExportHealthItem } from '../utils/catalogExport';
import { printElement } from '../utils/print';
import { ICON_MAP, isEmoji } from '../constants';

export interface PlantCatalogPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  plants: ExportPlantItem[];
  filteredPlants: ExportPlantItem[];
  selectedPlant: ExportPlantItem | null;
  healthIssues: ExportHealthItem[];
  activeFilterCategory?: string;
  searchTerm?: string;
}

type PrintLayoutMode = 'table' | 'cards' | 'single' | 'health';
type PrintScope = 'all' | 'filtered' | 'selected';

export function PlantCatalogPrintModal({
  isOpen,
  onClose,
  plants,
  filteredPlants,
  selectedPlant,
  healthIssues,
  activeFilterCategory,
  searchTerm
}: PlantCatalogPrintModalProps) {
  const [layoutMode, setLayoutMode] = useState<PrintLayoutMode>('table');
  const [printScope, setPrintScope] = useState<PrintScope>(selectedPlant ? 'selected' : 'all');
  const [selectedSinglePlantId, setSelectedSinglePlantId] = useState<string>(selectedPlant?.id || plants[0]?.id || '');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [scale, setScale] = useState<number>(90);
  const [includeVarieties, setIncludeVarieties] = useState<boolean>(true);
  const [includeTips, setIncludeTips] = useState<boolean>(true);

  // Target plants
  const targetPlants = useMemo(() => {
    if (layoutMode === 'single') {
      const found = plants.find(p => p.id === selectedSinglePlantId) || selectedPlant || plants[0];
      return found ? [found] : [];
    }
    if (printScope === 'selected' && selectedPlant) {
      return [selectedPlant];
    }
    if (printScope === 'filtered') {
      return filteredPlants;
    }
    return plants;
  }, [layoutMode, selectedSinglePlantId, selectedPlant, printScope, filteredPlants, plants]);

  if (!isOpen) return null;

  const totalVarietiesCount = targetPlants.reduce((acc, p) => acc + (p.varieties?.length || 0), 0);

  const handlePrint = () => {
    let title = 'Catalogue des Plantes';
    if (layoutMode === 'single' && targetPlants[0]) {
      title = `Fiche Culture - ${targetPlants[0].name}`;
    } else if (layoutMode === 'health') {
      title = 'Fiches Santé & Ravageurs du Potager';
    } else if (activeFilterCategory && printScope === 'filtered') {
      title = `Catalogue des Plantes - ${activeFilterCategory}`;
    }

    printElement('catalog-printable-area', title, {
      orientation,
      scale,
      hideHeader: true,
      extraStyles: `
        @media print {
          body {
            background-color: white !important;
            padding: 8mm;
          }
          .no-print {
            display: none !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .page-break-after {
            page-break-after: always;
            break-after: page;
          }
        }
      `
    });
  };

  const renderPlantIcon = (plant: ExportPlantItem, sizeClass: string = "w-4 h-4") => {
    if (plant.icon && isEmoji(plant.icon)) {
      return <span className="text-base leading-none">{plant.icon}</span>;
    }
    const IconComp = ICON_MAP[plant.icon || 'Sprout'] || ICON_MAP['Sprout'] || Leaf;
    return <IconComp className={sizeClass} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">
                Impression du Catalogue des Plantes
              </h3>
              <p className="text-xs text-stone-500">
                Générez des fiches culture et tableaux récapitulatifs mis en page pour impression papier ou PDF
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

        {/* Modal Controls Bar */}
        <div className="p-4 bg-stone-50/80 border-b border-stone-200/80 shrink-0 space-y-3">
          
          {/* Layout Mode Selection */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 shadow-2xs">
              <button
                type="button"
                onClick={() => { setLayoutMode('table'); setOrientation('landscape'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'table' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Tableau Synthétique</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('cards'); setOrientation('portrait'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'cards' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Fiches Livret (Grille)</span>
              </button>

              <button
                type="button"
                onClick={() => { 
                  setLayoutMode('single'); 
                  setOrientation('portrait'); 
                  if (selectedPlant) setSelectedSinglePlantId(selectedPlant.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'single' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Fiche Individuelle</span>
              </button>

              <button
                type="button"
                onClick={() => { setLayoutMode('health'); setOrientation('portrait'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  layoutMode === 'health' ? 'bg-rose-600 text-white font-semibold shadow-xs' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Santé & Ravageurs</span>
              </button>
            </div>

            {/* Scope / Plant Selector */}
            {layoutMode === 'single' ? (
              <div className="flex items-center gap-2">
                <label className="text-xs text-stone-500 font-medium">Plante :</label>
                <select
                  value={selectedSinglePlantId}
                  onChange={(e) => setSelectedSinglePlantId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-stone-800 font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {plants.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>
            ) : layoutMode !== 'health' ? (
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 text-xs">
                <button
                  type="button"
                  onClick={() => setPrintScope('all')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    printScope === 'all' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Tout ({plants.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintScope('filtered')}
                  disabled={filteredPlants.length === plants.length && !activeFilterCategory && !searchTerm}
                  className={`px-2.5 py-1 rounded-md transition-all disabled:opacity-40 ${
                    printScope === 'filtered' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {activeFilterCategory ? `${activeFilterCategory} (${filteredPlants.length})` : `Filtre (${filteredPlants.length})`}
                </button>
                {selectedPlant && (
                  <button
                    type="button"
                    onClick={() => setPrintScope('selected')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      printScope === 'selected' ? 'bg-stone-800 text-white font-semibold' : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Sélection : {selectedPlant.name}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* Quick Options Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 pt-1 border-t border-stone-200/60">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-stone-400">Orientation :</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="print_orientation"
                    checked={orientation === 'landscape'}
                    onChange={() => setOrientation('landscape')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Paysage</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="print_orientation"
                    checked={orientation === 'portrait'}
                    onChange={() => setOrientation('portrait')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Portrait</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-stone-400">Échelle :</span>
                <select
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="px-2 py-0.5 bg-white border border-stone-200 rounded text-xs"
                >
                  <option value={75}>75% (très compact)</option>
                  <option value={85}>85% (compact)</option>
                  <option value={90}>90% (recommandé)</option>
                  <option value={100}>100% (standard)</option>
                </select>
              </div>

              {layoutMode === 'table' && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeVarieties}
                    onChange={(e) => setIncludeVarieties(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Afficher les variétés</span>
                </label>
              )}

              {(layoutMode === 'table' || layoutMode === 'cards') && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTips}
                    onChange={(e) => setIncludeTips(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Inclure les conseils</span>
                </label>
              )}
            </div>

            <div className="text-stone-400 italic text-[11px]">
              {layoutMode === 'health' 
                ? `${healthIssues.length} fiche(s) santé` 
                : `${targetPlants.length} espèce(s) • ${totalVarietiesCount} variété(s)`}
            </div>
          </div>

        </div>

        {/* Printable Area (Preview & Real Target) */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-100 custom-scrollbar">
          
          <div 
            id="catalog-printable-area" 
            className="bg-white p-8 rounded-xl shadow-md border border-stone-200/80 mx-auto max-w-full text-stone-900"
            style={{ minHeight: '600px' }}
          >
            {/* Printable Header */}
            <div className="border-b-2 border-emerald-700 pb-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-serif font-bold text-xl">
                  🌿
                </div>
                <div>
                  <h1 className="text-xl font-serif font-bold text-stone-900 m-0">
                    {layoutMode === 'single' && targetPlants[0]
                      ? `Fiche Culture — ${targetPlants[0].name}`
                      : layoutMode === 'health'
                      ? 'Répertoire Santé & Ravageurs du Jardin'
                      : 'Catalogue & Encyclopédie des Plantes'}
                  </h1>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Mon Jardin & Verger • Édition du {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {layoutMode !== 'health' && ` • ${targetPlants.length} espèce(s) • ${totalVarietiesCount} variété(s)`}
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] text-stone-400">
                {activeFilterCategory && printScope === 'filtered' && (
                  <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-semibold mb-1">
                    {activeFilterCategory}
                  </span>
                )}
                <div>Document généré automatiquement</div>
              </div>
            </div>

            {/* Layout 1: Dense Synthesis Table */}
            {layoutMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 uppercase tracking-wider text-[10px] font-bold border-y border-stone-300">
                      <th className="py-2.5 px-3">Plante</th>
                      <th className="py-2.5 px-3">Catégorie</th>
                      {includeVarieties && <th className="py-2.5 px-3">Variétés</th>}
                      <th className="py-2.5 px-2 text-center">Semis</th>
                      <th className="py-2.5 px-2 text-center">Plantation</th>
                      <th className="py-2.5 px-2 text-center">Récolte</th>
                      <th className="py-2.5 px-2">Exposition / Eau</th>
                      <th className="py-2.5 px-2">Espacement</th>
                      <th className="py-2.5 px-3">Compagnons</th>
                      {includeTips && <th className="py-2.5 px-3">Conseils</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {targetPlants.map((plant, idx) => (
                      <tr 
                        key={plant.id || idx} 
                        className={`hover:bg-stone-50/80 transition-colors page-break-inside-avoid ${idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'}`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-stone-900">
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 text-[10px]"
                              style={{ backgroundColor: plant.color || '#10b981' }}
                            >
                              {renderPlantIcon(plant, "w-3 h-3 text-white")}
                            </span>
                            <span>{plant.name}</span>
                            {(plant.orchardTreeCount || 0) > 0 && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">
                                {plant.orchardTreeCount} au verger
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-stone-600 font-medium">
                          <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px]">
                            {plant.category}
                          </span>
                        </td>
                        {includeVarieties && (
                          <td className="py-2.5 px-3 text-stone-700 max-w-[200px]">
                            {plant.varieties && plant.varieties.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {plant.varieties.map((v, vi) => (
                                  <span key={vi} className="inline-block px-1.5 py-0.2 bg-stone-100 text-stone-800 rounded text-[10px] border border-stone-200">
                                    {v.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-stone-400 italic text-[10px]">-</span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-2 text-center text-stone-700 whitespace-nowrap text-[11px]">
                          {plant.sowingPeriod || '-'}
                        </td>
                        <td className="py-2.5 px-2 text-center text-stone-700 whitespace-nowrap text-[11px]">
                          {plant.plantingPeriod || '-'}
                        </td>
                        <td className="py-2.5 px-2 text-center text-stone-700 whitespace-nowrap text-[11px] font-medium text-emerald-700">
                          {plant.harvestPeriod || '-'}
                        </td>
                        <td className="py-2.5 px-2 text-stone-600 text-[11px] whitespace-nowrap">
                          <div>☀️ {plant.exposure || 'Soleil'}</div>
                          <div className="text-[10px] text-blue-600">💧 {plant.waterNeeds || 'Moyen'}</div>
                        </td>
                        <td className="py-2.5 px-2 text-stone-700 text-[11px]">
                          {plant.spacing ? `${plant.spacing} cm` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-[10px] max-w-[150px]">
                          {plant.goodCompanions && plant.goodCompanions.length > 0 && (
                            <div className="text-emerald-700 font-medium truncate" title={`Bons : ${plant.goodCompanions.join(', ')}`}>
                              👍 {plant.goodCompanions.slice(0, 3).join(', ')}{plant.goodCompanions.length > 3 ? '...' : ''}
                            </div>
                          )}
                          {plant.badCompanions && plant.badCompanions.length > 0 && (
                            <div className="text-rose-600 truncate" title={`Mauvais : ${plant.badCompanions.join(', ')}`}>
                              👎 {plant.badCompanions.slice(0, 2).join(', ')}{plant.badCompanions.length > 2 ? '...' : ''}
                            </div>
                          )}
                          {(!plant.goodCompanions?.length && !plant.badCompanions?.length) && (
                            <span className="text-stone-400 italic">-</span>
                          )}
                        </td>
                        {includeTips && (
                          <td className="py-2.5 px-3 text-stone-600 text-[10px] max-w-[220px] italic">
                            {plant.tips ? (
                              <p className="line-clamp-2">{plant.tips}</p>
                            ) : (
                              <span className="text-stone-300">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Layout 2: Cards / Booklet Grid */}
            {layoutMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {targetPlants.map((plant, idx) => (
                  <div 
                    key={plant.id || idx}
                    className="border border-stone-300 rounded-xl p-4 bg-stone-50/50 page-break-inside-avoid space-y-3"
                  >
                    <div className="flex items-start justify-between border-b border-stone-200 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span 
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 text-xs shadow-xs"
                          style={{ backgroundColor: plant.color || '#10b981' }}
                        >
                          {renderPlantIcon(plant, "w-4 h-4 text-white")}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-stone-900 m-0 leading-tight">{plant.name}</h3>
                          <span className="text-[10px] text-stone-500 uppercase tracking-wider">{plant.category}</span>
                        </div>
                      </div>
                      {(plant.orchardTreeCount || 0) > 0 && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                          📍 {plant.orchardTreeCount} au verger
                        </span>
                      )}
                    </div>

                    {/* Culture calendar */}
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] bg-white p-2 rounded-lg border border-stone-200">
                      <div>
                        <div className="font-bold text-stone-400 uppercase">Semis</div>
                        <div className="font-semibold text-stone-800 mt-0.5">{plant.sowingPeriod || '-'}</div>
                      </div>
                      <div className="border-x border-stone-100">
                        <div className="font-bold text-stone-400 uppercase">Plantation</div>
                        <div className="font-semibold text-stone-800 mt-0.5">{plant.plantingPeriod || '-'}</div>
                      </div>
                      <div>
                        <div className="font-bold text-emerald-600 uppercase">Récolte</div>
                        <div className="font-bold text-emerald-700 mt-0.5">{plant.harvestPeriod || '-'}</div>
                      </div>
                    </div>

                    {/* Conditions */}
                    <div className="flex items-center justify-between text-xs text-stone-600 px-1">
                      <span>☀️ {plant.exposure || 'Plein soleil'}</span>
                      <span>💧 Eau : {plant.waterNeeds || 'Moyen'}</span>
                      <span>📏 {plant.spacing ? `Ø ${plant.spacing} cm` : 'Espacement n.d.'}</span>
                    </div>

                    {/* Varieties */}
                    {plant.varieties && plant.varieties.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-stone-200">
                        <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                          Variétés ({plant.varieties.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {plant.varieties.map((v, vi) => (
                            <span key={vi} className="px-1.5 py-0.5 bg-white border border-stone-200 text-stone-800 rounded text-[10px] font-medium">
                              {v.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Companions */}
                    {(plant.goodCompanions?.length || plant.badCompanions?.length) ? (
                      <div className="text-[10px] space-y-0.5 pt-1 border-t border-stone-200">
                        {plant.goodCompanions && plant.goodCompanions.length > 0 && (
                          <div className="text-emerald-700 font-medium">
                            👍 Bons : {plant.goodCompanions.join(', ')}
                          </div>
                        )}
                        {plant.badCompanions && plant.badCompanions.length > 0 && (
                          <div className="text-rose-600">
                            👎 Mauvais : {plant.badCompanions.join(', ')}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Tips */}
                    {includeTips && plant.tips && (
                      <div className="text-[10px] text-stone-600 italic bg-amber-50/60 p-2 rounded border border-amber-100 leading-snug">
                        "{plant.tips}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Layout 3: Single Plant Detailed Sheet */}
            {layoutMode === 'single' && targetPlants[0] && (
              <div className="space-y-6 page-break-inside-avoid">
                {(() => {
                  const p = targetPlants[0];
                  return (
                    <>
                      {/* Top banner */}
                      <div 
                        className="p-6 rounded-2xl text-white flex items-start justify-between shadow-xs"
                        style={{ backgroundColor: p.color || '#10b981' }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-3xl shadow-inner">
                            {renderPlantIcon(p, "w-8 h-8 text-white")}
                          </div>
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
                              {p.category}
                            </span>
                            <h2 className="text-2xl font-serif font-bold m-0">{p.name}</h2>
                          </div>
                        </div>
                        {(p.orchardTreeCount || 0) > 0 && (
                          <div className="bg-white/25 px-3 py-1 rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" />
                            <span>{p.orchardTreeCount} arbre(s) au verger</span>
                          </div>
                        )}
                      </div>

                      {/* Key Indicators */}
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">Exposition</div>
                          <div className="font-semibold text-stone-800 text-sm mt-0.5">{p.exposure || 'Plein soleil'}</div>
                        </div>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">Besoins en eau</div>
                          <div className="font-semibold text-blue-700 text-sm mt-0.5">{p.waterNeeds || 'Moyen'}</div>
                        </div>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">Espacement</div>
                          <div className="font-semibold text-stone-800 text-sm mt-0.5">{p.spacing ? `${p.spacing} cm` : 'Non défini'}</div>
                        </div>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">Prix estimé</div>
                          <div className="font-semibold text-emerald-700 text-sm mt-0.5">{p.pricePerKg ? `${p.pricePerKg} €/kg` : 'Non renseigné'}</div>
                        </div>
                      </div>

                      {/* Cultivation Calendar */}
                      <div className="border border-stone-200 rounded-xl p-4 bg-emerald-50/40">
                        <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-3">Calendrier de culture</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="bg-white p-2.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                            <div className="text-[10px] font-bold text-stone-400 uppercase">Semis</div>
                            <div className="text-sm font-bold text-stone-800 mt-0.5">{p.sowingPeriod || 'Non renseigné'}</div>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                            <div className="text-[10px] font-bold text-stone-400 uppercase">Plantation</div>
                            <div className="text-sm font-bold text-stone-800 mt-0.5">{p.plantingPeriod || 'Non renseigné'}</div>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-emerald-200/60 shadow-2xs">
                            <div className="text-[10px] font-bold text-emerald-600 uppercase">Récolte</div>
                            <div className="text-sm font-bold text-emerald-700 mt-0.5">{p.harvestPeriod || 'Non renseigné'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Companionship */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/30">
                          <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                            Bons compagnons
                          </h4>
                          {p.goodCompanions && p.goodCompanions.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {p.goodCompanions.map((c, i) => (
                                <span key={i} className="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400 italic">Aucune association renseignée</p>
                          )}
                        </div>

                        <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/30">
                          <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ThumbsDown className="w-3.5 h-3.5 text-rose-600" />
                            Mauvais compagnons
                          </h4>
                          {p.badCompanions && p.badCompanions.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {p.badCompanions.map((c, i) => (
                                <span key={i} className="px-2.5 py-1 bg-white border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400 italic">Aucune incompatibilité renseignée</p>
                          )}
                        </div>
                      </div>

                      {/* Tips */}
                      {p.tips && (
                        <div className="border border-stone-200 rounded-xl p-4 bg-amber-50/40">
                          <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-amber-600" />
                            Conseils de culture & astuces
                          </h4>
                          <p className="text-xs text-stone-700 leading-relaxed italic">
                            "{p.tips}"
                          </p>
                        </div>
                      )}

                      {/* Varieties Table */}
                      <div className="border border-stone-200 rounded-xl p-4 bg-white">
                        <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-3 flex items-center justify-between">
                          <span>Variétés répertoriées ({p.varieties?.length || 0})</span>
                        </h4>
                        {p.varieties && p.varieties.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-stone-100 text-stone-600 text-[10px] uppercase font-bold border-y border-stone-200">
                                  <th className="py-2 px-3">Nom de la variété</th>
                                  <th className="py-2 px-3">Attributs & caractéristiques</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {p.varieties.map((v, i) => (
                                  <tr key={i} className="hover:bg-stone-50">
                                    <td className="py-2 px-3 font-semibold text-stone-900">{v.name}</td>
                                    <td className="py-2 px-3 text-stone-600">
                                      {v.attributes && Object.keys(v.attributes).length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {Object.entries(v.attributes).map(([ak, av]) => (
                                            <span key={ak} className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] text-stone-700">
                                              {String(av)}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-stone-400 italic text-[10px]">-</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-stone-400 italic">Aucune variété enregistrée pour cette espèce.</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Layout 4: Health & Pests */}
            {layoutMode === 'health' && (
              <div className="space-y-4">
                {healthIssues.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 page-break-inside-avoid space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${
                          item.type === 'Ravageur' ? 'bg-amber-500' :
                          item.type === 'Maladie' ? 'bg-rose-500' : 'bg-blue-500'
                        }`} />
                        <h3 className="text-sm font-bold text-stone-900 m-0">{item.name}</h3>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                        item.type === 'Ravageur' ? 'bg-amber-100 text-amber-800' :
                        item.type === 'Maladie' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.type}
                      </span>
                    </div>

                    {item.symptoms && (
                      <div className="text-xs text-stone-700">
                        <strong className="text-stone-900">Symptômes :</strong> {item.symptoms}
                      </div>
                    )}

                    {item.solutions && item.solutions.length > 0 && (
                      <div className="text-xs text-emerald-800">
                        <strong>Solutions naturelles :</strong> {item.solutions.join(', ')}
                      </div>
                    )}

                    {item.prevention && (
                      <div className="text-xs text-stone-600 italic">
                        <strong>Prévention :</strong> {item.prevention}
                      </div>
                    )}

                    {item.affectedPlants && item.affectedPlants.length > 0 && (
                      <div className="text-[10px] text-stone-500 pt-1 border-t border-stone-200">
                        <strong>Plantes sensibles :</strong> {item.affectedPlants.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Printable Footer */}
            <div className="border-t border-stone-200 pt-4 mt-8 text-center text-[10px] text-stone-400">
              Imprimé depuis l'application Gestion du Potager & Verger • Page 1
            </div>

          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-stone-500">
            Conseil : sélectionnez <strong>« Enregistrer au format PDF »</strong> dans la fenêtre d'impression pour générer un document PDF.
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium rounded-xl transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Lancer l'impression</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
