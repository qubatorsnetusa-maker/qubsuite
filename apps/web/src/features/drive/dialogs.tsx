import type { DriveItemDto, FolderRef } from '@qub/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FolderPlus, HardDrive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FileIcon } from '@/components/file-icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FieldError, Input } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { driveService } from '@/services/drive';
import { useCreateFolder, useMoveItems, useRenameItem } from './queries';

export function NewFolderDialog({ open, onOpenChange, parentId }: { open: boolean; onOpenChange: (o: boolean) => void; parentId?: string }) {
  const [name, setName] = useState('Untitled folder');
  const create = useCreateFolder();
  useEffect(() => {
    if (open) setName('Untitled folder');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New folder" className="max-w-sm">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await create.mutateAsync({ name: name.trim(), parentId });
            onOpenChange(false);
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onFocus={(e) => e.target.select()} aria-label="Folder name" maxLength={255} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RenameDialog({ item, onOpenChange }: { item: Pick<DriveItemDto, 'kind' | 'id' | 'name'> | null; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState('');
  const rename = useRenameItem();
  useEffect(() => {
    if (item) setName(item.name);
  }, [item]);
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent title="Rename" className="max-w-sm">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!item) return;
            await rename.mutateAsync({ item, name: name.trim() });
            onOpenChange(false);
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-label="New name"
            maxLength={255}
            onFocus={(e) => {
              // Select the base name without the extension, like Drive.
              const dot = item?.kind === 'file' ? name.lastIndexOf('.') : -1;
              e.target.setSelectionRange(0, dot > 0 ? dot : name.length);
            }}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={rename.isPending} disabled={!name.trim() || name.trim() === item?.name}>
              OK
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Folder picker that browses the real folder tree; the server validates the move. */
export function MoveDialog({ items, onOpenChange }: { items: Pick<DriveItemDto, 'kind' | 'id' | 'name'>[] | null; onOpenChange: (o: boolean) => void }) {
  const user = useCurrentUser();
  const [location, setLocation] = useState<string>(user.rootFolderId);
  const [path, setPath] = useState<FolderRef[]>([{ id: user.rootFolderId, name: 'My Drive' }]);
  const move = useMoveItems();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (items) {
      setLocation(user.rootFolderId);
      setPath([{ id: user.rootFolderId, name: 'My Drive' }]);
      setError(null);
    }
  }, [items, user.rootFolderId]);
  const listing = useQuery({
    queryKey: ['drive', 'move-picker', location],
    queryFn: () => driveService.list({ folderId: location, type: 'FOLDER', limit: 200, sort: 'name', order: 'asc' }),
    enabled: !!items,
  });
  const movingIds = new Set(items?.map((i) => i.id));
  const folders = (listing.data?.items ?? []).filter((f) => !movingIds.has(f.id));
  const enter = (f: FolderRef) => {
    setLocation(f.id);
    setPath((p) => [...p, f]);
  };
  return (
    <Dialog open={!!items} onOpenChange={onOpenChange}>
      <DialogContent title={items?.length === 1 ? `Move "${items[0]!.name}"` : `Move ${items?.length ?? 0} items`}>
        <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
          {path.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-4 text-subtle" />}
              <button
                className={cn('rounded px-1.5 py-0.5 hover:bg-hover', i === path.length - 1 && 'font-medium')}
                onClick={() => {
                  setLocation(p.id);
                  setPath((prev) => prev.slice(0, i + 1));
                }}
              >
                {i === 0 ? (
                  <span className="flex items-center gap-1">
                    <HardDrive className="size-4" /> My Drive
                  </span>
                ) : (
                  p.name
                )}
              </button>
            </span>
          ))}
        </nav>
        <ul className="mt-3 h-72 overflow-y-auto rounded-lg border border-border" aria-label="Folders">
          {listing.isLoading &&
            Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-1/2" />
              </li>
            ))}
          {!listing.isLoading && folders.length === 0 && <li className="flex h-full items-center justify-center text-sm text-muted">No folders here</li>}
          {folders.map((f) => (
            <li key={f.id}>
              <button onDoubleClick={() => enter(f)} onClick={() => enter(f)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-hover">
                <FileIcon type="FOLDER" size={20} />
                <span className="flex-1 truncate">{f.name}</span>
                <ChevronRight className="size-4 text-subtle" />
              </button>
            </li>
          ))}
        </ul>
        <FieldError message={error ?? undefined} />
        <DialogFooter>
          <NewFolderInline parentId={location} />
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={move.isPending}
            onClick={async () => {
              if (!items) return;
              try {
                await move.mutateAsync({ items, folderId: location, folderName: path.at(-1)?.name });
                onOpenChange(false);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewFolderInline({ parentId }: { parentId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="subtle" size="icon" onClick={() => setOpen(true)} aria-label="New folder here">
        <FolderPlus />
      </Button>
      <NewFolderDialog open={open} onOpenChange={setOpen} parentId={parentId} />
    </>
  );
}
