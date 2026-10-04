import type {
  ActivityAction,
  CellDataType,
  FileType,
  FormFieldType,
  GeneralAccess,
  GrantableRole,
  LogicOperator,
  NotificationType,
  PlatformRole,
  ResourceType,
  Role,
  UserStatus,
  Visibility,
} from './enums';
import type { AssignedKeys } from './forms/ops-validate';
import type { EngineField, EngineOption, EngineRule, EngineVariable } from './forms/types';
import type { AnswerValue, CellStyle, ConditionValue, EmailProvider, FormSettings, OrgPolicies, QuotaMode } from './schemas';
import type { FormThemeExtras } from './schemas/forms';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface CurrentUser extends UserSummary {
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  rootFolderId: string;
  platformRole: PlatformRole;
  isPro?: boolean;
}

export interface AuthResult {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: CurrentUser;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

/** Capabilities of the current user on a resource, computed server-side. */
export interface Capabilities {
  role: Role;
  canEdit: boolean;
  canComment: boolean;
  canShare: boolean;
  canDownload: boolean;
  canCopy: boolean;
  canTrash: boolean;
}

export interface FolderRef {
  id: string;
  name: string;
}

export interface DriveFileDto {
  kind: 'file';
  id: string;
  name: string;
  fileType: FileType;
  mimeType: string;
  size: number;
  description: string | null;
  owner: UserSummary;
  folderId: string | null;
  folderName?: string | null;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  /** In the viewer's Spam. */
  isSpam: boolean;
  /** Someone else's item shared directly with the viewer: it can be reported as spam or removed from their Drive. */
  sharedWithMe: boolean;
  thumbnailUrl: string | null;
  /** Id of the Docs/Sheets/Forms resource backed by this file. */
  resourceId: string | null;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string | null;
  expiresAt?: string | null;
  capabilities: Capabilities;
}

export interface DriveFolderDto {
  kind: 'folder';
  id: string;
  name: string;
  description: string | null;
  owner: UserSummary;
  parentId: string | null;
  parentName?: string | null;
  isRoot: boolean;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  /** In the viewer's Spam. */
  isSpam: boolean;
  /** Someone else's folder shared directly with the viewer: it can be reported as spam or removed from their Drive. */
  sharedWithMe: boolean;
  createdAt: string;
  updatedAt: string;
  capabilities: Capabilities;
}

export type DriveItemDto = DriveFileDto | DriveFolderDto;

export interface FolderDetailDto extends DriveFolderDto {
  /** From the root (or the highest accessible ancestor) down to this folder. */
  path: FolderRef[];
}

export interface DriveListResult {
  folder: FolderDetailDto | null;
  items: DriveItemDto[];
  nextCursor: string | null;
}

/** A glimpse of a file's current content for app home-page thumbnails. */
export type LibraryPreview =
  /** The first top-level blocks of the document (Tiptap JSON). */
  | { kind: 'document'; blocks: unknown[] }
  /** Top-left cells of the first worksheet. */
  | { kind: 'spreadsheet'; cells: Pick<CellDto, 'row' | 'col' | 'formattedValue' | 'style'>[] }
  | { kind: 'form'; description: string | null; primaryColor: string; backgroundColor: string; fields: { type: FormFieldType; label: string }[] };

export interface LibraryItemDto extends DriveFileDto {
  preview: LibraryPreview | null;
}

export interface LibraryResult {
  items: LibraryItemDto[];
  nextCursor: string | null;
}

export interface FileVersionDto {
  id: string;
  versionNumber: number;
  size: number;
  checksum: string;
  mimeType: string;
  createdBy: UserSummary;
  createdAt: string;
  isCurrent: boolean;
}

export interface PermissionDto {
  id: string;
  user: UserSummary;
  role: Role;
  canShare: boolean;
  canDownload: boolean;
  canCopy: boolean;
  /** Set when the grant is inherited from a parent folder. */
  inheritedFrom: FolderRef | null;
  createdAt: string;
}

export interface PendingInviteDto {
  id: string;
  email: string;
  role: GrantableRole;
  createdAt: string;
}

export interface ShareLinkDto {
  id: string;
  token: string;
  url: string;
  role: GrantableRole;
  hasPassword: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface SharingStateDto {
  resourceType: ResourceType;
  resourceId: string;
  owner: UserSummary;
  generalAccess: GeneralAccess;
  visibility: Visibility;
  permissions: PermissionDto[];
  pendingInvites: PendingInviteDto[];
  link: ShareLinkDto | null;
  capabilities: Capabilities;
  /** Organization sharing policy, so the share dialog only offers what is allowed. */
  policy: { allowPublicLinks: boolean; maxLinkRole: GrantableRole; allowExternalInvites: boolean; allowedDomains: string[] };
}

export interface ActivityDto {
  id: string;
  action: ActivityAction;
  actor: UserSummary | null;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Activity across everything the user can reach, with enough about the item to show and open it. */
export interface DriveActivityItemDto extends ActivityDto {
  item: {
    kind: 'file' | 'folder';
    id: string;
    name: string;
    fileType: FileType | 'FOLDER';
    resourceId: string | null;
    /** False once the item is in the trash or deleted (it can no longer be opened from here). */
    available: boolean;
  } | null;
}

/** The signed-in user's own storage, as shown on Drive's Storage page and sidebar meter. */
export interface DriveStorageDto {
  usedBytes: number;
  /** null = unlimited. */
  quotaBytes: number | null;
  quotaSource: QuotaMode;
  breakdown: { key: string; label: string; bytes: number }[];
  trash: { bytes: number; items: number };
  olderVersions: { bytes: number; files: number };
  /** Uploaded files the user owns, largest first, counting every stored version. */
  largestFiles: (DriveFileDto & { storedBytes: number; versions: number })[];
}

/** A file surfaced in My Drive's "Suggested" row, with why it was suggested. */
export interface SuggestedItemDto extends DriveFileDto {
  reason: { kind: 'opened' | 'edited' | 'created' | 'shared' | 'commented'; actor: UserSummary | null; at: string };
  preview: LibraryPreview | null;
}

export interface BlockedUserDto extends UserSummary {
  blockedAt: string;
}

export interface FolderTreeResult {
  /** Created folder id for every requested path ("Trip", "Trip/Photos", …). */
  folders: Record<string, string>;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  actor: UserSummary | null;
  readAt: string | null;
  createdAt: string;
}

// ---------- Docs ----------

export interface DocumentDto {
  id: string;
  fileId: string;
  title: string;
  folderId: string | null;
  owner: UserSummary;
  content: unknown;
  isTrashed: boolean;
  createdAt: string;
  updatedAt: string;
  capabilities: Capabilities;
}

export interface DocumentVersionDto {
  id: string;
  versionNumber: number;
  name: string | null;
  createdBy: UserSummary | null;
  createdAt: string;
  wordCount: number;
}

export interface CommentReplyDto {
  id: string;
  author: UserSummary;
  body: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
}

export interface CommentDto {
  id: string;
  anchorId: string;
  quotedText: string;
  body: string;
  mentions: string[];
  author: UserSummary;
  resolved: boolean;
  resolvedBy: UserSummary | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  replies: CommentReplyDto[];
}

export interface SuggestionDto {
  id: string;
  anchorId: string;
  originalText: string;
  suggestedText: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  author: UserSummary;
  resolvedBy: UserSummary | null;
  createdAt: string;
}

export interface CollaboratorDto {
  user: UserSummary;
  role: Role;
  color: string;
}

// ---------- Sheets ----------

export interface WorksheetDto {
  id: string;
  name: string;
  position: number;
  rowCount: number;
  colCount: number;
  frozenRows: number;
  frozenCols: number;
  colWidths: Record<string, number>;
  rowHeights: Record<string, number>;
}

export interface SpreadsheetDto {
  id: string;
  fileId: string;
  title: string;
  folderId: string | null;
  owner: UserSummary;
  isTrashed: boolean;
  revision: number;
  sheets: WorksheetDto[];
  createdAt: string;
  updatedAt: string;
  capabilities: Capabilities;
}

export interface CellDto {
  row: number;
  col: number;
  /** Raw user input: the formula (with leading '=') or the literal. */
  input: string;
  value: string | number | boolean | null;
  formattedValue: string;
  dataType: CellDataType;
  style: CellStyle | null;
}

export interface CellsResult {
  sheetId: string;
  revision: number;
  cells: CellDto[];
}

/** Everything needed to print one sheet: its layout and every non-empty or formatted cell. */
export interface SheetPrintData {
  spreadsheetTitle: string;
  sheet: WorksheetDto;
  cells: CellDto[];
}

export interface SpreadsheetVersionDto {
  id: string;
  versionNumber: number;
  name: string | null;
  createdBy: UserSummary | null;
  createdAt: string;
  cellCount: number;
}

export interface SheetCommentDto {
  id: string;
  sheetId: string;
  row: number;
  col: number;
  parentId: string | null;
  body: string;
  author: UserSummary;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- Forms ----------

export interface FormFieldOptionDto extends EngineOption {
  position: number;
}

export interface FormLogicRuleDto extends EngineRule {
  id: string;
  fieldId: string;
  /** Legacy columns; null for rules created by the new logic editor. */
  operator: LogicOperator | null;
  value: string | null;
}

export interface FormFieldDto extends EngineField {
  options: FormFieldOptionDto[];
  rules: FormLogicRuleDto[];
}

export type FormVariableDto = EngineVariable;

export interface FormThemeDto {
  primaryColor: string;
  backgroundColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  headerImageUrl: string | null;
  extras?: FormThemeExtras;
}

export interface FormDto {
  id: string;
  fileId: string;
  publicId: string;
  title: string;
  description: string | null;
  folderId: string | null;
  owner: UserSummary;
  isPublished: boolean;
  acceptingResponses: boolean;
  publishedAt: string | null;
  settings: Required<FormSettings>;
  theme: FormThemeDto;
  fields: FormFieldDto[];
  variables: FormVariableDto[];
  responseCount: number;
  isTrashed: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
  capabilities: Capabilities;
}

/** Result of `POST /api/forms/:id/ops`. `assigned` lists keys the server changed because they were already taken. */
export interface ApplyOpsResult {
  revision: number;
  form: FormDto;
  assigned: AssignedKeys;
}

/** What a respondent sees. No owner details or unpublished state. */
export interface PublicFormDto {
  publicId: string;
  title: string;
  description: string | null;
  settings: FormDto['settings'];
  theme: FormThemeDto;
  fields: FormFieldDto[];
  variables: FormVariableDto[];
  acceptingResponses: boolean;
  alreadyResponded: boolean;
  signedInEmail: string | null;
}

export interface FormAnswerDto {
  fieldId: string;
  value: AnswerValue;
  files?: { id: string; name: string; size: number }[];
}

export interface FormResponseDto {
  id: string;
  respondent: UserSummary | null;
  email: string | null;
  submittedAt: string;
  answers: FormAnswerDto[];
  score: number | null;
  computed: Record<string, ConditionValue>;
  endingId: string | null;
}

export interface SubmitResponseResult {
  id: string;
  /** Same as `message`; kept for older clients. */
  confirmationMessage: string;
  endingId: string | null;
  title: string | null;
  message: string;
  redirectUrl: string | null;
  /** The ending's link button (absent from older servers). */
  endingButtonUrl?: string | null;
  /** The ending's own redirect; the page waits `redirectDelay` seconds from the ending's settings. */
  endingRedirectUrl?: string | null;
  /** Only when the quiz is set to show scores. */
  score: number | null;
}

export interface FieldAnalyticsDto {
  fieldId: string;
  label: string;
  type: FormFieldType;
  answered: number;
  skipped: number;
  /** Choice / rating / scale distributions. */
  distribution?: { key: string; label: string; count: number; percentage: number }[];
  numeric?: { average: number | null; min: number | null; max: number | null; median: number | null; sum: number | null };
  /** Latest free-text answers (capped). */
  samples?: string[];
  nps?: { promoters: number; passives: number; detractors: number; score: number };
  matrix?: { rowId: string; label: string; distribution: { key: string; label: string; count: number; percentage: number }[] }[];
  ranking?: { key: string; label: string; averageRank: number }[];
}

export interface FormAnalyticsDto {
  totalResponses: number;
  views: number;
  /** Responses divided by unique form views (0..1), null when there are no views. */
  responseRate: number | null;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  trend: { date: string; count: number }[];
  fields: FieldAnalyticsDto[];
}

// ---------- Search ----------

export interface SearchResultDto {
  kind: 'file' | 'folder';
  id: string;
  name: string;
  fileType: FileType | 'FOLDER';
  mimeType: string | null;
  owner: UserSummary;
  location: FolderRef | null;
  resourceId: string | null;
  updatedAt: string;
  rank: number;
}

// ---------- Public share ----------

export interface PublicShareDto {
  resourceType: ResourceType;
  role: GrantableRole;
  name: string;
  owner: UserSummary;
  requiresPassword: boolean;
  /** Present once the password (if any) is satisfied. */
  accessToken: string | null;
  expiresAt?: string | null;
  isPermanent?: boolean;
  file?: { id: string; fileType: FileType; mimeType: string; size: number; resourceId: string | null; updatedAt: string; expiresAt?: string | null };
  folder?: { id: string; items: { kind: 'file' | 'folder'; id: string; name: string; fileType: FileType | 'FOLDER'; size: number }[] };
}

// ---------- admin console ----------

export interface AdminUserDto extends UserSummary {
  platformRole: PlatformRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  /** Bytes stored for everything the user owns (all file versions, images in Docs, form uploads). */
  storageUsed: number;
  /** The quota that applies (own override, else the organization default); null = unlimited. */
  storageQuota: number | null;
  /** The user's own override, if any. */
  quotaOverride: number | null;
  /** Where the quota comes from: the organization default, the user's own size, or no limit at all. */
  quotaMode: QuotaMode;
  ownedFiles: number;
  activeSessions: number;
}

/** Email delivery settings as shown to admins: secrets are never included, only whether one is stored. */
export interface EmailSettingsDto {
  /** The saved settings without passwords or API keys. */
  settings: { provider: EmailProvider } & Record<string, unknown>;
  hasSecret: boolean;
  /** What "Server default" means on this server (from its environment). */
  environment: { transport: 'console' | 'smtp'; from: string; host: string | null };
  lastTestAt: string | null;
  /** Error from the last test, or null when it succeeded. */
  lastTestError: string | null;
  updatedAt: string | null;
  updatedBy: UserSummary | null;
}

export interface AdminAlertDto {
  /** Stable per condition, so the UI can link and dedupe. */
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  /** Admin section that resolves it. */
  section: 'users' | 'storage' | 'security' | 'content' | 'audit';
  at: string;
}

export interface AdminAuditEventDto {
  id: string;
  createdAt: string;
  actor: UserSummary | null;
  event: string;
  category: 'auth' | 'sharing' | 'admin' | 'other';
  severity: 'info' | 'warning' | 'critical';
  targetType: string | null;
  targetId: string | null;
  /** Human-readable target (user email, item name) resolved at read time. */
  targetLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

export interface AdminActivityDto {
  id: string;
  createdAt: string;
  user: UserSummary | null;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  /** The app the item belongs to (from its current file type), or DRIVE for folders and uploads. */
  app: 'DOCUMENT' | 'SPREADSHEET' | 'FORM' | 'DRIVE';
  metadata: Record<string, unknown>;
}

export interface AdminOverviewDto {
  users: { total: number; active: number; suspended: number; superAdmins: number; newLast30Days: number; signedInLast7Days: number };
  content: { documents: number; spreadsheets: number; forms: number; uploads: number; folders: number; trashed: number };
  forms: { published: number; responses: number; responsesLast7Days: number };
  sharing: { publicLinks: number; directShares: number; pendingInvites: number };
  storage: { usedBytes: number; quotaBytes: number | null };
  /** Activity events per day for the last 14 days (oldest first), split by app. */
  activity: { date: string; DOCUMENT: number; SPREADSHEET: number; FORM: number; DRIVE: number }[];
  recentAudit: AdminAuditEventDto[];
  alerts: AdminAlertDto[];
}

export interface AdminStorageDto {
  usedBytes: number;
  /** Sum of every user's effective quota; null when any user is unlimited. */
  allocatedBytes: number | null;
  breakdown: { key: string; label: string; bytes: number }[];
  topUsers: AdminUserDto[];
  largestFiles: { id: string; name: string; fileType: FileType; owner: UserSummary; bytes: number; versions: number; isTrashed: boolean }[];
}

export interface AdminContentItemDto {
  id: string;
  name: string;
  fileType: FileType;
  mimeType: string;
  owner: UserSummary;
  /** Stored bytes, including previous versions and embedded images/uploads. */
  bytes: number;
  isTrashed: boolean;
  generalAccess: 'RESTRICTED' | 'ANYONE_WITH_LINK';
  sharedWith: number;
  createdAt: string;
  updatedAt: string;
  location: string | null;
  /** App-specific facts. */
  details: { wordCount?: number; sheets?: number; cells?: number; published?: boolean; responses?: number; questions?: number; versions?: number };
}

export interface AdminSessionDto {
  id: string;
  user: UserSummary;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}

export interface AdminSecurityDto {
  activeSessions: number;
  usersWithSessions: number;
  failedLogins24h: number;
  /** Accounts with repeated failed sign-ins in the last 24 hours. */
  failedLoginAccounts: { email: string; attempts: number; lastAt: string }[];
  tokenReuse7d: number;
  policies: OrgPolicies['security'];
}

export interface AdminSystemDto {
  organizationName: string;
  appUrl: string;
  environment: string;
  storageProvider: string;
  mailTransport: string;
  serverMaxUploadMb: number;
  trashJobIntervalMinutes: number;
  nodeVersion: string;
  postgresVersion: string;
  databaseBytes: number;
  uptimeSeconds: number;
}

export const KINGSCHAT_ENVIRONMENTS = ['prod', 'staging', 'dev'] as const;
export type KingsChatEnvironment = (typeof KINGSCHAT_ENVIRONMENTS)[number];

export interface AuthProviders {
  kingschat: { clientId: string; environment: KingsChatEnvironment } | null;
}

export const PLACEHOLDER_EMAIL_DOMAIN = 'kingschat.invalid';
export const placeholderEmailFor = (userId: string) => `kc-${userId}@${PLACEHOLDER_EMAIL_DOMAIN}`;
export const isPlaceholderEmail = (email: string) => email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
