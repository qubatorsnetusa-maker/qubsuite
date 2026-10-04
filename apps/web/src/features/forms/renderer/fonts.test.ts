import { THEME_FONT_PAIRS } from '@qub/shared';
import { describe, expect, it, vi } from 'vitest';
import { __resetLoadedFonts, BODY_STACK, FONT_PAIRS, fontPairById, loadFontFamilies } from './fonts';

describe('FONT_PAIRS', () => {
  it('covers every ThemeFontPair exactly once', () => {
    expect(FONT_PAIRS.map((p) => p.id).sort()).toEqual([...THEME_FONT_PAIRS].sort());
  });

  it('gives every pair a quoted family and a generic tail', () => {
    for (const p of FONT_PAIRS) {
      expect(p.heading, p.id).toMatch(/^'.+'$/);
      expect(p.body, p.id).toMatch(/^'.+'$/);
      expect(p.headingTail.length, p.id).toBeGreaterThan(0);
      expect(p.families.length, p.id).toBeGreaterThan(0);
    }
  });

  it('never falls a sans heading back to a serif', () => {
    for (const id of ['inter', 'grotesk', 'dm'] as const) {
      expect(fontPairById(id)!.headingTail).toBe(BODY_STACK);
    }
  });

  it('fontPairById returns undefined for an unset or unknown pair', () => {
    expect(fontPairById(undefined)).toBeUndefined();
    // @ts-expect-error - guarding the runtime path a stale API value could take
    expect(fontPairById('comic')).toBeUndefined();
  });
});

describe('loadFontFamilies', () => {
  it('loads each family only once', async () => {
    __resetLoadedFonts();
    const spy = vi.fn(async () => undefined);
    loadFontFamilies(['inter', 'inter', 'lora'], { inter: spy, lora: spy } as never);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('swallows a failed load and allows a retry', async () => {
    __resetLoadedFonts();
    const boom = vi.fn(async () => { throw new Error('offline'); });
    loadFontFamilies(['inter'], { inter: boom } as never);
    await vi.waitFor(() => expect(boom).toHaveBeenCalledTimes(1));
    loadFontFamilies(['inter'], { inter: boom } as never);
    await vi.waitFor(() => expect(boom).toHaveBeenCalledTimes(2));
  });
});
