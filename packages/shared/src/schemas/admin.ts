import { z } from 'zod';
import { GRANTABLE_ROLES, NATIVE_FILE_TYPES, PLATFORM_ROLES, USER_STATUSES } from '../enums';
import { emailSchema } from './auth';
import { paginationQuerySchema, uuidSchema } from './common';

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, 'Enter a domain like example.com');

const extensionSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v.startsWith('.') ? v : `.${v}`))
  .pipe(z.string().regex(/^\.[a-z0-9]{1,16}$/, 'Enter an extension like .exe'));

/**
 * Organization policies set by super admins. Every field is enforced on the server (sharing, uploads, storage,
 * trash retention, forms, sessions); `prefault` fills in defaults for anything missing, including in stored rows
 * written before a policy existed.
 */
export const orgPoliciesSchema = z.object({
  organizationName: z.string().trim().min(1).max(100).default('Qub'),
  sharing: z
    .object({
      /** Invite people who don't have a Qub account yet (they get access when they sign up). */
      allowExternalInvites: z.boolean().default(true),
      /** When non-empty, people can only be added if their email is at one of these domains. */
      allowedDomains: z.array(domainSchema).max(100).default([]),
      /** "Anyone with the link". Turning it off also disables links that already exist. */
      allowPublicLinks: z.boolean().default(true),
      /** The highest role a link can grant; existing links are capped too. */
      maxLinkRole: z.enum(GRANTABLE_ROLES).default('EDITOR'),
    })
    .prefault({}),
  content: z
    .object({
      /** When off, viewers and commenters can't download, print or copy — whatever the item's share settings say. */
      viewersCanDownload: z.boolean().default(true),
    })
    .prefault({}),
  uploads: z
    .object({
      /** Per-file limit in MB; can't exceed the server's configured maximum. */
      maxFileSizeMb: z.number().int().min(1).max(5120).default(100),
      /** Rejected on top of the built-in executable block list. */
      blockedExtensions: z.array(extensionSchema).max(200).default([]),
    })
    .prefault({}),
  storage: z
    .object({
      /** Quota for users without their own; null means unlimited. */
      defaultQuotaGb: z.number().min(0.1).max(1_000_000).nullable().default(null),
    })
    .prefault({}),
  trash: z
    .object({
      /** Items in the trash longer than this are deleted permanently by the retention job. */
      retentionDays: z.number().int().min(1).max(3650).default(30),
    })
    .prefault({}),
  forms: z
    .object({
      /** Respondents must sign in to fill out any form, whatever the form's own setting. */
      requireSignIn: z.boolean().default(false),
    })
    .prefault({}),
  security: z
    .object({
      /** Sessions older than this must sign in again; null means the refresh-token lifetime applies. */
      sessionMaxHours: z.number().int().min(1).max(24 * 90).nullable().default(null),
    })
    .prefault({}),
});
export type OrgPolicies = z.output<typeof orgPoliciesSchema>;
export type OrgPoliciesInput = z.input<typeof orgPoliciesSchema>;

export const ADMIN_USER_SORTS = ['name', 'createdAt', 'lastLoginAt', 'storage'] as const;

export const adminUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).default(''),
  role: z.enum(PLATFORM_ROLES).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  sort: z.enum(ADMIN_USER_SORTS).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type AdminUsersQuery = Partial<z.output<typeof adminUsersQuerySchema>>;

export const MIN_QUOTA_GB = 0.1;
export const MAX_QUOTA_GB = 1_000_000;

/** A person's quota in GB; null = the organization default, 'unlimited' = no limit whatever the default. */
const quotaGbSchema = z.union([z.number().min(MIN_QUOTA_GB).max(MAX_QUOTA_GB), z.literal('unlimited')]).nullable();

/** Quota modes as shown to admins. */
export const QUOTA_MODES = ['default', 'custom', 'unlimited'] as const;
export type QuotaMode = (typeof QUOTA_MODES)[number];

/**
 * Changes one person's storage. `adjust` adds (or, when negative, removes) space relative to the quota that
 * applies right now, so two admins raising it at once both take effect.
 */
export const adminStorageQuotaSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('default') }),
  z.object({ mode: z.literal('unlimited') }),
  z.object({ mode: z.literal('custom'), gb: z.number().min(MIN_QUOTA_GB).max(MAX_QUOTA_GB) }),
  z.object({
    mode: z.literal('adjust'),
    deltaGb: z
      .number()
      .min(-MAX_QUOTA_GB)
      .max(MAX_QUOTA_GB)
      .refine((v) => v !== 0, 'Enter an amount to add or remove'),
  }),
]);
export type AdminStorageQuotaInput = z.infer<typeof adminStorageQuotaSchema>;

export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  platformRole: z.enum(PLATFORM_ROLES).default('USER'),
  quotaGb: quotaGbSchema.default(null),
});
export type AdminCreateUserInput = z.input<typeof adminCreateUserSchema>;

export const adminUpdateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    platformRole: z.enum(PLATFORM_ROLES).optional(),
    status: z.enum(USER_STATUSES.filter((s) => s !== 'DELETED') as ['ACTIVE', 'SUSPENDED']).optional(),
    quotaGb: quotaGbSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Nothing to update');
export type AdminUpdateUserInput = z.input<typeof adminUpdateUserSchema>;

export const adminBulkUsersSchema = z.object({
  userIds: z.array(uuidSchema).min(1).max(200),
  action: z.enum(['suspend', 'activate', 'signOut']),
});

/** Deleting an account needs an explicit decision about its files. */
export const adminDeleteUserSchema = z.union([
  z.object({ transferToUserId: uuidSchema }),
  z.object({ deleteData: z.literal(true) }),
]);
export type AdminDeleteUserInput = z.infer<typeof adminDeleteUserSchema>;

export const ADMIN_CONTENT_TYPES = [...NATIVE_FILE_TYPES, 'UPLOAD'] as const;
export type AdminContentType = (typeof ADMIN_CONTENT_TYPES)[number];

export const adminContentQuerySchema = paginationQuerySchema.extend({
  type: z.enum(ADMIN_CONTENT_TYPES),
  q: z.string().trim().max(200).default(''),
  ownerId: uuidSchema.optional(),
  /** Only items shared with "Anyone with the link". */
  publicOnly: z.stringbool().default(false),
  includeTrashed: z.stringbool().default(false),
  sort: z.enum(['updatedAt', 'name', 'size']).default('updatedAt'),
});
export type AdminContentQuery = Partial<z.output<typeof adminContentQuerySchema>> & Pick<z.output<typeof adminContentQuerySchema>, 'type'>;

export const adminTransferSchema = z.object({ toUserId: uuidSchema });

export const AUDIT_CATEGORIES = ['auth', 'sharing', 'admin'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const adminAuditQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).default(''),
  category: z.enum(AUDIT_CATEGORIES).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  actorId: uuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AdminAuditQuery = Partial<z.output<typeof adminAuditQuerySchema>>;

export const adminActivityQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).default(''),
  app: z.enum([...NATIVE_FILE_TYPES, 'DRIVE']).optional(),
  userId: uuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AdminActivityQuery = Partial<z.output<typeof adminActivityQuerySchema>>;

export const adminSessionsQuerySchema = paginationQuerySchema.extend({ userId: uuidSchema.optional() });

// ---------- email delivery ----------

/**
 * How Qub sends email for the whole organization. `environment` uses the server's .env configuration; the others
 * are configured here. Every provider except `environment` needs its own sender address.
 */
export const EMAIL_PROVIDERS = ['environment', 'smtp', 'resend', 'sendgrid', 'mailgun', 'postmark'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

const hostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/, 'Enter a host name like smtp.example.com');

/** Secrets are write-only: omit (or send blank) to keep the stored value. */
const secretSchema = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || undefined)
  .optional();

const sender = {
  fromName: z.string().trim().min(1, 'Enter a sender name').max(100),
  fromEmail: emailSchema,
  replyTo: z.union([emailSchema, z.literal('')]).nullish().transform((v) => v || null),
};

export const emailSettingsSchema = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('environment') }),
  z.object({
    provider: z.literal('smtp'),
    ...sender,
    host: hostSchema,
    port: z.number().int().min(1).max(65535),
    /** tls = implicit TLS (usually 465); starttls = upgrade after connecting (usually 587). */
    security: z.enum(['tls', 'starttls', 'none']),
    username: z.string().trim().max(320).default(''),
    password: secretSchema,
  }),
  z.object({ provider: z.literal('resend'), ...sender, apiKey: secretSchema }),
  z.object({ provider: z.literal('sendgrid'), ...sender, apiKey: secretSchema }),
  z.object({
    provider: z.literal('mailgun'),
    ...sender,
    domain: hostSchema,
    region: z.enum(['us', 'eu']).default('us'),
    apiKey: secretSchema,
  }),
  z.object({
    provider: z.literal('postmark'),
    ...sender,
    messageStream: z.string().trim().min(1).max(100).default('outbound'),
    apiKey: secretSchema,
  }),
]);
export type EmailSettingsInput = z.input<typeof emailSettingsSchema>;
export type EmailSettings = z.output<typeof emailSettingsSchema>;

/** Sends a test message, with the saved settings or with a draft (whose blank secrets fall back to saved ones). */
export const emailTestSchema = z.object({
  to: emailSchema,
  settings: emailSettingsSchema.optional(),
});
