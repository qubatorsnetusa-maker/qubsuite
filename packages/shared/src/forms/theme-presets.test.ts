import { describe, expect, it } from 'vitest';
import { themeExtrasSchema, THEME_FONT_PAIRS } from '../schemas/forms';
import { presetById, THEME_PRESETS } from './theme-presets';

describe('THEME_PRESETS', () => {
  it('has ten presets with unique ids and names', () => {
    expect(THEME_PRESETS).toHaveLength(10);
    expect(new Set(THEME_PRESETS.map((p) => p.id)).size).toBe(10);
    expect(new Set(THEME_PRESETS.map((p) => p.name)).size).toBe(10);
  });

  it('every preset is a valid extras payload', () => {
    for (const p of THEME_PRESETS) {
      expect(THEME_FONT_PAIRS).toContain(p.fontPair);
      expect(p.primaryColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.backgroundColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.questionColor).toMatch(/^#[0-9a-f]{6}$/);
      const parsed = themeExtrasSchema.safeParse({
        preset: p.id,
        questionColor: p.questionColor,
        fontPair: p.fontPair,
        background: p.background,
        buttonRadius: p.buttonRadius,
      });
      expect(parsed.success, `${p.id}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('gradient presets always carry both stops', () => {
    for (const p of THEME_PRESETS.filter((x) => x.background?.kind === 'gradient')) {
      expect(p.background!.from, p.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.background!.to, p.id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('question text clears WCAG AA against its background', () => {
    // Relative luminance per WCAG 2.1; a gradient is checked against its darkest stop.
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    for (const p of THEME_PRESETS) {
      const stops = p.background?.kind === 'gradient' ? [p.background.from!, p.background.to!] : [p.backgroundColor];
      for (const bg of stops) expect(ratio(p.questionColor, bg), `${p.id} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('presetById finds a preset and returns undefined for anything else', () => {
    expect(presetById('midnight')?.name).toBe('Midnight');
    expect(presetById('nope')).toBeUndefined();
    expect(presetById(undefined)).toBeUndefined();
  });
});
