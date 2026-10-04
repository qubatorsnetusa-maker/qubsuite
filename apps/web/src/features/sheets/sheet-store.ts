import type { CellDto, CellStyle, SheetOp, SheetPresenceState, SheetServerMessage, WorksheetDto } from '@qub/shared';
import { formatValue, mergeStyle, parseCellInput } from '@qub/shared/formula';
import { sheetsService } from '@/services/sheets';

export const ROW_CHUNK = 100;
export const COL_CHUNK = 26;

export const cellKey = (r: number, c: number) => `${r}:${c}`;

interface PendingOp {
  clientOpId: string;
  ops: SheetOp[];
  /** Cells optimistically changed by this op (sheetId:row:col). */
  keys: string[];
  /** Sent on the current connection. Ops are not idempotent (e.g. findReplace), so each is sent once per connection. */
  sent?: boolean;
}

type Listener = () => void;

/**
 * Client-side view of a spreadsheet. Only chunks of cells around the viewport are fetched. Local edits are applied
 * optimistically and queued; the server's `applied` broadcast (with recalculated dependents) is authoritative.
 * Queued operations survive disconnects (and reloads, via localStorage) and are resent on reconnect.
 */
export class SheetStore {
  private readonly cells = new Map<string, Map<string, CellDto>>();
  private readonly chunks = new Map<string, Set<string>>();
  private readonly inflight = new Set<string>();
  private readonly pending: PendingOp[] = [];
  private readonly pendingKeys = new Map<string, number>();
  private readonly listeners = new Set<Listener>();
  revision = 0;
  version = 0;
  sheets: WorksheetDto[] = [];
  presence: SheetPresenceState[] = [];
  selfClientId: string | null = null;
  send: ((clientOpId: string, ops: SheetOp[]) => boolean) | null = null;
  /** Called when this client's findReplace is acknowledged, with the previous inputs (for undo). */
  onReplaced: ((replaced: NonNullable<Extract<SheetServerMessage, { type: 'applied' }>['replaced']>) => void) | null = null;

  constructor(readonly spreadsheetId: string) {
    this.restoreQueue();
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getVersion = () => this.version;

  private emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  sheetCells(sheetId: string): Map<string, CellDto> {
    let m = this.cells.get(sheetId);
    if (!m) this.cells.set(sheetId, (m = new Map()));
    return m;
  }

  get(sheetId: string, row: number, col: number): CellDto | undefined {
    return this.cells.get(sheetId)?.get(cellKey(row, col));
  }

  hasPending(): boolean {
    return this.pending.length > 0;
  }

  // ---------- loading ----------

  /** Fetches any not-yet-loaded chunks intersecting the window. */
  ensureWindow(sheetId: string, r0: number, r1: number, c0: number, c1: number) {
    const loaded = this.chunks.get(sheetId) ?? new Set();
    this.chunks.set(sheetId, loaded);
    for (let rc = Math.floor(r0 / ROW_CHUNK); rc <= Math.floor(r1 / ROW_CHUNK); rc++) {
      for (let cc = Math.floor(c0 / COL_CHUNK); cc <= Math.floor(c1 / COL_CHUNK); cc++) {
        const key = `${rc}:${cc}`;
        if (loaded.has(key) || this.inflight.has(`${sheetId}:${key}`)) continue;
        void this.loadChunk(sheetId, rc, cc);
      }
    }
  }

  private async loadChunk(sheetId: string, rc: number, cc: number) {
    const tag = `${sheetId}:${rc}:${cc}`;
    this.inflight.add(tag);
    try {
      const res = await sheetsService.cells(this.spreadsheetId, sheetId, {
        rowStart: rc * ROW_CHUNK,
        rowEnd: rc * ROW_CHUNK + ROW_CHUNK - 1,
        colStart: cc * COL_CHUNK,
        colEnd: cc * COL_CHUNK + COL_CHUNK - 1,
      });
      // A newer broadcast was applied while this request was in flight: the snapshot may be stale, refetch.
      if (res.revision < this.revision) {
        this.inflight.delete(tag);
        return void this.loadChunk(sheetId, rc, cc);
      }
      const map = this.sheetCells(sheetId);
      for (let r = rc * ROW_CHUNK; r < (rc + 1) * ROW_CHUNK; r++)
        for (let c = cc * COL_CHUNK; c < (cc + 1) * COL_CHUNK; c++) {
          const k = cellKey(r, c);
          if (!this.pendingKeys.has(`${sheetId}:${k}`)) map.delete(k);
        }
      for (const cell of res.cells) {
        const k = cellKey(cell.row, cell.col);
        if (!this.pendingKeys.has(`${sheetId}:${k}`)) map.set(k, cell);
      }
      this.chunks.get(sheetId)?.add(`${rc}:${cc}`);
      this.emit();
    } finally {
      this.inflight.delete(tag);
    }
  }

  /** Forget cached cells for a sheet (after structural changes or a restore) so the viewport refetches. */
  /** Whether the chunk holding this cell has been fetched (so a missing cell really is empty). */
  isLoaded(sheetId: string, row: number, col: number): boolean {
    return !!this.chunks.get(sheetId)?.has(`${Math.floor(row / ROW_CHUNK)}:${Math.floor(col / COL_CHUNK)}`);
  }

  /** Test/bootstrap hook: records a chunk as loaded. */
  markLoaded(sheetId: string, row: number, col: number) {
    const set = this.chunks.get(sheetId) ?? new Set<string>();
    set.add(`${Math.floor(row / ROW_CHUNK)}:${Math.floor(col / COL_CHUNK)}`);
    this.chunks.set(sheetId, set);
  }

  invalidate(sheetId: string) {
    this.chunks.delete(sheetId);
    this.cells.delete(sheetId);
    this.emit();
  }

  invalidateAll() {
    this.chunks.clear();
    this.cells.clear();
    this.emit();
  }

  // ---------- local edits ----------

  private optimistic(sheetId: string, row: number, col: number, patch: { input?: string; style?: CellStyle | null }) {
    const map = this.sheetCells(sheetId);
    const k = cellKey(row, col);
    const prev = map.get(k);
    const input = patch.input ?? prev?.input ?? '';
    const style = patch.style !== undefined ? patch.style : (prev?.style ?? null);
    if (patch.input !== undefined) {
      const { ast, value, format } = parseCellInput(input);
      // Same rule as the server: a typed date/time gets a matching format unless the cell already has one.
      const effective = format && !style?.numberFormat ? { ...(style ?? {}), numberFormat: format } : style;
      const shown = ast ? (prev?.input === input ? prev.formattedValue : '…') : formatValue(value as never, effective?.numberFormat ?? 'general');
      const literalType: CellDto['dataType'] = value === null ? 'EMPTY' : typeof value === 'number' ? 'NUMBER' : typeof value === 'boolean' ? 'BOOLEAN' : 'STRING';
      map.set(k, { row, col, input, value: ast ? (prev?.value ?? null) : (value as CellDto['value']), formattedValue: shown, dataType: ast ? (prev?.dataType ?? 'EMPTY') : literalType, style: effective });
    } else {
      map.set(k, { row, col, input, value: prev?.value ?? null, formattedValue: prev ? formatValue(prev.value as never, style?.numberFormat ?? 'general') : '', dataType: prev?.dataType ?? 'EMPTY', style });
    }
    if (!input && !style) map.delete(k);
    const pk = `${sheetId}:${k}`;
    this.pendingKeys.set(pk, (this.pendingKeys.get(pk) ?? 0) + 1);
    return pk;
  }

  /** Applies ops optimistically and queues them for the server. Returns the inverse ops (for undo). */
  apply(ops: SheetOp[]): SheetOp[] {
    const keys: string[] = [];
    const inverse: SheetOp[] = [];
    for (const op of ops) {
      if (op.type === 'setCells') {
        inverse.unshift({ type: 'setCells', sheetId: op.sheetId, cells: op.cells.map((c) => ({ row: c.row, col: c.col, input: this.get(op.sheetId, c.row, c.col)?.input ?? '' })) });
        for (const c of op.cells) keys.push(this.optimistic(op.sheetId, c.row, c.col, { input: c.input }));
      } else if (op.type === 'setStyle') {
        const { startRow, endRow, startCol, endCol } = op.range;
        const before: SheetOp[] = [];
        for (let r = startRow; r <= endRow; r++)
          for (let c = startCol; c <= endCol; c++) {
            const prev = this.get(op.sheetId, r, c)?.style ?? {};
            before.push({ type: 'setStyle', sheetId: op.sheetId, range: { startRow: r, endRow: r, startCol: c, endCol: c }, style: prev, replace: true });
            keys.push(this.optimistic(op.sheetId, r, c, { style: mergeStyle(op.replace ? null : this.get(op.sheetId, r, c)?.style ?? null, op.style) }));
          }
        if ((endRow - startRow + 1) * (endCol - startCol + 1) <= 500) inverse.unshift(...before);
      } else if (op.type === 'clearRange') {
        const { startRow, endRow, startCol, endCol } = op.range;
        const restore: { row: number; col: number; input: string }[] = [];
        for (const cell of [...this.sheetCells(op.sheetId).values()]) {
          if (cell.row >= startRow && cell.row <= endRow && cell.col >= startCol && cell.col <= endCol && cell.input) {
            restore.push({ row: cell.row, col: cell.col, input: cell.input });
            keys.push(this.optimistic(op.sheetId, cell.row, cell.col, { input: '' }));
          }
        }
        if (restore.length) inverse.unshift({ type: 'setCells', sheetId: op.sheetId, cells: restore });
      }
      // findReplace runs on the server over every cell (including ones not loaded here); its ack carries the
      // previous inputs, from which the page builds the undo step.
    }
    const clientOpId = crypto.randomUUID();
    this.pending.push({ clientOpId, ops, keys });
    this.persistQueue();
    this.emit();
    this.flush();
    return inverse;
  }

  /**
   * Sends queued ops not yet sent on this connection, in order. After a reconnect everything unacknowledged is sent
   * again (the server ignores a clientOpId it has already applied).
   */
  flush() {
    for (const p of this.pending) {
      if (p.sent) continue;
      if (!this.send?.(p.clientOpId, p.ops)) break;
      p.sent = true;
    }
  }

  private settle(clientOpId: string) {
    const i = this.pending.findIndex((p) => p.clientOpId === clientOpId);
    if (i < 0) return null;
    const [p] = this.pending.splice(i, 1);
    for (const k of p!.keys) {
      const n = (this.pendingKeys.get(k) ?? 1) - 1;
      if (n <= 0) this.pendingKeys.delete(k);
      else this.pendingKeys.set(k, n);
    }
    this.persistQueue();
    return p!;
  }

  // ---------- server messages ----------

  handle(msg: SheetServerMessage): { rejected?: string } | void {
    switch (msg.type) {
      case 'welcome':
        this.selfClientId = msg.clientId;
        this.presence = msg.presence;
        // Anything could have changed while we were away: refetch the viewport, then resend our queue.
        if (msg.revision !== this.revision) this.invalidateAll();
        this.revision = Math.max(this.revision, msg.revision);
        for (const p of this.pending) p.sent = false;
        this.flush();
        this.emit();
        return;
      case 'applied': {
        this.revision = Math.max(this.revision, msg.revision);
        const settled = msg.clientOpId ? this.settle(msg.clientOpId) : null;
        if (settled && msg.replaced && settled.ops.some((o) => o.type === 'findReplace')) this.onReplaced?.(msg.replaced);
        for (const change of msg.changes) {
          const map = this.sheetCells(change.sheetId);
          for (const cell of change.cells) {
            if (!this.pendingKeys.has(`${change.sheetId}:${cellKey(cell.row, cell.col)}`)) map.set(cellKey(cell.row, cell.col), cell);
          }
          for (const r of change.removed) if (!this.pendingKeys.has(`${change.sheetId}:${cellKey(r.row, r.col)}`)) map.delete(cellKey(r.row, r.col));
        }
        for (const sheetId of msg.structural) this.invalidate(sheetId);
        if (msg.sheets) this.sheets = msg.sheets;
        this.emit();
        return;
      }
      case 'rejected': {
        const p = this.settle(msg.clientOpId);
        // Drop the optimistic values: refetch the affected sheets from the server.
        if (p) for (const sheetId of new Set(p.ops.map((o) => o.sheetId))) (sheetId ? this.invalidate(sheetId) : this.invalidateAll());
        return { rejected: msg.message };
      }
      case 'presence':
        this.presence = msg.presence;
        this.emit();
        return;
      case 'sheets':
        this.sheets = msg.sheets;
        this.emit();
        return;
      default:
        return;
    }
  }

  // ---------- offline queue persistence ----------

  private get storageKey() {
    return `qub.sheet.queue.${this.spreadsheetId}`;
  }

  private persistQueue() {
    try {
      if (this.pending.length) localStorage.setItem(this.storageKey, JSON.stringify(this.pending));
      else localStorage.removeItem(this.storageKey);
    } catch {
      // storage unavailable: the queue still lives in memory
    }
  }

  private restoreQueue() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      // Unsent edits from a previous session are resent on connect; the server broadcast then shows them.
      for (const p of JSON.parse(raw) as PendingOp[]) this.pending.push({ ...p, keys: [], sent: false });
    } catch {
      // ignore corrupt data
    }
  }

  setSheets(sheets: WorksheetDto[]) {
    this.sheets = sheets;
    this.emit();
  }
}
