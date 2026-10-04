import type { ActivityDto } from '@qub/shared';

const ACTION_TEXT: Record<string, string> = {
  FILE_CREATED: 'created',
  FILE_OPENED: 'opened',
  FILE_EDITED: 'edited',
  FILE_SHARED: 'shared',
  FILE_MOVED: 'moved',
  FILE_RENAMED: 'renamed',
  FILE_DELETED: 'moved to trash',
  FILE_RESTORED: 'restored',
  FILE_DOWNLOADED: 'downloaded',
  FILE_COPIED: 'created a copy of',
  FILE_PERMANENTLY_DELETED: 'permanently deleted',
  FILE_VERSION_UPLOADED: 'uploaded a new version of',
  FILE_VERSION_RESTORED: 'restored a version of',
  FILE_VERSION_DELETED: 'deleted an old version of',
  FOLDER_CREATED: 'created',
  FOLDER_RENAMED: 'renamed',
  FOLDER_MOVED: 'moved',
  FOLDER_DELETED: 'moved to trash',
  FOLDER_RESTORED: 'restored',
  FOLDER_SHARED: 'shared',
  FOLDER_COPIED: 'copied',
  FOLDER_PERMANENTLY_DELETED: 'permanently deleted',
  PERMISSION_CHANGED: 'changed access to',
  PERMISSION_REMOVED: 'removed access to',
  LINK_SHARING_CHANGED: 'changed link sharing for',
  COMMENT_ADDED: 'commented on',
  FORM_PUBLISHED: 'published',
  FORM_UNPUBLISHED: 'unpublished',
  FORM_RESPONSE_SUBMITTED: 'received a response on',
};

/** "renamed “a” to “b”", "shared with x@y.com as editor", "edited" — without the item name when `withName` is false. */
export function describeActivity(a: Pick<ActivityDto, 'action' | 'metadata' | 'resourceName'>, withName = true): string {
  const m = a.metadata as Record<string, unknown>;
  if (a.action.endsWith('RENAMED') && m.from) return `renamed “${String(m.from)}” to “${String(m.to)}”`;
  if (a.action.endsWith('SHARED') && m.email) return `shared${withName && a.resourceName ? ` “${a.resourceName}”` : ''} with ${String(m.email)} as ${String(m.role).toLowerCase()}`;
  if (a.action === 'FILE_VERSION_DELETED' && m.versionNumber) return `deleted version ${String(m.versionNumber)}${withName && a.resourceName ? ` of “${a.resourceName}”` : ''}`;
  const verb = ACTION_TEXT[a.action] ?? a.action.toLowerCase().replace(/_/g, ' ');
  return withName && a.resourceName ? `${verb} “${a.resourceName}”` : verb;
}
