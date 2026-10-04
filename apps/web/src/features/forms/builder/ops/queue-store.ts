import type { OpTx } from '@qub/shared/forms';

/** Where unsent builder transactions are kept so a refresh, crash or closed tab doesn't lose them. */
export interface QueueStore {
  readonly persistent: boolean;
  load(): Promise<OpTx[]>;
  save(txs: readonly OpTx[]): Promise<void>;
}

export function memoryStore(): QueueStore {
  let saved: OpTx[] = [];
  return {
    persistent: false,
    load: async () => [...saved],
    save: async (txs) => {
      saved = [...txs];
    },
  };
}

export const queueKey = (formId: string, userId: string, tab: string) => `${formId}:${userId}:${tab}`;

const TAB_KEY = 'qub-builder-tab';
/** One id per browser tab, kept across reloads of that tab (sessionStorage), so two tabs never share a queue. */
export function tabId(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = sessionStorageOrUndefined()): string {
  try {
    const existing = storage?.getItem(TAB_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    storage?.setItem(TAB_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
function sessionStorageOrUndefined(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

const DB_NAME = 'qub-builder';
const STORE = 'queues';
const request = <T,>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

type LockClaim = 'granted' | 'contested' | 'error';

/**
 * Requests `name` with `{ ifAvailable: true }` and, if granted, holds it until the page/tab goes away (the
 * callback returns a promise that never resolves). Resolves without waiting for that hold to end — the
 * request's own promise is intentionally left unawaited. Distinguishes "someone else already holds it"
 * (`'contested'`, safe to retry with a different name) from the request itself failing, e.g. `SecurityError`
 * in a context where locks aren't usable at all (`'error'`, not safe to retry — see createQueueStore).
 */
function claimLock(locks: LockManager, name: string): Promise<LockClaim> {
  return new Promise<LockClaim>((resolveClaim) => {
    void locks
      .request(name, { ifAvailable: true }, (lock) => {
        if (lock === null) {
          resolveClaim('contested');
          return undefined;
        }
        resolveClaim('granted');
        return new Promise<void>(() => {});
      })
      .catch(() => resolveClaim('error'));
  });
}

/**
 * IndexedDB-backed queue for this form, user and tab. While the tab is open it holds a Web Lock on its key; on load it
 * adopts queues of the same form and user whose tab is gone (lock free), so work from a closed tab is not stranded.
 *
 * The `tab` id (from sessionStorage) is duplicated verbatim when a tab is cloned, so two live tabs can compute the
 * same id. Before committing to it, this checks whether another live tab already holds its lock; if so it mints and
 * persists a fresh id instead, so the two tabs never share (and clobber) one queue.
 */
export async function createQueueStore(formId: string, userId: string, idb: IDBFactory | undefined = globalThis.indexedDB, tab: string = tabId()): Promise<QueueStore> {
  if (!idb) return memoryStore();
  let db: IDBDatabase;
  try {
    db = await open(idb);
  } catch {
    return memoryStore();
  }
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  let ownTab = tab;
  let key = queueKey(formId, userId, ownTab);
  if (locks) {
    const claim = await claimLock(locks, key);
    // The request itself failed (e.g. SecurityError/AbortError) rather than the lock being held elsewhere:
    // locks aren't usable in this context at all, so we cannot safely tell whether another tab already has
    // this id. Falling back to memory store is the choice that can't lose data — using IndexedDB without that
    // coordination risks silently clobbering another live tab's queue (or being clobbered by one), which is
    // strictly worse than this tab's own queue not surviving a refresh (the same trade-off already accepted
    // when IndexedDB itself is unavailable).
    if (claim === 'error') return memoryStore();
    if (claim === 'contested') {
      // Another live tab already holds this id (a duplicated tab sharing sessionStorage) — mint a fresh one
      // and persist it so this tab uses its own queue from now on. A freshly minted random id is always free.
      ownTab = crypto.randomUUID();
      try {
        sessionStorageOrUndefined()?.setItem(TAB_KEY, ownTab);
      } catch {
        /* ignore */
      }
      key = queueKey(formId, userId, ownTab);
      if ((await claimLock(locks, key)) === 'error') return memoryStore();
    }
  }
  const store = () => db.transaction(STORE, 'readwrite').objectStore(STORE);
  return {
    persistent: true,
    async load() {
      let all = ((await request(store().get(key))) as OpTx[] | undefined) ?? [];
      if (locks) {
        const keys = ((await request(store().getAllKeys())) as IDBValidKey[]).map(String);
        for (const other of keys.filter((k) => k !== key && k.startsWith(`${formId}:${userId}:`))) {
          // Adopting an orphan must be atomic with removing it: get its data, write the merged result under our
          // key and delete the orphan's key all inside ONE readwrite transaction held for as long as its lock
          // is free — otherwise another tab could observe or re-adopt a half-migrated orphan.
          //
          // If any of that fails (e.g. the merged put hits QuotaExceededError), it must not take the whole
          // load() down with it: catch it per orphan, leave that orphan in storage for a later attempt, and
          // keep our own (and any already-adopted) data exactly as it was — never adopt into `all` until the
          // write that makes it durable has actually succeeded.
          await locks.request(other, { ifAvailable: true }, async (lock) => {
            if (!lock) return;
            try {
              const tx = db.transaction(STORE, 'readwrite');
              const os = tx.objectStore(STORE);
              const orphaned = ((await request(os.get(other))) as OpTx[] | undefined) ?? [];
              if (orphaned.length) {
                const merged = [...all, ...orphaned];
                await request(os.put(merged, key));
                await request(os.delete(other));
                all = merged;
              } else {
                await request(os.delete(other));
              }
            } catch {
              /* leave this orphan for a later load() to retry; `all` is untouched. */
            }
          });
        }
      }
      return all;
    },
    async save(txs) {
      if (txs.length) await request(store().put([...txs], key));
      else await request(store().delete(key));
    },
  };
}
