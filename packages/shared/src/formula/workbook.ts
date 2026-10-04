import type { CellDataType } from '../enums';
import type { CellRange, CellStyle } from '../schemas/sheets';
import { cellKey, parseCellKey } from './address';
import { collectReferences, evaluateFormula, mapReferences, type Area, type EvalContext } from './evaluator';
import { formatValue } from './format';
import { DependencyGraph, nodeId, parseNodeId, type ResolvedArea } from './graph';
import { FormulaSyntaxError, isFormulaInput, parseFormula, type AstNode, type CellRef } from './parser';
import { inferResultFormat } from './result-format';
import { serializeFormula } from './serialize';
import { renameSheetInAst, shiftAst, translateFormulaInput, type StructuralChange } from './transform';
import { err, FormulaError, isError, parseNumberLiteral, type CellValue } from './values';
import { parseDateTime, type DateKind } from './dates';
import { mergeStyle } from './style';
import { cellMatches, type FindOptions } from './find';
import { FUNCTIONS } from './functions';

export interface CellState {
  input: string;
  ast: AstNode | null;
  value: CellValue;
  style: CellStyle | null;
}

export interface SheetMeta {
  id: string;
  name: string;
}

export interface CellChange {
  sheetId: string;
  row: number;
  col: number;
  /** null when the cell no longer exists. */
  cell: CellState | null;
}

export interface NamedRange {
  sheetId: string;
  range: CellRange;
}

interface SheetData {
  meta: SheetMeta;
  cells: Map<string, CellState>;
}

/** Parses raw cell input into a formula AST or a literal value. */
export function parseCellInput(input: string): { ast: AstNode | null; value: CellValue; format?: DateKind } {
  if (input === '') return { ast: null, value: null };
  if (isFormulaInput(input)) {
    try {
      return { ast: parseFormula(input.slice(1)), value: null };
    } catch (e) {
      const message = e instanceof FormulaSyntaxError ? e.message : 'Invalid formula';
      return { ast: null, value: err('#ERROR!', message) };
    }
  }
  if (input.startsWith("'")) return { ast: null, value: input.slice(1) };
  const n = parseNumberLiteral(input);
  if (n !== null) return { ast: null, value: n };
  const upper = input.trim().toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') return { ast: null, value: upper === 'TRUE' };
  const dt = parseDateTime(input);
  if (dt) return { ast: null, value: dt.serial, format: dt.kind };
  return { ast: null, value: input };
}

export function dataTypeOf(value: CellValue): CellDataType {
  if (value === null) return 'EMPTY';
  if (isError(value)) return 'ERROR';
  if (typeof value === 'number') return 'NUMBER';
  if (typeof value === 'boolean') return 'BOOLEAN';
  return 'STRING';
}

export function formattedValueOf(cell: Pick<CellState, 'value' | 'style'>): string {
  return formatValue(cell.value, cell.style?.numberFormat ?? 'general');
}

/** Stored representation of a value: errors become their code. */
export function serializeValue(value: CellValue): string | number | boolean | null {
  return isError(value) ? value.code : value;
}

export function deserializeValue(value: string | number | boolean | null, dataType: CellDataType): CellValue {
  if (dataType === 'ERROR' && typeof value === 'string') return new FormulaError(value as FormulaError['code']);
  return value;
}

function sameValue(a: CellValue, b: CellValue): boolean {
  if (isError(a) || isError(b)) return isError(a) && isError(b) && a.code === b.code;
  return a === b;
}

const CYCLE = () => err('#CYCLE!', 'Circular reference');

/**
 * In-memory model of a spreadsheet with dependency tracking and recalculation.
 * The server keeps one per active spreadsheet as the authoritative calculator.
 */
export class Workbook {
  private readonly sheets = new Map<string, SheetData>();
  private readonly graph = new DependencyGraph();
  private namedRanges = new Map<string, NamedRange>();
  /** Node ids of formulas calling TODAY()/NOW(). */
  private readonly volatile = new Set<string>();

  addSheet(meta: SheetMeta): void {
    this.sheets.set(meta.id, { meta: { ...meta }, cells: new Map() });
  }

  hasSheet(id: string): boolean {
    return this.sheets.has(id);
  }

  sheetList(): SheetMeta[] {
    return [...this.sheets.values()].map((s) => ({ ...s.meta }));
  }

  /** Removes a sheet; formulas that referenced it recalculate to #REF!. */
  removeSheet(id: string): CellChange[] {
    const sheet = this.sheets.get(id);
    if (!sheet) return [];
    for (const key of sheet.cells.keys()) {
      const { row, col } = parseCellKey(key);
      this.graph.remove(nodeId(id, row, col));
      this.volatile.delete(nodeId(id, row, col));
    }
    this.sheets.delete(id);
    return this.recalculateAll();
  }

  /** Renames a sheet and rewrites every formula that referenced the old name. */
  renameSheet(id: string, name: string): CellChange[] {
    const sheet = this.sheets.get(id);
    if (!sheet) return [];
    const oldName = sheet.meta.name;
    sheet.meta.name = name;
    const changes: CellChange[] = [];
    for (const s of this.sheets.values()) {
      for (const [key, cell] of s.cells) {
        if (!cell.ast) continue;
        const renamed = renameSheetInAst(cell.ast, oldName, name);
        const input = `=${serializeFormula(renamed)}`;
        if (input !== cell.input) {
          cell.input = input;
          cell.ast = renamed;
          const { row, col } = parseCellKey(key);
          changes.push({ sheetId: s.meta.id, row, col, cell });
        }
      }
    }
    return mergeChanges(changes, this.recalculateAll());
  }

  setNamedRanges(ranges: Record<string, NamedRange>): CellChange[] {
    this.namedRanges = new Map(Object.entries(ranges).map(([k, v]) => [k.toUpperCase(), v]));
    this.rebuildGraph();
    return this.recalculateAll();
  }

  getCell(sheetId: string, row: number, col: number): CellState | undefined {
    return this.sheets.get(sheetId)?.cells.get(cellKey(row, col));
  }

  /** All non-empty cells of a sheet within a range (inclusive). */
  cellsInRange(sheetId: string, range: CellRange): { row: number; col: number; cell: CellState }[] {
    const sheet = this.sheets.get(sheetId);
    if (!sheet) return [];
    const out: { row: number; col: number; cell: CellState }[] = [];
    for (const [key, cell] of sheet.cells) {
      const { row, col } = parseCellKey(key);
      if (row >= range.startRow && row <= range.endRow && col >= range.startCol && col <= range.endCol) {
        out.push({ row, col, cell });
      }
    }
    return out;
  }

  sheetCells(sheetId: string): Map<string, CellState> {
    return this.sheets.get(sheetId)?.cells ?? new Map();
  }

  /** Loads a stored cell without recalculating (values come from persistence). */
  hydrate(sheetId: string, row: number, col: number, data: { input: string; value: CellValue; style: CellStyle | null }): void {
    const sheet = this.requireSheet(sheetId);
    const { ast } = parseCellInput(data.input);
    sheet.cells.set(cellKey(row, col), { input: data.input, ast, value: data.value, style: data.style });
    this.registerDependencies(sheetId, row, col, ast);
  }

  /** Sets raw inputs and recalculates everything that depends on them. */
  setInputs(sheetId: string, updates: { row: number; col: number; input: string }[]): CellChange[] {
    const sheet = this.requireSheet(sheetId);
    const seeds: string[] = [];
    const changes: CellChange[] = [];
    for (const u of updates) {
      const key = cellKey(u.row, u.col);
      const existing = sheet.cells.get(key);
      const { ast, value, format } = parseCellInput(u.input);
      if (u.input === '' && !existing?.style) {
        if (existing) {
          sheet.cells.delete(key);
          changes.push({ sheetId, row: u.row, col: u.col, cell: null });
        }
      } else {
        const base = existing?.style ?? null;
        // A typed date/time — or a formula whose result is one — gets a matching format, unless the cell was already formatted.
        const auto = base?.numberFormat ? undefined : (format ?? (ast ? inferResultFormat(ast, (ref) => this.dateFormatAt(sheetId, ref)) : undefined));
        const style = auto ? { ...(base ?? {}), numberFormat: auto } : base;
        const cell: CellState = { input: u.input, ast, value, style };
        sheet.cells.set(key, cell);
        changes.push({ sheetId, row: u.row, col: u.col, cell });
      }
      this.registerDependencies(sheetId, u.row, u.col, ast);
      seeds.push(nodeId(sheetId, u.row, u.col));
    }
    return mergeChanges(changes, this.recalculate(seeds));
  }

  setStyle(sheetId: string, range: CellRange, style: CellStyle, replace: boolean): CellChange[] {
    const sheet = this.requireSheet(sheetId);
    const changes: CellChange[] = [];
    const checkboxFill: { row: number; col: number; input: string }[] = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const key = cellKey(r, c);
        const existing = sheet.cells.get(key);
        const cleaned = mergeStyle(replace ? null : (existing?.style ?? null), style);
        if (style.validation?.kind === 'checkbox' && (!existing || existing.input === '')) checkboxFill.push({ row: r, col: c, input: 'FALSE' });
        if (!existing) {
          if (!cleaned) continue;
          const cell: CellState = { input: '', ast: null, value: null, style: cleaned };
          sheet.cells.set(key, cell);
          changes.push({ sheetId, row: r, col: c, cell });
        } else {
          existing.style = cleaned;
          if (!cleaned && existing.input === '') {
            sheet.cells.delete(key);
            changes.push({ sheetId, row: r, col: c, cell: null });
          } else changes.push({ sheetId, row: r, col: c, cell: existing });
        }
      }
    }
    // Google Sheets behaviour: empty cells that become checkboxes hold FALSE (so COUNTIF(range, FALSE) works).
    return checkboxFill.length ? mergeChanges(changes, this.setInputs(sheetId, checkboxFill)) : changes;
  }

  clearRange(sheetId: string, range: CellRange, formats: boolean): CellChange[] {
    const updates: { row: number; col: number; input: string }[] = [];
    for (const { row, col } of this.cellsInRange(sheetId, range)) updates.push({ row, col, input: '' });
    if (formats) {
      const sheet = this.requireSheet(sheetId);
      for (const u of updates) {
        const cell = sheet.cells.get(cellKey(u.row, u.col));
        if (cell) cell.style = null;
      }
    }
    return updates.length ? this.setInputs(sheetId, updates) : [];
  }

  /**
   * Inserts or deletes rows/columns. Cells move, formulas everywhere are rewritten, and dependents recalculate.
   * Returns changes at the cells' new positions; pure moves (no content/value change) are not reported,
   * so persistence must shift stored positions itself.
   */
  applyStructuralChange(sheetId: string, axis: 'row' | 'col', kind: 'insert' | 'delete', index: number, count: number): CellChange[] {
    const sheet = this.requireSheet(sheetId);
    const change: StructuralChange = { sheetName: sheet.meta.name, axis, kind, index, count };
    const moved = new Map<string, CellState>();
    for (const [key, cell] of sheet.cells) {
      const pos = parseCellKey(key);
      const p = axis === 'row' ? pos.row : pos.col;
      let np = p;
      if (kind === 'insert') np = p >= index ? p + count : p;
      else if (p >= index + count) np = p - count;
      else if (p >= index) continue; // deleted
      moved.set(axis === 'row' ? cellKey(np, pos.col) : cellKey(pos.row, np), cell);
    }
    sheet.cells.clear();
    for (const [k, v] of moved) sheet.cells.set(k, v);

    const changes: CellChange[] = [];
    for (const s of this.sheets.values()) {
      for (const [key, cell] of s.cells) {
        if (!cell.ast) continue;
        const shifted = shiftAst(cell.ast, change, s.meta.id === sheetId);
        const input = `=${serializeFormula(shifted)}`;
        if (input !== cell.input) {
          cell.input = input;
          cell.ast = shifted;
          const { row, col } = parseCellKey(key);
          changes.push({ sheetId: s.meta.id, row, col, cell });
        }
      }
    }
    for (const [name, nr] of this.namedRanges) {
      if (nr.sheetId !== sheetId) continue;
      const r = { ...nr.range };
      const [a, b] = axis === 'row' ? (['startRow', 'endRow'] as const) : (['startCol', 'endCol'] as const);
      if (kind === 'insert') {
        if (r[a] >= index) r[a] += count;
        if (r[b] >= index) r[b] += count;
      } else {
        const end = index + count - 1;
        if (r[a] > end) r[a] -= count;
        else if (r[a] >= index) r[a] = index;
        if (r[b] > end) r[b] -= count;
        else if (r[b] >= index) r[b] = index - 1;
      }
      if (r[b] < r[a]) this.namedRanges.delete(name);
      else nr.range = r;
    }
    this.rebuildGraph();
    return mergeChanges(changes, this.recalculateAll());
  }

  /**
   * Sorts the rows of a range by one column. Formulas move with their row and have relative references adjusted.
   * Returns every position in the range whose content changed (including removals).
   */
  sortRange(sheetId: string, range: CellRange, col: number, direction: 'asc' | 'desc', hasHeader: boolean): CellChange[] {
    const sheet = this.requireSheet(sheetId);
    const firstRow = hasHeader ? range.startRow + 1 : range.startRow;
    if (firstRow > range.endRow) return [];
    const rows: { origin: number; cells: Map<number, CellState> }[] = [];
    for (let r = firstRow; r <= range.endRow; r++) rows.push({ origin: r, cells: new Map() });
    for (const { row, col: c, cell } of this.cellsInRange(sheetId, { ...range, startRow: firstRow })) {
      rows[row - firstRow]!.cells.set(c, cell);
    }
    const factor = direction === 'asc' ? 1 : -1;
    const sortKey = (v: CellValue | undefined): [number, number | string] => {
      if (v === null || v === undefined || v === '') return [3, 0]; // blanks always last
      if (typeof v === 'number') return [0, v];
      if (typeof v === 'string') return [1, v.toLowerCase()];
      if (typeof v === 'boolean') return [2, v ? 1 : 0];
      return [2.5, 0];
    };
    rows.sort((x, y) => {
      const [ta, va] = sortKey(x.cells.get(col)?.value);
      const [tb, vb] = sortKey(y.cells.get(col)?.value);
      if (ta === 3 || tb === 3) return ta - tb;
      if (ta !== tb) return (ta - tb) * factor;
      if (va < vb) return -factor;
      if (va > vb) return factor;
      return x.origin - y.origin; // stable
    });

    const changes: CellChange[] = [];
    const before = new Map<string, string>();
    for (let r = firstRow; r <= range.endRow; r++)
      for (let c = range.startCol; c <= range.endCol; c++) {
        const key = cellKey(r, c);
        const cell = sheet.cells.get(key);
        before.set(key, cell ? `${cell.input}\u0000${JSON.stringify(cell.style)}` : '');
        if (cell) {
          sheet.cells.delete(key);
          this.graph.remove(nodeId(sheetId, r, c));
        }
      }
    rows.forEach((rowData, i) => {
      const target = firstRow + i;
      const dRow = target - rowData.origin;
      for (const [c, cell] of rowData.cells) {
        const input = translateFormulaInput(cell.input, dRow, 0);
        const { ast } = parseCellInput(input);
        const next: CellState = { input, ast, value: cell.value, style: cell.style };
        sheet.cells.set(cellKey(target, c), next);
        this.registerDependencies(sheetId, target, c, ast);
      }
    });
    const seeds: string[] = [];
    for (let r = firstRow; r <= range.endRow; r++)
      for (let c = range.startCol; c <= range.endCol; c++) {
        const key = cellKey(r, c);
        const cell = sheet.cells.get(key);
        const sig = cell ? `${cell.input}\u0000${JSON.stringify(cell.style)}` : '';
        seeds.push(nodeId(sheetId, r, c));
        if (sig !== before.get(key)) changes.push({ sheetId, row: r, col: c, cell: cell ?? null });
      }
    return mergeChanges(changes, this.recalculate(seeds));
  }

  /** Cells matching a search, ordered by the given sheet order, then row and column. */
  findMatches(sheetIds: string[], o: FindOptions): { sheetId: string; row: number; col: number; input: string }[] {
    const out: { sheetId: string; row: number; col: number; input: string }[] = [];
    for (const sheetId of sheetIds) {
      const found: { sheetId: string; row: number; col: number; input: string }[] = [];
      for (const [key, cell] of this.sheetCells(sheetId)) {
        if (!cellMatches(cell.input, o)) continue;
        const { row, col } = parseCellKey(key);
        found.push({ sheetId, row, col, input: cell.input });
      }
      found.sort((a, b) => a.row - b.row || a.col - b.col);
      out.push(...found);
    }
    return out;
  }

  /** Cells calling TODAY()/NOW() (and their dependents) are re-evaluated on load and after every edit batch. */
  recalculateVolatile(): CellChange[] {
    const seeds = [...this.volatile].filter((id) => this.cellById(id)?.ast);
    return seeds.length ? this.recalculate(seeds) : [];
  }

  hasVolatile(): boolean {
    return [...this.volatile].some((id) => this.cellById(id)?.ast);
  }

  /** Re-evaluates every formula (after structural changes, restores or sheet add/remove). */
  recalculateAll(): CellChange[] {
    const seeds: string[] = [];
    for (const s of this.sheets.values())
      for (const [key, cell] of s.cells) {
        if (cell.ast) {
          const { row, col } = parseCellKey(key);
          seeds.push(nodeId(s.meta.id, row, col));
        }
      }
    return this.recalculate(seeds);
  }

  // ---------- internals ----------

  private requireSheet(id: string): SheetData {
    const s = this.sheets.get(id);
    if (!s) throw new Error(`Unknown sheet ${id}`);
    return s;
  }

  private dateFormatAt(sheetId: string, ref: CellRef): DateKind | undefined {
    const sheet = this.resolveSheetName(ref.sheet, sheetId);
    const f = sheet ? this.sheets.get(sheet)?.cells.get(cellKey(ref.row, ref.col))?.style?.numberFormat : undefined;
    return f === 'date' || f === 'time' || f === 'datetime' ? f : undefined;
  }

  private resolveSheetName(name: string | null, currentSheet: string): string | null {
    if (name === null) return currentSheet;
    const lower = name.toLowerCase();
    for (const s of this.sheets.values()) if (s.meta.name.toLowerCase() === lower) return s.meta.id;
    return null;
  }

  private collectAreas(sheetId: string, ast: AstNode): ResolvedArea[] {
    const areas: ResolvedArea[] = [];
    for (const a of collectReferences(ast) as Area[]) {
      const sheet = this.resolveSheetName(a.sheet, sheetId);
      if (sheet) areas.push({ sheet, r0: a.r0, c0: a.c0, r1: a.r1, c1: a.c1 });
    }
    // Named ranges are dependencies too.
    const visit = (n: AstNode): void => {
      if (n.type === 'name') {
        const nr = this.namedRanges.get(n.name.toUpperCase());
        if (nr) areas.push({ sheet: nr.sheetId, r0: nr.range.startRow, c0: nr.range.startCol, r1: nr.range.endRow, c1: nr.range.endCol });
      } else if (n.type === 'func') n.args.forEach(visit);
      else if (n.type === 'unary' || n.type === 'percent') visit(n.arg);
      else if (n.type === 'binary') {
        visit(n.left);
        visit(n.right);
      }
    };
    visit(ast);
    return areas;
  }

  private registerDependencies(sheetId: string, row: number, col: number, ast: AstNode | null): void {
    const id = nodeId(sheetId, row, col);
    if (!ast) this.graph.remove(id);
    else this.graph.set(id, this.collectAreas(sheetId, ast));
    if (ast && callsVolatile(ast)) this.volatile.add(id);
    else this.volatile.delete(id);
  }

  private rebuildGraph(): void {
    this.graph.clear();
    this.volatile.clear();
    for (const s of this.sheets.values())
      for (const [key, cell] of s.cells) {
        if (!cell.ast) continue;
        const { row, col } = parseCellKey(key);
        const id = nodeId(s.meta.id, row, col);
        this.graph.set(id, this.collectAreas(s.meta.id, cell.ast));
        if (callsVolatile(cell.ast)) this.volatile.add(id);
      }
  }

  private cellById(id: string): CellState | undefined {
    const { sheet, row, col } = parseNodeId(id);
    return this.sheets.get(sheet)?.cells.get(cellKey(row, col));
  }

  /** Replaces named-range references with concrete ranges for evaluation. */
  private withNames(ast: AstNode): AstNode {
    if (this.namedRanges.size === 0) return ast;
    const sub = (n: AstNode): AstNode => {
      if (n.type === 'name') {
        const nr = this.namedRanges.get(n.name.toUpperCase());
        const sheet = nr && this.sheets.get(nr.sheetId);
        if (!nr || !sheet) return n;
        const ref = (row: number, col: number) => ({ sheet: sheet.meta.name, row, col, rowAbs: true, colAbs: true });
        return { type: 'range', start: ref(nr.range.startRow, nr.range.startCol), end: ref(nr.range.endRow, nr.range.endCol) };
      }
      if (n.type === 'func') return { ...n, args: n.args.map(sub) };
      if (n.type === 'unary' || n.type === 'percent') return { ...n, arg: sub(n.arg) };
      if (n.type === 'binary') return { ...n, left: sub(n.left), right: sub(n.right) };
      return n;
    };
    return mapReferences(sub(ast), (r) => r);
  }

  /**
   * Recalculates the seeds and all transitive dependents in topological order (Kahn's algorithm).
   * Cells left over after the sort sit on or downstream of a cycle and evaluate to #CYCLE!.
   */
  private recalculate(seeds: string[]): CellChange[] {
    const dirty = new Set<string>();
    const stack = [...seeds];
    while (stack.length) {
      const id = stack.pop()!;
      if (dirty.has(id)) continue;
      dirty.add(id);
      const { sheet, row, col } = parseNodeId(id);
      for (const dep of this.graph.dependentsOf(sheet, row, col)) if (!dirty.has(dep)) stack.push(dep);
    }

    // Only formula cells need evaluating; literal seeds matter only as sources of change.
    const formulas = [...dirty].filter((id) => this.cellById(id)?.ast);
    const formulaSet = new Set(formulas);
    const bySheet = new Map<string, { id: string; row: number; col: number }[]>();
    for (const id of formulas) {
      const p = parseNodeId(id);
      const list = bySheet.get(p.sheet) ?? [];
      list.push({ id, row: p.row, col: p.col });
      bySheet.set(p.sheet, list);
    }

    const indegree = new Map<string, number>();
    const edges = new Map<string, string[]>();
    for (const id of formulas) {
      let deg = 0;
      for (const a of this.graph.getPrecedents(id)) {
        const size = (a.r1 - a.r0 + 1) * (a.c1 - a.c0 + 1);
        const candidates = bySheet.get(a.sheet) ?? [];
        const hits: string[] = [];
        if (size < candidates.length) {
          for (let r = a.r0; r <= a.r1; r++)
            for (let c = a.c0; c <= a.c1; c++) {
              const pid = nodeId(a.sheet, r, c);
              if (formulaSet.has(pid)) hits.push(pid);
            }
        } else {
          for (const cand of candidates)
            if (cand.row >= a.r0 && cand.row <= a.r1 && cand.col >= a.c0 && cand.col <= a.c1) hits.push(cand.id);
        }
        for (const pid of hits) {
          deg++;
          const list = edges.get(pid) ?? [];
          list.push(id);
          edges.set(pid, list);
        }
      }
      indegree.set(id, deg);
    }

    const queue = formulas.filter((id) => indegree.get(id) === 0);
    const changedIds = new Set<string>();
    const evaluated = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      evaluated.add(id);
      if (this.evaluateCell(id)) changedIds.add(id);
      for (const next of edges.get(id) ?? []) {
        const d = indegree.get(next)! - 1;
        indegree.set(next, d);
        if (d === 0) queue.push(next);
      }
    }
    for (const id of formulas) {
      if (evaluated.has(id)) continue;
      const cell = this.cellById(id)!;
      const v = CYCLE();
      if (!sameValue(cell.value, v)) changedIds.add(id);
      cell.value = v;
    }

    return [...changedIds].map((id) => {
      const { sheet, row, col } = parseNodeId(id);
      return { sheetId: sheet, row, col, cell: this.cellById(id) ?? null };
    });
  }

  private evaluateCell(id: string): boolean {
    const cell = this.cellById(id);
    if (!cell?.ast) return false;
    const { sheet } = parseNodeId(id);
    const ctx: EvalContext = {
      resolveSheet: (name) => this.resolveSheetName(name, sheet),
      getValue: (sheetKey, row, col) => {
        const target = this.sheets.get(sheetKey)?.cells.get(cellKey(row, col));
        if (!target) return null;
        if (sheetKey === sheet && target === cell) return CYCLE();
        return target.value;
      },
    };
    const value = evaluateFormula(this.withNames(cell.ast), ctx);
    const changed = !sameValue(cell.value, value);
    cell.value = value;
    return changed;
  }
}

/** True when a formula calls a volatile function (TODAY, NOW) anywhere in its tree. */
function callsVolatile(node: AstNode): boolean {
  switch (node.type) {
    case 'func':
      return !!FUNCTIONS[node.name]?.volatile || node.args.some(callsVolatile);
    case 'unary':
    case 'percent':
      return callsVolatile(node.arg);
    case 'binary':
      return callsVolatile(node.left) || callsVolatile(node.right);
    default:
      return false;
  }
}

/** Later changes for the same cell win. */
function mergeChanges(a: CellChange[], b: CellChange[]): CellChange[] {
  const map = new Map<string, CellChange>();
  for (const c of [...a, ...b]) map.set(nodeId(c.sheetId, c.row, c.col), c);
  return [...map.values()];
}
