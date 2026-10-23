import React, { useState, useMemo } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  FileText, 
  Layers, 
  Info,
  Calendar,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { CombinedEntry } from '../views/Journal';
import { fb } from '../hooks/useFirebaseData';
import { v4 as uuidv4 } from 'uuid';
import { Season } from '../db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entries: CombinedEntry[];
  seasons: Season[];
  currentSeasonId: string;
}

interface ParsedImportRow {
  id: string;
  date: string;
  description: string;
  commentaire: string;
  statut: string;
  isValid: boolean;
  error?: string;
}

export function JournalIntegrationModal({
  isOpen,
  onClose,
  entries,
  seasons,
  currentSeasonId
}: Props) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export state
  const [exportSeason, setExportSeason] = useState<string>('all');
  const [exportScope, setExportScope] = useState<'journal_only' | 'all'>('journal_only');
  const [csvDelimiter, setCsvDelimiter] = useState<';' | ','>(';');
  const [copied, setCopied] = useState(false);

  // Import state
  const [importSeason, setImportSeason] = useState<string>(currentSeasonId !== 'all' ? currentSeasonId : (seasons[0]?.id || ''));
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Filter entries to export
  const exportableEntries = useMemo(() => {
    return entries.filter(e => {
      if (exportScope === 'journal_only' && e.type !== 'journal') return false;
      if (exportSeason !== 'all' && e.seasonId !== exportSeason) return false;
      return true;
    });
  }, [entries, exportScope, exportSeason]);

  // Transform entries into the 4 target fields
  const formattedExportData = useMemo(() => {
    return exportableEntries.map(e => {
      // 1. Date (YYYY-MM-DD)
      const dateVal = e.date || '';

      // 2. Description (title or primary action / plant)
      let descVal = (e.description || e.title || '').trim();
      if (!descVal) {
        if (e.sourceName) {
          descVal = e.sourceName;
        } else if (e.content) {
          const firstLine = e.content.split('\n')[0].trim();
          descVal = firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine;
        } else {
          descVal = 'Observation potager';
        }
      }

      // 3. Commentaire (detailed observations / notes)
      let commVal = (e.commentaire || e.content || '').trim();
      // If description was derived from first line and identical to comment, keep comment intact
      if (!commVal) {
        commVal = descVal;
      }

      // 4. Statut (Status text)
      let statutVal = (e.statut || '').trim();
      if (!statutVal) {
        if (e.success === true) statutVal = 'Réussite';
        else if (e.success === false) statutVal = 'Échec';
        else statutVal = 'Fait';
      }

      return {
        date: dateVal,
        description: descVal,
        commentaire: commVal,
        statut: statutVal
      };
    });
  }, [exportableEntries]);

  if (!isOpen) return null;

  // CSV Generator with UTF-8 BOM
  const generateCSVString = (delimiter: string = ';'): string => {
    const headers = ['Date', 'Description', 'Commentaire', 'Statut'];
    const escape = (val: string) => {
      const str = (val || '').toString();
      if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escape).join(delimiter);
    const lines = formattedExportData.map(row => 
      [row.date, row.description, row.commentaire, row.statut].map(escape).join(delimiter)
    );

    return '\uFEFF' + [headerLine, ...lines].join('\r\n');
  };

  const handleDownloadCSV = () => {
    const csvContent = generateCSVString(csvDelimiter);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `journal_potager_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(formattedExportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `journal_potager_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = async () => {
    const csvContent = generateCSVString('\t'); // Tab-separated is great for pasting in Excel / Sheets
    try {
      await navigator.clipboard.writeText(csvContent.replace(/^\uFEFF/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.error('Clipboard copy failed', e);
    }
  };

  const handleDownloadSample = () => {
    const sampleHeaders = ['Date', 'Description', 'Commentaire', 'Statut'];
    const sampleRows = [
      ['2026-04-10', 'Semis de tomates Marmande', 'Semis en terrine au chaud sur lit de terreau semis', 'Fait'],
      ['2026-04-18', 'Arrosage et aération de la serre', 'Température de 22°C sous abri, levée en cours', 'Fait'],
      ['2026-04-25', 'Repiquage en godets individuels', '32 plants vigoureux repiqués avec succès', 'Réussite'],
      ['2026-05-02', 'Désherbage de la planche carottes', 'Désherbage manuel à la gouge, arrosage fin', 'En cours'],
      ['2026-05-15', 'Plantation des courgettes en pleine terre', 'Ajout de compost mûr et paillage de foin', 'À faire']
    ];

    const escape = (val: string) => {
      if (val.includes(';') || val.includes('"')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvContent = '\uFEFF' + [
      sampleHeaders.map(escape).join(';'),
      ...sampleRows.map(r => r.map(escape).join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `modele_journal_4colonnes.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust CSV parser supporting quotes & newlines
  const parseCSVText = (text: string): string[][] => {
    const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const firstLine = normalized.split('\n')[0] || '';
    
    // Auto-detect delimiter
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    let delimiter = ';';
    if (tabCount > semiCount && tabCount > commaCount) delimiter = '\t';
    else if (commaCount > semiCount) delimiter = ',';

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    let i = 0;

    while (i < normalized.length) {
      const char = normalized[i];
      const nextChar = normalized[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentVal += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          currentVal += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        } else if (char === delimiter) {
          currentRow.push(currentVal.trim());
          currentVal = '';
          i++;
          continue;
        } else if (char === '\n') {
          currentRow.push(currentVal.trim());
          if (currentRow.some(c => c.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentVal = '';
          i++;
          continue;
        } else {
          currentVal += char;
          i++;
          continue;
        }
      }
    }

    if (currentVal.length > 0 || currentRow.length > 0) {
      currentRow.push(currentVal.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  // Normalize French and international date formats to YYYY-MM-DD
  const normalizeDate = (raw: string): string => {
    if (!raw) return new Date().toISOString().split('T')[0];
    const trimmed = raw.trim();
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const frMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (frMatch) {
      const d = frMatch[1].padStart(2, '0');
      const m = frMatch[2].padStart(2, '0');
      const y = frMatch[3];
      return `${y}-${m}-${d}`;
    }
    // YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // Fallback standard parse
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setParseError("Le fichier est vide.");
        return;
      }

      try {
        if (file.name.endsWith('.json')) {
          // JSON format parsing
          const data = JSON.parse(text);
          const list = Array.isArray(data) ? data : (data.journal || data.entries || []);
          if (!Array.isArray(list) || list.length === 0) {
            setParseError("Aucune liste d'observations trouvée dans le fichier JSON.");
            return;
          }

          const rows: ParsedImportRow[] = list.map((item: any, idx: number) => {
            const rawDate = item.date || item.Date || item.jour || '';
            const desc = item.description || item.Description || item.titre || item.title || item.action || '';
            const comm = item.commentaire || item.Commentaire || item.commentaires || item.notes || item.content || item.contenu || '';
            const stat = item.statut || item.Statut || item.status || item.Status || item.etat || 'Fait';

            const cleanDate = normalizeDate(rawDate);
            const isValid = Boolean(cleanDate && (desc || comm));

            return {
              id: `json-${idx}`,
              date: cleanDate,
              description: desc || comm.slice(0, 50),
              commentaire: comm || desc,
              statut: stat,
              isValid,
              error: !isValid ? 'Date ou description manquante' : undefined
            };
          });

          setParsedRows(rows);
        } else {
          // CSV parsing
          const table = parseCSVText(text);
          if (table.length < 2) {
            setParseError("Le fichier CSV doit comporter au moins une ligne d'en-tête et une ligne de données.");
            return;
          }

          const headers = table[0].map(h => h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          
          // Identify column indexes
          let dateIdx = headers.findIndex(h => h.includes('date') || h.includes('jour') || h === 'd');
          let descIdx = headers.findIndex(h => h.includes('desc') || h.includes('titre') || h.includes('action') || h.includes('sujet'));
          let commIdx = headers.findIndex(h => h.includes('comment') || h.includes('note') || h.includes('obs') || h.includes('detail') || h.includes('contenu'));
          let statIdx = headers.findIndex(h => h.includes('stat') || h.includes('etat') || h.includes('result'));

          // Default fallback if headers weren't named standard: 0=date, 1=desc, 2=comment, 3=statut
          if (dateIdx === -1 && table[0].length >= 1) dateIdx = 0;
          if (descIdx === -1 && table[0].length >= 2) descIdx = 1;
          if (commIdx === -1 && table[0].length >= 3) commIdx = 2;
          if (statIdx === -1 && table[0].length >= 4) statIdx = 3;

          const rows: ParsedImportRow[] = [];
          for (let r = 1; r < table.length; r++) {
            const row = table[r];
            if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

            const rawDate = dateIdx !== -1 && row[dateIdx] ? row[dateIdx] : '';
            const desc = descIdx !== -1 && row[descIdx] ? row[descIdx] : '';
            const comm = commIdx !== -1 && row[commIdx] ? row[commIdx] : '';
            const stat = statIdx !== -1 && row[statIdx] ? row[statIdx] : 'Fait';

            const cleanDate = normalizeDate(rawDate);
            const isValid = Boolean(cleanDate && (desc || comm));

            rows.push({
              id: `csv-${r}`,
              date: cleanDate,
              description: desc || comm.slice(0, 50),
              commentaire: comm || desc,
              statut: stat || 'Fait',
              isValid,
              error: !isValid ? 'Date ou description manquante' : undefined
            });
          }

          if (rows.length === 0) {
            setParseError("Aucune ligne de données valide trouvée.");
          } else {
            setParsedRows(rows);
          }
        }
      } catch (err: any) {
        console.error('Failed to parse import file:', err);
        setParseError(`Erreur lors de la lecture du fichier : ${err.message || 'Format invalide'}`);
      }
    };

    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      // Build index of existing items to detect duplicates if requested
      const existingSignatures = new Set<string>();
      if (skipDuplicates) {
        entries.forEach(e => {
          const normDesc = (e.description || e.title || '').trim().toLowerCase();
          const normContent = (e.commentaire || e.content || '').trim().toLowerCase();
          existingSignatures.add(`${e.date}__${normDesc}`);
          existingSignatures.add(`${e.date}__${normContent}`);
        });
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const row of validRows) {
        const normDesc = row.description.trim().toLowerCase();
        const normComm = row.commentaire.trim().toLowerCase();

        if (skipDuplicates && (
          existingSignatures.has(`${row.date}__${normDesc}`) ||
          existingSignatures.has(`${row.date}__${normComm}`)
        )) {
          skippedCount++;
          continue;
        }

        // Determine success status based on statut text
        const lowerStat = row.statut.toLowerCase();
        let successStatus: 'none' | 'success' | 'failure' = 'none';
        let successVal: boolean | undefined = undefined;

        if (lowerStat.includes('réussi') || lowerStat.includes('reussi') || lowerStat.includes('succès') || lowerStat.includes('succes')) {
          successStatus = 'success';
          successVal = true;
        } else if (lowerStat.includes('échec') || lowerStat.includes('echec') || lowerStat.includes('raté') || lowerStat.includes('rate')) {
          successStatus = 'failure';
          successVal = false;
        }

        const newEntry = {
          id: uuidv4(),
          date: row.date,
          title: row.description,
          description: row.description,
          content: row.commentaire || row.description,
          commentaire: row.commentaire,
          statut: row.statut,
          seasonId: importSeason || (seasons[0]?.id || undefined),
          isDeleted: false,
          successStatus,
          success: successVal
        };

        await fb.add('journal', newEntry);
        existingSignatures.add(`${row.date}__${normDesc}`);
        existingSignatures.add(`${row.date}__${normComm}`);
        importedCount++;
      }

      setImportResult({ imported: importedCount, skipped: skippedCount });
      setParsedRows([]);
      setFileName(null);
    } catch (err: any) {
      console.error('Import failed:', err);
      setParseError(`Erreur lors de l'enregistrement : ${err.message || 'Erreur inconnue'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/80 bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-stone-900 text-base sm:text-lg">
                  Intégration du journal de bord
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                  4 champs : Date • Description • Commentaire • Statut
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Exportez ou importez vos observations en parfaite compatibilité avec votre nouvel outil
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50/50 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === 'export'
                ? 'bg-white border-stone-200 text-indigo-700 shadow-2xs border-b-white -mb-px'
                : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/60'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter vers mon outil ({formattedExportData.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === 'import'
                ? 'bg-white border-stone-200 text-indigo-700 shadow-2xs border-b-white -mb-px'
                : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/60'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer depuis mon outil</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-start gap-3 text-xs text-indigo-950">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-indigo-900">
                    Structure d'export conforme à votre outil :
                  </p>
                  <p className="text-indigo-800 leading-relaxed">
                    Le fichier généré contient exactement les 4 colonnes souhaitées : 
                    <span className="font-bold"> Date</span>, 
                    <span className="font-bold"> Description</span>, 
                    <span className="font-bold"> Commentaire</span>, et 
                    <span className="font-bold"> Statut</span>.
                  </p>
                </div>
              </div>

              {/* Filters for export */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Saison à exporter
                  </label>
                  <select
                    value={exportSeason}
                    onChange={e => setExportSeason(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    <option value="all">Toutes les saisons ({entries.length})</option>
                    {seasons.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Périmètre des données
                  </label>
                  <select
                    value={exportScope}
                    onChange={e => setExportScope(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    <option value="journal_only">Journal & observations seules</option>
                    <option value="all">Tout le registre (avec semis & arbres)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Séparateur CSV
                  </label>
                  <select
                    value={csvDelimiter}
                    onChange={e => setCsvDelimiter(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    <option value=";">Point-virgule ( ; ) – Standard Excel France</option>
                    <option value=",">Virgule ( , ) – Standard US / Web</option>
                  </select>
                </div>
              </div>

              {/* Preview table of exported data */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-stone-700">
                    Aperçu des données prêtes à être exportées ({formattedExportData.length} lignes) :
                  </span>
                </div>
                <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold sticky top-0">
                      <tr>
                        <th className="px-3 py-2 w-28">Date</th>
                        <th className="px-3 py-2 w-48">Description</th>
                        <th className="px-3 py-2">Commentaire</th>
                        <th className="px-3 py-2 w-28">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {formattedExportData.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-stone-50/50">
                          <td className="px-3 py-2 font-mono text-stone-600">{row.date}</td>
                          <td className="px-3 py-2 font-medium text-stone-800 truncate max-w-[180px]">{row.description}</td>
                          <td className="px-3 py-2 text-stone-600 truncate max-w-[240px]">{row.commentaire}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700">
                              {row.statut}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {formattedExportData.length > 5 && (
                    <div className="p-2 bg-stone-50 text-center text-[11px] text-stone-500 border-t border-stone-200">
                      ... et {formattedExportData.length - 5} autres lignes prêtes dans l'export.
                    </div>
                  )}
                  {formattedExportData.length === 0 && (
                    <div className="p-6 text-center text-stone-400 italic text-xs">
                      Aucune observation trouvée pour ces filtres.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={handleCopyClipboard}
                  disabled={formattedExportData.length === 0}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Copier les données tabulées pour coller directement dans Excel ou un tableur"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                  <span>{copied ? 'Copié dans le presse-papier !' : 'Copier pour tableur (Presse-papier)'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadJSON}
                    disabled={formattedExportData.length === 0}
                    className="px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5 text-stone-500" />
                    <span>Télécharger JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    disabled={formattedExportData.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger CSV (Excel FR)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-950">
                      Importez vos données depuis votre nouvel outil
                    </p>
                    <p className="text-emerald-800 leading-relaxed">
                      Le fichier peut être un <span className="font-bold">CSV</span> ou <span className="font-bold">JSON</span>. 
                      Les 4 colonnes (<span className="font-semibold">Date, Description, Commentaire, Statut</span>) 
                      sont reconnues automatiquement (avec ou sans accents, séparateurs ; ou ,).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="shrink-0 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                  title="Télécharger un fichier CSV modèle prêt à remplir"
                >
                  <Download className="w-3 h-3 text-emerald-600" />
                  <span>Modèle CSV exemple</span>
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-2 border-dashed border-stone-200 hover:border-indigo-400 rounded-2xl p-6 text-center bg-stone-50/50 hover:bg-indigo-50/20 transition-all">
                <input
                  type="file"
                  accept=".csv,.txt,.tsv,.json"
                  id="journal-import-input"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <label 
                  htmlFor="journal-import-input"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-700 hover:text-indigo-800 underline">
                      Cliquez pour choisir un fichier
                    </span>
                    <span className="text-xs text-stone-500"> ou glissez-le ici</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Fichiers acceptés : .csv, .json, .txt (détection automatique des 4 colonnes)
                  </p>
                </label>
              </div>

              {/* File feedback */}
              {fileName && (
                <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold text-stone-800">{fileName}</span>
                    {parsedRows.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        {parsedRows.filter(r => r.isValid).length} ligne(s) valide(s)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFileName(null);
                      setParsedRows([]);
                      setParseError(null);
                    }}
                    className="text-stone-400 hover:text-stone-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Error Banner */}
              {parseError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Success Result */}
              {importResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">
                      {importResult.imported} observation(s) importée(s) avec succès dans le journal !
                      {importResult.skipped > 0 && ` (${importResult.skipped} doublon(s) ignoré(s))`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImportResult(null)}
                    className="text-emerald-700 hover:text-emerald-900 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Preview of Parsed Rows */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Saison d'affectation
                      </label>
                      <select
                        value={importSeason}
                        onChange={e => setImportSeason(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-200 bg-white text-stone-800 outline-none"
                      >
                        {seasons.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs text-stone-700 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={e => setSkipDuplicates(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Ignorer les entrées déjà présentes (éviter les doublons)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-stone-700">
                        Aperçu des colonnes détectées :
                      </span>
                    </div>

                    <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs max-h-52 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold sticky top-0">
                          <tr>
                            <th className="px-3 py-2 w-28">Date</th>
                            <th className="px-3 py-2 w-44">Description</th>
                            <th className="px-3 py-2">Commentaire</th>
                            <th className="px-3 py-2 w-28">Statut</th>
                            <th className="px-2 py-2 w-16 text-center">État</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {parsedRows.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className={row.isValid ? 'hover:bg-stone-50/50' : 'bg-red-50/30'}>
                              <td className="px-3 py-2 font-mono text-stone-700">{row.date}</td>
                              <td className="px-3 py-2 font-medium text-stone-900 truncate max-w-[160px]">{row.description}</td>
                              <td className="px-3 py-2 text-stone-600 truncate max-w-[220px]">{row.commentaire}</td>
                              <td className="px-3 py-2">
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700">
                                  {row.statut}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                {row.isValid ? (
                                  <span className="text-emerald-600 font-bold" title="Ligne valide">✓</span>
                                ) : (
                                  <span className="text-red-500 font-bold" title={row.error}>✕</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsedRows.length > 10 && (
                        <div className="p-2 bg-stone-50 text-center text-[11px] text-stone-500 border-t border-stone-200">
                          ... et {parsedRows.length - 10} autres lignes prêtes à être importées.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Execute Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={isImporting || parsedRows.filter(r => r.isValid).length === 0}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isImporting 
                          ? 'Importation en cours...' 
                          : `Importer les ${parsedRows.filter(r => r.isValid).length} observations`
                        }
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200/80 bg-stone-50 flex items-center justify-between text-xs text-stone-500">
          <span>Format : Date (AAAA-MM-JJ), Description, Commentaire, Statut</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg font-medium cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
