import { formSetTx } from '@qub/shared/forms';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Switch } from '@/components/ui/form-controls';
import { ShareDialog } from '@/features/sharing/share-dialog';
import { useFormV2, usePublishFormV2 } from '../layout/use-form-v2';

/** Same toggles as the form settings panel, with the same keys and wording (`FormSettingsFields`). */
const SETTINGS_TOGGLES = [
  ['requireSignIn', 'Require sign-in', 'Only signed-in Qub users can respond.'],
  ['limitOneResponse', 'Limit to 1 response', 'Requires sign-in; each person can submit once.'],
] as const;

/**
 * Share tab. Unpublished: a single Publish action (flushes pending edits first, then the same publish call the
 * frame's header button uses). Published: the public link with Copy link and Open, Accepting responses,
 * Require sign-in and Limit to 1 response (bound to the same settings as the form settings panel), and the
 * existing collaborator sharing dialog. There is no Republish: a published form's edits go live as soon as they're
 * saved, and publishing again would also turn Accepting responses back on (`FormService.publish`), reopening a
 * form its owner closed. Viewers see every control disabled except the link, which stays copyable.
 */
export function ShareTab() {
  const { form, ops, canEdit } = useFormV2();
  const [share, setShare] = useState(false);
  const publish = usePublishFormV2(form, ops);
  const save = (input: Parameters<typeof formSetTx>[1]) => ops.apply(formSetTx(form, input, 'Change settings'));
  const publicUrl = `${window.location.origin}/formsv2/f/${form.publicId}`;
  const s = form.settings;

  if (!form.isPublished) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
        <h2 className="text-lg font-medium">Publish this form</h2>
        <p className="text-sm text-muted">Publishing gives you a link you can share to start collecting responses.</p>
        {canEdit ? (
          <Button size="lg" loading={publish.isPending} onClick={() => publish.mutate(true)}>
            Publish
          </Button>
        ) : (
          <p className="text-sm text-muted">Only editors can publish this form.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <section className="space-y-2">
        <label htmlFor="formv2-share-link" className="block text-sm font-medium">
          Link
        </label>
        <div className="flex gap-2">
          <Input id="formv2-share-link" aria-label="Public link" readOnly value={publicUrl} className="flex-1" />
          <Button variant="outline" onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => toast.success('Link copied'))}>
            Copy link
          </Button>
          <Button asChild variant="outline">
            <a href={publicUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          </Button>
        </div>
      </section>

      <label className="flex items-center justify-between gap-4 rounded-lg bg-surface p-3">
        <span>
          <span className="block text-sm font-medium">Accepting responses</span>
          <span className="text-xs text-muted">Turn off to close the form.</span>
        </span>
        <Switch aria-label="Accepting responses" checked={form.acceptingResponses} disabled={!canEdit} onCheckedChange={(v) => save({ acceptingResponses: v })} />
      </label>

      {SETTINGS_TOGGLES.map(([key, label, hint]) => (
        <label key={key} className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">{label}</span>
            <span className="text-xs text-muted">{hint}</span>
          </span>
          <Switch aria-label={label} checked={!!s[key]} disabled={!canEdit} onCheckedChange={(v) => save({ settings: { [key]: v } })} />
        </label>
      ))}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <p className="text-sm text-muted">Changes go live as soon as they’re saved.</p>
        <Button variant="secondary" onClick={() => setShare(true)}>
          <UserPlus /> Share
        </Button>
      </div>

      <ShareDialog target={share ? { kind: 'file', id: form.fileId, name: form.title } : null} onOpenChange={setShare} />
    </div>
  );
}
