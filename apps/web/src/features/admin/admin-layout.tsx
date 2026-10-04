import type { AdminAlertDto } from '@qub/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Bell, FileStack, Gauge, HardDrive, Mail, Menu, ScrollText, Search, Settings2, ShieldAlert, ShieldCheck, SlidersHorizontal, Users, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { QubMark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/misc';
import { UserMenu } from '@/components/user-menu';
import { useCurrentUser } from '@/hooks/use-auth';
import { cn, formatBytes, formatRelative } from '@/lib/utils';
import { adminService } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { SeverityBadge, UsageBar } from './admin-ui';

const NAV: { to: string; label: string; icon: ReactNode; exact?: boolean }[] = [
  { to: '/admin', label: 'Home', icon: <Gauge />, exact: true },
  { to: '/admin/users', label: 'Users', icon: <Users /> },
  { to: '/admin/content', label: 'Content', icon: <FileStack /> },
  { to: '/admin/policies', label: 'Drive & sharing policies', icon: <SlidersHorizontal /> },
  { to: '/admin/storage', label: 'Storage', icon: <HardDrive /> },
  { to: '/admin/security', label: 'Security', icon: <ShieldCheck /> },
  { to: '/admin/audit', label: 'Audit & activity', icon: <ScrollText /> },
  { to: '/admin/email', label: 'Email delivery', icon: <Mail /> },
  { to: '/admin/settings', label: 'Organization', icon: <Settings2 /> },
];

const SECTION_PATH: Record<AdminAlertDto['section'], string> = {
  users: '/admin/users',
  storage: '/admin/storage',
  security: '/admin/security',
  content: '/admin/content',
  audit: '/admin/audit',
};

/** Shown to signed-in people who aren't super admins. The API enforces the same rule. */
function Forbidden() {
  const me = useCurrentUser();
  return (
    <div className="flex h-full flex-col items-center justify-center bg-surface p-6 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <ShieldAlert className="size-7" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wide text-danger">Error 403 · Access denied</p>
      <h1 className="mt-1 text-2xl font-semibold">Super admin access required</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        You're signed in as <strong className="text-foreground">{me.email}</strong>, which can't manage the organization. Ask a super admin to give your account access.
      </p>
      <Button asChild className="mt-6">
        <Link to="/drive">Back to Qub Drive</Link>
      </Button>
    </div>
  );
}

function AlertsDrawer({ open, onClose, alerts }: { open: boolean; onClose(): void; alerts: AdminAlertDto[] }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Admin alerts">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-pop animate-pop-in">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Bell className="size-5 text-primary" /> Alerts
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-hover" aria-label="Close alerts">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {alerts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">Nothing needs your attention.</p>
          ) : (
            alerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-semibold">{a.title}</p>
                  <SeverityBadge severity={a.severity} />
                </div>
                <p className="text-xs text-muted">{a.description}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>{formatRelative(a.at)}</span>
                  <Link to={SECTION_PATH[a.section]} onClick={onClose} className="font-medium text-primary hover:underline">
                    Review →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const overview = useQuery({ queryKey: qk.admin.overview, queryFn: adminService.overview, staleTime: 60_000 });
  const storage = overview.data?.storage;
  return (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            activeOptions={{ exact: !!n.exact, includeSearch: false }}
            className="flex h-10 items-center gap-3 rounded-r-full pl-4 pr-3 text-[13px] font-medium text-foreground/80 hover:bg-hover data-[status=active]:bg-primary-soft data-[status=active]:font-semibold data-[status=active]:text-[#041e49] [&_svg]:size-5 [&_svg]:text-muted data-[status=active]:[&_svg]:text-primary"
          >
            {n.icon}
            <span className="truncate">{n.label}</span>
          </Link>
        ))}
      </div>
      {storage && (
        <Link to="/admin/storage" onClick={onNavigate} className="m-3 block rounded-xl border border-border bg-background p-3 hover:border-primary/60">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted">
            <span>Organization storage</span>
            {storage.quotaBytes ? <span className="text-primary">{Math.round((storage.usedBytes / storage.quotaBytes) * 100)}% of allocated</span> : null}
          </div>
          <UsageBar used={storage.usedBytes} total={storage.quotaBytes} />
          <p className="mt-1.5 text-[11px] text-muted">
            {formatBytes(storage.usedBytes)} used{storage.quotaBytes ? ` of ${formatBytes(storage.quotaBytes)} allocated` : ' · no org-wide limit'}
          </p>
        </Link>
      )}
    </nav>
  );
}

function HeaderSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      className="hidden h-11 w-full max-w-xl items-center gap-2 rounded-lg bg-[#f1f3f4] px-3.5 transition-colors focus-within:bg-background focus-within:shadow-card md:flex"
      onSubmit={(e) => {
        e.preventDefault();
        void navigate({ to: '/admin/users', search: { q: q.trim() || undefined } });
      }}
    >
      <Search className="size-5 text-muted" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name or email" aria-label="Search people" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
    </form>
  );
}

export function AdminLayout() {
  const me = useCurrentUser();
  const [drawer, setDrawer] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const isAdmin = me.platformRole === 'SUPER_ADMIN';
  const alerts = useQuery({ queryKey: qk.admin.alerts, queryFn: adminService.alerts, enabled: isAdmin, refetchInterval: 60_000 });
  const org = useQuery({ queryKey: qk.admin.policies, queryFn: adminService.policies, enabled: isAdmin });
  useEffect(() => {
    document.title = 'Admin console – Qub';
  }, []);
  if (!isAdmin) return <Forbidden />;
  const count = alerts.data?.length ?? 0;
  const urgent = alerts.data?.some((a) => a.severity !== 'info');

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-2 sm:px-4">
        <button className="rounded-full p-2.5 text-muted hover:bg-hover lg:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation">
          <Menu className="size-6" />
        </button>
        <Link to="/admin" className="mr-2 flex shrink-0 items-center gap-2.5" aria-label="Admin console home">
          <QubMark size={34} />
          <span className="text-[20px] leading-none text-muted">
            <span className="font-semibold text-foreground">Qub</span> Admin
          </span>
        </Link>
        {org.data && <span className="hidden rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary sm:inline">{org.data.policies.organizationName}</span>}
        <div className="flex flex-1 justify-center px-2">
          <HeaderSearch />
        </div>
        <Button asChild variant="outline" size="sm" className="hidden rounded-full sm:inline-flex">
          <Link to="/drive">
            <ArrowLeft /> Qub Drive
          </Link>
        </Button>
        <Tooltip content={count ? `${count} alert${count === 1 ? '' : 's'}` : 'Alerts'}>
          <button onClick={() => setAlertsOpen(true)} className="relative rounded-full p-2.5 text-muted hover:bg-hover" aria-label={`Alerts, ${count} active`}>
            <Bell className="size-5" />
            {count > 0 && (
              <span className={cn('absolute right-1 top-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white', urgent ? 'bg-danger' : 'bg-primary')}>{count}</span>
            )}
          </button>
        </Tooltip>
        <UserMenu />
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
          <Sidebar />
        </aside>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 w-72 bg-surface pt-3 shadow-pop animate-pop-in">
              <div className="mb-2 flex items-center justify-between px-4">
                <span className="font-semibold">Admin console</span>
                <button onClick={() => setDrawer(false)} className="rounded-full p-1.5 text-muted hover:bg-hover" aria-label="Close navigation">
                  <X className="size-5" />
                </button>
              </div>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
      <AlertsDrawer open={alertsOpen} onClose={() => setAlertsOpen(false)} alerts={alerts.data ?? []} />
    </div>
  );
}
