import { MAX_DATE_SERIAL, nowSerial, parseDateTime, partsFromSerial, serialFromParts, todaySerial, type DateParts } from './dates';
import { registerFunction, scalar, type FnArg } from './functions';
import { err, isError, toNumber, toText, type CellValue, type FormulaError } from './values';

/** A date argument as a serial: numbers as-is, text through the typed-date recogniser. */
export function toSerial(v: CellValue): number | FormulaError {
  if (isError(v)) return v;
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return err('#VALUE!', 'Expected a date');
  const d = parseDateTime(v);
  return d ? d.serial : err('#VALUE!', `"${v}" is not a date`);
}

function dateArg(a: FnArg): number | FormulaError {
  const s = toSerial(scalar(a));
  if (isError(s)) return s;
  return s < 0 || s >= MAX_DATE_SERIAL + 1 ? err('#NUM!', 'Date is out of range') : s;
}

function intArg(a: FnArg): number | FormulaError {
  const n = toNumber(scalar(a));
  return isError(n) ? n : Math.trunc(n);
}

const partFn = (pick: (p: DateParts) => number) => ({
  minArgs: 1,
  maxArgs: 1,
  impl: (args: FnArg[]): CellValue => {
    const s = dateArg(args[0]!);
    return isError(s) ? s : pick(partsFromSerial(s));
  },
});

const lastDayOf = (y: number, m: number) => partsFromSerial(serialFromParts(y, m + 1, 0)).day;

/** Adds calendar months, clamping the day to the target month's length (or using its last day). */
function addMonths(serial: number, months: number, endOfMonth: boolean): number {
  const p = partsFromSerial(Math.floor(serial));
  const t = partsFromSerial(serialFromParts(p.year, p.month + months, 1));
  const last = lastDayOf(t.year, t.month);
  return serialFromParts(t.year, t.month, endOfMonth ? last : Math.min(p.day, last));
}

function monthsArgs(args: FnArg[], endOfMonth: boolean): CellValue {
  const s = dateArg(args[0]!);
  if (isError(s)) return s;
  const m = intArg(args[1]!);
  if (isError(m)) return m;
  return addMonths(s, m, endOfMonth);
}

registerFunction('TODAY', { minArgs: 0, maxArgs: 0, volatile: true, impl: () => todaySerial() });
registerFunction('NOW', { minArgs: 0, maxArgs: 0, volatile: true, impl: () => nowSerial() });

registerFunction('DATE', {
  minArgs: 3,
  maxArgs: 3,
  impl: (args) => {
    const parts: number[] = [];
    for (const a of args) {
      const n = intArg(a);
      if (isError(n)) return n;
      parts.push(n);
    }
    const [y, m, d] = parts as [number, number, number];
    if (y < 0 || y > 9999) return err('#NUM!', 'Year is out of range');
    const s = serialFromParts(y < 1900 ? y + 1900 : y, m, d);
    return s < 0 ? err('#NUM!', 'Date is before 1899-12-30') : s;
  },
});

registerFunction('TIME', {
  minArgs: 3,
  maxArgs: 3,
  impl: (args) => {
    const parts: number[] = [];
    for (const a of args) {
      const n = intArg(a);
      if (isError(n)) return n;
      parts.push(n);
    }
    const total = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    return total < 0 ? err('#NUM!', 'Time is negative') : (total % 86_400) / 86_400;
  },
});

registerFunction('YEAR', partFn((p) => p.year));
registerFunction('MONTH', partFn((p) => p.month));
registerFunction('DAY', partFn((p) => p.day));
registerFunction('HOUR', partFn((p) => p.hour));
registerFunction('MINUTE', partFn((p) => p.minute));

registerFunction('WEEKDAY', {
  minArgs: 1,
  maxArgs: 2,
  impl: (args) => {
    const s = dateArg(args[0]!);
    if (isError(s)) return s;
    const type = args[1] ? intArg(args[1]) : 1;
    if (isError(type)) return type;
    const wd = partsFromSerial(s).weekday; // 0 = Sunday
    if (type === 1) return wd + 1;
    if (type === 2) return wd === 0 ? 7 : wd;
    if (type === 3) return wd === 0 ? 6 : wd - 1;
    return err('#NUM!', 'WEEKDAY type must be 1, 2 or 3');
  },
});

registerFunction('EDATE', { minArgs: 2, maxArgs: 2, impl: (args) => monthsArgs(args, false) });
registerFunction('EOMONTH', { minArgs: 2, maxArgs: 2, impl: (args) => monthsArgs(args, true) });

registerFunction('DATEDIF', {
  minArgs: 3,
  maxArgs: 3,
  impl: (args) => {
    const a = dateArg(args[0]!);
    if (isError(a)) return a;
    const b = dateArg(args[1]!);
    if (isError(b)) return b;
    const unit = toText(scalar(args[2]!));
    if (isError(unit)) return unit;
    const start = Math.floor(a);
    const end = Math.floor(b);
    if (end < start) return err('#NUM!', 'Start date is after end date');
    const p = partsFromSerial(start);
    const q = partsFromSerial(end);
    let months = (q.year - p.year) * 12 + (q.month - p.month);
    if (q.day < p.day) months--;
    switch (unit.toUpperCase()) {
      case 'Y':
        return Math.floor(months / 12);
      case 'M':
        return months;
      case 'D':
        return end - start;
      case 'YM':
        return months % 12;
      case 'MD':
        return q.day >= p.day ? q.day - p.day : lastDayOf(q.year, q.month - 1) - p.day + q.day;
      case 'YD': {
        let anniversary = serialFromParts(q.year, p.month, p.day);
        if (anniversary > end) anniversary = serialFromParts(q.year - 1, p.month, p.day);
        return end - anniversary;
      }
      default:
        return err('#NUM!', `Unknown DATEDIF unit "${unit}"`);
    }
  },
});

registerFunction('DATEVALUE', {
  minArgs: 1,
  maxArgs: 1,
  impl: (args) => {
    const t = toText(scalar(args[0]!));
    if (isError(t)) return t;
    const d = parseDateTime(t);
    return d && d.kind !== 'time' ? Math.floor(d.serial) : err('#VALUE!', `"${t}" is not a date`);
  },
});
