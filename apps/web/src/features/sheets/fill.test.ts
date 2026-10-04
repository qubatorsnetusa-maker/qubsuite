import { describe, expect, it } from 'vitest';
import { copyFill, fillSeries, groupStyleOps, type FillSource } from './fill';

const num = (n: number, style: FillSource['style'] = null): FillSource => ({ input: String(n), value: n, style });
const txt = (s: string): FillSource => ({ input: s, value: s, style: null });
const down = { dRow: 1, dCol: 0 };
const up = { dRow: -1, dCol: 0 };

describe('fillSeries', () => {
  it('continues arithmetic series, repeats a single number', () => {
    expect(fillSeries([num(1), num(2)], 3, down).map((t) => t.input)).toEqual(['3', '4', '5']);
    expect(fillSeries([num(10), num(7.5)], 2, down).map((t) => t.input)).toEqual(['5', '2.5']);
    expect(fillSeries([num(5)], 2, down).map((t) => t.input)).toEqual(['5', '5']);
    expect(fillSeries([num(1), num(2), num(4)], 3, down).map((t) => t.input)).toEqual(['1', '2', '4']);
  });

  it('continues dates by day or by month; a single date adds a day', () => {
    const d = (s: string, serial: number) => ({ input: s, value: serial, style: { numberFormat: 'date' as const } });
    expect(fillSeries([d('2026-09-27', 46292)], 2, down).map((t) => t.input)).toEqual(['2026-09-28', '2026-09-29']);
    expect(fillSeries([d('2026-01-31', 46053), d('2026-02-28', 46081)], 2, down).map((t) => t.input)).toEqual(['2026-03-31', '2026-04-30']);
    expect(fillSeries([d('2026-01-15', 46037), d('2026-02-15', 46068)], 1, down).map((t) => t.input)).toEqual(['2026-03-15']);
    expect(fillSeries([d('2026-09-27', 46292), d('2026-09-29', 46294)], 1, down).map((t) => t.input)).toEqual(['2026-10-01']);
  });

  it('increments text ending in a number, keeping zero padding', () => {
    expect(fillSeries([txt('Item 1')], 2, down).map((t) => t.input)).toEqual(['Item 2', 'Item 3']);
    expect(fillSeries([txt('Q08'), txt('Q10')], 2, down).map((t) => t.input)).toEqual(['Q12', 'Q14']);
    expect(fillSeries([txt('a'), txt('b')], 3, down).map((t) => t.input)).toEqual(['a', 'b', 'a']);
  });

  it('shifts relative references in formulas by their distance from the source', () => {
    const f = { input: '=A1+$B$1', value: 0, style: null };
    expect(fillSeries([f], 2, down).map((t) => t.input)).toEqual(['=A2+$B$1', '=A3+$B$1']);
    expect(fillSeries([f], 1, { dRow: 0, dCol: 1 }).map((t) => t.input)).toEqual(['=B1+$B$1']);
  });

  it('continues backwards when dragging up (sources given nearest-edge first)', () => {
    expect(fillSeries([num(3), num(4)].reverse(), 2, up).map((t) => t.input)).toEqual(['2', '1']);
  });

  it('copies styles along with inputs', () => {
    const bold = { bold: true };
    expect(fillSeries([num(1, bold), num(2)], 2, down).map((t) => t.style)).toEqual([bold, null]);
  });
});

describe('copyFill', () => {
  it('copies the first cell to every target, shifting formulas (no series)', () => {
    expect(copyFill({ input: '=A1', value: 0, style: null }, 2, down).map((t) => t.input)).toEqual(['=A2', '=A3']);
    expect(copyFill(num(1), 2, down).map((t) => t.input)).toEqual(['1', '1']);
  });
});

describe('groupStyleOps', () => {
  it('merges runs of equal styles per column', () => {
    const ops = groupStyleOps('s', [
      { row: 1, col: 0, style: null },
      { row: 2, col: 0, style: null },
      { row: 3, col: 0, style: { bold: true } },
      { row: 1, col: 1, style: null },
    ]);
    expect(ops).toEqual([
      { type: 'setStyle', sheetId: 's', range: { startRow: 1, endRow: 2, startCol: 0, endCol: 0 }, style: {}, replace: true },
      { type: 'setStyle', sheetId: 's', range: { startRow: 3, endRow: 3, startCol: 0, endCol: 0 }, style: { bold: true }, replace: true },
      { type: 'setStyle', sheetId: 's', range: { startRow: 1, endRow: 1, startCol: 1, endCol: 1 }, style: {}, replace: true },
    ]);
  });
});

describe('fillSeries backwards from a single cell', () => {
  it('counts down when dragging up or left from one date or one "text + number"', () => {
    const d = { input: '2026-09-27', value: 46292, style: { numberFormat: 'date' as const } };
    expect(fillSeries([d], 2, up).map((t) => t.input)).toEqual(['2026-09-26', '2026-09-25']);
    expect(fillSeries([txt('Item 5')], 2, { dRow: 0, dCol: -1 }).map((t) => t.input)).toEqual(['Item 4', 'Item 3']);
  });
});
