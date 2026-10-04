import { z } from 'zod';
import {
  FORM_FIELD_TYPES,
  FORM_LAYOUTS,
  LOGIC_ACTIONS,
  LOGIC_OPERATORS,
  LOGIC_SCOPES,
  LOGIC_TRIGGERS,
  NON_INPUT_FIELD_TYPES,
  OPTION_FIELD_TYPES,
  OPTION_KINDS,
  VARIABLE_TYPES,
  type FormFieldType,
  type OptionKind,
} from '../enums';
import { itemNameSchema, uuidSchema } from '../schemas/common';
import {
  answerValueSchema,
  conditionSchema,
  conditionValueSchema,
  fieldRefSchema,
  fieldSettingsSchema,
  fieldValidationSchema,
  formThemeSchema,
  isHttpUrl,
  logicRuleSchema,
  rulePayloadSchema,
  scoreConfigSchema,
  variableKeySchema,
} from '../schemas/forms';
import type { FormDto, FormFieldDto } from '../types';
import { validateDefinition, type DefinitionIssue } from './definition';
import { newTxId, type OpTx } from './ops';
import { QUESTION_TYPE_LIST, QUESTION_TYPES } from './registry';
import { freshRef } from './remap';
import { isSafePattern, validateFieldAnswer } from './validation';

export const hasOptions = (type: FormFieldType) => (OPTION_FIELD_TYPES as readonly string[]).includes(type);
export const cannotBeRequired = (type: FormFieldType) => (NON_INPUT_FIELD_TYPES as readonly string[]).includes(type) || type === 'HIDDEN';

const NO_DEFAULT = new Set<FormFieldType>(['CONSENT', 'FILE_UPLOAD', 'SIGNATURE', 'HIDDEN']);
/** Input types that may carry a default answer (prefilled for respondents). */
export const DEFAULT_ANSWER_TYPES: ReadonlySet<FormFieldType> = new Set(QUESTION_TYPE_LIST.filter((d) => d.isInput && !NO_DEFAULT.has(d.type)).map((d) => d.type));

const httpUrl = z.string().max(2000).refine(isHttpUrl, 'Use a link starting with http:// or https://');
// `.strict()`: every schema here mirrors a DTO in ../types exactly (see registry/types.ts, EngineField/EngineRule/EngineVariable) —
// the key set must match one-for-one so a stray or missing key on a snapshot is caught, not silently stripped or defaulted.
const optionSnapshotSchema = z
  .object({
    id: uuidSchema,
    label: z.string().max(500).refine((s) => s.trim().length > 0, 'Options need a label'),
    kind: z.enum(OPTION_KINDS),
    imageUrl: httpUrl.nullable(),
    value: z.string().max(200).nullable(),
    position: z.number().int().min(0),
  })
  .strict();

/** Full `FormLogicRuleDto` key set, all required, no defaults: a rule snapshot missing a key (e.g. `trigger`) is rejected. */
const ruleSnapshotSchema = z
  .object({
    id: uuidSchema,
    fieldId: uuidSchema,
    operator: z.enum(LOGIC_OPERATORS).nullable(),
    value: z.string().max(1000).nullable(),
    trigger: z.enum(LOGIC_TRIGGERS),
    scope: z.enum(LOGIC_SCOPES),
    condition: conditionSchema,
    action: z.enum(LOGIC_ACTIONS),
    targetSectionId: uuidSchema.nullable(),
    targetFieldId: uuidSchema.nullable(),
    targetVariableId: uuidSchema.nullable(),
    payload: rulePayloadSchema.nullable(),
    position: z.number().int().min(0),
  })
  .strict();

export const fieldSnapshotSchema = z
  .object({
    id: uuidSchema,
    ref: fieldRefSchema,
    type: z.enum(FORM_FIELD_TYPES),
    label: z.string().max(1000),
    description: z.string().max(5000).nullable(),
    required: z.boolean(),
    position: z.number().int().min(0),
    validation: fieldValidationSchema,
    settings: fieldSettingsSchema,
    options: z.array(optionSnapshotSchema).max(200),
    rules: z.array(ruleSnapshotSchema).max(100),
    scoreConfig: scoreConfigSchema.nullable(),
    placeholder: z.string().max(200).nullable(),
    defaultValue: answerValueSchema,
  })
  .strict();

export const variableSnapshotSchema = z
  .object({
    id: uuidSchema,
    key: variableKeySchema,
    type: z.enum(VARIABLE_TYPES),
    initialValue: conditionValueSchema,
    formula: z.string().max(2000).nullable(),
    position: z.number().int().min(0),
  })
  .strict();

/**
 * Local strict copy of the shared form settings shape (including the nested `quiz` object), all keys required
 * (a `FormDto.settings` is always `Required<FormSettings>`) so `settings.<unknown>` is rejected. This does NOT
 * replace `formSettingsSchema`: that schema stays all-optional for PATCH-style partial updates elsewhere.
 */
const formSettingsSnapshotSchema = z
  .object({
    collectEmail: z.boolean(),
    requireSignIn: z.boolean(),
    limitOneResponse: z.boolean(),
    allowEditAfterSubmit: z.boolean(),
    showProgressBar: z.boolean(),
    confirmationMessage: z.string().max(2000),
    layout: z.enum(FORM_LAYOUTS),
    showTimeEstimate: z.boolean(),
    autoAdvance: z.boolean(),
    saveProgress: z.boolean(),
    quiz: z.object({ enabled: z.boolean(), showScore: z.boolean() }).strict(),
  })
  .strict();

const formPartSchema = z.object({ title: itemNameSchema, description: z.string().max(10_000).nullable(), acceptingResponses: z.boolean(), settings: formSettingsSnapshotSchema });

const firstIssue = (e: z.ZodError, what: string) => {
  const i = e.issues[0]!;
  return i.path.length ? `${what} ${i.path.join('.')}: ${i.message}` : `${what}: ${i.message}`;
};

/** Starter options for a type: two rows/two columns for matrices, two options for ranking, one otherwise. */
export function defaultOptionsFor(type: FormFieldType): { label: string; kind: OptionKind }[] {
  const kinds = QUESTION_TYPES[type].optionKinds;
  if (kinds.includes('row')) return [{ label: 'Row 1', kind: 'row' }, { label: 'Row 2', kind: 'row' }, { label: 'Column 1', kind: 'column' }, { label: 'Column 2', kind: 'column' }];
  if (type === 'RANKING') return [{ label: 'Option 1', kind: 'option' }, { label: 'Option 2', kind: 'option' }];
  return kinds.includes('option') ? [{ label: 'Option 1', kind: 'option' }] : [];
}

/**
 * The field as it becomes when its type changes: type defaults for settings, validation cleared, compatible options kept
 * (or starter options seeded), legacy option-based rules dropped for types without options, and a default answer kept only
 * when it is still valid for the new type.
 */
export function changeFieldType(field: FormFieldDto, type: FormFieldType, makeId: () => string = newTxId): FormFieldDto {
  if (type === field.type) return field;
  const def = QUESTION_TYPES[type];
  const compatible = field.options.filter((o) => def.optionKinds.includes(o.kind));
  const options = !hasOptions(type)
    ? []
    : compatible.length
      ? compatible.map((o, i) => ({ ...o, position: i }))
      : defaultOptionsFor(type).map((o, i) => ({ id: makeId(), label: o.label, kind: o.kind, imageUrl: null, value: null, position: i }));
  const next: FormFieldDto = {
    ...field,
    type,
    settings: { ...def.defaultSettings },
    validation: {},
    required: cannotBeRequired(type) ? false : field.required,
    options,
    rules: hasOptions(type) ? field.rules : field.rules.filter((r) => r.operator === null),
  };
  const keep = field.defaultValue !== null && DEFAULT_ANSWER_TYPES.has(type) && !validateFieldAnswer({ ...next, required: false }, field.defaultValue);
  return { ...next, defaultValue: keep ? field.defaultValue : null };
}

/** First problem with a question's complete state, or null. Messages match the per-edit endpoints. */
export function fieldStateProblem(field: FormFieldDto): string | null {
  const parsed = fieldSnapshotSchema.safeParse(field);
  if (!parsed.success) return firstIssue(parsed.error, 'Question');
  const def = QUESTION_TYPES[field.type];
  const badSetting = Object.keys(field.settings).find((k) => !(def.settingsKeys as readonly string[]).includes(k));
  if (badSetting) return `“${badSetting}” doesn’t apply to ${def.label} questions.`;
  const badRule = Object.keys(field.validation).find((k) => !(def.validationKeys as readonly string[]).includes(k));
  if (badRule) return `“${badRule}” doesn’t apply to ${def.label} questions.`;
  const v = field.validation;
  if (v.minLength != null && v.maxLength != null && v.minLength > v.maxLength) return 'Minimum length cannot exceed maximum length.';
  if (v.min != null && v.max != null && v.min > v.max) return 'Minimum cannot exceed maximum.';
  if (v.pattern && !isSafePattern(v.pattern)) return 'This pattern is invalid or too slow to check safely.';
  const s = field.settings;
  if (s.rangeMin != null && s.rangeMax != null && s.rangeMin >= s.rangeMax) return 'The slider minimum must be below the maximum.';
  if (field.type === 'EMOJI_RATING' && s.scaleMax != null && s.scaleMax !== 3 && s.scaleMax !== 5) return 'Emoji ratings use a 3- or 5-point scale.';
  if (field.required && cannotBeRequired(field.type)) return `${def.label} can’t be required.`;
  if (field.options.length && !hasOptions(field.type)) return `${def.label} questions don’t have options.`;
  const badKind = field.options.find((o) => !def.optionKinds.includes(o.kind));
  if (badKind) return `${def.label} questions don’t use ${badKind.kind} options.`;
  if (field.rules.some((r) => r.fieldId !== field.id)) return 'A rule belongs to a different question.';
  for (const r of field.rules) {
    const p = logicRuleSchema.safeParse(r);
    if (!p.success) return p.error.issues[0]!.message;
  }
  if (field.defaultValue !== null) {
    if (field.type === 'HIDDEN') return 'Hidden fields take their value from the link, so they can’t have a default.';
    if (!DEFAULT_ANSWER_TYPES.has(field.type)) return `${def.label} questions can’t have a default answer.`;
    const problem = validateFieldAnswer({ ...field, required: false }, field.defaultValue);
    if (problem) return `Default value: ${problem.message}`;
  }
  return null;
}

/** Whole-form structure: limits, screen placement, unique keys, rule targets, sign-in coupling. */
export function formStateProblem(form: FormDto): string | null {
  if (form.fields.length > 500) return 'A form can have at most 500 questions.';
  if (form.variables.length > 100) return 'A form can have at most 100 variables.';
  const welcomes = form.fields.filter((f) => f.type === 'WELCOME').length;
  if (welcomes > 1) return 'A form can have only one welcome screen.';
  const firstEnding = form.fields.findIndex((f) => f.type === 'ENDING');
  const lastNonEnding = form.fields.findLastIndex((f) => f.type !== 'ENDING');
  if ((welcomes && form.fields[0]?.type !== 'WELCOME') || (firstEnding >= 0 && lastNonEnding > firstEnding)) return 'Welcome screens stay first and ending screens stay last.';
  const seen = new Set<string>();
  for (const k of [...form.fields.map((f) => f.ref), ...form.variables.map((v) => v.key)]) {
    if (seen.has(k.toLowerCase())) return `The key “${k}” is already used in this form.`;
    seen.add(k.toLowerCase());
  }
  const optionIds = new Set<string>();
  const ruleIds = new Set<string>();
  for (const f of form.fields) {
    for (const o of f.options) {
      if (optionIds.has(o.id)) return 'An option id is used more than once in this form.';
      optionIds.add(o.id);
    }
    for (const r of f.rules) {
      if (ruleIds.has(r.id)) return 'A rule id is used more than once in this form.';
      ruleIds.add(r.id);
    }
  }
  const fieldIds = new Set(form.fields.map((f) => f.id));
  const variables = new Map(form.variables.map((v) => [v.id, v]));
  for (const f of form.fields) {
    for (const r of f.rules) {
      if ((r.targetFieldId && !fieldIds.has(r.targetFieldId)) || (r.targetSectionId && !fieldIds.has(r.targetSectionId))) return 'A rule points to a question that no longer exists.';
      if (r.targetVariableId) {
        const v = variables.get(r.targetVariableId);
        if (!v) return 'A rule sets a variable that no longer exists.';
        if (v.formula) return 'Rules set this variable. Remove those rules before giving it a formula.';
      }
    }
  }
  if (form.settings.limitOneResponse && !form.settings.requireSignIn) return 'Limiting to one response requires sign-in.';
  return null;
}

export interface TxProblem {
  message: string;
  issues?: DefinitionIssue[];
}

function touched(tx: OpTx) {
  const t = { form: false, theme: false, fields: new Set<string>(), variables: new Set<string>() };
  for (const op of tx.ops) {
    if (op.kind === 'set') {
      if (op.entity === 'form') t.form = true;
      else if (op.entity === 'theme') t.theme = true;
      else (op.entity === 'field' ? t.fields : t.variables).add(op.id);
    } else if (op.kind === 'create') (op.entity === 'field' ? t.fields : t.variables).add(op.snapshot.id);
    else if (op.kind === 'delete') (op.entity === 'field' ? t.fields : t.variables).add(op.id);
    else t.fields.add(op.id);
  }
  return t;
}

const SCREEN_TYPES = new Set<FormFieldType>(['WELCOME', 'ENDING']);
/** Same wording as the per-edit endpoint (apps/api/src/modules/forms/form.service.ts `updateField`). */
const SCREEN_CONVERSION_MESSAGE = 'Welcome and ending screens can’t be converted to other types.';

/** Validates the state a transaction produced. Only the items it touched are checked in detail. */
export function txProblem(before: FormDto, after: FormDto, tx: OpTx): TxProblem | null {
  const t = touched(tx);
  if (t.form) {
    const p = formPartSchema.safeParse(after);
    if (!p.success) return { message: firstIssue(p.error, 'Form') };
  }
  if (t.theme) {
    const p = formThemeSchema.safeParse(after.theme);
    if (!p.success) return { message: firstIssue(p.error, 'Theme') };
  }
  for (const f of after.fields) {
    if (!t.fields.has(f.id)) continue;
    const prev = before.fields.find((bf) => bf.id === f.id);
    if (prev && prev.type !== f.type && (SCREEN_TYPES.has(prev.type) || SCREEN_TYPES.has(f.type))) return { message: SCREEN_CONVERSION_MESSAGE };
    const p = fieldStateProblem(f);
    if (p) return { message: p };
  }
  for (const v of after.variables) {
    if (!t.variables.has(v.id)) continue;
    const p = variableSnapshotSchema.safeParse(v);
    if (!p.success) return { message: firstIssue(p.error, 'Variable') };
  }
  const structural = formStateProblem(after);
  if (structural) return { message: structural };
  const issues = validateDefinition({ fields: after.fields, variables: after.variables }).filter(
    (i) =>
      i.severity === 'error' &&
      ((i.fieldId !== null && i.fieldId !== undefined && t.fields.has(i.fieldId) && (i.ruleIndex !== null || i.code === 'rules_not_allowed')) ||
        (i.variableId !== null && i.variableId !== undefined && t.variables.has(i.variableId))),
  );
  return issues.length ? { message: issues[0]!.message, issues } : null;
}

export interface AssignedKeys {
  fields: Record<string, string>;
  variables: Record<string, string>;
}

/** A created question or variable whose key is already taken (e.g. a collaborator used it meanwhile) gets a fresh one. */
export function assignFreshKeys(after: FormDto, tx: OpTx): { form: FormDto; assigned: AssignedKeys } {
  const assigned: AssignedKeys = { fields: {}, variables: {} };
  let form = after;
  for (const op of tx.ops) {
    if (op.kind !== 'create') continue;
    const id = op.snapshot.id;
    const own = op.entity === 'field' ? form.fields.find((f) => f.id === id)?.ref : form.variables.find((v) => v.id === id)?.key;
    if (!own) continue;
    const others = [...form.fields.filter((f) => f.id !== id).map((f) => f.ref), ...form.variables.filter((v) => v.id !== id).map((v) => v.key)];
    if (!others.some((k) => k.toLowerCase() === own.toLowerCase())) continue;
    const key = freshRef(others, op.entity === 'field' ? 'q' : 'var');
    if (op.entity === 'field') {
      assigned.fields[id] = key;
      form = { ...form, fields: form.fields.map((f) => (f.id === id ? { ...f, ref: key } : f)) };
    } else {
      assigned.variables[id] = key;
      form = { ...form, variables: form.variables.map((v) => (v.id === id ? { ...v, key } : v)) };
    }
  }
  return { form, assigned };
}
