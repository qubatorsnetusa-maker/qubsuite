import type { OrgPoliciesInput } from '@qub/shared';
import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { updatedAt } from './_types';
import { users } from './users.schema';

/**
 * Organization-wide settings (one row, id = 'org'). Policies are validated with `orgPoliciesSchema` on every read,
 * so rows written before a policy existed pick up its default.
 */
export const orgSettings = pgTable(
  'org_settings',
  {
    id: text('id').primaryKey(),
    policies: jsonb('policies').$type<OrgPoliciesInput>().notNull().default({}),
    updatedAt: updatedAt(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [check('org_settings_single_row', sql`${t.id} = 'org'`)],
);

/**
 * How Qub sends email (one row, id = 'org'). Non-secret settings are plain jsonb validated by `emailSettingsSchema`;
 * passwords and API keys are AES-256-GCM encrypted in `secrets` and never returned to clients.
 */
export const emailSettings = pgTable(
  'email_settings',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    secrets: text('secrets'),
    lastTestAt: timestamp('last_test_at', { withTimezone: true }),
    lastTestError: text('last_test_error'),
    updatedAt: updatedAt(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [check('email_settings_single_row', sql`${t.id} = 'org'`)],
);
