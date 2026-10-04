import type {
  CellDto,
  CellsResult,
  SheetPrintData,
  CreateSpreadsheetInput,
  FilterQuery,
  FindQuery,
  ParsedSheetOp,
  SheetCommentDto,
  SheetOp,
  SheetServerMessage,
  SpreadsheetDto,
  SpreadsheetVersionDto,
  UpdateWorksheetInput,
  WorksheetDto,
} from '@qub/shared';
import { csvImportInput, CsvError, csvLine, MAX_COLS, MAX_FIND_RESULTS, MAX_PRINT_CELLS, MAX_REPLACE_CELLS, MAX_ROWS, parseCsv, presenceColor, sheetOpSchema, type CsvField, type CsvImportQuery } from '@qub/shared';
import { cellKey, deserializeValue, formattedValueOf, isError, parseCellInput, parseCellKey, parseNumberLiteral, replaceInInput, Workbook, type CellChange, type CellValue } from '@qub/shared/formula';
import { buildSheetTemplate, findTemplate } from '@qub/shared/templates';
import { and, asc, desc, eq, max, sql } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import {
  driveFiles,
  spreadsheetCollaborators,
  spreadsheetComments,
  spreadsheetRanges,
  spreadsheets,
  spreadsheetSheets,
  spreadsheetVersions,
  type SpreadsheetSnapshot,
} from '../../db/schema';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors';
import type { NativeResourceRegistry } from '../drive/native-registry';
import type { FileService } from '../files/file.service';
import { toCapabilities, type PermissionService } from '../permissions/permission.service';
import { UserRepository } from '../users/user.repository';
import {
  cellRowValue,
  insertToCellDto,
  SpreadsheetRepository,
  toCellDto,
  toCellInsert,
  toWorksheetDto,
  type CellInsert,
} from './spreadsheet.repository';

const AUTO_VERSION_INTERVAL_MS = 30 * 60 * 1000;
const IDLE_EVICT_MS = 10 * 60 * 1000;

/** Realtime fan-out implemented by the sheets WebSocket hub. */
export interface SheetBroadcaster {
  broadcast(spreadsheetId: string, message: SheetServerMessage): void;
  hasRoom(spreadsheetId: string): boolean;
}

interface LoadedBook {
  wb: Workbook;
  lastUsed: number;
  chain: Promise<unknown>;
}

interface OpEffect {
  structural: { sheetId: string; axis: 'row' | 'col'; kind: 'insert' | 'delete'; index: number; count: number } | null;
  upserts: CellInsert[];
  removals: { sheetId: string; row: number; col: number }[];
}

/**
 * Keeps one authoritative Workbook (with its dependency graph) in memory per active spreadsheet.
 * Every mutation for a spreadsheet runs through a per-spreadsheet queue, so operations are applied one at a time
 * in arrival order — the server-side serialisation that resolves concurrent edits (last writer wins per cell).
 */
class WorkbookCache {
  private readonly books = new Map<string, LoadedBook>();
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly db: Database) {
    this.timer = setInterval(() => this.evictIdle(), 60_000);
    this.timer.unref();
  }

  private async load(spreadsheetId: string): Promise<Workbook> {
    const wb = new Workbook();
    const sheets = await SpreadsheetRepository.sheets(this.db, spreadsheetId);
    for (const s of sheets) wb.addSheet({ id: s.id, name: s.name });
    const cells = await SpreadsheetRepository.allCells(this.db, sheets.map((s) => s.id));
    for (const c of cells) {
      wb.hydrate(c.sheetId, c.row, c.col, { input: c.input, value: deserializeValue(cellRowValue(c), c.dataType), style: c.style ?? null });
    }
    const ranges = await SpreadsheetRepository.namedRanges(this.db, spreadsheetId);
    if (ranges.length) {
      wb.setNamedRanges(
        Object.fromEntries(ranges.map((r) => [r.name, { sheetId: r.sheetId, range: { startRow: r.startRow, endRow: r.endRow, startCol: r.startCol, endCol: r.endCol } }])),
      );
    }
    return wb;
  }

  /** Runs `fn` exclusively for this spreadsheet. On failure the in-memory model is discarded and reloaded next time. */
  run<T>(spreadsheetId: string, fn: (wb: Workbook) => Promise<T>): Promise<T> {
    let entry = this.books.get(spreadsheetId);
    if (!entry) {
      entry = { wb: null as unknown as Workbook, lastUsed: Date.now(), chain: Promise.resolve() };
      this.books.set(spreadsheetId, entry);
    }
    const current = entry;
    const task = current.chain.then(async () => {
      if (!current.wb) current.wb = await this.load(spreadsheetId);
      current.lastUsed = Date.now();
      try {
        return await fn(current.wb);
      } catch (err) {
        this.books.delete(spreadsheetId);
        throw err;
      }
    });
    current.chain = task.catch(() => undefined);
    return task;
  }

  invalidate(spreadsheetId: string): void {
    this.books.delete(spreadsheetId);
  }

  private evictIdle(): void {
    const now = Date.now();
    for (const [id, b] of this.books) if (now - b.lastUsed > IDLE_EVICT_MS) this.books.delete(id);
  }

  close(): void {
    clearInterval(this.timer);
    this.books.clear();
  }
}

export class SpreadsheetService {
  private readonly cache: WorkbookCache;
  private broadcaster: SheetBroadcaster | null = null;
  /**
   * Recently applied clientOpIds per spreadsheet. Clients resend unacknowledged ops after a reconnect and ops are not
   * idempotent (findReplace, insertRows), so a repeat is acknowledged without being applied again.
   */
  private readonly appliedOps = new Map<string, Map<string, { replaced?: { sheetId: string; row: number; col: number; previousInput: string }[] }>>();

  constructor(
    private readonly db: Database,
    private readonly files: FileService,
    private readonly permissions: PermissionService,
    natives: NativeResourceRegistry,
  ) {
    this.cache = new WorkbookCache(db);
    natives.register('SPREADSHEET', { copy: (tx, src, dst, userId) => this.copyInto(tx, src, dst, userId) });
  }

  attachBroadcaster(b: SheetBroadcaster): void {
    this.broadcaster = b;
  }

  close(): void {
    this.cache.close();
  }

  /**
   * Sheets creation flow: drive_files (SPREADSHEET) → spreadsheets → worksheets (+ template cells) → activity.
   * One transaction. Template formulas are evaluated by the same engine that serves edits, so stored values match.
   */
  async create(userId: string, input: CreateSpreadsheetInput, tx?: Executor): Promise<SpreadsheetDto> {
    const template = input.templateId ? findTemplate('SPREADSHEET', input.templateId) : undefined;
    if (input.templateId && !template) throw badRequest('That template doesn’t exist.');
    const run = async (t: Executor) => {
      const title = input.title ?? template?.name ?? 'Untitled spreadsheet';
      const file = await this.files.createNative(t, userId, 'SPREADSHEET', title, input.folderId);
      const [sheet] = await t.insert(spreadsheets).values({ fileId: file.id, createdBy: userId, lastEditedBy: userId }).returning();
      if (!template) {
        await t.insert(spreadsheetSheets).values({ spreadsheetId: sheet!.id, name: 'Sheet1', position: 0 });
        return sheet!;
      }
      const sheetRows = await t
        .insert(spreadsheetSheets)
        .values(
          template.sheets.map((s, position) => ({
            spreadsheetId: sheet!.id,
            name: s.name,
            position,
            frozenRows: s.frozenRows ?? 0,
            colWidths: Object.fromEntries(Object.entries(s.colWidths ?? {}).map(([col, w]) => [String(col), w])),
          })),
        )
        .returning();
      const ids = template.sheets.map((_, i) => sheetRows.find((r) => r.position === i)!.id);
      for (const built of buildSheetTemplate(template, ids)) {
        await SpreadsheetRepository.upsertCells(t, built.cells.map((c) => toCellInsert(built.sheetId, c.row, c.col, c.cell, userId)));
        const maxRow = Math.max(0, ...built.cells.map((c) => c.row));
        const maxCol = Math.max(0, ...built.cells.map((c) => c.col));
        const row = sheetRows.find((r) => r.id === built.sheetId)!;
        if (maxRow >= row.rowCount || maxCol >= row.colCount) {
          await t
            .update(spreadsheetSheets)
            .set({ rowCount: Math.max(row.rowCount, maxRow + 1), colCount: Math.max(row.colCount, maxCol + 1) })
            .where(eq(spreadsheetSheets.id, built.sheetId));
        }
      }
      return sheet!;
    };
    const sheet = tx ? await run(tx) : await this.db.transaction(run);
    return this.get(userId, sheet.id, { recordOpen: false }, tx);
  }

  async access(userId: string, spreadsheetId: string, requirement: 'VIEWER' | 'COMMENTER' | 'EDITOR' = 'VIEWER', tx: Executor = this.db) {
    const row = await SpreadsheetRepository.findById(tx, spreadsheetId);
    if (!row) throw notFound('spreadsheet');
    const access = await this.permissions.requireFile(userId, row.file.id, requirement, tx);
    return { ...row, access };
  }

  async get(userId: string, spreadsheetId: string, opts: { recordOpen?: boolean } = {}, tx: Executor = this.db): Promise<SpreadsheetDto> {
    const { sheet, file, access } = await this.access(userId, spreadsheetId, 'VIEWER', tx);
    if (opts.recordOpen !== false) {
      await this.files.recordOpened(userId, file);
      if (tx === this.db) await this.refreshVolatile(spreadsheetId, userId);
    }
    const [sheets, owners] = await Promise.all([SpreadsheetRepository.sheets(tx, spreadsheetId), UserRepository.summaries(tx, [file.ownerId])]);
    return {
      id: sheet.id,
      fileId: file.id,
      title: file.name,
      folderId: file.folderId,
      owner: owners.get(file.ownerId)!,
      isTrashed: file.isTrashed,
      revision: sheet.revision,
      sheets: sheets.map(toWorksheetDto),
      createdAt: sheet.createdAt.toISOString(),
      updatedAt: sheet.updatedAt.toISOString(),
      capabilities: toCapabilities(access),
    };
  }

  async rename(userId: string, spreadsheetId: string, title: string): Promise<SpreadsheetDto> {
    const { file } = await this.access(userId, spreadsheetId, 'EDITOR');
    await this.files.update(userId, file.id, { name: title });
    return this.get(userId, spreadsheetId, { recordOpen: false });
  }

  async cells(userId: string, spreadsheetId: string, sheetId: string, range: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }): Promise<CellsResult> {
    const { sheet } = await this.access(userId, spreadsheetId);
    await this.requireSheet(spreadsheetId, sheetId);
    return this.readCells(sheet.revision, sheetId, range);
  }

  async readCells(revision: number, sheetId: string, range: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }): Promise<CellsResult> {
    if (range.rowEnd - range.rowStart > 2000 || range.colEnd - range.colStart > 200) throw badRequest('Requested range is too large.');
    const rows = await SpreadsheetRepository.cellsInRange(this.db, sheetId, range);
    return { sheetId, revision, cells: rows.map(toCellDto) };
  }

  private async requireSheet(spreadsheetId: string, sheetId: string, tx: Executor = this.db) {
    const [s] = await tx
      .select()
      .from(spreadsheetSheets)
      .where(and(eq(spreadsheetSheets.id, sheetId), eq(spreadsheetSheets.spreadsheetId, spreadsheetId)))
      .limit(1);
    if (!s) throw notFound('sheet');
    return s;
  }

  /**
   * Applies a batch of operations: validate → apply to the in-memory workbook (recalculating dependents) → persist
   * everything in one transaction → bump the revision → broadcast to collaborators. If persistence fails the model
   * is discarded (reloaded from the database on next use) and nothing is broadcast.
   */
  async applyOps(
    userId: string,
    spreadsheetId: string,
    rawOps: SheetOp[],
    meta: { clientOpId?: string | null; authorClientId?: string | null } = {},
  ): Promise<Extract<SheetServerMessage, { type: 'applied' }>> {
    const ops: ParsedSheetOp[] = rawOps.map((o) => sheetOpSchema.parse(o));
    const { file } = await this.access(userId, spreadsheetId, 'EDITOR');
    if (file.isTrashed) throw badRequest('Restore this spreadsheet from the trash to edit it.');

    return this.cache.run(spreadsheetId, async (wb) => {
      const seen = meta.clientOpId ? this.appliedOps.get(spreadsheetId)?.get(meta.clientOpId) : undefined;
      if (seen && meta.clientOpId) {
        const [current] = await this.db.select({ revision: spreadsheets.revision }).from(spreadsheets).where(eq(spreadsheets.id, spreadsheetId));
        const ack: Extract<SheetServerMessage, { type: 'applied' }> = {
          type: 'applied',
          revision: current!.revision,
          clientOpId: meta.clientOpId,
          authorClientId: meta.authorClientId ?? null,
          ops: [],
          changes: [],
          structural: [],
          replaced: seen.replaced,
        };
        this.broadcaster?.broadcast(spreadsheetId, ack);
        return ack;
      }
      const sheetRows = await SpreadsheetRepository.sheets(this.db, spreadsheetId);
      const sheetIds = new Set(sheetRows.map((s) => s.id));
      for (const op of ops) if (op.sheetId !== null && !sheetIds.has(op.sheetId)) throw notFound('sheet');

      const effects: OpEffect[] = [];
      const replaced: { sheetId: string; row: number; col: number; previousInput: string }[] = [];
      const touched = new Map<string, { maxRow: number; maxCol: number }>();
      const collect = (changes: CellChange[], structural: OpEffect['structural'] = null) => {
        const effect: OpEffect = { structural, upserts: [], removals: [] };
        for (const c of changes) {
          if (c.cell) effect.upserts.push(toCellInsert(c.sheetId, c.row, c.col, c.cell, userId));
          else effect.removals.push({ sheetId: c.sheetId, row: c.row, col: c.col });
        }
        effects.push(effect);
      };
      const bump = (sheetId: string, row: number, col: number) => {
        const t = touched.get(sheetId) ?? { maxRow: 0, maxCol: 0 };
        t.maxRow = Math.max(t.maxRow, row);
        t.maxCol = Math.max(t.maxCol, col);
        touched.set(sheetId, t);
      };

      for (const op of ops) {
        switch (op.type) {
          case 'setCells':
            op.cells.forEach((c) => bump(op.sheetId, c.row, c.col));
            collect(wb.setInputs(op.sheetId, op.cells));
            break;
          case 'setStyle':
            if ((op.range.endRow - op.range.startRow + 1) * (op.range.endCol - op.range.startCol + 1) > 50_000) {
              throw badRequest('Formatting range is too large.');
            }
            collect(wb.setStyle(op.sheetId, op.range, op.style, op.replace));
            break;
          case 'clearRange':
            collect(wb.clearRange(op.sheetId, op.range, op.formats));
            break;
          case 'insertRows':
          case 'deleteRows':
          case 'insertCols':
          case 'deleteCols': {
            const axis = op.type.endsWith('Rows') ? 'row' : 'col';
            const kind = op.type.startsWith('insert') ? 'insert' : 'delete';
            collect(wb.applyStructuralChange(op.sheetId, axis, kind, op.index, op.count), { sheetId: op.sheetId, axis, kind, index: op.index, count: op.count });
            break;
          }
          case 'sortRange':
            collect(wb.sortRange(op.sheetId, op.range, op.col, op.direction, op.hasHeader), { sheetId: op.sheetId, axis: 'row', kind: 'insert', index: 0, count: 0 });
            break;
          case 'findReplace': {
            const targets = op.sheetId ? [op.sheetId] : [...sheetRows].sort((a, b) => a.position - b.position).map((s) => s.id);
            const opts = { find: op.find, matchCase: op.matchCase, wholeCell: op.wholeCell, includeFormulas: op.includeFormulas };
            const matches = wb.findMatches(targets, opts);
            if (matches.length > MAX_REPLACE_CELLS) throw badRequest(`Too many matches to replace at once (${matches.length}). Narrow the search.`);
            const bySheet = new Map<string, { row: number; col: number; input: string }[]>();
            for (const m of matches) {
              const next = replaceInInput(m.input, op.replace, opts)!;
              if (next === m.input) continue;
              // Same limit as typed input; checked before anything is applied (a throw discards the in-memory model).
              if (next.length > 50_000) throw badRequest('Replacing would make a cell longer than 50,000 characters. Use a shorter replacement.');
              replaced.push({ sheetId: m.sheetId, row: m.row, col: m.col, previousInput: m.input });
              bySheet.set(m.sheetId, [...(bySheet.get(m.sheetId) ?? []), { row: m.row, col: m.col, input: next }]);
            }
            for (const [sid, updates] of bySheet) collect(wb.setInputs(sid, updates));
            break;
          }
        }
      }
      // TODAY()/NOW() and their dependents refresh on every edit (Google Sheets' "recalculate on change").
      collect(wb.recalculateVolatile());

      const revision = await this.db.transaction(async (tx) => {
        for (const effect of effects) {
          const s = effect.structural;
          if (s && s.count > 0) {
            await SpreadsheetRepository.shift(tx, s.sheetId, s.axis, s.kind, s.index, s.count);
            const sheet = sheetRows.find((r) => r.id === s.sheetId)!;
            const dim = s.axis === 'row' ? 'rowCount' : 'colCount';
            const limit = s.axis === 'row' ? MAX_ROWS : MAX_COLS;
            const next = Math.min(limit, Math.max(1, sheet[dim] + (s.kind === 'insert' ? s.count : -s.count)));
            sheet[dim] = next;
            await tx.update(spreadsheetSheets).set({ [dim]: next }).where(eq(spreadsheetSheets.id, s.sheetId));
          }
          const bySheet = new Map<string, { row: number; col: number }[]>();
          for (const r of effect.removals) {
            const list = bySheet.get(r.sheetId) ?? [];
            list.push(r);
            bySheet.set(r.sheetId, list);
          }
          for (const [sheetId, positions] of bySheet) await SpreadsheetRepository.deleteCells(tx, sheetId, positions);
          await SpreadsheetRepository.upsertCells(tx, effect.upserts);
        }
        for (const [sheetId, t] of touched) {
          const sheet = sheetRows.find((r) => r.id === sheetId)!;
          if (t.maxRow >= sheet.rowCount || t.maxCol >= sheet.colCount) {
            sheet.rowCount = Math.max(sheet.rowCount, Math.min(MAX_ROWS, t.maxRow + 1));
            sheet.colCount = Math.max(sheet.colCount, Math.min(MAX_COLS, t.maxCol + 1));
            await tx.update(spreadsheetSheets).set({ rowCount: sheet.rowCount, colCount: sheet.colCount }).where(eq(spreadsheetSheets.id, sheetId));
          }
        }
        const [updated] = await tx
          .update(spreadsheets)
          .set({ revision: sql`${spreadsheets.revision} + 1`, lastEditedBy: userId, updatedAt: new Date() })
          .where(eq(spreadsheets.id, spreadsheetId))
          .returning({ revision: spreadsheets.revision });
        await tx.update(driveFiles).set({ updatedAt: new Date() }).where(eq(driveFiles.id, file.id));
        await this.files.recordEdited(userId, file, tx);
        await this.maybeAutoVersion(tx, spreadsheetId, updated!.revision, userId);
        return updated!.revision;
      });

      // Merge per-sheet changes (later ops win). Sheets with structural changes are refetched by clients instead.
      const structural = [...new Set(effects.filter((e) => e.structural).map((e) => e.structural!.sheetId))];
      const merged = new Map<string, { cells: Map<string, CellDto>; removed: Map<string, { row: number; col: number }> }>();
      for (const effect of effects) {
        for (const u of effect.upserts) {
          if (structural.includes(u.sheetId)) continue;
          const m = merged.get(u.sheetId) ?? { cells: new Map(), removed: new Map() };
          m.cells.set(`${u.row}:${u.col}`, insertToCellDto(u));
          m.removed.delete(`${u.row}:${u.col}`);
          merged.set(u.sheetId, m);
        }
        for (const r of effect.removals) {
          if (structural.includes(r.sheetId)) continue;
          const m = merged.get(r.sheetId) ?? { cells: new Map(), removed: new Map() };
          m.removed.set(`${r.row}:${r.col}`, { row: r.row, col: r.col });
          m.cells.delete(`${r.row}:${r.col}`);
          merged.set(r.sheetId, m);
        }
      }
      const message: Extract<SheetServerMessage, { type: 'applied' }> = {
        type: 'applied',
        revision,
        clientOpId: meta.clientOpId ?? null,
        authorClientId: meta.authorClientId ?? null,
        ops,
        changes: [...merged].map(([sheetId, m]) => ({ sheetId, cells: [...m.cells.values()], removed: [...m.removed.values()] })),
        structural,
        sheets: structural.length || touched.size ? sheetRows.map(toWorksheetDto) : undefined,
        replaced: replaced.length ? replaced : undefined,
      };
      if (meta.clientOpId) {
        const recent = this.appliedOps.get(spreadsheetId) ?? new Map();
        recent.set(meta.clientOpId, { replaced: message.replaced });
        if (recent.size > 500) recent.delete(recent.keys().next().value!);
        this.appliedOps.set(spreadsheetId, recent);
      }
      this.broadcaster?.broadcast(spreadsheetId, message);
      return message;
    });
  }

  private async maybeAutoVersion(tx: Executor, spreadsheetId: string, revision: number, userId: string): Promise<void> {
    const [latest] = await tx
      .select({ createdAt: spreadsheetVersions.createdAt })
      .from(spreadsheetVersions)
      .where(eq(spreadsheetVersions.spreadsheetId, spreadsheetId))
      .orderBy(desc(spreadsheetVersions.versionNumber))
      .limit(1);
    if (latest && Date.now() - latest.createdAt.getTime() < AUTO_VERSION_INTERVAL_MS) return;
    await this.insertVersion(tx, spreadsheetId, revision, userId, null, true);
  }

  private async snapshot(tx: Executor, spreadsheetId: string): Promise<SpreadsheetSnapshot> {
    const sheets = await SpreadsheetRepository.sheets(tx, spreadsheetId);
    const cells = await SpreadsheetRepository.allCells(tx, sheets.map((s) => s.id));
    return {
      sheets: sheets.map((s) => ({
        id: s.id,
        name: s.name,
        position: s.position,
        frozenRows: s.frozenRows,
        frozenCols: s.frozenCols,
        colWidths: s.colWidths,
        rowHeights: s.rowHeights,
        cells: cells.filter((c) => c.sheetId === s.id).map((c) => ({ row: c.row, col: c.col, input: c.input, style: c.style ?? null })),
      })),
    };
  }

  private async insertVersion(tx: Executor, spreadsheetId: string, revision: number, userId: string, name: string | null, isAuto: boolean) {
    const snapshot = await this.snapshot(tx, spreadsheetId);
    const [n] = await tx.select({ n: max(spreadsheetVersions.versionNumber) }).from(spreadsheetVersions).where(eq(spreadsheetVersions.spreadsheetId, spreadsheetId));
    const [row] = await tx
      .insert(spreadsheetVersions)
      .values({
        spreadsheetId,
        versionNumber: (n?.n ?? 0) + 1,
        name,
        revision,
        snapshot,
        cellCount: snapshot.sheets.reduce((a, s) => a + s.cells.length, 0),
        isAuto,
        createdBy: userId,
      })
      .returning();
    return row!;
  }

  // ---------- worksheets ----------

  private async broadcastSheets(spreadsheetId: string, changes: CellChange[] = [], userId: string | null = null) {
    const sheets = (await SpreadsheetRepository.sheets(this.db, spreadsheetId)).map(toWorksheetDto);
    if (changes.length) {
      const bySheet = new Map<string, CellDto[]>();
      const removed = new Map<string, { row: number; col: number }[]>();
      for (const c of changes) {
        if (c.cell) {
          const list = bySheet.get(c.sheetId) ?? [];
          list.push(insertToCellDto(toCellInsert(c.sheetId, c.row, c.col, c.cell, userId)));
          bySheet.set(c.sheetId, list);
        } else {
          const list = removed.get(c.sheetId) ?? [];
          list.push({ row: c.row, col: c.col });
          removed.set(c.sheetId, list);
        }
      }
      const [s] = await this.db.select({ revision: spreadsheets.revision }).from(spreadsheets).where(eq(spreadsheets.id, spreadsheetId));
      this.broadcaster?.broadcast(spreadsheetId, {
        type: 'applied',
        revision: s?.revision ?? 0,
        clientOpId: null,
        authorClientId: null,
        ops: [],
        changes: [...new Set([...bySheet.keys(), ...removed.keys()])].map((id) => ({ sheetId: id, cells: bySheet.get(id) ?? [], removed: removed.get(id) ?? [] })),
        structural: [],
        sheets,
      });
    } else {
      this.broadcaster?.broadcast(spreadsheetId, { type: 'sheets', sheets });
    }
    return sheets;
  }

  /** Cells matching a search across one sheet or all (by position). */
  async find(userId: string, spreadsheetId: string, q: FindQuery): Promise<{ matches: { sheetId: string; row: number; col: number }[]; total: number }> {
    await this.access(userId, spreadsheetId);
    const sheetRows = await SpreadsheetRepository.sheets(this.db, spreadsheetId);
    if (q.sheetId && !sheetRows.some((s) => s.id === q.sheetId)) throw notFound('sheet');
    const targets = q.sheetId ? [q.sheetId] : [...sheetRows].sort((a, b) => a.position - b.position).map((s) => s.id);
    return this.cache.run(spreadsheetId, async (wb) => {
      const all = wb.findMatches(targets, { find: q.q, matchCase: q.matchCase, wholeCell: q.wholeCell, includeFormulas: q.includeFormulas });
      return { matches: all.slice(0, MAX_FIND_RESULTS).map(({ sheetId, row, col }) => ({ sheetId, row, col })), total: all.length };
    });
  }

  /** The used range of a sheet as CSV (formatted values). Requires download permission. */
  /** A sheet's layout and all of its cells for printing (printing counts as downloading). */
  async printData(userId: string, spreadsheetId: string, sheetId: string): Promise<SheetPrintData> {
    const dto = await this.get(userId, spreadsheetId, { recordOpen: false });
    if (!dto.capabilities.canDownload) throw forbidden('Printing is turned off for this spreadsheet.');
    const sheet = dto.sheets.find((s) => s.id === sheetId);
    if (!sheet) throw notFound('sheet');
    const rows = await SpreadsheetRepository.allCells(this.db, [sheetId]);
    if (rows.length > MAX_PRINT_CELLS) throw badRequest(`This sheet is too large to print (more than ${MAX_PRINT_CELLS.toLocaleString('en-US')} cells).`);
    return { spreadsheetTitle: dto.title, sheet, cells: rows.map(toCellDto) };
  }

  async exportCsv(userId: string, spreadsheetId: string, sheetId: string): Promise<{ filename: string; body: string }> {
    const dto = await this.get(userId, spreadsheetId, { recordOpen: false });
    if (!dto.capabilities.canDownload) throw forbidden('Downloading is turned off for this spreadsheet.');
    const sheet = dto.sheets.find((s) => s.id === sheetId);
    if (!sheet) throw notFound('sheet');
    return this.cache.run(spreadsheetId, async (wb) => {
      const cells = wb.sheetCells(sheetId);
      let lastRow = -1;
      let lastCol = -1;
      for (const [key, cell] of cells) {
        if (cell.input === '') continue;
        const { row, col } = parseCellKey(key);
        lastRow = Math.max(lastRow, row);
        lastCol = Math.max(lastCol, col);
      }
      // Built line by line from strings: a sparse sheet with one far-away cell must not materialise every empty cell.
      const empty = ','.repeat(Math.max(0, lastCol)) + '\r\n';
      const byRow = new Map<number, { col: number; field: CsvField }[]>();
      for (const [key, cell] of cells) {
        if (cell.input === '') continue;
        const { row, col } = parseCellKey(key);
        byRow.set(row, [...(byRow.get(row) ?? []), { col, field: { text: formattedValueOf(cell), isText: typeof cell.value === 'string' } }]);
      }
      const lines: string[] = ['﻿'];
      for (let r = 0; r <= lastRow; r++) {
        const filled = byRow.get(r);
        if (!filled) {
          lines.push(empty);
          continue;
        }
        const fields: CsvField[] = Array.from({ length: lastCol + 1 }, () => ({ text: '', isText: false }));
        for (const f of filled) fields[f.col] = f.field;
        lines.push(csvLine(fields));
      }
      return { filename: `${dto.title} - ${sheet.name}.csv`, body: lines.join('') };
    });
  }

  /**
   * Imports CSV text into a new sheet or over an existing one, as one revision after saving a "Before CSV import"
   * version. Values are typed like user input, but nothing in a CSV can become a formula.
   */
  async importCsv(userId: string, spreadsheetId: string, q: CsvImportQuery, filename: string, text: string): Promise<{ sheetId: string; rows: number; cols: number }> {
    const { file, sheet: book } = await this.access(userId, spreadsheetId, 'EDITOR');
    if (file.isTrashed) throw badRequest('Restore this spreadsheet from the trash to edit it.');
    let grid: string[][];
    try {
      grid = parseCsv(text);
    } catch (e) {
      if (e instanceof CsvError) throw badRequest(`Couldn’t read the CSV: ${e.message} (line ${e.line}).`);
      throw e;
    }
    const cols = grid.reduce((n, r) => Math.max(n, r.length), 0);
    const filled = grid.reduce((n, r) => n + r.filter((v) => v !== '').length, 0);
    if (grid.length > 100_000 || cols > MAX_COLS || filled > 1_000_000) throw badRequest('File too large to import (limit: 100,000 rows, 702 columns, 1,000,000 cells).');

    return this.cache.run(spreadsheetId, async (wb) => {
      const sheetRows = await SpreadsheetRepository.sheets(this.db, spreadsheetId);
      let targetId = q.sheetId ?? '';
      if (q.mode === 'replace_sheet' && !sheetRows.some((s) => s.id === targetId)) throw notFound('sheet');
      const updates: { row: number; col: number; input: string }[] = [];
      grid.forEach((r, row) => r.forEach((v, col) => v !== '' && updates.push({ row, col, input: csvImportInput(v) })));
      const cleared: CellChange[] = [];
      const otherSheets: string[] = [];

      await this.db.transaction(async (tx) => {
        await this.insertVersion(tx, spreadsheetId, book.revision, userId, 'Before CSV import', false);
        if (q.mode === 'new_sheet') {
          if (sheetRows.length >= 200) throw badRequest('A spreadsheet can have at most 200 sheets.');
          const taken = new Set(sheetRows.map((s) => s.name.toLowerCase()));
          const base = (filename.replace(/\.[^.]*$/, '').replace(/[!'[\]*?/\\:]/g, ' ').trim() || 'Imported').slice(0, 90);
          let name = base;
          for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n})`;
          const [created] = await tx
            .insert(spreadsheetSheets)
            .values({ spreadsheetId, name, position: Math.max(-1, ...sheetRows.map((s) => s.position)) + 1, rowCount: Math.max(1000, grid.length), colCount: Math.max(26, cols) })
            .returning();
          targetId = created!.id;
          wb.addSheet({ id: targetId, name });
        } else {
          await SpreadsheetRepository.deleteSheetCells(tx, targetId);
          cleared.push(...wb.clearRange(targetId, { startRow: 0, endRow: MAX_ROWS - 1, startCol: 0, endCol: MAX_COLS - 1 }, true));
          const current = sheetRows.find((s) => s.id === targetId)!;
          // Row heights were sized for the old content (e.g. wrapped text); column widths and frozen panes are kept.
          await tx
            .update(spreadsheetSheets)
            .set({ rowCount: Math.max(current.rowCount, grid.length), colCount: Math.max(current.colCount, cols), rowHeights: {} })
            .where(eq(spreadsheetSheets.id, targetId));
        }
        const changes = updates.length ? wb.setInputs(targetId, updates) : [];
        // Formulas elsewhere that read this sheet (or referenced its name) recalculate — including the effect of
        // clearing it. One entry per cell, latest state wins (a batch upsert cannot touch the same row twice).
        const latest = new Map<string, CellChange>();
        for (const c of [...cleared, ...changes, ...wb.recalculateAll()]) if (c.sheetId !== targetId) latest.set(`${c.sheetId}:${c.row}:${c.col}`, c);
        const others = [...latest.values()];
        otherSheets.push(...new Set(others.map((c) => c.sheetId)));
        const rows: CellInsert[] = [];
        for (const [key, cell] of wb.sheetCells(targetId)) {
          const { row, col } = parseCellKey(key);
          rows.push(toCellInsert(targetId, row, col, cell, userId));
        }
        await SpreadsheetRepository.upsertCells(tx, rows);
        await this.persistChanges(tx, others, userId);
        await tx.update(spreadsheets).set({ revision: sql`${spreadsheets.revision} + 1`, lastEditedBy: userId, updatedAt: new Date() }).where(eq(spreadsheets.id, spreadsheetId));
        await tx.update(driveFiles).set({ updatedAt: new Date() }).where(eq(driveFiles.id, file.id));
        await this.files.recordEdited(userId, file, tx);
      });

      const sheets = (await SpreadsheetRepository.sheets(this.db, spreadsheetId)).map(toWorksheetDto);
      const [s] = await this.db.select({ revision: spreadsheets.revision }).from(spreadsheets).where(eq(spreadsheets.id, spreadsheetId));
      this.broadcaster?.broadcast(spreadsheetId, { type: 'applied', revision: s!.revision, clientOpId: null, authorClientId: null, ops: [], changes: [], structural: [targetId, ...otherSheets], sheets });
      return { sheetId: targetId, rows: grid.length, cols };
    });
  }

  /** TODAY()/NOW() values are refreshed when a spreadsheet is opened, so a sheet opened on a later day is current. */
  private async refreshVolatile(spreadsheetId: string, userId: string): Promise<void> {
    if (!(await SpreadsheetRepository.hasVolatileFormulas(this.db, spreadsheetId))) return;
    await this.cache.run(spreadsheetId, async (wb) => {
      const changes = wb.recalculateVolatile();
      if (changes.length) await this.db.transaction((tx) => this.persistChanges(tx, changes, userId));
    });
  }

  private async persistChanges(tx: Executor, changes: CellChange[], userId: string) {
    const upserts = changes.filter((c) => c.cell).map((c) => toCellInsert(c.sheetId, c.row, c.col, c.cell!, userId));
    await SpreadsheetRepository.upsertCells(tx, upserts);
    const removals = changes.filter((c) => !c.cell);
    for (const sheetId of new Set(removals.map((r) => r.sheetId))) {
      await SpreadsheetRepository.deleteCells(tx, sheetId, removals.filter((r) => r.sheetId === sheetId));
    }
    if (changes.length) {
      const sheetId = changes[0]!.sheetId;
      const [s] = await tx.select({ spreadsheetId: spreadsheetSheets.spreadsheetId }).from(spreadsheetSheets).where(eq(spreadsheetSheets.id, sheetId));
      if (s) await tx.update(spreadsheets).set({ revision: sql`${spreadsheets.revision} + 1` }).where(eq(spreadsheets.id, s.spreadsheetId));
    }
  }

  async addSheet(userId: string, spreadsheetId: string, name?: string): Promise<WorksheetDto[]> {
    await this.access(userId, spreadsheetId, 'EDITOR');
    return this.cache.run(spreadsheetId, async (wb) => {
      const existing = await SpreadsheetRepository.sheets(this.db, spreadsheetId);
      if (existing.length >= 200) throw badRequest('A spreadsheet can have at most 200 sheets.');
      const taken = new Set(existing.map((s) => s.name.toLowerCase()));
      let finalName = name?.trim();
      if (finalName && taken.has(finalName.toLowerCase())) throw conflict(`A sheet named "${finalName}" already exists.`);
      if (!finalName) {
        let n = existing.length + 1;
        while (taken.has(`sheet${n}`)) n++;
        finalName = `Sheet${n}`;
      }
      const [created] = await this.db
        .insert(spreadsheetSheets)
        .values({ spreadsheetId, name: finalName, position: Math.max(-1, ...existing.map((s) => s.position)) + 1 })
        .returning();
      wb.addSheet({ id: created!.id, name: finalName });
      // Formulas that referenced a sheet by this name (showing #REF!) now resolve.
      const changes = wb.recalculateAll();
      await this.db.transaction((tx) => this.persistChanges(tx, changes, userId));
      return this.broadcastSheets(spreadsheetId, changes, userId);
    });
  }

  async updateSheet(userId: string, spreadsheetId: string, sheetId: string, input: UpdateWorksheetInput): Promise<WorksheetDto[]> {
    await this.access(userId, spreadsheetId, 'EDITOR');
    return this.cache.run(spreadsheetId, async (wb) => {
      const sheet = await this.requireSheet(spreadsheetId, sheetId);
      let changes: CellChange[] = [];
      await this.db.transaction(async (tx) => {
        if (input.name && input.name !== sheet.name) {
          const clash = (await SpreadsheetRepository.sheets(tx, spreadsheetId)).some((s) => s.id !== sheetId && s.name.toLowerCase() === input.name!.toLowerCase());
          if (clash) throw conflict(`A sheet named "${input.name}" already exists.`);
          changes = wb.renameSheet(sheetId, input.name);
          await this.persistChanges(tx, changes, userId);
        }
        if (input.position !== undefined) {
          const all = await SpreadsheetRepository.sheets(tx, spreadsheetId);
          const ordered = all.filter((s) => s.id !== sheetId);
          ordered.splice(Math.min(input.position, ordered.length), 0, sheet);
          for (const [i, s] of ordered.entries()) await tx.update(spreadsheetSheets).set({ position: i }).where(eq(spreadsheetSheets.id, s.id));
        }
        await tx
          .update(spreadsheetSheets)
          .set({
            ...(input.name ? { name: input.name } : {}),
            ...(input.frozenRows !== undefined ? { frozenRows: input.frozenRows } : {}),
            ...(input.frozenCols !== undefined ? { frozenCols: input.frozenCols } : {}),
            ...(input.colWidths ? { colWidths: { ...sheet.colWidths, ...input.colWidths } } : {}),
            ...(input.rowHeights ? { rowHeights: { ...sheet.rowHeights, ...input.rowHeights } } : {}),
          })
          .where(eq(spreadsheetSheets.id, sheetId));
      });
      return this.broadcastSheets(spreadsheetId, changes, userId);
    });
  }

  async deleteSheet(userId: string, spreadsheetId: string, sheetId: string): Promise<WorksheetDto[]> {
    await this.access(userId, spreadsheetId, 'EDITOR');
    return this.cache.run(spreadsheetId, async (wb) => {
      await this.requireSheet(spreadsheetId, sheetId);
      const all = await SpreadsheetRepository.sheets(this.db, spreadsheetId);
      if (all.length <= 1) throw badRequest('A spreadsheet must keep at least one sheet.');
      const changes = wb.removeSheet(sheetId);
      await this.db.transaction(async (tx) => {
        await tx.delete(spreadsheetSheets).where(eq(spreadsheetSheets.id, sheetId));
        await this.persistChanges(tx, changes.filter((c) => c.sheetId !== sheetId), userId);
      });
      return this.broadcastSheets(spreadsheetId, changes.filter((c) => c.sheetId !== sheetId), userId);
    });
  }

  // ---------- filter ----------

  /** Rows (below the header) whose value in `col` matches the condition, evaluated on computed values. */
  async filterRows(userId: string, spreadsheetId: string, sheetId: string, q: FilterQuery): Promise<{ rows: number[]; lastRow: number }> {
    await this.access(userId, spreadsheetId);
    await this.requireSheet(spreadsheetId, sheetId);
    return this.cache.run(spreadsheetId, async (wb) => {
      const cells = wb.sheetCells(sheetId);
      let lastRow = q.headerRow;
      for (const key of cells.keys()) lastRow = Math.max(lastRow, Number(key.slice(0, key.indexOf(':'))));
      const needle = q.value.toLowerCase();
      const num = parseNumberLiteral(q.value);
      const test = (v: CellValue): boolean => {
        const empty = v === null || v === '';
        const text = v === null ? '' : isError(v) ? v.code : String(v).toLowerCase();
        const n = typeof v === 'number' ? v : typeof v === 'string' ? parseNumberLiteral(v) : null;
        switch (q.op) {
          case 'empty':
            return empty;
          case 'not_empty':
            return !empty;
          case 'equals':
            return num !== null && n !== null ? n === num : text === needle;
          case 'not_equals':
            return num !== null && n !== null ? n !== num : text !== needle;
          case 'contains':
            return text.includes(needle);
          case 'gt':
            return n !== null && num !== null && n > num;
          case 'lt':
            return n !== null && num !== null && n < num;
          case 'gte':
            return n !== null && num !== null && n >= num;
          case 'lte':
            return n !== null && num !== null && n <= num;
        }
      };
      const rows: number[] = [];
      for (let r = q.headerRow + 1; r <= lastRow; r++) {
        if (test(wb.getCell(sheetId, r, q.col)?.value ?? null)) rows.push(r);
      }
      return { rows, lastRow };
    });
  }

  // ---------- named ranges ----------

  async setNamedRange(userId: string, spreadsheetId: string, sheetId: string, name: string, range: { startRow: number; endRow: number; startCol: number; endCol: number }) {
    await this.access(userId, spreadsheetId, 'EDITOR');
    await this.requireSheet(spreadsheetId, sheetId);
    return this.cache.run(spreadsheetId, async (wb) => {
      await this.db.transaction(async (tx) => {
        // Names are unique case-insensitively (expression index), so replace any existing definition.
        await tx
          .delete(spreadsheetRanges)
          .where(and(eq(spreadsheetRanges.spreadsheetId, spreadsheetId), sql`upper(${spreadsheetRanges.name}) = upper(${name})`));
        await tx.insert(spreadsheetRanges).values({ spreadsheetId, sheetId, name, ...range, createdBy: userId });
      });
      const ranges = await SpreadsheetRepository.namedRanges(this.db, spreadsheetId);
      const changes = wb.setNamedRanges(Object.fromEntries(ranges.map((r) => [r.name, { sheetId: r.sheetId, range: { startRow: r.startRow, endRow: r.endRow, startCol: r.startCol, endCol: r.endCol } }])));
      await this.db.transaction((tx) => this.persistChanges(tx, changes, userId));
      await this.broadcastSheets(spreadsheetId, changes, userId);
      return ranges.map((r) => ({ id: r.id, name: r.name, sheetId: r.sheetId, startRow: r.startRow, endRow: r.endRow, startCol: r.startCol, endCol: r.endCol }));
    });
  }

  async listNamedRanges(userId: string, spreadsheetId: string) {
    await this.access(userId, spreadsheetId);
    const ranges = await SpreadsheetRepository.namedRanges(this.db, spreadsheetId);
    return ranges.map((r) => ({ id: r.id, name: r.name, sheetId: r.sheetId, startRow: r.startRow, endRow: r.endRow, startCol: r.startCol, endCol: r.endCol }));
  }

  // ---------- versions ----------

  async listVersions(userId: string, spreadsheetId: string): Promise<SpreadsheetVersionDto[]> {
    await this.access(userId, spreadsheetId);
    const rows = await this.db
      .select({ id: spreadsheetVersions.id, versionNumber: spreadsheetVersions.versionNumber, name: spreadsheetVersions.name, createdBy: spreadsheetVersions.createdBy, createdAt: spreadsheetVersions.createdAt, cellCount: spreadsheetVersions.cellCount })
      .from(spreadsheetVersions)
      .where(eq(spreadsheetVersions.spreadsheetId, spreadsheetId))
      .orderBy(desc(spreadsheetVersions.versionNumber))
      .limit(200);
    const users = await UserRepository.summaries(this.db, rows.map((r) => r.createdBy!).filter(Boolean));
    return rows.map((r) => ({ ...r, createdBy: r.createdBy ? (users.get(r.createdBy) ?? null) : null, createdAt: r.createdAt.toISOString() }));
  }

  async createVersion(userId: string, spreadsheetId: string, name?: string): Promise<SpreadsheetVersionDto[]> {
    const { sheet } = await this.access(userId, spreadsheetId, 'EDITOR');
    await this.cache.run(spreadsheetId, () => this.db.transaction((tx) => this.insertVersion(tx, spreadsheetId, sheet.revision, userId, name?.trim() || null, false)));
    return this.listVersions(userId, spreadsheetId);
  }

  /** Replaces the spreadsheet with a snapshot (current state is snapshotted first), recalculates and notifies clients. */
  async restoreVersion(userId: string, spreadsheetId: string, versionId: string): Promise<SpreadsheetDto> {
    const { sheet } = await this.access(userId, spreadsheetId, 'EDITOR');
    await this.cache.run(spreadsheetId, async () => {
      const [version] = await this.db
        .select()
        .from(spreadsheetVersions)
        .where(and(eq(spreadsheetVersions.id, versionId), eq(spreadsheetVersions.spreadsheetId, spreadsheetId)))
        .limit(1);
      if (!version) throw notFound('version');
      const wb = new Workbook();
      for (const s of version.snapshot.sheets) wb.addSheet({ id: s.id, name: s.name });
      for (const s of version.snapshot.sheets) {
        // Snapshots store inputs only: literals are parsed here, formulas are computed by recalculateAll below.
        for (const c of s.cells) wb.hydrate(s.id, c.row, c.col, { input: c.input, value: parseCellInput(c.input).value, style: c.style });
      }
      wb.recalculateAll();
      await this.db.transaction(async (tx) => {
        await this.insertVersion(tx, spreadsheetId, sheet.revision, userId, `Before restoring version ${version.versionNumber}`, false);
        await tx.delete(spreadsheetSheets).where(eq(spreadsheetSheets.spreadsheetId, spreadsheetId));
        for (const s of version.snapshot.sheets) {
          await tx.insert(spreadsheetSheets).values({
            id: s.id,
            spreadsheetId,
            name: s.name,
            position: s.position,
            frozenRows: s.frozenRows,
            frozenCols: s.frozenCols,
            colWidths: s.colWidths,
            rowHeights: s.rowHeights,
          });
          const rows: CellInsert[] = [];
          for (const c of s.cells) rows.push(toCellInsert(s.id, c.row, c.col, wb.getCell(s.id, c.row, c.col)!, userId));
          await SpreadsheetRepository.upsertCells(tx, rows);
        }
        await tx.update(spreadsheets).set({ revision: sql`${spreadsheets.revision} + 1`, lastEditedBy: userId }).where(eq(spreadsheets.id, spreadsheetId));
      });
      this.cache.invalidate(spreadsheetId);
      const sheets = (await SpreadsheetRepository.sheets(this.db, spreadsheetId)).map(toWorksheetDto);
      const [s] = await this.db.select({ revision: spreadsheets.revision }).from(spreadsheets).where(eq(spreadsheets.id, spreadsheetId));
      this.broadcaster?.broadcast(spreadsheetId, {
        type: 'applied',
        revision: s!.revision,
        clientOpId: null,
        authorClientId: null,
        ops: [],
        changes: [],
        structural: sheets.map((x) => x.id),
        sheets,
      });
    });
    return this.get(userId, spreadsheetId, { recordOpen: false });
  }

  // ---------- comments ----------

  async listComments(userId: string, spreadsheetId: string, sheetId: string): Promise<SheetCommentDto[]> {
    await this.access(userId, spreadsheetId);
    await this.requireSheet(spreadsheetId, sheetId);
    const rows = await this.db.select().from(spreadsheetComments).where(eq(spreadsheetComments.sheetId, sheetId)).orderBy(asc(spreadsheetComments.createdAt));
    const users = await UserRepository.summaries(this.db, rows.map((r) => r.authorId));
    return rows.map((r) => ({
      id: r.id,
      sheetId: r.sheetId,
      row: r.row,
      col: r.col,
      parentId: r.parentId,
      body: r.body,
      author: users.get(r.authorId)!,
      resolved: r.resolved,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async addComment(userId: string, spreadsheetId: string, sheetId: string, input: { row: number; col: number; body: string; parentId?: string; mentions: string[] }) {
    await this.access(userId, spreadsheetId, 'COMMENTER');
    await this.requireSheet(spreadsheetId, sheetId);
    if (input.parentId) {
      const [parent] = await this.db.select().from(spreadsheetComments).where(and(eq(spreadsheetComments.id, input.parentId), eq(spreadsheetComments.sheetId, sheetId))).limit(1);
      if (!parent) throw notFound('comment');
    }
    await this.db.insert(spreadsheetComments).values({ spreadsheetId, sheetId, row: input.row, col: input.col, parentId: input.parentId ?? null, authorId: userId, body: input.body, mentionedUserIds: input.mentions });
    return this.listComments(userId, spreadsheetId, sheetId);
  }

  async resolveComment(userId: string, spreadsheetId: string, commentId: string, resolved: boolean) {
    await this.access(userId, spreadsheetId, 'COMMENTER');
    const [row] = await this.db.update(spreadsheetComments).set({ resolved }).where(and(eq(spreadsheetComments.id, commentId), eq(spreadsheetComments.spreadsheetId, spreadsheetId))).returning();
    if (!row) throw notFound('comment');
  }

  async deleteComment(userId: string, spreadsheetId: string, commentId: string) {
    const { access } = await this.access(userId, spreadsheetId, 'COMMENTER');
    const [row] = await this.db.select().from(spreadsheetComments).where(and(eq(spreadsheetComments.id, commentId), eq(spreadsheetComments.spreadsheetId, spreadsheetId))).limit(1);
    if (!row) throw notFound('comment');
    if (row.authorId !== userId && access.role !== 'EDITOR' && access.role !== 'OWNER') throw forbidden();
    await this.db.delete(spreadsheetComments).where(eq(spreadsheetComments.id, commentId));
  }

  // ---------- collaboration & copy ----------

  async touchCollaborator(spreadsheetId: string, userId: string): Promise<string> {
    const color = presenceColor(userId);
    await this.db
      .insert(spreadsheetCollaborators)
      .values({ spreadsheetId, userId, color })
      .onConflictDoUpdate({ target: [spreadsheetCollaborators.spreadsheetId, spreadsheetCollaborators.userId], set: { lastSeenAt: new Date() } });
    return color;
  }

  private async copyInto(tx: Executor, sourceFileId: string, targetFileId: string, userId: string): Promise<void> {
    const source = await SpreadsheetRepository.findByFileId(tx, sourceFileId);
    if (!source) return;
    const [copy] = await tx.insert(spreadsheets).values({ fileId: targetFileId, createdBy: userId, lastEditedBy: userId }).returning();
    const sheets = await SpreadsheetRepository.sheets(tx, source.id);
    const idMap = new Map<string, string>();
    for (const s of sheets) {
      const [created] = await tx
        .insert(spreadsheetSheets)
        .values({ spreadsheetId: copy!.id, name: s.name, position: s.position, rowCount: s.rowCount, colCount: s.colCount, frozenRows: s.frozenRows, frozenCols: s.frozenCols, colWidths: s.colWidths, rowHeights: s.rowHeights })
        .returning();
      idMap.set(s.id, created!.id);
    }
    const cells = await SpreadsheetRepository.allCells(tx, sheets.map((s) => s.id));
    await SpreadsheetRepository.upsertCells(
      tx,
      cells.map(({ updatedAt: _u, ...c }) => ({ ...c, sheetId: idMap.get(c.sheetId)!, updatedBy: userId })),
    );
    const ranges = await SpreadsheetRepository.namedRanges(tx, source.id);
    for (const { id: _id, createdAt: _c, ...r } of ranges) {
      await tx.insert(spreadsheetRanges).values({ ...r, spreadsheetId: copy!.id, sheetId: idMap.get(r.sheetId)!, createdBy: userId });
    }
  }

  /** Read-only data for public share links (access is checked by the caller against the link). */
  async publicView(spreadsheetId: string) {
    const row = await SpreadsheetRepository.findById(this.db, spreadsheetId);
    if (!row) throw notFound('spreadsheet');
    const sheets = await SpreadsheetRepository.sheets(this.db, spreadsheetId);
    return { id: row.sheet.id, title: row.file.name, revision: row.sheet.revision, sheets: sheets.map(toWorksheetDto) };
  }

  async publicCells(spreadsheetId: string, sheetId: string, range: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }) {
    await this.requireSheet(spreadsheetId, sheetId);
    const row = await SpreadsheetRepository.findById(this.db, spreadsheetId);
    return this.readCells(row!.sheet.revision, sheetId, range);
  }
}
