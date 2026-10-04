export type ErrorCode = '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#N/A' | '#NUM!' | '#CYCLE!' | '#ERROR!';

export const ERROR_CODES: readonly ErrorCode[] = ['#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#N/A', '#NUM!', '#CYCLE!', '#ERROR!'];

export class FormulaError {
  constructor(
    readonly code: ErrorCode,
    readonly message?: string,
  ) {}
  toString(): string {
    return this.code;
  }
}

export type Scalar = number | string | boolean | null;
export type CellValue = Scalar | FormulaError;

export interface RangeValue {
  kind: 'range';
  /** Row-major grid. */
  values: CellValue[][];
}

export type EvalResult = CellValue | RangeValue;

export const isError = (v: unknown): v is FormulaError => v instanceof FormulaError;
export const isRange = (v: unknown): v is RangeValue =>
  typeof v === 'object' && v !== null && (v as RangeValue).kind === 'range';

export const err = (code: ErrorCode, message?: string) => new FormulaError(code, message);

export function toNumber(v: CellValue): number | FormulaError {
  if (v instanceof FormulaError) return v;
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const parsed = parseNumberLiteral(v);
  return parsed ?? err('#VALUE!', `"${v}" is not a number`);
}

export function toText(v: CellValue): string | FormulaError {
  if (v instanceof FormulaError) return v;
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return formatGeneralNumber(v);
  return v;
}

export function toBoolean(v: CellValue): boolean | FormulaError {
  if (v instanceof FormulaError) return v;
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const upper = v.trim().toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  return err('#VALUE!', `"${v}" is not a boolean`);
}

/** Parses user-typed numbers: "12", "-3.5", "1e3", "1,234.5", "45%", "$12.50". */
export function parseNumberLiteral(raw: string): number | null {
  let s = raw.trim();
  if (s === '') return null;
  let percent = false;
  if (s.endsWith('%')) {
    percent = true;
    s = s.slice(0, -1).trim();
  }
  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  if (s.startsWith('$')) s = s.slice(1);
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  if (!/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  let n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (negative) n = -n;
  if (percent) n = n / 100;
  return n;
}

export function formatGeneralNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return n.toExponential(5).replace(/\.?0+e/, 'e');
  // Round to 10 significant digits to hide floating-point noise (0.1 + 0.2).
  return String(Number(n.toPrecision(10)));
}
