import type { CellRange, SheetOp } from '@qub/shared';
import { colToLetters } from '@qub/shared/formula';
import type { SheetStore } from './sheet-store';

export type PivotAggregateFunc = 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';

export interface PivotConfig {
  sourceSheetId: string;
  sourceRange: CellRange;
  rowCol: number; // 0-based column index within sheet
  columnCol?: number; // Optional 0-based column index for secondary dimension
  valCol: number; // 0-based column index to aggregate
  aggregate: PivotAggregateFunc;
}

export interface PivotTableData {
  title: string;
  rowHeader: string;
  colHeader?: string;
  valueHeader: string;
  aggregate: PivotAggregateFunc;
  rowKeys: string[];
  colKeys: string[];
  matrix: (number | null)[][]; // rowKeys.length x colKeys.length
  rowTotals: (number | null)[];
  colTotals: (number | null)[];
  grandTotal: number | null;
}

/** Extracts headers and rows from a sheet range. */
export function extractTableData(
  store: SheetStore,
  sheetId: string,
  range: CellRange,
): { headers: { col: number; name: string }[]; rows: (string | number | null)[][] } {
  const cells = store.sheetCells(sheetId);
  const { startRow, endRow, startCol, endCol } = range;

  const headers: { col: number; name: string }[] = [];
  for (let c = startCol; c <= endCol; c++) {
    const headerCell = cells.get(`${startRow}:${c}`);
    const name = headerCell?.formattedValue || headerCell?.input || `Column ${colToLetters(c)}`;
    headers.push({ col: c, name });
  }

  const rows: (string | number | null)[][] = [];
  for (let r = startRow + 1; r <= endRow; r++) {
    const rowRecord: (string | number | null)[] = [];
    for (let c = startCol; c <= endCol; c++) {
      const cell = cells.get(`${r}:${c}`);
      if (!cell || cell.value === null || cell.value === undefined) {
        rowRecord.push(null);
      } else if (typeof cell.value === 'number') {
        rowRecord.push(cell.value);
      } else {
        const parsed = parseFloat(String(cell.formattedValue || cell.value).replace(/[^0-9.-]+/g, ''));
        rowRecord.push(isNaN(parsed) ? String(cell.formattedValue || cell.value) : parsed);
      }
    }
    rows.push(rowRecord);
  }

  return { headers, rows };
}

/** Computes the pivot table matrix from extracted table data. */
export function computePivotTable(
  headers: { col: number; name: string }[],
  rows: (string | number | null)[][],
  range: CellRange,
  config: PivotConfig,
): PivotTableData {
  const colOffset = range.startCol;
  const rowIdx = config.rowCol - colOffset;
  const hasColDim = config.columnCol !== undefined;
  const colDimIdx = hasColDim ? config.columnCol! - colOffset : -1;
  const valIdx = config.valCol - colOffset;

  const rowHeader = headers[rowIdx]?.name || `Col ${colToLetters(config.rowCol)}`;
  const colHeader = hasColDim ? headers[colDimIdx]?.name || `Col ${colToLetters(config.columnCol!)}` : undefined;
  const valueHeader = headers[valIdx]?.name || `Col ${colToLetters(config.valCol)}`;

  // Group values: rowKey -> colKey -> array of numeric values
  const rowKeySet = new Set<string>();
  const colKeySet = new Set<string>();
  const buckets = new Map<string, Map<string, number[]>>();

  for (const row of rows) {
    const rKey = String(row[rowIdx] ?? '(blank)');
    const cKey = hasColDim ? String(row[colDimIdx] ?? '(blank)') : 'Total';

    rowKeySet.add(rKey);
    colKeySet.add(cKey);

    if (!buckets.has(rKey)) buckets.set(rKey, new Map());
    const rowMap = buckets.get(rKey)!;
    if (!rowMap.has(cKey)) rowMap.set(cKey, []);

    const rawVal = row[valIdx];
    const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
    if (!isNaN(num)) {
      rowMap.get(cKey)!.push(num);
    }
  }

  const rowKeys = Array.from(rowKeySet).sort();
  const colKeys = Array.from(colKeySet).sort();

  const aggregateValues = (arr: number[]): number | null => {
    if (!arr || arr.length === 0) return null;
    switch (config.aggregate) {
      case 'SUM':
        return Math.round(arr.reduce((a, b) => a + b, 0) * 100) / 100;
      case 'COUNT':
        return arr.length;
      case 'AVERAGE':
        return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
      case 'MIN':
        return Math.min(...arr);
      case 'MAX':
        return Math.max(...arr);
      default:
        return arr.reduce((a, b) => a + b, 0);
    }
  };

  const matrix: (number | null)[][] = [];
  const rowTotals: (number | null)[][] = [];

  for (const rKey of rowKeys) {
    const rowMap = buckets.get(rKey) || new Map();
    const rowCells: (number | null)[] = [];
    const allRowNums: number[] = [];

    for (const cKey of colKeys) {
      const nums = rowMap.get(cKey) || [];
      allRowNums.push(...nums);
      rowCells.push(aggregateValues(nums));
    }

    matrix.push(rowCells);
    rowTotals.push([aggregateValues(allRowNums)]);
  }

  // Column totals
  const colTotals: (number | null)[] = [];
  const allGrandNums: number[] = [];
  for (const cKey of colKeys) {
    const colNums: number[] = [];
    for (const rKey of rowKeys) {
      const nums = buckets.get(rKey)?.get(cKey) || [];
      colNums.push(...nums);
      allGrandNums.push(...nums);
    }
    colTotals.push(aggregateValues(colNums));
  }

  const grandTotal = aggregateValues(allGrandNums);

  return {
    title: `Pivot: ${config.aggregate} of ${valueHeader}`,
    rowHeader,
    colHeader,
    valueHeader,
    aggregate: config.aggregate,
    rowKeys,
    colKeys,
    matrix,
    rowTotals: rowTotals.map((r) => r[0]!),
    colTotals,
    grandTotal,
  };
}

/** Generates setCells SheetOps to write the computed pivot table to a target sheet. */
export function generatePivotOps(
  pivot: PivotTableData,
  sheetId: string,
  startRow = 0,
  startCol = 0,
): SheetOp[] {
  const ops: { row: number; col: number; input: string }[] = [];

  // Header row
  ops.push({ row: startRow, col: startCol, input: pivot.rowHeader });

  pivot.colKeys.forEach((cKey, cIdx) => {
    ops.push({ row: startRow, col: startCol + 1 + cIdx, input: cKey });
  });

  if (pivot.colKeys.length > 1) {
    ops.push({ row: startRow, col: startCol + 1 + pivot.colKeys.length, input: 'Grand Total' });
  }

  // Data rows
  pivot.rowKeys.forEach((rKey, rIdx) => {
    const curRow = startRow + 1 + rIdx;
    ops.push({ row: curRow, col: startCol, input: rKey });

    pivot.colKeys.forEach((_, cIdx) => {
      const val = pivot.matrix[rIdx]?.[cIdx];
      ops.push({
        row: curRow,
        col: startCol + 1 + cIdx,
        input: val !== null && val !== undefined ? String(val) : '',
      });
    });

    if (pivot.colKeys.length > 1) {
      const rowTot = pivot.rowTotals[rIdx];
      ops.push({
        row: curRow,
        col: startCol + 1 + pivot.colKeys.length,
        input: rowTot !== null && rowTot !== undefined ? String(rowTot) : '',
      });
    }
  });

  // Footer Grand Total row
  const footerRow = startRow + 1 + pivot.rowKeys.length;
  ops.push({ row: footerRow, col: startCol, input: 'Grand Total' });

  pivot.colKeys.forEach((_, cIdx) => {
    const colTot = pivot.colTotals[cIdx];
    ops.push({
      row: footerRow,
      col: startCol + 1 + cIdx,
      input: colTot !== null && colTot !== undefined ? String(colTot) : '',
    });
  });

  if (pivot.colKeys.length > 1) {
    ops.push({
      row: footerRow,
      col: startCol + 1 + pivot.colKeys.length,
      input: pivot.grandTotal !== null && pivot.grandTotal !== undefined ? String(pivot.grandTotal) : '',
    });
  }

  return [{ type: 'setCells', sheetId, cells: ops }];
}
