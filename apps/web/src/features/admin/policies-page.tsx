import type { GrantableRole, OrgPolicies } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, FileUp, Globe2, HardDrive, ListChecks, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { adminService } from '@/services/admin';
import { qk } from '@/services/query-keys';
import { Card, PageHeader, ToggleRow } from './admin-ui';

const lines = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);

/** Edits a copy of the policies; "Save" sends them all at once (the server validates and audits the change). */
export function usePolicyDraft() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.admin.policies, queryFn: adminService.policies });
  const [draft, setDraft] = useState<OrgPolicies | null>(null);
  useEffect(() => {
    if (q.data) setDraft(structuredClone(q.data.policies));
  }, [q.data]);
  const save = useMutation({
    mutationFn: (p: OrgPolicies) => adminService.savePolicies(p),
    meta: { silent: true },
    onSuccess: (r) => {
      qc.setQueryData(qk.admin.policies, r);
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      toast.success('Policies saved. They apply to everyone right away.');
    },
  });
  const dirty = !!draft && !!q.data && JSON.stringify(draft) !== JSON.stringify(q.data.policies);
  const update = <K extends keyof OrgPolicies>(section: K, patch: Partial<OrgPolicies[K]>) =>
    setDraft((d) => (d ? { ...d, [section]: typeof d[section] === 'object' ? { ...(d[section] as object), ...patch } : patch } : d));
  return { q, draft, setDraft, update, save, dirty, reset: () => q.data && setDraft(structuredClone(q.data.policies)) };
}

export function SaveBar({ dirty, saving, error, onSave, onReset }: { dirty: boolean; saving: boolean; error: unknown; onSave(): void; onReset(): void }) {
  if (!dirty && !error) return null;
  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 shadow-pop">
      <p className={error ? 'text-sm text-danger' : 'text-sm text-muted'} role={error ? 'alert' : undefined}>
        {error ? errorMessage(error) : 'You have unsaved changes.'}
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onReset} disabled={saving}>
          Discard
        </Button>
        <Button onClick={onSave} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function AdminPoliciesPage() {
  const { q, draft, update, save, dirty, reset } = usePolicyDraft();
  const [domains, setDomains] = useState('');
  const [extensions, setExtensions] = useState('');
  useEffect(() => {
    if (!draft) return;
    setDomains(draft.sharing.allowedDomains.join('\n'));
    setExtensions(draft.uploads.blockedExtensions.join(', '));
    // Only when the saved version changes, not while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!draft || !q.data) return <Skeleton className="h-96 rounded-2xl" />;
  const max = q.data.serverMaxUploadMb;

  return (
    <>
      <PageHeader
        eyebrow="Drive, Docs, Sheets & Forms"
        title="Drive & sharing policies"
        description="Rules for how people share, what they can upload and how long deleted items are kept. Every setting is enforced by the server for all apps."
      />

      <Card title="Sharing" icon={<Globe2 />} description="Applies to files and folders in Drive and to every Doc, Sheet and Form">
        <div className="space-y-3">
          <ToggleRow
            label="Allow “Anyone with the link”"
            description="Turning this off also disables every public link that already exists (they start working again if you turn it back on)."
            checked={draft.sharing.allowPublicLinks}
            onChange={(v) => update('sharing', { allowPublicLinks: v })}
          />
          <div className="rounded-xl bg-surface px-4 py-3">
            <Field label="Most a link can allow" hint="Existing links are capped to this too." htmlFor="max-link-role">
              <NativeSelect id="max-link-role" value={draft.sharing.maxLinkRole} onChange={(e) => update('sharing', { maxLinkRole: e.target.value as GrantableRole })} className="h-10 w-56">
                <option value="VIEWER">View</option>
                <option value="COMMENTER">Comment</option>
                <option value="EDITOR">Edit</option>
              </NativeSelect>
            </Field>
          </div>
          <ToggleRow
            label="Allow inviting people without a Qub account"
            description="Invitations become access when the person signs up. When off, people can only share with existing accounts."
            checked={draft.sharing.allowExternalInvites}
            onChange={(v) => update('sharing', { allowExternalInvites: v })}
          />
          <div className="rounded-xl bg-surface px-4 py-3">
            <Field label="Only allow sharing with these email domains" hint="One per line, like example.com. Leave empty to allow any domain." htmlFor="domains">
              <Textarea
                id="domains"
                rows={3}
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                onBlur={() => update('sharing', { allowedDomains: lines(domains).map((d) => d.toLowerCase()) })}
                placeholder="example.com"
                className="max-w-md"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Content protection" icon={<ShieldCheck />}>
        <ToggleRow
          label="Viewers and commenters can download, print and copy"
          description="When off, only editors and owners can download or make copies, whatever each item's share settings say."
          checked={draft.content.viewersCanDownload}
          onChange={(v) => update('content', { viewersCanDownload: v })}
        />
      </Card>

      <Card title="Uploads" icon={<FileUp />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Largest file people can upload" hint={`The server accepts up to ${max} MB.`} htmlFor="max-upload">
            <div className="flex items-center gap-2">
              <Input id="max-upload" type="number" min={1} max={max} value={draft.uploads.maxFileSizeMb} onChange={(e) => update('uploads', { maxFileSizeMb: Number(e.target.value) })} className="w-32" /> MB
            </div>
          </Field>
          <Field label="Blocked file types" hint="Extensions, comma separated. Executables (.exe, .bat, .msi, …) are always blocked." htmlFor="blocked">
            <Input
              id="blocked"
              value={extensions}
              onChange={(e) => setExtensions(e.target.value)}
              onBlur={() => update('uploads', { blockedExtensions: lines(extensions).map((x) => (x.startsWith('.') ? x : `.${x}`).toLowerCase()) })}
              placeholder=".iso, .dmg"
            />
          </Field>
        </div>
      </Card>

      <Card title="Storage & trash" icon={<HardDrive />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default storage per person" hint="People with their own quota (set in Users) aren't affected." htmlFor="default-quota">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="default-quota" checked={draft.storage.defaultQuotaGb == null} onChange={() => update('storage', { defaultQuotaGb: null })} /> Unlimited
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="default-quota" checked={draft.storage.defaultQuotaGb != null} onChange={() => update('storage', { defaultQuotaGb: draft.storage.defaultQuotaGb ?? 15 })} /> Limit to
              </label>
              {draft.storage.defaultQuotaGb != null && (
                <span className="flex items-center gap-2">
                  <Input id="default-quota" type="number" min={0.1} step={0.1} value={draft.storage.defaultQuotaGb} onChange={(e) => update('storage', { defaultQuotaGb: Number(e.target.value) })} className="w-24" /> GB
                </span>
              )}
            </div>
          </Field>
          <Field label="Delete items in the trash after" hint="A daily job permanently deletes older trashed items." htmlFor="retention">
            <div className="flex items-center gap-2 text-sm">
              <Input id="retention" type="number" min={1} max={3650} value={draft.trash.retentionDays} onChange={(e) => update('trash', { retentionDays: Number(e.target.value) })} className="w-24" /> days
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Forms" icon={<ListChecks />}>
        <ToggleRow
          label="Respondents must sign in"
          description="Applies to every published form, even ones set to accept anonymous responses."
          checked={draft.forms.requireSignIn}
          onChange={(v) => update('forms', { requireSignIn: v })}
        />
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted">
        <Clock className="size-3.5" /> Session length is under Security.
      </p>

      <SaveBar dirty={dirty} saving={save.isPending} error={save.error} onSave={() => save.mutate(draft)} onReset={() => (reset(), save.reset())} />
    </>
  );
}
