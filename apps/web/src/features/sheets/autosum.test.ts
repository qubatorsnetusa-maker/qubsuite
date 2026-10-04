import { FUNCTION_NAMES } from '@qub/shared/formula';
import { describe, expect, it } from 'vitest';
import { planAutoSum, type AutoSumGrid } from './autosum';
import { AUTOSUM_FUNCTIONS, FUNCTION_CATEGORIES } from './function-catalog';

/** Grid from rows of cells: numbers are numeric, strings are text, null is empty. */
function grid(rows: (number | string | null)[][]): AutoSumGrid {
  const at = (r: number, c: number) => rows[r]?.[c] ?? null;
  return { isNumber: (r, c) => typeof at(r, c) === 'number', isEmpty: (r, c) => at(r, c) === null, rowCount: 1000, colCount: 26 };
}
const range = (startRow: number, startCol: number, endRow = startRow, endCol = startCol) => ({ startRow, startCol, endRow, endCol });

describe('planAutoSum', () => {
  const data = grid([
    ['Item', 'Q1', 'Q2'],
    ['a', 10, 1],
    ['b', 20, 2],
    ['c', 30, 3],
  ]);

  it('writes one formula per column below a selected block', () => {
    expect(planAutoSum('SUM', range(1, 1, 3, 2), { row: 1, col: 1 }, data)).toEqual({
      kind: 'write',
      cells: [
        { row: 4, col: 1, input: '=SUM(B2:B4)' },
        { row: 4, col: 2, input: '=SUM(C2:C4)' },
      ],
    });
  });

  it('writes to the right of a single-row selection', () => {
    expect(planAutoSum('AVERAGE', range(1, 1, 1, 2), { row: 1, col: 1 }, data)).toEqual({ kind: 'write', cells: [{ row: 1, col: 3, input: '=AVERAGE(B2:C2)' }] });
  });

  it('never overwrites: occupied targets are skipped, and all-occupied is reported', () => {
    const g = grid([[1, 2], [3, 4], [null, 'total']]);
    expect(planAutoSum('SUM', range(0, 0, 1, 1), { row: 0, col: 0 }, g)).toEqual({ kind: 'write', cells: [{ row: 2, col: 0, input: '=SUM(A1:A2)' }] });
    const full = grid([[1, 2], [3, 4], ['x', 'y']]);
    expect(planAutoSum('SUM', range(0, 0, 1, 1), { row: 0, col: 0 }, full).kind).toBe('blocked');
    expect(planAutoSum('SUM', range(0, 0, 0, 1), { row: 0, col: 0 }, grid([[1, 2, 'x']])).kind).toBe('blocked');
  });

  it('a single cell suggests the numbers above it, else to its left, else an empty call', () => {
    expect(planAutoSum('SUM', range(4, 1), { row: 4, col: 1 }, data)).toEqual({ kind: 'edit', input: '=SUM(B2:B4)' });
    expect(planAutoSum('MAX', range(1, 3), { row: 1, col: 3 }, data)).toEqual({ kind: 'edit', input: '=MAX(B2:C2)' });
    expect(planAutoSum('COUNT', range(8, 8), { row: 8, col: 8 }, data)).toEqual({ kind: 'edit', input: '=COUNT(' });
    expect(planAutoSum('MIN', range(2, 1), { row: 2, col: 1 }, grid([[null, 5], [null, null], [null, null]]))).toEqual({ kind: 'edit', input: '=MIN(' });
    expect(planAutoSum('SUM', range(1, 0), { row: 1, col: 0 }, grid([[7], [null]]))).toEqual({ kind: 'edit', input: '=SUM(A1)' });
  });
});

describe('function catalog', () => {
  const listed = FUNCTION_CATEGORIES.flatMap((c) => c.functions.map((f) => f.name));

  it('lists every function the engine supports, once, and nothing it does not', () => {
    expect([...listed].sort()).toEqual(FUNCTION_NAMES());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('offers the AutoSum quick picks', () => {
    for (const name of AUTOSUM_FUNCTIONS) expect(listed).toContain(name);
  });
});
