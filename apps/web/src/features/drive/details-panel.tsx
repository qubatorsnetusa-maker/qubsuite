import type { DriveItemDto } from '@qub/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, Globe2, History, Lock, OctagonAlert, Pencil, RotateCcw, Star, Trash2, Upload, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileIcon, FILE_TYPE_LABEL } from '@/components/file-icon';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/form-controls';
import { Avatar, Badge, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { cn, formatBytes, formatDate, formatRelative } from '@/lib/utils';
import { driveService } from '@/services/drive';
import { qk } from '@/services/query-keys';
import { describeActivity } from './activity-text';
import { FileThumbnail } from './file-thumbnail';
import { isDownloadable, isPreviewable, useItemActions } from './item-actions';
import { useDeleteVersion, useFileVersions, useStarItem } from './queries';

function ActivityList({ item }: { item: DriveItemDto }) {
  const q = useInfiniteQuery({
    queryKey: qk.drive.activity(item.kind, item.id),
    queryFn: ({ pageParam }) => driveService.activity(item.kind, item.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  if (q.isLoading) return <div className="space-y-3 p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <ol className="space-y-4 p-4">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          {a.actor ? <Avatar user={a.actor} size={28} /> : <span className="size-7 shrink-0 rounded-full bg-surface-2" />}
          <div>
            <p>
              <b className="font-medium">{a.actor?.name ?? 'Someone'}</b> {describeActivity(a)}
            </p>
            <p className="text-xs text-muted">{formatDate(a.createdAt, true)}</p>
          </div>
        </li>
      ))}
      {items.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
      {q.hasNextPage && (
        <Button variant="subtle" size="sm" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
          Show more
        </Button>
      )}
    </ol>
  );
}

function Versions({ item }: { item: Extract<DriveItemDto, { kind: 'file' }> }) {
  const versions = useFileVersions(item.id);
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<{ id: string; n: number; size: number } | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) => driveService.uploadVersion(item.id, file),
    onSuccess: () => {
      toast.success('New version uploaded');
      void qc.invalidateQueries({ queryKey: qk.drive.all });
    },
  });
  const restore = useMutation({
    mutationFn: (versionId: string) => driveService.restoreVersion(item.id, versionId),
    onSuccess: () => {
      toast.success('Version restored');
      void qc.invalidateQueries({ queryKey: qk.drive.all });
    },
  });
  const del = useDeleteVersion(item.id);
  const older = versions.data?.filter((v) => !v.isCurrent) ?? [];
  return (
    <div className="p-4">
      {item.capabilities.canEdit && (
        <>
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} loading={upload.isPending}>
            <Upload /> Upload new version
          </Button>
          <input ref={input} type="file" hidden onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        </>
      )}
      {older.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          {older.length} older version{older.length === 1 ? '' : 's'} use {formatBytes(older.reduce((s, v) => s + v.size, 0))} of the owner’s storage.
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {versions.data?.map((v) => (
          <li key={v.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Version {v.versionNumber}</span>
              {v.isCurrent && <Badge tone="primary">Current</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted">
              {formatDate(v.createdAt, true)} · {v.createdBy.name} · {formatBytes(v.size)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.capabilities.canDownload && (
                <Button asChild variant="subtle" size="sm">
                  <a href={driveService.versionDownloadUrl(item.id, v.id)} download>
                    <Download /> Download
                  </a>
                </Button>
              )}
              {!v.isCurrent && item.capabilities.canEdit && (
                <>
                  <Button variant="subtle" size="sm" onClick={() => restore.mutate(v.id)} loading={restore.isPending && restore.variables === v.id}>
                    <RotateCcw /> Restore
                  </Button>
                  <Button variant="subtle" size="sm" className="text-danger" onClick={() => setConfirm({ id: v.id, n: v.versionNumber, size: v.size })}>
                    <Trash2 /> Delete
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete version ${confirm?.n}?`}
        description={`This version (${formatBytes(confirm?.size ?? 0)}) will be deleted forever. The current version isn’t affected.`}
        confirmLabel="Delete version"
        destructive
        loading={del.isPending}
        onConfirm={() => confirm && del.mutate(confirm.id, { onSettled: () => setConfirm(null) })}
      />
    </div>
  );
}

function Description({ item }: { item: DriveItemDto }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.description ?? '');
  useEffect(() => setText(item.description ?? ''), [item.id, item.description]);
  const save = useMutation({
    mutationFn: () => driveService.update(item.kind, item.id, { description: text.trim() || null }),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: qk.drive.all });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!item.capabilities.canEdit) {
    return item.description ? <p className="whitespace-pre-wrap text-sm">{item.description}</p> : <p className="text-sm text-muted">No description</p>;
  }
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="group flex w-full items-start gap-2 rounded-lg p-2 -m-2 text-left text-sm hover:bg-hover">
        <span className={cn('flex-1 whitespace-pre-wrap', !item.description && 'text-muted')}>{item.description || 'Add a description'}</span>
        <Pencil className="size-4 shrink-0 text-muted opacity-0 group-hover:opacity-100" />
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={4} aria-label="Description" onKeyDown={(e) => e.key === 'Escape' && setEditing(false)} />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => (setEditing(false), setText(item.description ?? ''))}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

function WhoHasAccess({ item }: { item: DriveItemDto }) {
  const actions = useItemActions();
  const s = useQuery({ queryKey: qk.drive.sharing(item.kind, item.id), queryFn: () => driveService.sharing(item.kind, item.id), enabled: !item.isTrashed });
  if (!s.data) return <Skeleton className="h-9 w-40" />;
  const people = [s.data.owner, ...s.data.permissions.map((p) => p.user).filter((u) => u.id !== s.data.owner.id)];
  const publicLink = s.data.generalAccess === 'ANYONE_WITH_LINK';
  return (
    <div>
      <div className="flex items-center gap-1">
        {people.slice(0, 6).map((p) => (
          <Avatar key={p.id} user={p} size={30} />
        ))}
        {people.length > 6 && <span className="ml-1 text-xs text-muted">+{people.length - 6}</span>}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        {publicLink ? <Globe2 className="size-3.5" /> : people.length > 1 ? <Users className="size-3.5" /> : <Lock className="size-3.5" />}
        {publicLink ? `Anyone with the link can ${s.data.link?.role === 'EDITOR' ? 'edit' : s.data.link?.role === 'COMMENTER' ? 'comment' : 'view'}` : people.length > 1 ? `Shared with ${people.length - 1} ${people.length === 2 ? 'person' : 'people'}` : 'Private to the owner'}
      </p>
      {item.capabilities.canShare && (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => actions.share(item)}>
          Manage access
        </Button>
      )}
    </div>
  );
}

function Preview({ item }: { item: DriveItemDto }) {
  const actions = useItemActions();
  const previewable = isPreviewable(item);
  return (
    <div className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-surface">
      <FileThumbnail key={item.id} item={item} iconSize={72} fit="contain" />
      {previewable && (
        <button onClick={() => actions.preview(item)} className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition hover:bg-black/30 hover:opacity-100 focus-visible:opacity-100" aria-label={`Preview ${item.name}`}>
          <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-foreground shadow-card">
            <Eye className="size-4" /> Preview
          </span>
        </button>
      )}
    </div>
  );
}

export function DetailsPanel({ item, onClose }: { item: DriveItemDto; onClose(): void }) {
  const actions = useItemActions();
  const star = useStarItem();
  const [starred, setStarred] = useState(item.isStarred);
  useEffect(() => setStarred(item.isStarred), [item.id, item.isStarred]);
  const isBlob = item.kind === 'file' && !['DOCUMENT', 'SPREADSHEET', 'FORM'].includes(item.fileType);
  const isRoot = item.kind === 'folder' && item.isRoot;
  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-background sm:w-[360px]" aria-label="Details">
      <header className="flex items-center gap-2 px-4 py-3">
        <FileIcon type={item.kind === 'folder' ? 'FOLDER' : item.fileType} size={24} />
        <h2 className="min-w-0 flex-1 truncate text-base" title={item.name}>
          {item.name}
        </h2>
        {!isRoot && !item.isTrashed && (
          <Tooltip content={starred ? 'Remove from starred' : 'Add to starred'}>
            <Button
              variant="subtle"
              size="icon-sm"
              onClick={() => {
                setStarred(!starred);
                star.mutate({ item, starred: !starred });
              }}
              aria-pressed={starred}
              aria-label={starred ? 'Remove from starred' : 'Add to starred'}
            >
              <Star className={cn(starred && 'fill-[#fbbc04] text-[#fbbc04]')} />
            </Button>
          </Tooltip>
        )}
        {isDownloadable(item) && (
          <Tooltip content="Download">
            <Button variant="subtle" size="icon-sm" onClick={() => actions.download([item])} aria-label="Download">
              <Download />
            </Button>
          </Tooltip>
        )}
        <Button variant="subtle" size="icon-sm" onClick={onClose} aria-label="Close details">
          <X />
        </Button>
      </header>
      <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="px-2">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          {isBlob && (
            <TabsTrigger value="versions">
              <History className="mr-1 inline size-4" />
              Versions
            </TabsTrigger>
          )}
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="details" className="space-y-6 p-4">
            {item.isSpam && (
              <div className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger" role="status">
                <OctagonAlert className="mt-0.5 size-4 shrink-0" />
                <span className="flex-1">You reported this as spam. It’s hidden everywhere except Spam.</span>
                <button className="shrink-0 font-medium underline" onClick={() => actions.notSpam([item])}>
                  Not spam
                </button>
              </div>
            )}
            <Preview item={item} />
            {!isRoot && (
              <section>
                <h3 className="mb-2 text-sm font-medium">Who has access</h3>
                <WhoHasAccess item={item} />
              </section>
            )}
            <section>
              <h3 className="mb-3 text-sm font-medium">{item.kind === 'folder' ? 'Folder details' : 'File details'}</h3>
              <dl className="space-y-4 text-sm">
                {[
                  ['Type', item.kind === 'folder' ? 'Folder' : FILE_TYPE_LABEL[item.fileType]],
                  ...(item.kind === 'file' && isBlob ? [['Size', formatBytes(item.size)], ['MIME type', item.mimeType]] : []),
                  ['Owner', item.owner.name],
                  ['Location', item.kind === 'file' ? (item.folderName ?? '—') : (item.parentName ?? '—')],
                  ['Modified', formatDate(item.updatedAt, true)],
                  ['Created', formatDate(item.createdAt, true)],
                  ['Your access', item.capabilities.role.charAt(0) + item.capabilities.role.slice(1).toLowerCase()],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="mt-0.5 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {!isRoot && (
              <section>
                <h3 className="mb-2 text-sm font-medium">Description</h3>
                <Description item={item} />
              </section>
            )}
          </TabsContent>
          <TabsContent value="activity">
            <ActivityList item={item} />
          </TabsContent>
          {isBlob && item.kind === 'file' && (
            <TabsContent value="versions">
              <Versions item={item} />
            </TabsContent>
          )}
        </div>
      </Tabs>
      <p className="border-t border-border px-4 py-2 text-xs text-muted">Last activity {formatRelative(item.updatedAt)}</p>
    </aside>
  );
}
