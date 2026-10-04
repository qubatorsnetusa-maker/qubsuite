import { describe, expect, it } from 'vitest';
import { Workbook } from './workbook';

function book() {
  const wb = new Workbook();
  wb.addSheet({ id: 's1', name: 'Sheet1' });
  return wb;
}

describe('typed dates', () => {
  it('stores the serial and applies the date format only when the cell has none', () => {
    const wb = book();
    wb.setInputs('s1', [{ row: 0, col: 0, input: '2026-09-27' }]);
    expect(wb.getCell('s1', 0, 0)).toMatchObject({ value: 46292, style: { numberFormat: 'date' } });
    wb.setStyle('s1', { startRow: 1, endRow: 1, startCol: 0, endCol: 0 }, { numberFormat: 'number' }, false);
    wb.setInputs('s1', [{ row: 1, col: 0, input: '2026-09-27' }]);
    expect(wb.getCell('s1', 1, 0)!.style).toEqual({ numberFormat: 'number' });
  });
});

describe('checkbox validation', () => {
  it('sets empty cells in the range to FALSE and keeps existing values', () => {
    const wb = book();
    wb.setInputs('s1', [{ row: 0, col: 0, input: 'TRUE' }]);
    wb.setStyle('s1', { startRow: 0, endRow: 2, startCol: 0, endCol: 0 }, { validation: { kind: 'checkbox' } }, false);
    expect(wb.getCell('s1', 0, 0)!.value).toBe(true);
    expect(wb.getCell('s1', 1, 0)).toMatchObject({ value: false, input: 'FALSE', style: { validation: { kind: 'checkbox' } } });
    expect(wb.getCell('s1', 2, 0)!.value).toBe(false);
  });

  it('removing validation keeps the values', () => {
    const wb = book();
    wb.setStyle('s1', { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }, { validation: { kind: 'checkbox' } }, false);
    wb.setStyle('s1', { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }, { validation: null }, false);
    expect(wb.getCell('s1', 0, 0)).toMatchObject({ input: 'FALSE', style: null });
  });
});

describe('formula result formats', () => {
  const fmt = (wb: Workbook, row: number, col: number) => wb.getCell('s1', row, col)!.style?.numberFormat;
  const at = (wb: Workbook, row: number, col: number) => wb.getCell('s1', row, col)!;

  it('date-returning functions show as dates in unformatted cells', () => {
    const wb = book();
    wb.setInputs('s1', [
      { row: 0, col: 0, input: '=DATE(2026, 13, 1)' },
      { row: 1, col: 0, input: '=EDATE("2026-01-31", 1)' },
      { row: 2, col: 0, input: '=eomonth("2026-02-15", 0)' },
      { row: 3, col: 0, input: '=TODAY()' },
      { row: 4, col: 0, input: '=NOW()' },
      { row: 5, col: 0, input: '=TIME(18, 0, 0)' },
      { row: 6, col: 0, input: '=DATEVALUE("2026-09-27")' },
    ]);
    expect(at(wb, 0, 0)).toMatchObject({ value: 46388, style: { numberFormat: 'date' } });
    expect(fmt(wb, 1, 0)).toBe('date');
    expect(fmt(wb, 2, 0)).toBe('date');
    expect(fmt(wb, 3, 0)).toBe('date');
    expect(fmt(wb, 4, 0)).toBe('datetime');
    expect(fmt(wb, 5, 0)).toBe('time');
    expect(fmt(wb, 6, 0)).toBe('date');
  });

  it('references and date arithmetic take the referenced format; date differences and wrapped numbers do not', () => {
    const wb = book();
    wb.addSheet({ id: 's2', name: 'Other' });
    wb.setInputs('s1', [{ row: 0, col: 0, input: '2026-01-31' }, { row: 0, col: 1, input: '2026-03-01' }]);
    wb.setInputs('s2', [{ row: 0, col: 0, input: '12:30' }]);
    wb.setInputs('s1', [
      { row: 1, col: 0, input: '=A1' },
      { row: 2, col: 0, input: '=A1+7' },
      { row: 3, col: 0, input: '=7+A1' },
      { row: 4, col: 0, input: '=A1-1' },
      { row: 5, col: 0, input: '=(A1 + 1)' },
      { row: 6, col: 0, input: '=B1-A1' },
      { row: 7, col: 0, input: '=YEAR(A1)' },
      { row: 8, col: 0, input: '=A1*2' },
      { row: 9, col: 0, input: '=Other!A1' },
      { row: 10, col: 0, input: '=MAX(A1:B1)' },
      { row: 11, col: 0, input: '=SUM(1, 2)' },
      { row: 12, col: 0, input: '=DATEDIF(A1, B1, "D")' },
    ]);
    expect(fmt(wb, 1, 0)).toBe('date');
    expect(fmt(wb, 2, 0)).toBe('date');
    expect(fmt(wb, 3, 0)).toBe('date');
    expect(fmt(wb, 4, 0)).toBe('date');
    expect(fmt(wb, 5, 0)).toBe('date');
    expect(fmt(wb, 6, 0)).toBeUndefined();
    expect(fmt(wb, 7, 0)).toBeUndefined();
    expect(fmt(wb, 8, 0)).toBeUndefined();
    expect(fmt(wb, 9, 0)).toBe('time');
    expect(fmt(wb, 10, 0)).toBe('date');
    expect(fmt(wb, 11, 0)).toBeUndefined();
    expect(fmt(wb, 12, 0)).toBeUndefined();
  });

  it('keeps an explicit format and leaves non-formula edits alone', () => {
    const wb = book();
    wb.setStyle('s1', { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }, { numberFormat: 'number' }, false);
    wb.setInputs('s1', [{ row: 0, col: 0, input: '=DATE(2026, 1, 1)' }]);
    expect(fmt(wb, 0, 0)).toBe('number');
    wb.setInputs('s1', [{ row: 1, col: 0, input: '=DATE(2026, 1, 1)' }]);
    wb.setInputs('s1', [{ row: 1, col: 0, input: '5' }]);
    expect(fmt(wb, 1, 0)).toBe('date');
  });
});
