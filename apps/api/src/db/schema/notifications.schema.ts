import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './_types';
import { notificationTypeEnum } from './enums';
import { users } from './users.schema';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_id_idx').on(t.userId),
    index('notifications_created_at_idx').on(t.createdAt),
    index('notifications_user_unread_idx').on(t.userId, t.readAt, t.createdAt),
  ],
);
