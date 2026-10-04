import { SPAM_RETENTION_DAYS, type DriveItemDto, type FolderRef } from '@qub/shared';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ArrowDownUp, Ban, Check, ChevronDown, ChevronRight, Clock, FolderOpen, Grid2x2, History, Info, List, OctagonAlert, SearchX, Star, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { Avatar, Skeleton, Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { DetailsPanel } from './details-panel';
import { hasFiles, hasQubItems, readDragItems } from './dnd';
import { useActivityPanel } from './drive-layout-context';
import { isTypingTarget, useDrivePrefs } from './drive-prefs';
import { ListingPreview } from './file-viewer';
import { ItemActionsProvider, useItemActions } from './item-actions';
import { ItemsView } from './items-view';
import {
  flattenPages,
  useDriveFiles,
  useDriveFolders,
  useEmptySpam,
  useEmptyTrash,
  useMoveItems,
  usePeople,
  useRecentFiles,
  useSharedFiles,
  useSpamFiles,
  useStarredFiles,
  useTrashedFolder,
  useTrashFiles,
  type ModifiedPreset,
  type SortState,
} from './queries';
import { BlockedPeopleDialog } from './spam-dialogs';
import { SuggestedSection } from './suggested';
import { useTransfers } from './transfer-manager';

const TYPE_FILTERS = [
  { value: 'FOLDER', label: 'Folders' },
  { value: 'DOCUMENT', label: 'Documents' },
  { value: 'SPREADSHEET', label: 'Spreadsheets' },
  { value: 'FORM', label: 'Forms' },
  { value: 'PDF', label: 'PDFs' },
  { value: 'IMAGE', label: 'Photos & images' },
  { value: 'VIDEO', label: 'Videos' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'TEXT', label: 'Text files' },
  { value: 'ARCHIVE', label: 'Archives (zip)' },
];

const MODIFIED_FILTERS: { value: ModifiedPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'year', label: `This year (${new Date().getFullYear()})` },
  { value: 'lastYear', label: `Last year (${new Date().getFullYear() - 1})` },
];

/** A filter chip: outlined when unset, filled with a clear button when set. */
function FilterChip({ label, active, children, onClear }: { label: string; active: boolean; children: ReactNode; onClear(): void }) {
  return (
    <div className={cn('flex h-8 items-center rounded-lg border text-sm', active ? 'border-transparent bg-[#c2e7ff] text-[#001d35]' : 'border-border-strong/60 text-foreground')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn('flex h-full items-center gap-1 rounded-lg px-3 font-medium hover:bg-black/5', active && 'pr-1.5')}>
            {label}
            {!active && <ChevronDown className="size-4 text-muted" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 min-w-56 overflow-y-auto">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && (
        <button onClick={onClear} className="mr-1 rounded-full p-1 hover:bg-black/10" aria-label={`Clear ${label} filter`}>
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function PeopleFilter({ sort, onSort, allowMine }: { sort: SortState; onSort(s: SortState): void; allowMine: boolean }) {
  const [open, setOpen] = useState(false);
  const people = usePeople(open || !!sort.person);
  const person = people.data?.find((p) => p.id === sort.person);
  const label = sort.owner === 'me' ? 'Owned by me' : sort.owner === 'not_me' ? 'Not owned by me' : sort.person ? (person?.name ?? 'Person') : 'People';
  const set = (patch: Pick<SortState, 'owner' | 'person'>) => onSort({ ...sort, owner: undefined, person: undefined, ...patch });
  return (
    <div onPointerDown={() => setOpen(true)} onFocus={() => setOpen(true)}>
      <FilterChip label={label} active={!!(sort.owner || sort.person)} onClear={() => set({})}>
        {allowMine && (
          <>
            <DropdownMenuItem icon={sort.owner === 'me' ? <Check /> : <span />} onSelect={() => set({ owner: 'me' })}>
              Owned by me
            </DropdownMenuItem>
            <DropdownMenuItem icon={sort.owner === 'not_me' ? <Check /> : <span />} onSelect={() => set({ owner: 'not_me' })}>
              Not owned by me
            </DropdownMenuItem>
          </>
        )}
        {(people.data?.length ?? 0) > 0 && (
          <>
            {allowMine && <DropdownMenuSeparator />}
            <DropdownMenuLabel>People you share with</DropdownMenuLabel>
            {people.data!.map((p) => (
              <DropdownMenuItem key={p.id} icon={<Avatar user={p} size={20} />} onSelect={() => set({ person: p.id })}>
                <span className="flex flex-col">
                  <span>{p.name}</span>
                  <span className="text-xs text-muted">{p.email}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}
        {people.isLoading && <p className="px-3 py-2 text-xs text-muted">Loading people…</p>}
        {people.isSuccess && people.data.length === 0 && !allowMine && <p className="px-3 py-2 text-xs text-muted">You don’t share with anyone yet.</p>}
      </FilterChip>
    </div>
  );
}

function Toolbar({
  title,
  sort,
  onSort,
  showSort = true,
  showPeople = true,
  peopleOnly = false,
  extra,
  infoOpen,
  onInfo,
}: {
  title: ReactNode;
  sort: SortState;
  onSort(s: SortState): void;
  showSort?: boolean;
  showPeople?: boolean;
  /** Only other people's items are listed, so "Owned by me" makes no sense. */
  peopleOnly?: boolean;
  extra?: ReactNode;
  infoOpen: boolean;
  onInfo(): void;
}) {
  const { viewMode: mode, setViewMode: onMode } = useDrivePrefs();
  const activity = useActivityPanel();
  const filtered = !!(sort.type || sort.owner || sort.person || sort.modified);
  return (
    <div className="px-4 pt-3">
      <div className="flex min-h-12 flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 text-[22px]">{title}</div>
        {extra}
        <div className="flex items-center rounded-full border border-border" role="group" aria-label="View">
          <Tooltip content="List layout (V)">
            <button className={cn('flex h-8 w-12 items-center justify-center rounded-l-full', mode === 'list' && 'bg-selected')} onClick={() => onMode('list')} aria-pressed={mode === 'list'} aria-label="List layout">
              <List className="size-[18px]" />
            </button>
          </Tooltip>
          <Tooltip content="Grid layout (V)">
            <button className={cn('flex h-8 w-12 items-center justify-center rounded-r-full', mode === 'grid' && 'bg-selected')} onClick={() => onMode('grid')} aria-pressed={mode === 'grid'} aria-label="Grid layout">
              <Grid2x2 className="size-[18px]" />
            </button>
          </Tooltip>
        </div>
        <Tooltip content="Activity (Shift+A)">
          <Button variant="subtle" size="icon-sm" onClick={activity.toggle} aria-pressed={activity.open} aria-label="Activity" className={cn(activity.open && 'bg-selected')}>
            <History />
          </Button>
        </Tooltip>
        <Tooltip content="View details (I)">
          <Button variant="subtle" size="icon-sm" onClick={onInfo} aria-pressed={infoOpen} aria-label="View details" className={cn(infoOpen && 'bg-selected')}>
            <Info />
          </Button>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center gap-2 py-3">
        <FilterChip label={TYPE_FILTERS.find((t) => t.value === sort.type)?.label ?? 'Type'} active={!!sort.type} onClear={() => onSort({ ...sort, type: undefined })}>
          {TYPE_FILTERS.map((t) => (
            <DropdownMenuCheckboxItem key={t.value} checked={sort.type === t.value} onCheckedChange={(c) => onSort({ ...sort, type: c ? t.value : undefined })}>
              {t.label}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterChip>
        {showPeople && <PeopleFilter sort={sort} onSort={onSort} allowMine={!peopleOnly} />}
        <FilterChip label={MODIFIED_FILTERS.find((m) => m.value === sort.modified)?.label ?? 'Modified'} active={!!sort.modified} onClear={() => onSort({ ...sort, modified: undefined })}>
          {MODIFIED_FILTERS.map((m) => (
            <DropdownMenuCheckboxItem key={m.value} checked={sort.modified === m.value} onCheckedChange={(c) => onSort({ ...sort, modified: c ? m.value : undefined })}>
              {m.label}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterChip>
        {filtered && (
          <button onClick={() => onSort({ ...sort, type: undefined, owner: undefined, person: undefined, modified: undefined })} className="rounded-full px-2 py-1 text-sm font-medium text-primary hover:bg-primary-soft">
            Clear filters
          </button>
        )}
        {showSort && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto rounded-lg text-foreground">
                <ArrowDownUp /> {{ name: 'Name', updatedAt: 'Last modified', createdAt: 'Created', size: 'File size' }[sort.sort ?? 'name']}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {(['name', 'updatedAt', 'createdAt', 'size'] as const).map((s) => (
                <DropdownMenuCheckboxItem key={s} checked={(sort.sort ?? 'name') === s} onCheckedChange={() => onSort({ ...sort, sort: s, order: s === 'name' ? 'asc' : 'desc' })}>
                  {{ name: 'Name', updatedAt: 'Last modified', createdAt: 'Created', size: 'File size' }[s]}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Order</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={(sort.order ?? 'asc') === 'asc'} onCheckedChange={() => onSort({ ...sort, order: 'asc' })}>
                {sort.sort === 'name' || !sort.sort ? 'A to Z' : 'Oldest first'}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={sort.order === 'desc'} onCheckedChange={() => onSort({ ...sort, order: 'desc' })}>
                {sort.sort === 'name' || !sort.sort ? 'Z to A' : 'Newest first'}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

/** Breadcrumb segment that also accepts drops (move into that folder). */
function Crumb({ folder, last }: { folder: FolderRef; last: boolean }) {
  const move = useMoveItems();
  const uploads = useTransfers();
  const [over, setOver] = useState(false);
  return (
    <Link
      to="/drive/folder/$folderId"
      params={{ folderId: folder.id }}
      className={cn('truncate rounded-full px-3 py-1 hover:bg-hover', last ? 'text-foreground' : 'text-muted', over && 'bg-primary-soft ring-2 ring-primary')}
      aria-current={last ? 'page' : undefined}
      onDragOver={(e: DragEvent) => {
        if (!last && (hasQubItems(e) || hasFiles(e))) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const items = readDragItems(e);
        if (items) move.mutate({ items, folderId: folder.id, folderName: folder.name });
        else if (e.dataTransfer.files.length) uploads.uploadDrop(e.dataTransfer, folder.id);
      }}
    >
      {folder.name}
    </Link>
  );
}

function Breadcrumbs({ path, loading }: { path: FolderRef[] | undefined; loading: boolean }) {
  if (loading) return <Skeleton className="h-7 w-64" />;
  if (!path?.length) return <span>My Drive</span>;
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center">
      {path.map((f, i) => (
        <span key={f.id} className="flex min-w-0 items-center">
          {i > 0 && <ChevronRight className="size-5 shrink-0 text-subtle" />}
          <Crumb folder={f} last={i === path.length - 1} />
        </span>
      ))}
    </nav>
  );
}

type ListingSearch = SortState & { preview?: string };

/** Sort, filter and preview state lives in the URL so views are linkable and survive reloads. */
function useListingSearch(): [ListingSearch, (s: Partial<ListingSearch>, replace?: boolean) => void] {
  const search = useSearch({ strict: false }) as ListingSearch;
  const navigate = useNavigate();
  return [
    { sort: search.sort, order: search.order, type: search.type, owner: search.owner, person: search.person, modified: search.modified, preview: search.preview },
    (s, replace = true) => void navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...prev, ...s }), replace } as never),
  ];
}

/** Layout shared by every Drive listing: toolbar, items, the optional details panel and the file viewer. */
function Listing({
  title,
  items,
  query,
  empty,
  dropFolderId,
  showSort,
  showPeople,
  peopleOnly,
  dateColumn,
  showLocation,
  extra,
  folderItem,
  header,
}: {
  title: ReactNode;
  items: DriveItemDto[];
  query: { isLoading: boolean; error: unknown; refetch(): unknown; hasNextPage?: boolean; fetchNextPage(): unknown; isFetchingNextPage: boolean };
  empty: ReactNode;
  dropFolderId?: string;
  showSort?: boolean;
  showPeople?: boolean;
  peopleOnly?: boolean;
  dateColumn?: { label: string; value(item: DriveItemDto): string | null | undefined };
  showLocation?: boolean;
  extra?: ReactNode;
  folderItem?: DriveItemDto;
  header?: ReactNode;
}) {
  const { viewMode: mode, setViewMode } = useDrivePrefs();
  const [search, setSearch] = useListingSearch();
  const actions = useItemActions();
  const [infoOpen, setInfoOpen] = useState(false);
  // Prefer the listing's copy so the panel reflects renames, stars and moves as soon as the list refreshes.
  const shown = actions.detailsItem && (items.find((i) => i.kind === actions.detailsItem!.kind && i.id === actions.detailsItem!.id) ?? actions.detailsItem);
  const detailsTarget = shown ?? (infoOpen ? folderItem : undefined);
  // Clicking a file shows its information; clicking a folder or empty space (or selecting several) hides it. On
  // small screens the panel covers the list, so a click only switches it to another file once it's open.
  const onSelectionChange = (selection: DriveItemDto[]) => {
    const file = selection.length === 1 && selection[0]!.kind === 'file' ? selection[0]! : null;
    if (file) {
      if (actions.detailsItem || window.matchMedia('(min-width: 1024px)').matches) actions.details(file);
      return;
    }
    actions.details(null);
    setInfoOpen(false);
  };
  const filtered = !!(search.type || search.owner || search.person || search.modified);
  const toggleInfo = () => (detailsTarget ? (actions.details(null), setInfoOpen(false)) : setInfoOpen(true));

  // "V" switches layout and "I" toggles details, from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || search.preview) return;
      if (e.key === 'v' || e.key === 'V') setViewMode(mode === 'list' ? 'grid' : 'list');
      else if (e.key === 'i' && !e.shiftKey) toggleInfo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar title={title} sort={search} onSort={(s) => setSearch(s)} showSort={showSort} showPeople={showPeople} peopleOnly={peopleOnly} extra={extra} infoOpen={!!detailsTarget} onInfo={toggleInfo} />
        <ItemsView
          items={items}
          mode={mode}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          hasMore={query.hasNextPage}
          loadMore={() => void query.fetchNextPage()}
          loadingMore={query.isFetchingNextPage}
          dropFolderId={dropFolderId}
          empty={
            filtered ? (
              <EmptyState icon={<SearchX />} title="Nothing matches these filters" description="Try another type, person or date, or clear the filters." />
            ) : (
              empty
            )
          }
          dateColumn={dateColumn}
          showLocation={showLocation}
          header={header}
          onSelectionChange={onSelectionChange}
        />
      </div>
      {detailsTarget && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/30 lg:static lg:bg-transparent">
          <DetailsPanel
            item={detailsTarget}
            onClose={() => {
              actions.details(null);
              setInfoOpen(false);
            }}
          />
        </div>
      )}
      <ListingPreview items={items} previewId={search.preview} onChange={(preview) => setSearch({ preview }, !!search.preview && !!preview)} />
    </div>
  );
}

function FolderListing({ folderId }: { folderId?: string }) {
  const [sort] = useListingSearch();
  const { showSuggested } = useDrivePrefs();
  const folder = useDriveFolders(folderId);
  const files = useDriveFiles(folderId ?? folder.data?.id, sort);
  const items = flattenPages(files.data);
  const effectiveFolder = files.data?.pages[0] && 'folder' in files.data.pages[0] ? files.data.pages[0].folder : folder.data;
  const filtered = !!(sort.type || sort.owner || sort.person || sort.modified);
  return (
    <Listing
      title={<Breadcrumbs path={effectiveFolder?.path} loading={folder.isLoading && !effectiveFolder} />}
      items={items}
      query={files}
      dropFolderId={effectiveFolder?.capabilities.canEdit ? effectiveFolder.id : undefined}
      folderItem={effectiveFolder ?? undefined}
      header={!folderId && showSuggested && !filtered ? <SuggestedSection /> : undefined}
      empty={
        <EmptyState
          icon={<FolderOpen />}
          title={folderId ? 'This folder is empty' : 'Welcome to Drive'}
          description={folderId ? 'Drop files or folders here, or use the “New” button.' : 'Create documents, spreadsheets and forms, or drag files and folders here to upload them.'}
        />
      }
    />
  );
}

export function MyDrivePage() {
  return (
    <ItemActionsProvider inlinePreview>
      <FolderListing />
    </ItemActionsProvider>
  );
}

export function FolderPage() {
  const { folderId } = useParams({ from: '/_authenticated/drive/folder/$folderId' });
  return (
    <ItemActionsProvider key={folderId} inlinePreview>
      <FolderListing folderId={folderId} />
    </ItemActionsProvider>
  );
}

export function SharedPage() {
  const [sort] = useListingSearch();
  const q = useSharedFiles(sort);
  return (
    <ItemActionsProvider inlinePreview>
      <Listing
        title="Shared with me"
        items={flattenPages(q.data)}
        query={q}
        peopleOnly
        showLocation={false}
        empty={<EmptyState icon={<Users />} title="Nothing shared with you yet" description="Files and folders others share with you will appear here." />}
      />
    </ItemActionsProvider>
  );
}

export function RecentPage() {
  const [sort] = useListingSearch();
  const q = useRecentFiles(sort);
  return (
    <ItemActionsProvider inlinePreview>
      <Listing
        title="Recent"
        items={flattenPages(q.data)}
        query={q}
        showSort={false}
        showLocation
        dateColumn={{ label: 'Last opened by me', value: (i) => (i.kind === 'file' ? i.lastOpenedAt : null) }}
        empty={<EmptyState icon={<Clock />} title="No recent files" description="Files you open, edit or upload will show up here." />}
      />
    </ItemActionsProvider>
  );
}

export function StarredPage() {
  const [sort] = useListingSearch();
  const q = useStarredFiles(sort);
  return (
    <ItemActionsProvider inlinePreview>
      <Listing
        title="Starred"
        items={flattenPages(q.data)}
        query={q}
        showLocation
        empty={<EmptyState icon={<Star />} title="No starred files" description="Add stars to things you want to find easily later." />}
      />
    </ItemActionsProvider>
  );
}

export function SpamPage() {
  const [sort] = useListingSearch();
  const q = useSpamFiles(sort);
  const empty = useEmptySpam();
  const [confirm, setConfirm] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const items = flattenPages(q.data);
  return (
    <ItemActionsProvider inlinePreview>
      <Listing
        title="Spam"
        items={items}
        query={q}
        peopleOnly
        showLocation={false}
        dateColumn={{ label: 'Last modified', value: (i) => i.updatedAt }}
        extra={
          <>
            <Button variant="subtle" size="sm" onClick={() => setBlockedOpen(true)}>
              <Ban /> Blocked people
            </Button>
            {items.length > 0 && (
              <Button variant="subtle" size="sm" onClick={() => setConfirm(true)}>
                <Trash2 /> Delete all spam
              </Button>
            )}
          </>
        }
        header={
          items.length > 0 ? (
            <p className="mb-2 flex items-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm text-muted">
              <OctagonAlert className="size-4 shrink-0" />
              Items shared with you that you reported. They’re hidden everywhere else and removed from your Drive after {SPAM_RETENTION_DAYS} days.
            </p>
          ) : undefined
        }
        empty={<EmptyState icon={<OctagonAlert />} title="No spam" description="Items shared with you that you report as spam — or that come from people you block — show up here." />}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete all spam?"
        description="You’ll lose access to everything in Spam. The owners’ copies aren’t affected."
        confirmLabel="Delete all"
        destructive
        loading={empty.isPending}
        onConfirm={() => empty.mutate(undefined, { onSettled: () => setConfirm(false) })}
      />
      <BlockedPeopleDialog open={blockedOpen} onOpenChange={setBlockedOpen} />
    </ItemActionsProvider>
  );
}

export function TrashPage() {
  const search = useSearch({ from: '/_authenticated/drive/trash' });
  const [sort] = useListingSearch();
  const q = useTrashFiles(sort);
  const inside = useTrashedFolder(search.folder);
  const empty = useEmptyTrash();
  const [confirm, setConfirm] = useState(false);
  const listing = search.folder ? inside : q;
  return (
    <ItemActionsProvider>
      <Listing
        title={
          search.folder ? (
            <span className="flex items-center gap-1">
              <Link to="/drive/trash" className="rounded-full px-3 py-1 text-muted hover:bg-hover">
                Trash
              </Link>
              <ChevronRight className="size-5 text-subtle" /> <span className="px-3">Folder contents</span>
            </span>
          ) : (
            'Trash'
          )
        }
        items={flattenPages(listing.data)}
        query={listing}
        showSort={!search.folder}
        // Only your own items are in your trash.
        showPeople={false}
        dateColumn={{ label: 'Trashed', value: (i) => i.trashedAt }}
        showLocation
        extra={
          !search.folder && flattenPages(q.data).length > 0 ? (
            <Button variant="subtle" size="sm" onClick={() => setConfirm(true)}>
              <Trash2 /> Empty trash
            </Button>
          ) : undefined
        }
        empty={<EmptyState icon={<Trash2 />} title="Nothing in trash" description="Move items you don’t need to the trash. Trashed items are deleted forever after the retention period." />}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Empty trash?"
        description="All items in the trash will be deleted forever and you won’t be able to restore them."
        confirmLabel="Empty trash"
        destructive
        loading={empty.isPending}
        onConfirm={() => empty.mutate(undefined, { onSettled: () => setConfirm(false) })}
      />
    </ItemActionsProvider>
  );
}
