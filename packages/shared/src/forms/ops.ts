import { z } from 'zod';
import { uuidSchema } from '../schemas/common';
import type { FormDto, FormFieldDto, FormVariableDto } from '../types';

/**
 * Builder operations. Every builder edit is a transaction of ops; each op carries its preconditions
 * (`from` values, `expect` snapshots, the current predecessor) so it can be checked, inverted for undo,
 * and applied identically on the client (optimistic display) and the server.
 */
export type OpEntity = 'form' | 'field' | 'variable' | 'theme';
export interface OpChange {
  from: unknown;
  to: unknown;
}
export interface SetOp {
  kind: 'set';
  entity: OpEntity;
  id: string;
  changes: Record<string, OpChange>;
}
export type CreateOp =
  | { kind: 'create'; entity: 'field'; snapshot: FormFieldDto; afterId: string | null }
  | { kind: 'create'; entity: 'variable'; snapshot: FormVariableDto; afterId: string | null };
/** `afterId` records the predecessor at delete time so undo can put the item back; it is not a precondition. */
export type DeleteOp =
  | { kind: 'delete'; entity: 'field'; id: string; expect: FormFieldDto; afterId: string | null }
  | { kind: 'delete'; entity: 'variable'; id: string; expect: FormVariableDto; afterId: string | null };
export interface MoveOp {
  kind: 'move';
  id: string;
  fromAfterId: string | null;
  toAfterId: string | null;
}
export type Op = SetOp | CreateOp | DeleteOp | MoveOp;
export interface OpTx {
  txId: string;
  label: string;
  ops: Op[];
}
export interface OpConflict {
  opIndex: number;
  entity: OpEntity;
  id: string;
  path: string | null;
  current: unknown;
}

export const MAX_OPS_PER_TX = 100;

/** Top-level paths per entity. Nested setting bags are addressed one level deep: `settings.<key>`, `validation.<key>`. */
export const OP_PATHS: Record<OpEntity, readonly string[]> = {
  form: ['title', 'description', 'acceptingResponses'],
  field: ['label', 'description', 'required', 'placeholder', 'defaultValue', 'ref', 'type', 'options', 'rules', 'scoreConfig'],
  variable: ['key', 'type', 'initialValue', 'formula'],
  theme: ['primaryColor', 'backgroundColor', 'fontFamily', 'headerImageUrl'],
};
const BAGS: Record<OpEntity, readonly string[]> = { form: ['settings'], field: ['settings', 'validation'], variable: [], theme: ['extras'] };

export function isAllowedPath(entity: OpEntity, path: string): boolean {
  const parts = path.split('.');
  if (parts.length === 1) return OP_PATHS[entity].includes(parts[0]!);
  return parts.length === 2 && BAGS[entity].includes(parts[0]!) && /^[a-zA-Z]+$/.test(parts[1]!);
}

type Obj = Record<string, unknown>;

/** Missing values read as null, so "unset" and null compare equal. */
export function getPath(target: object, path: string): unknown {
  const [head, key] = path.split('.') as [string, string | undefined];
  const top = (target as Obj)[head];
  if (key === undefined) return top ?? null;
  return (top as Obj | null | undefined)?.[key] ?? null;
}

/** Returns a copy with the path set; null/undefined removes a nested key. */
export function setPath<T extends object>(target: T, path: string, value: unknown): T {
  const [head, key] = path.split('.') as [string, string | undefined];
  if (key === undefined) return { ...target, [head]: value };
  const bag: Obj = { ...((target as Obj)[head] as Obj | undefined) };
  if (value === null || value === undefined) delete bag[key];
  else bag[key] = value;
  return { ...target, [head]: bag };
}

/** Structural equality over JSON-like values; object key order and undefined properties are ignored. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined || typeof a !== 'object' || typeof b !== 'object') return (a ?? null) === (b ?? null);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => deepEqual(x, bb[i]));
  }
  const keys = (o: object) => Object.keys(o).filter((k) => (o as Obj)[k] !== undefined);
  const ka = keys(a);
  const kb = keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as Obj)[k], (b as Obj)[k]));
}

export class OpConflictError extends Error {
  constructor(readonly conflicts: OpConflict[]) {
    super('The form changed since this edit was made.');
    this.name = 'OpConflictError';
  }
}

export class OpInvalidError extends Error {
  constructor(
    message: string,
    readonly opIndex: number,
  ) {
    super(message);
    this.name = 'OpInvalidError';
  }
}

export const newTxId = (): string => globalThis.crypto.randomUUID();

const withoutPosition = <T extends { position: number }>(x: T) => {
  const { position: _p, ...rest } = x;
  return rest;
};
const renumber = <T extends { position: number }>(list: T[]): T[] => list.map((x, i) => (x.position === i ? x : { ...x, position: i }));
function insertAfter<T extends { id: string; position: number }>(list: T[], item: T, afterId: string | null): T[] {
  const next = [...list];
  next.splice(afterId === null ? 0 : list.findIndex((x) => x.id === afterId) + 1, 0, item);
  return renumber(next);
}

function locate(form: FormDto, entity: OpEntity, id: string): object | undefined {
  if (entity === 'form') return id === form.id ? form : undefined;
  if (entity === 'theme') return id === form.id ? form.theme : undefined;
  if (entity === 'field') return form.fields.find((f) => f.id === id);
  return form.variables.find((v) => v.id === id);
}

function replace(form: FormDto, entity: OpEntity, id: string, next: object): FormDto {
  if (entity === 'form') return next as FormDto;
  if (entity === 'theme') return { ...form, theme: next as FormDto['theme'] };
  if (entity === 'field') return { ...form, fields: form.fields.map((f) => (f.id === id ? (next as FormFieldDto) : f)) };
  return { ...form, variables: form.variables.map((v) => (v.id === id ? (next as FormVariableDto) : v)) };
}

export function applyOp(form: FormDto, op: Op, opIndex = 0): FormDto {
  const conflict = (entity: OpEntity, id: string, path: string | null, current: unknown): never => {
    throw new OpConflictError([{ opIndex, entity, id, path, current }]);
  };
  switch (op.kind) {
    case 'set': {
      const bad = Object.keys(op.changes).find((p) => !isAllowedPath(op.entity, p));
      if (bad) throw new OpInvalidError(`“${bad}” can’t be changed here.`, opIndex);
      const target = locate(form, op.entity, op.id) ?? conflict(op.entity, op.id, null, null);
      const conflicts = Object.entries(op.changes)
        .filter(([p, c]) => !deepEqual(getPath(target, p), c.from))
        .map(([p]) => ({ opIndex, entity: op.entity, id: op.id, path: p, current: getPath(target, p) }));
      if (conflicts.length) throw new OpConflictError(conflicts);
      let next: object = target;
      for (const [p, c] of Object.entries(op.changes)) next = setPath(next, p, c.to);
      return replace(form, op.entity, op.id, next);
    }
    case 'create': {
      if (op.entity === 'field') {
        const existing = form.fields.find((f) => f.id === op.snapshot.id);
        if (existing) return deepEqual(withoutPosition(existing), withoutPosition(op.snapshot)) ? form : conflict('field', op.snapshot.id, null, existing);
        if (op.afterId !== null && !form.fields.some((f) => f.id === op.afterId)) conflict('field', op.snapshot.id, 'afterId', null);
        return { ...form, fields: insertAfter(form.fields, op.snapshot, op.afterId) };
      }
      const existing = form.variables.find((v) => v.id === op.snapshot.id);
      if (existing) return deepEqual(withoutPosition(existing), withoutPosition(op.snapshot)) ? form : conflict('variable', op.snapshot.id, null, existing);
      if (op.afterId !== null && !form.variables.some((v) => v.id === op.afterId)) conflict('variable', op.snapshot.id, 'afterId', null);
      return { ...form, variables: insertAfter(form.variables, op.snapshot, op.afterId) };
    }
    case 'delete': {
      if (op.entity === 'field') {
        const existing = form.fields.find((f) => f.id === op.id) ?? conflict('field', op.id, null, null);
        if (!deepEqual(withoutPosition(existing), withoutPosition(op.expect))) conflict('field', op.id, null, existing);
        return { ...form, fields: renumber(form.fields.filter((f) => f.id !== op.id)) };
      }
      const existing = form.variables.find((v) => v.id === op.id) ?? conflict('variable', op.id, null, null);
      if (!deepEqual(withoutPosition(existing), withoutPosition(op.expect))) conflict('variable', op.id, null, existing);
      return { ...form, variables: renumber(form.variables.filter((v) => v.id !== op.id)) };
    }
    case 'move': {
      const idx = form.fields.findIndex((f) => f.id === op.id);
      if (idx < 0) conflict('field', op.id, null, null);
      const currentAfter = form.fields[idx - 1]?.id ?? null;
      if (currentAfter !== op.fromAfterId) conflict('field', op.id, 'position', currentAfter);
      const rest = form.fields.filter((f) => f.id !== op.id);
      if (op.toAfterId !== null && !rest.some((f) => f.id === op.toAfterId)) conflict('field', op.id, 'position', currentAfter);
      return { ...form, fields: insertAfter(rest, form.fields[idx]!, op.toAfterId) };
    }
  }
}

export function applyTx(form: FormDto, tx: OpTx): FormDto {
  return tx.ops.reduce((f, op, i) => applyOp(f, op, i), form);
}

export function invertOp(op: Op): Op {
  switch (op.kind) {
    case 'set':
      return { ...op, changes: Object.fromEntries(Object.entries(op.changes).map(([p, c]) => [p, { from: c.to, to: c.from }])) };
    case 'create':
      return op.entity === 'field'
        ? { kind: 'delete', entity: 'field', id: op.snapshot.id, expect: op.snapshot, afterId: op.afterId }
        : { kind: 'delete', entity: 'variable', id: op.snapshot.id, expect: op.snapshot, afterId: op.afterId };
    case 'delete':
      return op.entity === 'field' ? { kind: 'create', entity: 'field', snapshot: op.expect, afterId: op.afterId } : { kind: 'create', entity: 'variable', snapshot: op.expect, afterId: op.afterId };
    case 'move':
      return { ...op, fromAfterId: op.toAfterId, toAfterId: op.fromAfterId };
  }
}

export function invertTx(tx: OpTx, txId: string = newTxId()): OpTx {
  return { txId, label: tx.label, ops: [...tx.ops].reverse().map(invertOp) };
}

/** Merges `b` into `a` when both are a single `set` of the same paths of the same item and `b` continues from `a`. */
export function coalesceTx(a: OpTx, b: OpTx): OpTx | null {
  const x = a.ops[0];
  const y = b.ops[0];
  if (a.ops.length !== 1 || b.ops.length !== 1 || x?.kind !== 'set' || y?.kind !== 'set') return null;
  if (x.entity !== y.entity || x.id !== y.id) return null;
  const paths = Object.keys(x.changes).sort();
  if (paths.join('\u0000') !== Object.keys(y.changes).sort().join('\u0000')) return null;
  if (!paths.every((p) => deepEqual(x.changes[p]!.to, y.changes[p]!.from))) return null;
  return { txId: a.txId, label: a.label, ops: [{ ...x, changes: Object.fromEntries(paths.map((p) => [p, { from: x.changes[p]!.from, to: y.changes[p]!.to }])) }] };
}

// ---------- wire schema ----------

const pathSchema = z.string().max(64).regex(/^[a-zA-Z]+(\.[a-zA-Z]+)?$/, 'Invalid path');
const changeSchema = z.object({ from: z.unknown(), to: z.unknown() });
const snapshotSchema = z.record(z.string(), z.unknown());
const opSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('set'),
    entity: z.enum(['form', 'field', 'variable', 'theme']),
    id: uuidSchema,
    changes: z.record(pathSchema, changeSchema).refine((c) => Object.keys(c).length >= 1 && Object.keys(c).length <= 50, 'A change must touch 1–50 paths'),
  }),
  z.object({ kind: z.literal('create'), entity: z.enum(['field', 'variable']), snapshot: snapshotSchema, afterId: uuidSchema.nullable() }),
  z.object({ kind: z.literal('delete'), entity: z.enum(['field', 'variable']), id: uuidSchema, expect: snapshotSchema, afterId: uuidSchema.nullable() }),
  z.object({ kind: z.literal('move'), id: uuidSchema, fromAfterId: uuidSchema.nullable(), toAfterId: uuidSchema.nullable() }),
]);

/** Request body of `POST /api/forms/:id/ops`. Snapshot and value shapes are validated after applying (see ops-validate). */
export const opTxSchema = z.object({
  txId: uuidSchema,
  label: z.string().max(200).default(''),
  ops: z.array(opSchema).min(1).max(MAX_OPS_PER_TX),
});
export type OpTxInput = z.input<typeof opTxSchema>;
