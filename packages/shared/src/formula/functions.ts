import {
  err,
  FormulaError,
  isError,
  isRange,
  parseNumberLiteral,
  toBoolean,
  toNumber,
  toText,
  type CellValue,
  type EvalResult,
} from './values';

/** Arguments are evaluated lazily so functions like IF only evaluate the branch they need. */
export interface FnArg {
  eval(): EvalResult;
  /** A single-cell reference (A1), which aggregates treat like a range: its text is ignored, not coerced. */
  isReference?: boolean;
}

export interface FunctionDef {
  minArgs: number;
  maxArgs: number; // Infinity for variadic
  /** Re-evaluated on load and after every edit batch (TODAY, NOW). */
  volatile?: boolean;
  impl(args: FnArg[]): CellValue;
}

/** Scalar value of an argument; a single-cell range collapses to its value. */
export function scalar(arg: FnArg): CellValue {
  const v = arg.eval();
  if (isRange(v)) {
    if (v.values.length === 1 && v.values[0]!.length === 1) return v.values[0]![0]!;
    return err('#VALUE!', 'Expected a single value but got a range');
  }
  return v;
}

/**
 * Collects numbers following spreadsheet aggregate semantics:
 * values inside ranges (or a referenced cell) only count when numeric; typed arguments are coerced.
 */
export function collectNumbers(args: FnArg[]): number[] | FormulaError {
  const out: number[] = [];
  for (const a of args) {
    const v = a.eval();
    if (isRange(v) || a.isReference) {
      for (const cell of flattenRange(v)) {
        if (isError(cell)) return cell;
        if (typeof cell === 'number') out.push(cell);
      }
    } else {
      if (v === null) continue;
      const n = toNumber(v);
      if (isError(n)) return n;
      out.push(n);
    }
  }
  return out;
}

export function flatten(args: FnArg[]): CellValue[] {
  const out: CellValue[] = [];
  for (const a of args) {
    const v = a.eval();
    if (isRange(v)) for (const row of v.values) out.push(...row);
    else out.push(v);
  }
  return out;
}

function flattenRange(v: EvalResult): CellValue[] {
  if (isRange(v)) return v.values.flat();
  return [v];
}

/** Criteria such as ">10", "<>x", "apple", "=5" used by COUNTIF/SUMIF/AVERAGEIF. */
export function buildCriteria(criterion: CellValue): (v: CellValue) => boolean {
  if (typeof criterion === 'number') return (v) => typeof v === 'number' && v === criterion;
  if (typeof criterion === 'boolean') return (v) => v === criterion;
  const text = criterion === null || isError(criterion) ? '' : String(criterion);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(text)!;
  const op = m[1] ?? '=';
  const operand = m[2]!;
  const num = parseNumberLiteral(operand);
  if (num !== null) {
    return (v) => {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? parseNumberLiteral(v) : null;
      if (n === null) return op === '<>';
      switch (op) {
        case '<':
          return n < num;
        case '>':
          return n > num;
        case '<=':
          return n <= num;
        case '>=':
          return n >= num;
        case '<>':
          return n !== num;
        default:
          return n === num;
      }
    };
  }
  // Text comparison with * and ? wildcards, case-insensitive.
  const pattern = new RegExp(
    '^' +
      operand
        .toLowerCase()
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
    's',
  );
  return (v) => {
    const s = v === null ? '' : isError(v) ? v.code : String(v).toLowerCase();
    const matches = pattern.test(s);
    return op === '<>' ? !matches : op === '=' ? matches : false;
  };
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f;
}

const numericUnary =
  (fn: (n: number) => number | FormulaError) =>
  (args: FnArg[]): CellValue => {
    const n = toNumber(scalar(args[0]!));
    if (isError(n)) return n;
    const r = fn(n);
    return typeof r === 'number' && !Number.isFinite(r) ? err('#NUM!') : r;
  };

export const FUNCTIONS: Record<string, FunctionDef> = {
  SUM: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      const nums = collectNumbers(args);
      return isError(nums) ? nums : nums.reduce((a, b) => a + b, 0);
    },
  },
  AVERAGE: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      const nums = collectNumbers(args);
      if (isError(nums)) return nums;
      if (nums.length === 0) return err('#DIV/0!');
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    },
  },
  MIN: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      const nums = collectNumbers(args);
      if (isError(nums)) return nums;
      return nums.length === 0 ? 0 : Math.min(...nums);
    },
  },
  MAX: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      const nums = collectNumbers(args);
      if (isError(nums)) return nums;
      return nums.length === 0 ? 0 : Math.max(...nums);
    },
  },
  COUNT: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      let count = 0;
      for (const a of args) {
        const v = a.eval();
        for (const cell of flattenRange(v)) {
          if (typeof cell === 'number') count++;
          else if (!isRange(v) && !a.isReference && typeof cell === 'string' && parseNumberLiteral(cell) !== null) count++;
        }
      }
      return count;
    },
  },
  COUNTA: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => flatten(args).filter((v) => v !== null && v !== '').length,
  },
  COUNTBLANK: {
    minArgs: 1,
    maxArgs: 1,
    impl: (args) => flatten(args).filter((v) => v === null || v === '').length,
  },
  COUNTIF: {
    minArgs: 2,
    maxArgs: 2,
    impl: (args) => {
      const test = buildCriteria(scalar(args[1]!));
      return flattenRange(args[0]!.eval()).filter(test).length;
    },
  },
  SUMIF: {
    minArgs: 2,
    maxArgs: 3,
    impl: (args) => {
      const test = buildCriteria(scalar(args[1]!));
      const range = flattenRange(args[0]!.eval());
      const sumRange = args[2] ? flattenRange(args[2].eval()) : range;
      let total = 0;
      range.forEach((v, i) => {
        const s = sumRange[i];
        if (test(v) && typeof s === 'number') total += s;
      });
      return total;
    },
  },
  AVERAGEIF: {
    minArgs: 2,
    maxArgs: 3,
    impl: (args) => {
      const test = buildCriteria(scalar(args[1]!));
      const range = flattenRange(args[0]!.eval());
      const avgRange = args[2] ? flattenRange(args[2].eval()) : range;
      let total = 0;
      let n = 0;
      range.forEach((v, i) => {
        const s = avgRange[i];
        if (test(v) && typeof s === 'number') {
          total += s;
          n++;
        }
      });
      return n === 0 ? err('#DIV/0!') : total / n;
    },
  },
  PRODUCT: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      const nums = collectNumbers(args);
      return isError(nums) ? nums : nums.reduce((a, b) => a * b, 1);
    },
  },
  MEDIAN: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      const nums = collectNumbers(args);
      if (isError(nums)) return nums;
      if (nums.length === 0) return err('#NUM!');
      const s = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
    },
  },
  IF: {
    minArgs: 2,
    maxArgs: 3,
    impl: (args) => {
      const cond = toBoolean(scalar(args[0]!));
      if (isError(cond)) return cond;
      if (cond) return scalar(args[1]!);
      return args[2] ? scalar(args[2]) : false;
    },
  },
  IFERROR: {
    minArgs: 2,
    maxArgs: 2,
    impl: (args) => {
      const v = scalar(args[0]!);
      return isError(v) ? scalar(args[1]!) : v;
    },
  },
  AND: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      for (const v of flatten(args)) {
        if (v === null) continue;
        const b = toBoolean(v);
        if (isError(b)) return b;
        if (!b) return false;
      }
      return true;
    },
  },
  OR: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      for (const v of flatten(args)) {
        if (v === null) continue;
        const b = toBoolean(v);
        if (isError(b)) return b;
        if (b) return true;
      }
      return false;
    },
  },
  NOT: {
    minArgs: 1,
    maxArgs: 1,
    impl: (args) => {
      const b = toBoolean(scalar(args[0]!));
      return isError(b) ? b : !b;
    },
  },
  ABS: { minArgs: 1, maxArgs: 1, impl: numericUnary(Math.abs) },
  SQRT: { minArgs: 1, maxArgs: 1, impl: numericUnary((n) => (n < 0 ? err('#NUM!') : Math.sqrt(n))) },
  INT: { minArgs: 1, maxArgs: 1, impl: numericUnary(Math.floor) },
  ROUND: {
    minArgs: 1,
    maxArgs: 2,
    impl: (args) => {
      const n = toNumber(scalar(args[0]!));
      if (isError(n)) return n;
      const d = args[1] ? toNumber(scalar(args[1])) : 0;
      if (isError(d)) return d;
      return round(n, Math.trunc(d));
    },
  },
  MOD: {
    minArgs: 2,
    maxArgs: 2,
    impl: (args) => {
      const a = toNumber(scalar(args[0]!));
      const b = toNumber(scalar(args[1]!));
      if (isError(a)) return a;
      if (isError(b)) return b;
      if (b === 0) return err('#DIV/0!');
      return a - b * Math.floor(a / b);
    },
  },
  POWER: {
    minArgs: 2,
    maxArgs: 2,
    impl: (args) => {
      const a = toNumber(scalar(args[0]!));
      const b = toNumber(scalar(args[1]!));
      if (isError(a)) return a;
      if (isError(b)) return b;
      const r = a ** b;
      return Number.isFinite(r) ? r : err('#NUM!');
    },
  },
  CONCAT: {
    minArgs: 1,
    maxArgs: Infinity,
    impl: (args) => {
      let s = '';
      for (const v of flatten(args)) {
        const t = toText(v);
        if (isError(t)) return t;
        s += t;
      }
      return s;
    },
  },
  LEN: {
    minArgs: 1,
    maxArgs: 1,
    impl: (args) => {
      const t = toText(scalar(args[0]!));
      return isError(t) ? t : t.length;
    },
  },
  UPPER: {
    minArgs: 1,
    maxArgs: 1,
    impl: (args) => {
      const t = toText(scalar(args[0]!));
      return isError(t) ? t : t.toUpperCase();
    },
  },
  LOWER: {
    minArgs: 1,
    maxArgs: 1,
    impl: (args) => {
      const t = toText(scalar(args[0]!));
      return isError(t) ? t : t.toLowerCase();
    },
  },
  TRIM: {
    minArgs: 1,
    maxArgs: 1,
    impl: (args) => {
      const t = toText(scalar(args[0]!));
      return isError(t) ? t : t.trim().replace(/\s+/g, ' ');
    },
  },
  LEFT: {
    minArgs: 1,
    maxArgs: 2,
    impl: (args) => {
      const t = toText(scalar(args[0]!));
      const n = args[1] ? toNumber(scalar(args[1])) : 1;
      if (isError(t)) return t;
      if (isError(n)) return n;
      return n < 0 ? err('#VALUE!') : t.slice(0, n);
    },
  },
  RIGHT: {
    minArgs: 1,
    maxArgs: 2,
    impl: (args) => {
      const t = toText(scalar(args[0]!));
      const n = args[1] ? toNumber(scalar(args[1])) : 1;
      if (isError(t)) return t;
      if (isError(n)) return n;
      return n < 0 ? err('#VALUE!') : n === 0 ? '' : t.slice(-n);
    },
  },
  ISBLANK: { minArgs: 1, maxArgs: 1, impl: (args) => scalar(args[0]!) === null },
  ISNUMBER: { minArgs: 1, maxArgs: 1, impl: (args) => typeof scalar(args[0]!) === 'number' },
  ISERROR: { minArgs: 1, maxArgs: 1, impl: (args) => isError(scalar(args[0]!)) },
};
FUNCTIONS.CONCATENATE = FUNCTIONS.CONCAT!;

/** Registers an additional function. The engine is intentionally open for extension. */
export function registerFunction(name: string, def: FunctionDef): void {
  FUNCTIONS[name.toUpperCase()] = def;
}

export const FUNCTION_NAMES = () => Object.keys(FUNCTIONS).sort();
