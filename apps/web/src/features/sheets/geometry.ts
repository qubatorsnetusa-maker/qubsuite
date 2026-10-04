import type { CellRange, WorksheetDto } from '@qub/shared';

export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 21;
export const ROW_HEADER_WIDTH = 46;
export const COL_HEADER_HEIGHT = 24;

/** Prefix sums of column widths / row heights, so any cell's offset is O(1) and visible ranges are a binary search. */
export interface Geometry {
  colX: Float64Array;
  rowY: Float64Array;
  colCount: number;
  rowCount: number;
  colW(c: number): number;
  rowH(r: number): number;
}

export function buildGeometry(sheet: WorksheetDto, hiddenRows: Set<number>, overrides: { col?: [number, number]; row?: [number, number] } = {}): Geometry {
  const colCount = sheet.colCount;
  const rowCount = sheet.rowCount;
  const colW = (c: number) => (overrides.col && overrides.col[0] === c ? overrides.col[1] : (sheet.colWidths[c] ?? DEFAULT_COL_WIDTH));
  const rowH = (r: number) => (hiddenRows.has(r) ? 0 : overrides.row && overrides.row[0] === r ? overrides.row[1] : (sheet.rowHeights[r] ?? DEFAULT_ROW_HEIGHT));
  const colX = new Float64Array(colCount + 1);
  for (let c = 0; c < colCount; c++) colX[c + 1] = colX[c]! + colW(c);
  const rowY = new Float64Array(rowCount + 1);
  for (let r = 0; r < rowCount; r++) rowY[r + 1] = rowY[r]! + rowH(r);
  return { colX, rowY, colCount, rowCount, colW, rowH };
}

/** Largest index i with arr[i] <= value. */
export function indexAt(arr: Float64Array, value: number): number {
  let lo = 0;
  let hi = arr.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid]! <= value) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}

export function normalizeRange(a: { row: number; col: number }, b: { row: number; col: number }): CellRange {
  return { startRow: Math.min(a.row, b.row), endRow: Math.max(a.row, b.row), startCol: Math.min(a.col, b.col), endCol: Math.max(a.col, b.col) };
}
