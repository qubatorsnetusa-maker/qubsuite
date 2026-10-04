import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './_types';
import { users } from './users.schema';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

/**
 * Rotating refresh tokens. Only a SHA-256 hash is stored. Each use issues a new token and marks the old one used;
 * presenting a used token again revokes the whole session (token theft detection).
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('refresh_tokens_hash_unique').on(t.tokenHash), index('refresh_tokens_session_idx').on(t.sessionId)],
);

export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('email_verifications_hash_unique').on(t.tokenHash), index('email_verifications_user_idx').on(t.userId)],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('password_reset_hash_unique').on(t.tokenHash), index('password_reset_user_idx').on(t.userId)],
);

export const inviteTokens = pgTable(
  'invite_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    targetUrl: text('target_url').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('invite_tokens_hash_unique').on(t.tokenHash), index('invite_tokens_email_idx').on(t.email)],
);
