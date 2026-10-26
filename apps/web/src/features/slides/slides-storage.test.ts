import { beforeEach, describe, expect, it } from 'vitest';
import {
  getStoredDecks,
  getDeckById,
  saveDeck,
  createDeckFromTemplate,
  deleteDeck,
  addSlideToDeck,
  duplicateSlideInDeck,
  removeSlideFromDeck,
  reorderSlidesInDeck,
} from './slides-storage';

describe('slides-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with starter decks if empty', () => {
    const decks = getStoredDecks();
    expect(decks.length).toBeGreaterThan(0);
    expect(decks[0]!.title).toBeDefined();
  });

  it('creates a deck from template and saves it', () => {
    const deck = createDeckFromTemplate('pitch', 'Investor Day 2026');
    expect(deck.title).toBe('Investor Day 2026');
    expect(deck.slides.length).toBe(5);

    const retrieved = getDeckById(deck.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(deck.id);
  });

  it('adds, duplicates, reorders, and deletes slides in a deck', () => {
    let deck = createDeckFromTemplate('blank', 'Interactive Deck');
    expect(deck.slides).toHaveLength(1);

    // Add slide
    deck = addSlideToDeck(deck, 'two-column');
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[1]!.layout).toBe('two-column');

    // Duplicate slide
    deck = duplicateSlideInDeck(deck, 1);
    expect(deck.slides).toHaveLength(3);
    expect(deck.slides[2]!.title).toContain('(Copy)');

    // Reorder slides (move slide 2 to 0)
    deck = reorderSlidesInDeck(deck, 2, 0);
    expect(deck.slides[0]!.title).toContain('(Copy)');

    // Remove slide
    deck = removeSlideFromDeck(deck, 0);
    expect(deck.slides).toHaveLength(2);

    // Delete deck
    deleteDeck(deck.id);
    expect(getDeckById(deck.id)).toBeNull();
  });
});
