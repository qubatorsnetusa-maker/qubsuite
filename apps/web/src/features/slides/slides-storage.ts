import type { PresentationDeck, SlideItem, SlideLayout, SlideTheme } from './slides-types';
import { createDefaultSlide } from './slides-types';
import { STARTER_TEMPLATES } from './slide-templates';

const STORAGE_KEY = 'qub.slides.decks';

export function getStoredDecks(): PresentationDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed with sample starter decks
      const initial = [
        STARTER_TEMPLATES.pitch!.deck,
        STARTER_TEMPLATES.strategy!.deck,
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [STARTER_TEMPLATES.pitch!.deck];
  }
}

export function getDeckById(deckId: string): PresentationDeck | null {
  const decks = getStoredDecks();
  return decks.find((d) => d.id === deckId) ?? null;
}

export function saveDeck(deck: PresentationDeck): void {
  try {
    const decks = getStoredDecks();
    const idx = decks.findIndex((d) => d.id === deck.id);
    const updated = { ...deck, updatedAt: new Date().toISOString() };
    if (idx !== -1) {
      decks[idx] = updated;
    } else {
      decks.unshift(updated);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch {
    // localstorage error or quota
  }
}

export function createDeckFromTemplate(templateKey: string = 'blank', customTitle?: string): PresentationDeck {
  const template = STARTER_TEMPLATES[templateKey] ?? STARTER_TEMPLATES.blank!;
  const newId = `deck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newDeck: PresentationDeck = {
    ...JSON.parse(JSON.stringify(template.deck)),
    id: newId,
    title: customTitle || (templateKey === 'blank' ? 'Untitled Presentation' : template.deck.title),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveDeck(newDeck);
  return newDeck;
}

export function deleteDeck(deckId: string): void {
  try {
    const decks = getStoredDecks().filter((d) => d.id !== deckId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch {
    // quota
  }
}

export function addSlideToDeck(deck: PresentationDeck, layout: SlideLayout = 'title-content', afterIndex?: number): PresentationDeck {
  const newSlide = createDefaultSlide(layout, deck.slides.length);
  const updatedSlides = [...deck.slides];
  if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < updatedSlides.length) {
    updatedSlides.splice(afterIndex + 1, 0, newSlide);
  } else {
    updatedSlides.push(newSlide);
  }
  const updatedDeck = { ...deck, slides: updatedSlides };
  saveDeck(updatedDeck);
  return updatedDeck;
}

export function duplicateSlideInDeck(deck: PresentationDeck, slideIndex: number): PresentationDeck {
  const target = deck.slides[slideIndex];
  if (!target) return deck;
  const clone: SlideItem = {
    ...JSON.parse(JSON.stringify(target)),
    id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: `${target.title} (Copy)`,
  };
  const updatedSlides = [...deck.slides];
  updatedSlides.splice(slideIndex + 1, 0, clone);
  const updatedDeck = { ...deck, slides: updatedSlides };
  saveDeck(updatedDeck);
  return updatedDeck;
}

export function removeSlideFromDeck(deck: PresentationDeck, slideIndex: number): PresentationDeck {
  if (deck.slides.length <= 1) return deck; // keep at least 1 slide
  const updatedSlides = deck.slides.filter((_, idx) => idx !== slideIndex);
  const updatedDeck = { ...deck, slides: updatedSlides };
  saveDeck(updatedDeck);
  return updatedDeck;
}

export function reorderSlidesInDeck(deck: PresentationDeck, fromIndex: number, toIndex: number): PresentationDeck {
  if (fromIndex < 0 || fromIndex >= deck.slides.length || toIndex < 0 || toIndex >= deck.slides.length) {
    return deck;
  }
  const updatedSlides = [...deck.slides];
  const [removed] = updatedSlides.splice(fromIndex, 1);
  if (removed) {
    updatedSlides.splice(toIndex, 0, removed);
  }
  const updatedDeck = { ...deck, slides: updatedSlides };
  saveDeck(updatedDeck);
  return updatedDeck;
}
