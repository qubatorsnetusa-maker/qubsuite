import { formSetTx } from '@qub/shared/forms';
import { Link, Outlet } from '@tanstack/react-router';
import { Eye, LayoutList, Redo2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { EditorHeader, SaveIndicator } from '@/components/editor-header';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/misc';
import { BuilderOpsProvider } from '@/features/forms/builder/ops/builder-ops';
import { useFormRoom } from '@/features/forms/use-form-room';
import { ShareDialog } from '@/features/sharing/share-dialog';
import { useCurrentUser } from '@/hooks/use-auth';
import { useFormV2, useFormV2Query, usePublishFormV2 } from './use-form-v2';

const TABS = [
  { to: '/formsv2/$formId/content', label: 'Content' },
  { to: '/formsv2/$formId/design', label: 'Design' },
  { to: '/formsv2/$formId/workflow', label: 'Workflow' },
  { to: '/formsv2/$formId/share', label: 'Share' },
  { to: '/formsv2/$formId/results', label: 'Results' },
] as const;

/**
 * Frame shared by the Content, Design, Workflow, Share and Results tabs. One BuilderOpsProvider sits above the tab outlet,
 * so switching tabs keeps pending edits, the save status and the undo history.
 */
export function FormV2Frame({ formId }: { formId: string }) {
  const me = useCurrentUser();
  const form = useFormV2Query(formId);
  if (form.isLoading) return <FullPageSpinner label="Opening form…" />;
  if (form.error) return <ErrorState error={form.error} onRetry={() => void form.refetch()} title="Can’t open this form" />;
  return (
    <BuilderOpsProvider formId={formId} userId={me.id}>
      <Frame />
    </BuilderOpsProvider>
  );
}

function Frame() {
  const { form, ops, canEdit } = useFormV2();
  // Inside the provider, so the room can tell this tab's own saves from other people's edits.
  const presence = useFormRoom(form.id);
  const [share, setShare] = useState(false);
  const publish = usePublishFormV2(form, ops);
  const params = { formId: form.id };
  return (
    <div className="flex h-full flex-col bg-surface-2">
      <div className="border-b border-border bg-background">
        <EditorHeader
          fileType="FORM"
          title={form.title}
          onRename={(t) => ops.apply(formSetTx(form, { title: t }, 'Rename form'))}
          canEdit={canEdit}
          status={<SaveIndicator status={ops.status} onRetry={ops.retry} />}
          presence={presence.map((u) => ({ key: u.clientId, name: u.name, avatarUrl: u.avatarUrl, color: u.color }))}
          readOnlyLabel={canEdit ? undefined : 'View only'}
          onShare={() => setShare(true)}
          actions={
            <>
              {canEdit && (
                <>
                  <Tooltip content={ops.undoLabel ? `Undo ${ops.undoLabel}` : 'Undo'}>
                    <Button variant="subtle" size="icon" aria-label="Undo" disabled={!ops.canUndo} onClick={ops.undo}>
                      <Undo2 />
                    </Button>
                  </Tooltip>
                  <Tooltip content={ops.redoLabel ? `Redo ${ops.redoLabel}` : 'Redo'}>
                    <Button variant="subtle" size="icon" aria-label="Redo" disabled={!ops.canRedo} onClick={ops.redo}>
                      <Redo2 />
                    </Button>
                  </Tooltip>
                </>
              )}
              <Tooltip content="Open in classic Forms">
                <Button asChild variant="subtle" size="icon" aria-label="Open in classic Forms">
                  <Link to="/forms/$formId/edit" params={params}>
                    <LayoutList />
                  </Link>
                </Button>
              </Tooltip>
              <Tooltip content="Preview">
                <Button asChild variant="subtle" size="icon" aria-label="Preview">
                  <Link to="/formsv2/$formId/preview" params={params} search={{ frame: false, device: 'desktop' as const }}>
                    <Eye />
                  </Link>
                </Button>
              </Tooltip>
              {canEdit && (
                <Button onClick={() => publish.mutate(!form.isPublished)} loading={publish.isPending} variant={form.isPublished ? 'outline' : 'primary'}>
                  {form.isPublished ? 'Unpublish' : 'Publish'}
                </Button>
              )}
            </>
          }
        />
        <nav className="flex justify-center gap-2" aria-label="Form views">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              params={params}
              className="border-b-[3px] px-4 py-2 text-sm font-medium"
              activeProps={{ className: 'border-form text-form' }}
              inactiveProps={{ className: 'border-transparent text-muted hover:text-foreground' }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
      <ShareDialog target={share ? { kind: 'file', id: form.fileId, name: form.title } : null} onOpenChange={setShare} />
    </div>
  );
}
