import type { OpTx } from '@qub/shared/forms';
import { describe, expect, it } from 'vitest';
import { UNDO_LIMIT, UndoStack, withAssignedKeys } from './undo-stack';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const typing = (n: number, from: string, to: string): OpTx => ({ txId: uid(n), label: 'Edit question text', ops: [{ kind: 'set', entity: 'field', id: uid(1), changes: { label: { from, to } } }] });

describe('UndoStack', () => {
  it('supports 60 undos then redos, keeping order', () => {
    const s = new UndoStack();
    for (let i = 1; i <= 60; i++) s.record({ ...typing(i, `${i - 1}`, `${i}`), label: `edit ${i}` });
    const undone: string[] = [];
    for (let i = 0; i < 60; i++) {
      const e = s.takeUndo()!;
      undone.push(e.label);
      s.pushRedo(e);
    }
    expect(undone[0]).toBe('edit 60');
    expect(undone.at(-1)).toBe('edit 1');
    expect(s.canUndo).toBe(false);
    const e = s.takeRedo()!;
    expect(e.label).toBe('edit 1');
    s.pushUndo(e);
    expect([s.canUndo, s.canRedo, s.undoLabel, s.redoLabel]).toEqual([true, true, 'edit 1', 'edit 2']);
  });

  it('keeps at most 100 entries', () => {
    const s = new UndoStack();
    for (let i = 1; i <= UNDO_LIMIT + 5; i++) s.record(typing(i, `${i - 1}`, `${i}`));
    let n = 0;
    while (s.takeUndo()) n++;
    expect(n).toBe(UNDO_LIMIT);
  });

  it('merges a typing burst into one step until 1 s passes or it is sealed', () => {
    const s = new UndoStack();
    s.record(typing(1, 'a', 'ab'), { mergeKey: 'label', now: 0 });
    s.record(typing(2, 'ab', 'abc'), { mergeKey: 'label', now: 900 });
    s.record(typing(3, 'abc', 'abcd'), { mergeKey: 'label', now: 2000 });
    s.seal();
    s.record(typing(4, 'abcd', 'abcde'), { mergeKey: 'label', now: 2100 });
    const top = s.takeUndo()!;
    expect(top.txIds).toEqual([uid(4)]);
    const second = s.takeUndo()!;
    expect(second.txIds).toEqual([uid(3)]);
    const first = s.takeUndo()!;
    expect(first.txIds).toEqual([uid(1), uid(2)]);
    expect(first.tx.ops[0]).toMatchObject({ changes: { label: { from: 'a', to: 'abc' } } });
  });

  it('a new action clears redo; forget drops entries of a rejected transaction', () => {
    const s = new UndoStack();
    s.record(typing(1, 'a', 'b'));
    s.pushRedo(s.takeUndo()!);
    s.record(typing(2, 'a', 'c'));
    expect(s.canRedo).toBe(false);
    s.forget(uid(2));
    expect(s.canUndo).toBe(false);
  });

  it('patches keys the server assigned into create snapshots', () => {
    const s = new UndoStack();
    const create: OpTx = { txId: uid(9), label: 'Add', ops: [{ kind: 'create', entity: 'field', snapshot: { id: uid(5), ref: 'q2' } as never, afterId: null }] };
    s.record(create);
    s.patchAssigned(uid(9), { fields: { [uid(5)]: 'q3' }, variables: {} });
    expect((s.takeUndo()!.tx.ops[0] as { snapshot: { ref: string } }).snapshot.ref).toBe('q3');
  });

  it('patches assigned keys into delete preconditions (redo of a delete whose undo re-created it under a new key)', () => {
    const del: OpTx = { txId: uid(10), label: 'Delete', ops: [{ kind: 'delete', entity: 'variable', id: uid(6), expect: { id: uid(6), key: 'score' } as never, afterId: null }] };
    expect((withAssignedKeys(del, { fields: {}, variables: { [uid(6)]: 'score_2' } }).ops[0] as { expect: { key: string } }).expect.key).toBe('score_2');
    expect(withAssignedKeys(del, { fields: {}, variables: {} }).ops[0]).toEqual(del.ops[0]);
  });

  it('patches assigned keys into the `from` of a key rename, so a queued rename still applies', () => {
    const rename: OpTx = { txId: uid(11), label: 'Rename', ops: [{ kind: 'set', entity: 'field', id: uid(5), changes: { ref: { from: 'q2', to: 'email' }, label: { from: 'A', to: 'B' } } }] };
    const out = withAssignedKeys(rename, { fields: { [uid(5)]: 'q3' }, variables: {} }).ops[0] as { changes: Record<string, { from: unknown; to: unknown }> };
    expect(out.changes).toEqual({ ref: { from: 'q3', to: 'email' }, label: { from: 'A', to: 'B' } });
    const variable: OpTx = { txId: uid(12), label: 'Rename', ops: [{ kind: 'set', entity: 'variable', id: uid(6), changes: { key: { from: 'total', to: 'sum' } } }] };
    expect((withAssignedKeys(variable, { fields: {}, variables: { [uid(6)]: 'total_2' } }).ops[0] as { changes: object }).changes).toEqual({ key: { from: 'total_2', to: 'sum' } });
  });
});
