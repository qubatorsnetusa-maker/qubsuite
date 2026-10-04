import type { AnswerValue, FormFieldDto } from '@qub/shared';
import { ADDRESS_PARTS, displayAnswer, optionsOfKind, QUESTION_TYPES, scaleBounds, type QuestionTypeDef } from '@qub/shared/forms';

/** Every summary says how many answers it looked at (`total`, one per response) and how many held a usable answer. */
interface Counts {
  total: number;
  answered: number;
}

export type FieldSummary =
  /** Choice types, yes/no and consent. `other` counts selections that match no current option (deleted options, type changes, junk). */
  | (Counts & { kind: 'choice'; options: { id: string; label: string; count: number }[]; other: number })
  /** Ratings, scales, sliders and numbers. `buckets` is the distribution to chart. */
  | (Counts & { kind: 'numeric'; average: number | null; min: number | null; max: number | null; buckets: Bucket[] })
  | (Counts & { kind: 'nps'; promoters: number; passives: number; detractors: number; score: number | null; buckets: Bucket[] })
  /** Latest non-empty answers, newest first (answers are passed newest first, as the responses API returns them). */
  | (Counts & { kind: 'text'; latest: string[] })
  /** Anything without a meaningful aggregate (matrix, ranking, files, signatures, unknown types): just the answered count. */
  | (Counts & { kind: 'other' });

export interface Bucket {
  label: string;
  count: number;
}

export const LATEST_TEXT_ANSWERS = 10;
const MAX_BUCKETS = 10;
/** Scales wider than this (bad settings) are bucketed from the data instead of one bucket per point. */
const MAX_SCALE_POINTS = 101;

/**
 * Summarises one question's answers for the Results tab. Pure, and total over its input: answers are `unknown` because
 * stored answers can predate a question's current type (type conversion), options can have been deleted, and legacy
 * rows can hold odd shapes. Unreadable answers never throw — they are ignored (numbers) or counted under `other`
 * (choices) and the answered count reflects only what could be read.
 */
export function summarizeField(field: FormFieldDto, answers: readonly unknown[]): FieldSummary {
  const list: readonly unknown[] = Array.isArray(answers) ? answers : [];
  const total = list.length;
  const def = typeDef(field);
  if (!def) return { kind: 'other', total, answered: list.filter(hasContent).length };

  if (field.type === 'NPS') return summarizeNps(list);
  switch (def.analyticsKind) {
    case 'choice':
    case 'multi':
      return summarizeChoice(list, safeOptions(field).map((o) => ({ id: o.id, label: o.label })), readOptionIds);
    case 'boolean':
      return summarizeChoice(
        list,
        [
          { id: 'true', label: safeDisplay(def, field, true) || 'Yes' },
          { id: 'false', label: safeDisplay(def, field, false) || 'No' },
        ],
        (v) => (typeof v === 'boolean' ? [String(v)] : []),
      );
    case 'scale':
    case 'numeric':
      return summarizeNumeric(list, safeBounds(field));
    case 'text':
    case 'date': {
      const texts = list.map((v) => answerText(field, v)).filter((s) => s !== '');
      return { kind: 'text', total, answered: texts.length, latest: texts.slice(0, LATEST_TEXT_ANSWERS) };
    }
    default:
      return { kind: 'other', total, answered: list.filter(hasContent).length };
  }
}

function summarizeChoice(list: readonly unknown[], options: { id: string; label: string }[], readIds: (v: unknown) => string[]): FieldSummary {
  const counts = new Map(options.map((o) => [o.id, 0]));
  let answered = 0;
  let other = 0;
  for (const v of list) {
    const ids = readIds(v);
    if (ids.length === 0) {
      // Something is there but it isn't a selection we can read: still an answer, shown as "Other".
      if (hasContent(v)) {
        answered++;
        other++;
      }
      continue;
    }
    answered++;
    for (const id of ids) {
      const c = counts.get(id);
      if (c === undefined) other++;
      else counts.set(id, c + 1);
    }
  }
  return { kind: 'choice', total: list.length, answered, options: options.map((o) => ({ ...o, count: counts.get(o.id) ?? 0 })), other };
}

/** Option ids selected in a choice answer: a single id or an array of ids (non-string entries ignored, each id once). */
function readOptionIds(v: unknown): string[] {
  if (typeof v === 'string') return v.trim() ? [v] : [];
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim() !== ''))];
}

function summarizeNumeric(list: readonly unknown[], bounds: [number, number] | null): FieldSummary {
  const all = list.map(toNumber).filter((n): n is number => n !== null);
  // On a discrete scale, only whole points of the scale are valid answers; anything else would chart wrongly.
  const values = bounds ? all.filter((n) => Number.isInteger(n) && n >= bounds[0] && n <= bounds[1]) : all;
  const answered = values.length;
  // Each value is divided before summing so the total can't overflow to ±Infinity with extreme answers.
  const average = answered ? values.reduce((a, b) => a + b / answered, 0) : null;
  return {
    kind: 'numeric',
    total: list.length,
    answered,
    average,
    // reduce, not Math.min(...values): spreading thousands of answers can overflow the call stack.
    min: answered ? values.reduce((a, b) => Math.min(a, b)) : null,
    max: answered ? values.reduce((a, b) => Math.max(a, b)) : null,
    buckets: bounds ? scaleBuckets(values, bounds) : dataBuckets(values),
  };
}

function summarizeNps(list: readonly unknown[]): FieldSummary {
  const values = list.map(toNumber).filter((n): n is number => n !== null && Number.isInteger(n) && n >= 0 && n <= 10);
  const promoters = values.filter((n) => n >= 9).length;
  const passives = values.filter((n) => n === 7 || n === 8).length;
  const detractors = values.filter((n) => n <= 6).length;
  const answered = values.length;
  return {
    kind: 'nps',
    total: list.length,
    answered,
    promoters,
    passives,
    detractors,
    // Same formula as the server's analytics: % promoters − % detractors, rounded.
    score: answered ? Math.round(((promoters - detractors) / answered) * 100) : null,
    buckets: scaleBuckets(values, [0, 10]),
  };
}

function scaleBuckets(values: number[], [lo, hi]: [number, number]): Bucket[] {
  const buckets = Array.from({ length: hi - lo + 1 }, (_, i) => ({ label: String(lo + i), count: 0 }));
  for (const n of values) buckets[n - lo]!.count++;
  return buckets;
}

/** Unbounded numbers: one bucket per distinct value when there are few, otherwise equal-width ranges. */
function dataBuckets(values: number[]): Bucket[] {
  if (values.length === 0) return [];
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  if (distinct.length <= MAX_BUCKETS) return distinct.map((d) => ({ label: fmt(d), count: values.filter((v) => v === d).length }));
  const min = distinct[0]!;
  const max = distinct[distinct.length - 1]!;
  // Everything is scaled down by 10 first: `max - min` itself overflows to Infinity for answers near ±1.8e308.
  const span = max / 10 - min / 10;
  if (!(span > 0) || !Number.isFinite(span)) return [{ label: `${fmt(min)}–${fmt(max)}`, count: values.length }];
  // Boundary i as a weighted mix of min and max, which stays finite (and exact at both ends) for any finite inputs.
  const edge = (i: number) => (i === 0 ? min : i === MAX_BUCKETS ? max : min * (1 - i / MAX_BUCKETS) + max * (i / MAX_BUCKETS));
  const buckets = Array.from({ length: MAX_BUCKETS }, (_, i) => ({ label: `${fmt(edge(i))}–${fmt(edge(i + 1))}`, count: 0 }));
  for (const v of values) {
    const i = Math.floor(((v / 10 - min / 10) / span) * MAX_BUCKETS);
    buckets[Number.isFinite(i) ? Math.max(0, Math.min(MAX_BUCKETS - 1, i)) : 0]!.count++;
  }
  return buckets;
}

/** Up to 2 decimals; values too large to scale by 100 are shown to 3 significant figures (e.g. "1.7e+308"). */
const fmt = (n: number) => (Number.isFinite(n * 100) ? String(Math.round(n * 100) / 100) : n.toPrecision(3));

/** A finite number, or a string that is one (older text-column answers); anything else is not a number. */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Whether an answer holds anything at all (non-blank text, a finite number, a boolean, or a container of those). */
function hasContent(v: unknown, depth = 0): boolean {
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'boolean') return true;
  if (depth > 4 || typeof v !== 'object' || v === null) return false;
  return (Array.isArray(v) ? v : Object.values(v)).some((x) => hasContent(x, depth + 1));
}

function scalarText(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return String(v);
  return '';
}

/**
 * Plain-text rendering of any answer, for text summaries, the responses table and search. Never throws: scalars as
 * text, lists and records as their scalar parts joined with ", " (addresses in address order), locations by label.
 */
export function answerText(field: Pick<FormFieldDto, 'type'>, v: unknown): string {
  if (typeof v !== 'object' || v === null) return scalarText(v);
  const join = (parts: unknown[]) => parts.map(scalarText).filter(Boolean).join(', ');
  if (Array.isArray(v)) return join(v);
  const rec = v as Record<string, unknown>;
  if (typeof rec.label === 'string') return rec.label.trim();
  if (field?.type === 'ADDRESS') return join(ADDRESS_PARTS.map((p) => rec[p]));
  return join(Object.values(rec));
}

/**
 * How an answer reads in the response panel: the registry's display (option labels, matrix rows…) when it can render
 * the value, otherwise `answerText`. The registry assumes the value matches the question's current type, so a value
 * stored before a type change can throw or come out as "[object Object]"; both fall back to plain text.
 */
export function displayValue(field: FormFieldDto, v: unknown): string {
  try {
    const s = displayAnswer(field, v as AnswerValue);
    if (s && !s.includes('[object Object]')) return s;
  } catch {
    // Fall through to the plain-text rendering.
  }
  return answerText(field, v);
}

function typeDef(field: FormFieldDto): QuestionTypeDef | undefined {
  return typeof field?.type === 'string' && Object.hasOwn(QUESTION_TYPES, field.type) ? QUESTION_TYPES[field.type] : undefined;
}

function safeOptions(field: FormFieldDto) {
  if (!Array.isArray(field.options)) return [];
  return optionsOfKind({ ...field, options: field.options.filter((o) => o && typeof o.id === 'string') });
}

function safeBounds(field: FormFieldDto): [number, number] | null {
  let b: [number, number] | null;
  try {
    b = scaleBounds({ ...field, settings: field.settings ?? {} });
  } catch {
    return null;
  }
  if (!b) return null;
  const [lo, hi] = b;
  return Number.isInteger(lo) && Number.isInteger(hi) && hi >= lo && hi - lo < MAX_SCALE_POINTS ? b : null;
}

function safeDisplay(def: QuestionTypeDef, field: FormFieldDto, v: boolean): string {
  try {
    return def.display(field, v);
  } catch {
    return '';
  }
}
