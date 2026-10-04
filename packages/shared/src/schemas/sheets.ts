import { z } from 'zod';
import { itemNameSchema, templateIdSchema, uuidSchema } from './common';

export const MAX_ROWS = 100_000;
export const MAX_COLS = 702; // A..ZZ
/** Most cells one sheet print may hold. */
export const MAX_PRINT_CELLS = 200_000;

export const createSpreadsheetSchema = z.object({
  title: itemNameSchema.optional(),
  folderId: uuidSchema.optional(),
  /** Start from a template in the Sheets gallery (`@qub/shared/templates`). */
  templateId: templateIdSchema.optional(),
});
export type CreateSpreadsheetInput = z.infer<typeof createSpreadsheetSchema>;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const borderSchema = z.object({ style: z.enum(['thin', 'medium', 'thick']), color: hexColor }).strict();
export type Border = z.infer<typeof borderSchema>;
export const cellValidationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('list'),
      values: z
        .array(z.string().max(255))
        .min(1)
        .max(500)
        .refine((v) => new Set(v).size === v.length, 'List items must be unique'),
    })
    .strict(),
  z.object({ kind: z.literal('checkbox') }).strict(),
]);
export type CellValidation = z.infer<typeof cellValidationSchema>;

export const cellStyleSchema = z
  .object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strike: z.boolean().optional(),
    color: hexColor.optional(),
    background: hexColor.optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    numberFormat: z.enum(['general', 'number', 'currency', 'percent', 'integer', 'date', 'time', 'datetime']).optional(),
    fontSize: z.number().int().min(6).max(72).optional(),
    /** `null` removes wrapping when applied as a style patch. */
    wrap: z.boolean().nullable().optional(),
    /** Per-edge borders; `null` clears an edge (or all edges) when applied as a style patch. */
    borders: z
      .object({ top: borderSchema.nullable().optional(), right: borderSchema.nullable().optional(), bottom: borderSchema.nullable().optional(), left: borderSchema.nullable().optional() })
      .strict()
      .nullable()
      .optional(),
    /** Data validation; `null` removes it when applied as a style patch. */
    validation: cellValidationSchema.nullable().optional(),
  })
  .strict();
export type CellStyle = z.infer<typeof cellStyleSchema>;

const rowSchema = z.number().int().min(0).max(MAX_ROWS - 1);
const colSchema = z.number().int().min(0).max(MAX_COLS - 1);

export const cellRangeSchema = z.object({
  startRow: rowSchema,
  endRow: rowSchema,
  startCol: colSchema,
  endCol: colSchema,
});
export type CellRange = z.infer<typeof cellRangeSchema>;

/**
 * Operations accepted from clients, over REST or the sheets WebSocket.
 * The server is authoritative: it applies each op in order, recalculates dependents and broadcasts the result.
 */
export const sheetOpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setCells'),
    sheetId: uuidSchema,
    cells: z
      .array(z.object({ row: rowSchema, col: colSchema, input: z.string().max(50_000) }))
      .min(1)
      .max(10_000),
  }),
  z.object({
    type: z.literal('setStyle'),
    sheetId: uuidSchema,
    range: cellRangeSchema,
    style: cellStyleSchema,
    /** When true the style replaces rather than merges. */
    replace: z.boolean().default(false),
  }),
  z.object({ type: z.literal('clearRange'), sheetId: uuidSchema, range: cellRangeSchema, formats: z.boolean().default(false) }),
  z.object({ type: z.literal('insertRows'), sheetId: uuidSchema, index: rowSchema, count: z.number().int().min(1).max(1000) }),
  z.object({ type: z.literal('deleteRows'), sheetId: uuidSchema, index: rowSchema, count: z.number().int().min(1).max(1000) }),
  z.object({ type: z.literal('insertCols'), sheetId: uuidSchema, index: colSchema, count: z.number().int().min(1).max(100) }),
  z.object({ type: z.literal('deleteCols'), sheetId: uuidSchema, index: colSchema, count: z.number().int().min(1).max(100) }),
  z.object({
    type: z.literal('sortRange'),
    sheetId: uuidSchema,
    range: cellRangeSchema,
    col: colSchema,
    direction: z.enum(['asc', 'desc']),
    hasHeader: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('findReplace'),
    /** null = every sheet. */
    sheetId: uuidSchema.nullable(),
    find: z.string().min(1).max(1000),
    replace: z.string().max(50_000),
    matchCase: z.boolean().default(false),
    wholeCell: z.boolean().default(false),
    includeFormulas: z.boolean().default(false),
  }),
]);
export type SheetOp = z.input<typeof sheetOpSchema>;
export type ParsedSheetOp = z.output<typeof sheetOpSchema>;

/** Replace-all changes at most this many cells per operation; find returns at most MAX_FIND_RESULTS matches. */
export const MAX_REPLACE_CELLS = 10_000;
export const MAX_FIND_RESULTS = 5_000;

const flag = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');
export const findQuerySchema = z.object({
  q: z.string().min(1).max(1000),
  matchCase: flag,
  wholeCell: flag,
  includeFormulas: flag,
  sheetId: uuidSchema.optional(),
});
export type FindQuery = z.infer<typeof findQuerySchema>;

export const csvImportQuerySchema = z
  .object({ mode: z.enum(['new_sheet', 'replace_sheet']), sheetId: uuidSchema.optional() })
  .refine((q) => q.mode === 'new_sheet' || !!q.sheetId, 'sheetId is required to replace a sheet');
export type CsvImportQuery = z.infer<typeof csvImportQuerySchema>;

export const sheetOpsSchema = z.object({ ops: z.array(sheetOpSchema).min(1).max(100) });

export const cellsQuerySchema = z.object({
  rowStart: z.coerce.number().int().min(0).default(0),
  rowEnd: z.coerce.number().int().min(0).max(MAX_ROWS).default(199),
  colStart: z.coerce.number().int().min(0).default(0),
  colEnd: z.coerce.number().int().min(0).max(MAX_COLS).default(51),
});

export const createWorksheetSchema = z.object({ name: z.string().trim().min(1).max(100).optional() });

export const updateWorksheetSchema = z.object({
  name: z.string().trim().min(1).max(100).refine((v) => !/[!'\[\]*?/\\:]/.test(v), 'Invalid sheet name').optional(),
  position: z.number().int().min(0).optional(),
  frozenRows: z.number().int().min(0).max(50).optional(),
  frozenCols: z.number().int().min(0).max(26).optional(),
  colWidths: z.record(z.string().regex(/^\d+$/), z.number().int().min(20).max(1000)).optional(),
  rowHeights: z.record(z.string().regex(/^\d+$/), z.number().int().min(12).max(500)).optional(),
});
export type UpdateWorksheetInput = z.infer<typeof updateWorksheetSchema>;

export const filterQuerySchema = z.object({
  col: z.coerce.number().int().min(0).max(MAX_COLS - 1),
  op: z.enum(['equals', 'not_equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'empty', 'not_empty']),
  value: z.string().max(1000).default(''),
  headerRow: z.coerce.number().int().min(-1).default(0),
});
export type FilterQuery = z.infer<typeof filterQuerySchema>;

export const createSheetCommentSchema = z.object({
  row: rowSchema,
  col: colSchema,
  body: z.string().trim().min(1).max(10_000),
  parentId: uuidSchema.optional(),
  mentions: z.array(uuidSchema).max(50).default([]),
});
export type CreateSheetCommentInput = z.input<typeof createSheetCommentSchema>;

export const namedRangeSchema = z.object({
  name: z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/, 'Invalid range name'),
  range: cellRangeSchema,
});
