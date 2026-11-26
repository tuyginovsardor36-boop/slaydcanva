import { Deck } from '../types/deck';
import { STARTER_DECK } from '../constants/starterDeck';

const DECKS_STORAGE_KEY = 'folio_presentation_decks_v1';
const ACTIVE_DECK_KEY = 'folio_active_deck_id_v1';

export function loadDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(DECKS_STORAGE_KEY);
    if (!raw) {
      return [STARTER_DECK];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [STARTER_DECK];
    }
    return parsed;
  } catch {
    return [STARTER_DECK];
  }
}

export function saveDecks(decks: Deck[]): void {
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(decks));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function loadActiveDeckId(decks: Deck[]): string {
  try {
    const saved = localStorage.getItem(ACTIVE_DECK_KEY);
    if (saved && decks.some((d) => d.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return decks[0]?.id ?? STARTER_DECK.id;
}

export function saveActiveDeckId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_DECK_KEY, id);
  } catch {
    // Ignore storage access errors
  }
}
