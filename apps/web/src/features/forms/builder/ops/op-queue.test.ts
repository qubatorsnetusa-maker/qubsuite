import type { ApplyOpsResult, FormDto } from '@qub/shared';
import type { OpTx } from '@qub/shared/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { MAX_SERVER_ERRORS, OpQueue, RETRY_DELAYS_MS } from './op-queue';
import { memoryStore, type QueueStore } from './queue-store';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const edit = (n: number, from = `v${n - 1}`, to = `v${n}`): OpTx => ({ txId: uid(n), label: 'Edit', ops: [{ kind: 'set', entity: 'field', id: uid(999), changes: { label: { from, to } } }] });
const ok = (revision = 1): ApplyOpsResult => ({ revision, form: { revision } as FormDto, assigned: { fields: {}, variables: {} } });
type Outcome = ApplyOpsResult | ApiError | Error | Promise<ApplyOpsResult>;

function setup(outcomes: Outcome[] = [], opts: { store?: QueueStore; online?: () => boolean; manualRestore?: boolean } = {}) {
  const sent: OpTx[] = [];
  const onConfirmed = vi.fn();
  const onRejected = vi.fn();
  const onForbidden = vi.fn();
  const queue = new OpQueue({
    store: opts.store ?? memoryStore(),
    isOnline: opts.online,
    onConfirmed,
    onRejected,
    onForbidden,
    send: async (tx) => {
      sent.push(tx);
      const next = outcomes.shift() ?? ok();
      if (next instanceof Error) throw next;
      return next;
    },
  });
  if (!opts.manualRestore) void queue.restore();
  return { queue, sent, onConfirmed, onRejected, onForbidden };
}
const settle = () => vi.advanceTimersByTimeAsync(0);
const deferred = () => {
  let resolve!: (r: ApplyOpsResult) => void;
  const promise = new Promise<ApplyOpsResult>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('OpQueue', () => {
  it('sends transactions one at a time, in order', async () => {
    const first = deferred();
    const { queue, sent, onConfirmed } = setup([first.promise, ok(2)]);
    queue.enqueue(edit(1));
    queue.enqueue({ ...edit(2), ops: [{ kind: 'set', entity: 'field', id: uid(999), changes: { required: { from: false, to: true } } }] });
    await settle();
    expect(sent.map((t) => t.txId)).toEqual([uid(1)]);
    expect(queue.status).toBe('saving');
    first.resolve(ok(1));
    await settle();
    expect(sent.map((t) => t.txId)).toEqual([uid(1), uid(2)]);
    expect(onConfirmed).toHaveBeenCalledTimes(2);
    expect(queue.status).toBe('saved');
  });

  it('merges unsent edits of the same setting but never the one in flight', async () => {
    const first = deferred();
    const { queue, sent } = setup([first.promise]);
    queue.enqueue(edit(1));
    await settle();
    queue.enqueue(edit(2));
    queue.enqueue(edit(3));
    expect(queue.pending.map((t) => t.txId)).toEqual([uid(1), uid(2)]);
    expect(queue.pending[1]!.ops[0]).toMatchObject({ changes: { label: { from: 'v1', to: 'v3' } } });
    first.resolve(ok());
    await settle();
    expect(sent).toHaveLength(2);
  });

  it('goes offline on a network error and retries with backoff, or at once when back online', async () => {
    const { queue, sent } = setup([new ApiError(0, 'NETWORK_ERROR', 'down'), new ApiError(0, 'NETWORK_ERROR', 'down'), ok()]);
    queue.enqueue(edit(1));
    await settle();
    expect(queue.status).toBe('offline');
    await vi.advanceTimersByTimeAsync(999);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(2);
    queue.online();
    await settle();
    expect(sent).toHaveLength(3);
    expect(queue.status).toBe('saved');
  });

  it('waits while the browser reports offline', async () => {
    let online = false;
    const { queue, sent } = setup([], { online: () => online });
    queue.enqueue(edit(1));
    await settle();
    expect([sent.length, queue.status]).toEqual([0, 'offline']);
    online = true;
    queue.online();
    await settle();
    expect([sent.length, queue.status]).toEqual([1, 'saved']);
  });

  it('drops a rejected transaction, reports it and carries on', async () => {
    const conflict = new ApiError(409, 'CONFLICT', 'changed', { conflicts: [] });
    const { queue, sent, onRejected } = setup([conflict, ok()]);
    queue.enqueue(edit(1));
    queue.enqueue({ ...edit(2), ops: [{ kind: 'set', entity: 'field', id: uid(998), changes: { label: { from: 'a', to: 'b' } } }] });
    await settle();
    expect(onRejected).toHaveBeenCalledWith(expect.objectContaining({ txId: uid(1) }), conflict);
    expect(sent.map((t) => t.txId)).toEqual([uid(1), uid(2)]);
    expect(queue.status).toBe('saved');
  });

  it('shows Save failed after a rejection until the next success', async () => {
    const { queue } = setup([new ApiError(422, 'VALIDATION_ERROR', 'bad')]);
    queue.enqueue(edit(1));
    await settle();
    expect(queue.status).toBe('failed');
    queue.enqueue(edit(5, 'x', 'y'));
    await settle();
    expect(queue.status).toBe('saved');
  });

  it(`stalls after ${MAX_SERVER_ERRORS} server errors until retry()`, async () => {
    const boom = () => new ApiError(500, 'INTERNAL_ERROR', 'boom');
    const { queue, sent } = setup([boom(), boom(), boom(), boom(), boom(), ok()]);
    queue.enqueue(edit(1));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent).toHaveLength(5);
    expect(queue.status).toBe('failed');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent).toHaveLength(5);
    queue.retry();
    await settle();
    expect([sent.length, queue.status]).toEqual([6, 'saved']);
  });

  it('stops for good when edit access is lost', async () => {
    const forbidden = new ApiError(403, 'FORBIDDEN', 'no');
    const { queue, sent, onForbidden } = setup([forbidden]);
    queue.enqueue(edit(1));
    await settle();
    expect(onForbidden).toHaveBeenCalledWith(forbidden);
    queue.enqueue(edit(9, 'a', 'b'));
    await settle();
    expect([sent.length, queue.status]).toEqual([1, 'failed']);
  });

  it('restores persisted work before new edits', async () => {
    const store = memoryStore();
    await store.save([edit(1)]);
    const { queue, sent } = setup([], { store, manualRestore: true });
    queue.enqueue(edit(7, 'p', 'q'));
    expect(await queue.restore()).toBe(1);
    await settle();
    expect(sent.map((t) => t.txId)).toEqual([uid(1), uid(7)]);
    expect(await store.load()).toEqual([]);
  });

  it('drops a restored transaction the server rejects and continues', async () => {
    const store = memoryStore();
    await store.save([edit(1), edit(2, 'x', 'y')]);
    const { queue, sent, onRejected } = setup([new ApiError(409, 'CONFLICT', 'stale'), ok()], { store });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(2);
    expect(await store.load()).toEqual([]);
  });

  it('cancels an unsent transaction but not the one in flight', async () => {
    const first = deferred();
    const { queue } = setup([first.promise]);
    queue.enqueue(edit(1));
    await settle();
    queue.enqueue(edit(5, 'a', 'b'));
    expect(queue.cancel(uid(1))).toBe(false);
    expect(queue.cancel(uid(5))).toBe(true);
    expect(queue.pending.map((t) => t.txId)).toEqual([uid(1)]);
  });

  it('resolves whenIdle once everything is saved', async () => {
    const { queue } = setup();
    queue.enqueue(edit(1));
    const idle = vi.fn();
    void queue.whenIdle().then(idle);
    await settle();
    expect(idle).toHaveBeenCalled();
  });

  // Review round 1, C1: a transaction that failed transiently (network error) may already have been applied
  // by the server, so a later edit of the same setting must never be merged into it — that would silently
  // drop the merged-in value if the server's txId-keyed replay returns the original (pre-merge) result.
  it('does not merge a later edit into a transaction that has already been attempted once', async () => {
    const { queue, sent } = setup([new ApiError(0, 'NETWORK_ERROR', 'down'), ok(), ok()]);
    queue.enqueue(edit(1)); // v0 -> v1, fails once (network error)
    await settle();
    expect(queue.status).toBe('offline');
    queue.enqueue(edit(2)); // same field/setting; must become a separate tx, not merged into tx 1
    expect(queue.pending.map((t) => t.txId)).toEqual([uid(1), uid(2)]);
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]!);
    await settle();
    expect(sent.map((t) => t.txId)).toEqual([uid(1), uid(1), uid(2)]); // first attempt, retry, then the new tx
    expect(sent[1]!.ops[0]).toMatchObject({ changes: { label: { from: 'v0', to: 'v1' } } }); // retry unchanged
    expect(sent[2]!.ops[0]).toMatchObject({ changes: { label: { from: 'v1', to: 'v2' } } }); // carries the new value
    expect(queue.status).toBe('saved');
  });

  it('cannot cancel a transaction that has already been attempted, even while it is waiting to retry', async () => {
    const { queue } = setup([new ApiError(0, 'NETWORK_ERROR', 'down')]);
    queue.enqueue(edit(1));
    await settle();
    expect(queue.status).toBe('offline'); // failed once; no longer in flight, but was attempted
    expect(queue.cancel(uid(1))).toBe(false);
  });

  // Review round 1, I1: dispose() must stop the queue outright, even if a send it already started is still
  // in flight — once disposed, that send resolving must trigger no callback, no persist and no further send.
  it('dispose() stops the queue: an in-flight send resolving afterwards has no effect', async () => {
    const first = deferred();
    const save = vi.fn(async () => undefined);
    const store: QueueStore = { persistent: false, load: async () => [], save };
    const { queue, sent, onConfirmed } = setup([first.promise, ok()], { store });
    queue.enqueue(edit(1));
    queue.enqueue({ ...edit(2), ops: [{ kind: 'set', entity: 'field', id: uid(998), changes: { label: { from: 'a', to: 'b' } } }] });
    await settle();
    expect(sent).toHaveLength(1); // tx 1 in flight, tx 2 still queued
    const savesBefore = save.mock.calls.length;
    queue.dispose();
    first.resolve(ok(1));
    await settle();
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1); // tx 2 was never sent
    expect(save.mock.calls.length).toBe(savesBefore); // no further persist
  });

  // Review round 1, I3: a store whose load() rejects must not stall the queue forever.
  it('still becomes ready and sends when the store fails to load', async () => {
    const store: QueueStore = {
      persistent: false,
      load: async () => {
        throw new Error('boom');
      },
      save: async () => undefined,
    };
    const { queue, sent } = setup([], { store });
    queue.enqueue(edit(1));
    await settle();
    expect(sent).toHaveLength(1);
    expect(queue.status).toBe('saved');
  });

  // Review round 2, C1 (still open): restore() itself must mark every restored txId as attempted, not just
  // whichever one kick() eventually sends — otherwise a restored (or adopted) tx that hasn't been sent yet, or
  // sits at a non-zero index, is still an unprotected merge/cancel target.
  it('does not merge a same-setting edit into a restored transaction, even before it could possibly be sent', async () => {
    const store = memoryStore();
    await store.save([edit(1)]);
    const { queue, sent } = setup([], { store, manualRestore: true, online: () => false });
    await queue.restore();
    expect(queue.status).toBe('offline');
    expect(sent).toHaveLength(0); // never actually attempted a send this session
    queue.enqueue(edit(2)); // same field/setting as the restored tx
    expect(queue.pending.map((t) => t.txId)).toEqual([uid(1), uid(2)]); // kept separate, not merged
  });

  it('cannot cancel a restored transaction, even before it could possibly be sent', async () => {
    const store = memoryStore();
    await store.save([edit(1)]);
    const { queue } = setup([], { store, manualRestore: true, online: () => false });
    await queue.restore();
    expect(queue.cancel(uid(1))).toBe(false);
  });

  it('does not merge into a restored transaction at a non-zero (adopted-orphan-like) index either', async () => {
    const store = memoryStore();
    await store.save([edit(1), edit(2, 'x', 'y')]); // two distinct restored txs, same target, not merged with each other
    const { queue } = setup([], { store, manualRestore: true, online: () => false });
    await queue.restore();
    expect(queue.pending.map((t) => t.txId)).toEqual([uid(1), uid(2)]);
    queue.enqueue(edit(3, 'y', 'z')); // same setting as tx 2, the LAST entry but at index 1, not 0
    expect(queue.pending.map((t) => t.txId)).toEqual([uid(1), uid(2), uid(3)]); // not merged into tx 2
  });

  // Review round 2, NEW important: the I3 fix (treat a failed load() as []) combined with persisting right
  // after must not overwrite storage with that empty guess — that would destroy whatever was actually there.
  it('does not overwrite storage after a failed load, until a new edit actually needs to be persisted', async () => {
    const save = vi.fn(async () => undefined);
    const store: QueueStore = {
      persistent: false,
      load: async () => {
        throw new Error('boom');
      },
      save,
    };
    const { queue, sent } = setup([], { store, manualRestore: true });
    await queue.restore();
    expect(save).not.toHaveBeenCalled();
    queue.enqueue(edit(1));
    await settle();
    expect(save).toHaveBeenCalled();
    expect(sent).toHaveLength(1);
  });

  // Review round 2, small fix: dispose() must not leave a whenIdle() caller hanging forever.
  it('dispose() resolves any pending whenIdle() promise', async () => {
    const first = deferred();
    const { queue } = setup([first.promise]);
    queue.enqueue(edit(1));
    await settle();
    const idle = vi.fn();
    void queue.whenIdle().then(idle);
    queue.dispose();
    await settle();
    expect(idle).toHaveBeenCalled();
  });

  it('rewrites transactions that were never sent, leaving the one in flight (or any attempted one) alone', async () => {
    const first = deferred();
    const store = memoryStore();
    const { queue, sent } = setup([first.promise], { store });
    queue.enqueue(edit(1));
    queue.enqueue({ ...edit(2), ops: [{ kind: 'set', entity: 'field', id: uid(999), changes: { required: { from: false, to: true } } }] });
    await settle();
    queue.rewriteUnsent((tx) => ({ ...tx, label: 'Rewritten' }));
    expect(queue.pending.map((t) => t.label)).toEqual(['Edit', 'Rewritten']);
    await settle();
    expect((await store.load()).map((t) => t.label)).toEqual(['Edit', 'Rewritten']);
    first.resolve(ok(1));
    await settle();
    expect(sent.map((t) => t.label)).toEqual(['Edit', 'Rewritten']);
  });

  it('never rewrites restored transactions (they may already have reached the server)', async () => {
    const store = memoryStore();
    await store.save([edit(1)]);
    const { queue } = setup([new Promise(() => {})], { store });
    await settle();
    queue.enqueue({ ...edit(2), ops: [{ kind: 'set', entity: 'field', id: uid(999), changes: { required: { from: false, to: true } } }] });
    queue.rewriteUnsent((tx) => ({ ...tx, label: 'Rewritten' }));
    expect(queue.pending.map((t) => t.label)).toEqual(['Edit', 'Rewritten']);
  });
});
