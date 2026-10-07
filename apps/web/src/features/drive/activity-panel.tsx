import type { DriveActivityCategory, DriveActivityItemDto } from '@qub/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Eye, History, MessageSquare, Pencil, RefreshCw, Search, Share2, Trash2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { FileIcon } from '@/components/file-icon';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/form-controls';
import { Avatar, Skeleton, Tooltip } from '@/components/ui/misc';
import { cn, formatDate } from '@/lib/utils';
import { driveService, openPath, openServiceUrl } from '@/services/drive';
import { qk } from '@/services/query-keys';
import { describeActivity } from './activity-text';

const CATEGORIES: { id: DriveActivityCategory; label: string; icon: ReactNode }[] = [
  { id: 'all', label: 'All', icon: <History /> },
  { id: 'edits', label: 'Edits', icon: <Pencil /> },
  { id: 'sharing', label: 'Sharing', icon: <Share2 /> },
  { id: 'comments', label: 'Comments', icon: <MessageSquare /> },
  { id: 'trash', label: 'Trash', icon: <Trash2 /> },
  { id: 'views', label: 'Views', icon: <Eye /> },
];

const REFRESH_MS = 30_000;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function Entry({ a, onOpen }: { a: DriveActivityItemDto; onOpen(a: DriveActivityItemDto): void }) {
  const item = a.item;
  return (
    <li className="rounded-xl border border-border p-3 text-sm transition-colors hover:border-primary/40">
      <div className="flex gap-2.5">
        {a.actor ? <Avatar user={a.actor} size={28} /> : <span className="size-7 shrink-0 rounded-full bg-surface-2" />}
        <div className="min-w-0 flex-1">
          <p>
            <b className="font-medium">{a.actor?.name ?? 'Someone'}</b> {describeActivity(a, false)}
          </p>
          <p className="text-xs text-muted">{new Date(a.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
        </div>
      </div>
      {item && (
        <button
          onClick={() => onOpen(a)}
          disabled={!item.available}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-left hover:bg-hover disabled:cursor-default disabled:hover:bg-surface"
          title={item.available ? `Open ${item.name}` : undefined}
        >
          <FileIcon type={item.fileType} size={18} />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {!item.available && <span className="shrink-0 text-xs text-muted">In trash or deleted</span>}
        </button>
      )}
    </li>
  );
}

/** Everything that happened across the files and folders the user can reach, newest first, refreshed every 30 s. */
export function ActivityPanel({ onClose }: { onClose(): void }) {
  const navigate = useNavigate();
  const [category, setCategory] = useState<DriveActivityCategory>('all');
  const [actor, setActor] = useState<'anyone' | 'me' | 'others'>('anyone');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const params = { category, actor, q };
  const feed = useInfiniteQuery({
    queryKey: qk.drive.feed(params),
    queryFn: ({ pageParam }) => driveService.activityFeed({ ...params, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    refetchInterval: REFRESH_MS,
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const groups: { day: string; items: DriveActivityItemDto[] }[] = [];
  for (const a of items) {
    const day = dayLabel(a.createdAt);
    if (groups.at(-1)?.day === day) groups.at(-1)!.items.push(a);
    else groups.push({ day, items: [a] });
  }

  const open = (a: DriveActivityItemDto) => {
    const i = a.item;
    if (!i?.available) return;
    if (i.kind === 'file' && (i.fileType === 'DOCUMENT' || i.fileType === 'SPREADSHEET' || i.fileType === 'FORM')) {
      window.open(openServiceUrl({ kind: i.kind, id: i.id, fileType: i.fileType, resourceId: i.resourceId }), '_blank', 'noopener');
    } else {
      void navigate({ href: openPath({ kind: i.kind, id: i.id, fileType: i.fileType === 'FOLDER' ? undefined : i.fileType, resourceId: i.resourceId }) });
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-background sm:w-[380px]" aria-label="Activity">
      <header className="flex items-center gap-2 px-4 py-3">
        <History className="size-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base">Activity</h2>
          <p className="text-xs text-muted">Across everything you can open · updates every 30 seconds</p>
        </div>
        <Tooltip content="Refresh">
          <Button variant="subtle" size="icon-sm" onClick={() => void feed.refetch()} aria-label="Refresh activity">
            <RefreshCw className={cn(feed.isFetching && 'animate-spin')} />
          </Button>
        </Tooltip>
        <Button variant="subtle" size="icon-sm" onClick={onClose} aria-label="Close activity">
          <X />
        </Button>
      </header>
      <div className="space-y-2 border-b border-border px-4 pb-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Activity type">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn('flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs [&_svg]:size-3.5', category === c.id ? 'border-primary bg-primary-soft font-medium text-primary' : 'border-border text-muted hover:bg-hover')}
            >
              {c.icon}
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-surface px-2.5">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="File or person" aria-label="Filter activity" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
          </label>
          <NativeSelect aria-label="Who" value={actor} onChange={(e) => setActor(e.target.value as typeof actor)}>
            <option value="anyone">Anyone</option>
            <option value="me">By me</option>
            <option value="others">By others</option>
          </NativeSelect>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {feed.error ? (
          <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
        ) : feed.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<History />} title="No activity" description={category === 'views' ? 'Views and downloads of files you own show up here.' : 'Nothing matches these filters yet.'} />
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.day}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted" title={formatDate(g.items[0]!.createdAt)}>
                  {g.day}
                </h3>
                <ul className="space-y-2">
                  {g.items.map((a) => (
                    <Entry key={a.id} a={a} onOpen={open} />
                  ))}
                </ul>
              </section>
            ))}
            {feed.hasNextPage && (
              <Button variant="subtle" size="sm" className="w-full" loading={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
                Show older activity
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
