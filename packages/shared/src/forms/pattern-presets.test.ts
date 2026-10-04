import { describe, expect, it } from 'vitest';
import { PATTERN_PRESETS, PRESET_CATEGORIES, presetForPattern } from './pattern-presets';
import { isSafePattern } from './validation';

describe('pattern presets', () => {
  it('are safe, compile, and accept their own example', () => {
    expect(PATTERN_PRESETS.length).toBe(17);
    for (const p of PATTERN_PRESETS) {
      expect(isSafePattern(p.pattern), p.id).toBe(true);
      expect(new RegExp(p.pattern).test(p.example), p.id).toBe(true);
      expect(PRESET_CATEGORIES).toContain(p.category);
      expect(p.message.length).toBeGreaterThan(0);
      expect(p.message.length).toBeLessThanOrEqual(200);
    }
  });

  it('have unique ids and patterns', () => {
    expect(new Set(PATTERN_PRESETS.map((p) => p.id)).size).toBe(PATTERN_PRESETS.length);
    expect(new Set(PATTERN_PRESETS.map((p) => p.pattern)).size).toBe(PATTERN_PRESETS.length);
  });

  it('reject typical wrong answers', () => {
    const re = (id: string) => new RegExp(PATTERN_PRESETS.find((p) => p.id === id)!.pattern);
    expect(re('work_email').test('sam@gmail.com')).toBe(false);
    expect(re('uk_postcode').test('12345')).toBe(false);
    expect(re('slug').test('My Post')).toBe(false);
    expect(re('hex_color').test('#12')).toBe(false);
  });

  it('finds a preset by its exact pattern only', () => {
    const zip = PATTERN_PRESETS.find((p) => p.id === 'us_zip')!;
    expect(presetForPattern(zip.pattern)).toBe(zip);
    expect(presetForPattern(`${zip.pattern} `)).toBeNull();
    expect(presetForPattern(undefined)).toBeNull();
    expect(presetForPattern('')).toBeNull();
  });
});
