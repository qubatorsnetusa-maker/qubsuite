import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AnswerValue, Condition, ConditionValue, FieldSettings, FieldValidation, FormSettings, FormThemeExtras, LogicScope, LogicTrigger, OptionKind, RulePayload, ScoreConfig, VariableType } from '@qub/shared';
import type { AssignedKeys } from '@qub/shared/forms';
import { createdAt, updatedAt } from './_types';
import { driveFiles } from './drive.schema';
import { formFieldTypeEnum, logicActionEnum, logicOperatorEnum } from './enums';
import { users } from './users.schema';

export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => driveFiles.id, { onDelete: 'cascade' }),
    /** Random public identifier used in the respondent URL (never the database id). */
    publicId: text('public_id').notNull(),
    description: text('description'),
    isPublished: boolean('is_published').notNull().default(false),
    acceptingResponses: boolean('accepting_responses').notNull().default(true),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    settings: jsonb('settings').$type<FormSettings>().notNull().default({}),
    viewCount: integer('view_count').notNull().default(0),
    /** Incremented once per applied builder change; clients use it to ignore stale responses. */
    revision: integer('revision').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('forms_file_id_unique').on(t.fileId),
    uniqueIndex('forms_public_id_unique').on(t.publicId),
    check('forms_view_count_non_negative', sql`${t.viewCount} >= 0`),
  ],
);

export const formFields = pgTable(
  'form_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    type: formFieldTypeEnum('type').notNull(),
    label: text('label').notNull().default(''),
    description: text('description'),
    required: boolean('required').notNull().default(false),
    position: integer('position').notNull(),
    validation: jsonb('validation').$type<FieldValidation>().notNull().default({}),
    settings: jsonb('settings').$type<FieldSettings>().notNull().default({}),
    /** Stable key for {{ref}} piping and formulas; unique within the form. */
    ref: text('ref').notNull(),
    placeholder: text('placeholder'),
    defaultValue: jsonb('default_value').$type<AnswerValue>(),
    scoreConfig: jsonb('score_config').$type<ScoreConfig>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('form_fields_form_position_idx').on(t.formId, t.position),
    uniqueIndex('form_fields_form_ref_unique').on(t.formId, t.ref),
    // Enum-to-text casts are STABLE, not IMMUTABLE (a future RENAME VALUE could change the text a
    // stored value renders as), but index predicates require IMMUTABLE. form_field_is_welcome() is a
    // SQL wrapper (created in the migration) explicitly declared IMMUTABLE so it can be used here.
    uniqueIndex('form_fields_one_welcome').on(t.formId).where(sql`form_field_is_welcome(${t.type})`),
    check('form_fields_non_input_not_required', sql`${t.type}::text not in ('SECTION','STATEMENT','IMAGE_BLOCK','VIDEO_BLOCK','WELCOME','ENDING','HIDDEN') or not ${t.required}`),
  ],
);

export const formFieldOptions = pgTable(
  'form_field_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => formFields.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    position: integer('position').notNull(),
    kind: text('kind').$type<OptionKind>().notNull().default('option'),
    imageUrl: text('image_url'),
    value: text('value'),
  },
  (t) => [index('form_field_options_field_idx').on(t.fieldId, t.position), check('form_field_options_kind', sql`${t.kind} in ('option','row','column')`)],
);

export const formVariables = pgTable(
  'form_variables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    type: text('type').$type<VariableType>().notNull(),
    initialValue: jsonb('initial_value').$type<ConditionValue>(),
    /** When set, the variable is computed from this formula. */
    formula: text('formula'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('form_variables_form_key_unique').on(t.formId, t.key), check('form_variables_type', sql`${t.type} in ('TEXT','NUMBER','BOOLEAN','DATE')`)],
);

export const formLogicRules = pgTable(
  'form_logic_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    /** The field that owns the rule (source of ON_LEAVE rules, target of VISIBILITY rules). */
    fieldId: uuid('field_id')
      .notNull()
      .references(() => formFields.id, { onDelete: 'cascade' }),
    /** Legacy columns, kept for one release as a rollback path. */
    operator: logicOperatorEnum('operator'),
    value: text('value'),
    trigger: text('trigger').$type<LogicTrigger>().notNull().default('ON_LEAVE'),
    scope: text('scope').$type<LogicScope>().notNull().default('FIELD'),
    condition: jsonb('condition').$type<Condition>().notNull(),
    action: logicActionEnum('action').notNull(),
    targetSectionId: uuid('target_section_id').references(() => formFields.id, { onDelete: 'cascade' }),
    targetFieldId: uuid('target_field_id').references(() => formFields.id, { onDelete: 'cascade' }),
    targetVariableId: uuid('target_variable_id').references(() => formVariables.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<RulePayload>(),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('form_logic_rules_field_idx').on(t.fieldId, t.position),
    index('form_logic_rules_form_idx').on(t.formId),
    index('form_logic_rules_target_field_idx').on(t.targetFieldId),
    check(
      'form_logic_rules_target',
      sql`(${t.action}::text <> 'GO_TO_SECTION' or ${t.targetSectionId} is not null) and (${t.action}::text <> 'JUMP_TO_FIELD' or ${t.targetFieldId} is not null) and (${t.action}::text not in ('SET_VARIABLE','CALCULATE') or ${t.targetVariableId} is not null)`,
    ),
    check('form_logic_rules_trigger', sql`${t.trigger} in ('ON_LEAVE','VISIBILITY')`),
    check('form_logic_rules_scope', sql`${t.scope} in ('FIELD','SECTION')`),
  ],
);

export const formThemes = pgTable('form_themes', {
  formId: uuid('form_id')
    .primaryKey()
    .references(() => forms.id, { onDelete: 'cascade' }),
  primaryColor: text('primary_color').notNull().default('#673ab7'),
  backgroundColor: text('background_color').notNull().default('#f0ebf8'),
  fontFamily: text('font_family').$type<'sans' | 'serif' | 'mono'>().notNull().default('sans'),
  headerImageUrl: text('header_image_url'),
  extras: jsonb('extras').$type<FormThemeExtras>().notNull().default({}),
  updatedAt: updatedAt(),
});

export const formCollaborators = pgTable(
  'form_collaborators',
  {
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    color: text('color').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.formId, t.userId] })],
);

export const formResponses = pgTable(
  'form_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    respondentId: uuid('respondent_id').references(() => users.id, { onDelete: 'set null' }),
    respondentEmail: text('respondent_email'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    score: doublePrecision('score'),
    /** Final variable values computed by the server. */
    computed: jsonb('computed').$type<Record<string, ConditionValue>>().notNull().default({}),
    endingId: uuid('ending_id').references(() => formFields.id, { onDelete: 'set null' }),
    /** Idempotency key sent by the client; retries with the same key return the stored response. */
    clientSubmissionId: uuid('client_submission_id'),
    startedAt: timestamp('started_at', { withTimezone: true }),
  },
  (t) => [
    index('form_responses_form_id_idx').on(t.formId),
    index('form_responses_form_submitted_idx').on(t.formId, t.submittedAt),
    index('form_responses_respondent_idx').on(t.formId, t.respondentId),
    uniqueIndex('form_responses_client_submission_unique').on(t.formId, t.clientSubmissionId).where(sql`${t.clientSubmissionId} is not null`),
  ],
);

/**
 * One row per answered field. The typed column matching the field type is populated:
 * text for text/choice/time, number for number/rating/scale, date for dates,
 * json for checkboxes, uploads, yes/no, matrix, ranking, address, location.
 */
export const formResponseAnswers = pgTable(
  'form_response_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    responseId: uuid('response_id')
      .notNull()
      .references(() => formResponses.id, { onDelete: 'cascade' }),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => formFields.id, { onDelete: 'cascade' }),
    valueText: text('value_text'),
    valueNumber: doublePrecision('value_number'),
    valueDate: date('value_date'),
    valueJson: jsonb('value_json').$type<AnswerValue>(),
  },
  (t) => [
    unique('form_response_answers_response_field_unique').on(t.responseId, t.fieldId),
    index('form_response_answers_field_id_idx').on(t.fieldId),
    check(
      'form_response_answers_has_value',
      sql`num_nonnulls(${t.valueText}, ${t.valueNumber}, ${t.valueDate}, ${t.valueJson}) = 1`,
    ),
  ],
);

/** Applied builder transactions (`POST /api/forms/:id/ops`), kept 30 days so a retried transaction is applied once. */
export const formOpLog = pgTable(
  'form_op_log',
  {
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    txId: uuid('tx_id').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    revision: integer('revision').notNull(),
    assigned: jsonb('assigned').$type<AssignedKeys>().notNull().default({ fields: {}, variables: {} }),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.formId, t.txId] }), index('form_op_log_applied_idx').on(t.formId, t.appliedAt)],
);

/** Files uploaded by respondents. Attached to a response on submit; orphans are purged by the cleanup job. */
export const formUploads = pgTable(
  'form_uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => formFields.id, { onDelete: 'cascade' }),
    responseId: uuid('response_id').references(() => formResponses.id, { onDelete: 'cascade' }),
    uploaderId: uuid('uploader_id').references(() => users.id, { onDelete: 'set null' }),
    storageKey: text('storage_key').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    checksum: text('checksum').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('form_uploads_response_idx').on(t.responseId), index('form_uploads_orphan_idx').on(t.createdAt).where(sql`${t.responseId} is null`)],
);
