import type { NoteUpdate } from '../db';

export function isSystemLogNote(note: any): boolean {
  if (!note) return false;
  if (note.isSystemLog === true) return true;
  if (!note.text) return false;
  
  // Normalize string to strip accents (é -> e, etc.)
  const t = String(note.text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (
    t.includes('lot scinde') ||
    t.includes('cree par scission') ||
    t.includes('par scission') ||
    t.includes('scission') ||
    t.includes('ont ete extraits') ||
    t.includes('a ete extrait') ||
    t.includes('extrait de') ||
    t.includes('extraits vers') ||
    t.includes('extraits suite') ||
    t.includes('lot archive') ||
    t.includes('archive comme perte') ||
    t.includes('archive suite') ||
    t.includes('perte totale') ||
    t.includes('perte de') ||
    t.includes('vente/don') ||
    t.includes('vente ou don') ||
    t.includes('a ete donnee') ||
    t.includes('a ete donne') ||
    t.includes('a ete vendue') ||
    t.includes('a ete vendu') ||
    t.includes('totalite du lot') ||
    t.includes('plants donnes') ||
    t.includes('plants vendus') ||
    t.includes('don de plant') ||
    t.includes('donne a un') ||
    t.includes('donne a une') ||
    t.includes('donne a ') ||
    t.includes('donnee a ') ||
    t.includes('donne au ') ||
    t.includes('donnee au ') ||
    t.includes('vendu au ') ||
    t.includes('vendue au ') ||
    t.includes('vendu a ') ||
    t.includes('vendue a ')
  ) {
    return true;
  }
  return false;
}

export function shouldPublishNoteToJournal(note: any): boolean {
  if (!note) return false;
  if (note.publishToJournal === false) return false;
  if (note.isSystemLog === true) return false;
  if (isSystemLogNote(note)) return false;
  if (note.publishToJournal === true) return true;
  return true;
}

/**
 * Parse a YYYY-MM-DD or ISO date string into a local Date without UTC off-by-one day shift.
 */
export function parseSafeDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const y = Number(ymdMatch[1]);
    const m = Number(ymdMatch[2]) - 1;
    const d = Number(ymdMatch[3]);
    const dt = new Date(y, m, d, 12, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(trimmed);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Extract a YYYY-MM-DD key in local calendar terms.
 */
export function toDateKey(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  const ymdMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymdMatch) return ymdMatch[1];
  const d = parseSafeDate(trimmed);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateShortFR(dateStr?: string | null): string {
  const d = parseSafeDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function getSortedUpdates(updates?: NoteUpdate[]): NoteUpdate[] {
  if (!Array.isArray(updates) || updates.length === 0) return [];
  return [...updates]
    .filter(u => u && (u.text || '').trim().length > 0 && u.date)
    .sort((a, b) => {
      const ta = parseSafeDate(a.date)?.getTime() ?? 0;
      const tb = parseSafeDate(b.date)?.getTime() ?? 0;
      return ta - tb;
    });
}

export function getNoteLatestDate(originDate: string, updates?: NoteUpdate[]): string {
  const sorted = getSortedUpdates(updates);
  if (sorted.length === 0) return originDate;
  let latestStr = originDate;
  let latestTime = parseSafeDate(originDate)?.getTime() ?? 0;
  for (const u of sorted) {
    const ut = parseSafeDate(u.date)?.getTime() ?? 0;
    if (ut >= latestTime) {
      latestTime = ut;
      latestStr = u.date;
    }
  }
  return latestStr;
}

export function matchesSingleDateFilter(
  dateStr: string,
  filterYear: string,
  filterQuarter: string,
  filterMonth: string,
  filterExactDate: string
): boolean {
  const d = parseSafeDate(dateStr);
  if (!d) return false;

  if (filterExactDate && toDateKey(dateStr) !== filterExactDate) {
    return false;
  }

  if (filterYear !== 'all' && d.getFullYear().toString() !== filterYear) {
    return false;
  }

  const monthNum = d.getMonth() + 1;
  if (filterQuarter !== 'all') {
    const q = monthNum <= 3 ? 'Q1' : monthNum <= 6 ? 'Q2' : monthNum <= 9 ? 'Q3' : 'Q4';
    if (q !== filterQuarter) return false;
  }

  if (filterMonth !== 'all' && monthNum.toString() !== filterMonth) {
    return false;
  }

  return true;
}

export function matchesDateSearchQuery(
  searchLower: string,
  originDate: string,
  updates?: NoteUpdate[]
): boolean {
  if (!searchLower) return false;
  const candidates = [originDate, ...(updates || []).map(u => u.date)];
  return candidates.some(dtStr => {
    if (!dtStr) return false;
    const key = toDateKey(dtStr).toLowerCase();
    const fr = formatDateShortFR(dtStr).toLowerCase();
    return key.includes(searchLower) || fr.includes(searchLower);
  });
}

