import type { ConditionOp } from '../enums';
import type { AnswerValue, Condition, ConditionValue } from '../schemas/forms';

export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  return Object.values(value).some((v) => (typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null));
}

export interface ConditionContext {
  fieldValue(id: string): AnswerValue | undefined;
  variableValue(id: string): ConditionValue | undefined;
  score(): number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function order(a: string | number | boolean, b: ConditionValue): number | null {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na - nb;
  if (typeof a === 'string' && typeof b === 'string' && ISO_DATE.test(a) && ISO_DATE.test(b)) return a < b ? -1 : a > b ? 1 : 0;
  return null;
}

function scalarEquals(a: string | number | boolean, e: ConditionValue): boolean {
  if (e === null) return false;
  if (typeof a === 'number') return asNumber(e) === a;
  if (typeof a === 'boolean') return a === e || String(a) === String(e).toLowerCase();
  return a === String(e);
}

const lower = (v: unknown) => String(v).toLowerCase();

export function compareLeaf(op: ConditionOp, actual: AnswerValue | undefined, expected: ConditionValue): boolean {
  const answered = isAnswered(actual);
  if (op === 'answered') return answered;
  if (op === 'unanswered') return !answered;
  if (!answered) return op === 'neq' || op === 'not_contains';
  const a = actual as Exclude<AnswerValue, null>;

  if (Array.isArray(a)) {
    const e = expected === null ? null : String(expected);
    switch (op) {
      case 'eq':
        return a.length === 1 && a[0] === e;
      case 'neq':
        return !(a.length === 1 && a[0] === e);
      case 'contains':
        return e !== null && a.includes(e);
      case 'not_contains':
        return e === null || !a.includes(e);
      default:
        return false;
    }
  }

  if (typeof a === 'object') {
    const text = Object.values(a).filter((v) => v !== undefined && v !== null).map(lower).join(' ');
    if (op === 'contains') return expected !== null && text.includes(lower(expected));
    if (op === 'not_contains') return expected === null || !text.includes(lower(expected));
    return false;
  }

  switch (op) {
    case 'eq':
      return scalarEquals(a, expected);
    case 'neq':
      return !scalarEquals(a, expected);
    case 'contains':
      return expected !== null && lower(a).includes(lower(expected));
    case 'not_contains':
      return expected === null || !lower(a).includes(lower(expected));
    case 'starts_with':
      return expected !== null && lower(a).startsWith(lower(expected));
    case 'ends_with':
      return expected !== null && lower(a).endsWith(lower(expected));
    case 'gt':
    case 'lt':
    case 'gte':
    case 'lte': {
      const c = order(a, expected);
      if (c === null) return false;
      return op === 'gt' ? c > 0 : op === 'lt' ? c < 0 : op === 'gte' ? c >= 0 : c <= 0;
    }
  }
}

export function evaluateCondition(c: Condition, ctx: ConditionContext): boolean {
  if ('all' in c) return c.all.every((x) => evaluateCondition(x, ctx));
  if ('any' in c) return c.any.some((x) => evaluateCondition(x, ctx));
  if ('not' in c) return !evaluateCondition(c.not, ctx);
  const actual: AnswerValue | undefined =
    c.subject.type === 'field' ? ctx.fieldValue(c.subject.id) : c.subject.type === 'variable' ? ctx.variableValue(c.subject.id) : ctx.score();
  return compareLeaf(c.op, actual, c.value ?? null);
}
