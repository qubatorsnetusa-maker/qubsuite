import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../db/schema/users.schema';

export const formsv3Workspaces = pgTable(
  'formsv3_workspaces',
  {
    id: text('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    folders: text('folders').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('formsv3_workspaces_owner_id_idx').on(table.ownerId)]
);

export const formsv3Forms = pgTable(
  'formsv3_forms',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => formsv3Workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    status: text('status', { enum: ['draft', 'published', 'closed'] })
      .notNull()
      .default('draft'),
    folder: text('folder'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    starts: integer('starts').notNull().default(0),
    completions: integer('completions').notNull().default(0),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('formsv3_forms_workspace_id_idx').on(table.workspaceId)]
);

export const formsv3Submissions = pgTable(
  'formsv3_submissions',
  {
    id: text('id').primaryKey(),
    formId: text('form_id')
      .notNull()
      .references(() => formsv3Forms.id, { onDelete: 'cascade' }),
    formTitle: text('form_title').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    completionTimeSeconds: integer('completion_time_seconds').notNull().default(0),
    responses: jsonb('responses').notNull(),
    notificationSentTo: text('notification_sent_to'),
  },
  (table) => [index('formsv3_submissions_form_id_idx').on(table.formId)]
);

export const formsv3UserPreferences = pgTable('formsv3_user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  defaultViewMode: text('default_view_mode', { enum: ['grid', 'table'] })
    .notNull()
    .default('grid'),
  defaultSortOption: text('default_sort_option', {
    enum: ['updated_desc', 'title_asc', 'responses_desc', 'completion_desc', 'steps_desc'],
  })
    .notNull()
    .default('updated_desc'),
  notifyOnSubmission: boolean('notify_on_submission').notNull().default(true),
});

export type Formsv3WorkspaceRow = typeof formsv3Workspaces.$inferSelect;
export type Formsv3FormRow = typeof formsv3Forms.$inferSelect;
export type Formsv3SubmissionRow = typeof formsv3Submissions.$inferSelect;
export type Formsv3UserPreferencesRow = typeof formsv3UserPreferences.$inferSelect;
