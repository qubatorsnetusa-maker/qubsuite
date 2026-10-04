export const FILE_TYPES = [
  'DOCUMENT',
  'SPREADSHEET',
  'FORM',
  'PDF',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'TEXT',
  'ARCHIVE',
  'OTHER',
] as const;
export type FileType = (typeof FILE_TYPES)[number];

/** File types backed by a Qub application resource rather than an uploaded blob. */
export const NATIVE_FILE_TYPES = ['DOCUMENT', 'SPREADSHEET', 'FORM'] as const satisfies readonly FileType[];
export type NativeFileType = (typeof NATIVE_FILE_TYPES)[number];

export const ROLES = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];
export const GRANTABLE_ROLES = ['EDITOR', 'COMMENTER', 'VIEWER'] as const;
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export const ROLE_RANK: Record<Role, number> = { OWNER: 4, EDITOR: 3, COMMENTER: 2, VIEWER: 1 };

export function roleAtLeast(role: Role | null | undefined, required: Role): boolean {
  return role != null && ROLE_RANK[role] >= ROLE_RANK[required];
}

export function maxRole(a: Role | null, b: Role | null): Role | null {
  if (!a) return b;
  if (!b) return a;
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

export const RESOURCE_TYPES = ['FILE', 'FOLDER'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** Stored general-access setting. "Private" is RESTRICTED with no collaborators (see `deriveVisibility`). */
export const GENERAL_ACCESS = ['RESTRICTED', 'ANYONE_WITH_LINK'] as const;
export type GeneralAccess = (typeof GENERAL_ACCESS)[number];

export const VISIBILITY = ['PRIVATE', 'RESTRICTED', 'ANYONE_WITH_LINK'] as const;
export type Visibility = (typeof VISIBILITY)[number];

export function deriveVisibility(access: GeneralAccess, collaboratorCount: number): Visibility {
  if (access === 'ANYONE_WITH_LINK') return 'ANYONE_WITH_LINK';
  return collaboratorCount > 0 ? 'RESTRICTED' : 'PRIVATE';
}

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Organization-wide role, separate from per-item sharing roles. Super admins manage the whole platform. */
export const PLATFORM_ROLES = ['USER', 'SUPER_ADMIN'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ACTIVITY_ACTIONS = [
  'FILE_CREATED',
  'FILE_OPENED',
  'FILE_EDITED',
  'FILE_SHARED',
  'FILE_MOVED',
  'FILE_RENAMED',
  'FILE_DELETED',
  'FILE_RESTORED',
  'FILE_DOWNLOADED',
  'FILE_COPIED',
  'FILE_PERMANENTLY_DELETED',
  'FILE_VERSION_UPLOADED',
  'FILE_VERSION_RESTORED',
  'FILE_VERSION_DELETED',
  'FOLDER_CREATED',
  'FOLDER_RENAMED',
  'FOLDER_MOVED',
  'FOLDER_DELETED',
  'FOLDER_RESTORED',
  'FOLDER_SHARED',
  'FOLDER_COPIED',
  'FOLDER_PERMANENTLY_DELETED',
  'PERMISSION_CHANGED',
  'PERMISSION_REMOVED',
  'LINK_SHARING_CHANGED',
  'COMMENT_ADDED',
  'FORM_PUBLISHED',
  'FORM_UNPUBLISHED',
  'FORM_RESPONSE_SUBMITTED',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const NOTIFICATION_TYPES = [
  'SHARED_WITH_YOU',
  'MENTIONED',
  'COMMENTED',
  'COMMENT_REPLIED',
  'PERMISSION_CHANGED',
  'FILE_MOVED',
  'FORM_RESPONSE',
  'COPY_COMPLETED',
  'STORAGE_CHANGED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const FORM_FIELD_TYPES = [
  // Original Google-Forms-style types (order preserved: the Postgres enum appends new values).
  'SHORT_ANSWER',
  'PARAGRAPH',
  'MULTIPLE_CHOICE',
  'CHECKBOXES',
  'DROPDOWN',
  'DATE',
  'TIME',
  'NUMBER',
  'EMAIL',
  'RATING',
  'LINEAR_SCALE',
  'FILE_UPLOAD',
  'SECTION',
  // Typeform-class types.
  'PHONE',
  'URL',
  'DATETIME',
  'YES_NO',
  'OPINION_SCALE',
  'NPS',
  'EMOJI_RATING',
  'SLIDER',
  'RANKING',
  'MATRIX',
  'IMAGE_CHOICE',
  'ADDRESS',
  'SIGNATURE',
  'CONSENT',
  'HIDDEN',
  'LOCATION',
  'STATEMENT',
  'IMAGE_BLOCK',
  'VIDEO_BLOCK',
  'WELCOME',
  'ENDING',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const CHOICE_FIELD_TYPES = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'] as const satisfies readonly FormFieldType[];
/** Types whose configuration includes rows in form_field_options. */
export const OPTION_FIELD_TYPES = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN', 'IMAGE_CHOICE', 'RANKING', 'MATRIX'] as const satisfies readonly FormFieldType[];
/** Types that never collect an answer and can never be required. HIDDEN collects a value but is never shown or required. */
export const NON_INPUT_FIELD_TYPES = ['SECTION', 'STATEMENT', 'IMAGE_BLOCK', 'VIDEO_BLOCK', 'WELCOME', 'ENDING'] as const satisfies readonly FormFieldType[];

export const LOGIC_OPERATORS = ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'ANSWERED', 'NOT_ANSWERED', 'ALWAYS'] as const;
export type LogicOperator = (typeof LOGIC_OPERATORS)[number];

export const LEGACY_LOGIC_ACTIONS = ['GO_TO_SECTION', 'SUBMIT_FORM'] as const;
export const LOGIC_ACTIONS = [
  'GO_TO_SECTION',
  'SUBMIT_FORM',
  'SHOW',
  'HIDE',
  'JUMP_TO_FIELD',
  'END_FORM',
  'REDIRECT',
  'SHOW_MESSAGE',
  'SET_VARIABLE',
  'CALCULATE',
] as const;
export type LogicAction = (typeof LOGIC_ACTIONS)[number];
export const NAVIGATION_ACTIONS = ['GO_TO_SECTION', 'SUBMIT_FORM', 'JUMP_TO_FIELD', 'END_FORM', 'REDIRECT'] as const satisfies readonly LogicAction[];

export const LOGIC_TRIGGERS = ['ON_LEAVE', 'VISIBILITY'] as const;
export type LogicTrigger = (typeof LOGIC_TRIGGERS)[number];
export const LOGIC_SCOPES = ['FIELD', 'SECTION'] as const;
export type LogicScope = (typeof LOGIC_SCOPES)[number];

export const CONDITION_OPS = ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'ends_with', 'gt', 'lt', 'gte', 'lte', 'answered', 'unanswered'] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

export const VARIABLE_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE'] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

export const FORM_LAYOUTS = ['classic', 'conversational'] as const;
export type FormLayout = (typeof FORM_LAYOUTS)[number];

export const OPTION_KINDS = ['option', 'row', 'column'] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];

export const CELL_DATA_TYPES = ['EMPTY', 'NUMBER', 'STRING', 'BOOLEAN', 'ERROR'] as const;
export type CellDataType = (typeof CELL_DATA_TYPES)[number];

export const DRIVE_SORT_FIELDS = ['name', 'updatedAt', 'createdAt', 'size'] as const;
export type DriveSortField = (typeof DRIVE_SORT_FIELDS)[number];
