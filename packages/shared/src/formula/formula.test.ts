import { describe, expect, it } from 'vitest';
import { formatValue } from './format';
import { parseFormula } from './parser';
import { serializeFormula } from './serialize';
import { translateFormulaInput } from './transform';
import { isError } from './values';
import { Workbook, type CellChange } from './workbook';

function book() {
  const wb = new Workbook();
  wb.addSheet({ id: 's1', name: 'Sheet1' });
  wb.addSheet({ id: 's2', name: 'Data Sheet' });
  return wb;
}

const A = (ref: string) => {
  const col = ref.charCodeAt(0) - 65;
  const row = Number(ref.slice(1)) - 1;
  return { row, col };
};

function set(wb: Workbook, entries: Record<string, string>, sheet = 's1'): CellChange[] {
  return wb.setInputs(
    sheet,
    Object.entries(entries).map(([ref, input]) => ({ ...A(ref), input })),
  );
}

const val = (wb: Workbook, ref: string, sheet = 's1') => {
  const { row, col } = A(ref);
  const v = wb.getCell(sheet, row, col)?.value ?? null;
  return isError(v) ? v.code : v;
};

describe('formula evaluation', () => {
  it('evaluates the functions required by the spec', () => {
    const wb = book();
    set(wb, { A1: '10', A2: '20', A3: '30', B1: '4' });
    set(wb, {
      C1: '=SUM(A1:A3)',
      C2: '=AVERAGE(A1:A3)',
      C3: '=MIN(A1:A3)',
      C4: '=MAX(A1:A3)',
      C5: '=COUNT(A1:A3)',
      C6: '=IF(A1>5,"Yes","No")',
      C7: '=A1+B1',
      C8: '=A1*B1',
    });
    expect(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'].map((r) => val(wb, r))).toEqual([60, 20, 10, 30, 3, 'Yes', 14, 40]);
  });

  it('respects operator precedence, unary minus, percent and concatenation', () => {
    const wb = book();
    set(wb, { A1: '=2+3*4^2', A2: '=-2^2', A3: '=50%*10', A4: '="a"&1+1', A5: '=(1+2)*3' });
    expect(val(wb, 'A1')).toBe(50);
    expect(val(wb, 'A2')).toBe(4); // spreadsheet semantics: unary binds tighter than ^
    expect(val(wb, 'A3')).toBe(5);
    expect(val(wb, 'A4')).toBe('a2');
    expect(val(wb, 'A5')).toBe(9);
  });

  it('produces spreadsheet errors instead of throwing', () => {
    const wb = book();
    set(wb, { A1: '=1/0', A2: '=NOPE(1)', A3: '="x"+1', A4: '=SUM(', A5: '=A1+1', A6: '=Missing!A1' });
    expect(val(wb, 'A1')).toBe('#DIV/0!');
    expect(val(wb, 'A2')).toBe('#NAME?');
    expect(val(wb, 'A3')).toBe('#VALUE!');
    expect(val(wb, 'A4')).toBe('#ERROR!');
    expect(val(wb, 'A5')).toBe('#DIV/0!'); // errors propagate
    expect(val(wb, 'A6')).toBe('#REF!');
  });

  it('supports cross-sheet references including quoted names', () => {
    const wb = book();
    set(wb, { A1: '7' }, 's2');
    set(wb, { A1: "='Data Sheet'!A1*2" });
    expect(val(wb, 'A1')).toBe(14);
    set(wb, { A1: '8' }, 's2');
    expect(val(wb, 'A1')).toBe(16);
  });

  it('supports conditional aggregates', () => {
    const wb = book();
    set(wb, { A1: 'apple', A2: 'pear', A3: 'apple', B1: '1', B2: '2', B3: '3' });
    set(wb, { C1: '=COUNTIF(A1:A3,"apple")', C2: '=SUMIF(A1:A3,"apple",B1:B3)', C3: '=COUNTIF(B1:B3,">1")' });
    expect([val(wb, 'C1'), val(wb, 'C2'), val(wb, 'C3')]).toEqual([2, 4, 2]);
  });
});

describe('dependency tracking', () => {
  it('recalculates dependents when a precedent changes (A1 → A3)', () => {
    const wb = book();
    set(wb, { A1: '10', A2: '20', A3: '=SUM(A1:A2)' });
    expect(val(wb, 'A3')).toBe(30);
    const changes = set(wb, { A1: '15' });
    expect(val(wb, 'A3')).toBe(35);
    expect(changes.map((c) => `${c.row}:${c.col}`).sort()).toEqual(['0:0', '2:0']);
  });

  it('recalculates transitive chains in dependency order', () => {
    const wb = book();
    set(wb, { A1: '1', B1: '=A1*2', C1: '=B1+A1', D1: '=C1*B1' });
    expect(val(wb, 'D1')).toBe(6);
    set(wb, { A1: '3' });
    expect([val(wb, 'B1'), val(wb, 'C1'), val(wb, 'D1')]).toEqual([6, 9, 54]);
  });

  it('handles long chains without recursion limits', () => {
    const wb = book();
    const updates = [{ row: 0, col: 0, input: '1' }];
    for (let r = 1; r < 5000; r++) updates.push({ row: r, col: 0, input: `=A${r}+1` });
    wb.setInputs('s1', updates);
    expect(wb.getCell('s1', 4999, 0)?.value).toBe(5000);
    wb.setInputs('s1', [{ row: 0, col: 0, input: '100' }]);
    expect(wb.getCell('s1', 4999, 0)?.value).toBe(5099);
  });

  it('tracks large ranges', () => {
    const wb = book();
    wb.setInputs('s1', [{ row: 0, col: 1, input: '=SUM(A1:A1000)' }]);
    wb.setInputs('s1', [{ row: 700, col: 0, input: '5' }]);
    expect(val(wb, 'B1')).toBe(5);
  });

  it('detects cycles and recovers when broken', () => {
    const wb = book();
    set(wb, { A1: '=B1+1', B1: '=A1+1', C1: '=A1' });
    expect([val(wb, 'A1'), val(wb, 'B1'), val(wb, 'C1')]).toEqual(['#CYCLE!', '#CYCLE!', '#CYCLE!']);
    set(wb, { B1: '5' });
    expect([val(wb, 'A1'), val(wb, 'C1')]).toEqual([6, 6]);
  });
});

describe('structural changes', () => {
  it('shifts references when rows are inserted and deleted', () => {
    const wb = book();
    set(wb, { A1: '1', A2: '2', A3: '=SUM(A1:A2)', B1: '=A2*10' });
    wb.applyStructuralChange('s1', 'row', 'insert', 1, 1);
    expect(wb.getCell('s1', 3, 0)?.input).toBe('=SUM(A1:A3)');
    expect(wb.getCell('s1', 0, 1)?.input).toBe('=A3*10');
    expect(wb.getCell('s1', 3, 0)?.value).toBe(3);

    wb.applyStructuralChange('s1', 'row', 'delete', 2, 1); // removes the "2"
    expect(wb.getCell('s1', 0, 1)?.input).toBe('=#REF!*10');
    expect(val(wb, 'B1')).toBe('#REF!');
    expect(wb.getCell('s1', 2, 0)?.input).toBe('=SUM(A1:A2)');
    expect(wb.getCell('s1', 2, 0)?.value).toBe(1);
  });

  it('rewrites formulas on sheet rename', () => {
    const wb = book();
    set(wb, { A1: '2' }, 's2');
    set(wb, { A1: "='Data Sheet'!A1" });
    wb.renameSheet('s2', 'Numbers');
    expect(wb.getCell('s1', 0, 0)?.input).toBe('=Numbers!A1');
    expect(val(wb, 'A1')).toBe(2);
  });

  it('sorts rows and moves formulas with their rows', () => {
    const wb = book();
    set(wb, { A1: 'Name', B1: 'Score', A2: 'b', B2: '2', A3: 'a', B3: '9', A4: 'c', B4: '5', C2: '=B2*2', C3: '=B3*2', C4: '=B4*2' });
    wb.sortRange('s1', { startRow: 0, endRow: 3, startCol: 0, endCol: 2 }, 1, 'desc', true);
    expect([val(wb, 'A2'), val(wb, 'A3'), val(wb, 'A4')]).toEqual(['a', 'c', 'b']);
    expect(wb.getCell('s1', 1, 2)?.input).toBe('=B2*2');
    expect([val(wb, 'C2'), val(wb, 'C3'), val(wb, 'C4')]).toEqual([18, 10, 4]);
  });
});

describe('formula text utilities', () => {
  it('round-trips through the serializer', () => {
    for (const f of ['SUM(A1:B2)*2', "'My Sheet'!$A$1+1", '(A1+B1)*C1', 'IF(A1>=10,"a""b",FALSE)', '-A1^2', 'A1-(B1-C1)']) {
      expect(serializeFormula(parseFormula(f))).toBe(f);
    }
  });

  it('translates relative references for copy/paste but keeps absolute ones', () => {
    expect(translateFormulaInput('=A1+$B$1+C$2+$D3', 2, 1)).toBe('=B3+$B$1+D$2+$D5');
    expect(translateFormulaInput('=A1', -1, 0)).toBe('=#REF!');
  });

  it('formats values by number format', () => {
    expect(formatValue(1234.5, 'currency')).toBe('$1,234.50');
    expect(formatValue(0.256, 'percent')).toBe('25.6%');
    expect(formatValue(0.1 + 0.2)).toBe('0.3');
    expect(formatValue(true)).toBe('TRUE');
  });
});
