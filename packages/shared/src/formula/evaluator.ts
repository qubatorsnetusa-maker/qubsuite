import { FUNCTIONS, type FnArg } from './functions';
import './functions-lookup';
import './functions-datetime';
import './functions-text';
import './functions-stats';
import type { AstNode, CellRef } from './parser';
import {
  err,
  FormulaError,
  isError,
  isRange,
  toNumber,
  toText,
  type CellValue,
  type EvalResult,
  type Scalar,
} from './values';

export interface EvalContext {
  /** Resolves a sheet name written in a formula (null = current sheet) to a sheet key, or null if it doesn't exist. */
  resolveSheet(name: string | null): string | null;
  getValue(sheetKey: string, row: number, col: number): CellValue;
  /** Optional: resolves a bare name (used by Forms formulas). Return undefined for "unknown name". */
  resolveName?(name: string): CellValue | undefined;
}

/** Guards against pathological ranges such as A1:ZZ100000 evaluating millions of cells. */
const MAX_RANGE_CELLS = 1_000_000;

function compare(a: Scalar, b: Scalar): number {
  // Spreadsheet ordering: numbers < text < booleans; blank equals 0 / "" / FALSE.
  const rank = (v: Scalar) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : -1);
  if (a === null && b === null) return 0;
  if (a === null) a = typeof b === 'number' ? 0 : typeof b === 'boolean' ? false : '';
  if (b === null) b = typeof a === 'number' ? 0 : typeof a === 'boolean' ? false : '';
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return Number(a) - Number(b);
}

function toScalarResult(v: EvalResult): CellValue {
  if (!isRange(v)) return v;
  if (v.values.length === 1 && v.values[0]!.length === 1) return v.values[0]![0]!;
  return err('#VALUE!', 'A range cannot be used as a single value');
}

export function evaluate(node: AstNode, ctx: EvalContext): EvalResult {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'string':
      return node.value;
    case 'boolean':
      return node.value;
    case 'error':
      return new FormulaError(node.code);
    case 'name': {
      const resolved = ctx.resolveName?.(node.name);
      return resolved === undefined ? err('#NAME?', `Unknown name ${node.name}`) : resolved;
    }
    case 'ref': {
      const sheet = ctx.resolveSheet(node.ref.sheet);
      if (sheet === null) return err('#REF!');
      return ctx.getValue(sheet, node.ref.row, node.ref.col);
    }
    case 'range': {
      const sheet = ctx.resolveSheet(node.start.sheet);
      if (sheet === null) return err('#REF!');
      const r0 = Math.min(node.start.row, node.end.row);
      const r1 = Math.max(node.start.row, node.end.row);
      const c0 = Math.min(node.start.col, node.end.col);
      const c1 = Math.max(node.start.col, node.end.col);
      if ((r1 - r0 + 1) * (c1 - c0 + 1) > MAX_RANGE_CELLS) return err('#NUM!', 'Range too large');
      const values: CellValue[][] = [];
      for (let r = r0; r <= r1; r++) {
        const row: CellValue[] = [];
        for (let c = c0; c <= c1; c++) row.push(ctx.getValue(sheet, r, c));
        values.push(row);
      }
      return { kind: 'range', values };
    }
    case 'func': {
      const def = FUNCTIONS[node.name];
      if (!def) return err('#NAME?', `Unknown function ${node.name}`);
      if (node.args.length < def.minArgs || node.args.length > def.maxArgs) {
        return err('#N/A', `Wrong number of arguments to ${node.name}`);
      }
      const args: FnArg[] = node.args.map((a) => {
        let cached: EvalResult | undefined;
        return { eval: () => (cached ??= evaluate(a, ctx)), isReference: a.type === 'ref' };
      });
      try {
        return def.impl(args);
      } catch {
        return err('#ERROR!');
      }
    }
    case 'unary': {
      const v = toNumber(toScalarResult(evaluate(node.arg, ctx)));
      if (isError(v)) return v;
      return node.op === '-' ? -v : v;
    }
    case 'percent': {
      const v = toNumber(toScalarResult(evaluate(node.arg, ctx)));
      return isError(v) ? v : v / 100;
    }
    case 'binary': {
      const left = toScalarResult(evaluate(node.left, ctx));
      if (isError(left)) return left;
      const right = toScalarResult(evaluate(node.right, ctx));
      if (isError(right)) return right;
      switch (node.op) {
        case '&': {
          const a = toText(left);
          const b = toText(right);
          if (isError(a)) return a;
          if (isError(b)) return b;
          return a + b;
        }
        case '=':
          return compare(left, right) === 0;
        case '<>':
          return compare(left, right) !== 0;
        case '<':
          return compare(left, right) < 0;
        case '>':
          return compare(left, right) > 0;
        case '<=':
          return compare(left, right) <= 0;
        case '>=':
          return compare(left, right) >= 0;
      }
      const a = toNumber(left);
      const b = toNumber(right);
      if (isError(a)) return a;
      if (isError(b)) return b;
      let r: number;
      switch (node.op) {
        case '+':
          r = a + b;
          break;
        case '-':
          r = a - b;
          break;
        case '*':
          r = a * b;
          break;
        case '/':
          if (b === 0) return err('#DIV/0!');
          r = a / b;
          break;
        case '^':
          r = a ** b;
          break;
      }
      return Number.isFinite(r) ? r : err('#NUM!');
    }
  }
}

/** Evaluates a formula to a single cell value. */
export function evaluateFormula(node: AstNode, ctx: EvalContext): CellValue {
  return toScalarResult(evaluate(node, ctx));
}

export interface Area {
  sheet: string | null;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

/** All cell areas a formula reads, used to build the dependency graph. */
export function collectReferences(node: AstNode, out: Area[] = []): Area[] {
  switch (node.type) {
    case 'ref':
      out.push({ sheet: node.ref.sheet, r0: node.ref.row, c0: node.ref.col, r1: node.ref.row, c1: node.ref.col });
      break;
    case 'range':
      out.push({
        sheet: node.start.sheet,
        r0: Math.min(node.start.row, node.end.row),
        c0: Math.min(node.start.col, node.end.col),
        r1: Math.max(node.start.row, node.end.row),
        c1: Math.max(node.start.col, node.end.col),
      });
      break;
    case 'func':
      node.args.forEach((a) => collectReferences(a, out));
      break;
    case 'unary':
    case 'percent':
      collectReferences(node.arg, out);
      break;
    case 'binary':
      collectReferences(node.left, out);
      collectReferences(node.right, out);
      break;
  }
  return out;
}

/** Maps every reference in the AST. Returning null for a reference turns it into #REF!. */
export function mapReferences(
  node: AstNode,
  fn: (ref: CellRef, part: 'single' | 'start' | 'end') => CellRef | null,
  rangeFn?: (start: CellRef, end: CellRef) => { start: CellRef; end: CellRef } | null,
): AstNode {
  switch (node.type) {
    case 'ref': {
      const ref = fn(node.ref, 'single');
      return ref ? { type: 'ref', ref } : { type: 'error', code: '#REF!' };
    }
    case 'range': {
      if (rangeFn) {
        const r = rangeFn(node.start, node.end);
        return r ? { type: 'range', ...r } : { type: 'error', code: '#REF!' };
      }
      const start = fn(node.start, 'start');
      const end = fn(node.end, 'end');
      return start && end ? { type: 'range', start, end } : { type: 'error', code: '#REF!' };
    }
    case 'func':
      return { ...node, args: node.args.map((a) => mapReferences(a, fn, rangeFn)) };
    case 'unary':
    case 'percent':
      return { ...node, arg: mapReferences(node.arg, fn, rangeFn) };
    case 'binary':
      return { ...node, left: mapReferences(node.left, fn, rangeFn), right: mapReferences(node.right, fn, rangeFn) };
    default:
      return node;
  }
}
