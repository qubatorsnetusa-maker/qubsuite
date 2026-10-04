import type { ThemeFontPair } from '@qub/shared';
import { useEffect } from 'react';

export type FontFamilyId = 'inter' | 'playfairDisplay' | 'lora' | 'dmSans' | 'spaceGrotesk' | 'spaceMono';

export const BODY_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const HEADING_STACK = "Georgia, 'Times New Roman', serif";
const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export interface FontPair {
  id: ThemeFontPair;
  name: string;
  heading: string;
  /** Generic tail after `heading` — a serif heading falls back to a serif, a sans to a sans. */
  headingTail: string;
  body: string;
  families: FontFamilyId[];
}

export const FONT_PAIRS: readonly FontPair[] = [
  { id: 'inter', name: 'Modern', heading: "'Inter'", headingTail: BODY_STACK, body: "'Inter'", families: ['inter'] },
  { id: 'playfair', name: 'Editorial', heading: "'Playfair Display'", headingTail: HEADING_STACK, body: "'Inter'", families: ['playfairDisplay', 'inter'] },
  { id: 'lora', name: 'Classic', heading: "'Lora'", headingTail: HEADING_STACK, body: "'Inter'", families: ['lora', 'inter'] },
  { id: 'grotesk', name: 'Geometric', heading: "'Space Grotesk'", headingTail: BODY_STACK, body: "'DM Sans'", families: ['spaceGrotesk', 'dmSans'] },
  { id: 'dm', name: 'Friendly', heading: "'DM Sans'", headingTail: BODY_STACK, body: "'DM Sans'", families: ['dmSans'] },
  { id: 'mono', name: 'Technical', heading: "'Space Mono'", headingTail: MONO_STACK, body: "'DM Sans'", families: ['spaceMono', 'dmSans'] },
  { id: 'playfairDm', name: 'Elegant', heading: "'Playfair Display'", headingTail: HEADING_STACK, body: "'DM Sans'", families: ['playfairDisplay', 'dmSans'] },
  { id: 'loraDm', name: 'Warm', heading: "'Lora'", headingTail: HEADING_STACK, body: "'DM Sans'", families: ['lora', 'dmSans'] },
];

export const fontPairById = (id: ThemeFontPair | undefined): FontPair | undefined => (id ? FONT_PAIRS.find((p) => p.id === id) : undefined);

type Loaders = Record<FontFamilyId, () => Promise<unknown>>;

/** Static specifiers so Vite can code-split each family into its own chunk. */
const LOADERS: Loaders = {
  inter: () => Promise.all([import('@fontsource/inter/400.css'), import('@fontsource/inter/600.css')]),
  playfairDisplay: () => Promise.all([import('@fontsource/playfair-display/400.css'), import('@fontsource/playfair-display/600.css')]),
  lora: () => Promise.all([import('@fontsource/lora/400.css'), import('@fontsource/lora/600.css')]),
  dmSans: () => Promise.all([import('@fontsource/dm-sans/400.css'), import('@fontsource/dm-sans/600.css')]),
  spaceGrotesk: () => Promise.all([import('@fontsource/space-grotesk/400.css'), import('@fontsource/space-grotesk/600.css')]),
  spaceMono: () => Promise.all([import('@fontsource/space-mono/400.css'), import('@fontsource/space-mono/700.css')]),
};

const loaded = new Set<FontFamilyId>();

/** Test seam — the module-level cache would otherwise leak between cases. */
export function __resetLoadedFonts(): void {
  loaded.clear();
}

export function loadFontFamilies(families: FontFamilyId[], loaders: Loaders = LOADERS): void {
  for (const f of families) {
    if (loaded.has(f)) continue;
    loaded.add(f);
    // A failed load un-caches itself so a later render can retry; the generic tail covers the gap.
    void loaders[f]().catch(() => loaded.delete(f));
  }
}

/**
 * Loads the families a pair needs. `inter` is always loaded: it is what `--font-sans` in index.css names
 * but nothing ever fetched, so a form with no pair still gets the font the app claims to use.
 */
export function useFontPair(pair: ThemeFontPair | undefined): void {
  useEffect(() => {
    loadFontFamilies(['inter', ...(fontPairById(pair)?.families ?? [])]);
  }, [pair]);
}
