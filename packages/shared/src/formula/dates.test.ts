import { describe, expect, it } from 'vitest';
import { formatDateSerial, parseDateTime, partsFromSerial, serialFromParts } from './dates';
import { formatValue } from './format';
import { parseCellInput } from './workbook';

describe('serials', () => {
  it('uses the 1899-12-30 epoch', () => {
    expect(serialFromParts(1899, 12, 30)).toBe(0);
    expect(serialFromParts(1900, 3, 1)).toBe(61);
    expect(serialFromParts(2026, 9, 27)).toBe(46292);
    expect(partsFromSerial(46292.5)).toMatchObject({ year: 2026, month: 9, day: 27, hour: 12, minute: 0, weekday: 0 });
  });
});

describe('parseDateTime', () => {
  it.each([
    ['2026-09-27', 46292, 'date'],
    ['2026/9/27', 46292, 'date'],
    ['9/27/2026', 46292, 'date'],
    ['9/27/26', 46292, 'date'],
    ['27 Sep 2026', 46292, 'date'],
    ['September 27, 2026', 46292, 'date'],
    ['sept 27 2026', 46292, 'date'],
    ['14:30', 14.5 / 24, 'time'],
    ['2:30 PM', 14.5 / 24, 'time'],
    ['12:00 am', 0, 'time'],
    ['2026-09-27 14:30', 46292 + 14.5 / 24, 'datetime'],
    ['2026-09-27T06:00:00', 46292.25, 'datetime'],
    ['27 Sep 2026 1:00 pm', 46292 + 13 / 24, 'datetime'],
  ])('recognises %s', (text, serial, kind) => {
    const r = parseDateTime(text as string)!;
    expect(r.kind).toBe(kind);
    expect(r.serial).toBeCloseTo(serial as number, 9);
  });

  it.each(['2026-02-30', '13/45/2026', '1/2', 'Sep 2026', '25:00', '10:61', '13:00 pm', 'hello', '2026-09-27 junk', '1e3'])('rejects %s', (text) => {
    expect(parseDateTime(text)).toBeNull();
  });

  it('maps two-digit years to 1930–2029', () => {
    expect(partsFromSerial(parseDateTime('1/1/29')!.serial).year).toBe(2029);
    expect(partsFromSerial(parseDateTime('1/1/30')!.serial).year).toBe(1930);
  });
});

describe('formatting', () => {
  it('formats date, time and datetime', () => {
    expect(formatDateSerial(46292, 'date')).toBe('2026-09-27');
    expect(formatDateSerial(14.5 / 24, 'time')).toBe('2:30:00 PM');
    expect(formatDateSerial(46292, 'time')).toBe('12:00:00 AM');
    expect(formatDateSerial(46292.75, 'datetime')).toBe('2026-09-27 6:00:00 PM');
    expect(formatDateSerial(-1, 'date')).toBeNull();
  });

  it('formatValue renders date formats and leaves non-numbers alone', () => {
    expect(formatValue(46292, 'date')).toBe('2026-09-27');
    expect(formatValue('text', 'date')).toBe('text');
    expect(formatValue(-5, 'date')).toBe('-5');
  });
});

describe('parseCellInput', () => {
  it('turns typed dates into serial numbers with a suggested format', () => {
    expect(parseCellInput('2026-09-27')).toMatchObject({ ast: null, value: 46292, format: 'date' });
    expect(parseCellInput('14:30').format).toBe('time');
  });

  it('keeps numbers, booleans, text and quoted input as before', () => {
    expect(parseCellInput('12')).toEqual({ ast: null, value: 12 });
    expect(parseCellInput('TRUE')).toEqual({ ast: null, value: true });
    expect(parseCellInput("'2026-09-27")).toEqual({ ast: null, value: '2026-09-27' });
    expect(parseCellInput('2026-02-30')).toEqual({ ast: null, value: '2026-02-30' });
  });
});
