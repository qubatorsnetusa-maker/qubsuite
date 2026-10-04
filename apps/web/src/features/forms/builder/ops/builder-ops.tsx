import type { ApplyOpsResult, FormDto } from '@qub/shared';
import { applyTx, invertTx, newTxId, type AssignedKeys, type OpTx } from '@qub/shared/forms';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { authStore } from '@/lib/auth-store';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';
import { OpQueue, type SaveState } from './op-queue';
import { createQueueStore, memoryStore, type QueueStore } from './queue-store';
import { UndoStack, withAssignedKeys, type UndoEntry } from './undo-stack';

export interface BuilderOps {
  form: FormDto;
  apply(tx: OpTx | null, opts?: { mergeKey?: string }): void;
  /** Ends the current typing burst (call on blur). */
  seal(): void;
  undo(): void;
  /** Undoes the step containing `txId` only if it is the next undo step (e.g. a toast's Undo); returns whether it did. */
  undoIf(txId: string): boolean;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  status: SaveState;
  retry(): void;
  /** Resolves once every queued change is saved (used before publishing). Rejects if saving has stopped or the builder closed first. */
  flush(): Promise<void>;
  readOnly: boolean;
  /** Whether this tab sent the transaction `txId` (its own echo on the form room needs no refetch). */
  isOwnTx(txId: string): boolean;
}

export const BuilderOpsContext = createContext<BuilderOps | null>(null);

export function useBuilderOps(): BuilderOps {
  const ctx = useContext(BuilderOpsContext);
  if (!ctx) throw new Error('useBuilderOps used outside BuilderOpsProvider');
  return ctx;
}

const stores = new Map<string, Promise<QueueStore>>();
/**
 * One queue store per form and user for the life of the tab. The IndexedDB store holds its Web Lock until the tab
 * closes, so a remount (leaving and reopening the builder, StrictMode's double effect) must reuse it: a fresh store
 * would find its own lock taken, switch to a new key and leave the unsent edits under the old key out of reach.
 */
export function tabQueueStore(formId: string, userId: string): Promise<QueueStore> {
  const key = `${formId}:${userId}`;
  let store = stores.get(key);
  if (!store) {
    store = createQueueStore(formId, userId).catch(() => memoryStore());
    stores.set(key, store);
  }
  return store;
}

/** The confirmed form with pending transactions laid on top; a transaction that no longer applies locally is skipped (the server will judge it). */
function fold(confirmed: FormDto, pending: readonly OpTx[]): FormDto {
  return pending.reduce((f, tx) => {
    try {
      return applyTx(f, tx);
    } catch {
      return f;
    }
  }, confirmed);
}

/** The more recent of two server states of the form; on a tie, `b`. Revisions only grow, so this never goes back in time. */
function newer(a: FormDto | null | undefined, b: FormDto | null | undefined): FormDto | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return b.revision >= a.revision ? b : a;
}

const unsaved = () => new Error('Your changes aren’t saved yet.');

/**
 * Undoes an entry by withdrawing its transactions from the queue, if none of them can have reached the server.
 * Cancels earliest-first and stops at the first refusal (sent, in flight or restored from storage), so nothing
 * is half-cancelled: only the head of the queue is ever sent, and restored work sits in front of this session's
 * edits, so once the earliest one is withdrawn the later ones never were attempted.
 */
function cancelEntry(queue: OpQueue, e: UndoEntry): boolean {
  const order = queue.pending.map((t) => t.txId);
  if (!e.txIds.length || e.txIds.some((id) => !order.includes(id))) return false;
  const ids = [...e.txIds].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (!queue.cancel(ids[0]!)) return false;
  for (const id of ids.slice(1)) queue.cancel(id);
  return true;
}

type Role = { kind: 'undo' | 'redo'; entry: UndoEntry };
type StoreFactory = (formId: string, userId: string) => Promise<QueueStore>;

/** What a mounted builder lends its session: its display state. Absent while the builder is closed. */
interface Attachment {
  /** The newest server state the builder has shown. */
  newest: { current: FormDto | null };
  bump(): void;
  setReadOnly(readOnly: boolean): void;
}

/**
 * One builder session per form and user in this tab: the send queue, the undo history and the transactions sent. It
 * outlives the builder page, so edits still queued when the user leaves for Preview or Responses keep being sent, and
 * reopening the builder picks the same session up again (never a second queue on the same stored key). Once nobody
 * holds it and its queue has drained, the session is retired.
 */
interface Session {
  formId: string;
  userId: string;
  /** The signed-in user changed: nothing more is sent, cached or shown (the stored queue stays for their next sign-in). */
  ended: boolean;
  queue: OpQueue;
  stack: UndoStack;
  /** Undo/redo transactions still in the queue, so a rejection can be explained and a confirmation patched back. */
  roles: Map<string, Role>;
  /** Every transaction this tab has sent, so the form room can tell our own echoes from another tab's edits. */
  sent: Set<string>;
  qc: QueryClient;
  ui: Attachment | null;
}
interface Entry {
  key: string;
  userId: string;
  registry: Map<string, Entry>;
  /** Mounted builders holding the session, counted synchronously on mount so a quick remount can't retire it. */
  holders: number;
  retired: boolean;
  ready: Promise<{ session: Session; restored: number; persistent: boolean }>;
  current: Session | null;
  /** The restore notices were shown (once per session, not per mount). */
  announced: boolean;
  detachWindow(): void;
}

/** Sessions by store factory (the app always uses `tabQueueStore`; tests pass their own), then by form and user. */
const registries = new WeakMap<StoreFactory, Map<string, Entry>>();
const registryListeners = new Set<() => void>();
const notifyRegistry = () => {
  for (const l of registryListeners) l();
};
const sessionKey = (formId: string, userId: string) => `${formId}:${userId}`;
/** Every session not yet retired, so a sign-out or a change of user can end them. */
const liveEntries = new Set<Entry>();
let watchingAuth = false;
/**
 * Sessions outlive the builder, so they must not outlive the user who made the edits: when the signed-in user is no
 * longer the session's user (sign-out, or another account signing in in this tab), the session ends at once.
 */
function watchAuth(): void {
  if (watchingAuth) return;
  watchingAuth = true;
  authStore.subscribe((state) => {
    for (const entry of [...liveEntries]) if (state.user?.id !== entry.userId) endSession(entry);
  });
}

function registryFor(factory: StoreFactory): Map<string, Entry> {
  let r = registries.get(factory);
  if (!r) registries.set(factory, (r = new Map()));
  return r;
}

/** `“total” was taken — saved as “total_2”.` for each key the server had to change in `tx`. */
function reassignedMessage(tx: OpTx, assigned: AssignedKeys): string | null {
  const parts = tx.ops.flatMap((op) => {
    if (op.kind !== 'create') return [];
    const next = op.entity === 'field' ? assigned.fields[op.snapshot.id] : assigned.variables[op.snapshot.id];
    const was = op.entity === 'field' ? op.snapshot.ref : op.snapshot.key;
    return next && next !== was ? [`“${was}” was taken — saved as “${next}”`] : [];
  });
  return parts.length ? `${parts.join('; ')}.` : null;
}

function onConfirmed(s: Session, result: ApplyOpsResult, tx: OpTx): void {
  if (s.ended) return;
  // `result.revision` (this transaction's commit) can trail `result.form.revision` (read back afterwards, maybe
  // after a collaborator's commit); the form carries its own revision, so compare that and never go backwards.
  const key = qk.forms.one(s.formId);
  const shown = s.ui?.newest.current;
  const current = newer(shown?.id === s.formId ? shown : null, s.qc.getQueryData<FormDto>(key));
  const next = newer(current, result.form)!;
  if (s.ui) s.ui.newest.current = next;
  if (next === result.form) s.qc.setQueryData<FormDto>(key, result.form);
  const assigned = Object.keys(result.assigned.fields).length > 0 || Object.keys(result.assigned.variables).length > 0;
  const role = s.roles.get(tx.txId);
  if (assigned) {
    s.stack.patchAssigned(tx.txId, result.assigned);
    // Edits queued behind this one (a delete, an undo, a key rename) still expect the old key. They were never sent,
    // so they can be pointed at the new key instead of failing with a conflict.
    s.queue.rewriteUnsent((t) => withAssignedKeys(t, result.assigned));
    // An undo re-created something under a renamed key; redoing its deletion must expect the new name.
    if (role) role.entry.tx = withAssignedKeys(role.entry.tx, result.assigned);
    const message = reassignedMessage(tx, result.assigned);
    if (message) toast.info(message);
  }
  s.roles.delete(tx.txId);
  s.ui?.bump();
}

function onRejected(s: Session, tx: OpTx, error: ApiError): void {
  if (s.ended) return;
  // A 409 may or may not carry `details.conflicts`; either way the transaction is gone and is handled alike.
  // The toast shows even after the builder was closed (the toaster is app-wide): an edit must not vanish silently.
  const role = s.roles.get(tx.txId);
  s.roles.delete(tx.txId);
  if (role) {
    s.stack.remove(role.entry);
    toast.error(`Couldn’t ${role.kind} “${role.entry.label}” — someone else has changed it since.`);
  } else {
    s.stack.forget(tx.txId);
    toast.error(error.status === 409 ? `Someone else changed this since. Your edit (“${tx.label}”) wasn’t applied.` : error.message);
  }
  void s.qc.invalidateQueries({ queryKey: qk.forms.one(s.formId) });
  s.ui?.bump();
}

/** Takes a session out of use: out of the registry, its window listeners removed and its queue stopped for good. */
function retire(entry: Entry): void {
  entry.retired = true;
  liveEntries.delete(entry);
  if (entry.registry.get(entry.key) === entry) entry.registry.delete(entry.key);
  entry.detachWindow();
  entry.current?.queue.dispose();
  notifyRegistry();
}

/**
 * Ends a session whose user is no longer signed in. Unlike retiring a drained one, its queue may still hold edits:
 * they stay in the tab's stored queue (dispose() never writes it), so they are restored at that user's next sign-in.
 */
function endSession(entry: Entry): void {
  if (entry.retired) return;
  if (entry.current) {
    entry.current.ended = true;
    entry.current.ui = null;
  }
  retire(entry);
}

/** Retires a session that no builder holds once its queue is empty. */
function maybeRetire(entry: Entry): void {
  if (entry.retired || entry.holders > 0 || !entry.current || entry.current.queue.pending.length) return;
  retire(entry);
}

function acquire(factory: StoreFactory, formId: string, userId: string, qc: QueryClient): Entry {
  const registry = registryFor(factory);
  const key = sessionKey(formId, userId);
  const existing = registry.get(key);
  if (existing) {
    existing.holders++;
    return existing;
  }
  watchAuth();
  const entry: Entry = {
    key,
    userId,
    registry,
    holders: 1,
    retired: false,
    current: null,
    announced: false,
    detachWindow: () => {},
    ready: factory(formId, userId)
      .catch(() => memoryStore())
      .then(async (store) => {
        const s: Session = { formId, userId, ended: false, queue: null!, stack: new UndoStack(), roles: new Map(), sent: new Set(), qc, ui: null };
        s.queue = new OpQueue({
          store,
          send: (tx) => {
            // Never with someone else's credentials: once the signed-in user isn't this session's user, nothing goes out.
            if (s.ended || authStore.get().user?.id !== userId) return Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'Not signed in as the author of these edits.'));
            s.sent.add(tx.txId);
            return formsService.applyOps(formId, tx);
          },
          isOnline: () => navigator.onLine,
          onConfirmed: (result, tx) => onConfirmed(s, result, tx),
          onRejected: (tx, error) => onRejected(s, tx, error),
          onForbidden: () => {
            if (s.ended) return;
            s.ui?.setReadOnly(true);
            toast.error('You no longer have edit access to this form.');
          },
        });
        s.queue.subscribe(() => {
          notifyRegistry();
          maybeRetire(entry);
        });
        // Connectivity and leaving the page, for as long as the session lives (also after the builder closed).
        const wake = () => s.queue.online();
        const onVisible = () => document.visibilityState === 'visible' && s.queue.online();
        const beforeUnload = (e: BeforeUnloadEvent) => {
          if (!s.queue.pending.length) return;
          e.preventDefault();
          e.returnValue = '';
        };
        window.addEventListener('online', wake);
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('beforeunload', beforeUnload);
        entry.detachWindow = () => {
          window.removeEventListener('online', wake);
          document.removeEventListener('visibilitychange', onVisible);
          window.removeEventListener('beforeunload', beforeUnload);
        };
        // Nothing is sent until restore() has run, and the builder only appears once it has, so restored edits
        // are on screen (folded like any pending edit) before the first new one can be made.
        const restored = await s.queue.restore();
        entry.current = s;
        if (entry.retired) {
          // The user signed out while this session was starting.
          s.ended = true;
          entry.detachWindow();
          s.queue.dispose();
          return { session: s, restored, persistent: store.persistent };
        }
        notifyRegistry();
        maybeRetire(entry);
        return { session: s, restored, persistent: store.persistent };
      }),
  };
  registry.set(key, entry);
  liveEntries.add(entry);
  return entry;
}

function release(entry: Entry, ui: Attachment): void {
  entry.holders--;
  if (entry.current?.ui === ui) entry.current.ui = null;
  maybeRetire(entry);
}

/**
 * The save state of this form's builder session in this tab, for pages outside the builder (Responses): edits made in
 * the builder may still be on their way. `null` when there is no session, i.e. nothing left to send.
 */
export function useBackgroundSave(formId: string, userId: string, storeFactory: StoreFactory = tabQueueStore): { status: SaveState; retry(): void } | null {
  const subscribe = useCallback((fn: () => void) => {
    registryListeners.add(fn);
    return () => void registryListeners.delete(fn);
  }, []);
  const find = () => registries.get(storeFactory)?.get(sessionKey(formId, userId))?.current ?? null;
  const status = useSyncExternalStore(subscribe, () => find()?.queue.status ?? null);
  if (!status) return null;
  return { status, retry: () => find()?.queue.retry() };
}

export function BuilderOpsProvider({
  formId,
  userId,
  storeFactory = tabQueueStore,
  children,
}: {
  formId: string;
  userId: string;
  storeFactory?: StoreFactory;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const cached = useQuery({ queryKey: qk.forms.one(formId), queryFn: () => formsService.get(formId) }).data!;
  const [session, setSession] = useState<Session | null>(null);
  const live = useRef<Session | null>(null);
  /** flush() calls waiting on this mount: closing the builder rejects them (the queue itself keeps sending). */
  const closing = useRef(new Set<() => void>());
  const [readOnly, setReadOnly] = useState(false);
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);
  /** The newest server state seen, so neither a lagging response nor a stale refetch takes the display back in time. */
  const newest = useRef<FormDto | null>(null);
  const confirmed = newer(newest.current?.id === formId ? newest.current : null, cached)!;
  newest.current = confirmed;

  useEffect(() => {
    let active = true;
    setReadOnly(false);
    const ui: Attachment = { newest, bump, setReadOnly };
    const entry = acquire(storeFactory, formId, userId, qc);
    void entry.ready.then(({ session: s, restored, persistent }) => {
      if (!active || s.ended) return;
      s.ui = ui;
      s.qc = qc;
      live.current = s;
      setReadOnly(s.queue.stopped);
      setSession(s);
      if (entry.announced) return;
      entry.announced = true;
      if (restored) toast.info(`Restoring ${restored} unsaved change${restored > 1 ? 's' : ''}…`);
      if (!persistent) toast.warning('This browser can’t keep unsent changes if the tab closes.');
    });
    const waiting = closing.current;
    return () => {
      active = false;
      live.current = null;
      for (const close of [...waiting]) close();
      setSession(null);
      release(entry, ui);
    };
  }, [formId, userId, storeFactory, qc, bump]);

  const queue = session?.queue ?? null;
  const version = useSyncExternalStore(
    useCallback((fn: () => void) => (queue ? queue.subscribe(fn) : () => {}), [queue]),
    () => queue?.version ?? 0,
  );

  const apply = useCallback(
    (tx: OpTx | null, opts: { mergeKey?: string } = {}) => {
      if (!tx || !session || readOnly) return;
      session.queue.enqueue(tx);
      session.stack.record(tx, { mergeKey: opts.mergeKey });
      bump();
    },
    [session, readOnly, bump],
  );

  const undo = useCallback(() => {
    if (!session || readOnly) return;
    const { queue: q, stack, roles } = session;
    const e = stack.takeUndo();
    if (!e) return;
    if (cancelEntry(q, e)) {
      stack.pushRedo({ ...e, txIds: [] });
    } else {
      // Sent, in flight, restored or already saved: the server may have it, so undo it with the inverse.
      const inverse = invertTx(e.tx);
      roles.set(inverse.txId, { kind: 'undo', entry: e });
      q.enqueue(inverse);
      stack.pushRedo(e);
    }
    bump();
  }, [session, readOnly, bump]);

  const undoIf = useCallback(
    (txId: string) => {
      if (!session || readOnly || !session.stack.isTop(txId)) return false;
      undo();
      return true;
    },
    [session, readOnly, undo],
  );

  const redo = useCallback(() => {
    if (!session || readOnly) return;
    const { queue: q, stack, roles } = session;
    const e = stack.takeRedo();
    if (!e) return;
    const again: OpTx = { ...e.tx, txId: newTxId() };
    const entry: UndoEntry = { ...e, tx: again, txIds: [again.txId], sealed: true };
    roles.set(again.txId, { kind: 'redo', entry });
    q.enqueue(again);
    stack.pushUndo(entry);
    bump();
  }, [session, readOnly, bump]);

  const flush = useCallback(async () => {
    const s = session;
    if (!s) return;
    const q = s.queue;
    await new Promise<void>((resolve, reject) => {
      // Settled: resolved only when the queue is truly empty while the builder is still open. Closing the builder
      // rejects (its edits keep being sent, but no longer for this caller), and a stopped or stalled queue never
      // drains on its own, so that rejects too.
      const settled = () => {
        if (live.current !== s) reject(unsaved());
        else if (!q.pending.length) resolve();
        else if (q.status === 'failed') reject(unsaved());
        else return false;
        return true;
      };
      if (settled()) return;
      const done = () => {
        stop();
        closing.current.delete(closed);
      };
      const closed = () => {
        done();
        reject(unsaved());
      };
      closing.current.add(closed);
      const stop = q.subscribe(() => {
        if (settled()) done();
      });
      void q.whenIdle().then(() => {
        if (settled()) done();
      });
    });
  }, [session]);

  // Keyboard: builder undo/redo, except inside text controls, where the browser's own text undo applies, and inside
  // dialogs (e.g. Logic), whose edits the builder behind them must not undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.metaKey);
      if (!isUndo && !isRedo) return;
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      if (isUndo) undo();
      else redo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const form = useMemo(() => (queue ? fold(confirmed, queue.pending) : confirmed), [confirmed, queue, version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;
  const { stack } = session;
  const value: BuilderOps = {
    form,
    apply,
    seal: () => stack.seal(),
    undo,
    undoIf,
    redo,
    canUndo: stack.canUndo && !readOnly,
    canRedo: stack.canRedo && !readOnly,
    undoLabel: stack.undoLabel,
    redoLabel: stack.redoLabel,
    status: session.queue.status,
    retry: () => session.queue.retry(),
    flush,
    readOnly,
    isOwnTx: (txId) => session.sent.has(txId),
  };
  return <BuilderOpsContext.Provider value={value}>{children}</BuilderOpsContext.Provider>;
}

/**
 * Applies a deletion and offers Undo in a toast. The toast undoes exactly that deletion: if other edits were made
 * since, it would undo those instead, so it points to the Undo button rather than undoing the wrong thing.
 */
export function applyWithUndoToast(ops: BuilderOps, tx: OpTx | null, message: string): void {
  if (!tx) return;
  ops.apply(tx);
  toast(message, {
    duration: 8000,
    action: {
      label: 'Undo',
      onClick: () => {
        if (!ops.undoIf(tx.txId)) toast.info('You’ve made other changes since — use the Undo button to step back to it.');
      },
    },
  });
}
