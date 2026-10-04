import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Building2, Server } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorState } from '@/components/states';
import { Input, Label } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/misc';
import { formatBytes } from '@/lib/utils';
import { adminService } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { Card, PageHeader } from './admin-ui';
import { SaveBar, usePolicyDraft } from './policies-page';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export function AdminOrgSettingsPage() {
  const sys = useQuery({ queryKey: qk.admin.system, queryFn: adminService.system });
  const { draft, update, save, dirty, reset } = usePolicyDraft();
  if (sys.error) return <ErrorState error={sys.error} onRetry={() => void sys.refetch()} />;
  const s = sys.data;
  return (
    <>
      <PageHeader eyebrow="Organization" title="Organization settings" description="Your organization's name and the server this Qub installation runs on." />
      <Card title="Organization" icon={<Building2 />}>
        {draft ? (
          <div className="max-w-md">
            <Label htmlFor="org-name">Name</Label>
            <p className="text-xs text-muted">Shown in the admin console and in account emails (“… created a {draft.organizationName} account for you”).</p>
            <Input id="org-name" maxLength={100} value={draft.organizationName} onChange={(e) => update('organizationName', e.target.value as never)} className="mt-1.5" />
          </div>
        ) : (
          <Skeleton className="h-16 w-96" />
        )}
      </Card>
      {draft && <SaveBar dirty={dirty} saving={save.isPending} error={save.error} onSave={() => save.mutate(draft)} onReset={() => (reset(), save.reset())} />}
      <Card title="System" icon={<Server />} description="Read from the running server. Change these in the server's environment configuration.">
        {!s ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="divide-y divide-border">
            <Row label="App URL">{s.appUrl}</Row>
            <Row label="Environment">{s.environment}</Row>
            <Row label="File storage">{s.storageProvider === 's3' ? 'S3-compatible object storage' : 'Local disk'}</Row>
            <Row label="Server-default email transport">
              {s.mailTransport === 'smtp' ? 'SMTP' : 'Console (development — emails are logged, not sent)'} ·{' '}
              <Link to="/admin/email" className="text-primary hover:underline">
                Choose a provider
              </Link>
            </Row>
            <Row label="Largest upload the server accepts">{s.serverMaxUploadMb} MB</Row>
            <Row label="Trash clean-up job">{s.trashJobIntervalMinutes ? `Every ${s.trashJobIntervalMinutes} minutes` : 'Run externally (pnpm job:purge-trash)'}</Row>
            <Row label="Database">PostgreSQL {s.postgresVersion} · {formatBytes(s.databaseBytes)}</Row>
            <Row label="Runtime">Node.js {s.nodeVersion} · up {uptime(s.uptimeSeconds)}</Row>
          </div>
        )}
      </Card>
    </>
  );
}
