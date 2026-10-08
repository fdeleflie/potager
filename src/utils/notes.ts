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
