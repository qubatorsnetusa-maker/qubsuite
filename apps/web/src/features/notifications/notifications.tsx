import type { NotificationDto, NotificationServerMessage } from '@qub/shared';
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Bell, CheckCheck, FileText, FolderInput, MessageSquare, Share2, ShieldCheck, Inbox, AtSign, Copy, HardDrive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, Popover, PopoverContent, PopoverTrigger, Spinner } from '@/components/ui/misc';
import { ReconnectingSocket } from '@/lib/reconnecting-socket';
import { cn, formatRelative } from '@/lib/utils';
import { notificationsService } from '@/services/notifications';
import { qk } from '@/services/query-keys';

type Page = Awaited<ReturnType<typeof notificationsService.list>>;

const ICONS: Record<NotificationDto['type'], typeof Bell> = {
  SHARED_WITH_YOU: Share2,
  MENTIONED: AtSign,
  COMMENTED: MessageSquare,
  COMMENT_REPLIED: MessageSquare,
  PERMISSION_CHANGED: ShieldCheck,
  FILE_MOVED: FolderInput,
  FORM_RESPONSE: Inbox,
  COPY_COMPLETED: Copy,
  STORAGE_CHANGED: HardDrive,
};

/** Subscribes to the user's notification channel and keeps the cache (and unread badge) live. */
export function useNotificationStream() {
  const qc = useQueryClient();
  const [unread, setUnread] = useState<number | null>(null);
  useEffect(() => {
    const socket = new ReconnectingSocket<NotificationServerMessage, { type: 'ping' }>({
      path: '/notifications',
      onMessage: (msg) => {
        if (msg.type === 'unreadCount') setUnread(msg.unreadCount);
        if (msg.type === 'notification') {
          setUnread(msg.unreadCount);
          qc.setQueryData<InfiniteData<Page>>(qk.notifications, (data) =>
            data ? { ...data, pages: data.pages.map((p, i) => (i === 0 ? { ...p, items: [msg.notification, ...p.items.filter((n) => n.id !== msg.notification.id)] } : p)) } : data,
          );
          toast(msg.notification.title, { description: msg.notification.body ?? undefined, icon: <Bell className="size-4" /> });
          // Something was shared, moved or created for us: Drive views may have changed.
          if (['SHARED_WITH_YOU', 'FILE_MOVED', 'COPY_COMPLETED', 'PERMISSION_CHANGED'].includes(msg.notification.type)) void qc.invalidateQueries({ queryKey: qk.drive.all });
        }
      },
    });
    return () => socket.close();
  }, [qc]);
  return unread;
}

export function NotificationsBell() {
  const unread = useNotificationStream();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useInfiniteQuery({
    queryKey: qk.notifications,
    queryFn: ({ pageParam }) => notificationsService.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: open,
  });
  const markAll = useMutation({
    mutationFn: notificationsService.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
  const markOne = useMutation({ mutationFn: (id: string) => notificationsService.markRead([id]) });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const count = unread ?? list.data?.pages[0]?.unreadCount ?? 0;

  const openItem = async (n: NotificationDto) => {
    if (!n.readAt) markOne.mutate(n.id);
    setOpen(false);
    if (n.link) await navigate({ href: n.link });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative rounded-full p-2.5 text-muted hover:bg-hover" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}>
          <Bell className="size-6" />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] max-w-[calc(100vw-1rem)] p-0">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-medium">Notifications</h2>
          <Button variant="subtle" size="sm" onClick={() => markAll.mutate()} disabled={!count}>
            <CheckCheck /> Mark all read
          </Button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto">
          {list.isLoading && (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          )}
          {!list.isLoading && items.length === 0 && <p className="p-8 text-center text-sm text-muted">You’re all caught up.</p>}
          <ul>
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? FileText;
              return (
                <li key={n.id}>
                  <button onClick={() => void openItem(n)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-hover', !n.readAt && 'bg-[#f2f6fc]')}>
                    {n.actor ? <Avatar user={n.actor} size={36} /> : <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-primary"><Icon className="size-5" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{n.title}</span>
                      {n.body && <span className="mt-0.5 block truncate text-[13px] text-muted">{n.body}</span>}
                      <span className="mt-1 flex items-center gap-1 text-xs text-subtle">
                        <Icon className="size-3.5" /> {formatRelative(n.createdAt)}
                      </span>
                    </span>
                    {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {list.hasNextPage && (
            <div className="p-2 text-center">
              <Button variant="subtle" size="sm" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
