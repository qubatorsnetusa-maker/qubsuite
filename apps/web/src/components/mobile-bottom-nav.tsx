import { useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  HardDrive,
  Menu,
  Presentation,
  Settings,
  Users,
  Clock,
  Star,
  Trash2,
  X,
  FileCheck2,
} from 'lucide-react';
import { FileIcon } from '@/components/file-icon';
import { QubLogo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { QUB_SUITE_APPS } from '@/components/app-launcher';

export interface MobileBottomNavProps {
  onOpenMenu?: () => void;
  activeSuite?: 'drive' | 'docs' | 'sheets' | 'forms' | 'slides' | 'pdf';
}

export function MobileBottomNav({ onOpenMenu, activeSuite }: MobileBottomNavProps) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  const tabs = [
    {
      id: 'drive',
      label: 'Drive',
      path: '/drive',
      icon: HardDrive,
      active: activeSuite === 'drive' || currentPath.startsWith('/drive'),
    },
    {
      id: 'docs',
      label: 'Docs',
      path: '/docs',
      icon: FileIcon,
      fileType: 'DOCUMENT' as const,
      active: activeSuite === 'docs' || currentPath.startsWith('/docs'),
    },
    {
      id: 'sheets',
      label: 'Sheets',
      path: '/sheets',
      icon: FileIcon,
      fileType: 'SPREADSHEET' as const,
      active: activeSuite === 'sheets' || currentPath.startsWith('/sheets'),
    },
    {
      id: 'forms',
      label: 'Forms',
      path: '/forms',
      icon: FileIcon,
      fileType: 'FORM' as const,
      active: activeSuite === 'forms' || currentPath.startsWith('/forms'),
    },
  ];

  const handleTabClick = (path: string) => {
    void navigate({ to: path as any });
  };

  const handleMoreClick = () => {
    if (onOpenMenu) {
      onOpenMenu();
    } else {
      setMoreDrawerOpen(true);
    }
  };

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border/80 bg-background/95 backdrop-blur-md px-2 pb-[env(safe-area-inset-bottom,0px)] md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      >
        {tabs.map((tab) => {
          const isActive = tab.active;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.path)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium transition-all active:scale-95',
                isActive ? 'text-primary font-semibold' : 'text-muted hover:text-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={cn(
                  'flex items-center justify-center p-1 rounded-full transition-transform duration-200',
                  isActive && 'scale-110 bg-primary/10',
                )}
              >
                {tab.fileType ? (
                  <FileIcon type={tab.fileType} size={20} />
                ) : (
                  <tab.icon className={cn('size-5', isActive ? 'text-primary' : 'text-muted')} />
                )}
              </div>
              <span className="truncate mt-0.5">{tab.label}</span>
              {isActive && (
                <div className="absolute -top-1 w-8 h-1 rounded-full bg-primary animate-in fade-in zoom-in duration-200" />
              )}
            </button>
          );
        })}

        <button
          onClick={handleMoreClick}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium text-muted hover:text-foreground transition-all active:scale-95"
          aria-label="More suites and menus"
        >
          <div className="p-1 rounded-full">
            <Menu className="size-5" />
          </div>
          <span className="truncate mt-0.5">More</span>
        </button>
      </nav>

      {/* Internal More Drawer if no external handler provided */}
      {moreDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200 md:hidden"
          onClick={() => setMoreDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="More apps and locations"
        >
          <div
            className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 shadow-2xl transition-transform animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted/30" />
            <div className="mb-4 flex items-center justify-between">
              <QubLogo product="QubDocs" />
              <button
                onClick={() => setMoreDrawerOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-hover active:scale-95"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Qub Suite</p>
              <div className="grid grid-cols-3 gap-2">
                {QUB_SUITE_APPS.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => {
                      setMoreDrawerOpen(false);
                      void navigate({ to: app.path as any });
                    }}
                    className="flex flex-col items-center justify-center rounded-2xl bg-surface p-3 text-center transition-all hover:bg-hover active:scale-95 border border-border/40"
                  >
                    <div className="mb-1 scale-95">{app.icon}</div>
                    <span className="text-xs font-medium text-foreground">{app.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border/70 pt-3 space-y-1">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">Drive Locations</p>
              <button
                onClick={() => {
                  setMoreDrawerOpen(false);
                  void navigate({ to: '/drive/shared' as any });
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-hover text-left"
              >
                <Users className="size-5 text-muted" />
                <span>Shared with me</span>
              </button>

              <button
                onClick={() => {
                  setMoreDrawerOpen(false);
                  void navigate({ to: '/drive/recent' as any });
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-hover text-left"
              >
                <Clock className="size-5 text-muted" />
                <span>Recent</span>
              </button>

              <button
                onClick={() => {
                  setMoreDrawerOpen(false);
                  void navigate({ to: '/drive/starred' as any });
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-hover text-left"
              >
                <Star className="size-5 text-muted" />
                <span>Starred</span>
              </button>

              <button
                onClick={() => {
                  setMoreDrawerOpen(false);
                  void navigate({ to: '/drive/trash' as any });
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-hover text-left"
              >
                <Trash2 className="size-5 text-muted" />
                <span>Trash</span>
              </button>

              <button
                onClick={() => {
                  setMoreDrawerOpen(false);
                  void navigate({ to: '/settings' as any });
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-hover text-left"
              >
                <Settings className="size-5 text-muted" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
