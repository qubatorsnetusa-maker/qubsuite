import { prefetchItemResource } from '@/services/prefetch';
import { useQueryClient } from '@tanstack/react-query';
import type { DriveItemDto } from '@qub/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MoreVertical, Star, Users, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { FileIcon, FILE_TYPE_LABEL } from '@/components/file-icon';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { Avatar, Skeleton, Tooltip } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { cn, formatBytes, formatRelative } from '@/lib/utils';
import { hasFiles, hasQubItems, readDragItems, setDragItems } from './dnd';
import { useDrivePrefs } from './drive-prefs';
import { FileThumbnail } from './file-thumbnail';
import { isPreviewable, menuEntries, useItemActions, type MenuEntry } from './item-actions';
import { useMoveItems } from './queries';
import { useTransfers } from './transfer-manager';

export type ViewMode = 'grid' | 'list';

interface ItemsViewProps {
  items: DriveItemDto[];
  mode: ViewMode;
  isLoading: boolean;
  error: unknown;
  onRetry(): void;
  hasMore?: boolean;
  loadMore?(): void;
  loadingMore?: boolean;
  /** Folder that receives external file drops on the background. */
  dropFolderId?: string;
  empty: ReactNode;
  /** Extra list column (e.g. "Shared", "Trashed", "Opened"). */
  dateColumn?: { label: string; value(item: DriveItemDto): string | null | undefined };
  showLocation?: boolean;
  /** Scrolls with the items, above them (e.g. My Drive's Suggested row). */
  header?: ReactNode;
  /** Called when the user changes the selection (click, keyboard, clearing it), not when the list refreshes. */
  onSelectionChange?(selection: DriveItemDto[]): void;
}

function renderEntries(entries: MenuEntry[], Item: typeof DropdownMenuItem | typeof ContextMenuItem, Separator: () => ReactNode) {
  return entries.map((e) => (
    <Fragment key={e.key}>
      {e.separatorBefore && <Separator />}
      <Item icon={e.icon} onSelect={e.onSelect} destructive={e.destructive} shortcut={e.shortcut}>
        {e.label}
      </Item>
    </Fragment>
  ));
}

function ownerLabel(item: DriveItemDto, meId: string) {
  return item.owner.id === meId ? 'me' : item.owner.name;
}

/** Grid/list of Drive items with multi-select, keyboard navigation, context menus and drag & drop. */
export function ItemsView(props: ItemsViewProps) {
  const { items, mode, isLoading, error, onRetry } = props;
  const me = useCurrentUser();
  const actions = useItemActions();
  const qc = useQueryClient();
  const { density } = useDrivePrefs();
  const uploads = useTransfers();
  const move = useMoveItems();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [bgDrop, setBgDrop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const keyOf = (i: DriveItemDto) => `${i.kind}:${i.id}`;
  const selection = useMemo(() => items.filter((i) => selected.has(keyOf(i))), [items, selected]);

  // Drop stale selections when the list changes.
  useEffect(() => {
    setSelected((prev) => {
      const keys = new Set(items.map(keyOf));
      const next = new Set([...prev].filter((k) => keys.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const selectionKey = [...selected].sort().join('|');
  const reportedKey = useRef(selectionKey);
  const { onSelectionChange } = props;
  useEffect(() => {
    if (reportedKey.current === selectionKey) return;
    reportedKey.current = selectionKey;
    onSelectionChange?.(selection);
    // Keyed on the selected ids: refetched item objects for the same selection aren't a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  // Infinite scroll.
  const { hasMore, loadMore, loadingMore } = props;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loadingMore) loadMore?.();
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, loadingMore]);

  const select = useCallback(
    (index: number, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      const item = items[index];
      if (!item) return;
      setFocus(index);
      if (e.shiftKey && anchor !== null) {
        const [a, b] = [Math.min(anchor, index), Math.max(anchor, index)];
        setSelected(new Set(items.slice(a, b + 1).map(keyOf)));
      } else if (e.metaKey || e.ctrlKey) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(keyOf(item))) next.delete(keyOf(item));
          else next.add(keyOf(item));
          return next;
        });
        setAnchor(index);
      } else {
        setSelected(new Set([keyOf(item)]));
        setAnchor(index);
      }
    },
    [items, anchor],
  );

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, [role="menu"], [role="dialog"]')) return;
    const cols = mode === 'grid' ? Math.max(1, Math.floor((containerRef.current?.clientWidth ?? 800) / (density === 'compact' ? 196 : 236))) : 1;
    const one = selection.length === 1 ? selection[0]! : null;
    // Single-key shortcuts (listed in the keyboard shortcuts dialog).
    if (!e.ctrlKey && !e.metaKey && !e.altKey && selection.length) {
      const key = e.key.toLowerCase();
      const run = (fn: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };
      if ((key === 'p' || key === ' ') && one && isPreviewable(one)) return run(() => actions.preview(one));
      if (key === 'i' && !e.shiftKey && one) return run(() => actions.details(actions.detailsItem?.id === one.id ? null : one));
      if (key === 'n' && one?.capabilities.canEdit && !one.isTrashed) return run(() => actions.rename(one));
      if (key === '.' && one?.capabilities.canShare && !one.isTrashed) return run(() => actions.share(one));
      if (key === 'z' && selection.every((i) => i.capabilities.canEdit && !i.isTrashed)) return run(() => actions.move(selection));
      if (key === 's' && selection.every((i) => !i.isTrashed)) return run(() => actions.star(selection, !selection.every((i) => i.isStarred)));
      if (key === '#' && selection.every((i) => i.capabilities.canTrash && !i.isTrashed)) return run(() => actions.trash(selection));
    }
    const move = (delta: number) => {
      e.preventDefault();
      const next = Math.max(0, Math.min(items.length - 1, focus + delta));
      select(next, { shiftKey: e.shiftKey, metaKey: false, ctrlKey: false });
      containerRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus();
    };
    switch (e.key) {
      case 'ArrowDown':
        return move(cols);
      case 'ArrowUp':
        return move(-cols);
      case 'ArrowRight':
        return mode === 'grid' ? move(1) : undefined;
      case 'ArrowLeft':
        return mode === 'grid' ? move(-1) : undefined;
      case 'Enter':
        if (selection.length === 1) actions.open(selection[0]!);
        return;
      case 'Delete':
        if (selection.length && selection.every((i) => i.capabilities.canTrash && !i.isTrashed)) actions.trash(selection);
        return;
      case 'F2':
        if (selection.length === 1 && selection[0]!.capabilities.canEdit) {
          e.preventDefault();
          actions.rename(selection[0]!);
        }
        return;
      case 'Escape':
        setSelected(new Set());
        return;
      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setSelected(new Set(items.map(keyOf)));
        }
        return;
    }
  };

  // ---------- drag & drop ----------
  const onItemDragStart = (e: DragEvent, item: DriveItemDto) => {
    const dragging = selected.has(keyOf(item)) ? selection : [item];
    if (!dragging.every((i) => i.capabilities.canEdit)) {
      e.preventDefault();
      return;
    }
    setDragItems(e, dragging.map((i) => ({ kind: i.kind, id: i.id, name: i.name })));
  };
  const folderDropProps = (item: DriveItemDto) =>
    item.kind === 'folder' && !item.isTrashed && item.capabilities.canEdit
      ? {
          onDragOver: (e: DragEvent) => {
            if (hasQubItems(e) || hasFiles(e)) {
              e.preventDefault();
              e.stopPropagation();
              setDropTarget(item.id);
            }
          },
          onDragLeave: () => setDropTarget((t) => (t === item.id ? null : t)),
          onDrop: (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setDropTarget(null);
            setBgDrop(false);
            const dragged = readDragItems(e)?.filter((d) => d.id !== item.id);
            if (dragged?.length) move.mutate({ items: dragged, folderId: item.id, folderName: item.name });
            else if (e.dataTransfer.files.length) uploads.uploadDrop(e.dataTransfer, item.id);
          },
        }
      : {};

  const bgDropProps = props.dropFolderId
    ? {
        onDragOver: (e: DragEvent) => {
          if (hasFiles(e)) {
            e.preventDefault();
            setBgDrop(true);
          }
        },
        onDragLeave: (e: DragEvent) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setBgDrop(false);
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setBgDrop(false);
          if (e.dataTransfer.files.length) uploads.uploadDrop(e.dataTransfer, props.dropFolderId);
        },
      }
    : {};

  // A double-click opens what its first click selected. The first click can open the details panel, which narrows
  // the list and reflows the grid, so the second click may land on another card or on empty space.
  const firstClick = useRef<DriveItemDto | null>(null);
  const onBackgroundClick = (e: MouseEvent) => {
    if (e.detail >= 2 && firstClick.current) return;
    firstClick.current = null;
    setSelected(new Set());
  };
  const onBackgroundDoubleClick = () => {
    if (firstClick.current) actions.open(firstClick.current);
  };

  const itemHandlers = (item: DriveItemDto, index: number) => ({
    'data-index': index,
    onMouseEnter: () => prefetchItemResource(qc, item),
    onFocus: () => prefetchItemResource(qc, item),
    tabIndex: index === focus ? 0 : -1,
    'aria-selected': selected.has(keyOf(item)),
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      if (e.detail >= 2 && firstClick.current) return;
      firstClick.current = item;
      select(index, e);
    },
    onContextMenu: () => {
      if (!selected.has(keyOf(item))) select(index, { shiftKey: false, metaKey: false, ctrlKey: false });
    },
    draggable: !item.isTrashed,
    onDragStart: (e: DragEvent) => onItemDragStart(e, item),
    ...folderDropProps(item),
  });

  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  const contextEntries = menuEntries(actions, selection);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" {...bgDropProps}>
      {selection.length > 0 && (
        // Overlays the filter row above the list rather than pushing the list down: a layout shift between the two
        // clicks of a double-click would open whichever row slid under the pointer.
        <div className="absolute inset-x-4 bottom-full z-10 mb-1 flex h-12 items-center gap-1 rounded-full bg-[#e9eef6] px-2" role="toolbar" aria-label="Selection actions">
          <Button variant="subtle" size="icon-sm" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X />
          </Button>
          <span className="mr-2 text-sm">{selection.length} selected</span>
          {contextEntries.filter((e) => ['share', 'download', 'move', 'trash', 'restore', 'delete'].includes(e.key)).map((e) => (
            <Tooltip key={e.key} content={e.label}>
              <Button variant="subtle" size="icon-sm" onClick={e.onSelect} aria-label={e.label}>
                {e.icon}
              </Button>
            </Tooltip>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="subtle" size="icon-sm" aria-label="More actions">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">{renderEntries(contextEntries, DropdownMenuItem, DropdownMenuSeparator)}</DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild disabled={!selection.length}>
          <div
            ref={containerRef}
            className={cn('relative min-h-0 flex-1 overflow-y-auto px-4 pb-6 outline-none', bgDrop && 'bg-primary-soft/40 ring-2 ring-inset ring-primary')}
            onKeyDown={onKeyDown}
            onClick={onBackgroundClick}
            onDoubleClick={onBackgroundDoubleClick}
            role={mode === 'grid' ? 'grid' : 'grid'}
            aria-label="Files and folders"
            aria-multiselectable
          >
            {props.header}
            {isLoading ? (
              <LoadingSkeleton mode={mode} />
            ) : items.length === 0 ? (
              props.empty
            ) : mode === 'grid' ? (
              <GridView items={items} selected={selected} keyOf={keyOf} handlers={itemHandlers} dropTarget={dropTarget} meId={me.id} compact={density === 'compact'} />
            ) : (
              <ListView
                items={items}
                selected={selected}
                keyOf={keyOf}
                handlers={itemHandlers}
                dropTarget={dropTarget}
                meId={me.id}
                scrollRef={containerRef}
                dateColumn={props.dateColumn}
                showLocation={props.showLocation}
                rowHeight={density === 'compact' ? 36 : 48}
              />
            )}
            <div ref={sentinelRef} className="h-px" />
            {loadingMore && <p className="py-4 text-center text-sm text-muted">Loading more…</p>}
            {bgDrop && (
              <div className="pointer-events-none sticky bottom-6 mx-auto w-fit rounded-full bg-primary px-5 py-2 text-sm text-white shadow-pop">Drop files to upload them here</div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>{renderEntries(contextEntries, ContextMenuItem, ContextMenuSeparator)}</ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

type Handlers = (item: DriveItemDto, index: number) => Record<string, unknown>;

export function ItemMenuButton({ item }: { item: DriveItemDto }) {
  const actions = useItemActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} className="rounded-full p-1.5 text-muted opacity-70 hover:bg-black/5 hover:opacity-100" aria-label={`Actions for ${item.name}`}>
          <MoreVertical className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{renderEntries(menuEntries(actions, [item]), DropdownMenuItem, DropdownMenuSeparator)}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function GridView({
  items,
  selected,
  keyOf,
  handlers,
  dropTarget,
  meId,
  compact,
}: {
  items: DriveItemDto[];
  selected: Set<string>;
  keyOf(i: DriveItemDto): string;
  handlers: Handlers;
  dropTarget: string | null;
  meId: string;
  compact: boolean;
}) {
  const folders = items.map((item, index) => ({ item, index })).filter((x) => x.item.kind === 'folder');
  const files = items.map((item, index) => ({ item, index })).filter((x) => x.item.kind === 'file');
  const cardBase = 'group relative cursor-default rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary';
  const grid = cn('grid', compact ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5' : 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4');
  return (
    <div className={cn('pt-2', compact ? 'space-y-4' : 'space-y-6')}>
      {folders.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-foreground">Folders</h2>
          <div className={grid} role="rowgroup">
            {folders.map(({ item, index }) => (
              <div
                key={keyOf(item)}
                role="gridcell"
                {...handlers(item, index)}
                className={cn(cardBase, 'flex items-center gap-3 bg-surface-2 pl-4 pr-1 hover:bg-[#e1e5ea]', compact ? 'h-10' : 'h-12', selected.has(keyOf(item)) && 'bg-selected hover:bg-selected', dropTarget === item.id && 'ring-2 ring-primary')}
              >
                <FileIcon type="FOLDER" size={22} shared={item.owner.id !== meId} />
                <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
                {item.isStarred && <Star className="size-4 fill-muted text-muted" aria-label="Starred" />}
                <ItemMenuButton item={item} />
              </div>
            ))}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-foreground">Files</h2>
          <div className={grid} role="rowgroup">
            {files.map(({ item, index }) => (
              <div
                key={keyOf(item)}
                role="gridcell"
                {...handlers(item, index)}
                className={cn(cardBase, 'flex flex-col bg-surface-2 p-2 pt-0 hover:bg-[#e1e5ea]', selected.has(keyOf(item)) && 'bg-selected hover:bg-selected')}
              >
                <div className={cn('flex items-center gap-3 px-2', compact ? 'h-10' : 'h-12')}>
                  <FileIcon type={item.kind === 'file' ? item.fileType : 'FOLDER'} size={20} />
                  <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
                  <ItemMenuButton item={item} />
                </div>
                <div className={cn('overflow-hidden rounded-lg bg-background', compact ? 'aspect-[16/10]' : 'aspect-[4/3]')}>
                  <FileThumbnail item={item} />
                </div>
                <div className="flex items-center gap-2 px-2 pt-2 text-xs text-muted">
                  <Avatar user={item.owner} size={20} />
                  <span className="truncate">
                    {item.owner.id === meId ? 'You' : item.owner.name} · {formatRelative(item.updatedAt)}
                  </span>
                  {item.isStarred && <Star className="ml-auto size-3.5 fill-muted text-muted" aria-label="Starred" />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ListView({
  items,
  selected,
  keyOf,
  handlers,
  dropTarget,
  meId,
  scrollRef,
  dateColumn,
  showLocation,
  rowHeight,
}: {
  items: DriveItemDto[];
  selected: Set<string>;
  keyOf(i: DriveItemDto): string;
  handlers: Handlers;
  dropTarget: string | null;
  meId: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  dateColumn?: ItemsViewProps['dateColumn'];
  showLocation?: boolean;
  rowHeight: number;
}) {
  // Rows are virtualized: only visible rows are rendered, however large the folder. Content above the table (the
  // Suggested row) is accounted for with a scroll margin.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setMargin(el.offsetTop);
    measure();
    const ro = new ResizeObserver(measure);
    if (el.parentElement?.parentElement) ro.observe(el.parentElement.parentElement);
    return () => ro.disconnect();
  }, []);
  const virtualizer = useVirtualizer({ count: items.length, getScrollElement: () => scrollRef.current, estimateSize: () => rowHeight, overscan: 12, scrollMargin: margin });
  useEffect(() => virtualizer.measure(), [rowHeight, virtualizer]);
  const cols = 'grid grid-cols-[minmax(0,1fr)_120px] md:grid-cols-[minmax(0,1fr)_160px_170px_100px_48px]';
  return (
    <div role="table" aria-label="Files" aria-rowcount={items.length}>
      <div role="row" className={cn(cols, 'sticky top-0 z-10 items-center border-b border-border bg-background text-sm font-medium text-foreground', rowHeight < 48 ? 'h-10' : 'h-12')}>
        <span role="columnheader" className="pl-3">Name</span>
        <span role="columnheader" className="hidden md:block">Owner</span>
        <span role="columnheader">{dateColumn?.label ?? 'Last modified'}</span>
        <span role="columnheader" className="hidden md:block">{showLocation ? 'Location' : 'File size'}</span>
        <span className="hidden md:block" />
      </div>
      <div ref={bodyRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index]!;
          return (
            <div
              key={keyOf(item)}
              role="row"
              {...handlers(item, row.index)}
              className={cn(
                cols,
                'absolute inset-x-0 items-center border-b border-border text-sm outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                selected.has(keyOf(item)) && 'bg-selected hover:bg-selected',
                dropTarget === item.id && 'ring-2 ring-inset ring-primary',
              )}
              style={{ height: rowHeight, transform: `translateY(${row.start - margin}px)` }}
            >
              <span role="cell" className="flex min-w-0 items-center gap-3 pl-3">
                <FileIcon type={item.kind === 'folder' ? 'FOLDER' : item.fileType} size={rowHeight < 48 ? 18 : 22} shared={item.kind === 'folder' && item.owner.id !== meId} />
                <span className="truncate">{item.name}</span>
                {item.owner.id !== meId && <Users className="size-4 shrink-0 text-subtle" aria-label="Shared" />}
                {item.isStarred && <Star className="size-4 shrink-0 fill-muted text-muted" aria-label="Starred" />}
              </span>
              <span role="cell" className="hidden min-w-0 items-center gap-2 md:flex">
                <Avatar user={item.owner} size={24} />
                <span className="truncate text-muted">{ownerLabel(item, meId)}</span>
              </span>
              <span role="cell" className="truncate text-muted">
                {formatRelative(dateColumn ? (dateColumn.value(item) ?? item.updatedAt) : item.updatedAt)}
              </span>
              <span role="cell" className="hidden truncate text-muted md:block">
                {showLocation
                  ? item.kind === 'file'
                    ? item.folderName ?? '—'
                    : item.parentName ?? '—'
                  : item.kind === 'file'
                    ? ['DOCUMENT', 'SPREADSHEET', 'FORM'].includes(item.fileType)
                      ? FILE_TYPE_LABEL[item.fileType]
                      : formatBytes(item.size)
                    : '—'}
              </span>
              <span role="cell" className="hidden md:block">
                <ItemMenuButton item={item} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingSkeleton({ mode }: { mode: ViewMode }) {
  if (mode === 'list')
    return (
      <div className="space-y-0 pt-12" aria-label="Loading files">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex h-12 items-center gap-3 border-b border-border px-3">
            <Skeleton className="size-6" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    );
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 pt-10" aria-label="Loading files">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-52 rounded-xl" />
      ))}
    </div>
  );
}
