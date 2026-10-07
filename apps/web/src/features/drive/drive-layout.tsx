import type { SearchResultDto } from '@qub/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Clock, Cloud, FileCheck2, FileUp, FolderPlus, FolderUp, HardDrive, Keyboard, Menu, OctagonAlert, Plus, Search, Settings, Star, Trash2, Upload, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { FileIcon } from '@/components/file-icon';
import { QubLogo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { Tooltip } from '@/components/ui/misc';
import { UserMenu } from '@/components/user-menu';
import { NotificationsBell } from '@/features/notifications/notifications';
import { useCurrentUser } from '@/hooks/use-auth';
import { cn, formatBytes, formatRelative } from '@/lib/utils';
import { driveService, openPath, openServiceUrl } from '@/services/drive';
import { qk } from '@/services/query-keys';
import { ActivityPanel } from './activity-panel';
import { openAppHome, useDriveChangesFromOtherTabs } from './create-actions';
import { hasFiles, hasQubItems, readDragItems } from './dnd';
import { ActivityPanelContext, useActivityPanel } from './drive-layout-context';
import { DrivePrefsProvider, DriveSettingsDialog, isTypingTarget, ShortcutsDialog } from './drive-prefs';
import { NewFolderDialog } from './dialogs';
import { PdfSignDialog } from './pdf-sign-dialog';
import { useMoveItems, useMyStorage } from './queries';
import { StorageMeter } from './storage-page';
import { TransferProvider, useTransferPanelOpen, useTransfers } from './transfer-manager';

/** The folder the user is looking at, so "New" and uploads land there. */
export function useCurrentFolderId(): string | undefined {
  const matches = useRouterState({ select: (s) => s.matches });
  const folderMatch = matches.find((m) => m.routeId === '/_authenticated/drive/folder/$folderId');
  return (folderMatch?.params as { folderId?: string } | undefined)?.folderId;
}

/** Sets `webkitdirectory` (not in React's input typings) so the picker selects a whole folder. */
const folderPicker = (el: HTMLInputElement | null) => el?.setAttribute('webkitdirectory', '');

function SearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  // "/" jumps to search from anywhere in Drive.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTypingTarget(e) && !document.querySelector('[role="dialog"]')) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const results = useQuery({
    queryKey: qk.drive.search({ q: debounced, limit: 6 }),
    queryFn: ({ signal }) => driveService.search({ q: debounced, limit: 6 }, signal),
    enabled: debounced.length >= 2,
    staleTime: 10_000,
  });
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const items = results.data?.items ?? [];
  const go = async (r: SearchResultDto) => {
    setOpen(false);
    if (r.kind === 'file' && (r.fileType === 'DOCUMENT' || r.fileType === 'SPREADSHEET' || r.fileType === 'FORM')) {
      window.open(openServiceUrl(r), '_blank', 'noopener');
    } else {
      await navigate({ href: openPath({ kind: r.kind, id: r.id, fileType: r.fileType, resourceId: r.resourceId }) });
    }
  };
  return (
    <div ref={ref} className="relative w-full max-w-[720px]">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && items[active]) return void go(items[active]!);
          setOpen(false);
          void navigate({ to: '/drive/search', search: { q: q.trim() } });
        }}
        className={cn('flex h-12 items-center gap-2 rounded-full bg-[#e9eef6] px-4 transition-colors focus-within:bg-background focus-within:shadow-card', open && items.length > 0 && 'rounded-b-none rounded-t-3xl bg-background shadow-card')}
      >
        <Search className="size-5 shrink-0 text-muted" aria-hidden />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === 'Escape') {
              setOpen(false);
              input.current?.blur();
            }
          }}
          placeholder="Search in Drive"
          aria-label="Search in Drive"
          aria-expanded={open && items.length > 0}
          aria-controls="search-suggestions"
          role="combobox"
          aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} className="rounded-full p-1 text-muted hover:bg-hover" aria-label="Clear search">
            <X className="size-5" />
          </button>
        )}
      </form>
      {open && debounced.length >= 2 && (
        <ul id="search-suggestions" role="listbox" className="absolute inset-x-0 top-12 z-40 rounded-b-3xl bg-background pb-2 shadow-card">
          {items.map((r, i) => (
            <li key={`${r.kind}-${r.id}`} id={`search-opt-${i}`} role="option" aria-selected={i === active}>
              <button onClick={() => void go(r)} className={cn('flex w-full items-center gap-4 px-5 py-2 text-left hover:bg-hover', i === active && 'bg-hover')}>
                <FileIcon type={r.fileType} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.owner.name} · {r.location?.name ?? 'Shared with me'} · {formatRelative(r.updatedAt)}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!results.isFetching && items.length === 0 && <li className="px-5 py-3 text-sm text-muted">No matching files</li>}
          <li>
            <button onClick={() => void navigate({ to: '/drive/search', search: { q: debounced } }).then(() => setOpen(false))} className="w-full px-5 py-2 text-left text-sm text-primary hover:bg-hover">
              Search all results for “{debounced}”
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function NavItem({ to, icon, children, dropFolderId }: { to: string; icon: ReactNode; children: ReactNode; dropFolderId?: string }) {
  const move = useMoveItems();
  const uploads = useTransfers();
  const [over, setOver] = useState(false);
  const droppable = !!dropFolderId;
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/drive', includeSearch: false }}
      className={cn(
        'flex h-9 items-center gap-4 rounded-full px-4 text-sm text-foreground hover:bg-[#e3e8ef] [&_svg]:size-5 [&_svg]:text-muted',
        'data-[status=active]:bg-selected data-[status=active]:font-semibold data-[status=active]:[&_svg]:text-foreground',
        over && 'bg-primary-soft ring-2 ring-primary',
      )}
      onDragOver={
        droppable
          ? (e: DragEvent) => {
              if (hasQubItems(e) || hasFiles(e)) {
                e.preventDefault();
                setOver(true);
              }
            }
          : undefined
      }
      onDragLeave={droppable ? () => setOver(false) : undefined}
      onDrop={
        droppable
          ? (e: DragEvent) => {
              e.preventDefault();
              setOver(false);
              const items = readDragItems(e);
              if (items) move.mutate({ items, folderId: dropFolderId!, folderName: 'My Drive' });
              else if (e.dataTransfer.files.length) uploads.uploadDrop(e.dataTransfer, dropFolderId);
            }
          : undefined
      }
    >
      {icon}
      {children}
    </Link>
  );
}

function NewMenu() {
  const folderId = useCurrentFolderId();
  const uploads = useTransfers();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [activePdfName, setActivePdfName] = useState<string>('');
  const [pdfSignOpen, setPdfSignOpen] = useState(false);

  // Shift+U upload files, Shift+I upload a folder, Shift+F new folder.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || isTypingTarget(e) || document.querySelector('[role="dialog"]')) return;
      const key = e.key.toLowerCase();
      if (key === 'u') fileInput.current?.click();
      else if (key === 'i') folderInput.current?.click();
      else if (key === 'f') setFolderOpen(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="mb-4 flex h-14 items-center gap-3 rounded-2xl bg-background pl-4 pr-6 text-sm font-medium shadow-card transition-shadow hover:bg-[#edf2fa] hover:shadow-pop" aria-label="New">
            <Plus className="size-6" /> New
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuItem icon={<FolderPlus />} onSelect={() => setFolderOpen(true)} shortcut="Shift+F">
            New folder
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<FileUp />} onSelect={() => fileInput.current?.click()} shortcut="Shift+U">
            File upload
          </DropdownMenuItem>
          <DropdownMenuItem icon={<FolderUp />} onSelect={() => folderInput.current?.click()} shortcut="Shift+I">
            Folder upload
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<FileIcon type="DOCUMENT" size={18} />} onSelect={() => openAppHome('DOCUMENT', folderId)}>
            Docs
          </DropdownMenuItem>
          <DropdownMenuItem icon={<FileIcon type="SPREADSHEET" size={18} />} onSelect={() => openAppHome('SPREADSHEET', folderId)}>
            Sheets
          </DropdownMenuItem>
          <DropdownMenuItem icon={<FileIcon type="FORM" size={18} />} onSelect={() => openAppHome('FORM', folderId)}>
            Forms
          </DropdownMenuItem>
          <DropdownMenuItem icon={<FileIcon type="PDF" size={18} />} onSelect={() => pdfInput.current?.click()}>
            PDFs
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) uploads.upload(e.target.files, folderId);
          e.target.value = '';
        }}
      />
      <input
        ref={(el) => {
          folderInput.current = el;
          folderPicker(el);
        }}
        type="file"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) uploads.uploadFolder(e.target.files, folderId);
          e.target.value = '';
        }}
      />
      <input
        ref={pdfInput}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const objectUrl = URL.createObjectURL(file);
            setActivePdfUrl(objectUrl);
            setActivePdfName(file.name);
            setPdfSignOpen(true);
          }
          e.target.value = '';
        }}
      />
      <NewFolderDialog open={folderOpen} onOpenChange={setFolderOpen} parentId={folderId} />
      {activePdfUrl && (
        <PdfSignDialog
          open={pdfSignOpen}
          onOpenChange={(isOpen) => {
            setPdfSignOpen(isOpen);
            if (!isOpen && activePdfUrl) {
              URL.revokeObjectURL(activePdfUrl);
              setActivePdfUrl(null);
            }
          }}
          pdfUrl={activePdfUrl}
          fileName={activePdfName}
          onSaveSigned={(blob, signedName) => {
            const file = new File([blob], signedName, { type: 'application/pdf' });
            uploads.upload([file], folderId);
          }}
        />
      )}
    </>
  );
}

/** Floating upload action on My Drive and folder pages; files land in the folder being viewed. */
function UploadFab() {
  const folderId = useCurrentFolderId();
  const onMyDrive = useRouterState({ select: (s) => s.matches.some((m) => m.routeId === '/_authenticated/drive/' || m.routeId === '/_authenticated/drive/folder/$folderId') });
  const uploads = useTransfers();
  const panelOpen = useTransferPanelOpen();
  const activity = useActivityPanel();
  const fileInput = useRef<HTMLInputElement>(null);
  // The transfers panel (with its own progress UI) and the activity panel occupy the same corner.
  if (!onMyDrive || panelOpen || activity.open) return null;
  return (
    <>
      <Tooltip content="Upload files" side="left">
        <button
          onClick={() => fileInput.current?.click()}
          className="fixed bottom-8 right-8 z-30 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-card transition-shadow animate-pop-in hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:bottom-10 lg:right-10"
          aria-label="Upload files"
        >
          <Upload className="size-6" />
        </button>
      </Tooltip>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) uploads.upload(e.target.files, folderId);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** Sidebar storage meter; links to the Storage page. */
function StorageSummary() {
  const s = useMyStorage();
  if (!s.data) return null;
  const { usedBytes: used, quotaBytes: quota } = s.data;
  const pct = quota ? (used / quota) * 100 : 0;
  return (
    <Link to="/drive/storage" className="group mx-1 mt-3 block rounded-xl px-3 py-2 hover:bg-[#e3e8ef]">
      <span className="mb-2 flex items-center gap-3 text-sm">
        <Cloud className="size-5 text-muted" /> Storage
        {quota != null && pct >= 90 && <span className={cn('ml-auto text-xs font-semibold', pct >= 100 ? 'text-danger' : 'text-warning')}>{pct >= 100 ? 'Full' : `${Math.round(pct)}%`}</span>}
      </span>
      {quota != null && <StorageMeter used={used} quota={quota} />}
      <span className="mt-1.5 block text-xs text-muted">{quota != null ? `${formatBytes(used)} of ${formatBytes(quota)} used` : `${formatBytes(used)} used · unlimited`}</span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  return (
    <nav aria-label="Drive" className="flex h-full flex-col overflow-y-auto px-3 pb-4 pt-2" onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}>
      <NewMenu />
      <div className="space-y-0.5">
        <NavItem to="/drive" icon={<HardDrive />} dropFolderId={user.rootFolderId}>
          My Drive
        </NavItem>
        <NavItem to="/drive/shared" icon={<Users />}>
          Shared with me
        </NavItem>
        <NavItem to="/drive/recent" icon={<Clock />}>
          Recent
        </NavItem>
        <NavItem to="/drive/starred" icon={<Star />}>
          Starred
        </NavItem>
        <NavItem to="/drive/spam" icon={<OctagonAlert />}>
          Spam
        </NavItem>
        <NavItem to="/drive/trash" icon={<Trash2 />}>
          Trash
        </NavItem>
      </div>
      <div className="mt-2 border-t border-border pt-1">
        <StorageSummary />
      </div>
    </nav>
  );
}

function DriveShell() {
  const [drawer, setDrawer] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useDriveChangesFromOtherTabs();
  const toggleActivity = useCallback(() => setActivityOpen((o) => !o), []);
  const activity = useMemo(() => ({ open: activityOpen, toggle: toggleActivity }), [activityOpen, toggleActivity]);

  // "?" shows the shortcuts; Shift+A toggles activity.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || document.querySelector('[role="dialog"]')) return;
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        toggleActivity();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleActivity]);

  return (
    <ActivityPanelContext.Provider value={activity}>
      <div className="flex h-full flex-col bg-surface">
        <header className="flex h-16 shrink-0 items-center gap-2 px-2 sm:px-4">
          <button className="rounded-full p-2.5 text-muted hover:bg-hover lg:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation">
            <Menu className="size-6" />
          </button>
          <Link to="/drive" className="mr-2 hidden w-[232px] shrink-0 pl-2 sm:block" aria-label="QubDocs home">
            <QubLogo product="QubDocs" />
          </Link>
          <div className="flex flex-1 justify-center lg:justify-start">
            <SearchBox />
          </div>
          <div className="ml-2 flex items-center gap-1">
            <Tooltip content="Keyboard shortcuts (?)">
              <button onClick={() => setShortcutsOpen(true)} className="hidden rounded-full p-2.5 text-muted hover:bg-hover md:block" aria-label="Keyboard shortcuts">
                <Keyboard className="size-5" />
              </button>
            </Tooltip>
            <Tooltip content="Settings">
              <button onClick={() => setSettingsOpen(true)} className="rounded-full p-2.5 text-muted hover:bg-hover" aria-label="Drive settings">
                <Settings className="size-5" />
              </button>
            </Tooltip>
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[256px] shrink-0 lg:block">
            <Sidebar />
          </aside>
          {drawer && (
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
              <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
              <div className="absolute inset-y-0 left-0 w-[280px] bg-surface pt-4 shadow-pop animate-pop-in">
                <div className="mb-4 flex items-center justify-between px-4">
                  <QubLogo product="QubDocs" />
                  <Button variant="subtle" size="icon" onClick={() => setDrawer(false)} aria-label="Close navigation">
                    <X />
                  </Button>
                </div>
                <Sidebar onNavigate={() => setDrawer(false)} />
              </div>
            </div>
          )}
          <main className="mb-2 mr-2 min-w-0 flex-1 overflow-hidden rounded-2xl bg-background lg:mb-4 lg:mr-4">
            <Outlet />
          </main>
          {activityOpen && (
            <div className="fixed inset-0 z-40 flex justify-end bg-black/30 xl:static xl:z-auto xl:mb-4 xl:mr-4 xl:overflow-hidden xl:rounded-2xl xl:bg-transparent">
              <ActivityPanel onClose={() => setActivityOpen(false)} />
            </div>
          )}
          <UploadFab />
        </div>
      </div>
      <DriveSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onShowShortcuts={() => setShortcutsOpen(true)} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </ActivityPanelContext.Provider>
  );
}

export function DriveLayout() {
  return (
    <DrivePrefsProvider>
      <TransferProvider>
        <DriveShell />
      </TransferProvider>
    </DrivePrefsProvider>
  );
}
