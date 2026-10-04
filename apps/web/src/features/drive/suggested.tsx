import type { SuggestedItemDto } from '@qub/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { FileIcon } from '@/components/file-icon';
import { Skeleton } from '@/components/ui/misc';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { cn, formatRelative } from '@/lib/utils';
import { driveService } from '@/services/drive';
import { qk } from '@/services/query-keys';
import { PreviewThumbnail } from '../app-home/thumbnails';
import { setDragItems } from './dnd';
import { FileThumbnail } from './file-thumbnail';
import { useItemActions } from './item-actions';
import { ItemMenuButton } from './items-view';

function reasonText(r: SuggestedItemDto['reason']): string {
  const when = formatRelative(r.at);
  const who = r.actor?.name;
  switch (r.kind) {
    case 'opened':
      return `You opened · ${when}`;
    case 'created':
      return `You created · ${when}`;
    case 'edited':
      return who ? `${who} edited · ${when}` : `You edited · ${when}`;
    case 'commented':
      return `${who ?? 'Someone'} commented · ${when}`;
    case 'shared':
      return `${who ?? 'Someone'} shared with you · ${when}`;
  }
}

function Card({ item }: { item: SuggestedItemDto }) {
  const actions = useItemActions();
  return (
    <div
      role="listitem"
      className="group flex min-w-0 flex-col rounded-xl bg-surface-2 p-2 pt-0 text-left transition-colors hover:bg-[#e1e5ea] focus-within:ring-2 focus-within:ring-primary"
      draggable={item.capabilities.canEdit}
      onDragStart={(e) => setDragItems(e, [{ kind: 'file', id: item.id, name: item.name }])}
    >
      <div className="flex h-11 items-center gap-2.5 px-1.5">
        <FileIcon type={item.fileType} size={20} />
        <button onClick={() => actions.open(item)} className="min-w-0 flex-1 truncate text-left text-sm font-medium outline-none" title={item.name}>
          {item.name}
        </button>
        <ItemMenuButton item={item} />
      </div>
      <button onClick={() => actions.open(item)} className="aspect-[16/10] overflow-hidden rounded-lg bg-background outline-none" tabIndex={-1} aria-hidden>
        {item.preview ? <PreviewThumbnail title={item.name} preview={item.preview} className="size-full" /> : <FileThumbnail item={item} iconSize={56} />}
      </button>
      <p className="truncate px-1.5 pt-2 text-xs text-muted">{reasonText(item.reason)}</p>
    </div>
  );
}

/** "Suggested" row at the top of My Drive: files the user recently worked on or that others changed or shared. */
export function SuggestedSection() {
  const [collapsed, setCollapsed] = useLocalPreference<'open' | 'closed'>('qub.drive.suggested.collapsed', 'open', ['open', 'closed']);
  const q = useQuery({ queryKey: qk.drive.suggested, queryFn: driveService.suggested, staleTime: 60_000, refetchOnWindowFocus: 'always' });
  if (q.isSuccess && q.data.length === 0) return null;
  if (q.error) return null;
  const open = collapsed === 'open';
  return (
    <section className="mb-2" aria-label="Suggested files">
      <button onClick={() => setCollapsed(open ? 'closed' : 'open')} className="mb-2 flex items-center gap-1 rounded-full py-1 pl-1 pr-3 text-sm font-medium hover:bg-hover" aria-expanded={open}>
        <ChevronDown className={cn('size-5 transition-transform', !open && '-rotate-90')} />
        Suggested
      </button>
      {open && (
        // One row: as many cards as fit the width; the rest are hidden rather than wrapping.
        <div className="grid auto-rows-[0] grid-cols-[repeat(auto-fill,minmax(210px,1fr))] grid-rows-[auto] gap-x-3 gap-y-0 overflow-hidden" role="list">
          {q.isLoading ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-44 rounded-xl" />) : q.data!.map((item) => <Card key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}
