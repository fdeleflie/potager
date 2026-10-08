import React, { useState, useMemo } from 'react';
import { 
  Scissors, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  BookOpen, 
  Trees, 
  Sprout, 
  Clock, 
  Save, 
  X, 
  Check, 
  XCircle,
  Filter,
  Search,
  Layers,
  Edit2,
  Trash2,
  CalendarRange,
  List,
  LayoutGrid,
  RefreshCw,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { fb, useFirebaseData } from '../hooks/useFirebaseData';
import { Seedling, Tree, JournalEntry, EncyclopediaEntry, PerpetualTask, ConfigItem } from '../db';
import { 
  matchUserPlantsWithMultiplications, 
  detectMisclassifiedMultiplicationTasks,
  EnrichedMultiplicationItem 
} from '../utils/multiplicationMatcher';
import { 
  MultiplicationRule, 
  MultiplicationMethod, 
  METHOD_ICONS_AND_COLORS 
} from '../data/multiplicationData';
import { v4 as uuidv4 } from 'uuid';
import { JOURNAL_MONTHS } from '../views/Journal';
import { AddMultiplicationModal } from './AddMultiplicationModal';
import { BotanicalLibraryModal } from './BotanicalLibraryModal';
import { MultiplicationMethodDetailModal } from './MultiplicationMethodDetailModal';

interface MultiplicationsPlanningTabProps {
  setCurrentView?: (v: string) => void;
  initialMonth?: number;
}

export function MultiplicationsPlanningTab({ setCurrentView, initialMonth }: MultiplicationsPlanningTabProps) {
  const currentMonthNumber = new Date().getMonth() + 1; // 1-12
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth || currentMonthNumber);
  const [viewMode, setViewMode] = useState<'month' | 'year_matrix'>('year_matrix');
  const [ownershipFilter, setOwnershipFilter] = useState<'owned' | 'all'>('owned');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeMonthColumnFilter, setActiveMonthColumnFilter] = useState<number | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBotanicalLibraryOpen, setIsBotanicalLibraryOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MultiplicationRule | undefined>();
  const [initialPlantName, setInitialPlantName] = useState<string | undefined>();
  const [selectedMethodDetail, setSelectedMethodDetail] = useState<MultiplicationMethod | null>(null);
  const [methodDetailPlantContext, setMethodDetailPlantContext] = useState<{
    plantName: string;
    instructions?: {
      harvest: string;
      substrate: string;
      care: string;
      followUp: string;
    };
    category?: string;
  } | null>(null);

  // Quick Action / Log Note State
  const [activeLoggingItem, setActiveLoggingItem] = useState<EnrichedMultiplicationItem | null>(null);
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logTitle, setLogTitle] = useState<string>('');
  const [logContent, setLogContent] = useState<string>('');
  const [logCount, setLogCount] = useState<string>('3');
  const [createFollowUpTask, setCreateFollowUpTask] = useState<boolean>(true);
  const [isSubmittingLog, setIsSubmittingLog] = useState<boolean>(false);
  const [logFeedback, setLogFeedback] = useState<string | null>(null);
  const [reclassifySuccess, setReclassifySuccess] = useState<string | null>(null);
  const [isReclassifying, setIsReclassifying] = useState<boolean>(false);

  // Data fetching from Firebase
  const { data: rawSeedlings } = useFirebaseData<Seedling>('seedlings');
  const { data: rawTrees } = useFirebaseData<Tree>('trees');
  const { data: rawEncyclopedia } = useFirebaseData<EncyclopediaEntry>('encyclopedia');
  const { data: rawJournal } = useFirebaseData<JournalEntry>('journal');
  const { data: rawPerpetualTasks } = useFirebaseData<PerpetualTask>('perpetualTasks');
  const { data: rawConfig } = useFirebaseData<ConfigItem>('config');

  // Custom multiplication rules saved by the user
  const customRules: MultiplicationRule[] = useMemo(() => {
    return (rawConfig || [])
      .filter(c => c.type === 'custom_multiplication' && c.attributes)
      .map(c => ({
        ...c.attributes,
        customConfigId: c.id
      }));
  }, [rawConfig]);

  // Misclassified tasks in perpetual tasks (bouturage / marcottage but not in category multiplication)
  const misclassifiedTasks = useMemo(() => {
    return detectMisclassifiedMultiplicationTasks(rawPerpetualTasks || []);
  }, [rawPerpetualTasks]);

  // Match plants user owns (seedlings, trees, encyclopedia, config, perpetual tasks) with multiplication rules
  const enrichedItems = useMemo(() => {
    return matchUserPlantsWithMultiplications(
      rawSeedlings || [],
      rawTrees || [],
      rawEncyclopedia || [],
      rawJournal || [],
      selectedMonth,
      customRules,
      rawPerpetualTasks || [],
      rawConfig || []
    );
  }, [rawSeedlings, rawTrees, rawEncyclopedia, rawJournal, selectedMonth, customRules, rawPerpetualTasks, rawConfig]);

  // Total count of owned plants in garden
  const allOwnedPlantsCount = useMemo(() => {
    return enrichedItems.filter(item => item.isOwned).length;
  }, [enrichedItems]);

  // Group user's owned plants by multiplication method for quick reference & method guides
  const ownedPlantsByMethod = useMemo(() => {
    const map: Record<string, Array<{ name: string; type: string; variety?: string }>> = {};
    enrichedItems.filter(item => item.isOwned).forEach(item => {
      const m = item.rule.method;
      if (!map[m]) map[m] = [];
      map[m].push({
        name: item.rule.commonName,
        type: item.rule.category,
        variety: item.sourceSummary.allVarietiesText
      });
    });
    return map;
  }, [enrichedItems]);

  // Calculate monthly stats across all 12 months for owned plants
  const monthStats = useMemo(() => {
    const stats: Record<number, { total: number; optimal: number; possible: number }> = {};
    for (let m = 1; m <= 12; m++) {
      stats[m] = { total: 0, optimal: 0, possible: 0 };
    }

    // Run matching for all 12 months on owned items
    for (let m = 1; m <= 12; m++) {
      const itemsForMonth = matchUserPlantsWithMultiplications(
        rawSeedlings || [],
        rawTrees || [],
        rawEncyclopedia || [],
        [],
        m,
        customRules,
        rawPerpetualTasks || [],
        rawConfig || []
      ).filter(item => item.isOwned);

      itemsForMonth.forEach(item => {
        if (item.periodStatus === 'optimal') {
          stats[m].optimal += 1;
          stats[m].total += 1;
        } else if (item.periodStatus === 'possible') {
          stats[m].possible += 1;
          stats[m].total += 1;
        }
      });
    }

    return stats;
  }, [rawSeedlings, rawTrees, rawEncyclopedia, customRules, rawPerpetualTasks, rawConfig]);

  // Base list depending on ownership filter
  const baseItems = useMemo(() => {
    if (ownershipFilter === 'owned') {
      return enrichedItems.filter(item => item.isOwned);
    }
    return enrichedItems;
  }, [enrichedItems, ownershipFilter]);

  // Statistics for currently selected month
  const currentMonthOwnedItems = useMemo(() => {
    return enrichedItems.filter(item => item.isOwned);
  }, [enrichedItems]);

  const ownedOptimalCount = useMemo(() => {
    return currentMonthOwnedItems.filter(item => item.periodStatus === 'optimal').length;
  }, [currentMonthOwnedItems]);

  const ownedPossibleCount = useMemo(() => {
    return currentMonthOwnedItems.filter(item => item.periodStatus === 'possible').length;
  }, [currentMonthOwnedItems]);

  // Filtered Items (by technique, difficulty and search)
  const filteredItems = useMemo(() => {
    return baseItems.filter(item => {
      if (methodFilter !== 'all' && item.rule.method !== methodFilter) {
        return false;
      }

      if (difficultyFilter !== 'all' && item.rule.difficulty !== difficultyFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.rule.commonName.toLowerCase().includes(q);
        const matchesMethod = item.rule.methodLabel.toLowerCase().includes(q);
        const matchesKeywords = item.rule.speciesKeywords.some(k => k.toLowerCase().includes(q));
        const matchesOwned = item.ownedPlants.some(p => p.name.toLowerCase().includes(q));
        if (!matchesName && !matchesMethod && !matchesKeywords && !matchesOwned) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const order = { optimal: 0, possible: 1, out_of_season: 2 };
      const statusDiff = order[a.periodStatus] - order[b.periodStatus];
      if (statusDiff !== 0) return statusDiff;

      return a.rule.commonName.localeCompare(b.rule.commonName);
    });
  }, [baseItems, methodFilter, difficultyFilter, searchQuery]);

  // All plants owned by user across the whole year (for the 12-month matrix view)
  const allOwnedItemsYear = useMemo(() => {
    const list = ownershipFilter === 'owned'
      ? enrichedItems.filter(item => item.isOwned)
      : enrichedItems;

    return list
      .filter(item => {
        if (activeMonthColumnFilter !== null) {
          const isOptimal = item.rule.optimalMonths.includes(activeMonthColumnFilter);
          const isPossible = item.rule.possibleMonths.includes(activeMonthColumnFilter);
          if (!isOptimal && !isPossible) {
            return false;
          }
        }
        if (methodFilter !== 'all' && item.rule.method !== methodFilter) {
          return false;
        }
        if (difficultyFilter !== 'all' && item.rule.difficulty !== difficultyFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = item.rule.commonName.toLowerCase().includes(q);
          const matchesMethod = item.rule.methodLabel.toLowerCase().includes(q);
          const matchesKeywords = item.rule.speciesKeywords.some(k => k.toLowerCase().includes(q));
          const matchesVarieties = item.sourceSummary.allVarietiesText?.toLowerCase().includes(q);
          if (!matchesName && !matchesMethod && !matchesKeywords && !matchesVarieties) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.rule.commonName.localeCompare(b.rule.commonName));
  }, [enrichedItems, ownershipFilter, methodFilter, difficultyFilter, searchQuery, activeMonthColumnFilter]);

  // Detect plants in Catalogue or Trees that don't yet have a multiplication rule
  const plantsWithoutRules = useMemo(() => {
    const matchedNames = new Set(
      currentMonthOwnedItems.flatMap(item => item.ownedPlants.map(p => p.name.toLowerCase().trim()))
    );

    const candidates = new Map<string, string>();
    (rawEncyclopedia || []).forEach(e => {
      if (!e.name || typeof e.name !== 'string' || !e.name.trim()) return;
      const trimmed = e.name.trim();
      const cleanName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      const norm = cleanName.toLowerCase();
      const hasMatch = Array.from(matchedNames).some(m => m.includes(norm) || norm.includes(m));
      if (!hasMatch && !candidates.has(norm)) {
        candidates.set(norm, cleanName);
      }
    });

    return Array.from(candidates.values()).slice(0, 5);
  }, [currentMonthOwnedItems, rawEncyclopedia]);

  const currentMonthLabel = JOURNAL_MONTHS.find(m => m.value === selectedMonth.toString())?.label || 'ce mois-ci';

  // 1-Click reclassify tasks into multiplication category
  const handleReclassifyAll = async () => {
    if (misclassifiedTasks.length === 0 || isReclassifying) return;
    setIsReclassifying(true);
    setReclassifySuccess(null);

    try {
      let count = 0;
      for (const task of misclassifiedTasks) {
        await fb.update('perpetualTasks', task.id, {
          category: 'multiplication'
        });
        count++;
      }
      setReclassifySuccess(`✓ ${count} geste(s) de bouturage et marcottage ont été classés avec succès dans la rubrique « Multiplication » !`);
      setTimeout(() => setReclassifySuccess(null), 5000);
    } catch (err) {
      console.error('Failed to reclassify tasks:', err);
      alert('Erreur lors du reclassement des gestes.');
    } finally {
      setIsReclassifying(false);
    }
  };

  const handleStartLog = (item: EnrichedMultiplicationItem) => {
    setActiveLoggingItem(item);
    setLogDate(new Date().toISOString().split('T')[0]);
    const ownedName = item.ownedPlants.length > 0 ? ` (${item.ownedPlants[0].name})` : '';
    setLogTitle(`Multiplication : ${item.rule.methodLabel} de ${item.rule.commonName}${ownedName}`);
    setLogContent(
      `Réalisation de ${logCount} ${item.rule.methodLabel.toLowerCase()} de ${item.rule.commonName}.\n` +
      `Substrat : ${item.rule.instructions.substrate}\n` +
      `Conseil appliqué : ${item.rule.instructions.care}`
    );
    setLogFeedback(null);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoggingItem || isSubmittingLog) return;

    setIsSubmittingLog(true);
    setLogFeedback(null);

    try {
      const entryId = uuidv4();
      const tags = ['✂️ Multiplications & Boutures'];
      if (activeLoggingItem.rule.category === 'fruitier') tags.push('🌳 Verger');
      if (activeLoggingItem.rule.category === 'aromatique') tags.push('🌿 Aromatiques');

      // 1. Add Journal Entry
      await fb.add('journal', {
        id: entryId,
        date: logDate,
        title: logTitle.trim(),
        content: logContent.trim(),
        tags,
        isDeleted: false,
        successStatus: 'none'
      });

      // 2. Add Follow-up Task in Calendar / Tasks
      if (createFollowUpTask) {
        const weeks = activeLoggingItem.rule.rootingTimeWeeks || 4;
        const dueDate = new Date(logDate);
        dueDate.setDate(dueDate.getDate() + weeks * 7);

        await fb.add('tasks', {
          id: uuidv4(),
          title: `Vérifier enracinement : ${activeLoggingItem.rule.commonName} (${activeLoggingItem.rule.methodLabel})`,
          description: `Vérifier la reprise et l'apparition de nouvelles pousses ou racines pour les ${logCount} multiplications réalisées le ${logDate}. ${activeLoggingItem.rule.instructions.followUp}`,
          dateCreated: new Date().toISOString(),
          dateDue: dueDate.toISOString().split('T')[0],
          isCompleted: false,
          priority: 'medium',
          type: 'automatic',
          isDeleted: false
        });
      }

      setLogFeedback('✓ Observation et tâche de suivi d\'enracinement programmées avec succès !');
      setTimeout(() => {
        setActiveLoggingItem(null);
        setLogFeedback(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to log multiplication note:', err);
      setLogFeedback('Erreur lors de l\'enregistrement.');
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const handleDeleteCustomRule = async (customConfigId?: string, plantName?: string) => {
    if (!customConfigId) return;
    if (!window.confirm(`Voulez-vous supprimer la méthode de multiplication personnalisée pour « ${plantName || 'cette plante'} » ?`)) {
      return;
    }

    try {
      await fb.delete('config', customConfigId);
    } catch (err) {
      console.error('Failed to delete custom rule:', err);
      alert('Erreur lors de la suppression.');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Introduction & Automatic Sync Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white p-4.5 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl text-teal-200 shrink-0 mt-0.5 backdrop-blur-xs">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-serif font-bold text-white">
                  Multiplications & Bouturage du Jardin
                </h2>
                <span className="text-[11px] bg-teal-500/30 text-teal-100 border border-teal-400/30 px-2.5 py-0.5 rounded-full font-sans font-medium">
                  {allOwnedPlantsCount} espèces de votre catalogue & verger
                </span>
              </div>
              <p className="text-xs text-teal-100/90 mt-1 max-w-2xl leading-relaxed">
                Le modèle botanique est <strong>automatiquement alimenté par la liste de vos plantes</strong> (arbres du verger, semis du potager, fiches catalogue et gestes perpétuels). Vous savez ainsi exactement <strong>chaque mois</strong> quelles plantes multiplier et par quelle méthode.
              </p>
            </div>
          </div>

          {/* Action buttons inside header banner */}
          <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
            <button
              type="button"
              onClick={() => {
                setEditingRule(undefined);
                setInitialPlantName(undefined);
                setIsAddModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-teal-950 font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Ajouter une fiche de multiplication personnalisée"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nouvelle plante</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMethodDetailPlantContext(null);
                setSelectedMethodDetail(methodFilter !== 'all' ? (methodFilter as MultiplicationMethod) : 'bouture_bois_sec');
              }}
              className="px-3.5 py-2 bg-teal-600/80 hover:bg-teal-500 text-white border border-teal-400/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Consulter les fiches techniques complètes de toutes les méthodes de multiplication"
            >
              <BookOpen className="w-4 h-4 text-teal-200" />
              <span>Fiches des méthodes</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBotanicalLibraryOpen(true)}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-xs"
              title="Consulter et piocher dans la bibliothèque de modèles de référence"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-200" />
              <span>Modèles de référence</span>
            </button>
          </div>
        </div>
      </div>

      {/* Misclassified Perpetual Tasks Banner (User Question 2 resolution) */}
      {misclassifiedTasks.length > 0 && (
        <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-3.5 shadow-2xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
                <Scissors className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <span>Gestes de bouturage ou marcottage détectés dans d'autres rubriques ({misclassifiedTasks.length})</span>
                </h3>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Des gestes perpétuels tels que {misclassifiedTasks.slice(0, 3).map(t => `« ${t.title} »`).join(', ')} {misclassifiedTasks.length > 3 ? '...' : ''} sont actuellement sous d'autres rubriques. Reclassez-les sous <strong>« Multiplication »</strong> pour qu'ils soient tous centralisés ici.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReclassifyAll}
              disabled={isReclassifying}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isReclassifying ? 'Reclassement...' : 'Reclasser sous « Multiplication » en 1 clic'}</span>
            </button>
          </div>
        </div>
      )}

      {reclassifySuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reclassifySuccess}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setReclassifySuccess(null)}
            className="text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Month Selector Bar & View Switcher */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/70 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-700" />
            <h3 className="text-sm font-bold text-stone-800">
              Calendrier mensuel de multiplication (12 mois)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'month'
                    ? 'bg-white text-teal-900 font-bold shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Afficher les fiches détaillées pour le mois sélectionné"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Vue par mois</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('year_matrix')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'year_matrix'
                    ? 'bg-white text-teal-900 font-bold shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Tableau récapitulatif annuel de toutes vos plantes sur les 12 mois"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Vue annuelle (12 mois)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 12 Months Pills with plant count indicators */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
          {JOURNAL_MONTHS.map(m => {
            const monthNum = parseInt(m.value, 10);
            const isSelected = selectedMonth === monthNum && viewMode === 'month';
            const isCurrent = currentMonthNumber === monthNum;
            const stats = monthStats[monthNum] || { total: 0, optimal: 0, possible: 0 };

            return (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setSelectedMonth(monthNum);
                  setViewMode('month');
                }}
                className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all relative cursor-pointer text-center flex flex-col items-center justify-center gap-0.5 ${
                  isSelected
                    ? 'bg-teal-700 text-white shadow-xs font-bold ring-2 ring-teal-500/30'
                    : isCurrent
                      ? 'bg-teal-50 text-teal-800 border border-teal-300 hover:bg-teal-100 font-bold'
                      : 'bg-stone-50 text-stone-600 border border-stone-200/80 hover:bg-stone-100'
                }`}
              >
                <span className="truncate block font-serif">{m.label.slice(0, 4)}</span>
                
                {/* Count badge for user's owned plants */}
                <div className="flex items-center gap-1">
                  {stats.total > 0 ? (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-sans ${
                      isSelected
                        ? 'bg-teal-800 text-teal-100'
                        : stats.optimal > 0
                          ? 'bg-emerald-100 text-emerald-800 font-bold'
                          : 'bg-stone-200 text-stone-700'
                    }`}>
                      {stats.total}
                    </span>
                  ) : (
                    <span className="text-[10px] text-stone-300">—</span>
                  )}

                  {/* Indicator dot if optimal period exists */}
                  {stats.optimal > 0 && (
                    <span 
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-teal-300' : 'bg-emerald-500'}`}
                      title={`${stats.optimal} plante(s) en période optimale`}
                    />
                  )}
                </div>

                {isCurrent && !isSelected && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-teal-600" title="Mois en cours" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action & Filter Toolbar */}
      <div className="bg-white p-3 sm:px-4 rounded-2xl shadow-sm border border-stone-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Ownership toggle: Mes plantes vs Référentiel complet */}
          <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-xs">
            <button
              type="button"
              onClick={() => setOwnershipFilter('owned')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-medium ${
                ownershipFilter === 'owned'
                  ? 'bg-teal-700 text-white font-bold shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Afficher uniquement les plantes que vous possédez dans votre catalogue ou verger"
            >
              <span>🌿 Mon catalogue ({allOwnedPlantsCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setOwnershipFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-medium ${
                ownershipFilter === 'all'
                  ? 'bg-teal-700 text-white font-bold shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Explorer toutes les fiches botaniques du référentiel (y compris celles non possédées)"
            >
              <span>📚 Référentiel complet ({enrichedItems.length})</span>
            </button>
          </div>

          {/* Technique filter */}
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium outline-none cursor-pointer hover:bg-stone-100"
          >
            <option value="all">Toutes les techniques</option>
            <option value="bouture_bois_sec">🪵 Bouture bois sec (hiver)</option>
            <option value="bouture_herpacee">🌱 Bouture herbacée (printemps)</option>
            <option value="bouture_semi_aoutee">🌿 Bouture semi-aoûtée (été)</option>
            <option value="marcottage_aerien">🎋 Marcottage aérien</option>
            <option value="marcottage_couche">➰ Marcottage couché</option>
            <option value="division_touffe">🪴 Division de touffe</option>
            <option value="stolons_drageons">🍓 Stolons & drageons</option>
            <option value="greffage">🔪 Greffage</option>
            <option value="bouture_racine">🥔 Bouture de racine</option>
            <option value="repiquage_gourmands">🍅 Bouture de gourmand</option>
          </select>

          {/* Difficulty filter */}
          <select
            value={difficultyFilter}
            onChange={e => setDifficultyFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium outline-none cursor-pointer hover:bg-stone-100"
          >
            <option value="all">Toutes difficultés</option>
            <option value="facile">🟢 Facile</option>
            <option value="moyen">🟡 Moyen</option>
            <option value="delicat">🔴 Délicat</option>
          </select>
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher (figuier, romarin, marcotte...)"
            className="w-full px-3 py-1.5 pl-8 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-xs"
          />
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Month Highlight Banner (Only in month view) */}
      {viewMode === 'month' && (
        <div className="bg-teal-50/90 border border-teal-200 px-4 py-3 rounded-2xl flex items-center justify-between text-xs text-teal-950 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
            <span>
              En <strong>{currentMonthLabel}</strong> dans votre jardin : 
              {ownedOptimalCount > 0 ? (
                <span className="font-semibold text-teal-900 ml-1">
                  <strong>{ownedOptimalCount} plante{ownedOptimalCount > 1 ? 's' : ''}</strong> {ownedOptimalCount > 1 ? 'sont' : 'est'} au <strong>moment optimal</strong> de multiplication !
                </span>
              ) : (
                <span className="text-stone-600 ml-1">Aucune plante au pic optimal ce mois-ci</span>
              )}
              {ownedPossibleCount > 0 && (
                <span className="text-stone-700 ml-1">
                  ({ownedPossibleCount} possible{ownedPossibleCount > 1 ? 's' : ''})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-500 font-medium">
            <span>Affichage : {filteredItems.length} résultat{filteredItems.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Suggestion for catalog plants without multiplication rules */}
      {plantsWithoutRules.length > 0 && viewMode === 'month' && (
        <div className="bg-stone-50 border border-stone-200 px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs text-stone-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-stone-400">💡</span>
            <span>
              Plantes de votre jardin sans méthode répertoriée : 
              <strong className="text-stone-900 ml-1">
                {plantsWithoutRules.join(', ')}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingRule(undefined);
              setInitialPlantName(plantsWithoutRules[0]);
              setIsAddModalOpen(true);
            }}
            className="text-teal-800 hover:text-teal-950 font-bold shrink-0 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Définir une méthode</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* VIEW RENDER: 1. MONTH CARDS VIEW or 2. YEAR 12-MONTH MATRIX VIEW */}
      {viewMode === 'year_matrix' ? (
        /* YEAR 12-MONTH MATRIX VIEW */
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-stone-200 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-teal-700" />
                <span>Matrice annuelle de multiplication de vos plantes</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Vue globale des 12 mois pour chaque plante présente dans votre jardin. Vert = optimal ⭐, Jaune = possible.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
                <span className="text-stone-700 font-medium">Idéal (optimal)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block"></span>
                <span className="text-stone-700 font-medium">Possible</span>
              </span>
            </div>
          </div>

          {/* Optional banner when filtered by a specific month column */}
          {activeMonthColumnFilter !== null && (
            <div className="px-4 py-2 bg-teal-50 border-b border-teal-100 flex items-center justify-between text-xs text-teal-900">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-teal-700" />
                <span>
                  Filtré pour le mois de <strong>{JOURNAL_MONTHS.find(m => Number(m.value) === activeMonthColumnFilter)?.label}</strong> : {allOwnedItemsYear.length} plante(s) réalisable(s).
                </span>
              </span>
              <button
                type="button"
                onClick={() => setActiveMonthColumnFilter(null)}
                className="text-teal-700 hover:text-teal-950 font-semibold underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Afficher toute l'année</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="overflow-x-auto overflow-y-auto max-h-[70vh] border-b border-stone-100">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-stone-100 shadow-xs border-b border-stone-200">
                <tr className="bg-stone-100 text-stone-700 font-semibold align-bottom">
                  <th className="sticky top-0 bg-stone-100 z-20 py-2.5 px-3 min-w-[200px]">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-semibold text-stone-800">Plante & Espèce</span>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="text-[10px] text-teal-700 hover:text-teal-900 underline font-normal"
                        >
                          Effacer
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="w-3 h-3 text-stone-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Filtrer plante..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-[11px] bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-600 font-normal placeholder:text-stone-400 text-stone-800"
                      />
                    </div>
                  </th>
                  <th className="sticky top-0 bg-stone-100 z-20 py-2.5 px-3 min-w-[165px]">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-semibold text-stone-800">Méthode</span>
                      <button
                        type="button"
                        onClick={() => {
                          setMethodDetailPlantContext(null);
                          setSelectedMethodDetail(methodFilter !== 'all' ? (methodFilter as MultiplicationMethod) : 'bouture_bois_sec');
                        }}
                        className="text-[10px] text-teal-700 hover:text-teal-900 underline font-normal cursor-pointer flex items-center gap-0.5"
                        title="Consulter les fiches techniques des méthodes de multiplication"
                      >
                        <span>Fiches</span>
                        <HelpCircle className="w-3 h-3 inline" />
                      </button>
                    </div>
                    <select
                      value={methodFilter}
                      onChange={(e) => setMethodFilter(e.target.value)}
                      className="w-full py-1 px-1.5 text-[11px] bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-600 font-normal cursor-pointer text-stone-800"
                    >
                      <option value="all">Toutes méthodes</option>
                      <option value="bouture_bois_sec">🪵 Bouture bois sec</option>
                      <option value="bouture_herpacee">🌱 Bouture herbacée</option>
                      <option value="bouture_semi_aoutee">🌿 Bouture semi-aoûtée</option>
                      <option value="marcottage_couche">➰ Marcottage couché</option>
                      <option value="marcottage_aerien">🎋 Marcottage aérien</option>
                      <option value="division_touffe">🪴 Division touffe</option>
                      <option value="stolons_drageons">🍓 Stolons & drageons</option>
                      <option value="greffage">🔪 Greffage</option>
                      <option value="bouture_racine">🥔 Bouture de racine</option>
                      <option value="repiquage_gourmands">🍅 Bouture gourmands</option>
                    </select>
                  </th>
                  <th className="sticky top-0 bg-stone-100 z-20 py-2.5 px-1 text-center w-20">
                    <div className="font-semibold text-stone-800 mb-1.5">Diff.</div>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="w-full py-1 px-0.5 text-[11px] bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-600 font-normal cursor-pointer text-stone-800 text-center"
                    >
                      <option value="all">Toutes</option>
                      <option value="facile">Facile</option>
                      <option value="moyen">Moyen</option>
                      <option value="difficile">Difficile</option>
                    </select>
                  </th>
                  {JOURNAL_MONTHS.map(m => {
                    const mNum = Number(m.value);
                    const isCurrent = mNum === currentMonthNumber;
                    const isFiltered = activeMonthColumnFilter === mNum;
                    return (
                      <th 
                        key={m.value} 
                        onClick={() => setActiveMonthColumnFilter(prev => prev === mNum ? null : mNum)}
                        title={`Cliquez pour filtrer uniquement les plantes à multiplier en ${m.label} (clic à nouveau pour réinitialiser)`}
                        className={`sticky top-0 z-20 py-2 px-1 text-center w-8 cursor-pointer select-none transition-all group ${
                          isFiltered 
                            ? 'bg-teal-700 text-white font-bold ring-2 ring-teal-500' 
                            : isCurrent 
                              ? 'bg-teal-100 text-teal-950 font-bold hover:bg-teal-200' 
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[11px] font-bold">{m.label.slice(0, 1)}</span>
                          <span className={`text-[9px] ${isFiltered ? 'text-teal-200' : 'text-stone-400 group-hover:text-stone-600'}`}>
                            {m.value}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="sticky top-0 bg-stone-100 z-20 py-2.5 px-3 text-right w-24">
                    <div className="font-semibold text-stone-800 mb-1.5">Actions</div>
                    {(searchQuery || methodFilter !== 'all' || difficultyFilter !== 'all' || activeMonthColumnFilter !== null) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setMethodFilter('all');
                          setDifficultyFilter('all');
                          setActiveMonthColumnFilter(null);
                        }}
                        className="text-[10px] text-teal-700 hover:text-teal-900 font-medium underline cursor-pointer"
                        title="Réinitialiser tous les filtres de colonnes"
                      >
                        Réinitialiser
                      </button>
                    ) : (
                      <span className="text-[10px] text-stone-400 font-normal">Détails</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {allOwnedItemsYear.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="py-8 text-center text-stone-500 italic">
                      Aucune plante trouvée dans votre jardin pour cette vue.
                    </td>
                  </tr>
                ) : (
                  allOwnedItemsYear.map(item => {
                    const methodConfig = METHOD_ICONS_AND_COLORS[item.rule.method];
                    return (
                      <tr key={item.rule.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-stone-900">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-serif font-bold text-stone-900 text-xs sm:text-sm">
                                {item.rule.commonName}
                              </span>
                              {item.sourceSummary.badges.map(b => (
                                <span 
                                  key={b.type}
                                  title={b.tooltip}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-1 ${b.className}`}
                                >
                                  <span>{b.icon}</span>
                                  <span>{b.label}</span>
                                </span>
                              ))}
                            </div>
                            {item.sourceSummary.allVarietiesText && (
                              <span 
                                className="text-[10px] text-stone-500 font-normal truncate max-w-[220px]" 
                                title={item.sourceSummary.allVarietiesText}
                              >
                                Variétés : {item.sourceSummary.allVarietiesText}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => {
                              setMethodDetailPlantContext({
                                plantName: item.rule.commonName,
                                instructions: item.rule.instructions,
                                category: item.rule.category
                              });
                              setSelectedMethodDetail(item.rule.method);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${methodConfig.bg} ${methodConfig.text} ${methodConfig.border} hover:shadow-xs hover:ring-2 hover:ring-teal-400/50 transition-all cursor-pointer group text-left`}
                            title={`Cliquer pour voir la fiche détaillée de la méthode : ${item.rule.methodLabel}`}
                          >
                            <span>{methodConfig.icon}</span>
                            <span>{item.rule.methodLabel}</span>
                            <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>
                        <td className="py-2.5 px-2 text-center text-[10px] text-stone-600 font-medium">
                          {item.rule.difficultyLabel}
                        </td>
                        {JOURNAL_MONTHS.map(m => {
                          const mNum = Number(m.value);
                          const isOpt = item.rule.optimalMonths.includes(mNum);
                          const isPos = item.rule.possibleMonths.includes(mNum);
                          const isCurrentM = mNum === currentMonthNumber;
                          const isColFiltered = activeMonthColumnFilter === mNum;

                          return (
                            <td 
                              key={m.value}
                              onClick={() => {
                                setSelectedMonth(mNum);
                                setViewMode('month');
                              }}
                              className={`p-1 text-center cursor-pointer transition-colors ${
                                isColFiltered 
                                  ? 'bg-teal-50/80 ring-1 ring-teal-200 inset' 
                                  : isCurrentM 
                                    ? 'bg-teal-50/40' 
                                    : ''
                              }`}
                              title={`${item.rule.commonName} en ${m.label} : ${isOpt ? 'Période optimale' : isPos ? 'Période possible' : 'Hors saison'} (cliquez pour ouvrir la fiche du mois)`}
                            >
                              {isOpt ? (
                                <div className="w-6 h-6 mx-auto rounded-md bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shadow-2xs hover:scale-110 transition-transform">
                                  ⭐
                                </div>
                              ) : isPos ? (
                                <div className="w-6 h-6 mx-auto rounded-md bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-[10px] hover:scale-110 transition-transform">
                                  ✓
                                </div>
                              ) : (
                                <div className="w-6 h-6 mx-auto rounded-md bg-stone-100 text-stone-300 flex items-center justify-center text-[10px]">
                                  ·
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleStartLog(item)}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Noter</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MONTH DETAILED CARDS VIEW */
        <div className="space-y-3.5">
          {filteredItems.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-stone-200 border-dashed text-center space-y-3">
              <Scissors className="w-8 h-8 text-stone-300 mx-auto" />
              <h3 className="text-sm font-bold text-stone-800">
                Aucune plante à multiplier pour {currentMonthLabel} avec ces filtres
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                {ownershipFilter === 'owned'
                  ? `Aucune des plantes répertoriées dans votre potager, verger, catalogue ou gestes perpétuels ne nécessite d'action de multiplication en ${currentMonthLabel}.`
                  : 'Aucune plante trouvée dans le référentiel pour ce mois et ce filtre.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setOwnershipFilter('all')}
                  className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                  <span>Voir toutes les plantes de référence pour {currentMonthLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRule(undefined);
                    setIsAddModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une plante à multiplier</span>
                </button>
              </div>
            </div>
          ) : (
            filteredItems.map(item => {
              const methodConfig = METHOD_ICONS_AND_COLORS[item.rule.method];
              const isExpanded = expandedCardId === item.rule.id;
              const hasPastHistory = item.journalHistory.length > 0;
              const isCustom = item.rule.isCustom;

              return (
                <div
                  key={item.rule.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
                    item.periodStatus === 'optimal'
                      ? 'border-emerald-300 ring-1 ring-emerald-500/20'
                      : item.periodStatus === 'possible'
                        ? 'border-amber-200'
                        : 'border-stone-200/80 opacity-90'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-[240px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl leading-none">{methodConfig.icon}</span>
                        <h3 className="font-serif font-bold text-stone-900 text-base">
                          {item.rule.commonName}
                        </h3>

                        {/* Custom User Rule Badge */}
                        {isCustom && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Personnalisée
                          </span>
                        )}

                        {/* Period Badge */}
                        {item.periodStatus === 'optimal' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            Moment Idéal ⭐ ({currentMonthLabel})
                          </span>
                        )}
                        {item.periodStatus === 'possible' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            Période possible ({currentMonthLabel})
                          </span>
                        )}
                        {item.periodStatus === 'out_of_season' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-500">
                            Hors saison (optimal : {item.rule.optimalMonths.map(m => JOURNAL_MONTHS.find(jm => jm.value === m.toString())?.label.slice(0, 3)).join(', ')})
                          </span>
                        )}
                      </div>

                      {/* Method & Category Badges */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setMethodDetailPlantContext({
                              plantName: item.rule.commonName,
                              instructions: item.rule.instructions,
                              category: item.rule.category
                            });
                            setSelectedMethodDetail(item.rule.method);
                          }}
                          className={`px-2.5 py-0.5 rounded-lg border font-bold ${methodConfig.bg} ${methodConfig.text} ${methodConfig.border} hover:shadow-xs hover:ring-2 hover:ring-teal-400/50 transition-all cursor-pointer flex items-center gap-1 group`}
                          title={`Cliquer pour voir la fiche détaillée de la méthode : ${item.rule.methodLabel}`}
                        >
                          <span>{item.rule.methodLabel}</span>
                          <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </button>

                        <span className="text-stone-400">•</span>
                        <span className="text-stone-500 text-[11px]">
                          Difficulté : <strong className="text-stone-700">{item.rule.difficultyLabel}</strong>
                        </span>

                        <span className="text-stone-400">•</span>
                        <span className="text-stone-500 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>Racines en ~{item.rule.rootingTimeWeeks} sem.</span>
                        </span>
                      </div>

                      {/* Matching Plants In User Garden */}
                      {item.isOwned && (
                        <div className="pt-1 flex items-center gap-1.5 text-xs text-teal-900 bg-teal-50/80 px-2.5 py-1.5 rounded-xl border border-teal-200/80 flex-wrap">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="font-semibold">Dans votre jardin :</span>
                          {item.sourceSummary.badges.map(b => (
                            <span 
                              key={b.type}
                              title={b.tooltip}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 border shadow-2xs ${b.className}`}
                            >
                              <span>{b.icon}</span>
                              <span>{b.label}</span>
                            </span>
                          ))}
                          {item.sourceSummary.allVarietiesText && (
                            <span className="text-[11px] text-teal-700 italic ml-1">
                              ({item.sourceSummary.allVarietiesText})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartLog(item)}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer hover:shadow-teal-600/20"
                        title="Enregistrer cette multiplication dans votre Journal avec date, substrat et rappel d'enracinement"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Noter l'action</span>
                      </button>

                      {isCustom && item.rule.customConfigId && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomRule(item.rule.customConfigId, item.rule.commonName)}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title="Supprimer cette multiplication personnalisée"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedCardId(isExpanded ? null : item.rule.id)}
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer text-xs flex items-center gap-1 font-medium"
                        title={isExpanded ? 'Réduire' : 'Voir les conseils techniques pas-à-pas et vos notes'}
                      >
                        <span className="text-[11px] hidden sm:inline">{isExpanded ? 'Fermer' : 'Fiche technique'}</span>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Quick Summary Line */}
                  <div className="px-4 pb-3 text-xs text-stone-600 border-b border-stone-100">
                    <p>{item.rule.summary}</p>
                  </div>

                  {/* History Preview Bar (Always visible if history exists) */}
                  {hasPastHistory && (
                    <div className="bg-amber-50/50 border-t border-amber-100/80 px-4 py-2 flex items-center justify-between text-xs text-amber-950">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-semibold">
                          Votre expérience : {item.journalHistory.length} essai{item.journalHistory.length > 1 ? 's' : ''} noté{item.journalHistory.length > 1 ? 's' : ''} dans le Journal
                        </span>
                        {item.successCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {item.successCount} réussite{item.successCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {item.failureCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            {item.failureCount} échec{item.failureCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {item.lastActionDate && (
                        <span className="text-[11px] text-stone-500">
                          Dernier essai : {item.lastActionDate}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded Step-by-Step Instructions & Past Notes */}
                  {isExpanded && (
                    <div className="p-4 bg-stone-50/80 border-t border-stone-200 space-y-4 animate-fade-in text-xs">
                      {/* Method Guide Callout Banner */}
                      <div className="flex items-center justify-between p-3 bg-teal-50/90 rounded-xl border border-teal-200/80 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{methodConfig.icon}</span>
                          <span className="text-xs text-teal-950">
                            Technique de référence : <strong>{item.rule.methodLabel}</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMethodDetailPlantContext({
                              plantName: item.rule.commonName,
                              instructions: item.rule.instructions,
                              category: item.rule.category
                            });
                            setSelectedMethodDetail(item.rule.method);
                          }}
                          className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Fiche complète de la méthode</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Technical Steps Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px]">1</span>
                            <span>Prélèvement & Rameau</span>
                          </div>
                          <p className="text-stone-600 leading-relaxed pl-6.5">
                            {item.rule.instructions.harvest}
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px]">2</span>
                            <span>Substrat & Récipient</span>
                          </div>
                          <p className="text-stone-600 leading-relaxed pl-6.5">
                            {item.rule.instructions.substrate}
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px]">3</span>
                            <span>Soins & Humidité</span>
                          </div>
                          <p className="text-stone-600 leading-relaxed pl-6.5">
                            {item.rule.instructions.care}
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-1">
                          <div className="font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px]">4</span>
                            <span>Suivi & Repiquage</span>
                          </div>
                          <p className="text-stone-600 leading-relaxed pl-6.5">
                            {item.rule.instructions.followUp}
                          </p>
                        </div>
                      </div>

                      {/* Detailed Past Journal Entries For This Plant */}
                      {hasPastHistory ? (
                        <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 space-y-2.5">
                          <h4 className="font-bold text-amber-950 flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-amber-600" />
                            <span>Extraits de votre Journal pour cette plante :</span>
                          </h4>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {item.journalHistory.map(entry => (
                              <div 
                                key={entry.id}
                                className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/70 space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-stone-800">
                                    📅 {entry.date} {entry.title && `— ${entry.title}`}
                                  </span>
                                  {entry.success === true && (
                                    <span className="px-1.5 py-0.2 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Réussite
                                    </span>
                                  )}
                                  {entry.success === false && (
                                    <span className="px-1.5 py-0.2 rounded-full font-bold text-[10px] bg-red-100 text-red-800 flex items-center gap-1">
                                      <XCircle className="w-3 h-3" /> Échec
                                    </span>
                                  )}
                                </div>
                                <p className="text-stone-700 whitespace-pre-wrap leading-relaxed text-xs">
                                  {entry.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-xl border border-stone-200 text-stone-500 text-center italic">
                          Aucun antécédent noté pour le moment dans votre Journal pour cette plante. Cliquez sur <strong>« Noter l'action »</strong> après votre bouturage ou marcottage pour consigner votre premier essai !
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add / Edit Multiplication Modal */}
      <AddMultiplicationModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingRule(undefined);
          setInitialPlantName(undefined);
        }}
        existingEncyclopedia={rawEncyclopedia || []}
        existingTrees={rawTrees || []}
        existingSeedlings={rawSeedlings || []}
        initialRule={editingRule}
        initialPlantName={initialPlantName}
      />

      {/* Botanical Reference Library Modal */}
      <BotanicalLibraryModal
        isOpen={isBotanicalLibraryOpen}
        onClose={() => setIsBotanicalLibraryOpen(false)}
        existingEncyclopedia={rawEncyclopedia || []}
        existingTrees={rawTrees || []}
        existingSeedlings={rawSeedlings || []}
      />

      {/* Quick Action Modal: Record multiplication in Journal */}
      {activeLoggingItem && (
        <div 
          className="fixed inset-0 z-60 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in"
          onClick={() => setActiveLoggingItem(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-teal-200" />
                <h3 className="font-bold text-sm">
                  Noter une multiplication dans le Journal
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setActiveLoggingItem(null)} 
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="p-4 space-y-3 text-xs">
              {logFeedback && (
                <div className={`p-2.5 rounded-xl font-semibold flex items-center gap-2 ${
                  logFeedback.startsWith('✓') 
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                    : 'bg-red-100 text-red-900'
                }`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>{logFeedback}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Date de réalisation :
                  </label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Nombre réalisé :
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={logCount}
                    onChange={e => setLogCount(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Titre de la note :
                </label>
                <input
                  type="text"
                  required
                  value={logTitle}
                  onChange={e => setLogTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Observation / Détails de culture :
                </label>
                <textarea
                  rows={4}
                  required
                  value={logContent}
                  onChange={e => setLogContent(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 font-medium resize-none leading-relaxed"
                />
              </div>

              {/* Follow-up task toggle */}
              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl space-y-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-purple-900">
                  <input
                    type="checkbox"
                    checked={createFollowUpTask}
                    onChange={e => setCreateFollowUpTask(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Programmer un rappel de suivi automatique dans l'Agenda</span>
                </label>
                <p className="text-[11px] text-purple-700 pl-6">
                  Une tâche automatique sera ajoutée dans votre calendrier à J+{activeLoggingItem.rule.rootingTimeWeeks * 7} pour vérifier l'enracinement et le rempotage.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setActiveLoggingItem(null)}
                  className="px-3 py-1.5 rounded-lg text-stone-600 hover:bg-stone-100 font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLog}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmittingLog ? 'Enregistrement...' : 'Enregistrer dans le Journal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Technical Multiplication Method Detail Modal */}
      <MultiplicationMethodDetailModal
        isOpen={selectedMethodDetail !== null}
        onClose={() => {
          setSelectedMethodDetail(null);
          setMethodDetailPlantContext(null);
        }}
        initialMethod={selectedMethodDetail}
        plantContext={methodDetailPlantContext}
        ownedPlantsByMethod={ownedPlantsByMethod}
        onStartLog={(method, plantName) => {
          const matchedItem = enrichedItems.find(it => 
            plantName ? it.rule.commonName.toLowerCase() === plantName.toLowerCase() : it.rule.method === method
          );
          if (matchedItem) {
            handleStartLog(matchedItem);
          }
        }}
      />
    </div>
  );
}
