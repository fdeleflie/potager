import { Seedling } from '../db';

/**
 * Returns the last photo from the notes if available, otherwise returns the main seedling photo.
 */
export const getSeedlingDisplayPhoto = (seedling: Seedling): string | undefined => {
  if (seedling.notes && seedling.notes.length > 0) {
    // Iterate notes from newest to oldest
    const sortedNotes = [...seedling.notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (const note of sortedNotes) {
      if (note.photos && note.photos.length > 0) {
        // Return the last photo of the most recent note that has photos
        return note.photos[note.photos.length - 1];
      }
    }
  }
  return seedling.photo;
};
