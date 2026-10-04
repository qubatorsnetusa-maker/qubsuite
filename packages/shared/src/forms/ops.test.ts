import { describe, expect, it } from 'vitest';
import { makeField, makeForm, makeVariable, uid } from './__fixtures__/form-dto';
import {
  applyOp,
  applyTx,
  coalesceTx,
  deepEqual,
  getPath,
  invertTx,
  isAllowedPath,
  OpConflictError,
  OpInvalidError,
  opTxSchema,
  setPath,
  type Op,
  type OpTx,
} from './ops';

const A = uid(1), B = uid(2), C = uid(3), V = uid(10);
const base = () =>
  makeForm([makeField(A, 'SHORT_ANSWER', 0, { label: 'Name' }), makeField(B, 'RATING', 1, { settings: { scaleMax: 5 } }), makeField(C, 'ENDING', 2, { label: 'Bye' })], {
    variables: [makeVariable(V, 'total', 0)],
  });
const tx = (...ops: Op[]): OpTx => ({ txId: uid(500), label: 'test', ops });

describe('paths', () => {
  it('reads and writes top-level and nested paths', () => {
    const f = makeField(A, 'RATING', 0, { settings: { scaleMax: 5 } });
    expect(getPath(f, 'label')).toBe('Question 1');
    expect(getPath(f, 'settings.scaleMax')).toBe(5);
    expect(getPath(f, 'settings.minLabel')).toBeNull();
    expect(setPath(f, 'settings.scaleMax', 3).settings).toEqual({ scaleMax: 3 });
    expect(setPath(f, 'settings.scaleMax', null).settings).toEqual({});
    expect(f.settings).toEqual({ scaleMax: 5 });
  });

  it('allows only known paths', () => {
    expect(isAllowedPath('field', 'label')).toBe(true);
    expect(isAllowedPath('field', 'settings.scaleMax')).toBe(true);
    expect(isAllowedPath('field', 'validation.maxLength')).toBe(true);
    expect(isAllowedPath('field', 'position')).toBe(false);
    expect(isAllowedPath('field', 'settings.a.b')).toBe(false);
    expect(isAllowedPath('form', 'settings.quiz')).toBe(true);
    expect(isAllowedPath('form', 'validation.x')).toBe(false);
    expect(isAllowedPath('variable', 'formula')).toBe(true);
    expect(isAllowedPath('theme', 'primaryColor')).toBe(true);
  });

  it('allows extras paths on a theme op and rejects deeper ones', () => {
    expect(isAllowedPath('theme', 'primaryColor')).toBe(true);
    expect(isAllowedPath('theme', 'extras.fontPair')).toBe(true);
    expect(isAllowedPath('theme', 'extras.background')).toBe(true);
    expect(isAllowedPath('theme', 'extras.background.angle')).toBe(false);
    expect(isAllowedPath('theme', 'extras')).toBe(false);
  });

  it('compares structurally, ignoring key order and undefined', () => {
    expect(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual(null, undefined)).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: 1 }, { a: '1' })).toBe(false);
  });
});

describe('applyOp', () => {
  it('applies a set when every `from` matches', () => {
    const next = applyOp(base(), { kind: 'set', entity: 'field', id: A, changes: { label: { from: 'Name', to: 'Full name' }, required: { from: false, to: true } } });
    expect(next.fields[0]).toMatchObject({ label: 'Full name', required: true });
  });

  it('reports every mismatching path as a conflict', () => {
    try {
      applyOp(base(), { kind: 'set', entity: 'field', id: A, changes: { label: { from: 'Old', to: 'New' }, required: { from: false, to: true } } }, 4);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(OpConflictError);
      expect((e as OpConflictError).conflicts).toEqual([{ opIndex: 4, entity: 'field', id: A, path: 'label', current: 'Name' }]);
    }
  });

  it('treats a missing item as a conflict and an unknown path as invalid', () => {
    expect(() => applyOp(base(), { kind: 'set', entity: 'field', id: uid(99), changes: { label: { from: 'x', to: 'y' } } })).toThrow(OpConflictError);
    expect(() => applyOp(base(), { kind: 'set', entity: 'field', id: A, changes: { position: { from: 0, to: 1 } } })).toThrow(OpInvalidError);
  });

  it('sets form, theme and variable paths', () => {
    const f = base();
    const next = applyTx(f, tx(
      { kind: 'set', entity: 'form', id: f.id, changes: { title: { from: 'Test form', to: 'Survey' }, 'settings.layout': { from: 'classic', to: 'conversational' } } },
      { kind: 'set', entity: 'theme', id: f.id, changes: { primaryColor: { from: '#673ab7', to: '#1a73e8' } } },
      { kind: 'set', entity: 'variable', id: V, changes: { formula: { from: null, to: '1 + 1' } } },
    ));
    expect(next.title).toBe('Survey');
    expect(next.settings.layout).toBe('conversational');
    expect(next.theme.primaryColor).toBe('#1a73e8');
    expect(next.variables[0]!.formula).toBe('1 + 1');
  });

  it('creates after a sibling and renumbers positions; re-creating an identical item is a no-op', () => {
    const D = uid(4);
    const snapshot = makeField(D, 'NUMBER', 0, { ref: 'q9' });
    const op: Op = { kind: 'create', entity: 'field', snapshot, afterId: A };
    const next = applyOp(base(), op);
    expect(next.fields.map((f) => [f.id, f.position])).toEqual([[A, 0], [D, 1], [B, 2], [C, 3]]);
    expect(applyOp(next, op)).toEqual(next);
    expect(() => applyOp(next, { ...op, snapshot: { ...snapshot, label: 'Different' } })).toThrow(OpConflictError);
    expect(() => applyOp(base(), { ...op, afterId: uid(98) })).toThrow(OpConflictError);
  });

  it('deletes only when the item still equals `expect`', () => {
    const f = base();
    const del: Op = { kind: 'delete', entity: 'field', id: B, expect: f.fields[1]!, afterId: A };
    expect(applyOp(f, del).fields.map((x) => x.id)).toEqual([A, C]);
    const changed = applyOp(f, { kind: 'set', entity: 'field', id: B, changes: { label: { from: 'Question 2', to: 'Stars' } } });
    expect(() => applyOp(changed, del)).toThrow(OpConflictError);
  });

  it('moves a field when its predecessor matches', () => {
    const f = base();
    const next = applyOp(f, { kind: 'move', id: A, fromAfterId: null, toAfterId: B });
    expect(next.fields.map((x) => [x.id, x.position])).toEqual([[B, 0], [A, 1], [C, 2]]);
    expect(() => applyOp(f, { kind: 'move', id: A, fromAfterId: B, toAfterId: C })).toThrow(OpConflictError);
  });
});

describe('invert and coalesce', () => {
  it('undoes a mixed transaction exactly', () => {
    const f = base();
    const D = uid(4);
    const t = tx(
      { kind: 'set', entity: 'field', id: B, changes: { 'settings.scaleMax': { from: 5, to: 7 } } },
      { kind: 'create', entity: 'field', snapshot: makeField(D, 'EMAIL', 0, { ref: 'email' }), afterId: B },
      { kind: 'move', id: A, fromAfterId: null, toAfterId: D },
      { kind: 'delete', entity: 'variable', id: V, expect: f.variables[0]!, afterId: null },
    );
    const done = applyTx(f, t);
    const undone = applyTx(done, invertTx(t));
    expect(undone).toEqual(f);
  });

  it('round-trips 200 random transactions', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    let next = 100;
    for (let i = 0; i < 200; i++) {
      const f = base();
      const ids = f.fields.map((x) => x.id);
      const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!;
      const ops: Op[] = [];
      const kind = Math.floor(rnd() * 4);
      if (kind === 0) ops.push({ kind: 'set', entity: 'field', id: A, changes: { label: { from: 'Name', to: `L${i}` } } });
      if (kind === 1) ops.push({ kind: 'create', entity: 'field', snapshot: makeField(uid(next++), 'NUMBER', 0, { ref: `n${i}` }), afterId: pick([null, ...ids]) });
      if (kind === 2) {
        const id = pick(ids);
        const idx = ids.indexOf(id);
        const to = pick([null, ...ids.filter((x) => x !== id)]);
        ops.push({ kind: 'move', id, fromAfterId: idx === 0 ? null : ids[idx - 1]!, toAfterId: to });
      }
      if (kind === 3) {
        const id = pick(ids);
        const idx = ids.indexOf(id);
        ops.push({ kind: 'delete', entity: 'field', id, expect: f.fields[idx]!, afterId: idx === 0 ? null : ids[idx - 1]! });
      }
      const t = tx(...ops);
      expect(applyTx(applyTx(f, t), invertTx(t))).toEqual(f);
    }
  });

  it('merges consecutive sets of the same paths', () => {
    const a = tx({ kind: 'set', entity: 'field', id: A, changes: { label: { from: 'Name', to: 'Nam' } } });
    const b: OpTx = { txId: uid(501), label: 'test', ops: [{ kind: 'set', entity: 'field', id: A, changes: { label: { from: 'Nam', to: 'Names' } } }] };
    expect(coalesceTx(a, b)).toEqual({ txId: a.txId, label: 'test', ops: [{ kind: 'set', entity: 'field', id: A, changes: { label: { from: 'Name', to: 'Names' } } }] });
    const other: OpTx = { ...b, ops: [{ kind: 'set', entity: 'field', id: A, changes: { required: { from: false, to: true } } }] };
    expect(coalesceTx(a, other)).toBeNull();
    const gap: OpTx = { ...b, ops: [{ kind: 'set', entity: 'field', id: A, changes: { label: { from: 'X', to: 'Y' } } }] };
    expect(coalesceTx(a, gap)).toBeNull();
  });
});

describe('opTxSchema', () => {
  it('accepts a valid transaction and rejects oversized or malformed ones', () => {
    const ok = { txId: uid(1), label: 'x', ops: [{ kind: 'set', entity: 'field', id: A, changes: { label: { from: 'a', to: 'b' } } }] };
    expect(opTxSchema.safeParse(ok).success).toBe(true);
    expect(opTxSchema.safeParse({ ...ok, ops: [] }).success).toBe(false);
    expect(opTxSchema.safeParse({ ...ok, ops: Array(101).fill(ok.ops[0]) }).success).toBe(false);
    expect(opTxSchema.safeParse({ ...ok, ops: [{ ...ok.ops[0], changes: { 'a b': { from: 1, to: 2 } } }] }).success).toBe(false);
    expect(opTxSchema.safeParse({ ...ok, ops: [{ kind: 'move', id: A, fromAfterId: null, toAfterId: B }] }).success).toBe(true);
  });
});
