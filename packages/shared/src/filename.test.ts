import { describe, expect, it } from 'vitest';
import { sanitizeFilename } from './filename';

describe('sanitizeFilename', () => {
  it('strips directories, reserved and control characters, and collapses spaces', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('Survey: Q3?')).toBe('Survey Q3');
    expect(sanitizeFilename('  a\u0007b   c  ')).toBe('ab c');
    expect(sanitizeFilename('...hidden...')).toBe('hidden');
  });

  it('falls back when nothing is left, and escapes Windows device names', () => {
    expect(sanitizeFilename('???', 'Untitled form')).toBe('Untitled form');
    expect(sanitizeFilename(null)).toBe('Untitled');
    expect(sanitizeFilename('con.txt')).toBe('_con.txt');
    expect(sanitizeFilename('nul')).toBe('_nul');
  });

  it('bounds the length, keeping a short extension', () => {
    const long = sanitizeFilename(`${'a'.repeat(300)}.pdf`);
    expect(long).toHaveLength(255);
    expect(long.endsWith('.pdf')).toBe(true);
    expect(sanitizeFilename(`${'a'.repeat(300)}.${'x'.repeat(30)}`)).toHaveLength(255);
  });

  it('is idempotent', () => {
    for (const s of ['Survey: Q3?', 'con', '  x  ', `${'b'.repeat(400)}.doc`]) expect(sanitizeFilename(sanitizeFilename(s))).toBe(sanitizeFilename(s));
  });
});
