import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type { CellStyle } from '@qub/shared';
import { createdAt, updatedAt } from './_types';
import { driveFiles } from './drive.schema';
import { cellDataTypeEnum } from './enums';
import { users } from './users.schema';

export const spreadsheets = pgTable(
  'spreadsheets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => driveFiles.id, { onDelete: 'cascade' }),
    /** Monotonic revision, bumped for every applied batch of operations. */
    revision: bigint('revision', { mode: 'number' }).notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    lastEditedBy: uuid('last_edited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('spreadsheets_file_id_unique').on(t.fileId)],
);

export const spreadsheetSheets = pgTable(
  'spreadsheet_sheets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spreadsheetId: uuid('spreadsheet_id')
      .notNull()
      .references(() => spreadsheets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    rowCount: integer('row_count').notNull().default(1000),
    colCount: integer('col_count').notNull().default(26),
    frozenRows: integer('frozen_rows').notNull().default(0),
    frozenCols: integer('frozen_cols').notNull().default(0),
    colWidths: jsonb('col_widths').$type<Record<string, number>>().notNull().default({}),
    rowHeights: jsonb('row_heights').$type<Record<string, number>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('spreadsheet_sheets_spreadsheet_idx').on(t.spreadsheetId, t.position),
    uniqueIndex('spreadsheet_sheets_name_unique').on(t.spreadsheetId, sql`lower(${t.name})`),
    check('spreadsheet_sheets_frozen_non_negative', sql`${t.frozenRows} >= 0 and ${t.frozenCols} >= 0`),
    check('spreadsheet_sheets_dimensions', sql`${t.rowCount} between 1 and 100000 and ${t.colCount} between 1 and 702`),
  ],
);

/**
 * Sparse cell storage: only cells with content or formatting exist.
 * The computed value is stored in a typed column so filtering/sorting can use SQL.
 */
export const spreadsheetCells = pgTable(
  'spreadsheet_cells',
  {
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => spreadsheetSheets.id, { onDelete: 'cascade' }),
    row: integer('row').notNull(),
    col: integer('col').notNull(),
    input: text('input').notNull().default(''),
    formula: text('formula'),
    dataType: cellDataTypeEnum('data_type').notNull().default('EMPTY'),
    valueNumber: doublePrecision('value_number'),
    valueText: text('value_text'),
    valueBoolean: boolean('value_boolean'),
    formattedValue: text('formatted_value').notNull().default(''),
    style: jsonb('style').$type<CellStyle>(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.sheetId, t.row, t.col] }),
    index('spreadsheet_cells_sheet_col_row_idx').on(t.sheetId, t.col, t.row),
    check('spreadsheet_cells_position_non_negative', sql`${t.row} >= 0 and ${t.col} >= 0`),
  ],
);

/** Named ranges (e.g. =SUM(Revenue)). */
export const spreadsheetRanges = pgTable(
  'spreadsheet_ranges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spreadsheetId: uuid('spreadsheet_id')
      .notNull()
      .references(() => spreadsheets.id, { onDelete: 'cascade' }),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => spreadsheetSheets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startRow: integer('start_row').notNull(),
    endRow: integer('end_row').notNull(),
    startCol: integer('start_col').notNull(),
    endCol: integer('end_col').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('spreadsheet_ranges_name_unique').on(t.spreadsheetId, sql`upper(${t.name})`),
    check('spreadsheet_ranges_bounds', sql`${t.startRow} <= ${t.endRow} and ${t.startCol} <= ${t.endCol} and ${t.startRow} >= 0 and ${t.startCol} >= 0`),
  ],
);

export const spreadsheetCollaborators = pgTable(
  'spreadsheet_collaborators',
  {
    spreadsheetId: uuid('spreadsheet_id')
      .notNull()
      .references(() => spreadsheets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    color: text('color').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.spreadsheetId, t.userId] })],
);

export interface SpreadsheetSnapshot {
  sheets: {
    id: string;
    name: string;
    position: number;
    frozenRows: number;
    frozenCols: number;
    colWidths: Record<string, number>;
    rowHeights: Record<string, number>;
    cells: { row: number; col: number; input: string; style: CellStyle | null }[];
  }[];
}

export const spreadsheetVersions = pgTable(
  'spreadsheet_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spreadsheetId: uuid('spreadsheet_id')
      .notNull()
      .references(() => spreadsheets.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    name: text('name'),
    revision: bigint('revision', { mode: 'number' }).notNull(),
    snapshot: jsonb('snapshot').$type<SpreadsheetSnapshot>().notNull(),
    cellCount: integer('cell_count').notNull().default(0),
    isAuto: boolean('is_auto').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('spreadsheet_versions_version_unique').on(t.spreadsheetId, t.versionNumber),
    index('spreadsheet_versions_created_idx').on(t.spreadsheetId, t.createdAt),
  ],
);

export const spreadsheetComments = pgTable(
  'spreadsheet_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spreadsheetId: uuid('spreadsheet_id')
      .notNull()
      .references(() => spreadsheets.id, { onDelete: 'cascade' }),
    sheetId: uuid('sheet_id')
      .notNull()
      .references(() => spreadsheetSheets.id, { onDelete: 'cascade' }),
    row: integer('row').notNull(),
    col: integer('col').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => spreadsheetComments.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    mentionedUserIds: uuid('mentioned_user_ids').array().notNull().default(sql`'{}'::uuid[]`),
    resolved: boolean('resolved').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('spreadsheet_comments_sheet_cell_idx').on(t.sheetId, t.row, t.col),
    check('spreadsheet_comments_body_length', sql`char_length(${t.body}) between 1 and 10000`),
  ],
);
