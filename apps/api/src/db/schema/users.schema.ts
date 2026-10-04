import { sql } from 'drizzle-orm';
import { bigint, boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './_types';
import { platformRoleEnum, userStatusEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    status: userStatusEnum('status').notNull().default('ACTIVE'),
    platformRole: platformRoleEnum('platform_role').notNull().default('USER'),
    /** Per-user storage quota; null means the organization default applies (unless unlimited). */
    storageQuotaBytes: bigint('storage_quota_bytes', { mode: 'number' }),
    /** No storage limit for this person, whatever the organization default. */
    storageUnlimited: boolean('storage_unlimited').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    index('users_email_trgm_idx').using('gin', t.email.op('gin_trgm_ops')),
    index('users_platform_role_idx').on(t.platformRole).where(sql`${t.platformRole} <> 'USER'`),
    check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
    check('users_name_length', sql`char_length(${t.name}) between 1 and 100`),
    check('users_storage_quota_positive', sql`${t.storageQuotaBytes} is null or ${t.storageQuotaBytes} > 0`),
    check('users_storage_unlimited_exclusive', sql`not (${t.storageUnlimited} and ${t.storageQuotaBytes} is not null)`),
  ],
);

export type UserRow = typeof users.$inferSelect;
