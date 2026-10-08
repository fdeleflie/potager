import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, JournalEntry } from '../db';
import { useFirebaseData, fb, syncPriorityCollections } from '../hooks/useFirebaseData';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, Plus, Save, Trash2, Search, Filter, Edit, X, Camera, CheckCircle2, XCircle, CalendarClock, CalendarPlus, Printer, RotateCcw, Calendar, AlignJustify, Table, CalendarDays, ExternalLink, Sparkles, RefreshCw, Zap, Copy, AlertTriangle, Eye, Tag, Settings, Thermometer, CloudRain, Droplets, Scissors } from 'lucide-react';
import { ConfirmModal } from '../components/Modals';
import { JournalPrintModal } from '../components/JournalPrintModal';
import { compressImage } from '../utils/image';
import { shouldPublishNoteToJournal } from '../utils/notes';
import { PerpetualTask, ConfigItem, EncyclopediaEntry } from '../db';
import { PerpetualTaskModal, MONTH_NAMES, PERIOD_LABELS } from '../components/PerpetualTaskModal';
import { JournalTableView } from '../components/JournalTableView';
import { JournalCalendarView } from '../components/JournalCalendarView';
import { JournalEditModal } from '../components/JournalEditModal';
import { JournalDuplicatesModal, DuplicateGroup } from '../components/JournalDuplicatesModal';
import { JournalRetrospective } from '../components/JournalRetrospective';
import { WeatherReadingModal } from '../components/WeatherReadingModal';
import { MultiplicationGuideModal } from '../components/MultiplicationGuideModal';
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
  title?: string;
  tags?: string[];
  date: string;
  content: string;
  photos?: string[];
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
  const [photos, setPhotos] = useState<string[]>([]);
  const [newEntrySuccessStatus, setNewEntrySuccessStatus] = useState<'none' | 'success' | 'failure'>('none');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date filters: Année, Trimestre, Mois (ou Tout)
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

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

  // Quick form & retrospective collapse states to avoid scrolling
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRetrospectiveOpen, setIsRetrospectiveOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [autoWeatherFeedback, setAutoWeatherFeedback] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
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
            title: n.title || `${s.vegetable} (${s.variety || 'Semis'})`,
            date: n.date,
            content: n.text,
            photos: n.photos,
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
          combined.push({
            id: `${s.id}-bilan`,
            title: `Bilan : ${s.vegetable} (${s.variety || 'Semis'})`,
            date: s.dateHarvested || s.datePlanted || s.dateTransplanted || s.dateSown || s.createdAt || new Date().toISOString().split('T')[0],
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
            title: n.title || `${t.species} (${t.variety || 'Arbre'})`,
            date: n.date,
            content: n.text,
            isDeleted: false,
            type: 'tree',
            sourceId: t.id,
            sourceName: `${t.species} - ${t.variety || 'Sans variété'}`,
            seasonId: t.seasonId
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

    return Array.from(uniqueMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawJournalEntries, rawSeedlings, rawTrees, duplicateGroups, showDuplicatesOnly]);

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

      const entry: JournalEntry = {
        id: uuidv4(),
        title: title.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        date,
        content: content.trim(),
        photos,
        isDeleted: false,
        seasonId: (currentSeasonId && currentSeasonId !== 'all') ? currentSeasonId : seasons[0]?.id,
        successStatus: newEntrySuccessStatus,
        success: newEntrySuccessStatus === 'success' ? true : newEntrySuccessStatus === 'failure' ? false : undefined,
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
      setPhotos([]);
      setNewEntrySuccessStatus('none');
      setWeatherCondition('');
      setTemperature('');
      setTemperatureMin('');
      setTemperatureMax('');
      setRainfall('');
      setIsFormOpen(false);
      setSaveFeedback("Observation enregistrée avec succès dans le registre !");
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err) {
      console.error('Erreur enregistrement note journal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (entry: CombinedEntry) => {
    if (entry.type !== 'journal') return;
    if (activeView === 'list') {
      setEditingId(entry.id);
      setEditTitle(entry.title || '');
      setEditTags(entry.tags || []);
      setEditContent(entry.content);
      setEditDate(entry.date);
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
    await fb.update("journal", id, {
      title: editTitle.trim() || undefined,
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
    setEditingId(null);
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

  const handleCycleJournalSuccess = async (id: string, currentSuccess?: boolean) => {
    const nextStatus: 'none' | 'success' | 'failure' =
      currentSuccess === true ? 'failure' :
      currentSuccess === false ? 'none' : 'success';
    await fb.update("journal", id, {
      successStatus: nextStatus,
      success: nextStatus === 'success' ? true : nextStatus === 'failure' ? false : undefined
    });
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
      const d = new Date(e.date);
      if (!isNaN(d.getTime())) {
        yearSet.add(d.getFullYear().toString());
      }
    });
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const retrospectiveNotesCount = React.useMemo(() => {
    if (!entries || entries.length === 0) return 0;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    return entries.filter(e => {
      const d = new Date(e.date);
      if (!isNaN(d.getTime())) return false;
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
  };

  const isDateFilterActive = filterYear !== 'all' || filterQuarter !== 'all' || filterMonth !== 'all';

  const filteredEntries = (entries || []).filter(e => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
                          (e.title ? e.title.toLowerCase().includes(searchLower) : false) ||
                          e.content.toLowerCase().includes(searchLower) ||
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

    if (!matchesSeason || !matchesSuccess || !matchesType || !matchesSearch) return false;

    // Temporal date filtering: Année, Trimestre, Mois
    const d = new Date(e.date);
    if (isNaN(d.getTime())) return false;

    if (filterYear !== 'all') {
      if (d.getFullYear().toString() !== filterYear) return false;
    }

    const monthNum = d.getMonth() + 1; // 1 to 12
    if (filterQuarter !== 'all') {
      const q = monthNum <= 3 ? 'Q1' : monthNum <= 6 ? 'Q2' : monthNum <= 9 ? 'Q3' : 'Q4';
      if (q !== filterQuarter) return false;
    }

    if (filterMonth !== 'all') {
      if (monthNum.toString() !== filterMonth) return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortOrder === 'alpha') {
      return a.content.localeCompare(b.content);
    }
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
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

      {/* Header with Title and Action Toolbar */}
      <header className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-stone-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-2xs">
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
            <p className="text-xs text-stone-500">Registre d'observations, relevés météo & calendrier perpétuel</p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
          {/* Main New Note Toggle Button */}
          <button
            type="button"
            onClick={() => setIsFormOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isFormOpen
                ? 'bg-stone-800 hover:bg-stone-900 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
            title={isFormOpen ? 'Fermer le formulaire de saisie' : 'Ouvrir la saisie d\'une nouvelle note'}
          >
            {isFormOpen ? (
              <>
                <X className="w-4 h-4" />
                <span>Fermer la saisie</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Nouvelle observation</span>
              </>
            )}
          </button>

          {/* Quick Weather Reading Modal */}
          <button
            type="button"
            onClick={() => setIsWeatherModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl transition shadow-2xs text-xs font-semibold cursor-pointer"
            title="Ajouter rapidement un relevé météo / pluviomètre / température du jour"
          >
            <Thermometer className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Relevé Météo</span>
            <span className="sm:hidden">Météo</span>
          </button>

          {/* Retrospective Button */}
          <button
            type="button"
            onClick={() => setIsRetrospectiveOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl transition shadow-2xs text-xs font-semibold cursor-pointer ${
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

          {/* Plant Multiplication Guide Button */}
          <button
            type="button"
            onClick={() => setCurrentView('calendar-multiplications')}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl transition shadow-2xs text-xs font-semibold cursor-pointer"
            title="Consulter le calendrier des multiplications (boutures, marcottes, divisions) adapté à vos plantes"
          >
            <Scissors className="w-3.5 h-3.5 text-teal-600" />
            <span className="hidden sm:inline">Multiplications</span>
            <span className="sm:hidden">Boutures</span>
            {activeMultiplicationsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-teal-200 text-teal-900">
                {activeMultiplicationsCount}
              </span>
            )}
          </button>

          {/* Planning perpétuel shortcut */}
          <button
            type="button"
            onClick={() => setCurrentView('calendar-perpetual')}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl transition shadow-2xs text-xs font-medium cursor-pointer"
            title="Accéder directement au planning perpétuel"
          >
            <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
            <span>Planning perpétuel</span>
          </button>

          {/* Print modal */}
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl transition shadow-2xs text-xs font-medium cursor-pointer"
            title="Imprimer le registre ou journal"
          >
            <Printer className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden md:inline">Imprimer</span>
          </button>

          {/* Priority sync */}
          <button
            type="button"
            onClick={handlePrioritySync}
            disabled={isSyncingPriority}
            className="p-2 text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 border border-stone-200 rounded-xl transition cursor-pointer"
            title="Synchroniser le Journal et le Perpétuel"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPriority ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
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

      {/* Collapsible New Observation Card */}
      {isFormOpen ? (
        <form onSubmit={handleSave} className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-200 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <h2 className="text-sm font-bold text-stone-800">Rédiger une observation ou note</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs text-stone-400 hover:text-stone-700 flex items-center gap-1 underline cursor-pointer"
            >
              Masquer
            </button>
          </div>

          {/* Titre optionnel */}
          <input 
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titre de la note (optionnel : ex. Première récolte de courgettes, Taille des tomates...)"
            className="w-full px-3 py-1.5 text-xs font-medium rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-stone-400"
          />

          <textarea 
            required
            autoFocus
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none leading-relaxed"
            placeholder="Aujourd'hui au potager, j'ai observé / réalisé..."
          />

          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo, index) => (
                <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden border border-stone-200 shrink-0">
                  <img src={photo} alt="Aperçu" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                    className="absolute top-1 right-1 p-0.5 bg-white/80 hover:bg-white rounded-full text-stone-700 shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick Activity Tags */}
          <div className="space-y-1.5 pt-1 border-t border-stone-100">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-stone-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tags d'activités rapides :</span>
              </span>
              <button
                type="button"
                onClick={() => setCurrentView('config-journal_tag')}
                className="text-[11px] text-stone-500 hover:text-emerald-700 flex items-center gap-1 hover:underline cursor-pointer font-medium"
                title="Configurer les tags dans le menu Configuration"
              >
                <Settings className="w-3 h-3" />
                <span>Paramétrer</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {availableJournalTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 cursor-pointer border ${
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

          {/* Quick Weather Indicators & Temperature in 1 click */}
          <div className="space-y-2 pt-2 border-t border-stone-100 bg-stone-50/80 p-3 rounded-xl border border-stone-200/80">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-stone-700 flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                <span>Indicateurs météo (1 clic) :</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFetchCurrentWeather}
                  disabled={isFetchingWeather}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Récupérer la météo en direct et sélectionner l'indicateur automatiquement"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${isFetchingWeather ? 'animate-spin' : ''}`} />
                  <span>{isFetchingWeather ? 'Relevé en cours...' : weatherLocation ? `Météo auto (${weatherLocation})` : 'Météo auto (GPS)'}</span>
                </button>

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
            </div>

            {autoWeatherFeedback && (
              <div className="p-2 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs font-medium flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{autoWeatherFeedback}</span>
              </div>
            )}

            {/* 1-click Weather Indicators Grid */}
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

            {/* Inline Temperature & Rain readings */}
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
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-stone-100">
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

          <div className="flex justify-between items-center pt-2">
            <label className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors">
              <Camera className="w-3.5 h-3.5 text-stone-500" />
              <span className="text-xs font-medium">Ajouter photo(s)</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={e => handlePhotoUpload(e, false)} 
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button 
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Enregistrer dans le registre</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Compact 1-line interactive Quick Prompt Bar */
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="w-full bg-white hover:bg-stone-50/90 border border-stone-200/90 rounded-2xl p-2.5 sm:px-4 sm:py-2.5 text-left transition-all shadow-xs flex items-center justify-between gap-3 group cursor-pointer hover:border-emerald-300"
        >
          <div className="flex items-center gap-2.5 text-stone-500 text-xs truncate">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
              ✍️
            </span>
            <span className="truncate">Rédiger une observation, un geste ou noter la météo du jour...</span>
          </div>
          <span className="px-2.5 py-1 bg-emerald-600 group-hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1 shadow-2xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une note</span>
          </span>
        </button>
      )}

      {/* View Switcher & Filters Bar */}
      <div className="bg-white p-3 rounded-2xl shadow-xs border border-stone-200/80 space-y-2.5">
        {/* Row 1: View Mode Switcher & Search Bar in one line */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* View Switcher */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200/70 text-xs font-semibold">
            <button
              onClick={() => handleSetView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === 'table' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Vue registre mensuel synthétique (vue par défaut)"
            >
              <Table className="w-3.5 h-3.5 text-emerald-600" />
              <span>Registre mensuel</span>
            </button>
            <button
              onClick={() => handleSetView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === 'list' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Vue détaillée sous forme de fiches"
            >
              <AlignJustify className="w-3.5 h-3.5 text-emerald-600" />
              <span>Liste</span>
            </button>
            <button
              onClick={() => handleSetView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === 'calendar' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Vue calendrier mensuel interactif"
            >
              <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
              <span>Calendrier</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Rechercher (plante, variété, mot-clé, tag...)" 
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

        {/* Row 2: Date Filters Bar (Année, Trimestre, Mois, ou Tout) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-stone-600 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-600" />
              <span>Dates :</span>
            </span>

            {/* Bouton Tout */}
            <button
              type="button"
              onClick={handleResetDateFilters}
              className={`px-2 py-0.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                !isDateFilterActive 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/80'
              }`}
            >
              Tout
            </button>

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
              <option value="desc">Plus récent</option>
              <option value="asc">Plus ancien</option>
              <option value="alpha">A → Z</option>
            </select>
          </div>

          <div className="text-[11px] text-stone-500 font-semibold">
            {filteredEntries.length} entrée{filteredEntries.length > 1 ? 's' : ''}
          </div>
        </div>
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
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="Titre de la note (optionnel)"
                    className="w-full px-2 py-1 text-xs font-medium rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none placeholder:text-stone-400"
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
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-xl font-serif font-medium text-emerald-600 leading-none">
                      {new Date(entry.date).getDate()}
                    </div>
                    <div className="text-[9px] font-medium text-stone-500 uppercase tracking-wider mt-0.5">
                      {new Date(entry.date).toLocaleString('fr-FR', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
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
                          onClick={() => handleCycleJournalSuccess(entry.id, entry.success)}
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
                        {entry.type === 'tree' && (
                          <span className="text-[10px] text-stone-500 font-medium">
                            {entry.sourceName}
                          </span>
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
                    {entry.photos && entry.photos.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {entry.photos.map((photo, index) => (
                          <img key={index} src={photo} alt="Photo du journal" className="rounded-lg max-h-40 object-cover border border-stone-200" />
                        ))}
                      </div>
                    )}
                  </div>
                  {entry.type === 'journal' && (
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0 self-start">
                      <button 
                        onClick={() => handleStartEdit(entry)}
                        className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(entry.id, entry.type)}
                        className="p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Mettre à la corbeille"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
      />

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
    </div>
  );
}
