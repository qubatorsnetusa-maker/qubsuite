import { Link } from '@tanstack/react-router';
import { ArrowLeft, HardDrive, LayoutGrid, Menu, Search, Settings, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { FileIcon } from '@/components/file-icon';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc';
import { UserMenu } from '@/components/user-menu';
import { NotificationsBell } from '@/features/notifications/notifications';
import { cn } from '@/lib/utils';
import { LAUNCHER_APPS, type AppConfig } from './app-config';

function AppLinks({ onNavigate, layout }: { onNavigate?: () => void; layout: 'list' | 'grid' }) {
  const item = layout === 'grid' ? 'flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs hover:bg-hover' : 'flex h-11 items-center gap-4 rounded-r-full pl-6 pr-4 text-sm hover:bg-hover';
  return (
    <>
      {LAUNCHER_APPS.map((a) => (
        <Link key={a.home} to={a.home} onClick={onNavigate} className={item} activeOptions={{ exact: true }} activeProps={{ className: layout === 'list' ? 'bg-primary-soft font-medium' : 'bg-hover' }}>
          <FileIcon type={a.type} size={layout === 'grid' ? 36 : 22} />
          Qub {a.product}
        </Link>
      ))}
      <Link to="/drive" onClick={onNavigate} className={item}>
        {layout === 'grid' ? <HardDrive className="size-9 text-[#1a56db]" /> : <HardDrive className="size-5 text-[#1a56db]" />}
        Qub Drive
      </Link>
    </>
  );
}

/** Google-style navigation drawer: every Qub app, Drive and settings. */
function AppDrawer({ open, onClose, app }: { open: boolean; onClose(): void; app: AppConfig }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Qub apps">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <nav className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-background py-3 shadow-pop animate-pop-in">
        <div className="mb-3 flex items-center gap-2 px-4">
          <button className="rounded-full p-2 text-muted hover:bg-hover" onClick={onClose} aria-label="Close menu">
            <X className="size-5" />
          </button>
          <AppLogo app={app} />
        </div>
        <AppLinks layout="list" onNavigate={onClose} />
        <div className="my-2 border-t border-border" />
        <Link to="/settings" onClick={onClose} className="flex h-11 items-center gap-4 rounded-r-full pl-6 pr-4 text-sm hover:bg-hover">
          <Settings className="size-5 text-muted" /> Settings
        </Link>
      </nav>
    </div>
  );
}

export function AppLogo({ app }: { app: AppConfig }) {
  return (
    <span className="flex items-center gap-2">
      <FileIcon type={app.type} size={40} />
      <span className="text-[22px] leading-none text-muted">
        <span className="font-semibold text-foreground">Qub</span> {app.product}
      </span>
    </span>
  );
}

/** Search box that reports its value after typing pauses. */
function AppSearch({ app, value, onChange }: { app: AppConfig; value: string; onChange(q: string): void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => text.trim() !== value && onChange(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <form
      role="search"
      className="flex h-12 w-full max-w-[720px] items-center gap-3 rounded-full bg-[#f1f3f4] px-4 transition-colors focus-within:bg-background focus-within:shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        onChange(text.trim());
      }}
    >
      <Search className="size-5 shrink-0 text-muted" aria-hidden />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setText('')}
        placeholder={`Search in Qub ${app.product}`}
        aria-label={`Search in Qub ${app.product}`}
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
      />
      {text && (
        <button type="button" onClick={() => (setText(''), onChange(''))} className="rounded-full p-1 text-muted hover:bg-hover" aria-label="Clear search">
          <X className="size-5" />
        </button>
      )}
    </form>
  );
}

export function AppHeader({
  app,
  search,
  onSearch,
  back,
  title,
}: {
  app: AppConfig;
  search?: string;
  onSearch?: (q: string) => void;
  /** Gallery pages: a back arrow to the app home and a page title instead of the search box. */
  back?: boolean;
  title?: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-2 sm:px-4">
      {back ? (
        <Tooltip content={`Back to Qub ${app.product}`}>
          <Link to={app.home} className="rounded-full p-2.5 text-muted hover:bg-hover" aria-label={`Back to Qub ${app.product}`}>
            <ArrowLeft className="size-6" />
          </Link>
        </Tooltip>
      ) : (
        <button className="rounded-full p-2.5 text-muted hover:bg-hover" onClick={() => setDrawer(true)} aria-label="Main menu">
          <Menu className="size-6" />
        </button>
      )}
      {title ?? (
        <Link to={app.home} className={cn('mr-2 shrink-0', onSearch && 'hidden sm:block')} aria-label={`Qub ${app.product} home`}>
          <AppLogo app={app} />
        </Link>
      )}
      <div className="flex min-w-0 flex-1 justify-center px-2">{onSearch && <AppSearch app={app} value={search ?? ''} onChange={onSearch} />}</div>
      <div className="flex items-center gap-1">
        <Popover>
          <Tooltip content="Qub apps">
            <PopoverTrigger asChild>
              <button className="rounded-full p-2.5 text-muted hover:bg-hover" aria-label="Qub apps">
                <LayoutGrid className="size-5" />
              </button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent align="end" className="grid w-72 grid-cols-2 gap-1 p-3">
            <AppLinks layout="grid" />
          </PopoverContent>
        </Popover>
        <NotificationsBell />
        <UserMenu />
      </div>
      <AppDrawer open={drawer} onClose={() => setDrawer(false)} app={app} />
    </header>
  );
}
