import type { Condition } from '../schemas/forms';

export interface IdMaps {
  fields?: Map<string, string>;
  options?: Map<string, string>;
  variables?: Map<string, string>;
}

/** Smallest `q{n}` (or `{base}{n}`) not already used, compared case-insensitively. */
export function freshRef(used: Iterable<string>, base = 'q'): string {
  const taken = new Set([...used].map((r) => r.toLowerCase()));
  for (let n = 1; ; n++) if (!taken.has(`${base}${n}`.toLowerCase())) return `${base}${n}`;
}

/** Rewrites ids inside a condition tree (used when duplicating questions and copying forms). */
export function remapCondition(c: Condition, maps: IdMaps): Condition {
  if ('all' in c) return { all: c.all.map((x) => remapCondition(x, maps)) };
  if ('any' in c) return { any: c.any.map((x) => remapCondition(x, maps)) };
  if ('not' in c) return { not: remapCondition(c.not, maps) };
  const subject =
    c.subject.type === 'field'
      ? { type: 'field' as const, id: maps.fields?.get(c.subject.id) ?? c.subject.id }
      : c.subject.type === 'variable'
        ? { type: 'variable' as const, id: maps.variables?.get(c.subject.id) ?? c.subject.id }
        : c.subject;
  const value = typeof c.value === 'string' && maps.options?.has(c.value) ? maps.options.get(c.value)! : c.value;
  return value === undefined ? { subject, op: c.op } : { subject, op: c.op, value };
}
