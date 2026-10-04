import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './_types';
import { activityActionEnum } from './enums';
import { users } from './users.schema';

/** User-facing activity history ("View activity", recent files). */
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: activityActionEnum('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id').notNull(),
    /** Name at the time of the event, so history stays readable after renames/deletes. */
    resourceName: text('resource_name'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('activity_logs_user_id_idx').on(t.userId),
    index('activity_logs_resource_id_idx').on(t.resourceId),
    index('activity_logs_resource_created_idx').on(t.resourceId, t.createdAt),
    index('activity_logs_user_action_created_idx').on(t.userId, t.action, t.createdAt),
  ],
);

/** Security audit trail (logins, password changes, permission changes, destructive operations). */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    event: text('event').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_actor_idx').on(t.actorId, t.createdAt), index('audit_logs_created_idx').on(t.createdAt)],
);
