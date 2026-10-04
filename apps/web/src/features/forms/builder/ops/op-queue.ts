import type { ApplyOpsResult } from '@qub/shared';
import { coalesceTx, type OpTx } from '@qub/shared/forms';
import { ApiError } from '@/lib/api';
import type { QueueStore } from './queue-store';

export type SaveState = 'saved' | 'saving' | 'offline' | 'failed';
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
export const MAX_SERVER_ERRORS = 5;

export interface OpQueueOptions {
  send(tx: OpTx): Promise<ApplyOpsResult>;
  store: QueueStore;
  onConfirmed(result: ApplyOpsResult, tx: OpTx): void;
  /** 409/422: the transaction was dropped. */
  onRejected(tx: OpTx, error: ApiError): void;
  /** 401/403: editing stopped. */
  onForbidden(error: ApiError): void;
  isOnline?(): boolean;
  setTimer?(fn: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}

/** Sends builder transactions strictly in order, one at a time, retrying transport failures and persisting what is unsent. */
export class OpQueue {
  private queue: OpTx[] = [];
  private inFlight = false;
  private offline = false;
  private stalled = false;
  private isStopped = false;
  private rejected = false;
  /** Nothing is sent until persisted work has been restored, so it goes first. */
  private ready = false;
  private networkErrors = 0;
  private serverErrors = 0;
  private timer: unknown = null;
  private listeners = new Set<() => void>();
  private idle: (() => void)[] = [];
  private _version = 0;
  private disposed = false;
  /** txIds sent at least once. The server may already have applied them even if this attempt failed or is
   * still pending (network error, 5xx, or an unresolved in-flight send), so they must never be coalesced
   * into or cancelled — that would silently drop the edit that was merged in or discard one the server kept. */
  private attempted = new Set<string>();

  constructor(private readonly opts: OpQueueOptions) {}

  get pending(): readonly OpTx[] {
    return this.queue;
  }
  get inFlightTxId(): string | null {
    return this.inFlight ? this.queue[0]!.txId : null;
  }
  get version(): number {
    return this._version;
  }
  get status(): SaveState {
    if (this.isStopped || this.stalled) return 'failed';
    if (this.offline) return 'offline';
    if (this.queue.length) return 'saving';
    return this.rejected ? 'failed' : 'saved';
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async restore(): Promise<number> {
    // A store that fails to load must not stall the queue forever: treat it as empty and become ready anyway,
    // so new edits still get sent. But we must not then write that empty guess back over storage we simply
    // failed to read — that would permanently destroy whatever was actually there. So: skip *this* persist
    // when the load failed; a later enqueue()/cancel()/send will persist normally, once there is something new
    // worth persisting instead of a blind guess.
    let loadFailed = false;
    const saved = await this.opts.store.load().catch(() => {
      loadFailed = true;
      return [] as OpTx[];
    });
    const known = new Set(this.queue.map((t) => t.txId));
    const restored = saved.filter((t) => !known.has(t.txId));
    // A transaction that was already persisted may already have reached the server before the tab closed (we
    // cannot tell), so — just like one that has actually been sent this session — it can never be coalesced
    // into or cancelled. This applies at every position in the queue, not just the front.
    for (const t of restored) this.attempted.add(t.txId);
    this.queue = [...restored, ...this.queue];
    this.ready = true;
    if (!loadFailed) this.persist();
    this.changed();
    void this.kick();
    return saved.length;
  }

  enqueue(tx: OpTx): void {
    if (this.disposed || this.isStopped) return;
    const lastIndex = this.queue.length - 1;
    const last = lastIndex >= 0 ? this.queue[lastIndex]! : null;
    // Once a transaction has been sent (or restored/adopted, where it may already have been sent before this
    // session) the server may already have applied it, so it can never be coalesced into again — regardless of
    // its position in the queue, not just when it is the one currently in flight.
    const lastLocked = last !== null && this.attempted.has(last.txId);
    const merged = last !== null && !lastLocked ? coalesceTx(last, tx) : null;
    if (merged) this.queue[lastIndex] = merged;
    else this.queue.push(tx);
    // Before restore() has run, this.queue only holds edits made while restoring; persisting now would
    // overwrite whatever restore() is about to load from the store with this partial list. restore()
    // persists the merged result itself once it is ready.
    if (this.ready) this.persist();
    this.changed();
    void this.kick();
  }

  /** Removes a transaction that has not been sent yet (undo of an unsent edit). Once a transaction has been
   * attempted at least once — sent this session, or merely restored/adopted from a previous one — it cannot be
   * cancelled either, at any position in the queue: the server may already have applied it. */
  cancel(txId: string): boolean {
    const i = this.queue.findIndex((t) => t.txId === txId);
    if (i < 0 || this.attempted.has(txId)) return false;
    this.queue.splice(i, 1);
    if (this.ready) this.persist();
    this.changed();
    if (!this.queue.length) this.resolveIdle();
    return true;
  }

  /** Rewrites every transaction that has never been attempted (e.g. to expect keys the server just assigned). Attempted
   * and restored ones are left alone: the server may already have applied them as they are. */
  rewriteUnsent(fn: (tx: OpTx) => OpTx): void {
    let changed = false;
    this.queue = this.queue.map((t) => {
      if (this.attempted.has(t.txId)) return t;
      const next = fn(t);
      if (next !== t) changed = true;
      return next;
    });
    if (!changed) return;
    if (this.ready) this.persist();
    this.changed();
  }

  /** Edit access was lost (401/403): nothing more will be sent. */
  get stopped(): boolean {
    return this.isStopped;
  }

  retry(): void {
    this.stalled = false;
    this.rejected = false;
    this.networkErrors = 0;
    this.serverErrors = 0;
    this.wake();
  }

  online(): void {
    if (this.offline || this.timer !== null) this.wake();
  }

  whenIdle(): Promise<void> {
    return this.queue.length ? new Promise((resolve) => this.idle.push(resolve)) : Promise.resolve();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) (this.opts.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
    this.listeners.clear();
    // Nothing will ever become idle on its own now — resolve whoever is waiting rather than leave them hanging.
    this.resolveIdle();
  }

  private wake() {
    if (this.timer !== null) (this.opts.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
    this.changed();
    void this.kick();
  }

  private async kick(): Promise<void> {
    if (this.disposed) return;
    if (!this.queue.length) {
      this.resolveIdle();
      return;
    }
    if (!this.ready || this.inFlight || this.isStopped || this.stalled || this.timer !== null) return;
    if (this.opts.isOnline && !this.opts.isOnline()) {
      this.offline = true;
      this.changed();
      return;
    }
    const tx = this.queue[0]!;
    this.attempted.add(tx.txId);
    this.inFlight = true;
    this.changed();
    try {
      const result = await this.opts.send(tx);
      // dispose() during the send: the caller is gone, so no callback, no persist and no further send.
      if (this.disposed) return;
      this.inFlight = false;
      this.offline = false;
      this.rejected = false;
      this.networkErrors = 0;
      this.serverErrors = 0;
      this.queue.shift();
      this.attempted.delete(tx.txId);
      this.persist();
      this.changed();
      this.opts.onConfirmed(result, tx);
    } catch (e) {
      if (this.disposed) return;
      this.inFlight = false;
      const err = e instanceof ApiError ? e : new ApiError(0, 'NETWORK_ERROR', e instanceof Error ? e.message : String(e));
      if (err.status === 409 || err.status === 422) {
        this.queue.shift();
        this.attempted.delete(tx.txId);
        this.rejected = true;
        this.offline = false;
        this.persist();
        this.changed();
        this.opts.onRejected(tx, err);
      } else if (err.status === 401 || err.status === 403) {
        this.isStopped = true;
        this.changed();
        this.opts.onForbidden(err);
        return;
      } else if (err.code === 'NETWORK_ERROR' || err.status === 0) {
        this.offline = true;
        this.schedule(RETRY_DELAYS_MS[Math.min(this.networkErrors++, RETRY_DELAYS_MS.length - 1)]!);
        return;
      } else {
        this.serverErrors++;
        if (this.serverErrors >= MAX_SERVER_ERRORS) {
          this.stalled = true;
          this.changed();
          return;
        }
        this.schedule(RETRY_DELAYS_MS[Math.min(this.serverErrors - 1, RETRY_DELAYS_MS.length - 1)]!);
        return;
      }
    }
    void this.kick();
  }

  private schedule(ms: number) {
    if (this.disposed) return;
    this.changed();
    this.timer = (this.opts.setTimer ?? setTimeout)(() => {
      this.timer = null;
      void this.kick();
    }, ms);
  }

  private persist() {
    if (this.disposed) return;
    void this.opts.store.save(this.queue).catch(() => undefined);
  }

  private changed() {
    this._version++;
    for (const l of this.listeners) l();
  }

  private resolveIdle() {
    const waiting = this.idle;
    this.idle = [];
    for (const r of waiting) r();
  }
}
