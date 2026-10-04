import { DAY_NAMES, MONTH_NAMES, parseDateTime, partsFromSerial } from './dates';
import { registerFunction, scalar, type FnArg } from './functions';
import { toSerial } from './functions-datetime';
import { gridOf } from './functions-lookup';
import { err, isError, parseNumberLiteral, toBoolean, toNumber, toText, type CellValue, type FormulaError } from './values';

const text = (a: FnArg) => toText(scalar(a));
function int(a: FnArg): number | FormulaError {
  const n = toNumber(scalar(a));
  return isError(n) ? n : Math.trunc(n);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** SEARCH patterns: ? = any char, * = any run, ~ escapes the next char. Case-insensitive. */
function wildcardRegex(pattern: string): RegExp {
  let src = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === '~' && i + 1 < pattern.length) src += escapeRegex(pattern[++i]!);
    else if (ch === '*') src += '.*';
    else if (ch === '?') src += '.';
    else src += escapeRegex(ch);
  }
  return new RegExp(src, 'is');
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const DATE_TOKENS = ['am/pm', 'yyyy', 'mmmm', 'dddd', 'mmm', 'ddd', 'yy', 'mm', 'dd', 'hh', 'ss', 'm', 'd', 'h', 's'];
const isWord = (t: string) => /[a-z]/.test(t);

/** TEXT(value, pattern) for number patterns like #,##0.00 and date/time patterns built from the supported tokens. */
export function formatTextPattern(value: number, pattern: string): string | FormulaError {
  const num = /^(\$)?(#,##)?0(\.0+)?(%)?$/.exec(pattern);
  if (num) {
    const [, currency, group, decimals, percent] = num;
    const digits = decimals ? decimals.length - 1 : 0;
    const v = percent ? value * 100 : value;
    const body = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: !!group });
    const negative = v < 0 && Number(body.replace(/,/g, '')) !== 0;
    return `${negative ? '-' : ''}${currency ?? ''}${body}${percent ?? ''}`;
  }
  const tokens: string[] = [];
  let i = 0;
  while (i < pattern.length) {
    const rest = pattern.slice(i).toLowerCase();
    const tok = DATE_TOKENS.find((t) => rest.startsWith(t));
    if (tok) {
      tokens.push(tok);
      i += tok.length;
    } else if ('-/:,. '.includes(pattern[i]!)) tokens.push(pattern[i++]!);
    else return err('#VALUE!', `Unsupported TEXT pattern "${pattern}"`);
  }
  const p = partsFromSerial(value);
  const twelveHour = tokens.includes('am/pm');
  const hour = twelveHour ? p.hour % 12 || 12 : p.hour;
  // mm / m mean minutes right after an hour token or right before a seconds token.
  const isMinute = (k: number) => {
    const prev = tokens.slice(0, k).reverse().find(isWord);
    const next = tokens.slice(k + 1).find(isWord);
    return prev === 'h' || prev === 'hh' || next === 's' || next === 'ss';
  };
  return tokens
    .map((t, k) => {
      switch (t) {
        case 'yyyy':
          return String(p.year);
        case 'yy':
          return pad(p.year % 100);
        case 'mmmm':
          return MONTH_NAMES[p.month - 1]!;
        case 'mmm':
          return MONTH_NAMES[p.month - 1]!.slice(0, 3);
        case 'mm':
          return isMinute(k) ? pad(p.minute) : pad(p.month);
        case 'm':
          return isMinute(k) ? String(p.minute) : String(p.month);
        case 'dddd':
          return DAY_NAMES[p.weekday]!;
        case 'ddd':
          return DAY_NAMES[p.weekday]!.slice(0, 3);
        case 'dd':
          return pad(p.day);
        case 'd':
          return String(p.day);
        case 'hh':
          return pad(hour);
        case 'h':
          return String(hour);
        case 'ss':
          return pad(p.second);
        case 's':
          return String(p.second);
        case 'am/pm':
          return p.hour < 12 ? 'AM' : 'PM';
        default:
          return t;
      }
    })
    .join('');
}

registerFunction('SUBSTITUTE', {
  minArgs: 3,
  maxArgs: 4,
  impl: (args) => {
    const t = text(args[0]!);
    if (isError(t)) return t;
    const o = text(args[1]!);
    if (isError(o)) return o;
    const n = text(args[2]!);
    if (isError(n)) return n;
    if (!o) return t;
    if (!args[3]) return t.split(o).join(n);
    const which = int(args[3]);
    if (isError(which)) return which;
    if (which < 1) return err('#VALUE!', 'Instance must be at least 1');
    let at = -1;
    for (let k = 0; k < which; k++) {
      at = t.indexOf(o, at + 1);
      if (at < 0) return t;
    }
    return t.slice(0, at) + n + t.slice(at + o.length);
  },
});

const findFn = (caseSensitive: boolean) => ({
  minArgs: 2,
  maxArgs: 3,
  impl: (args: FnArg[]): CellValue => {
    const needle = text(args[0]!);
    if (isError(needle)) return needle;
    const hay = text(args[1]!);
    if (isError(hay)) return hay;
    const start = args[2] ? int(args[2]) : 1;
    if (isError(start)) return start;
    if (start < 1 || start > hay.length + 1) return err('#VALUE!', 'Start position is out of range');
    let pos: number;
    if (caseSensitive) pos = hay.indexOf(needle, start - 1);
    else {
      const m = wildcardRegex(needle).exec(hay.slice(start - 1));
      pos = m ? m.index + start - 1 : -1;
    }
    return pos < 0 ? err('#VALUE!', `Did not find "${needle}"`) : pos + 1;
  },
});
registerFunction('FIND', findFn(true));
registerFunction('SEARCH', findFn(false));

registerFunction('MID', {
  minArgs: 3,
  maxArgs: 3,
  impl: (args) => {
    const t = text(args[0]!);
    if (isError(t)) return t;
    const s = int(args[1]!);
    if (isError(s)) return s;
    const n = int(args[2]!);
    if (isError(n)) return n;
    if (s < 1 || n < 0) return err('#VALUE!', 'MID start must be at least 1 and length at least 0');
    return Array.from(t).slice(s - 1, s - 1 + n).join('');
  },
});

registerFunction('PROPER', {
  minArgs: 1,
  maxArgs: 1,
  impl: (args) => {
    const t = text(args[0]!);
    return isError(t) ? t : t.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
  },
});

registerFunction('REPT', {
  minArgs: 2,
  maxArgs: 2,
  impl: (args) => {
    const t = text(args[0]!);
    if (isError(t)) return t;
    const n = int(args[1]!);
    if (isError(n)) return n;
    if (n < 0 || t.length * n > 32_000) return err('#VALUE!', 'REPT result is out of range');
    return t.repeat(n);
  },
});

registerFunction('VALUE', {
  minArgs: 1,
  maxArgs: 1,
  impl: (args) => {
    const v = scalar(args[0]!);
    if (isError(v) || typeof v === 'number') return v;
    const t = v === null ? '' : String(v);
    const n = parseNumberLiteral(t);
    if (n !== null) return n;
    const d = parseDateTime(t);
    return d ? d.serial : err('#VALUE!', `"${t}" is not a number`);
  },
});

registerFunction('TEXTJOIN', {
  minArgs: 3,
  maxArgs: 255,
  impl: (args) => {
    const delim = text(args[0]!);
    if (isError(delim)) return delim;
    const ignoreEmpty = toBoolean(scalar(args[1]!));
    if (isError(ignoreEmpty)) return ignoreEmpty;
    const parts: string[] = [];
    for (const a of args.slice(2)) {
      const g = gridOf(a);
      if (isError(g)) return g;
      for (const v of g.flat()) {
        const s = toText(v);
        if (isError(s)) return s;
        if (ignoreEmpty && s === '') continue;
        parts.push(s);
      }
    }
    return parts.join(delim);
  },
});

registerFunction('TEXT', {
  minArgs: 2,
  maxArgs: 2,
  impl: (args) => {
    const pattern = text(args[1]!);
    if (isError(pattern)) return pattern;
    const raw = scalar(args[0]!);
    const v = typeof raw === 'number' ? raw : toSerial(raw);
    return isError(v) ? v : formatTextPattern(v, pattern);
  },
});
