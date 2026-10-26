import { describe, expect, it } from 'vitest';
import { extractChartData } from './chart-utils';
import { SheetStore } from './sheet-store';

const SHEET = '11111111-1111-4111-8111-111111111111';

describe('extractChartData', () => {
  it('extracts series and data points from sheet range with headers and labels', () => {
    const store = new SheetStore('ss-1');
    store.apply([
      {
        type: 'setCells',
        sheetId: SHEET,
        cells: [
          { row: 0, col: 0, input: '' },
          { row: 0, col: 1, input: 'Q1 Sales' },
          { row: 0, col: 2, input: 'Q2 Sales' },
          { row: 1, col: 0, input: 'North' },
          { row: 1, col: 1, input: '150' },
          { row: 1, col: 2, input: '200' },
          { row: 2, col: 0, input: 'South' },
          { row: 2, col: 1, input: '80' },
          { row: 2, col: 2, input: '120' },
        ],
      },
    ]);

    const result = extractChartData(
      store,
      SHEET,
      { startRow: 0, endRow: 2, startCol: 0, endCol: 2 },
      true,
      true,
    );

    expect(result.series).toEqual(['Q1 Sales', 'Q2 Sales']);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      name: 'North',
      'Q1 Sales': 150,
      'Q2 Sales': 200,
    });
    expect(result.data[1]).toEqual({
      name: 'South',
      'Q1 Sales': 80,
      'Q2 Sales': 120,
    });
  });

  it('handles range without headers or labels', () => {
    const store = new SheetStore('ss-1');
    store.apply([
      {
        type: 'setCells',
        sheetId: SHEET,
        cells: [
          { row: 0, col: 0, input: '10' },
          { row: 1, col: 0, input: '20' },
        ],
      },
    ]);

    const result = extractChartData(
      store,
      SHEET,
      { startRow: 0, endRow: 1, startCol: 0, endCol: 0 },
      false,
      false,
    );

    expect(result.series).toEqual(['Col A']);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      name: 'Row 1',
      'Col A': 10,
    });
    expect(result.data[1]).toEqual({
      name: 'Row 2',
      'Col A': 20,
    });
  });
});
