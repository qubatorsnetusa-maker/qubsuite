import type { FormFieldDto } from '@qub/shared';
import type { FormFieldType } from '@qub/shared';
import { describe, expect, it } from 'vitest';
import { answerText, displayValue, summarizeField } from './summarize';

let n = 0;
const opt = (id: string, label: string, kind: 'option' | 'row' | 'column' = 'option') => ({ id, label, kind, value: null, imageUrl: null, position: n++ });

function field(type: FormFieldType, overrides: Partial<FormFieldDto> = {}): FormFieldDto {
  return {
    id: `f-${type}`,
    ref: `ref_${type.toLowerCase()}`,
    type,
    label: type,
    description: null,
    required: false,
    position: 0,
    validation: {},
    settings: {},
    options: [],
    rules: [],
    scoreConfig: null,
    placeholder: null,
    defaultValue: null,
    ...overrides,
  } as FormFieldDto;
}

/** Every kind of junk an answer column could hold after type conversions, legacy data or a bad client. */
const JUNK: unknown[] = [undefined, null, '', '   ', [], {}, NaN, Infinity, -Infinity, 'abc', 42, true, false, ['a', 1, null, { x: 1 }], { label: 'Place' }, { line1: 7 }, { a: { b: 'c' } }, [[['deep']]], Symbol('s'), () => 1, 10n];

const colour = () => field('MULTIPLE_CHOICE', { options: [opt('red', 'Red'), opt('blue', 'Blue')] });

describe('summarizeField — choice', () => {
  it('counts each option id and puts unknown ids under other', () => {
    const s = summarizeField(colour(), ['red', 'blue', 'red', 'green', undefined, '']);
    expect(s).toEqual({
      kind: 'choice',
      total: 6,
      answered: 4,
      options: [
        { id: 'red', label: 'Red', count: 2 },
        { id: 'blue', label: 'Blue', count: 1 },
      ],
      other: 1,
    });
  });

  it('checkboxes count every selected option once per response', () => {
    const f = field('CHECKBOXES', { options: [opt('a', 'A'), opt('b', 'B')] });
    const s = summarizeField(f, [['a', 'b'], ['a', 'a'], ['zzz'], [], null]);
    expect(s).toMatchObject({ kind: 'choice', total: 5, answered: 3, other: 1 });
    expect(s.kind === 'choice' && s.options.map((o) => o.count)).toEqual([2, 1]);
  });

  it('picture choice and dropdown are choice summaries', () => {
    expect(summarizeField(field('IMAGE_CHOICE', { options: [opt('p', 'Pic')] }), [['p']]).kind).toBe('choice');
    expect(summarizeField(field('DROPDOWN', { options: [opt('d', 'D')] }), ['d']).kind).toBe('choice');
  });

  it('yes/no and consent are choice summaries over true/false', () => {
    const s = summarizeField(field('YES_NO'), [true, false, true, 'yes', null]);
    expect(s).toEqual({
      kind: 'choice',
      total: 5,
      answered: 4,
      options: [
        { id: 'true', label: 'Yes', count: 2 },
        { id: 'false', label: 'No', count: 1 },
      ],
      other: 1,
    });
    const c = summarizeField(field('CONSENT'), [true]);
    expect(c.kind === 'choice' && c.options.map((o) => o.label)).toEqual(['Agreed', 'Declined']);
  });

  it('a single-choice question holding an array (type changed) counts its string ids', () => {
    const s = summarizeField(colour(), [['red', 'blue']]);
    expect(s.kind === 'choice' && s.options.map((o) => o.count)).toEqual([1, 1]);
  });

  it('non-string answers to a choice question count as answered under other', () => {
    const s = summarizeField(colour(), [42, { x: 'y' }, true]);
    expect(s).toMatchObject({ kind: 'choice', answered: 3, other: 3 });
  });

  it('ignores options of other kinds and tolerates a missing options list', () => {
    const f = field('MULTIPLE_CHOICE', { options: [opt('r', 'Row', 'row'), opt('o', 'O')] });
    expect(summarizeField(f, ['o']).kind === 'choice' && (summarizeField(f, ['o']) as { options: unknown[] }).options).toHaveLength(1);
    const broken = field('MULTIPLE_CHOICE', { options: undefined as unknown as FormFieldDto['options'] });
    expect(summarizeField(broken, ['x'])).toMatchObject({ kind: 'choice', options: [], answered: 1, other: 1 });
  });
});

describe('summarizeField — numeric', () => {
  it('rating: count, average and one bucket per point of the scale (empty points included)', () => {
    const s = summarizeField(field('RATING', { settings: { scaleMax: 5 } }), [5, 4, 4, undefined, null, '']);
    expect(s).toMatchObject({ kind: 'numeric', total: 6, answered: 3, average: 13 / 3, min: 4, max: 5 });
    expect(s.kind === 'numeric' && s.buckets).toEqual([
      { label: '1', count: 0 },
      { label: '2', count: 0 },
      { label: '3', count: 0 },
      { label: '4', count: 2 },
      { label: '5', count: 1 },
    ]);
  });

  it.each(['LINEAR_SCALE', 'OPINION_SCALE', 'EMOJI_RATING'] as const)('%s is a numeric scale summary', (type) => {
    const s = summarizeField(field(type, { settings: { scaleMin: 1, scaleMax: 5 } }), [1, 3]);
    expect(s).toMatchObject({ kind: 'numeric', answered: 2, average: 2 });
    expect(s.kind === 'numeric' && s.buckets.length).toBeGreaterThan(0);
  });

  it('scale answers outside the scale, fractional or non-numeric are left out rather than bucketed wrongly', () => {
    const s = summarizeField(field('RATING', { settings: { scaleMax: 5 } }), [9, 2.5, -1, 'x', true, [3], { v: 3 }, NaN, 3]);
    expect(s).toMatchObject({ kind: 'numeric', answered: 1, average: 3, min: 3, max: 3 });
  });

  it('numeric strings (legacy text column) are read as numbers', () => {
    expect(summarizeField(field('NUMBER'), ['4', ' 6 ', 'four'])).toMatchObject({ kind: 'numeric', answered: 2, average: 5 });
  });

  it('number and slider bucket by distinct value when there are few', () => {
    const s = summarizeField(field('NUMBER'), [3, 1, 3, 2]);
    expect(s.kind === 'numeric' && s.buckets).toEqual([
      { label: '1', count: 1 },
      { label: '2', count: 1 },
      { label: '3', count: 2 },
    ]);
    expect(summarizeField(field('SLIDER'), [50])).toMatchObject({ kind: 'numeric', answered: 1, buckets: [{ label: '50', count: 1 }] });
  });

  it('number buckets many distinct values into at most 10 ranges that add up to the answered count', () => {
    const values = Array.from({ length: 100 }, (_, i) => i * 1.5);
    const s = summarizeField(field('NUMBER'), values);
    if (s.kind !== 'numeric') throw new Error('expected numeric');
    expect(s.buckets.length).toBe(10);
    expect(s.buckets.reduce((a, b) => a + b.count, 0)).toBe(100);
    expect(s.buckets[0]!.label).toBe('0–14.85');
  });

  it('extreme numbers whose spread overflows to Infinity still bucket, average and label sensibly', () => {
    const values: unknown[] = [-1e308, 1e308, 1, 2, 3, 4, 5, 6, 7, 8, 9, '1.7e308', '-1.7e308'];
    const s = summarizeField(field('NUMBER'), values);
    if (s.kind !== 'numeric') throw new Error('expected numeric');
    expect(s).toMatchObject({ answered: 13, min: -1.7e308, max: 1.7e308 });
    expect(Number.isFinite(s.average)).toBe(true);
    expect(s.buckets).toHaveLength(10);
    expect(s.buckets.reduce((a, b) => a + b.count, 0)).toBe(13);
    // Ranges of 3.4e307 from -1.7e308: -1.7e308 → 0, -1e308 → 2, 1..9 → 5 (the middle), 1e308 → 7, 1.7e308 → 9.
    expect(s.buckets.map((b) => b.count)).toEqual([1, 0, 1, 0, 0, 9, 0, 1, 0, 1]);
    for (const b of s.buckets) expect(b.label).not.toMatch(/Infinity|NaN/);
    expect(s.buckets[0]!.label).toBe('-1.70e+308–-1.36e+308');
  });

  it('many distinct values too close together to split fall back to one bucket', () => {
    const values = Array.from({ length: 12 }, (_, i) => 1e300 + i * 1e284);
    const s = summarizeField(field('NUMBER'), values);
    if (s.kind !== 'numeric') throw new Error('expected numeric');
    expect(s.buckets.reduce((a, b) => a + b.count, 0)).toBe(12);
    for (const b of s.buckets) expect(b.label).not.toMatch(/Infinity|NaN/);
  });

  it('ignores absurd scale settings instead of building a huge bucket list', () => {
    const s = summarizeField(field('LINEAR_SCALE', { settings: { scaleMin: 0, scaleMax: 1e9 } }), [2, 3]);
    expect(s).toMatchObject({ kind: 'numeric', answered: 2 });
    expect(s.kind === 'numeric' && s.buckets.length).toBeLessThanOrEqual(10);
    const inverted = summarizeField(field('LINEAR_SCALE', { settings: { scaleMin: 5, scaleMax: 1 } }), [2]);
    expect(inverted).toMatchObject({ kind: 'numeric', answered: 1 });
  });

  it('no answers → no average and empty scale buckets', () => {
    const s = summarizeField(field('RATING', { settings: { scaleMax: 3 } }), []);
    expect(s).toEqual({ kind: 'numeric', total: 0, answered: 0, average: null, min: null, max: null, buckets: [{ label: '1', count: 0 }, { label: '2', count: 0 }, { label: '3', count: 0 }] });
    expect(summarizeField(field('NUMBER'), [null])).toMatchObject({ answered: 0, average: null, buckets: [] });
  });
});

describe('summarizeField — nps', () => {
  it('splits promoters, passives and detractors and computes the score', () => {
    const s = summarizeField(field('NPS'), [10, 9, 8, 7, 6, 0, undefined]);
    expect(s).toMatchObject({ kind: 'nps', total: 7, answered: 6, promoters: 2, passives: 2, detractors: 2, score: 0 });
    expect(s.kind === 'nps' && s.buckets).toHaveLength(11);
  });

  it('rounds the score and ignores out-of-range answers', () => {
    const s = summarizeField(field('NPS'), [10, 10, 5, 11, -1, 7.5, '9']);
    expect(s).toMatchObject({ answered: 4, promoters: 3, detractors: 1, passives: 0, score: 50 });
  });

  it('no answers → score null', () => {
    expect(summarizeField(field('NPS'), [null, ''])).toMatchObject({ kind: 'nps', answered: 0, score: null });
  });
});

describe('summarizeField — text', () => {
  it('keeps the latest 10 non-empty answers, in the order given (newest first)', () => {
    const answers = ['', '  ', null, ...Array.from({ length: 12 }, (_, i) => `a${i}`)];
    const s = summarizeField(field('SHORT_ANSWER'), answers);
    expect(s).toMatchObject({ kind: 'text', total: 15, answered: 12 });
    expect(s.kind === 'text' && s.latest).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9']);
  });

  it.each(['PARAGRAPH', 'EMAIL', 'PHONE', 'URL', 'DATE', 'TIME', 'DATETIME', 'HIDDEN', 'ADDRESS', 'LOCATION'] as const)('%s is a text summary', (type) => {
    expect(summarizeField(field(type), ['x']).kind).toBe('text');
  });

  it('address objects are joined in address order, skipping empty and non-text parts', () => {
    const s = summarizeField(field('ADDRESS'), [{ country: 'UK', line1: '1 High St', city: '', region: 7, postalCode: { x: 1 } }, {}]);
    expect(s).toMatchObject({ kind: 'text', answered: 1, latest: ['1 High St, 7, UK'] });
  });

  it('locations show their label; numbers and booleans become text', () => {
    expect(summarizeField(field('LOCATION'), [{ label: 'Lagos', lat: 6.5, lng: 3.4 }])).toMatchObject({ latest: ['Lagos'] });
    expect(summarizeField(field('SHORT_ANSWER'), [12, false])).toMatchObject({ latest: ['12', 'false'] });
  });
});

describe('summarizeField — other', () => {
  it('matrix counts responses holding a non-empty answer', () => {
    const f = field('MATRIX', { options: [opt('r1', 'R1', 'row'), opt('c1', 'C1', 'column')] });
    expect(summarizeField(f, [{ r1: 'c1' }, {}, { r1: '' }, 'junk', null])).toEqual({ kind: 'other', total: 5, answered: 2 });
  });

  it.each(['RANKING', 'FILE_UPLOAD', 'SIGNATURE'] as const)('%s counts answered responses', (type) => {
    expect(summarizeField(field(type), [['a'], [], undefined])).toEqual({ kind: 'other', total: 3, answered: 1 });
  });

  it('an unknown field type falls back to an answered count', () => {
    expect(summarizeField(field('NOT_A_TYPE' as FormFieldType), ['x', null])).toEqual({ kind: 'other', total: 2, answered: 1 });
  });
});

describe('summarizeField — never throws (Review Focus 5)', () => {
  const types = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN', 'IMAGE_CHOICE', 'YES_NO', 'CONSENT', 'RATING', 'LINEAR_SCALE', 'OPINION_SCALE', 'EMOJI_RATING', 'SLIDER', 'NUMBER', 'NPS', 'SHORT_ANSWER', 'PARAGRAPH', 'EMAIL', 'DATE', 'ADDRESS', 'LOCATION', 'MATRIX', 'RANKING', 'FILE_UPLOAD', 'SIGNATURE', 'HIDDEN', 'STATEMENT'] as const;

  it.each(types)('%s survives every kind of malformed answer', (type) => {
    const s = summarizeField(field(type, { options: [opt('a', 'A')] }), JUNK);
    expect(s.total).toBe(JUNK.length);
    expect(s.answered).toBeGreaterThanOrEqual(0);
    expect(s.answered).toBeLessThanOrEqual(JUNK.length);
    if (s.kind === 'numeric') expect(Number.isNaN(s.average ?? 0)).toBe(false);
    if (s.kind === 'nps') expect(Number.isNaN(s.score ?? 0)).toBe(false);
  });

  it.each(types)('%s survives a non-array answers list and broken field settings', (type) => {
    const f = field(type, { settings: null as unknown as FormFieldDto['settings'], options: null as unknown as FormFieldDto['options'] });
    expect(() => summarizeField(f, null as unknown as unknown[])).not.toThrow();
    expect(summarizeField(f, null as unknown as unknown[])).toMatchObject({ total: 0, answered: 0 });
    expect(() => summarizeField(f, JUNK)).not.toThrow();
  });
});

describe('displayValue', () => {
  it('uses the question type display (option and matrix labels) when the value fits', () => {
    expect(displayValue(colour(), 'red')).toBe('Red');
    const m = field('MATRIX', { options: [opt('r1', 'Speed', 'row'), opt('c1', 'Good', 'column')] });
    expect(displayValue(m, { r1: 'c1' })).toBe('Speed: Good');
  });

  it('falls back to plain text when the display would throw or print an object', () => {
    expect(displayValue(field('ADDRESS'), { line1: 5, city: 'Leeds' })).toBe('5, Leeds');
    expect(displayValue(field('SHORT_ANSWER'), { a: 'x' })).toBe('x');
    expect(displayValue(field('NOT_A_TYPE' as FormFieldType), 'x')).toBe('x');
    for (const j of JUNK) expect(typeof displayValue(colour(), j)).toBe('string');
  });
});

describe('answerText', () => {
  it('turns any answer into readable text without throwing', () => {
    const f = field('SHORT_ANSWER');
    expect(answerText(f, ' hi ')).toBe('hi');
    expect(answerText(f, ['a', 1, null, { x: 1 }])).toBe('a, 1');
    expect(answerText(f, { a: 'x', b: 2 })).toBe('x, 2');
    expect(answerText(f, { a: { b: 'c' } })).toBe('');
    for (const j of JUNK) expect(typeof answerText(f, j)).toBe('string');
  });
});
