import type { AssignedKeys, Op, OpTx } from '@qub/shared/forms';
import { coalesceTx } from '@qub/shared/forms';

export const UNDO_LIMIT = 100;
/** Typing in one box within this window is one undo step. */
export const BURST_MS = 1000;

export interface UndoEntry {
  tx: OpTx;
  /** Every transaction merged into this step (typing bursts). */
  txIds: string[];
  label: string;
  mergeKey: string | null;
  at: number;
  sealed: boolean;
}

/** Rewrites the keys (`ref` / `key`) the server assigned, in create snapshots, delete preconditions (`expect`) and the
 * `from` of a key rename. */
export function withAssignedKeys(tx: OpTx, assigned: AssignedKeys): OpTx {
  return {
    ...tx,
    ops: tx.ops.map((op): Op => {
      if (op.kind === 'create') {
        if (op.entity === 'field' && assigned.fields[op.snapshot.id]) return { ...op, snapshot: { ...op.snapshot, ref: assigned.fields[op.snapshot.id]! } };
        if (op.entity === 'variable' && assigned.variables[op.snapshot.id]) return { ...op, snapshot: { ...op.snapshot, key: assigned.variables[op.snapshot.id]! } };
      }
      if (op.kind === 'delete') {
        if (op.entity === 'field' && assigned.fields[op.id]) return { ...op, expect: { ...op.expect, ref: assigned.fields[op.id]! } };
        if (op.entity === 'variable' && assigned.variables[op.id]) return { ...op, expect: { ...op.expect, key: assigned.variables[op.id]! } };
      }
      if (op.kind === 'set') {
        const path = op.entity === 'field' ? 'ref' : op.entity === 'variable' ? 'key' : null;
        const key = op.entity === 'field' ? assigned.fields[op.id] : op.entity === 'variable' ? assigned.variables[op.id] : undefined;
        const change = path ? op.changes[path] : undefined;
        if (path && key && change) return { ...op, changes: { ...op.changes, [path]: { ...change, from: key } } };
      }
      return op;
    }),
  };
}

export class UndoStack {
  private undos: UndoEntry[] = [];
  private redos: UndoEntry[] = [];

  record(tx: OpTx, opts: { mergeKey?: string | null; now?: number } = {}): void {
    const now = opts.now ?? Date.now();
    const top = this.undos.at(-1);
    if (opts.mergeKey && top && !top.sealed && top.mergeKey === opts.mergeKey && now - top.at <= BURST_MS) {
      const merged = coalesceTx(top.tx, tx);
      if (merged) {
        top.tx = merged;
        top.txIds.push(tx.txId);
        top.at = now;
        this.redos = [];
        return;
      }
    }
    this.pushUndo({ tx, txIds: [tx.txId], label: tx.label, mergeKey: opts.mergeKey ?? null, at: now, sealed: false });
    this.redos = [];
  }

  seal(): void {
    const top = this.undos.at(-1);
    if (top) top.sealed = true;
  }

  takeUndo(): UndoEntry | undefined {
    const e = this.undos.pop();
    if (e) e.sealed = true;
    return e;
  }
  takeRedo(): UndoEntry | undefined {
    return this.redos.pop();
  }
  pushUndo(e: UndoEntry): void {
    this.undos.push(e);
    if (this.undos.length > UNDO_LIMIT) this.undos.shift();
  }
  pushRedo(e: UndoEntry): void {
    this.redos.push(e);
    if (this.redos.length > UNDO_LIMIT) this.redos.shift();
  }
  remove(e: UndoEntry): void {
    this.undos = this.undos.filter((x) => x !== e);
    this.redos = this.redos.filter((x) => x !== e);
  }
  /** Drops steps that contain a transaction the server rejected. */
  forget(txId: string): void {
    this.undos = this.undos.filter((e) => !e.txIds.includes(txId));
    this.redos = this.redos.filter((e) => !e.txIds.includes(txId));
  }
  /** The server renamed keys of items this transaction created; undo must expect the new names. */
  patchAssigned(txId: string, assigned: AssignedKeys): void {
    for (const e of [...this.undos, ...this.redos]) if (e.txIds.includes(txId)) e.tx = withAssignedKeys(e.tx, assigned);
  }

  get canUndo() {
    return this.undos.length > 0;
  }
  get canRedo() {
    return this.redos.length > 0;
  }
  /** Whether the next undo step contains this transaction. */
  isTop(txId: string): boolean {
    return this.undos.at(-1)?.txIds.includes(txId) ?? false;
  }
  get undoLabel(): string | null {
    return this.undos.at(-1)?.label ?? null;
  }
  get redoLabel(): string | null {
    return this.redos.at(-1)?.label ?? null;
  }
}
