import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueueStore, memoryStore, queueKey, tabId } from './queue-store';

const fakeStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

/** Minimal, in-memory stand-in for IndexedDB (jsdom has no real one, and no dependency provides it). Values are
 * JSON-cloned on get/put to match IndexedDB's structured-clone semantics. Supports exactly what queue-store.ts uses.
 * `failPut` lets a test simulate a specific write failing (e.g. QuotaExceededError) without touching storage. */
function fakeIDBFactory(opts: { failPut?: (key: string, value: unknown) => boolean } = {}): IDBFactory {
  const rows = new Map<string, unknown>();
  const clone = <T,>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
  function fakeRequest<T>(run: () => T) {
    const req = {} as IDBRequest<T>;
    queueMicrotask(() => {
      try {
        (req as { result: T }).result = run();
        req.onsuccess?.(new Event('success') as never);
      } catch (error) {
        (req as { error: unknown }).error = error;
        req.onerror?.(new Event('error') as never);
      }
    });
    return req;
  }
  const objectStore = () =>
    ({
      get: (key: IDBValidKey) => fakeRequest(() => clone(rows.get(String(key)))),
      put: (value: unknown, key: IDBValidKey) =>
        fakeRequest(() => {
          if (opts.failPut?.(String(key), value)) throw new Error('QuotaExceededError');
          rows.set(String(key), clone(value));
          return key;
        }),
      delete: (key: IDBValidKey) => fakeRequest(() => void rows.delete(String(key))),
      getAllKeys: () => fakeRequest(() => [...rows.keys()]),
    }) as unknown as IDBObjectStore;
  const db = { transaction: () => ({ objectStore }) as unknown as IDBTransaction, createObjectStore: () => objectStore() } as unknown as IDBDatabase;
  return {
    open: () => {
      const req = {} as IDBOpenDBRequest;
      queueMicrotask(() => {
        (req as { result: IDBDatabase }).result = db;
        req.onupgradeneeded?.(new Event('upgradeneeded') as never);
        req.onsuccess?.(new Event('success') as never);
      });
      return req;
    },
  } as unknown as IDBFactory;
}

/** Minimal stand-in for the Web Locks API's LockManager, enough to exercise ifAvailable checks and the
 * hold-until-released pattern createQueueStore uses. `releaseLock` simulates a tab going away (its
 * hold-forever callback promise never actually resolves in real life either — the browser tears it down).
 * `failRequestFor` simulates request() itself rejecting (e.g. SecurityError/AbortError), as opposed to the
 * lock simply being held by someone else. */
function fakeLockManager(opts: { failRequestFor?: (name: string) => boolean } = {}) {
  const held = new Set<string>();
  return {
    async request(name: string, optsOrCb: unknown, cb?: unknown): Promise<unknown> {
      if (opts.failRequestFor?.(name)) throw new Error('SecurityError');
      const hasOpts = typeof optsOrCb !== 'function';
      const lockOpts = (hasOpts ? optsOrCb : {}) as { ifAvailable?: boolean };
      const callback = (hasOpts ? cb : optsOrCb) as (lock: { name: string } | null) => unknown;
      if (lockOpts.ifAvailable && held.has(name)) return callback(null);
      held.add(name);
      const result = callback({ name });
      void Promise.resolve(result).finally(() => held.delete(name));
      return result;
    },
    releaseLock(name: string) {
      held.delete(name);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('queue storage', () => {
  it('keeps separate persisted queues per tab', () => {
    const tabA = fakeStorage();
    const tabB = fakeStorage();
    const a = tabId(tabA);
    expect(tabId(tabA)).toBe(a); // stable across reloads of the same tab
    expect(tabId(tabB)).not.toBe(a);
    expect(queueKey('f', 'u', a)).not.toBe(queueKey('f', 'u', tabId(tabB)));
    expect(queueKey('f', 'u', a)).toBe(`f:u:${a}`);
  });

  it('falls back to memory when IndexedDB is unavailable', async () => {
    const store = await createQueueStore('f', 'u', undefined, 't');
    expect(store.persistent).toBe(false);
    await store.save([{ txId: 'x', label: '', ops: [] }]);
    expect(await store.load()).toHaveLength(1);
  });

  it('memory store copies what it saves', async () => {
    const store = memoryStore();
    const txs = [{ txId: 'x', label: '', ops: [] }];
    await store.save(txs);
    txs.pop();
    expect(await store.load()).toHaveLength(1);
  });

  // Review round 1, I2(a): a duplicated browser tab clones sessionStorage, so it can start with the same tab
  // id as the tab it was duplicated from. The first tab to open a queue for that id must keep it exclusively.
  it('a held tab id is not reused by a duplicated tab', async () => {
    const idb = fakeIDBFactory();
    const locks = fakeLockManager();
    vi.stubGlobal('navigator', { locks });
    const tab = 'dup-tab';
    const store1 = await createQueueStore('f', 'u', idb, tab);
    await store1.save([{ txId: 'a', label: '', ops: [] }]);
    // "Duplicated tab": opens with the very same tab id, since it cloned tab-1's sessionStorage.
    const store2 = await createQueueStore('f', 'u', idb, tab);
    await store2.save([{ txId: 'b', label: '', ops: [] }]);
    // If the id had been reused, store2's save would have overwritten store1's data at the same key.
    expect(await store1.load()).toEqual([{ txId: 'a', label: '', ops: [] }]);
  });

  // Review round 1, I2(b): adopting an orphaned queue (from a tab that closed) must remove it from storage in
  // the same transaction as writing the merged result, so it is neither duplicated nor left behind half-adopted.
  it('adopts an orphaned queue from a closed tab, removing it atomically with the merged write', async () => {
    const idb = fakeIDBFactory();
    const locks = fakeLockManager();
    vi.stubGlobal('navigator', { locks });
    const closedTab = await createQueueStore('f', 'u', idb, 'closed-tab');
    await closedTab.save([{ txId: 'orphan', label: '', ops: [] }]);
    locks.releaseLock(queueKey('f', 'u', 'closed-tab')); // the tab is gone; its held-forever lock is released

    const liveTab = await createQueueStore('f', 'u', idb, 'live-tab');
    await liveTab.save([{ txId: 'own', label: '', ops: [] }]);
    expect((await liveTab.load()).map((t) => t.txId).sort()).toEqual(['orphan', 'own']);

    // Adopted exactly once: it was deleted, not merely copied, so a later tab must not find it again.
    const anotherTab = await createQueueStore('f', 'u', idb, 'another-tab');
    expect(await anotherTab.load()).toEqual([]);
  });

  // Review round 2, small fix: if locks.request() itself rejects (not just "lock held"), claimLock must not
  // hang createQueueStore forever. Falling back to memory store is the choice that can't lose data — see the
  // comment at its call site for why (using IndexedDB without working lock coordination risks clobbering
  // another live tab's queue, which is worse than this tab's own queue not surviving a refresh).
  it('falls back to memory store when locks are unusable, rather than risk clobbering another tab', async () => {
    const idb = fakeIDBFactory();
    const locks = fakeLockManager({ failRequestFor: () => true });
    vi.stubGlobal('navigator', { locks });
    const store = await createQueueStore('f', 'u', idb, 'some-tab');
    expect(store.persistent).toBe(false);
    await store.save([{ txId: 'x', label: '', ops: [] }]);
    expect(await store.load()).toEqual([{ txId: 'x', label: '', ops: [] }]);
  });

  // Review round 2, NEW important: if adopting an orphan fails partway (e.g. the merged put hits
  // QuotaExceededError), it must not corrupt or lose our own data, and the orphan must stay in storage to be
  // retried later rather than being duplicated or dropped.
  it('keeps its own data and leaves the orphan in storage when adopting it fails (e.g. quota exceeded)', async () => {
    const failing = { active: true };
    // Target only the MERGED write (own + orphan, length 2), not either tab's own plain single-entry save.
    const failsToAdopt = (value: unknown) => Array.isArray(value) && value.length > 1 && value.some((t) => (t as { txId: string }).txId === 'orphan');
    const idb = fakeIDBFactory({ failPut: (_key, value) => failing.active && failsToAdopt(value) });
    const locks = fakeLockManager();
    vi.stubGlobal('navigator', { locks });

    const closedTab = await createQueueStore('f', 'u', idb, 'closed-tab');
    await closedTab.save([{ txId: 'orphan', label: '', ops: [] }]);
    locks.releaseLock(queueKey('f', 'u', 'closed-tab'));

    const liveTab = await createQueueStore('f', 'u', idb, 'live-tab');
    await liveTab.save([{ txId: 'own', label: '', ops: [] }]);

    // The merged put (which would include the orphan) fails; load() must not throw and must keep just its own data.
    expect(await liveTab.load()).toEqual([{ txId: 'own', label: '', ops: [] }]);

    // The orphan must still be in storage (not deleted), so a later attempt can still find and adopt it.
    failing.active = false;
    expect((await liveTab.load()).map((t) => t.txId).sort()).toEqual(['orphan', 'own']);
  });
});
