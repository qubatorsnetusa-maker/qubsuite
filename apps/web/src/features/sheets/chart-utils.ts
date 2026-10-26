import type { CellRange } from '@qub/shared';
import { colToLetters } from '@qub/shared/formula';
import type { SheetStore } from './sheet-store';

export type ChartType = 'bar' | 'line' | 'area' | 'pie';

export interface SheetChart {
  id: string;
  type: ChartType;
  title: string;
  range: CellRange;
  firstRowHeaders: boolean;
  firstColLabels: boolean;
  position: { x: number; y: number; width: number; height: number };
}

export interface ChartDataPoint {
  name: string;
  [seriesKey: string]: string | number;
}

export interface ExtractedChartData {
  data: ChartDataPoint[];
  series: string[];
}

export const CHART_COLORS = [
  '#1a56db', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

/** Extracts structured tabular data from a sheet store range for Recharts. */
export function extractChartData(
  store: SheetStore,
  sheetId: string,
  range: CellRange,
  firstRowHeaders = true,
  firstColLabels = true,
): ExtractedChartData {
  const cells = store.sheetCells(sheetId);
  const { startRow, endRow, startCol, endCol } = range;

  const dataRowStart = firstRowHeaders ? startRow + 1 : startRow;
  const dataColStart = firstColLabels ? startCol + 1 : startCol;

  // Determine series names
  const seriesNames: string[] = [];
  for (let c = dataColStart; c <= endCol; c++) {
    if (firstRowHeaders) {
      const headerCell = cells.get(`${startRow}:${c}`);
      seriesNames.push(headerCell?.formattedValue || headerCell?.input || `Col ${colToLetters(c)}`);
    } else {
      seriesNames.push(`Col ${colToLetters(c)}`);
    }
  }

  const data: ChartDataPoint[] = [];

  for (let r = dataRowStart; r <= endRow; r++) {
    let categoryName = `Row ${r + 1}`;
    if (firstColLabels) {
      const labelCell = cells.get(`${r}:${startCol}`);
      if (labelCell?.formattedValue || labelCell?.input) {
        categoryName = labelCell.formattedValue || labelCell.input;
      }
    }

    const point: ChartDataPoint = { name: categoryName };

    seriesNames.forEach((sName, idx) => {
      const c = dataColStart + idx;
      const cell = cells.get(`${r}:${c}`);
      let numVal = 0;
      if (cell) {
        if (typeof cell.value === 'number') {
          numVal = cell.value;
        } else if (cell.formattedValue) {
          const parsed = parseFloat(cell.formattedValue.replace(/[^0-9.-]+/g, ''));
          numVal = isNaN(parsed) ? 0 : parsed;
        } else if (cell.input) {
          const parsed = parseFloat(cell.input.replace(/[^0-9.-]+/g, ''));
          numVal = isNaN(parsed) ? 0 : parsed;
        }
      }
      point[sName] = numVal;
    });

    data.push(point);
  }

  return { data, series: seriesNames };
}
