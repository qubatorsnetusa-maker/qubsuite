import type { DriveItemDto, FileType } from '@qub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronUp, RotateCcw, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { FileIcon } from '@/components/file-icon';
import { ApiError, errorMessage } from '@/lib/api';
import { cn, formatBytes } from '@/lib/utils';
import { driveService } from '@/services/drive';
import { qk } from '@/services/query-keys';
import { selectionFromDrop, selectionFromFileList, type UploadSelection } from './folder-reader';

type Status = 'preparing' | 'active' | 'done' | 'error' | 'cancelled';

interface Job {
  file: File;
  /** Target folder; resolved once a folder upload has created its folders. */
  folderId?: string;
  loaded: number;
  state: 'queued' | 'running' | 'done' | 'error';
  error?: string;
}

interface Transfer {
  id: string;
  direction: 'upload' | 'download';
  name: string;
  fileType: FileType | 'FOLDER';
  totalBytes: number;
  loadedBytes: number;
  status: Status;
  error?: string;
  /** Set when the browser handles the download itself (very large files). */
  note?: string;
  jobs: Job[];
  controller: AbortController;
  /** Folder uploads: paths to create first, and where. */
  folder?: { parentId?: string; dirs: string[]; created?: Record<string, string>; jobDirs: string[] };
  fileId?: string;
}

export interface TransferApi {
  upload(files: FileList | File[], folderId?: string): void;
  /** Uploads what an `<input webkitdirectory>` returned. */
  uploadFolder(files: FileList, folderId?: string): void;
  /** Handles any drop from the desktop, including folders. Call it synchronously inside the drop event. */
  uploadDrop(dt: DataTransfer, folderId?: string): void;
  download(items: DriveItemDto[]): void;
}

const TransferContext = createContext<TransferApi | null>(null);
/** Whether the transfers panel is on screen (kept separate so callers don't re-render on progress). */
const PanelContext = createContext(false);

export function useTransfers(): TransferApi {
  const ctx = useContext(TransferContext);
  if (!ctx) throw new Error('useTransfers must be used inside TransferProvider');
  return ctx;
}

/** Null outside Drive (e.g. the Docs/Sheets/Forms home pages), where downloads go straight to the browser. */
export const useOptionalTransfers = () => useContext(TransferContext);

export const useTransferPanelOpen = () => useContext(PanelContext);

const CONCURRENCY = 3;
/** Above this, downloads are handed to the browser instead of buffered in memory for progress. */
const IN_APP_DOWNLOAD_LIMIT = 300 * 1024 * 1024;
const AUTO_CLOSE_SECONDS = 5;

function fileTypeOf(file: File): FileType {
  const t = file.type;
  if (t.startsWith('image/')) return 'IMAGE';
  if (t.startsWith('video/')) return 'VIDEO';
  if (t.startsWith('audio/')) return 'AUDIO';
  if (t === 'application/pdf') return 'PDF';
  if (t.startsWith('text/')) return 'TEXT';
  if (/zip|tar|rar|7z|gzip/.test(t)) return 'ARCHIVE';
  return 'OTHER';
}

function Ring({ value, className }: { value: number; className?: string }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 20 20" className={cn('size-5 -rotate-90', className)} aria-hidden>
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.5" className="stroke-current opacity-20" />
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-current transition-[stroke-dashoffset]" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
    </svg>
  );
}

/**
 * Uploads and downloads for Drive: a queue (3 at a time) with per-item progress, cancel and retry. Folder uploads
 * create the folder tree first, then upload each file into its folder. The panel minimizes to one progress bar and
 * closes itself shortly after everything succeeds.
 */
export function TransferProvider({ children }: { children: ReactNode }) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const store = useRef(new Map<string, Transfer>());
  const queue = useRef<{ transferId: string; job: Job }[]>([]);
  const running = useRef(0);
  const qc = useQueryClient();

  /** Re-derives a transfer's totals and status from its jobs, then publishes the list. */
  const commit = useCallback((t: Transfer) => {
    if (t.direction === 'upload' && t.status !== 'preparing' && t.status !== 'cancelled') {
      t.loadedBytes = t.jobs.reduce((s, j) => s + (j.state === 'done' ? j.file.size : j.loaded), 0);
      const pending = t.jobs.some((j) => j.state === 'queued' || j.state === 'running');
      const failed = t.jobs.filter((j) => j.state === 'error');
      t.status = pending ? 'active' : failed.length ? 'error' : 'done';
      t.error = failed.length ? (t.jobs.length === 1 ? failed[0]!.error : `${failed.length} of ${t.jobs.length} files failed: ${failed[0]!.error}`) : undefined;
    }
    store.current.set(t.id, t);
    setTransfers([...store.current.values()].reverse());
  }, []);

  const pump = useCallback(() => {
    while (running.current < CONCURRENCY && queue.current.length) {
      const { transferId, job } = queue.current.shift()!;
      const t = store.current.get(transferId);
      if (!t || t.controller.signal.aborted || job.state !== 'queued') continue;
      running.current++;
      job.state = 'running';
      commit(t);
      driveService
        .upload(job.file, job.folderId, (f) => {
          job.loaded = f * job.file.size;
          commit(t);
        }, t.controller.signal)
        .then(() => {
          job.state = 'done';
          void qc.invalidateQueries({ queryKey: qk.drive.all });
        })
        .catch((err: unknown) => {
          if ((err as Error).name === 'AbortError') return;
          job.state = 'error';
          job.loaded = 0;
          job.error = errorMessage(err);
        })
        .finally(() => {
          running.current--;
          if (!t.controller.signal.aborted) commit(t);
          pump();
        });
    }
  }, [commit, qc]);

  const enqueue = useCallback(
    (t: Transfer) => {
      for (const job of t.jobs) if (job.state === 'queued') queue.current.push({ transferId: t.id, job });
      pump();
    },
    [pump],
  );

  /** Creates a folder upload's folders, then queues its files. */
  const startFolder = useCallback(
    async (t: Transfer) => {
      const f = t.folder!;
      try {
        if (!f.created) f.created = (await driveService.createFolderTree(f.parentId, f.dirs)).folders;
        t.jobs.forEach((job, i) => (job.folderId = f.created![f.jobDirs[i]!]));
        t.status = 'active';
        commit(t);
        void qc.invalidateQueries({ queryKey: qk.drive.all });
        enqueue(t);
      } catch (err) {
        t.status = 'error';
        t.error = errorMessage(err);
        commit(t);
      }
    },
    [commit, enqueue, qc],
  );

  const addUploads = useCallback(
    (sel: UploadSelection, folderId?: string) => {
      const created: Transfer[] = [];
      for (const { file } of sel.entries.filter((e) => !e.dir)) {
        created.push({
          id: crypto.randomUUID(),
          direction: 'upload',
          name: file.name,
          fileType: fileTypeOf(file),
          totalBytes: file.size,
          loadedBytes: 0,
          status: 'active',
          jobs: [{ file, folderId, loaded: 0, state: 'queued' }],
          controller: new AbortController(),
        });
      }
      // One transfer per top-level folder.
      const tops = new Set([...sel.dirs, ...sel.entries.map((e) => e.dir)].filter(Boolean).map((d) => d.split('/')[0]!));
      for (const top of tops) {
        const inTop = (d: string) => d === top || d.startsWith(`${top}/`);
        const entries = sel.entries.filter((e) => inTop(e.dir));
        const dirs = [...new Set([...sel.dirs.filter(inTop), ...entries.map((e) => e.dir)])];
        created.push({
          id: crypto.randomUUID(),
          direction: 'upload',
          name: top,
          fileType: 'FOLDER',
          totalBytes: entries.reduce((s, e) => s + e.file.size, 0),
          loadedBytes: 0,
          status: 'preparing',
          jobs: entries.map((e) => ({ file: e.file, loaded: 0, state: 'queued' })),
          controller: new AbortController(),
          folder: { parentId: folderId, dirs, jobDirs: entries.map((e) => e.dir) },
        });
      }
      if (!created.length) return;
      setCollapsed(false);
      for (const t of created) {
        commit(t);
        if (t.folder) void startFolder(t);
        else enqueue(t);
      }
    },
    [commit, enqueue, startFolder],
  );

  const runDownload = useCallback(
    async (t: Transfer) => {
      const url = driveService.downloadUrl(t.fileId!);
      const viaBrowser = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = t.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      if (t.totalBytes > IN_APP_DOWNLOAD_LIMIT || typeof ReadableStream === 'undefined') {
        viaBrowser();
        Object.assign(t, { status: 'done', loadedBytes: t.totalBytes, note: 'Continuing in your browser’s downloads' });
        return commit(t);
      }
      try {
        const res = await fetch(url, { credentials: 'include', signal: t.controller.signal });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new ApiError(res.status, 'INTERNAL_ERROR', body?.error?.message ?? `Download failed (${res.status})`);
        }
        const total = Number(res.headers.get('content-length')) || t.totalBytes;
        t.totalBytes = total;
        const reader = res.body!.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          t.loadedBytes += value.byteLength;
          commit(t);
        }
        const blob = new Blob(chunks as BlobPart[], { type: res.headers.get('content-type') ?? 'application/octet-stream' });
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = t.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 60_000);
        t.status = 'done';
        t.loadedBytes = t.totalBytes;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        t.status = 'error';
        t.error = errorMessage(err);
      }
      commit(t);
    },
    [commit],
  );

  const retry = useCallback(
    (t: Transfer) => {
      if (t.status === 'cancelled' || t.controller.signal.aborted) t.controller = new AbortController();
      t.error = undefined;
      setCollapsed(false);
      if (t.direction === 'download') {
        Object.assign(t, { status: 'active', loadedBytes: 0 });
        commit(t);
        return void runDownload(t);
      }
      for (const j of t.jobs) if (j.state !== 'done') Object.assign(j, { state: 'queued', loaded: 0, error: undefined });
      if (t.folder && !t.folder.created) {
        t.status = 'preparing';
        commit(t);
        return void startFolder(t);
      }
      t.status = 'active';
      commit(t);
      enqueue(t);
    },
    [commit, enqueue, runDownload, startFolder],
  );

  const cancel = (t: Transfer) => {
    t.controller.abort();
    t.status = 'cancelled';
    for (const j of t.jobs) if (j.state === 'queued' || j.state === 'running') j.state = 'error';
    commit(t);
  };
  const dismiss = (t: Transfer) => {
    store.current.delete(t.id);
    setTransfers([...store.current.values()].reverse());
  };
  const clear = useCallback(() => {
    for (const t of store.current.values()) if (t.status === 'active' || t.status === 'preparing') return;
    store.current.clear();
    setTransfers([]);
  }, []);

  const api = useMemo<TransferApi>(
    () => ({
      upload: (files, folderId) => addUploads({ entries: Array.from(files).map((file) => ({ file, dir: '' })), dirs: [] }, folderId),
      uploadFolder: (files, folderId) => addUploads(selectionFromFileList(files), folderId),
      uploadDrop: (dt, folderId) => {
        selectionFromDrop(dt)
          .then((sel) => addUploads(sel, folderId))
          .catch(() => toast.error('That folder couldn’t be read. Try “Folder upload” from the New menu.'));
      },
      download: (items) => {
        setCollapsed(false);
        for (const item of items) {
          if (item.kind !== 'file') continue;
          const t: Transfer = {
            id: crypto.randomUUID(),
            direction: 'download',
            name: item.name,
            fileType: item.fileType,
            totalBytes: item.size,
            loadedBytes: 0,
            status: 'active',
            jobs: [],
            controller: new AbortController(),
            fileId: item.id,
          };
          commit(t);
          void runDownload(t);
        }
      },
    }),
    [addUploads, commit, runDownload],
  );

  const active = transfers.filter((t) => t.status === 'active' || t.status === 'preparing');
  const failed = transfers.filter((t) => t.status === 'error');
  const done = transfers.filter((t) => t.status === 'done');
  const allGood = transfers.length > 0 && !active.length && !failed.length;
  const total = transfers.reduce((s, t) => s + (t.status === 'cancelled' ? 0 : t.totalBytes), 0);
  const loaded = transfers.reduce((s, t) => s + (t.status === 'cancelled' ? 0 : t.status === 'done' ? t.totalBytes : t.loadedBytes), 0);
  const overall = total ? loaded / total : active.length ? 0 : 1;

  // Closes itself a few seconds after everything succeeded, unless the pointer is over it.
  useEffect(() => {
    if (!allGood || hovered) return setCountdown(null);
    setCountdown(AUTO_CLOSE_SECONDS);
    const timer = setInterval(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => clearInterval(timer);
  }, [allGood, hovered, transfers.length]);
  useEffect(() => {
    if (countdown !== null && countdown <= 0) clear();
  }, [countdown, clear]);

  // Leaving the page mid-upload would lose the files.
  useEffect(() => {
    if (!active.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active.length]);

  const ups = active.filter((t) => t.direction === 'upload').length;
  const downs = active.length - ups;
  const title = failed.length
    ? active.length
      ? `${failed.length} failed · ${active.length} in progress`
      : `${failed.length} transfer${failed.length === 1 ? '' : 's'} failed`
    : active.length
      ? downs && ups
        ? `${active.length} transfers in progress`
        : `${ups ? 'Uploading' : 'Downloading'} ${active.length} item${active.length === 1 ? '' : 's'}`
      : transfers.every((t) => t.direction === 'upload')
        ? `${done.length} upload${done.length === 1 ? '' : 's'} complete`
        : transfers.every((t) => t.direction === 'download')
          ? `${done.length} download${done.length === 1 ? '' : 's'} complete`
          : 'All transfers complete';

  return (
    <TransferContext.Provider value={api}>
      <PanelContext.Provider value={transfers.length > 0}>{children}</PanelContext.Provider>
      {transfers.length > 0 && (
        <section
          aria-label="Transfers"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="fixed bottom-4 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-background shadow-pop animate-pop-in"
        >
          <header
            className={cn('flex cursor-pointer items-center gap-3 px-4 py-3', failed.length ? 'bg-danger-soft' : allGood ? 'bg-[#e6f4ea]' : 'bg-[#e9eef6]')}
            onClick={() => setCollapsed((c) => !c)}
          >
            {failed.length ? (
              <XCircle className="size-5 shrink-0 text-danger" />
            ) : allGood ? (
              <CheckCircle2 className="size-5 shrink-0 text-success" />
            ) : (
              <Ring value={overall} className="shrink-0 text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-medium" aria-live="polite">
                {title}
              </h2>
              {active.length > 0 && !failed.length && <p className="text-[11px] text-muted">{Math.round(overall * 100)}% · {formatBytes(loaded)} of {formatBytes(total)}</p>}
              {countdown !== null && countdown > 0 && <p className="text-[11px] text-muted">Closing in {countdown}s</p>}
            </div>
            <div className="flex" onClick={(e) => e.stopPropagation()}>
              <button className="rounded-full p-1.5 hover:bg-black/5" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand transfers' : 'Minimize transfers'}>
                {collapsed ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
              </button>
              {!active.length && (
                <button className="rounded-full p-1.5 hover:bg-black/5" onClick={clear} aria-label="Close transfers">
                  <X className="size-5" />
                </button>
              )}
            </div>
          </header>
          {collapsed ? (
            active.length > 0 && (
              <div className="h-1 bg-surface-2" role="progressbar" aria-label="Overall progress" aria-valuenow={Math.round(overall * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-primary transition-[width]" style={{ width: `${overall * 100}%` }} />
              </div>
            )
          ) : (
            <>
              <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                {transfers.map((t) => (
                  <TransferRow key={t.id} t={t} onCancel={() => cancel(t)} onRetry={() => retry(t)} onDismiss={() => dismiss(t)} />
                ))}
              </ul>
              <footer className="flex items-center justify-between border-t border-border bg-surface px-4 py-2 text-xs text-muted">
                <span>
                  {done.length} of {transfers.length} complete
                </span>
                <span className="flex gap-3">
                  {failed.length > 0 && (
                    <button className="font-medium text-primary hover:underline" onClick={() => failed.forEach(retry)}>
                      Retry all failed
                    </button>
                  )}
                  {!active.length && (
                    <button className="font-medium text-primary hover:underline" onClick={clear}>
                      Done
                    </button>
                  )}
                </span>
              </footer>
            </>
          )}
        </section>
      )}
    </TransferContext.Provider>
  );
}

function TransferRow({ t, onCancel, onRetry, onDismiss }: { t: Transfer; onCancel(): void; onRetry(): void; onDismiss(): void }) {
  const pct = t.totalBytes ? Math.min(1, t.loadedBytes / t.totalBytes) : t.status === 'done' ? 1 : 0;
  const up = t.direction === 'upload';
  const filesDone = t.jobs.filter((j) => j.state === 'done').length;
  let detail: ReactNode;
  if (t.status === 'preparing') detail = `Creating folders…`;
  else if (t.status === 'active')
    detail = t.folder ? `${filesDone} of ${t.jobs.length} files · ${Math.round(pct * 100)}%` : `${up ? 'Uploading' : 'Downloading'} · ${formatBytes(t.loadedBytes)} of ${formatBytes(t.totalBytes)}`;
  else if (t.status === 'done') detail = t.note ?? (t.folder ? `${t.jobs.length} file${t.jobs.length === 1 ? '' : 's'} uploaded · ${formatBytes(t.totalBytes)}` : `${up ? 'Uploaded' : 'Downloaded'} · ${formatBytes(t.totalBytes)}`);
  else if (t.status === 'cancelled') detail = 'Cancelled';
  else detail = t.error;

  return (
    <li className="flex items-start gap-3 px-4 py-2.5 text-sm">
      <span className="relative mt-0.5 shrink-0">
        <FileIcon type={t.fileType} size={22} />
        <span className={cn('absolute -bottom-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full text-white ring-2 ring-background', up ? 'bg-primary' : 'bg-success')} aria-hidden>
          {up ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate" title={t.name}>
          {t.name}
        </p>
        <p className={cn('text-xs', t.status === 'error' ? 'text-danger' : 'text-muted')}>{detail}</p>
        {(t.status === 'active' || t.status === 'preparing') && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${up ? 'Uploading' : 'Downloading'} ${t.name}`}>
            <div className={cn('h-full bg-primary transition-[width]', t.status === 'preparing' && 'w-1/3 animate-pulse')} style={t.status === 'preparing' ? undefined : { width: `${pct * 100}%` }} />
          </div>
        )}
        {(t.status === 'error' || t.status === 'cancelled') && (
          <div className="mt-1 flex gap-3 text-xs">
            <button className="inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={onRetry}>
              <RotateCcw className="size-3.5" /> Retry
            </button>
            <button className="text-muted hover:underline" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
        )}
      </div>
      {t.status === 'done' && <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Complete" />}
      {(t.status === 'active' || t.status === 'preparing') && (
        <button className="rounded-full p-1 text-muted hover:bg-hover" onClick={onCancel} aria-label={`Cancel ${t.name}`}>
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}
