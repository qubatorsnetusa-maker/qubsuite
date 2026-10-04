import type { CellDto, CellStyle, WorksheetDto } from '@qub/shared';
import { dataTypeOf, formattedValueOf, serializeValue, type CellState } from '@qub/shared/formula';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { Executor } from '../../db';
import { driveFiles, spreadsheetCells, spreadsheetRanges, spreadsheets, spreadsheetSheets } from '../../db/schema';

export type SheetRow = typeof spreadsheetSheets.$inferSelect;
export type CellRow = typeof spreadsheetCells.$inferSelect;
export type CellInsert = typeof spreadsheetCells.$inferInsert;

/** Offset used to shift rows/cols without tripping the primary key mid-update (two-phase shift). */
const SHIFT_OFFSET = 10_000_000;

export function toWorksheetDto(s: SheetRow): WorksheetDto {
  return {
    id: s.id,
    name: s.name,
    position: s.position,
    rowCount: s.rowCount,
    colCount: s.colCount,
    frozenRows: s.frozenRows,
    frozenCols: s.frozenCols,
    colWidths: s.colWidths,
    rowHeights: s.rowHeights,
  };
}

export function cellRowValue(row: Pick<CellRow, 'dataType' | 'valueNumber' | 'valueText' | 'valueBoolean'>): string | number | boolean | null {
  switch (row.dataType) {
    case 'NUMBER':
      return row.valueNumber;
    case 'BOOLEAN':
      return row.valueBoolean;
    case 'STRING':
    case 'ERROR':
      return row.valueText;
    default:
      return null;
  }
}

export function toCellDto(row: CellRow): CellDto {
  return {
    row: row.row,
    col: row.col,
    input: row.input,
    value: cellRowValue(row),
    formattedValue: row.formattedValue,
    dataType: row.dataType,
    style: row.style ?? null,
  };
}

/** Converts a workbook cell into its stored representation (value in the typed column for its data type). */
export function toCellInsert(sheetId: string, row: number, col: number, cell: CellState, userId: string | null): CellInsert {
  const dataType = dataTypeOf(cell.value);
  const value = serializeValue(cell.value);
  return {
    sheetId,
    row,
    col,
    input: cell.input,
    formula: cell.ast ? cell.input : null,
    dataType,
    valueNumber: dataType === 'NUMBER' ? (value as number) : null,
    valueText: dataType === 'STRING' || dataType === 'ERROR' ? (value as string) : null,
    valueBoolean: dataType === 'BOOLEAN' ? (value as boolean) : null,
    formattedValue: formattedValueOf(cell),
    style: (cell.style as CellStyle | null) ?? null,
    updatedBy: userId,
  };
}

export function insertToCellDto(c: CellInsert): CellDto {
  return {
    row: c.row,
    col: c.col,
    input: c.input ?? '',
    value: cellRowValue({ dataType: c.dataType ?? 'EMPTY', valueNumber: c.valueNumber ?? null, valueText: c.valueText ?? null, valueBoolean: c.valueBoolean ?? null }),
    formattedValue: c.formattedValue ?? '',
    dataType: c.dataType ?? 'EMPTY',
    style: c.style ?? null,
  };
}

export const SpreadsheetRepository = {
  async findById(db: Executor, id: string) {
    const [row] = await db
      .select({ sheet: spreadsheets, file: driveFiles })
      .from(spreadsheets)
      .innerJoin(driveFiles, eq(driveFiles.id, spreadsheets.fileId))
      .where(eq(spreadsheets.id, id))
      .limit(1);
    return row;
  },

  async findByFileId(db: Executor, fileId: string) {
    const [row] = await db.select().from(spreadsheets).where(eq(spreadsheets.fileId, fileId)).limit(1);
    return row;
  },

  async sheets(db: Executor, spreadsheetId: string): Promise<SheetRow[]> {
    return db.select().from(spreadsheetSheets).where(eq(spreadsheetSheets.spreadsheetId, spreadsheetId)).orderBy(asc(spreadsheetSheets.position));
  },

  /** Only the requested window is read: the client never loads the whole sheet. */
  async cellsInRange(db: Executor, sheetId: string, r: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }): Promise<CellRow[]> {
    return db
      .select()
      .from(spreadsheetCells)
      .where(
        and(
          eq(spreadsheetCells.sheetId, sheetId),
          gte(spreadsheetCells.row, r.rowStart),
          lte(spreadsheetCells.row, r.rowEnd),
          gte(spreadsheetCells.col, r.colStart),
          lte(spreadsheetCells.col, r.colEnd),
        ),
      );
  },

  async allCells(db: Executor, sheetIds: string[]): Promise<CellRow[]> {
    if (!sheetIds.length) return [];
    return db.select().from(spreadsheetCells).where(inArray(spreadsheetCells.sheetId, sheetIds));
  },

  async deleteSheetCells(db: Executor, sheetId: string): Promise<void> {
    await db.delete(spreadsheetCells).where(eq(spreadsheetCells.sheetId, sheetId));
  },

  /** Whether any formula calls a volatile function — TODAY, NOW, RAND, RANDBETWEEN — so opening must refresh it. */
  async hasVolatileFormulas(db: Executor, spreadsheetId: string): Promise<boolean> {
    const rows = await db
      .select({ one: sql<number>`1` })
      .from(spreadsheetCells)
      .innerJoin(spreadsheetSheets, eq(spreadsheetSheets.id, spreadsheetCells.sheetId))
      .where(and(eq(spreadsheetSheets.spreadsheetId, spreadsheetId), sql`${spreadsheetCells.input} ~* '(TODAY|NOW|RAND|RANDBETWEEN)\\s*\\('`))
      .limit(1);
    return rows.length > 0;
  },

  async namedRanges(db: Executor, spreadsheetId: string) {
    return db.select().from(spreadsheetRanges).where(eq(spreadsheetRanges.spreadsheetId, spreadsheetId));
  },

  async upsertCells(db: Executor, cells: CellInsert[]): Promise<void> {
    for (let i = 0; i < cells.length; i += 1000) {
      const batch = cells.slice(i, i + 1000);
      await db
        .insert(spreadsheetCells)
        .values(batch)
        .onConflictDoUpdate({
          target: [spreadsheetCells.sheetId, spreadsheetCells.row, spreadsheetCells.col],
          set: {
            input: sql`excluded.input`,
            formula: sql`excluded.formula`,
            dataType: sql`excluded.data_type`,
            valueNumber: sql`excluded.value_number`,
            valueText: sql`excluded.value_text`,
            valueBoolean: sql`excluded.value_boolean`,
            formattedValue: sql`excluded.formatted_value`,
            style: sql`excluded.style`,
            updatedBy: sql`excluded.updated_by`,
            updatedAt: sql`now()`,
          },
        });
    }
  },

  async deleteCells(db: Executor, sheetId: string, positions: { row: number; col: number }[]): Promise<void> {
    for (let i = 0; i < positions.length; i += 1000) {
      const batch = positions.slice(i, i + 1000);
      await db.execute(sql`
        delete from spreadsheet_cells
        where sheet_id = ${sheetId} and (row, col) in (${sql.join(batch.map((p) => sql`(${p.row}, ${p.col})`), sql`, `)})`);
    }
  },

  /** Mirrors a row/column insert or delete in storage (cells and cell comments). */
  async shift(db: Executor, sheetId: string, axis: 'row' | 'col', kind: 'insert' | 'delete', index: number, count: number): Promise<void> {
    const col = sql.raw(axis === 'row' ? '"row"' : '"col"');
    for (const table of [sql.raw('spreadsheet_cells'), sql.raw('spreadsheet_comments')]) {
      if (kind === 'delete') {
        await db.execute(sql`delete from ${table} where sheet_id = ${sheetId} and ${col} >= ${index} and ${col} < ${index + count}`);
        await db.execute(sql`update ${table} set ${col} = ${col} + ${SHIFT_OFFSET - count} where sheet_id = ${sheetId} and ${col} >= ${index + count}`);
      } else {
        await db.execute(sql`update ${table} set ${col} = ${col} + ${SHIFT_OFFSET + count} where sheet_id = ${sheetId} and ${col} >= ${index}`);
      }
      await db.execute(sql`update ${table} set ${col} = ${col} - ${SHIFT_OFFSET} where sheet_id = ${sheetId} and ${col} >= ${SHIFT_OFFSET}`);
    }
  },
};
