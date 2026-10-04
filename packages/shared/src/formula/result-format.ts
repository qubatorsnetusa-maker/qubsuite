import type { DateKind } from './dates';
import type { AstNode, CellRef } from './parser';

const FUNCTION_FORMATS: Record<string, DateKind> = {
  DATE: 'date',
  DATEVALUE: 'date',
  EDATE: 'date',
  EOMONTH: 'date',
  TODAY: 'date',
  NOW: 'datetime',
  TIME: 'time',
};

/** Functions whose result is one of their arguments (so a date in stays a date out). */
const PASS_THROUGH = new Set(['MIN', 'MAX']);

/** The number format of the cell a reference points at, if it is a date/time format. */
export type RefFormat = (ref: CellRef) => DateKind | undefined;

/**
 * The date/time format Google Sheets would show a formula's result in when the cell has no format of its own:
 * date functions, references to dated cells, date ± number and MIN/MAX over dates. Anything else → undefined.
 */
export function inferResultFormat(ast: AstNode, refFormat: RefFormat): DateKind | undefined {
  switch (ast.type) {
    case 'func': {
      const name = ast.name.toUpperCase();
      if (FUNCTION_FORMATS[name]) return FUNCTION_FORMATS[name];
      if (!PASS_THROUGH.has(name)) return undefined;
      const kinds = ast.args.map((a) => inferResultFormat(a, refFormat));
      return kinds.length && kinds.every((k) => k && k === kinds[0]) ? kinds[0] : undefined;
    }
    case 'ref':
      return refFormat(ast.ref);
    case 'range': {
      // A range feeds MIN/MAX: its format counts only when both corners agree.
      const a = refFormat(ast.start);
      return a && a === refFormat(ast.end) ? a : undefined;
    }
    case 'binary': {
      if (ast.op !== '+' && ast.op !== '-') return undefined;
      const l = inferResultFormat(ast.left, refFormat);
      const r = inferResultFormat(ast.right, refFormat);
      if (l && r) return undefined; // date − date is a number of days
      if (l) return l;
      return ast.op === '+' ? r : undefined;
    }
    default:
      return undefined;
  }
}
