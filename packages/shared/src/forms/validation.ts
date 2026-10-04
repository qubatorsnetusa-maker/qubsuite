import type { AnswerValue } from '../schemas/forms';
import { isAnswered } from './conditions';
import { QUESTION_TYPES } from './registry';
import type { ValidationIssue } from './registry/types';
import type { EngineField } from './types';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export const issue = (code: string, message: string): ValidationIssue => ({ code, message });

// A hoisted function declaration, not a `const` arrow: `basic.ts` and this module are mutually circular
// (validation.ts -> registry/index.ts -> basic.ts -> validation.ts), and basic.ts passes this reference
// eagerly into a helper at module-load time, before a `const` binding here would be initialized.
export function isValidEmail(s: string): boolean {
  return s.length <= 254 && EMAIL_RE.test(s);
}

/** Optional leading +, then 7–15 digits once spaces, dots, dashes and parentheses are removed. */
export function isValidPhone(s: string): boolean {
  const compact = s.trim().replace(/[\s().-]/g, '');
  return /^\+?\d{7,15}$/.test(compact);
}

export function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

function realDate(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
export const isValidDate = (s: string) => DATE_RE.test(s) && realDate(s);
export const isValidDateTime = (s: string) => DATETIME_RE.test(s) && realDate(s.slice(0, 10));

/**
 * Rejects patterns likely to backtrack catastrophically. A group repeated by `+`, `*` or `{…}` must not contain,
 * at any depth, another quantifier (e.g. (a+)+, ((a+))+, (\w+\s?)+) or an alternation (e.g. (a|aa)+, (a|a)*).
 * Also rejects patterns that do not compile or are longer than 500 characters.
 */
export function isSafePattern(p: string): boolean {
  if (p.length > 500) return false;
  try {
    new RegExp(p);
  } catch {
    return false;
  }
  return !hasRiskyQuantifiedGroup(p);
}

/** Scans a compilable pattern, tracking whether each open group contains (at any depth) a quantifier or `|`. */
function hasRiskyQuantifiedGroup(p: string): boolean {
  const open: { risky: boolean }[] = [];
  const markOpenGroups = () => open.forEach((g) => (g.risky = true));
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '[') {
      // Skip the character class; a `]` straight after `[` or `[^` is literal.
      i++;
      if (p[i] === '^') i++;
      if (p[i] === ']') i++;
      while (i < p.length && p[i] !== ']') i += p[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (c === '(') {
      open.push({ risky: false });
      i++;
      continue;
    }
    if (c === ')') {
      const group = open.pop();
      i++;
      if (group?.risky) {
        const next = p[i];
        if (next === '+' || next === '*' || next === '{') return true;
        // What made this group risky also sits inside every group that encloses it.
        markOpenGroups();
      }
      continue;
    }
    if (c === '|' || c === '+' || c === '*' || c === '{') markOpenGroups();
    i++;
  }
  return false;
}

/** Pattern checks run on at most this many leading characters, bounding regex work on long answers. */
export const PATTERN_INPUT_CAP = 1000;

export function textIssue(field: EngineField, value: string): ValidationIssue | null {
  const v = field.validation;
  if (v.minLength != null && value.length < v.minLength) return issue('min_length', `Must be at least ${v.minLength} characters`);
  if (v.maxLength != null && value.length > v.maxLength) return issue('max_length', `Must be at most ${v.maxLength} characters`);
  if (v.pattern && isSafePattern(v.pattern) && !new RegExp(v.pattern).test(value.slice(0, PATTERN_INPUT_CAP))) {
    return issue('pattern', v.patternMessage || 'Answer does not match the required format');
  }
  return null;
}

export function numberIssue(field: EngineField, n: number): ValidationIssue | null {
  const v = field.validation;
  if (v.integer && !Number.isInteger(n)) return issue('integer', 'Enter a whole number');
  if (v.min != null && n < v.min) return issue('min', `Must be at least ${v.min}`);
  if (v.max != null && n > v.max) return issue('max', `Must be at most ${v.max}`);
  return null;
}

export function dateRangeIssue(field: EngineField, value: string): ValidationIssue | null {
  const { minDate, maxDate } = field.validation;
  if (minDate && value < minDate) return issue('min_date', `Must be on or after ${minDate}`);
  if (maxDate && value > maxDate) return issue('max_date', `Must be on or before ${maxDate}`);
  return null;
}

/** Which custom message replaces the built-in text for each issue code (pattern keeps its own `patternMessage`). */
const MESSAGE_KEY: Record<string, 'lengthMessage' | 'rangeMessage'> = {
  min_length: 'lengthMessage',
  max_length: 'lengthMessage',
  min: 'rangeMessage',
  max: 'rangeMessage',
  min_date: 'rangeMessage',
  max_date: 'rangeMessage',
  min_selected: 'rangeMessage',
  max_selected: 'rangeMessage',
  range: 'rangeMessage',
};
const custom = (s: string | undefined) => (s && s.trim() ? s : null);

/** Validates one answer against its field. Required is enforced here; type rules come from the registry. */
export function validateFieldAnswer(field: EngineField, value: AnswerValue | undefined): ValidationIssue | null {
  const def = QUESTION_TYPES[field.type];
  if (!def.isInput) return null;
  if (!isAnswered(value)) return field.required ? issue('required', custom(field.validation.requiredMessage) ?? 'This question is required') : null;
  const found = def.validate(field, value as AnswerValue);
  const key = found ? MESSAGE_KEY[found.code] : undefined;
  const override = key ? custom(field.validation[key]) : null;
  return found && override ? { ...found, message: override } : found;
}
