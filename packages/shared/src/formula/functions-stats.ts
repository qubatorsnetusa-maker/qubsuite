import { collectNumbers, flatten, registerFunction, scalar, type FnArg, type FunctionDef } from './functions';
import { criteriaMask, gridOf } from './functions-lookup';
import { err, isError, toBoolean, toNumber, toText, type CellValue, type FormulaError } from './values';

/** Numbers of the arguments (aggregate semantics) with at least `min` of them, else #DIV/0!. */
function numbers(args: FnArg[], min: number): number[] | FormulaError {
  const nums = collectNumbers(args);
  if (isError(nums)) return nums;
  return nums.length < min ? err('#DIV/0!', `Needs at least ${min} number${min === 1 ? '' : 's'}`) : nums;
}

function variance(nums: number[], sample: boolean): number {
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length - (sample ? 1 : 0));
}

const varianceFn = (sample: boolean, root: boolean): FunctionDef => ({
  minArgs: 1,
  maxArgs: Infinity,
  impl: (args) => {
    const nums = numbers(args, sample ? 2 : 1);
    if (isError(nums)) return nums;
    const v = variance(nums, sample);
    return root ? Math.sqrt(v) : v;
  },
});

/** One numeric argument, or the error it produced. */
function num(arg: FnArg | undefined, fallback?: number): number | FormulaError {
  if (!arg) return fallback ?? err('#N/A', 'Missing argument');
  return toNumber(scalar(arg));
}

function nth(args: FnArg[], largest: boolean): CellValue {
  const nums = collectNumbers([args[0]!]);
  if (isError(nums)) return nums;
  const k = num(args[1]);
  if (isError(k)) return k;
  const i = Math.ceil(k);
  if (i < 1 || i > nums.length) return err('#NUM!', `Position ${k} is outside 1–${nums.length}`);
  const sorted = [...nums].sort((a, b) => (largest ? b - a : a - b));
  return sorted[i - 1]!;
}

function extremeIfs(args: FnArg[], pick: (a: number, b: number) => number, name: string): CellValue {
  if (args.length % 2 === 0) return err('#N/A', `${name} needs criteria in pairs`);
  const r = criteriaMask(args, 1);
  if (isError(r)) return r;
  const nums = r.target.filter((v, i) => r.mask[i] && typeof v === 'number') as number[];
  return nums.length ? nums.reduce((a, b) => pick(a, b)) : 0;
}

/** Quotient rounded to 12 significant digits, so 1.2 / 0.1 counts as 12 rather than 11.999…. */
const cleanQuotient = (n: number, f: number) => Number((n / f).toPrecision(12));

function roundToMultiple(args: FnArg[], up: boolean): CellValue {
  const n = num(args[0]);
  if (isError(n)) return n;
  const f = num(args[1], 1);
  if (isError(f)) return f;
  if (f === 0) return up ? 0 : err('#DIV/0!', 'Factor cannot be zero');
  if (n > 0 && f < 0) return err('#NUM!', 'Factor must be positive when the value is positive');
  // Both negative: round the magnitudes (away from zero for CEILING, towards zero for FLOOR).
  if (n < 0 && f < 0) return -(up ? Math.ceil : Math.floor)(cleanQuotient(-n, -f)) * -f;
  return (up ? Math.ceil : Math.floor)(cleanQuotient(n, f)) * f;
}

const unary =
  (fn: (n: number) => number | FormulaError) =>
  (args: FnArg[]): CellValue => {
    const n = num(args[0]);
    if (isError(n)) return n;
    const r = fn(n);
    return typeof r === 'number' && !Number.isFinite(r) ? err('#NUM!') : r;
  };

function log(n: number, base: number): number | FormulaError {
  if (n <= 0 || base <= 0) return err('#NUM!', 'Logarithms need positive numbers');
  if (base === 1) return err('#DIV/0!', 'The base cannot be 1');
  return Math.log(n) / Math.log(base);
}

/** SWITCH/IFS equality: numbers by value, text case-insensitively. */
function same(a: CellValue, b: CellValue): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

// ---------- statistical ----------

registerFunction('STDEV', varianceFn(true, true));
registerFunction('STDEV.S', varianceFn(true, true));
registerFunction('STDEVP', varianceFn(false, true));
registerFunction('STDEV.P', varianceFn(false, true));
registerFunction('VAR', varianceFn(true, false));
registerFunction('VAR.S', varianceFn(true, false));
registerFunction('VARP', varianceFn(false, false));
registerFunction('VAR.P', varianceFn(false, false));

const mode: FunctionDef = {
  minArgs: 1,
  maxArgs: Infinity,
  impl: (args) => {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    const counts = new Map<number, number>();
    let best: number | null = null;
    let bestCount = 1;
    for (const n of nums) {
      const c = (counts.get(n) ?? 0) + 1;
      counts.set(n, c);
      if (c > bestCount) {
        best = n;
        bestCount = c;
      }
    }
    // Ties go to the value that appears first.
    if (best !== null) for (const n of nums) if (counts.get(n) === bestCount) return n;
    return err('#N/A', 'No value appears more than once');
  },
};
registerFunction('MODE', mode);
registerFunction('MODE.SNGL', mode);

registerFunction('LARGE', { minArgs: 2, maxArgs: 2, impl: (args) => nth(args, true) });
registerFunction('SMALL', { minArgs: 2, maxArgs: 2, impl: (args) => nth(args, false) });

const rank: FunctionDef = {
  minArgs: 2,
  maxArgs: 3,
  impl: (args) => {
    const v = num(args[0]);
    if (isError(v)) return v;
    const nums = collectNumbers([args[1]!]);
    if (isError(nums)) return nums;
    const ascending = args[2] ? toBoolean(scalar(args[2])) : false;
    if (isError(ascending)) return ascending;
    if (!nums.includes(v)) return err('#N/A', `${v} is not in the range`);
    return nums.filter((n) => (ascending ? n < v : n > v)).length + 1;
  },
};
registerFunction('RANK', rank);
registerFunction('RANK.EQ', rank);

registerFunction('MAXIFS', { minArgs: 3, maxArgs: 255, impl: (args) => extremeIfs(args, Math.max, 'MAXIFS') });
registerFunction('MINIFS', { minArgs: 3, maxArgs: 255, impl: (args) => extremeIfs(args, Math.min, 'MINIFS') });

registerFunction('SUMPRODUCT', {
  minArgs: 1,
  maxArgs: 255,
  impl: (args) => {
    const grids: CellValue[][] = [];
    let shape = '';
    for (const a of args) {
      const g = gridOf(a);
      if (isError(g)) return g;
      const s = `${g.length}x${g[0]?.length ?? 0}`;
      if (shape && s !== shape) return err('#VALUE!', 'All ranges must be the same size');
      shape = s;
      grids.push(g.flat());
    }
    let total = 0;
    for (let i = 0; i < grids[0]!.length; i++) {
      let p = 1;
      for (const g of grids) {
        const v = g[i];
        if (isError(v)) return v;
        p *= typeof v === 'number' ? v : 0; // text and blanks count as 0
      }
      total += p;
    }
    return total;
  },
});

registerFunction('SUMSQ', {
  minArgs: 1,
  maxArgs: Infinity,
  impl: (args) => {
    const nums = collectNumbers(args);
    return isError(nums) ? nums : nums.reduce((a, b) => a + b * b, 0);
  },
});

registerFunction('COUNTUNIQUE', {
  minArgs: 1,
  maxArgs: Infinity,
  impl: (args) => {
    const seen = new Set<string>();
    for (const v of flatten(args)) {
      if (v === null || v === '') continue;
      seen.add(isError(v) ? `e:${v.code}` : `${typeof v}:${typeof v === 'string' ? v.toLowerCase() : String(v)}`);
    }
    return seen.size;
  },
});

// ---------- math ----------

registerFunction('CEILING', { minArgs: 1, maxArgs: 2, impl: (args) => roundToMultiple(args, true) });
registerFunction('FLOOR', { minArgs: 1, maxArgs: 2, impl: (args) => roundToMultiple(args, false) });

registerFunction('TRUNC', {
  minArgs: 1,
  maxArgs: 2,
  impl: (args) => {
    const n = num(args[0]);
    if (isError(n)) return n;
    const d = num(args[1], 0);
    if (isError(d)) return d;
    const f = 10 ** Math.trunc(d);
    return Math.trunc(Number((n * f).toPrecision(15))) / f;
  },
});

registerFunction('QUOTIENT', {
  minArgs: 2,
  maxArgs: 2,
  impl: (args) => {
    const a = num(args[0]);
    if (isError(a)) return a;
    const b = num(args[1]);
    if (isError(b)) return b;
    return b === 0 ? err('#DIV/0!') : Math.trunc(a / b);
  },
});

registerFunction('SIGN', { minArgs: 1, maxArgs: 1, impl: unary((n) => Math.sign(n) || 0) });
registerFunction('PI', { minArgs: 0, maxArgs: 0, impl: () => Math.PI });
registerFunction('EXP', { minArgs: 1, maxArgs: 1, impl: unary(Math.exp) });
registerFunction('LN', { minArgs: 1, maxArgs: 1, impl: unary((n) => log(n, Math.E)) });
registerFunction('LOG10', { minArgs: 1, maxArgs: 1, impl: unary((n) => (n <= 0 ? err('#NUM!') : Math.log10(n))) });
registerFunction('LOG', {
  minArgs: 1,
  maxArgs: 2,
  impl: (args) => {
    const n = num(args[0]);
    if (isError(n)) return n;
    const base = num(args[1], 10);
    if (isError(base)) return base;
    if (base === 10 && n > 0) return Math.log10(n);
    return log(n, base);
  },
});

registerFunction('RAND', { minArgs: 0, maxArgs: 0, volatile: true, impl: () => Math.random() });
registerFunction('RANDBETWEEN', {
  minArgs: 2,
  maxArgs: 2,
  volatile: true,
  impl: (args) => {
    const lo = num(args[0]);
    if (isError(lo)) return lo;
    const hi = num(args[1]);
    if (isError(hi)) return hi;
    const a = Math.ceil(lo);
    const b = Math.floor(hi);
    if (a > b) return err('#NUM!', 'The low value must not exceed the high value');
    return a + Math.floor(Math.random() * (b - a + 1));
  },
});

// ---------- logical ----------

registerFunction('IFS', {
  minArgs: 1,
  maxArgs: 254,
  impl: (args) => {
    if (args.length % 2 !== 0) return err('#N/A', 'IFS needs condition and value pairs');
    for (let i = 0; i < args.length; i += 2) {
      const cond = toBoolean(scalar(args[i]!));
      if (isError(cond)) return cond;
      if (cond) return scalar(args[i + 1]!);
    }
    return err('#N/A', 'No condition was true');
  },
});

registerFunction('SWITCH', {
  minArgs: 3,
  maxArgs: 255,
  impl: (args) => {
    const v = scalar(args[0]!);
    if (isError(v)) return v;
    const pairs = args.length - 1;
    for (let i = 1; i + 1 < args.length; i += 2) if (same(v, scalar(args[i]!))) return scalar(args[i + 1]!);
    return pairs % 2 === 1 ? scalar(args[args.length - 1]!) : err('#N/A', 'No case matched');
  },
});

registerFunction('IFNA', {
  minArgs: 2,
  maxArgs: 2,
  impl: (args) => {
    const v = scalar(args[0]!);
    return isError(v) && v.code === '#N/A' ? scalar(args[1]!) : v;
  },
});

// ---------- text ----------

registerFunction('EXACT', {
  minArgs: 2,
  maxArgs: 2,
  impl: (args) => {
    const a = toText(scalar(args[0]!));
    if (isError(a)) return a;
    const b = toText(scalar(args[1]!));
    return isError(b) ? b : a === b;
  },
});

registerFunction('ISTEXT', { minArgs: 1, maxArgs: 1, impl: (args) => typeof scalar(args[0]!) === 'string' });
