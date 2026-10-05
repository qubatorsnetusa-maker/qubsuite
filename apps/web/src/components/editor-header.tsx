import type { FileType } from '@qub/shared';
import { Link } from '@tanstack/react-router';
import { CloudOff, Check, Loader2, Lock, UserPlus, WifiOff, AlertTriangle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { FileIcon } from './file-icon';
import { Button } from './ui/button';
import { Avatar, Tooltip } from './ui/misc';
import { UserMenu } from './user-menu';
import { cn, formatRelative } from '@/lib/utils';

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'connection-lost' | 'error' | 'failed';

export function SaveIndicator({ status, lastSavedAt, onRetry }: { status: SaveStatus; lastSavedAt?: string | null; onRetry?: () => void }) {
  const content: Record<SaveStatus, { icon: ReactNode; text: string; tone: string }> = {
    saved: { icon: <Check className="size-4" />, text: lastSavedAt ? `Saved ${formatRelative(lastSavedAt)}` : 'All changes saved', tone: 'text-muted' },
    saving: { icon: <Loader2 className="size-4 animate-spin" />, text: 'Saving…', tone: 'text-muted' },
    offline: { icon: <WifiOff className="size-4" />, text: 'Offline — changes kept on this device', tone: 'text-warning' },
    'connection-lost': { icon: <CloudOff className="size-4" />, text: 'Connection lost — reconnecting…', tone: 'text-warning' },
    error: { icon: <AlertTriangle className="size-4" />, text: 'Couldn’t save — retrying', tone: 'text-danger' },
    failed: { icon: <AlertTriangle className="size-4" />, text: 'Save failed', tone: 'text-danger' },
  };
  const c = content[status];
  return (
    <span className={cn('flex items-center gap-1.5 whitespace-nowrap text-xs', c.tone)} role="status" aria-live="polite">
      {c.icon}
      <span className="hidden sm:inline">{c.text}</span>
      {status === 'failed' && onRetry && (
        <button type="button" onClick={onRetry} className="rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-hover">
          Retry
        </button>
      )}
    </span>
  );
}

export function EditableTitle({ value, onSave, disabled }: { value: string; onSave(v: string): Promise<unknown> | void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim();
    if (!v) setDraft(value);
    else if (v !== value) void onSave(v);
  };
  return (
    <input
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-label="Title"
      maxLength={255}
      className="min-w-0 max-w-[40ch] truncate rounded px-1.5 py-0.5 text-lg outline-none hover:ring-1 hover:ring-border focus:ring-2 focus:ring-primary disabled:hover:ring-0"
      size={Math.max(8, Math.min(40, draft.length + 1))}
    />
  );
}

export interface PresenceUser {
  key: string | number;
  name: string;
  avatarUrl: string | null;
  color: string;
}

export function PresenceAvatars({ users }: { users: PresenceUser[] }) {
  const shown = users.slice(0, 4);
  return (
    <div className="flex -space-x-2" aria-label={`${users.length} other ${users.length === 1 ? 'person' : 'people'} here`}>
      {shown.map((u) => (
        <Tooltip key={u.key} content={u.name}>
          <span>
            <Avatar user={u} size={30} ring={u.color} />
          </span>
        </Tooltip>
      ))}
      {users.length > shown.length && <span className="flex size-[30px] items-center justify-center rounded-full bg-surface-2 text-xs ring-2 ring-white">+{users.length - shown.length}</span>}
    </div>
  );
}

function serviceHomePath(fileType: FileType): string {
  switch (fileType) {
    case 'DOCUMENT':
      return '/docs';
    case 'SPREADSHEET':
      return '/sheets';
    case 'FORM':
      return '/forms';
    default:
      return '/drive';
  }
}

export function EditorHeader({
  fileType,
  title,
  onRename,
  canEdit,
  status,
  menus,
  presence,
  onShare,
  actions,
  readOnlyLabel,
}: {
  fileType: FileType;
  title: string;
  onRename(v: string): Promise<unknown> | void;
  canEdit: boolean;
  status?: ReactNode;
  menus?: ReactNode;
  presence?: PresenceUser[];
  onShare?(): void;
  actions?: ReactNode;
  readOnlyLabel?: string;
}) {
  return (
    <header className="flex items-center gap-2 px-3 pb-1 pt-2">
      <Link to={serviceHomePath(fileType) as any} aria-label="Back to home" className="shrink-0 rounded-lg p-1 hover:bg-hover">
        <FileIcon type={fileType} size={36} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-3">
          <EditableTitle value={title} onSave={onRename} disabled={!canEdit} />
          {status}
          {readOnlyLabel && (
            <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
              <Lock className="size-3" /> {readOnlyLabel}
            </span>
          )}
        </div>
        {menus && <nav className="flex items-center gap-0.5 text-sm">{menus}</nav>}
      </div>
      {presence && presence.length > 0 && <PresenceAvatars users={presence} />}
      {actions}
      {onShare && (
        <Button variant="secondary" onClick={onShare} className="ml-1">
          <UserPlus /> <span className="hidden sm:inline">Share</span>
        </Button>
      )}
      <UserMenu />
    </header>
  );
}
