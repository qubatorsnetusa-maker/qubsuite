import { buildCriteria, registerFunction, scalar, type FnArg } from './functions';
import { err, isError, isRange, toBoolean, toNumber, type CellValue, type FormulaError } from './values';

/** A range argument as a grid; a single value becomes a 1×1 grid. */
export function gridOf(arg: FnArg): CellValue[][] | FormulaError {
  const v = arg.eval();
  if (isRange(v)) return v.values;
  if (isError(v)) return v;
  return [[v]];
}

/** Values of a single row or column, or #VALUE! for a 2-D range. */
function vectorOf(arg: FnArg): CellValue[] | FormulaError {
  const g = gridOf(arg);
  if (isError(g)) return g;
  if (g.length === 1) return g[0]!;
  if (g.every((row) => row.length === 1)) return g.map((row) => row[0]!);
  return err('#VALUE!', 'Expected a single row or column');
}

const transpose = (g: CellValue[][]) => (g[0] ?? []).map((_, c) => g.map((row) => row[c] ?? null));

function equalsKey(a: CellValue, key: CellValue): boolean {
  if (typeof a === 'string' && typeof key === 'string') return a.toLowerCase() === key.toLowerCase();
  return a === key;
}

/** Orders values of the same kind; NaN when they are not comparable. */
function order(a: CellValue, b: CellValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return Number.NaN;
}

/** Sorted lookup: last value <= key in an ascending list (or >= key in a descending one), or -1. */
function sortedIndex(values: CellValue[], key: CellValue, descending = false): number {
  let found = -1;
  for (let i = 0; i < values.length; i++) {
    const o = order(values[i]!, key);
    if (Number.isNaN(o)) continue;
    if (descending ? o >= 0 : o <= 0) found = i;
    else break;
  }
  return found;
}

const display = (v: CellValue) => (v === null ? '' : String(v));

function tableLookup(args: FnArg[], horizontal: boolean): CellValue {
  const key = scalar(args[0]!);
  if (isError(key)) return key;
  const grid = gridOf(args[1]!);
  if (isError(grid)) return grid;
  const idx = toNumber(scalar(args[2]!));
  if (isError(idx)) return idx;
  const sorted = args[3] ? toBoolean(scalar(args[3])) : false;
  if (isError(sorted)) return sorted;
  const lines = horizontal ? transpose(grid) : grid;
  const n = Math.trunc(idx);
  if (n < 1) return err('#VALUE!', `Index ${n} must be at least 1`);
  if (n > (lines[0]?.length ?? 0)) return err('#REF!', `Index ${n} is out of range`);
  const keys = lines.map((l) => l[0] ?? null);
  const i = sorted ? sortedIndex(keys, key) : keys.findIndex((k) => equalsKey(k, key));
  if (i < 0) return err('#N/A', `Did not find value '${display(key)}'`);
  return lines[i]![n - 1] ?? null;
}

/** Evaluates criteria pairs starting at `first`; with first = 1, args[0] is the range being aggregated. */
export function criteriaMask(args: FnArg[], first: number): { target: CellValue[]; mask: boolean[] } | FormulaError {
  let shape = '';
  let target: CellValue[] = [];
  if (first === 1) {
    const g = gridOf(args[0]!);
    if (isError(g)) return g;
    target = g.flat();
    shape = `${g.length}x${g[0]?.length ?? 0}`;
  }
  let mask: boolean[] | null = null;
  for (let i = first; i < args.length; i += 2) {
    const g = gridOf(args[i]!);
    if (isError(g)) return g;
    const s = `${g.length}x${g[0]?.length ?? 0}`;
    if (shape && s !== shape) return err('#VALUE!', 'All ranges must be the same size');
    shape = s;
    const test = buildCriteria(scalar(args[i + 1]!));
    const prev: boolean[] | null = mask;
    mask = g.flat().map((v, j) => (prev ? prev[j]! : true) && test(v));
  }
  return { target, mask: mask ?? [] };
}

function roundTowards(fn: (x: number) => number) {
  return (args: FnArg[]): CellValue => {
    const x = toNumber(scalar(args[0]!));
    if (isError(x)) return x;
    const d = args[1] ? toNumber(scalar(args[1])) : 0;
    if (isError(d)) return d;
    const f = 10 ** Math.trunc(d);
    // toPrecision strips binary noise (e.g. 3.15 * 100 = 314.99999…) before rounding.
    const scaled = Number((Math.abs(x) * f).toPrecision(15));
    return (Math.sign(x) * fn(scaled)) / f;
  };
}

registerFunction('VLOOKUP', { minArgs: 3, maxArgs: 4, impl: (a) => tableLookup(a, false) });
registerFunction('HLOOKUP', { minArgs: 3, maxArgs: 4, impl: (a) => tableLookup(a, true) });

registerFunction('MATCH', {
  minArgs: 2,
  maxArgs: 3,
  impl: (args) => {
    const key = scalar(args[0]!);
    if (isError(key)) return key;
    const values = vectorOf(args[1]!);
    if (isError(values)) return values;
    const type = args[2] ? toNumber(scalar(args[2])) : 1;
    if (isError(type)) return type;
    const i = type === 0 ? values.findIndex((v) => equalsKey(v, key)) : sortedIndex(values, key, type < 0);
    return i < 0 ? err('#N/A', `Did not find value '${display(key)}'`) : i + 1;
  },
});

registerFunction('INDEX', {
  minArgs: 2,
  maxArgs: 3,
  impl: (args) => {
    const grid = gridOf(args[0]!);
    if (isError(grid)) return grid;
    const r = toNumber(scalar(args[1]!));
    if (isError(r)) return r;
    const c = args[2] ? toNumber(scalar(args[2])) : null;
    if (isError(c)) return c;
    let row = Math.trunc(r);
    let col = c === null ? 1 : Math.trunc(c);
    if (c === null && grid.length === 1) [row, col] = [1, row]; // INDEX(A1:C1, 2) → B1
    if (row < 1 || col < 1) return err('#VALUE!', 'INDEX row and column must be at least 1');
    const v = grid[row - 1]?.[col - 1];
    return v === undefined ? err('#REF!', 'INDEX is out of range') : v;
  },
});

registerFunction('XLOOKUP', {
  minArgs: 3,
  maxArgs: 4,
  impl: (args) => {
    const key = scalar(args[0]!);
    if (isError(key)) return key;
    const keys = vectorOf(args[1]!);
    if (isError(keys)) return keys;
    const results = vectorOf(args[2]!);
    if (isError(results)) return err('#VALUE!', 'XLOOKUP result range must be a single row or column');
    if (results.length !== keys.length) return err('#VALUE!', 'XLOOKUP ranges must be the same size');
    const i = keys.findIndex((k) => equalsKey(k, key));
    if (i >= 0) return results[i]!;
    return args[3] ? scalar(args[3]) : err('#N/A', `Did not find value '${display(key)}'`);
  },
});

registerFunction('SUMIFS', {
  minArgs: 3,
  maxArgs: 255,
  impl: (args) => {
    if (args.length % 2 === 0) return err('#N/A', 'SUMIFS needs criteria in pairs');
    const r = criteriaMask(args, 1);
    if (isError(r)) return r;
    return r.target.reduce<number>((sum, v, i) => (r.mask[i] && typeof v === 'number' ? sum + v : sum), 0);
  },
});

registerFunction('AVERAGEIFS', {
  minArgs: 3,
  maxArgs: 255,
  impl: (args) => {
    if (args.length % 2 === 0) return err('#N/A', 'AVERAGEIFS needs criteria in pairs');
    const r = criteriaMask(args, 1);
    if (isError(r)) return r;
    const nums = r.target.filter((v, i) => r.mask[i] && typeof v === 'number') as number[];
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : err('#DIV/0!', 'No matching values');
  },
});

registerFunction('COUNTIFS', {
  minArgs: 2,
  maxArgs: 254,
  impl: (args) => {
    if (args.length % 2 !== 0) return err('#N/A', 'COUNTIFS needs criteria in pairs');
    const r = criteriaMask(args, 0);
    if (isError(r)) return r;
    return r.mask.filter(Boolean).length;
  },
});

registerFunction('ROUNDUP', { minArgs: 1, maxArgs: 2, impl: roundTowards(Math.ceil) });
registerFunction('ROUNDDOWN', { minArgs: 1, maxArgs: 2, impl: roundTowards(Math.floor) });
