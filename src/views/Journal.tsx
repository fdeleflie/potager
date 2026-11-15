import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, JournalEntry, NoteUpdate } from '../db';
import { useFirebaseData, fb, syncPriorityCollections } from '../hooks/useFirebaseData';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, Plus, Save, Trash2, Search, Filter, Edit, X, Camera, CheckCircle2, XCircle, CalendarClock, CalendarPlus, Printer, RotateCcw, Calendar, AlignJustify, Table, CalendarDays, ExternalLink, Sparkles, RefreshCw, Zap, Copy, AlertTriangle, Eye, Tag, Settings, Thermometer, CloudRain, Droplets, Scissors, ArrowUpDown, History, ChevronDown, SlidersHorizontal, Wrench, Home, Check } from 'lucide-react';
import { ConfirmModal } from '../components/Modals';
import { JournalPrintModal } from '../components/JournalPrintModal';
import { compressImage } from '../utils/image';
import { shouldPublishNoteToJournal, getSortedUpdates, getNoteLatestDate, formatDateShortFR, parseSafeDate, toDateKey, matchesSingleDateFilter, matchesDateSearchQuery } from '../utils/notes';
import { PerpetualTask, ConfigItem, EncyclopediaEntry } from '../db';
import { PerpetualTaskModal, MONTH_NAMES, PERIOD_LABELS } from '../components/PerpetualTaskModal';
import { JournalTableView } from '../components/JournalTableView';
import { JournalCalendarView } from '../components/JournalCalendarView';
import { JournalEditModal } from '../components/JournalEditModal';
import { NoteFollowUpModal } from '../components/NoteFollowUpModal';
import { JournalDuplicatesModal, DuplicateGroup } from '../components/JournalDuplicatesModal';
import { JournalRetrospective } from '../components/JournalRetrospective';
import { WeatherReadingModal } from '../components/WeatherReadingModal';
import { MultiplicationGuideModal } from '../components/MultiplicationGuideModal';
import { JournalIntegrationModal } from '../components/JournalIntegrationModal';
import { VoiceDictationControl } from '../components/VoiceDictationControl';
import { matchUserPlantsWithMultiplications } from '../utils/multiplicationMatcher';
import { 
  getEffectiveWeatherIndicators, 
  matchBestWeatherIndicator, 
  isWeatherOptionActive,
  WeatherIndicatorItem 
} from '../utils/weatherIndicators';
import { getCurrentWeather } from '../services/weatherService';

import { useSeason } from '../contexts/SeasonContext';

export const JOURNAL_MONTHS = [
  { value: '1', label: 'Janvier' },
  { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' },
  { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' },
  { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' },
  { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' }
];

export const JOURNAL_QUARTERS = [
  { value: 'Q1', label: 'T1 : Janv – Mars (Printemps précoce)', shortLabel: 'T1 (Jan-Mar)', months: [1, 2, 3] },
  { value: 'Q2', label: 'T2 : Avr – Juin (Pleine saison)', shortLabel: 'T2 (Avr-Juin)', months: [4, 5, 6] },
  { value: 'Q3', label: 'T3 : Juil – Sept (Plein été & Récoltes)', shortLabel: 'T3 (Juil-Sep)', months: [7, 8, 9] },
  { value: 'Q4', label: 'T4 : Oct – Déc (Automne & Hivernage)', shortLabel: 'T4 (Oct-Déc)', months: [10, 11, 12] }
];

export interface CombinedEntry {
  id: string;
  noteId?: string;
  title?: string;
  description?: string;
  commentaire?: string;
  statut?: string;
  tags?: string[];
  date: string;
  latestDate?: string;
  content: string;
  photos?: string[];
  updates?: NoteUpdate[];
  isDeleted: boolean;
  type: 'journal' | 'seedling' | 'tree';
  sourceId?: string;
  sourceName?: string;
  seasonId?: string;
  success?: boolean;
  failureReason?: string;
  isArchived?: boolean;
  hasDuplicate?: boolean;
  weatherCondition?: string;
  temperature?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  rainfall?: number;
}

export function Journal({ setCurrentView }: { setCurrentView: (view: string) => void }) {
  const { currentSeasonId, seasons, isItemInCurrentSeason } = useSeason();
  const [filterSeason, setFilterSeason] = useState<string>('all');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newEntryStatut, setNewEntryStatut] = useState('Fait');
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [newEntrySuccessStatus, setNewEntrySuccessStatus] = useState<'none' | 'success' | 'failure'>('none');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date filters: Année, Trimestre, Mois, Date exacte + Critère Origine/MÀJ
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterExactDate, setFilterExactDate] = useState<string>('');
  const [filterDateScope, setFilterDateScope] = useState<'all' | 'origin' | 'update'>('all');
  const [filterWithUpdatesOnly, setFilterWithUpdatesOnly] = useState<boolean>(false);

  const [filterType, setFilterType] = useState<'all' | 'journal' | 'seedling' | 'tree'>('all');
  const [filterSuccess, setFilterSuccess] = useState<'all' | 'success' | 'failure'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'alpha'>('desc');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // Default to 'table' (Registre mensuel) as requested by user, with localStorage persistence
  const [activeView, setActiveView] = useState<'table' | 'list' | 'calendar'>(() => {
    try {
      return (localStorage.getItem('journal_preferred_view') as any) || 'table';
    } catch {
      return 'table';
    }
  });

  const handleSetView = (v: 'table' | 'list' | 'calendar') => {
    setActiveView(v);
    try {
      localStorage.setItem('journal_preferred_view', v);
    } catch {}
  };

  // Express capture always ready at top, with optional drawers & voice signals
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [showFormOptions, setShowFormOptions] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [voiceStartSignal, setVoiceStartSignal] = useState(0);
  const [voiceStopSignal, setVoiceStopSignal] = useState(0);
  const [homeViewPref, setHomeViewPref] = useState<'journal' | 'dashboard'>(() => {
    try {
      return localStorage.getItem('potager_home_view') === 'dashboard' ? 'dashboard' : 'journal';
    } catch {
      return 'journal';
    }
  });
  const quickInputRef = useRef<HTMLTextAreaElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const [isRetrospectiveOpen, setIsRetrospectiveOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [autoWeatherFeedback, setAutoWeatherFeedback] = useState<string | null>(null);

  useEffect(() => {
    try {
      const intent = sessionStorage.getItem('journal_quick_capture');
      if (intent === 'voice' || intent === 'text') {
        sessionStorage.removeItem('journal_quick_capture');
        setIsFormOpen(true);
        setTimeout(() => quickInputRef.current?.focus(), 80);
        if (intent === 'voice') {
          setVoiceStartSignal(s => s + 1);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!showToolsMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showToolsMenu]);

  const handleToggleHomeViewPref = () => {
    const next: 'journal' | 'dashboard' = homeViewPref === 'journal' ? 'dashboard' : 'journal';
    setHomeViewPref(next);
    try {
      localStorage.setItem('potager_home_view', next);
    } catch {}
  };
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEntryType, setEditingEntryType] = useState<'journal' | 'seedling' | 'tree'>('journal');
  const [editingSourceId, setEditingSourceId] = useState<string | undefined>(undefined);
  const [editingNoteId, setEditingNoteId] = useState<string | undefined>(undefined);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editSuccessStatus, setEditSuccessStatus] = useState<'none' | 'success' | 'failure'>('none');
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [isPerpetualModalOpen, setIsPerpetualModalOpen] = useState(false);
  const [perpetualModalData, setPerpetualModalData] = useState<Partial<PerpetualTask> | undefined>();
  const [modalEditingEntry, setModalEditingEntry] = useState<CombinedEntry | null>(null);
  const [followUpEntrySnapshot, setFollowUpEntrySnapshot] = useState<CombinedEntry | null>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string>('all');

  // Weather mini-indicators & reading states
  const [weatherCondition, setWeatherCondition] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [temperatureMin, setTemperatureMin] = useState<string>('');
  const [temperatureMax, setTemperatureMax] = useState<string>('');
  const [rainfall, setRainfall] = useState<string>('');
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);

  // Inline edit weather states
  const [editWeatherCondition, setEditWeatherCondition] = useState<string>('');
  const [editTemperature, setEditTemperature] = useState<string>('');
  const [editRainfall, setEditRainfall] = useState<string>('');

  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const [isSyncingPriority, setIsSyncingPriority] = useState(false);
  const [prioritySyncFeedback, setPrioritySyncFeedback] = useState<string | null>(null);
  const [isMultiplicationModalOpen, setIsMultiplicationModalOpen] = useState(false);

  const { data: rawJournalEntries, error: journalError } = useFirebaseData<any>('journal');
  const { data: rawSeedlings, error: seedlingsError } = useFirebaseData<any>('seedlings');
  const { data: rawTrees, error: treesError } = useFirebaseData<any>('trees');
  const { data: rawEncyclopedia } = useFirebaseData<EncyclopediaEntry>('encyclopedia');
  const { data: rawPerpetualTasks } = useFirebaseData<PerpetualTask>('perpetualTasks');
  const { data: rawConfig } = useFirebaseData<ConfigItem>('config');

  // Count optimal plant multiplications for the user's garden in current month
  const activeMultiplicationsCount = React.useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    const items = matchUserPlantsWithMultiplications(
      rawSeedlings || [],
      rawTrees || [],
      rawEncyclopedia || [],
      rawJournalEntries || [],
      currentMonth,
      [],
      rawPerpetualTasks || []
    );
    return items.filter(item => item.isOwned && item.periodStatus === 'optimal').length;
  }, [rawSeedlings, rawTrees, rawEncyclopedia, rawJournalEntries, rawPerpetualTasks]);

  const weatherLocation = React.useMemo(() => {
    return (rawConfig || []).find((c: any) => c.id === 'weather_location' && c.type === 'setting')?.value || '';
  }, [rawConfig]);

  const effectiveWeatherIndicators = React.useMemo(() => {
    return getEffectiveWeatherIndicators(rawConfig);
  }, [rawConfig]);

  const handleFetchCurrentWeather = async () => {
    setIsFetchingWeather(true);
    setAutoWeatherFeedback(null);
    try {
      const data = await getCurrentWeather(weatherLocation);
      if (data) {
        const matched = matchBestWeatherIndicator(effectiveWeatherIndicators, {
          weatherCode: data.weatherCode,
          temperature: data.temperature,
          rainfall: data.rainfall,
          windSpeed: data.windSpeed
        });
        const finalCondition = `${matched.emoji} ${matched.label}`;
        setWeatherCondition(finalCondition);
        setTemperature(data.temperature.toString());
        if (data.tempMin !== undefined) setTemperatureMin(data.tempMin.toString());
        if (data.tempMax !== undefined) setTemperatureMax(data.tempMax.toString());
        if (data.rainfall !== undefined && data.rainfall > 0) setRainfall(data.rainfall.toString());
        if (!selectedTags.includes('❄️ Météo & Gelée')) {
          setSelectedTags(prev => [...prev, '❄️ Météo & Gelée']);
        }
        setAutoWeatherFeedback(`✓ Indicateur validé : ${finalCondition} (${data.temperature}°C${data.rainfall ? ` • ${data.rainfall}mm pluie` : ''})`);
        setTimeout(() => setAutoWeatherFeedback(null), 5000);
      } else {
        setAutoWeatherFeedback("⚠️ Commune non configurée. Renseignez votre ville dans Configuration > Météo ou activez le GPS.");
        setTimeout(() => setAutoWeatherFeedback(null), 6000);
      }
    } catch (err) {
      console.error('Failed to fetch weather in journal:', err);
      setAutoWeatherFeedback("Erreur lors de la récupération météo.");
      setTimeout(() => setAutoWeatherFeedback(null), 5000);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const handleToggleWeatherOption = (opt: WeatherIndicatorItem) => {
    const full = `${opt.emoji} ${opt.label}`;
    if (weatherCondition === full) {
      setWeatherCondition('');
    } else {
      setWeatherCondition(full);
      if (!selectedTags.includes('❄️ Météo & Gelée')) {
        setSelectedTags(prev => [...prev, '❄️ Météo & Gelée']);
      }
    }
  };

  const handleToggleEditWeatherOption = (opt: WeatherIndicatorItem) => {
    const full = `${opt.emoji} ${opt.label}`;
    if (editWeatherCondition === full) {
      setEditWeatherCondition('');
    } else {
      setEditWeatherCondition(full);
      if (!editTags.includes('❄️ Météo & Gelée')) {
        setEditTags(prev => [...prev, '❄️ Météo & Gelée']);
      }
    }
  };

  const availableJournalTags: string[] = React.useMemo(() => {
    if (rawConfig && rawConfig.length > 0) {
      const custom = rawConfig
        .filter((c: any) => c.type === 'journal_tag' && c.value && c.value.trim())
        .map((c: any) => c.value.trim());
      if (custom.length > 0) {
        return Array.from(new Set(custom));
      }
    }
    return [
      '💧 Arrosage',
      '🌱 Semis',
      '🪴 Plantation & Repiquage',
      '🌿 Désherbage',
      '✂️ Taille & Pincement',
      '🧺 Récolte',
      '🍂 Paillage',
      '🧪 Traitement & Soin',
      '🪱 Compost & Engrais',
      '🔍 Observation',
      '❄️ Météo & Gelée',
      '🔨 Bricolage & Tuteurage'
    ];
  }, [rawConfig]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleToggleEditTag = (tag: string) => {
    setEditTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const perpetualTasks = React.useMemo(() => {
    return (rawPerpetualTasks || []).filter(t => !t.isDeleted);
  }, [rawPerpetualTasks]);

  // Detect duplicate groups (different document IDs stored in Firebase with exact same date and normalized content)
  const duplicateGroups: DuplicateGroup[] = React.useMemo(() => {
    if (!rawJournalEntries) return [];
    const active = rawJournalEntries.filter(e => !e.isDeleted);
    const groupsMap = new Map<string, any[]>();

    active.forEach(e => {
      const normContent = (e.content || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const key = `${e.date}__${normContent}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(e);
    });

    const groups: DuplicateGroup[] = [];
    groupsMap.forEach((entryList, key) => {
      if (entryList.length > 1) {
        groups.push({
          key,
          date: entryList[0].date,
          content: entryList[0].content,
          entries: entryList
        });
      }
    });

    return groups;
  }, [rawJournalEntries]);

  const totalRedundantCount = React.useMemo(() => {
    return duplicateGroups.reduce((acc, g) => acc + Math.max(0, g.entries.length - 1), 0);
  }, [duplicateGroups]);

  const duplicateJournalDocs = React.useMemo(() => {
    const dupes: string[] = [];
    duplicateGroups.forEach(g => {
      for (let i = 1; i < g.entries.length; i++) {
        dupes.push(g.entries[i].id);
      }
    });
    return dupes;
  }, [duplicateGroups]);

  const handleDeleteDuplicateEntry = async (id: string) => {
    await fb.delete('journal', id);
  };

  const handleKeepOnlyThisDuplicate = async (group: DuplicateGroup, keepId: string) => {
    setIsCleaningDuplicates(true);
    try {
      const toDelete = group.entries.filter(e => e.id !== keepId);
      for (const item of toDelete) {
        await fb.delete('journal', item.id);
      }
      setCleanFeedback(`Doublon(s) supprimé(s) pour la note du ${group.date}.`);
      setTimeout(() => setCleanFeedback(null), 3500);
    } catch (e) {
      console.error('Erreur conservation doublon', e);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleCleanDuplicates = async () => {
    if (duplicateJournalDocs.length === 0) return;
    setIsCleaningDuplicates(true);
    try {
      let cleaned = 0;
      for (const id of duplicateJournalDocs) {
        await fb.delete('journal', id);
        cleaned++;
      }
      setCleanFeedback(`${cleaned} doublon${cleaned > 1 ? 's' : ''} supprimé${cleaned > 1 ? 's' : ''} avec succès du journal !`);
      setTimeout(() => setCleanFeedback(null), 4000);
      setIsDuplicatesModalOpen(false);
    } catch (e) {
      console.error('Erreur suppression des doublons du journal', e);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handlePrioritySync = async () => {
    setIsSyncingPriority(true);
    setPrioritySyncFeedback(null);
    try {
      const res = await syncPriorityCollections();
      if (res.success) {
        setPrioritySyncFeedback(`Journal & Perpétuel synchronisés (${res.syncedCount} entrées à ${res.time})`);
      } else {
        setPrioritySyncFeedback(res.error || 'Erreur de synchronisation');
      }
    } catch (e: any) {
      setPrioritySyncFeedback(e.message || 'Erreur');
    } finally {
      setIsSyncingPriority(false);
      setTimeout(() => setPrioritySyncFeedback(null), 5000);
    }
  };

  const error = journalError || seedlingsError || treesError;

  const entries = React.useMemo(() => {
    if (!rawJournalEntries || !rawSeedlings || !rawTrees) return undefined;
    
    const journalEntries = rawJournalEntries.filter(e => !e.isDeleted);
    const seedlings = rawSeedlings.filter(s => !s.isDeleted);
    const trees = rawTrees.filter(t => !t.isDeleted);

    const duplicateIdSet = new Set<string>();
    duplicateGroups.forEach(g => {
      g.entries.forEach(e => duplicateIdSet.add(e.id));
    });

    const combined: CombinedEntry[] = journalEntries.map(e => ({
      ...e,
      title: e.title,
      type: 'journal',
      updates: e.updates || [],
      latestDate: getNoteLatestDate(e.date, e.updates),
      seasonId: e.seasonId,
      success: e.successStatus === 'success' ? true : e.successStatus === 'failure' ? false : (e.success !== undefined ? e.success : undefined),
      failureReason: e.failureReason,
      hasDuplicate: duplicateIdSet.has(e.id)
    }));
    
    seedlings.forEach(s => {
      // If the seedling is in 'Vendu / Donné' state, do NOT include in journal
      if (s.state === 'Vendu / Donné') return;

      if (s.notes && s.notes.length > 0) {
        s.notes.forEach((n: any) => {
          if (!shouldPublishNoteToJournal(n)) return;

          // Note's individual success status
          let noteSuccess: boolean | undefined = undefined;
          if (n.successStatus === 'success') {
            noteSuccess = true;
          } else if (n.successStatus === 'failure') {
            noteSuccess = false;
          } else if (n.successStatus === 'none') {
            noteSuccess = undefined;
          } else {
            // Note without explicit status: don't automatically mark as success/failure
            noteSuccess = undefined;
          }

          combined.push({
            id: `${s.id}-${n.id}`,
            noteId: n.id,
            title: n.title || `${s.vegetable} (${s.variety || 'Semis'})`,
            date: n.date,
            latestDate: getNoteLatestDate(n.date, n.updates),
            content: n.text,
            photos: n.photos,
            updates: n.updates || [],
            isDeleted: false,
            type: 'seedling',
            sourceId: s.id,
            sourceName: `${s.vegetable} - ${s.variety || 'Sans variété'}`,
            seasonId: s.seasonId,
            success: noteSuccess,
            failureReason: noteSuccess === false ? (n.failureReason || s.failureReason) : undefined,
            isArchived: s.isArchived
          });
        });
      }

      // If seedling has an overall culture outcome (success or failure), create a distinct culture outcome entry
      if (s.success !== undefined) {
        const bilanText = s.success 
          ? `Bilan de culture : Réussite du semis${s.quantityHarvested ? ` (${s.quantityHarvested} récoltés)` : ''}`
          : `Bilan de culture : Échec du semis${s.failureReason ? ` (Raison : ${s.failureReason})` : ''}`;

        // Prevent duplicate if a note with the exact same content already exists on this seedling
        const alreadyHasMatchingNote = s.notes?.some((n: any) => 
          (n.text || '').trim().toLowerCase() === bilanText.trim().toLowerCase()
        );

        if (!alreadyHasMatchingNote) {
          const bilanDate = s.dateHarvested || s.datePlanted || s.dateTransplanted || s.dateSown || s.createdAt || new Date().toISOString().split('T')[0];
          combined.push({
            id: `${s.id}-bilan`,
            title: `Bilan : ${s.vegetable} (${s.variety || 'Semis'})`,
            date: bilanDate,
            latestDate: bilanDate,
            content: bilanText,
            isDeleted: false,
            type: 'seedling',
            sourceId: s.id,
            sourceName: `${s.vegetable} - ${s.variety || 'Sans variété'}`,
            seasonId: s.seasonId,
            success: s.success,
            failureReason: s.failureReason,
            isArchived: s.isArchived
          });
        }
      }
    });

    trees.forEach(t => {
      if (t.notes) {
        t.notes.forEach((n: any) => {
          combined.push({
            id: `${t.id}-${n.id}`,
            noteId: n.id,
            title: n.title || `${t.species} (${t.variety || 'Arbre'})`,
            date: n.date,
            latestDate: getNoteLatestDate(n.date, n.updates),
            content: n.text,
            photos: n.photos,
            updates: n.updates || [],
            isDeleted: false,
            type: 'tree',
            sourceId: t.id,
            sourceName: `${t.species} - ${t.variety || 'Sans variété'}`,
            seasonId: t.seasonId,
            success: n.successStatus === 'success' ? true : n.successStatus === 'failure' ? false : undefined,
            failureReason: n.successStatus === 'failure' ? n.failureReason : undefined
          });
        });
      }
    });

    // Smart deduplication: eliminate duplicate IDs AND duplicate content signatures (unless showDuplicatesOnly is active)
    const uniqueMap = new Map<string, CombinedEntry>();
    const seenSignatures = new Set<string>();

    combined.forEach(item => {
      // 1. Check ID uniqueness (never render identical document IDs)
      if (uniqueMap.has(item.id)) return;

      // 2. Check content signature: date + source/type + normalized content
      if (!showDuplicatesOnly) {
        const normContent = (item.content || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const signature = `${item.date}__${item.sourceId || item.type}__${normContent}`;
        if (seenSignatures.has(signature)) {
          return; // Skip duplicate from general list!
        }
        seenSignatures.add(signature);
      }
      uniqueMap.set(item.id, item);
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const ta = parseSafeDate(a.latestDate || a.date)?.getTime() ?? 0;
      const tb = parseSafeDate(b.latestDate || b.date)?.getTime() ?? 0;
      return tb - ta;
    });
  }, [rawJournalEntries, rawSeedlings, rawTrees, duplicateGroups, showDuplicatesOnly]);

  const activeFollowUpEntry = React.useMemo(() => {
    if (!followUpEntrySnapshot) return null;
    return entries?.find(e => e.id === followUpEntrySnapshot.id) || followUpEntrySnapshot;
  }, [followUpEntrySnapshot, entries]);

  const handleSaveEntryUpdates = async (entry: CombinedEntry, nextUpdates: NoteUpdate[]) => {
    const cleanedUpdates = getSortedUpdates(nextUpdates);
    if (entry.type === 'journal') {
      await fb.update('journal', entry.id, { updates: cleanedUpdates });
      return;
    }
    if (entry.type === 'seedling' && entry.sourceId && entry.noteId) {
      const seedling = (rawSeedlings || []).find((s: any) => s.id === entry.sourceId);
      if (!seedling) return;
      const updatedNotes = (seedling.notes || []).map((n: any) =>
        n.id === entry.noteId ? { ...n, updates: cleanedUpdates } : n
      );
      await fb.update('seedlings', entry.sourceId, { notes: updatedNotes });
      return;
    }
    if (entry.type === 'tree' && entry.sourceId && entry.noteId) {
      const tree = (rawTrees || []).find((t: any) => t.id === entry.sourceId);
      if (!tree) return;
      const updatedNotes = (tree.notes || []).map((n: any) =>
        n.id === entry.noteId ? { ...n, updates: cleanedUpdates } : n
      );
      await fb.update('trees', entry.sourceId, { notes: updatedNotes });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 800, 800, 0.7);
        if (isEdit) {
          setEditPhotos(prev => [...prev, compressedBase64]);
        } else {
          setPhotos(prev => [...prev, compressedBase64]);
        }
      } catch (error) {
        console.error("Failed to compress image:", error);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const parsedTemp = temperature.trim() !== '' ? parseFloat(temperature) : undefined;
      const parsedMin = temperatureMin.trim() !== '' ? parseFloat(temperatureMin) : undefined;
      const parsedMax = temperatureMax.trim() !== '' ? parseFloat(temperatureMax) : undefined;
      const parsedRain = rainfall.trim() !== '' ? parseFloat(rainfall) : undefined;
      const isSuccess = newEntrySuccessStatus === 'success' || newEntryStatut.toLowerCase().includes('réussi') || newEntryStatut.toLowerCase().includes('succès');
      const isFailure = newEntrySuccessStatus === 'failure' || newEntryStatut.toLowerCase().includes('échec') || newEntryStatut.toLowerCase().includes('raté');

      const entry: JournalEntry = {
        id: uuidv4(),
        title: title.trim() || undefined,
        description: title.trim() || undefined,
        commentaire: content.trim(),
        statut: newEntryStatut.trim() || (isSuccess ? 'Réussite' : isFailure ? 'Échec' : 'Fait'),
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        date,
        content: content.trim(),
        photos,
        isDeleted: false,
        seasonId: (currentSeasonId && currentSeasonId !== 'all') ? currentSeasonId : seasons[0]?.id,
        successStatus: isSuccess ? 'success' : isFailure ? 'failure' : newEntrySuccessStatus,
        success: isSuccess ? true : isFailure ? false : undefined,
        weatherCondition: weatherCondition || undefined,
        temperature: parsedTemp,
        temperatureMin: parsedMin,
        temperatureMax: parsedMax,
        rainfall: parsedRain
      };

      await fb.add("journal", entry);
      setTitle('');
      setSelectedTags([]);
      setContent('');
      setNewEntryStatut('Fait');
      setPhotos([]);
      setNewEntrySuccessStatus('none');
      setWeatherCondition('');
      setTemperature('');
      setTemperatureMin('');
      setTemperatureMax('');
      setRainfall('');
      setShowFormOptions(false);
      setVoiceStopSignal(s => s + 1);
      setSaveFeedback("Observation enregistrée avec succès dans le registre !");
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (err) {
      console.error('Erreur enregistrement note journal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (entry: CombinedEntry) => {
    const canEdit = entry.type === 'journal' || Boolean(entry.noteId && entry.sourceId);
    if (!canEdit) return;
    if (activeView === 'list') {
      setEditingId(entry.id);
      setEditingEntryType(entry.type);
      setEditingSourceId(entry.sourceId);
      setEditingNoteId(entry.noteId);
      setEditTitle(entry.title || '');
      setEditTags(entry.tags || []);
      setEditContent(entry.content);
      setEditDate(toDateKey(entry.date) || entry.date);
      setEditPhotos(entry.photos || []);
      setEditSuccessStatus(
        entry.success === true ? 'success' :
        entry.success === false ? 'failure' : 'none'
      );
      setEditWeatherCondition(entry.weatherCondition || '');
      setEditTemperature(entry.temperature !== undefined ? entry.temperature.toString() : '');
      setEditRainfall(entry.rainfall !== undefined ? entry.rainfall.toString() : '');
    } else {
      setModalEditingEntry(entry);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingEntryType('journal');
    setEditingSourceId(undefined);
    setEditingNoteId(undefined);
    setEditTitle('');
    setEditTags([]);
    setEditContent('');
    setEditDate('');
    setEditPhotos([]);
    setEditSuccessStatus('none');
    setEditWeatherCondition('');
    setEditTemperature('');
    setEditRainfall('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    if (editingEntryType === 'journal') {
      const nextStatut =
        editSuccessStatus === 'success' ? 'Réussite' :
        editSuccessStatus === 'failure' ? 'Échec' : 'Neutre';
      await fb.update("journal", id, {
        title: editTitle.trim() || undefined,
        description: editTitle.trim() || undefined,
        statut: nextStatut,
        commentaire: editContent.trim(),
        tags: editTags.length > 0 ? editTags : [],
        content: editContent.trim(),
        date: editDate,
        photos: editPhotos,
        successStatus: editSuccessStatus,
        success: editSuccessStatus === 'success' ? true : editSuccessStatus === 'failure' ? false : undefined,
        weatherCondition: editWeatherCondition || undefined,
        temperature: editTemperature.trim() !== '' ? parseFloat(editTemperature) : undefined,
        rainfall: editRainfall.trim() !== '' ? parseFloat(editRainfall) : undefined
      });
    } else if (editingEntryType === 'seedling' && editingSourceId && editingNoteId) {
      const seedling = (rawSeedlings || []).find((s: any) => s.id === editingSourceId);
      if (seedling) {
        const updatedNotes = (seedling.notes || []).map((n: any) =>
          n.id === editingNoteId
            ? {
                ...n,
                date: editDate,
                text: editContent.trim(),
                photos: editPhotos,
                successStatus: editSuccessStatus
              }
            : n
        );
        await fb.update("seedlings", editingSourceId, { notes: updatedNotes });
      }
    } else if (editingEntryType === 'tree' && editingSourceId && editingNoteId) {
      const tree = (rawTrees || []).find((t: any) => t.id === editingSourceId);
      if (tree) {
        const updatedNotes = (tree.notes || []).map((n: any) =>
          n.id === editingNoteId
            ? {
                ...n,
                date: editDate,
                text: editContent.trim(),
                photos: editPhotos,
                successStatus: editSuccessStatus
              }
            : n
        );
        await fb.update("trees", editingSourceId, { notes: updatedNotes });
      }
    }
    handleCancelEdit();
  };

  const handleSetEntrySuccessStatus = async (entry: CombinedEntry, nextStatus: 'none' | 'success' | 'failure') => {
    if (entry.type === 'journal') {
      const nextStatut =
        nextStatus === 'success' ? 'Réussite' :
        nextStatus === 'failure' ? 'Échec' : 'Neutre';
      await fb.update("journal", entry.id, {
        successStatus: nextStatus,
        success: nextStatus === 'success' ? true : nextStatus === 'failure' ? false : undefined,
        statut: nextStatut
      });
      return;
    }
    if (entry.type === 'seedling' && entry.sourceId && entry.noteId) {
      const seedling = (rawSeedlings || []).find((s: any) => s.id === entry.sourceId);
      if (!seedling) return;
      const updatedNotes = (seedling.notes || []).map((n: any) =>
        n.id === entry.noteId ? { ...n, successStatus: nextStatus } : n
      );
      await fb.update('seedlings', entry.sourceId, { notes: updatedNotes });
      return;
    }
    if (entry.type === 'tree' && entry.sourceId && entry.noteId) {
      const tree = (rawTrees || []).find((t: any) => t.id === entry.sourceId);
      if (!tree) return;
      const updatedNotes = (tree.notes || []).map((n: any) =>
        n.id === entry.noteId ? { ...n, successStatus: nextStatus } : n
      );
      await fb.update('trees', entry.sourceId, { notes: updatedNotes });
    }
  };

  const handleCycleJournalSuccess = async (entry: CombinedEntry) => {
    const nextStatus: 'none' | 'success' | 'failure' =
      entry.success === true ? 'failure' :
      entry.success === false ? 'none' : 'success';
    await handleSetEntrySuccessStatus(entry, nextStatus);
  };

  const handleDelete = async (id: string, type: string) => {
    if (type !== 'journal') return;
    setConfirmState({
      isOpen: true,
      title: 'Supprimer la note',
      message: 'Voulez-vous vraiment supprimer cette note du journal ?',
      isDanger: true,
      onConfirm: async () => {
        await fb.update("journal", id, { isDeleted: true });
      }
    });
  };

  const handleDeletePerpetualDirect = (perpetualId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Retirer du planning perpétuel',
      message: 'Voulez-vous vraiment retirer ce geste du planning perpétuel ? Il n\'apparaîtra plus dans le calendrier les années suivantes.',
      isDanger: true,
      onConfirm: async () => {
        await fb.update("perpetualTasks", perpetualId, { isDeleted: true });
      }
    });
  };

  const handleOpenPerpetualModal = (entry: CombinedEntry) => {
    const d = new Date(entry.date);
    const month = !isNaN(d.getTime()) ? (d.getMonth() + 1) : (new Date().getMonth() + 1);
    const day = !isNaN(d.getTime()) ? d.getDate() : 15;
    const period: 'debut' | 'mi' | 'fin' = day <= 10 ? 'debut' : day <= 20 ? 'mi' : 'fin';

    let plantName = '';
    if (entry.sourceName) {
      plantName = entry.sourceName.split('-')[0].trim();
    }

    const text = (entry.content || '').toLowerCase();
    let category: PerpetualTask['category'] = 'multiplication';
    if (text.includes('boutur') || text.includes('multipli') || text.includes('marcott') || text.includes('divis')) {
      category = 'multiplication';
    } else if (text.includes('semi') || text.includes('semé') || text.includes('graine')) {
      category = 'sowing';
    } else if (text.includes('taille') || text.includes('taill') || text.includes('pinc')) {
      category = 'pruning';
    } else if (text.includes('repiqu') || text.includes('plant') || text.includes('mise en terre')) {
      category = 'planting';
    } else if (text.includes('recolt') || text.includes('récolt') || text.includes('cueill')) {
      category = 'harvest';
    } else if (text.includes('trait') || text.includes('soin') || text.includes('maladi') || text.includes('purin')) {
      category = 'treatment';
    } else if (text.includes('paill') || text.includes('arros') || text.includes('désherb')) {
      category = 'maintenance';
    }

    let defaultTitle = '';
    if (category === 'multiplication') {
      defaultTitle = plantName ? `Bouturage / Multiplication : ${plantName}` : 'Bouturage / Multiplication';
    } else if (category === 'sowing') {
      defaultTitle = plantName ? `Semis : ${plantName}` : 'Semis';
    } else if (category === 'pruning') {
      defaultTitle = plantName ? `Taille : ${plantName}` : 'Taille';
    } else if (category === 'planting') {
      defaultTitle = plantName ? `Plantation : ${plantName}` : 'Plantation';
    } else if (category === 'harvest') {
      defaultTitle = plantName ? `Période de récolte : ${plantName}` : 'Récolte';
    } else {
      defaultTitle = plantName ? `Geste : ${plantName}` : 'Geste réussi au potager';
    }

    setPerpetualModalData({
      title: defaultTitle,
      plant: plantName,
      category,
      month,
      period,
      description: entry.content,
      photos: entry.photos || [],
      sourceNoteDate: entry.date,
      sourceNoteId: entry.id
    });
    setIsPerpetualModalOpen(true);
  };

  const handleEditPerpetual = (task: PerpetualTask) => {
    setPerpetualModalData(task);
    setIsPerpetualModalOpen(true);
  };

  const availableYears = React.useMemo(() => {
    const yearSet = new Set<string>();
    const currentY = new Date().getFullYear().toString();
    yearSet.add(currentY);
    (entries || []).forEach(e => {
      const d = parseSafeDate(e.date);
      if (d) {
        yearSet.add(d.getFullYear().toString());
      }
      (e.updates || []).forEach(u => {
        const ud = parseSafeDate(u.date);
        if (ud) yearSet.add(ud.getFullYear().toString());
      });
    });
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const entriesWithUpdatesCount = React.useMemo(() => {
    return (entries || []).filter(e => (e.updates || []).length > 0).length;
  }, [entries]);

  const retrospectiveNotesCount = React.useMemo(() => {
    if (!entries || entries.length === 0) return 0;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    return entries.filter(e => {
      const d = parseSafeDate(e.date);
      if (!d) return false;
      return d.getFullYear() < currentYear && d.getMonth() === currentMonth && Math.abs(d.getDate() - currentDay) <= 3;
    }).length;
  }, [entries]);

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-xl border border-red-200">
        <p className="text-red-700 font-medium">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Rafraîchir
        </button>
      </div>
    );
  }

  if (!rawJournalEntries && !error) return <div className="p-8 text-center text-stone-500 italic">Chargement du journal...</div>;

  const handleQuarterChange = (q: string) => {
    setFilterQuarter(q);
    if (q !== 'all' && filterMonth !== 'all') {
      const qObj = JOURNAL_QUARTERS.find(x => x.value === q);
      if (qObj && !qObj.months.includes(Number(filterMonth))) {
        setFilterMonth('all');
      }
    }
  };

  const handleMonthChange = (m: string) => {
    setFilterMonth(m);
    if (m !== 'all') {
      const monthNum = Number(m);
      const q = monthNum <= 3 ? 'Q1' : monthNum <= 6 ? 'Q2' : monthNum <= 9 ? 'Q3' : 'Q4';
      setFilterQuarter(q);
    }
  };

  const handleResetDateFilters = () => {
    setFilterYear('all');
    setFilterQuarter('all');
    setFilterMonth('all');
    setFilterExactDate('');
    setFilterDateScope('all');
  };

  const isDateFilterActive =
    filterYear !== 'all' ||
    filterQuarter !== 'all' ||
    filterMonth !== 'all' ||
    filterExactDate !== '' ||
    filterDateScope !== 'all';

  const filteredEntries = (entries || []).filter(e => {
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = !searchLower ||
                          (e.title ? e.title.toLowerCase().includes(searchLower) : false) ||
                          e.content.toLowerCase().includes(searchLower) ||
                          (e.updates ? e.updates.some(u => u.text.toLowerCase().includes(searchLower)) : false) ||
                          matchesDateSearchQuery(searchLower, e.date, e.updates) ||
                          (e.tags ? e.tags.some((t: string) => t.toLowerCase().includes(searchLower)) : false) ||
                          (e.sourceName ? e.sourceName.toLowerCase().includes(searchLower) : false) ||
                          (e.failureReason ? e.failureReason.toLowerCase().includes(searchLower) : false) ||
                          ((searchLower.includes('reussi') || searchLower.includes('succes') || searchLower.includes('succès')) && e.success === true) ||
                          ((searchLower.includes('echec') || searchLower.includes('échec')) && e.success === false);

    const matchesTag = filterTag === 'all' || (e.tags && e.tags.includes(filterTag));
    if (!matchesTag) return false;

    const matchesType = filterType === 'all' || 
                        (filterType === 'journal' && e.type === 'journal') || 
                        (filterType === 'seedling' && (e.type === 'seedling' || e.type === 'tree'));
    
    const matchesSuccess = filterSuccess === 'all' ||
                           (filterSuccess === 'success' && e.success === true) ||
                           (filterSuccess === 'failure' && e.success === false);

    const matchesSeason = filterSeason === 'all' || (filterSeason === currentSeasonId ? isItemInCurrentSeason(e) : e.seasonId === filterSeason);

    if (showDuplicatesOnly && !e.hasDuplicate) return false;
    if (filterWithUpdatesOnly && (!e.updates || e.updates.length === 0)) return false;

    if (!matchesSeason || !matchesSuccess || !matchesType || !matchesSearch) return false;

    // Temporal date filtering with explicit Origine / Mise à jour / Both scope
    const hasValidOrigin = parseSafeDate(e.date) !== null;
    if (!hasValidOrigin) return false;

    const sortedUpdates = getSortedUpdates(e.updates);
    if (filterDateScope === 'origin') {
      return matchesSingleDateFilter(e.date, filterYear, filterQuarter, filterMonth, filterExactDate);
    } else if (filterDateScope === 'update') {
      if (sortedUpdates.length === 0) return false;
      return sortedUpdates.some(u => matchesSingleDateFilter(u.date, filterYear, filterQuarter, filterMonth, filterExactDate));
    } else {
      const originMatch = matchesSingleDateFilter(e.date, filterYear, filterQuarter, filterMonth, filterExactDate);
      const updateMatch = sortedUpdates.some(u => matchesSingleDateFilter(u.date, filterYear, filterQuarter, filterMonth, filterExactDate));
      return originMatch || updateMatch;
    }
  }).sort((a, b) => {
    if (sortOrder === 'alpha') {
      return a.content.localeCompare(b.content);
    }
    const dateA = parseSafeDate(a.latestDate || a.date)?.getTime() ?? 0;
    const dateB = parseSafeDate(b.latestDate || b.date)?.getTime() ?? 0;
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        isDanger={confirmState.isDanger}
        confirmText="Supprimer"
      />

      {/* Header with Title and Streamlined Daily Actions */}
      <header className="bg-white p-3 sm:p-4 rounded-2xl shadow-xs border border-stone-200/80 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-serif font-bold text-stone-900">
                Journal du potager
              </h1>
              {currentSeasonId && (
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {seasons.find(s => s.id === currentSeasonId)?.name || 'Saison'}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-stone-500">Saisie rapide, dictée vocale & suivi chronologique</p>
          </div>
        </div>

        {/* Streamlined Action Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
          {/* Quick Weather Reading Modal */}
          <button
            type="button"
            onClick={() => setIsWeatherModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl transition shadow-2xs text-xs font-semibold cursor-pointer"
            title="Ajouter rapidement un relevé météo / pluviomètre / température du jour"
          >
            <Thermometer className="w-3.5 h-3.5 text-blue-600" />
            <span>Météo</span>
          </button>

          {/* Retrospective Button */}
          <button
            type="button"
            onClick={() => setIsRetrospectiveOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border rounded-xl transition shadow-2xs text-xs font-semibold cursor-pointer ${
              isRetrospectiveOpen
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
            }`}
            title="Consulter les observations notées ce jour-là les années passées"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Ce jour-là</span>
            {retrospectiveNotesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                {retrospectiveNotesCount}
              </span>
            )}
          </button>

          {/* Grouped Secondary Tools Menu */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => setShowToolsMenu(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border rounded-xl transition shadow-2xs text-xs font-semibold cursor-pointer ${
                showToolsMenu
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
              }`}
              title="Outils du journal (Impression, Export/Import, Planning, Paramètres)"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Outils</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showToolsMenu ? 'rotate-180' : ''}`} />
            </button>

            {showToolsMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 z-40 space-y-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintModalOpen(true);
                    setShowToolsMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 font-medium text-left cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-stone-500" />
                  <span>Imprimer le registre</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsIntegrationModalOpen(true);
                    setShowToolsMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50 text-indigo-800 font-medium text-left cursor-pointer"
                >
                  <ArrowUpDown className="w-4 h-4 text-indigo-600" />
                  <span>Import / Export CSV & JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('calendar-multiplications');
                    setShowToolsMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-teal-50 text-teal-800 font-medium text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Scissors className="w-4 h-4 text-teal-600" />
                    <span>Multiplications</span>
                  </span>
                  {activeMultiplicationsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900">
                      {activeMultiplicationsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('calendar-perpetual');
                    setShowToolsMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-purple-50 text-purple-800 font-medium text-left cursor-pointer"
                >
                  <CalendarClock className="w-4 h-4 text-purple-600" />
                  <span>Planning perpétuel</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handlePrioritySync();
                    setShowToolsMenu(false);
                  }}
                  disabled={isSyncingPriority}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-emerald-50 text-emerald-800 font-medium text-left cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-600 ${isSyncingPriority ? 'animate-spin' : ''}`} />
                  <span>Synchroniser maintenant</span>
                </button>

                <div className="my-1 border-t border-stone-100" />

                <button
                  type="button"
                  onClick={handleToggleHomeViewPref}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-700 font-medium text-left cursor-pointer"
                  title="Choisir la page affichée au démarrage de l'application"
                >
                  <span className="flex items-center gap-2.5">
                    <Home className="w-4 h-4 text-emerald-600" />
                    <span>Accueil : {homeViewPref === 'journal' ? 'Journal' : 'Tableau'}</span>
                  </span>
                  {homeViewPref === 'journal' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <Check className="w-3 h-3" />
                      Journal
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Notifications / Toast Feedback Banners */}
      {saveFeedback && (
        <div className="p-3 bg-emerald-600 text-white text-xs font-semibold rounded-xl flex items-center justify-between gap-2 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{saveFeedback}</span>
          </div>
          <button type="button" onClick={() => setSaveFeedback(null)} className="p-1 hover:bg-emerald-700 rounded-md">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {prioritySyncFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{prioritySyncFeedback}</span>
          </div>
          <button type="button" onClick={() => setPrioritySyncFeedback(null)} className="text-stone-400 hover:text-stone-600 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {cleanFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{cleanFeedback}</span>
        </div>
      )}

      {/* Collapsible Retrospective Panel */}
      {isRetrospectiveOpen && (
        <div className="relative animate-fade-in">
          <JournalRetrospective
            entries={entries || []}
            currentDate={date}
            onOpenPerpetualModal={handleOpenPerpetualModal}
          />
          <button
            type="button"
            onClick={() => setIsRetrospectiveOpen(false)}
            className="absolute top-3 right-3 p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full"
            title="Masquer la rétrospective"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Express Quick-Capture Card (Always ready for PC keyboard & Mobile voice) */}
      {isFormOpen ? (
        <form onSubmit={handleSave} className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border-2 border-emerald-500/30 space-y-2.5">
          {/* Top bar: Voice Dictation prominent + Date + Collapse */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex-1 min-w-[220px]">
              <VoiceDictationControl
                value={content}
                onChange={setContent}
                prominent
                startSignal={voiceStartSignal}
                stopSignal={voiceStopSignal}
              />
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <input 
                type="date" 
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-2 py-1 text-xs font-semibold rounded-lg border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                title="Date de l'observation"
              />
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-2 py-1 text-[11px] text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
                title="Réduire la zone de saisie"
              >
                Réduire
              </button>
            </div>
          </div>

          {/* Main Quick Textarea (Ctrl+Enter / Cmd+Enter to save on PC) */}
          <textarea 
            ref={quickInputRef}
            required
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && content.trim() && !isSubmitting) {
                e.preventDefault();
                handleSave(e as unknown as React.FormEvent);
              }
            }}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50/40 focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 outline-none resize-y leading-relaxed placeholder:text-stone-400"
            placeholder="Note express : dictez au micro ou saisissez votre observation... (Ctrl+Entrée pour enregistrer)"
          />

          {/* Horizontal 1-tap Activity Tags Strip */}
          {availableJournalTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider shrink-0">
                Tags :
              </span>
              {availableJournalTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer border shrink-0 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-emerald-50 hover:text-emerald-800'
                    }`}
                  >
                    <span>{tag}</span>
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Attached Photos Preview */}
          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo, index) => (
                <div key={index} className="relative w-14 h-14 rounded-xl overflow-hidden border border-stone-200 shrink-0">
                  <img src={photo} alt="Aperçu" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                    className="absolute top-0.5 right-0.5 p-0.5 bg-white/90 hover:bg-white rounded-full text-stone-700 shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Auto Weather Confirmation / Captured Pill */}
          {(autoWeatherFeedback || weatherCondition || temperature) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {autoWeatherFeedback && (
                <div className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{autoWeatherFeedback}</span>
                </div>
              )}
              {!autoWeatherFeedback && (weatherCondition || temperature) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-medium">
                  <span>{weatherCondition}</span>
                  {temperature && <span>• {temperature}°C</span>}
                  {rainfall && <span>• {rainfall} mm</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setWeatherCondition('');
                      setTemperature('');
                      setTemperatureMin('');
                      setTemperatureMax('');
                      setRainfall('');
                    }}
                    className="text-blue-500 hover:text-blue-800 ml-1"
                    title="Effacer la météo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Collapsible Optional Fields Drawer (Titre, Météo détaillée, Statut, Config tags) */}
          {showFormOptions && (
            <div className="pt-2.5 border-t border-stone-100 space-y-3 animate-fade-in">
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Titre optionnel (ex. Première récolte de courgettes, Taille...)"
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-stone-400"
                />
                <button
                  type="button"
                  onClick={() => setCurrentView('config-journal_tag')}
                  className="px-2.5 py-1.5 text-xs text-stone-600 hover:text-emerald-700 bg-stone-50 hover:bg-emerald-50 border border-stone-200 rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer font-medium"
                  title="Configurer les tags dans le menu Configuration"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Gérer les tags</span>
                </button>
              </div>

              {/* Detailed Weather Controls */}
              <div className="space-y-2 bg-stone-50/80 p-3 rounded-xl border border-stone-200/80">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-stone-700 flex items-center gap-1.5">
                    <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                    <span>Météo détaillée :</span>
                  </span>
                  {weatherCondition && (
                    <button
                      type="button"
                      onClick={() => {
                        setWeatherCondition('');
                        setAutoWeatherFeedback(null);
                      }}
                      className="text-[11px] text-stone-400 hover:text-stone-600 underline cursor-pointer"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                  {effectiveWeatherIndicators.map(opt => {
                    const isSelected = isWeatherOptionActive(weatherCondition, opt);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleToggleWeatherOption(opt)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected ? `${opt.activeClass} ring-2 ring-emerald-500 font-bold shadow-xs scale-102` : opt.colorClass
                        }`}
                      >
                        <span className="text-sm leading-none">{opt.emoji}</span>
                        <span className="truncate">{opt.label}</span>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-stone-200/60 text-xs">
                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200 shadow-2xs">
                    <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-[10px] text-stone-500 font-medium">T° :</span>
                    <input
                      type="number"
                      step="0.1"
                      value={temperature}
                      onChange={e => setTemperature(e.target.value)}
                      placeholder="21"
                      className="w-12 text-xs font-semibold text-stone-900 outline-none bg-transparent"
                    />
                    <span className="text-[10px] text-stone-400">°C</span>
                  </div>

                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-blue-600 font-bold">Min :</span>
                    <input
                      type="number"
                      step="0.1"
                      value={temperatureMin}
                      onChange={e => setTemperatureMin(e.target.value)}
                      placeholder="10"
                      className="w-10 text-xs text-stone-900 outline-none bg-transparent"
                    />
                    <span className="text-stone-300">/</span>
                    <span className="text-[10px] text-red-600 font-bold">Max :</span>
                    <input
                      type="number"
                      step="0.1"
                      value={temperatureMax}
                      onChange={e => setTemperatureMax(e.target.value)}
                      placeholder="24"
                      className="w-10 text-xs text-stone-900 outline-none bg-transparent"
                    />
                    <span className="text-[10px] text-stone-400">°C</span>
                  </div>

                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200 shadow-2xs">
                    <Droplets className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] text-stone-500 font-medium">Pluie :</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={rainfall}
                      onChange={e => setRainfall(e.target.value)}
                      placeholder="0"
                      className="w-10 text-xs font-semibold text-blue-700 outline-none bg-transparent"
                    />
                    <span className="text-[10px] text-stone-400">mm</span>
                  </div>
                </div>
              </div>

              {/* Statut Réussite / Échec */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-stone-500">Statut :</span>
                <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-50">
                  <button
                    type="button"
                    onClick={() => setNewEntrySuccessStatus('none')}
                    className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-all ${
                      newEntrySuccessStatus === 'none'
                        ? 'bg-white text-stone-800 shadow-xs border border-stone-200/60'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    ⚪ Neutre
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEntrySuccessStatus('success')}
                    className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1 ${
                      newEntrySuccessStatus === 'success'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-stone-500 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Réussite
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEntrySuccessStatus('failure')}
                    className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1 ${
                      newEntrySuccessStatus === 'failure'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-stone-500 hover:text-red-700'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Échec
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Express Bottom Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <label className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors text-xs font-medium">
                <Camera className="w-3.5 h-3.5 text-stone-500" />
                <span>Photo{photos.length > 0 ? ` (${photos.length})` : ''}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={e => handlePhotoUpload(e, false)} 
                />
              </label>

              <button
                type="button"
                onClick={handleFetchCurrentWeather}
                disabled={isFetchingWeather}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                title="Récupérer la météo en direct en 1 clic"
              >
                <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isFetchingWeather ? 'animate-spin' : ''}`} />
                <span>{isFetchingWeather ? 'Météo...' : 'Météo auto'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFormOptions(prev => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  showFormOptions || title || newEntrySuccessStatus !== 'none' || weatherCondition
                    ? 'bg-stone-100 border-stone-300 text-stone-900 font-semibold'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
                title="Afficher les champs complémentaires (Titre, Météo manuelle, Statut)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showFormOptions ? 'Moins d\'options' : '+ Options'}</span>
              </button>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="ml-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Enregistrer</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Compact 1-line interactive Quick Prompt Bar when collapsed */
        <button
          type="button"
          onClick={() => {
            setIsFormOpen(true);
            setTimeout(() => quickInputRef.current?.focus(), 60);
          }}
          className="w-full bg-white hover:bg-stone-50/90 border border-stone-200/90 rounded-2xl p-2.5 sm:px-4 sm:py-2.5 text-left transition-all shadow-xs flex items-center justify-between gap-3 group cursor-pointer hover:border-emerald-300"
        >
          <div className="flex items-center gap-2.5 text-stone-500 text-xs truncate">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
              ✍️
            </span>
            <span className="truncate">Rédiger ou dicter une observation...</span>
          </div>
          <span className="px-2.5 py-1 bg-emerald-600 group-hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1 shadow-2xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Saisie rapide</span>
          </span>
        </button>
      )}

      {/* View Switcher & Streamlined Filters Bar */}
      <div className="bg-white p-3 rounded-2xl shadow-xs border border-stone-200/80 space-y-2.5">
        {/* Row 1: View Mode Switcher & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* View Switcher */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200/70 text-xs font-semibold">
            <button
              onClick={() => handleSetView('table')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === 'table' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Vue registre mensuel synthétique (vue par défaut)"
            >
              <Table className="w-3.5 h-3.5 text-emerald-600" />
              <span>Registre</span>
            </button>
            <button
              onClick={() => handleSetView('list')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === 'list' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Vue détaillée sous forme de fiches"
            >
              <AlignJustify className="w-3.5 h-3.5 text-emerald-600" />
              <span>Liste</span>
            </button>
            <button
              onClick={() => handleSetView('calendar')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === 'calendar' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Vue calendrier mensuel interactif"
            >
              <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
              <span>Calendrier</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Rechercher (plante, mot-clé, suivi, date...)" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: 1-Click Quick Chips + Advanced Dates Drawer Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Source quick chips */}
            <div className="inline-flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200/70">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  filterType === 'all' ? 'bg-white text-stone-900 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Tout
              </button>
              <button
                type="button"
                onClick={() => setFilterType('journal')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  filterType === 'journal' ? 'bg-white text-blue-800 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Journal
              </button>
              <button
                type="button"
                onClick={() => setFilterType('seedling')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  filterType === 'seedling' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Semis & Arbres
              </button>
            </div>

            {/* Notes avec suivi uniquement */}
            <button
              type="button"
              onClick={() => setFilterWithUpdatesOnly(prev => !prev)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                filterWithUpdatesOnly
                  ? 'bg-amber-100 border-amber-300 text-amber-950 font-semibold'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-amber-50 hover:text-amber-800'
              }`}
              title="Afficher uniquement les notes ayant des mises à jour de suivi"
            >
              <History className="w-3 h-3 text-amber-600" />
              <span>Suivi ({entriesWithUpdatesCount})</span>
            </button>

            {/* Réussites / Échecs chips */}
            <button
              type="button"
              onClick={() => setFilterSuccess(prev => prev === 'success' ? 'all' : 'success')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                filterSuccess === 'success'
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-semibold'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Réussites</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterSuccess(prev => prev === 'failure' ? 'all' : 'failure')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                filterSuccess === 'failure'
                  ? 'bg-red-100 border-red-300 text-red-900 font-semibold'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-red-50'
              }`}
            >
              <XCircle className="w-3 h-3 text-red-600" />
              <span>Échecs</span>
            </button>

            {/* Advanced Dates / Season / Tags Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                showAdvancedFilters || isDateFilterActive || filterSeason !== 'all' || filterTag !== 'all'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Calendar className="w-3 h-3 text-emerald-600" />
              <span>Dates & Filtres</span>
              {(isDateFilterActive || filterSeason !== 'all' || filterTag !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Quick Reset when any filter is active */}
            {(isDateFilterActive || filterType !== 'all' || filterSuccess !== 'all' || filterWithUpdatesOnly || filterSeason !== 'all' || filterTag !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  handleResetDateFilters();
                  setFilterType('all');
                  setFilterSuccess('all');
                  setFilterWithUpdatesOnly(false);
                  setFilterSeason('all');
                  setFilterTag('all');
                  setSearchTerm('');
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-stone-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Réinitialiser tous les filtres"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-stone-500 font-semibold">
            {filteredEntries.length} entrée{filteredEntries.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Row 3: Collapsible Advanced Date, Season, Tag & Sort Filters */}
        {showAdvancedFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-100 text-xs animate-fade-in">
            <button
              type="button"
              onClick={handleResetDateFilters}
              className={`px-2 py-0.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                !isDateFilterActive 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/80'
              }`}
            >
              Toutes dates
            </button>

            {/* Critère de date : Origine ou MÀJ */}
            <select
              value={filterDateScope}
              onChange={e => setFilterDateScope(e.target.value as 'all' | 'origin' | 'update')}
              className={`px-2 py-0.5 text-xs font-medium rounded-lg border outline-none cursor-pointer transition-colors ${
                filterDateScope !== 'all'
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                  : 'bg-white border-stone-200 text-stone-700'
              }`}
              title="Choisir si le filtre de date s'applique à la date d'origine, à la date de mise à jour, ou aux deux"
            >
              <option value="all">Origine ou MÀJ</option>
              <option value="origin">Date d'origine</option>
              <option value="update">Date de MÀJ</option>
            </select>

            {/* Date exacte */}
            <div className="inline-flex items-center gap-1">
              <input
                type="date"
                value={filterExactDate}
                onChange={e => setFilterExactDate(e.target.value)}
                title="Rechercher une date précise (selon critère Origine ou MÀJ)"
                className={`px-2 py-0.5 text-xs font-medium rounded-lg border outline-none cursor-pointer transition-colors ${
                  filterExactDate
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                    : 'bg-white border-stone-200 text-stone-700'
                }`}
              />
              {filterExactDate && (
                <button
                  type="button"
                  onClick={() => setFilterExactDate('')}
                  className="p-0.5 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                  title="Effacer la date précise"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Année */}
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className={`px-2 py-0.5 text-xs font-medium rounded-lg border outline-none cursor-pointer transition-colors ${
                filterYear !== 'all' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' 
                  : 'bg-white border-stone-200 text-stone-700'
              }`}
            >
              <option value="all">Toutes les années</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>Année {yr}</option>
              ))}
            </select>

            {/* Trimestre */}
            <select
              value={filterQuarter}
              onChange={e => handleQuarterChange(e.target.value)}
              className={`px-2 py-0.5 text-xs font-medium rounded-lg border outline-none cursor-pointer transition-colors ${
                filterQuarter !== 'all' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' 
                  : 'bg-white border-stone-200 text-stone-700'
              }`}
            >
              <option value="all">Tous les trimestres</option>
              {JOURNAL_QUARTERS.map(q => (
                <option key={q.value} value={q.value}>{q.shortLabel || q.label}</option>
              ))}
            </select>

            {/* Mois */}
            <select
              value={filterMonth}
              onChange={e => handleMonthChange(e.target.value)}
              className={`px-2 py-0.5 text-xs font-medium rounded-lg border outline-none cursor-pointer transition-colors ${
                filterMonth !== 'all' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' 
                  : 'bg-white border-stone-200 text-stone-700'
              }`}
            >
              <option value="all">Tous les mois</option>
              {JOURNAL_MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            {/* Season filter */}
            <select 
              value={filterSeason} 
              onChange={e => setFilterSeason(e.target.value)}
              className={`px-2 py-0.5 text-xs font-medium rounded-lg border outline-none cursor-pointer transition-colors ${
                filterSeason !== 'all' 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' 
                  : 'bg-white border-stone-200 text-stone-700'
              }`}
            >
              <option value="all">Toutes les saisons</option>
              {seasons.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Tag filter */}
            {availableJournalTags.length > 0 && (
              <select 
                value={filterTag} 
                onChange={e => setFilterTag(e.target.value)}
                className={`px-2 py-0.5 text-xs font-medium rounded-lg border outline-none cursor-pointer transition-colors ${
                  filterTag !== 'all'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                    : 'bg-white border-stone-200 text-stone-700'
                }`}
                title="Filtrer par tag d'activité"
              >
                <option value="all">Tous les tags</option>
                {availableJournalTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}

            {/* Sort order */}
            <select 
              value={sortOrder} 
              onChange={e => setSortOrder(e.target.value as 'desc' | 'asc' | 'alpha')}
              className="px-2 py-0.5 text-xs font-medium rounded-lg border border-stone-200 bg-white text-stone-700 outline-none cursor-pointer"
            >
              <option value="desc">Plus récent (MÀJ incluse)</option>
              <option value="asc">Plus ancien</option>
              <option value="alpha">A → Z</option>
            </select>
          </div>
        )}
      </div>

      {activeView === 'list' && (
        <div className="space-y-3">
          {filteredEntries.length === 0 ? (
          <div className="text-center py-6 bg-white rounded-xl border border-stone-200 border-dashed">
            <BookOpen className="w-6 h-6 text-stone-300 mx-auto mb-1.5" />
            <h3 className="text-sm font-medium text-stone-900">Aucune entrée trouvée</h3>
            <p className="text-xs text-stone-500 mt-0.5">Modifiez vos filtres ou ajoutez une nouvelle note.</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div key={entry.id} className="bg-white p-3 rounded-xl shadow-sm border border-stone-200/60 flex gap-3 group">
              {editingId === entry.id ? (
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      required
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="px-2 py-1 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  {editingEntryType === 'journal' && (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      placeholder="Titre de la note (optionnel)"
                      className="w-full px-2 py-1 text-xs font-medium rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none placeholder:text-stone-400"
                    />
                  )}
                  <VoiceDictationControl
                    value={editContent}
                    onChange={setEditContent}
                    compact
                  />
                  <textarea 
                    required
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  />
                  {editPhotos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {editPhotos.map((photo, index) => (
                        <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0">
                          <img src={photo} alt="Aperçu" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => setEditPhotos(prev => prev.filter((_, i) => i !== index))}
                            className="absolute top-1 right-1 p-0.5 bg-white/80 hover:bg-white rounded-full text-stone-700 shadow-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Edit success status selector */}
                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-stone-100">
                    <span className="text-[11px] font-medium text-stone-500">Statut :</span>
                    <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-50">
                      <button
                        type="button"
                        onClick={() => setEditSuccessStatus('none')}
                        className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all ${
                          editSuccessStatus === 'none'
                            ? 'bg-white text-stone-800 shadow-xs border border-stone-200/60'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        ⚪ Sans statut
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditSuccessStatus('success')}
                        className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1 ${
                          editSuccessStatus === 'success'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-stone-500 hover:text-emerald-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Réussite
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditSuccessStatus('failure')}
                        className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1 ${
                          editSuccessStatus === 'failure'
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'text-stone-500 hover:text-red-700'
                        }`}
                      >
                        <XCircle className="w-3 h-3" />
                        Échec
                      </button>
                    </div>
                  </div>

                  {editingEntryType === 'journal' && (
                    <>
                      {/* Inline edit tags */}
                      <div className="space-y-1 pt-1 border-t border-stone-100">
                        <span className="text-[11px] font-semibold text-stone-700 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-emerald-600" />
                          <span>Tags d'activités :</span>
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {availableJournalTags.map(tag => {
                            const isSelected = editTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleToggleEditTag(tag)}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-emerald-50 hover:text-emerald-800'
                                }`}
                              >
                                <span>{tag}</span>
                                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Inline edit weather */}
                      <div className="space-y-1.5 pt-1 border-t border-stone-100 bg-stone-50/50 p-2 rounded-lg">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-stone-700 flex items-center gap-1">
                            <CloudRain className="w-3 h-3 text-blue-500" />
                            <span>Météo :</span>
                          </span>
                          {editWeatherCondition && (
                            <button
                              type="button"
                              onClick={() => setEditWeatherCondition('')}
                              className="text-[10px] text-stone-400 hover:text-stone-600 underline cursor-pointer"
                            >
                              Effacer
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1">
                          {effectiveWeatherIndicators.map(opt => {
                            const isSelected = editWeatherCondition === `${opt.emoji} ${opt.label}` ||
                              (editWeatherCondition.includes(opt.label) && editWeatherCondition.includes(opt.emoji));
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleToggleEditWeatherOption(opt)}
                                className={`px-1.5 py-0.5 rounded text-[11px] font-medium flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                                  isSelected ? opt.activeClass : opt.colorClass
                                }`}
                              >
                                <span>{opt.emoji}</span>
                                <span className="truncate">{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-stone-200/50 text-[11px]">
                          <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-stone-200">
                            <Thermometer className="w-3 h-3 text-orange-500" />
                            <span className="text-[10px] text-stone-500">T°:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={editTemperature}
                              onChange={e => setEditTemperature(e.target.value)}
                              placeholder="20"
                              className="w-10 text-[11px] font-semibold text-stone-900 outline-none"
                            />
                            <span className="text-[10px] text-stone-400">°C</span>
                          </div>
                          <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-stone-200">
                            <Droplets className="w-3 h-3 text-blue-500" />
                            <span className="text-[10px] text-stone-500">Pluie:</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={editRainfall}
                              onChange={e => setEditRainfall(e.target.value)}
                              placeholder="0"
                              className="w-10 text-[11px] font-semibold text-blue-700 outline-none"
                            />
                            <span className="text-[10px] text-stone-400">mm</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between items-center pt-1">
                    <label className="cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors">
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Modifier photo(s)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => handlePhotoUpload(e, true)} 
                      />
                    </label>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={handleCancelEdit}
                        className="px-2 py-1 text-[11px] text-stone-600 hover:bg-stone-100 rounded-lg font-medium transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Annuler
                      </button>
                      <button 
                        onClick={() => handleSaveEdit(entry.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-[11px] font-medium shadow-sm transition-colors flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    const sortedUpdates = getSortedUpdates(entry.updates);
                    const latestDateStr = entry.latestDate || getNoteLatestDate(entry.date, sortedUpdates);
                    const displayDate = parseSafeDate(latestDateStr) || new Date(entry.date);
                    const hasUpdates = sortedUpdates.length > 0;
                    const datesDiffer = hasUpdates && toDateKey(latestDateStr) !== toDateKey(entry.date);

                    return (
                      <div className="w-14 shrink-0 text-center">
                        <div className="text-xl font-serif font-medium text-emerald-600 leading-none">
                          {displayDate.getDate()}
                        </div>
                        <div className="text-[9px] font-medium text-stone-500 uppercase tracking-wider mt-0.5">
                          {displayDate.toLocaleString('fr-FR', { month: 'short', year: 'numeric' })}
                        </div>
                        {hasUpdates && (
                          <div className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold">
                            <History className="w-2.5 h-2.5" />
                            <span>MÀJ</span>
                          </div>
                        )}
                        {datesDiffer && (
                          <div className="text-[9px] text-stone-400 mt-0.5 leading-tight" title={`Note créée le ${formatDateShortFR(entry.date)}`}>
                            Orig. {formatDateShortFR(entry.date)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex-1 border-l border-stone-100 pl-3 space-y-2">
                    {entry.type === 'journal' && (
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-100 rounded-full text-[10px] font-medium">
                          Journal
                        </span>
                        {entry.hasDuplicate && (
                          <button
                            type="button"
                            onClick={() => setIsDuplicatesModalOpen(true)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 rounded-full text-[10px] font-semibold transition-colors cursor-pointer"
                            title="Cette note a été détectée en doublon (cliquer pour inspecter et gérer)"
                          >
                            <Copy className="w-3 h-3 text-amber-600" />
                            <span>Doublon détecté</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCycleJournalSuccess(entry)}
                          title="Cliquer pour changer le statut (Réussite / Échec / Sans statut)"
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-all ${
                            entry.success === true
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : entry.success === false
                              ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                              : 'bg-stone-100 text-stone-500 hover:bg-stone-200/60'
                          }`}
                        >
                          {entry.success === true && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {entry.success === false && <XCircle className="w-3 h-3 text-red-600" />}
                          {entry.success === true ? 'Réussite' : entry.success === false ? 'Échec' : 'Sans statut'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFollowUpEntrySnapshot(entry)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                          title="Ajouter ou gérer les mises à jour datées de cette note"
                        >
                          <History className="w-3 h-3 text-amber-600" />
                          <span>
                            {(entry.updates?.length || 0) > 0
                              ? `Suivi (${entry.updates!.length}) • + MÀJ`
                              : '+ Suivi'}
                          </span>
                        </button>
                        {(() => {
                          const linkedPerpetual = perpetualTasks.find(p => 
                            p.sourceNoteId === entry.id || 
                            (p.sourceNoteDate === entry.date && p.description === entry.content)
                          );
                          if (linkedPerpetual) {
                            return (
                              <div className="inline-flex items-center">
                                <button
                                  type="button"
                                  onClick={() => handleEditPerpetual(linkedPerpetual)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 border-r-0 hover:bg-purple-100 rounded-l-full text-[10px] font-medium transition-colors"
                                  title="Geste enregistré au planning perpétuel (cliquer pour modifier)"
                                >
                                  <CalendarClock className="w-3 h-3 text-purple-600" />
                                  <span>Au planning : {linkedPerpetual.title}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCurrentView('calendar-perpetual')}
                                  className="inline-flex items-center px-1.5 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 border-r-0 hover:bg-purple-200/80 transition-colors"
                                  title="Accéder directement au planning perpétuel"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePerpetualDirect(linkedPerpetual.id)}
                                  className="inline-flex items-center px-1.5 py-0.5 bg-purple-50 text-purple-400 border border-purple-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-r-full transition-colors"
                                  title="Retirer ce geste du planning perpétuel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenPerpetualModal(entry)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                                entry.success === true
                                  ? 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100 font-semibold'
                                  : 'bg-stone-50 text-stone-500 border border-stone-200 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-200'
                              }`}
                              title="Ajouter ce geste au planning perpétuel récurrent pour les années suivantes"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              <span>Au planning perpétuel</span>
                            </button>
                          );
                        })()}
                      </div>
                    )}
                    {entry.type !== 'journal' && (
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-medium">
                          {entry.type === 'seedling' ? 'Semis/Plant' : 'Arbre'}
                        </span>
                        {entry.type === 'seedling' && (
                          <button 
                            onClick={() => setCurrentView(`seedling-detail-${entry.sourceId}`)}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                          >
                            Voir la fiche : {entry.sourceName}
                          </button>
                        )}
                        {entry.noteId ? (
                          <button
                            type="button"
                            onClick={() => handleCycleJournalSuccess(entry)}
                            title="Cliquer pour changer le statut (Réussite / Échec / Sans statut)"
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-all cursor-pointer ${
                              entry.success === true
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : entry.success === false
                                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                : 'bg-stone-100 text-stone-500 hover:bg-stone-200/60'
                            }`}
                          >
                            {entry.success === true && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {entry.success === false && <XCircle className="w-3 h-3 text-red-600" />}
                            {entry.success === true ? 'Réussite' : entry.success === false ? 'Échec' : 'Sans statut'}
                          </button>
                        ) : (
                          <>
                            {entry.type === 'seedling' && entry.success === true && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-medium">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Réussite
                              </span>
                            )}
                            {entry.type === 'seedling' && entry.success === false && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-[10px] font-medium" title={entry.failureReason ? `Raison : ${entry.failureReason}` : undefined}>
                                <XCircle className="w-3 h-3 text-red-600" />
                                Échec{entry.failureReason ? ` : ${entry.failureReason}` : ''}
                              </span>
                            )}
                          </>
                        )}
                        {entry.type === 'tree' && (
                          <span className="text-[10px] text-stone-500 font-medium">
                            {entry.sourceName}
                          </span>
                        )}
                        {entry.noteId && (
                          <button
                            type="button"
                            onClick={() => setFollowUpEntrySnapshot(entry)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                            title="Ajouter ou gérer les mises à jour datées de cette note"
                          >
                            <History className="w-3 h-3 text-amber-600" />
                            <span>
                              {(entry.updates?.length || 0) > 0
                                ? `Suivi (${entry.updates!.length}) • + MÀJ`
                                : '+ Suivi'}
                            </span>
                          </button>
                        )}
                        {(() => {
                          const linkedPerpetual = perpetualTasks.find(p => 
                            p.sourceNoteId === entry.id || 
                            (p.sourceNoteDate === entry.date && p.description === entry.content)
                          );
                          if (linkedPerpetual) {
                            return (
                              <div className="inline-flex items-center">
                                <button
                                  type="button"
                                  onClick={() => handleEditPerpetual(linkedPerpetual)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 border-r-0 hover:bg-purple-100 rounded-l-full text-[10px] font-medium transition-colors"
                                  title="Geste enregistré au planning perpétuel (cliquer pour modifier)"
                                >
                                  <CalendarClock className="w-3 h-3 text-purple-600" />
                                  <span>Au planning : {linkedPerpetual.title}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCurrentView('calendar-perpetual')}
                                  className="inline-flex items-center px-1.5 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 border-r-0 hover:bg-purple-200/80 transition-colors"
                                  title="Accéder directement au planning perpétuel"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePerpetualDirect(linkedPerpetual.id)}
                                  className="inline-flex items-center px-1.5 py-0.5 bg-purple-50 text-purple-400 border border-purple-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-r-full transition-colors"
                                  title="Retirer ce geste du planning perpétuel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenPerpetualModal(entry)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                                entry.success === true
                                  ? 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100 font-semibold'
                                  : 'bg-stone-50 text-stone-500 border border-stone-200 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-200'
                              }`}
                              title="Ajouter ce geste au planning perpétuel récurrent pour les années suivantes"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              <span>Au planning perpétuel</span>
                            </button>
                          );
                        })()}
                      </div>
                    )}
                    {entry.title && (
                      <h3 className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                        {entry.title}
                      </h3>
                    )}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 my-1">
                        {entry.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                          >
                            <span>{tag}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {(entry.weatherCondition || entry.temperature !== undefined || entry.rainfall !== undefined) && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50/80 text-blue-900 border border-blue-200/80 my-1">
                        {entry.weatherCondition && <span>{entry.weatherCondition}</span>}
                        {entry.temperature !== undefined && (
                          <span className={entry.temperature <= 0 ? 'text-cyan-700 font-bold' : entry.temperature >= 28 ? 'text-rose-600 font-bold' : 'text-stone-800 font-semibold'}>
                            {entry.temperature > 0 ? `+${entry.temperature}` : entry.temperature}°C
                          </span>
                        )}
                        {(entry.temperatureMin !== undefined || entry.temperatureMax !== undefined) && (
                          <span className="text-[10px] text-stone-500 font-normal">
                            ({entry.temperatureMin !== undefined ? `${entry.temperatureMin}°` : ''}{entry.temperatureMin !== undefined && entry.temperatureMax !== undefined ? ' / ' : ''}{entry.temperatureMax !== undefined ? `${entry.temperatureMax}°` : ''})
                          </span>
                        )}
                        {entry.rainfall !== undefined && entry.rainfall > 0 && (
                          <span className="text-blue-700 font-medium flex items-center gap-0.5">
                            <Droplets className="w-3 h-3 text-blue-500" />
                            <span>{entry.rainfall} mm</span>
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-stone-800 whitespace-pre-wrap">{entry.content}</p>
                    {(() => {
                      const sortedUpdates = getSortedUpdates(entry.updates);
                      if (sortedUpdates.length === 0) return null;
                      return (
                        <div className="mt-2 pl-3 border-l-2 border-amber-300 space-y-1.5 bg-amber-50/40 py-2 pr-2.5 rounded-r-xl">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                            <History className="w-3 h-3" />
                            <span>Suivi chronologique ({sortedUpdates.length})</span>
                          </div>
                          {sortedUpdates.map(u => (
                            <div key={u.id} className="text-xs text-stone-800">
                              <span className="inline-block font-bold text-[10px] text-amber-950 bg-white border border-amber-200 px-1.5 py-0.2 rounded mr-1.5">
                                {formatDateShortFR(u.date)}
                              </span>
                              <span className="whitespace-pre-wrap">{u.text}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {entry.photos && entry.photos.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {entry.photos.map((photo, index) => (
                          <img key={index} src={photo} alt="Photo du journal" className="rounded-lg max-h-40 object-cover border border-stone-200" />
                        ))}
                      </div>
                    )}
                  </div>
                  {(entry.type === 'journal' || Boolean(entry.noteId && entry.sourceId)) && (
                    <div className="flex flex-col gap-0.5 opacity-100 sm:opacity-70 sm:group-hover:opacity-100 transition-all shrink-0 self-start">
                      <button 
                        type="button"
                        onClick={() => handleStartEdit(entry)}
                        className="p-1.5 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {entry.type === 'journal' && (
                        <button 
                          type="button"
                          onClick={() => handleDelete(entry.id, entry.type)}
                          className="p-1.5 text-stone-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Mettre à la corbeille"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
      )}

      {activeView === 'table' && (
        <JournalTableView 
          entries={filteredEntries}
          perpetualTasks={perpetualTasks}
          onStartEdit={handleStartEdit}
          onOpenFollowUp={(entry) => setFollowUpEntrySnapshot(entry)}
          onDelete={handleDelete}
          onCycleSuccess={handleCycleJournalSuccess}
          onOpenPerpetualModal={handleOpenPerpetualModal}
          onEditPerpetual={handleEditPerpetual}
          onDeletePerpetual={handleDeletePerpetualDirect}
          setCurrentView={setCurrentView}
        />
      )}

      {activeView === 'calendar' && (
        <JournalCalendarView 
          entries={filteredEntries}
          perpetualTasks={perpetualTasks}
          onStartEdit={handleStartEdit}
          onOpenFollowUp={(entry) => setFollowUpEntrySnapshot(entry)}
          onDelete={handleDelete}
          onCycleSuccess={handleCycleJournalSuccess}
          onOpenPerpetualModal={handleOpenPerpetualModal}
          onEditPerpetual={handleEditPerpetual}
          onDeletePerpetual={handleDeletePerpetualDirect}
          setCurrentView={setCurrentView}
          onSelectDateForNewEntry={(selectedDate) => {
            setDate(selectedDate);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      <JournalEditModal
        isOpen={modalEditingEntry !== null}
        onClose={() => setModalEditingEntry(null)}
        entry={modalEditingEntry}
        onDelete={handleDelete}
        availableTags={availableJournalTags}
        rawSeedlings={rawSeedlings}
        rawTrees={rawTrees}
      />

      {activeFollowUpEntry && (
        <NoteFollowUpModal
          isOpen={activeFollowUpEntry !== null}
          onClose={() => setFollowUpEntrySnapshot(null)}
          title={activeFollowUpEntry.title}
          sourceLabel={
            activeFollowUpEntry.type === 'journal'
              ? 'Journal du potager'
              : activeFollowUpEntry.sourceName
          }
          originDate={activeFollowUpEntry.date}
          originText={activeFollowUpEntry.content}
          updates={activeFollowUpEntry.updates || []}
          onSaveUpdates={(nextUpdates) => handleSaveEntryUpdates(activeFollowUpEntry, nextUpdates)}
          successStatus={
            activeFollowUpEntry.success === true
              ? 'success'
              : activeFollowUpEntry.success === false
              ? 'failure'
              : 'none'
          }
          onChangeSuccessStatus={(next) => handleSetEntrySuccessStatus(activeFollowUpEntry, next)}
          onOpenEdit={() => {
            const target = activeFollowUpEntry;
            setFollowUpEntrySnapshot(null);
            setModalEditingEntry(target);
          }}
        />
      )}

      <PerpetualTaskModal
        isOpen={isPerpetualModalOpen}
        onClose={() => {
          setIsPerpetualModalOpen(false);
          setPerpetualModalData(undefined);
        }}
        initialData={perpetualModalData}
      />

      {/* Module d'impression du Journal du Potager */}
      <JournalPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        entries={entries || []}
        filteredEntries={filteredEntries}
        seasons={seasons}
        currentSeasonId={currentSeasonId}
        activeFilterSeason={filterSeason}
        activeSearchTerm={searchTerm}
        activeFilterYear={filterYear}
        activeFilterQuarter={filterQuarter}
        activeFilterMonth={filterMonth}
      />

      {/* Modal d'inspection et de gestion des doublons */}
      <JournalDuplicatesModal
        isOpen={isDuplicatesModalOpen}
        onClose={() => setIsDuplicatesModalOpen(false)}
        duplicateGroups={duplicateGroups}
        onDeleteEntry={handleDeleteDuplicateEntry}
        onKeepOnlyThisEntry={handleKeepOnlyThisDuplicate}
        onCleanAllDuplicates={handleCleanDuplicates}
        isProcessing={isCleaningDuplicates}
      />

      {/* Modal Relevé Météo & Températures */}
      <WeatherReadingModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
      />

      {/* Guide & Calendrier des Multiplications (Boutures, Marcottages, Divisions) */}
      <MultiplicationGuideModal
        isOpen={isMultiplicationModalOpen}
        onClose={() => setIsMultiplicationModalOpen(false)}
      />

      {/* Modal d'intégration externe (Export & Import 4 colonnes : Date, Description, Commentaire, Statut) */}
      <JournalIntegrationModal
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
        entries={entries || []}
        seasons={seasons}
        currentSeasonId={currentSeasonId}
      />
    </div>
  );
}
