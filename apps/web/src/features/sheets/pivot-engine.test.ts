import { describe, expect, it } from 'vitest';
import { computePivotTable, generatePivotOps, type PivotConfig } from './pivot-engine';

describe('computePivotTable', () => {
  const headers = [
    { col: 0, name: 'Region' },
    { col: 1, name: 'Category' },
    { col: 2, name: 'Sales' },
  ];

  const rows = [
    ['East', 'Electronics', 100],
    ['East', 'Furniture', 50],
    ['West', 'Electronics', 200],
    ['West', 'Furniture', 150],
    ['East', 'Electronics', 80],
  ];

  const range = { startRow: 0, endRow: 5, startCol: 0, endCol: 2 };

  it('computes 1D pivot table (Row = Region, Value = SUM of Sales)', () => {
    const config: PivotConfig = {
      sourceSheetId: 's1',
      sourceRange: range,
      rowCol: 0,
      valCol: 2,
      aggregate: 'SUM',
    };

    const pivot = computePivotTable(headers, rows, range, config);

    expect(pivot.rowKeys).toEqual(['East', 'West']);
    expect(pivot.colKeys).toEqual(['Total']);
    expect(pivot.matrix).toEqual([[230], [350]]);
    expect(pivot.colTotals).toEqual([580]);
    expect(pivot.grandTotal).toBe(580);
  });

  it('computes 2D pivot table (Row = Region, Col = Category, Value = SUM of Sales)', () => {
    const config: PivotConfig = {
      sourceSheetId: 's1',
      sourceRange: range,
      rowCol: 0,
      columnCol: 1,
      valCol: 2,
      aggregate: 'SUM',
    };

    const pivot = computePivotTable(headers, rows, range, config);

    expect(pivot.rowKeys).toEqual(['East', 'West']);
    expect(pivot.colKeys).toEqual(['Electronics', 'Furniture']);
    // East: Electronics 180, Furniture 50; Row Total: 230
    expect(pivot.matrix[0]).toEqual([180, 50]);
    expect(pivot.rowTotals[0]).toBe(230);
    // West: Electronics 200, Furniture 150; Row Total: 350
    expect(pivot.matrix[1]).toEqual([200, 150]);
    expect(pivot.rowTotals[1]).toBe(350);
    // Col Totals: Electronics 380, Furniture 200
    expect(pivot.colTotals).toEqual([380, 200]);
    expect(pivot.grandTotal).toBe(580);
  });

  it('computes AVERAGE aggregation properly', () => {
    const config: PivotConfig = {
      sourceSheetId: 's1',
      sourceRange: range,
      rowCol: 0,
      valCol: 2,
      aggregate: 'AVERAGE',
    };

    const pivot = computePivotTable(headers, rows, range, config);

    // East: (100 + 50 + 80) / 3 = 76.67
    expect(pivot.matrix[0]).toEqual([76.67]);
    // West: (200 + 150) / 2 = 175
    expect(pivot.matrix[1]).toEqual([175]);
  });

  it('generates setCells ops correctly', () => {
    const config: PivotConfig = {
      sourceSheetId: 's1',
      sourceRange: range,
      rowCol: 0,
      columnCol: 1,
      valCol: 2,
      aggregate: 'SUM',
    };

    const pivot = computePivotTable(headers, rows, range, config);
    const ops = generatePivotOps(pivot, 'target-sheet', 0, 0);

    expect(ops).toHaveLength(1);
    expect(ops[0]?.type).toBe('setCells');
    const cells = (ops[0] as any).cells;
    expect(cells.length).toBeGreaterThan(5);
    expect(cells[0]).toEqual({ row: 0, col: 0, input: 'Region' });
  });
});
