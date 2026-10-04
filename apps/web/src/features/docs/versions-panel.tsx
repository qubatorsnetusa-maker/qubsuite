import { documentExtensions, type JSONContent } from '@qub/editor-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EditorContent, useEditor } from '@tiptap/react';
import { History, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form-controls';
import { Badge, Skeleton } from '@/components/ui/misc';
import { cn, formatDate } from '@/lib/utils';
import { docsService } from '@/services/docs';
import { qk } from '@/services/query-keys';

function ReadOnlyDoc({ content }: { content: JSONContent }) {
  const editor = useEditor({ extensions: documentExtensions(), content, editable: false, immediatelyRender: false });
  useEffect(() => {
    if (editor && content) editor.commands.setContent(content);
  }, [editor, content]);
  return <EditorContent editor={editor} />;
}

export function VersionsPanel({ documentId, canEdit, onClose }: { documentId: string; canEdit: boolean; onClose(): void }) {
  const qc = useQueryClient();
  const versions = useQuery({ queryKey: qk.docs.versions(documentId), queryFn: () => docsService.versions(documentId) });
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState(false);
  const preview = useQuery({ queryKey: ['docs', documentId, 'version', selected], queryFn: () => docsService.version(documentId, selected!), enabled: !!selected });
  const save = useMutation({
    mutationFn: () => docsService.createVersion(documentId, name || undefined),
    onSuccess: () => {
      setName('');
      toast.success('Version saved');
      void qc.invalidateQueries({ queryKey: qk.docs.versions(documentId) });
    },
  });
  const restore = useMutation({
    mutationFn: () => docsService.restoreVersion(documentId, selected!),
    onSuccess: () => {
      toast.success('Version restored for everyone');
      setConfirm(false);
      setSelected(null);
      void qc.invalidateQueries({ queryKey: qk.docs.versions(documentId) });
    },
  });

  return (
    <div className="fixed inset-0 z-40 flex bg-surface-2" role="dialog" aria-modal="true" aria-label="Version history">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
          <History className="size-5 text-muted" />
          <h2 className="flex-1 text-lg">{preview.data ? `Version ${preview.data.versionNumber}${preview.data.name ? ` — ${preview.data.name}` : ''}` : 'Version history'}</h2>
          {selected && canEdit && (
            <Button onClick={() => setConfirm(true)} loading={restore.isPending}>
              Restore this version
            </Button>
          )}
          <Button variant="subtle" size="icon" onClick={onClose} aria-label="Close version history">
            <X />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {selected ? (
            preview.data ? (
              <div className="mx-auto max-w-[816px] bg-background px-[96px] py-[96px] shadow-card">
                <ReadOnlyDoc content={preview.data.content as JSONContent} />
              </div>
            ) : (
              <Skeleton className="mx-auto h-[600px] max-w-[816px]" />
            )
          ) : (
            <p className="mt-20 text-center text-muted">Select a version to preview it.</p>
          )}
        </div>
      </div>
      <aside className="flex w-80 flex-col border-l border-border bg-background">
        {canEdit && (
          <form className="flex gap-2 border-b border-border p-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name current version" className="h-9" maxLength={200} />
            <Button type="submit" size="sm" loading={save.isPending}>
              Save
            </Button>
          </form>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto py-2">
          {versions.data?.map((v) => (
            <li key={v.id}>
              <button onClick={() => setSelected(v.id)} className={cn('w-full px-4 py-3 text-left hover:bg-hover', selected === v.id && 'bg-selected')}>
                <p className="text-sm font-medium">{formatDate(v.createdAt, true)}</p>
                {v.name && <p className="text-sm">{v.name}</p>}
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  {v.createdBy?.name ?? 'Unknown'} · {v.wordCount} words {v.versionNumber === versions.data[0]?.versionNumber && <Badge>latest</Badge>}
                </p>
              </button>
            </li>
          ))}
          {versions.data?.length === 0 && <li className="p-4 text-sm text-muted">Versions are saved automatically while you edit.</li>}
        </ul>
      </aside>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Restore this version?"
        description="The document will be replaced for everyone. The current state is saved as a version first, so you can undo this."
        confirmLabel="Restore"
        loading={restore.isPending}
        onConfirm={() => restore.mutate()}
      />
    </div>
  );
}
