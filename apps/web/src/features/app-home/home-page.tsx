import { LIBRARY_SORTS, type LibraryItemDto, type LibrarySort, type NativeFileType } from '@qub/shared';
import { FEATURED_TEMPLATES, findTemplate } from '@qub/shared/templates';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowDownAZ, ChevronDown, ChevronsDownUp, ChevronsUpDown, ExternalLink, FolderOpen, Grid2x2, List, MoreVertical } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { FileIcon } from '@/components/file-icon';
import { EmptyState, ErrorState } from '@/components/states';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { Skeleton, Tooltip } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { cn, formatRelative } from '@/lib/utils';
import { driveService, openPath } from '@/services/drive';
import { qk } from '@/services/query-keys';
import { useDriveChangesFromOtherTabs } from '../drive/create-actions';
import { ItemActionsProvider, menuEntries, useItemActions } from '../drive/item-actions';
import { APPS, type AppConfig } from './app-config';
import { AppHeader } from './app-header';
import { BlankTile, TemplateTile } from './template-tiles';
import { PreviewThumbnail } from './thumbnails';

const OWNERS = ['anyone', 'me', 'not_me'] as const;
type Owner = (typeof OWNERS)[number];
const OWNER_LABEL: Record<Owner, string> = { anyone: 'Owned by anyone', me: 'Owned by me', not_me: 'Not owned by me' };
const SORT_LABEL: Record<LibrarySort, string> = { lastOpened: 'Last opened by me', updatedAt: 'Last modified', name: 'Title' };
const VIEWS = ['grid', 'list'] as const;
const COLLAPSE = ['open', 'collapsed'] as const;

/**
 * Home page of Qub Docs / Sheets / Forms: start something new (blank or template), or reopen a recent file.
 * `app` swaps in another front-end over the same files (Forms v2): its name, create routes and where files open.
 */
export function AppHomePage({ type, folderId, app: override }: { type: NativeFileType; folderId?: string; app?: AppConfig }) {
  const app = override ?? APPS[type];
  const [q, setQ] = useState('');
  useDriveChangesFromOtherTabs();
  useEffect(() => {
    document.title = `Qub ${app.product}`;
  }, [app.product]);
  return (
    <ItemActionsProvider>
      <div className="flex h-full flex-col bg-background">
        <AppHeader app={app} search={q} onSearch={setQ} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {!q && <StartSection app={app} folderId={folderId} />}
          <LibrarySection app={app} q={q} />
        </main>
      </div>
    </ItemActionsProvider>
  );
}

function StartSection({ app, folderId }: { app: AppConfig; folderId?: string }) {
  const [collapsed, setCollapsed] = useLocalPreference(`qub.${app.type}.templates`, 'open', COLLAPSE);
  const folder = useQuery({ queryKey: qk.drive.folder(folderId ?? ''), queryFn: () => driveService.folder(folderId!), enabled: !!folderId });
  const featured = FEATURED_TEMPLATES[app.type].map((id) => findTemplate(app.type, id)!);
  const isCollapsed = collapsed === 'collapsed';
  return (
    <section aria-labelledby="start-heading" className="border-b border-border bg-[#f1f3f4]">
      <div className="mx-auto max-w-[1180px] px-4 pb-6 pt-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id="start-heading" className="text-base font-medium">
            Start a new {app.noun}
          </h2>
          {folderId && folder.data && (
            <span className="rounded-full bg-background px-2.5 py-0.5 text-xs text-muted">
              Saving to <span className="font-medium text-foreground">{folder.data.isRoot ? 'My Drive' : folder.data.name}</span>
            </span>
          )}
          <div className="ml-auto flex items-center">
            <Link to={app.gallery} search={{ folder: folderId }} className="flex h-9 items-center gap-1 rounded-md px-2 text-sm text-foreground hover:bg-black/5">
              Template gallery
            </Link>
            <Tooltip content={isCollapsed ? 'Show templates' : 'Hide templates'}>
              <button
                onClick={() => setCollapsed(isCollapsed ? 'open' : 'collapsed')}
                className="rounded-full p-2 text-muted hover:bg-black/5"
                aria-label={isCollapsed ? 'Show templates' : 'Hide templates'}
                aria-expanded={!isCollapsed}
                aria-controls="start-templates"
              >
                {isCollapsed ? <ChevronsUpDown className="size-5" /> : <ChevronsDownUp className="size-5" />}
              </button>
            </Tooltip>
          </div>
        </div>
        {!isCollapsed && (
          <ul id="start-templates" className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <li>
              <BlankTile app={app} folderId={folderId} />
            </li>
            {featured.map((t, i) => (
              <li key={t.id} className={cn(i >= 2 && 'hidden sm:block', i >= 4 && 'sm:hidden lg:block')}>
                <TemplateTile app={app} template={t} folderId={folderId} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LibrarySection({ app, q }: { app: AppConfig; q: string }) {
  const [owner, setOwner] = useLocalPreference<Owner>(`qub.${app.type}.owner`, 'anyone', OWNERS);
  const [sort, setSort] = useLocalPreference<LibrarySort>(`qub.${app.type}.sort`, 'lastOpened', LIBRARY_SORTS);
  const [view, setView] = useLocalPreference(`qub.${app.type}.view`, 'grid', VIEWS);
  const params = { type: app.type, owner, sort, q };
  const query = useInfiniteQuery({
    queryKey: qk.drive.library(params),
    queryFn: ({ pageParam, signal }) => driveService.library({ ...params, cursor: pageParam, limit: 24 }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Files are edited in other tabs; coming back here should show their current state.
    refetchOnWindowFocus: 'always',
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  const heading = q ? `Results for “${q}”` : `Recent ${app.plural}`;
  return (
    <section aria-labelledby="recent-heading" className="mx-auto max-w-[1180px] px-4 pb-10 pt-5 sm:px-8">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <h2 id="recent-heading" className="mr-auto text-base font-medium">
          {heading}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 items-center gap-1 rounded-md px-2 text-sm hover:bg-hover">
              {OWNER_LABEL[owner]} <ChevronDown className="size-4 text-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {OWNERS.map((o) => (
              <DropdownMenuCheckboxItem key={o} checked={owner === o} onCheckedChange={() => setOwner(o)}>
                {OWNER_LABEL[o]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <Tooltip content={`Sort: ${SORT_LABEL[sort]}`}>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full p-2 text-muted hover:bg-hover" aria-label={`Sort options, currently ${SORT_LABEL[sort]}`}>
                <ArrowDownAZ className="size-5" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            {LIBRARY_SORTS.map((s) => (
              <DropdownMenuCheckboxItem key={s} checked={sort === s} onCheckedChange={() => setSort(s)}>
                {SORT_LABEL[s]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center rounded-full border border-border" role="group" aria-label="View">
          <Tooltip content="Grid view">
            <button className={cn('flex h-8 w-11 items-center justify-center rounded-l-full', view === 'grid' && 'bg-selected')} onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view">
              <Grid2x2 className="size-[18px]" />
            </button>
          </Tooltip>
          <Tooltip content="List view">
            <button className={cn('flex h-8 w-11 items-center justify-center rounded-r-full', view === 'list' && 'bg-selected')} onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view">
              <List className="size-[18px]" />
            </button>
          </Tooltip>
        </div>
        <Tooltip content={`Browse all ${app.plural} in Drive`}>
          <Link to="/drive/search" search={{ q: '', type: app.type }} className="rounded-full p-2 text-muted hover:bg-hover" aria-label={`Browse all ${app.plural} in Drive`}>
            <FolderOpen className="size-5" />
          </Link>
        </Tooltip>
      </div>

      {query.isLoading ? (
        <LibrarySkeleton view={view} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileIcon type={app.type} size={48} />}
          title={q ? `No ${app.plural} match “${q}”` : owner === 'anyone' ? `No ${app.plural} yet` : `No ${app.plural} ${owner === 'me' ? 'owned by you' : 'shared with you'}`}
          description={q ? 'Try another word, or search all of Drive.' : `Start with a blank ${app.noun} or a template above.`}
        />
      ) : view === 'grid' ? (
        <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>
              <LibraryCard app={app} item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <LibraryList app={app} items={items} sort={sort} />
      )}
      <div ref={sentinel} className="h-px" />
      {query.isFetchingNextPage && <p className="py-4 text-center text-sm text-muted">Loading more…</p>}
    </section>
  );
}

/** Where a recent file opens: the app's own editor when it has one, else the file's usual editor (as in Drive). */
function openHref(app: AppConfig, item: LibraryItemDto): string {
  return app.openHref?.(item) ?? openPath({ kind: 'file', id: item.id, fileType: item.fileType, resourceId: item.resourceId });
}

function useOpen(app: AppConfig) {
  const navigate = useNavigate();
  return (item: LibraryItemDto) => void navigate({ href: openHref(app, item) });
}

function subtitle(item: LibraryItemDto): string {
  return item.lastOpenedAt ? `Opened ${formatRelative(item.lastOpenedAt)}` : `Modified ${formatRelative(item.updatedAt)}`;
}

function ItemMenu({ app, item }: { app: AppConfig; item: LibraryItemDto }) {
  const actions = useItemActions();
  // "File information" needs Drive's details panel, which lives on Drive pages.
  const entries = menuEntries(actions, [item]).filter((e) => e.key !== 'details' && e.key !== 'open');
  const href = openHref(app, item);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full p-1.5 text-muted hover:bg-hover" aria-label={`Actions for ${item.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem icon={<ExternalLink />} onSelect={() => window.open(href, '_blank', 'noopener')}>
          Open in new tab
        </DropdownMenuItem>
        {entries.map((e) => (
          <Fragment key={e.key}>
            {e.separatorBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem icon={e.icon} onSelect={e.onSelect} destructive={e.destructive}>
              {e.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LibraryCard({ app, item }: { app: AppConfig; item: LibraryItemDto }) {
  const me = useCurrentUser();
  const open = useOpen(app);
  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-background transition-shadow hover:shadow-card">
      <button onClick={() => open(item)} className="relative block h-44 w-full overflow-hidden bg-[#f1f3f4] px-5 pt-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={`Open ${item.name}`}>
        <div className="overflow-hidden rounded-t-sm shadow-[0_1px_3px_rgba(60,64,67,0.25)]">
          <PreviewThumbnail title={item.name} preview={item.preview} className={cn('w-full', app.tileAspect)} />
        </div>
        <span className="absolute bottom-2.5 right-2.5 rounded-full bg-background p-1 shadow-card">
          <FileIcon type={item.fileType} size={20} />
        </span>
      </button>
      <div className="flex items-start gap-1 border-t border-border px-3 py-2.5">
        <div className="min-w-0 flex-1 pl-1">
          <h3 className="truncate text-sm font-medium" title={item.name}>
            {item.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
            <FileIcon type={item.fileType} size={14} />
            <span className="truncate">{subtitle(item)}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{item.owner.id === me.id ? 'me' : item.owner.name}</span>
          </p>
        </div>
        <ItemMenu app={app} item={item} />
      </div>
    </article>
  );
}

function LibraryList({ app, items, sort }: { app: AppConfig; items: LibraryItemDto[]; sort: LibrarySort }) {
  const me = useCurrentUser();
  const open = useOpen(app);
  return (
    <table className="mt-2 w-full table-fixed text-sm">
      <thead className="sr-only sm:table-header-group">
        <tr className="text-left text-xs font-medium text-muted">
          <th className="py-2 pl-2 font-medium">Name</th>
          <th className="hidden w-48 py-2 font-medium md:table-cell">Owner</th>
          <th className="w-44 py-2 font-medium">{sort === 'updatedAt' ? 'Last modified' : 'Last opened by me'}</th>
          <th className="w-12" />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="cursor-pointer border-t border-border hover:bg-hover" onClick={() => open(item)}>
            <td className="py-2 pl-2">
              <button className="flex min-w-0 max-w-full items-center gap-3 text-left outline-none focus-visible:underline" onClick={(e) => (e.stopPropagation(), open(item))}>
                <FileIcon type={app.type} size={20} />
                <span className="truncate">{item.name}</span>
              </button>
            </td>
            <td className="hidden truncate text-muted md:table-cell">{item.owner.id === me.id ? 'me' : item.owner.name}</td>
            <td className="truncate text-muted">{sort === 'updatedAt' ? formatRelative(item.updatedAt) : item.lastOpenedAt ? formatRelative(item.lastOpenedAt) : '—'}</td>
            <td onClick={(e) => e.stopPropagation()}>
              <ItemMenu app={app} item={item} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LibrarySkeleton({ view }: { view: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <div className="mt-3 space-y-3" aria-label="Loading">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    );
  }
  return (
    <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-label="Loading">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i}>
          <Skeleton className="h-60 w-full rounded-lg" />
        </li>
      ))}
    </ul>
  );
}
