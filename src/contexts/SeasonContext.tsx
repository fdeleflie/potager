import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db, Season } from '../db';

interface SeasonContextType {
  seasons: Season[];
  currentSeasonId: string | null;
  setCurrentSeasonId: (id: string) => void;
  createNewSeason: (name?: string) => Promise<string | undefined>;
  updateSeason: (id: string, name: string) => Promise<void>;
  deleteSeason: (id: string) => Promise<void>;
  getSuggestedNextName: (existingSeasons?: Season[]) => string;
  isLoading: boolean;
  isItemInCurrentSeason: (item: any) => boolean;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeasonId, setCurrentSeasonIdState] = useState<string | null>(() => {
    return localStorage.getItem('selected_season_id') || null;
  });
  const [mergedIdMap, setMergedIdMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('merged_season_id_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const setCurrentSeasonId = (id: string) => {
    setCurrentSeasonIdState(id);
    localStorage.setItem('selected_season_id', id);
  };

  const loadSeasons = async () => {
    try {
      let allSeasons: Season[] = [];
      try {
        allSeasons = await db.seasons.toArray();
      } catch (e) {
        console.warn("Could not fetch seasons directly, fallback to local cache", e);
      }
      
      if (!allSeasons || allSeasons.length === 0) {
        // Migration/Initialization
        try {
          const newSeasonId = await db.seasons.add({
            name: 'Saison 2025/2026',
            startDate: new Date().toISOString()
          });
          
          const createdSeason = await db.seasons.get(newSeasonId);
          if (createdSeason) {
            setSeasons([createdSeason]);
            setCurrentSeasonId(newSeasonId);
          } else {
            const fallback = { id: newSeasonId || 'season-2025-2026', name: 'Saison 2025/2026', startDate: new Date().toISOString() };
            setSeasons([fallback]);
            setCurrentSeasonId(fallback.id);
          }
        } catch (e: any) {
          console.warn("Using local fallback season:", e);
          const mockSeason = { id: 'season-2025-2026', name: 'Saison 2025/2026', startDate: new Date().toISOString() };
          setSeasons([mockSeason]);
          setCurrentSeasonId('season-2025-2026');
        }
      } else {
        // Deduplicate seasons by name
        // Sort chronologically ascending to keep the earliest created as the primary canonical season
        const chronological = [...allSeasons].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        const uniqueList: Season[] = [];
        const duplicatesToDelete: string[] = [];
        const newMergedMap: Record<string, string> = {};

        for (const s of chronological) {
          const norm = (s.name || '').trim().toLowerCase();
          const existing = uniqueList.find(u => (u.name || '').trim().toLowerCase() === norm);
          if (existing) {
            duplicatesToDelete.push(s.id);
            newMergedMap[s.id] = existing.id;
          } else {
            uniqueList.push(s);
          }
        }

        // Clean up duplicate season records from Firestore in the background
        if (duplicatesToDelete.length > 0) {
          for (const dupId of duplicatesToDelete) {
            try {
              await db.seasons.delete(dupId);
            } catch (err) {
              console.warn('Could not delete duplicate season record:', dupId, err);
            }
          }
        }

        let combinedMap = { ...newMergedMap };
        try {
          const saved = localStorage.getItem('merged_season_id_map');
          if (saved) {
            combinedMap = { ...JSON.parse(saved), ...combinedMap };
          }
          localStorage.setItem('merged_season_id_map', JSON.stringify(combinedMap));
        } catch (e) {
          console.warn("Could not save merged map to localStorage", e);
        }

        setMergedIdMap(combinedMap);

        // Sort descending by start date for display in selectors
        const sorted = uniqueList.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        setSeasons(sorted);

        // Determine current season
        const savedSeasonId = localStorage.getItem('selected_season_id');
        const resolvedSavedId = savedSeasonId && combinedMap[savedSeasonId] ? combinedMap[savedSeasonId] : savedSeasonId;
        const exists = savedSeasonId === 'all' || sorted.some(s => s.id === resolvedSavedId);

        if (savedSeasonId === 'all') {
          setCurrentSeasonId('all');
        } else if (exists && resolvedSavedId) {
          setCurrentSeasonId(resolvedSavedId);
        } else if (sorted.length > 0) {
          setCurrentSeasonId(sorted[0].id);
        }
      }
    } catch (err) {
      console.warn("Handled season load fallback:", err);
      if (seasons.length === 0) {
        const fallback = { id: 'season-2025-2026', name: 'Saison 2025/2026', startDate: new Date().toISOString() };
        setSeasons([fallback]);
        setCurrentSeasonId(fallback.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSeasons();
  }, []);

  const getSuggestedNextName = (existingSeasons: Season[] = seasons) => {
    let highestYear = 2025;
    for (const s of existingSeasons) {
      const matches = s.name.match(/\d{4}/g);
      if (matches) {
        for (const m of matches) {
          const y = parseInt(m, 10);
          if (!isNaN(y) && y > highestYear) {
            highestYear = y;
          }
        }
      }
    }
    return `Saison ${highestYear}/${highestYear + 1}`;
  };

  const createNewSeason = async (name?: string): Promise<string | undefined> => {
    const defaultName = getSuggestedNextName(seasons);
    const finalName = (name || defaultName).trim();
    
    // Check if a season with this name already exists
    const existing = seasons.find(s => s.name.trim().toLowerCase() === finalName.toLowerCase());
    if (existing) {
      setCurrentSeasonId(existing.id);
      return existing.id;
    }

    const newSeasonId = await db.seasons.add({
      name: finalName,
      startDate: new Date().toISOString()
    });
    
    await loadSeasons();
    setCurrentSeasonId(newSeasonId);
    return newSeasonId;
  };

  const updateSeason = async (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await db.seasons.update(id, { name: trimmed });
    await loadSeasons();
  };

  const deleteSeason = async (id: string) => {
    if (seasons.length <= 1) {
      throw new Error("Impossible de supprimer la seule saison active.");
    }
    await db.seasons.delete(id);
    await loadSeasons();
  };

  const isItemInCurrentSeason = (item: any): boolean => {
    if (!item) return false;
    // If "all seasons" is selected, include every record
    if (currentSeasonId === 'all') return true;
    if (currentSeasonId === 'mock-season') return true;
    if (!currentSeasonId) return true;

    const currentSeason = seasons.find(s => s.id === currentSeasonId);

    // 1. Direct ID match or mapped duplicate ID match
    const rawSeasonId = item.seasonId ? String(item.seasonId) : null;
    const resolvedSeasonId = rawSeasonId ? (mergedIdMap[rawSeasonId] || rawSeasonId) : null;

    if (resolvedSeasonId && resolvedSeasonId === currentSeasonId) {
      return true;
    }

    // 2. Name-based match if seasonId happens to be the name
    if (rawSeasonId && currentSeason && rawSeasonId.toLowerCase() === currentSeason.name.toLowerCase()) {
      return true;
    }

    // 3. If item points explicitly to ANOTHER known season that exists in the database
    if (resolvedSeasonId && seasons.some(s => s.id === resolvedSeasonId)) {
      return false; // Belongs to a different existing season
    }

    // 4. If item has no seasonId OR its seasonId was an orphaned/deleted duplicate ID:
    // If there is only one season configured, everything belongs to this season
    if (seasons.length <= 1) {
      return true;
    }

    // If multiple seasons exist, check the date of the item to see if it matches the current season's years
    const itemDateStr = item.dateSown || item.dateTransplanted || item.datePlanted || item.date || item.createdAt;
    if (itemDateStr) {
      const yearMatch = String(itemDateStr).match(/\d{4}/);
      if (yearMatch) {
        const itemYear = yearMatch[0];
        // If current season's name includes this year (e.g. "Saison 2025/2026" contains "2025" and "2026")
        if (currentSeason && currentSeason.name.includes(itemYear)) {
          return true;
        }
        // If another existing season explicitly matches this year, it belongs to that other season
        const matchingOtherSeason = seasons.find(s => s.id !== currentSeasonId && s.name.includes(itemYear));
        if (matchingOtherSeason) {
          return false;
        }
      }
    }

    // Fallback: If no dates or unresolved, associate with the canonical/latest season
    if (currentSeason && seasons.length > 0 && currentSeason.id === seasons[0].id) {
      return true;
    }

    return false;
  };

  return (
    <SeasonContext.Provider value={{ seasons, currentSeasonId, setCurrentSeasonId, createNewSeason, updateSeason, deleteSeason, getSuggestedNextName, isLoading, isItemInCurrentSeason }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const context = useContext(SeasonContext);
  if (context === undefined) {
    throw new Error('useSeason must be used within a SeasonProvider');
  }
  return context;
}
