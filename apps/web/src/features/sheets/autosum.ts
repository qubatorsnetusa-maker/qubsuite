import type { CellRange } from '@qub/shared';
import { cellA1, rangeA1 } from '@qub/shared/formula';

export type AutoSumPlan =
  /** Formulas written straight into empty cells next to the selection. */
  | { kind: 'write'; cells: { row: number; col: number; input: string }[] }
  /** The active cell opens for editing with a suggested formula to confirm or change. */
  | { kind: 'edit'; input: string }
  /** Nothing can be placed (every target cell is taken). */
  | { kind: 'blocked'; reason: string };

export interface AutoSumGrid {
  isNumber(row: number, col: number): boolean;
  isEmpty(row: number, col: number): boolean;
  rowCount: number;
  colCount: number;
}

const ref = (r0: number, c0: number, r1: number, c1: number) => (r0 === r1 && c0 === c1 ? cellA1(r0, c0) : rangeA1({ startRow: r0, endRow: r1, startCol: c0, endCol: c1 }));

/**
 * AutoSum (Google Sheets / Excel Σ button):
 * - a selected block gets one formula per column in the row just below it (a single row: one formula to its right),
 *   skipping any target cell that already holds something;
 * - a single cell suggests the run of numbers directly above it, else to its left, and opens for editing.
 */
export function planAutoSum(fn: string, range: CellRange, active: { row: number; col: number }, grid: AutoSumGrid): AutoSumPlan {
  const single = range.startRow === range.endRow && range.startCol === range.endCol;
  if (single) {
    const { row, col } = active;
    let top = row;
    while (top > 0 && grid.isNumber(top - 1, col)) top--;
    if (top < row) return { kind: 'edit', input: `=${fn}(${ref(top, col, row - 1, col)})` };
    let left = col;
    while (left > 0 && grid.isNumber(row, left - 1)) left--;
    if (left < col) return { kind: 'edit', input: `=${fn}(${ref(row, left, row, col - 1)})` };
    return { kind: 'edit', input: `=${fn}(` };
  }

  const cells: { row: number; col: number; input: string }[] = [];
  if (range.startRow === range.endRow) {
    const col = range.endCol + 1;
    if (col < grid.colCount && grid.isEmpty(range.startRow, col)) cells.push({ row: range.startRow, col, input: `=${fn}(${ref(range.startRow, range.startCol, range.endRow, range.endCol)})` });
  } else {
    const row = range.endRow + 1;
    if (row < grid.rowCount)
      for (let c = range.startCol; c <= range.endCol; c++) if (grid.isEmpty(row, c)) cells.push({ row, col: c, input: `=${fn}(${ref(range.startRow, c, range.endRow, c)})` });
  }
  return cells.length ? { kind: 'write', cells } : { kind: 'blocked', reason: `The cell${range.startRow === range.endRow ? ' to the right of' : 's below'} the selection already hold${range.startRow === range.endRow ? 's' : ''} data.` };
}
