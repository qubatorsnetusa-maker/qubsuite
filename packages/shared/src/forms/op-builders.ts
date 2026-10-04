import type { FormFieldType } from '../enums';
import { sanitizeFilename } from '../filename';
import {
  createVariableSchema,
  type Condition,
  type CreateVariableInput,
  type FormThemeInput,
  type LogicRuleInput,
  type UpdateFieldInput,
  type UpdateFormInput,
  type UpdateVariableInput,
} from '../schemas/forms';
import type { FormDto, FormFieldDto, FormLogicRuleDto, FormVariableDto } from '../types';
import { cannotBeRequired, changeFieldType, DEFAULT_ANSWER_TYPES, defaultOptionsFor } from './ops-validate';
import { deepEqual, getPath, newTxId, OP_PATHS, type Op, type OpChange, type OpEntity, type OpTx, type SetOp } from './ops';
import { QUESTION_TYPES } from './registry';
import { freshRef, remapCondition } from './remap';
import { validateFieldAnswer } from './validation';

/**
 * Turns builder intents into operation transactions against the form the user sees. Every builder returns null when
 * nothing would change, so callers can pass the result straight to `apply`.
 */
export const usedKeys = (form: FormDto): string[] => [...form.fields.map((f) => f.ref), ...form.variables.map((v) => v.key)];

const bagPaths = (bag: string, a: object | undefined, b: object | undefined) => [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].map((k) => `${bag}.${k}`);

function diff(entity: OpEntity, id: string, before: object, after: object, paths: string[]): SetOp | null {
  const changes: Record<string, OpChange> = {};
  for (const p of paths) {
    const from = getPath(before, p);
    const to = getPath(after, p);
    if (!deepEqual(from, to)) changes[p] = { from, to };
  }
  return Object.keys(changes).length ? { kind: 'set', entity, id, changes } : null;
}

const diffField = (before: FormFieldDto, after: FormFieldDto) =>
  diff('field', before.id, before, after, [...OP_PATHS.field, ...bagPaths('settings', before.settings, after.settings), ...bagPaths('validation', before.validation, after.validation)]);

function tx(label: string, ops: (Op | null)[]): OpTx | null {
  const list = ops.filter((o): o is Op => o !== null);
  return list.length ? { txId: newTxId(), label, ops: list } : null;
}

const short = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);
const withoutUndefined = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function fieldSetTx(form: FormDto, fieldId: string, input: UpdateFieldInput, label = 'Edit question'): OpTx | null {
  const field = form.fields.find((f) => f.id === fieldId);
  if (!field) return null;
  let next = input.type && input.type !== field.type ? changeFieldType(field, input.type) : field;
  if (input.label !== undefined) next = { ...next, label: input.label };
  if (input.description !== undefined) next = { ...next, description: input.description };
  if (input.placeholder !== undefined) next = { ...next, placeholder: input.placeholder };
  if (input.ref !== undefined) next = { ...next, ref: input.ref };
  if (input.scoreConfig !== undefined) next = { ...next, scoreConfig: input.scoreConfig };
  if (input.defaultValue !== undefined) next = { ...next, defaultValue: input.defaultValue };
  if (input.required !== undefined) next = { ...next, required: cannotBeRequired(next.type) ? false : input.required };
  if (input.settings) {
    const s: Record<string, unknown> = { ...next.settings };
    for (const [k, v] of Object.entries(input.settings)) {
      if (v === undefined || v === null) delete s[k];
      else s[k] = v;
    }
    next = { ...next, settings: s as FormFieldDto['settings'] };
  }
  if (input.validation) next = { ...next, validation: withoutUndefined(input.validation) };
  if (input.options) {
    const options = input.options.map((o, i) => ({ id: o.id ?? newTxId(), label: o.label, kind: o.kind ?? 'option', imageUrl: o.imageUrl ?? null, value: o.value ?? null, position: i }));
    const kept = new Set(options.map((o) => o.id));
    const removed = new Set(next.options.filter((o) => !kept.has(o.id)).map((o) => o.id));
    // Legacy rules stored the option id in `value`; the server always dropped them with the option.
    const rules = next.rules.filter((r) => !(r.operator !== null && r.value !== null && removed.has(r.value))).map((r, i) => ({ ...r, position: i }));
    next = { ...next, options, rules };
  }
  // The server re-checks a stored default on every edit; deleting the option it points to, tightening a bound below
  // it, or leaving DEFAULT_ANSWER_TYPES would make that check fail with 422 on an edit the user never touched the
  // default for. Clear it here instead, in the same tx, so undo restores both together. Not when the input itself
  // sets `defaultValue` — that value's own validity is reported to the caller as usual.
  if (input.defaultValue === undefined && next.defaultValue !== null) {
    const stale = !DEFAULT_ANSWER_TYPES.has(next.type) || !!validateFieldAnswer({ ...next, required: false }, next.defaultValue);
    if (stale) next = { ...next, defaultValue: null };
  }
  return tx(label, [diffField(field, next)]);
}

export function formSetTx(form: FormDto, input: UpdateFormInput, label = 'Edit form'): OpTx | null {
  let next: FormDto = form;
  // Cleaned exactly as the server stores it, so the transaction (and its undo) holds the stored name.
  if (input.title !== undefined) next = { ...next, title: sanitizeFilename(input.title, form.title) };
  if (input.description !== undefined) next = { ...next, description: input.description };
  if (input.acceptingResponses !== undefined) next = { ...next, acceptingResponses: input.acceptingResponses };
  if (input.settings) {
    const settings = { ...next.settings, ...withoutUndefined(input.settings) };
    // One response per person requires knowing who they are (same rule as PATCH /forms/:id).
    if (settings.limitOneResponse && !settings.requireSignIn) settings.requireSignIn = true;
    next = { ...next, settings };
  }
  return tx(label, [diff('form', form.id, form, next, [...OP_PATHS.form, ...bagPaths('settings', form.settings, next.settings)])]);
}

export function themeSetTx(form: FormDto, theme: FormThemeInput): OpTx | null {
  const next = { ...form.theme, ...theme, headerImageUrl: theme.headerImageUrl || null };
  return tx('Change theme', [diff('theme', form.id, form.theme, next, [...OP_PATHS.theme, ...bagPaths('extras', form.theme.extras, next.extras)])]);
}

const ruleBody = (r: Pick<FormLogicRuleDto, 'trigger' | 'scope' | 'condition' | 'action' | 'targetSectionId' | 'targetFieldId' | 'targetVariableId' | 'payload'>) => ({
  trigger: r.trigger,
  scope: r.scope,
  condition: r.condition,
  action: r.action,
  targetSectionId: r.targetSectionId,
  targetFieldId: r.targetFieldId,
  targetVariableId: r.targetVariableId,
  payload: r.payload,
});

/** Replaces a question's rules. Unchanged rules keep their ids (and legacy columns), so re-saving is a no-op. */
export function logicTx(form: FormDto, fieldId: string, rules: LogicRuleInput[]): OpTx | null {
  const field = form.fields.find((f) => f.id === fieldId);
  if (!field) return null;
  const unused = [...field.rules];
  const next: FormLogicRuleDto[] = rules.map((raw, i) => {
    const body = ruleBody({
      trigger: raw.trigger ?? 'ON_LEAVE',
      scope: raw.scope ?? 'FIELD',
      // `conditionSchema`'s declared type (z.ZodType<Condition>) leaves z.input at `unknown`; the value itself is a Condition.
      condition: raw.condition as Condition,
      action: raw.action,
      targetSectionId: raw.targetSectionId ?? null,
      targetFieldId: raw.targetFieldId ?? null,
      targetVariableId: raw.targetVariableId ?? null,
      payload: raw.payload ?? null,
    });
    const match = unused.findIndex((e) => deepEqual(ruleBody(e), body));
    const reused = match >= 0 ? unused.splice(match, 1)[0]! : null;
    return { id: reused?.id ?? newTxId(), fieldId, operator: reused?.operator ?? null, value: reused?.value ?? null, position: i, ...body };
  });
  return tx('Edit logic', [diffField(field, { ...field, rules: next })]);
}

export function addFieldTx(form: FormDto, type: FormFieldType, afterFieldId: string | null, label?: string): { tx: OpTx; fieldId: string } {
  const def = QUESTION_TYPES[type];
  const fieldId = newTxId();
  const snapshot: FormFieldDto = {
    id: fieldId,
    ref: freshRef(usedKeys(form)),
    type,
    label: label ?? def.defaultLabel,
    description: null,
    required: false,
    position: 0,
    validation: {},
    settings: { ...def.defaultSettings },
    options: defaultOptionsFor(type).map((o, i) => ({ id: newTxId(), label: o.label, kind: o.kind, imageUrl: null, value: null, position: i })),
    rules: [],
    scoreConfig: null,
    placeholder: null,
    defaultValue: null,
  };
  // Same placement as POST /fields: welcome first, endings last, questions after the active one.
  const ids = form.fields.map((f) => f.id);
  const firstEnding = form.fields.findIndex((f) => f.type === 'ENDING');
  let at: number;
  if (type === 'WELCOME') at = 0;
  else if (type === 'ENDING') at = ids.length;
  else if (afterFieldId && ids.includes(afterFieldId)) at = ids.indexOf(afterFieldId) + 1;
  else at = firstEnding >= 0 ? firstEnding : ids.length;
  if (type !== 'WELCOME' && form.fields[0]?.type === 'WELCOME') at = Math.max(at, 1);
  if (type !== 'ENDING' && firstEnding >= 0) at = Math.min(at, firstEnding);
  return { fieldId, tx: { txId: newTxId(), label: `Add ${def.label.toLowerCase()}`, ops: [{ kind: 'create', entity: 'field', snapshot, afterId: at === 0 ? null : ids[at - 1]! }] } };
}

export function duplicateFieldTx(form: FormDto, fieldId: string): { tx: OpTx; fieldId: string } | null {
  const field = form.fields.find((f) => f.id === fieldId);
  if (!field || field.type === 'WELCOME') return null;
  const id = newTxId();
  const optionMap = new Map(field.options.map((o) => [o.id, newTxId()]));
  const maps = { fields: new Map([[field.id, id]]), options: optionMap };
  const snapshot: FormFieldDto = {
    ...field,
    id,
    ref: freshRef(usedKeys(form)),
    label: field.label ? `${field.label} (copy)` : field.label,
    options: field.options.map((o) => ({ ...o, id: optionMap.get(o.id)! })),
    rules: field.rules.map((r) => ({ ...r, id: newTxId(), fieldId: id, condition: remapCondition(r.condition, maps), value: r.value && optionMap.get(r.value) ? optionMap.get(r.value)! : r.value })),
    scoreConfig: field.scoreConfig?.optionPoints
      ? { ...field.scoreConfig, optionPoints: Object.fromEntries(Object.entries(field.scoreConfig.optionPoints).map(([k, v]) => [optionMap.get(k) ?? k, v])) }
      : field.scoreConfig,
  };
  return { fieldId: id, tx: { txId: newTxId(), label: 'Duplicate question', ops: [{ kind: 'create', entity: 'field', snapshot, afterId: field.id }] } };
}

/** Rules elsewhere that jump to this question go with it (the database would cascade them anyway); undo restores both. */
export function deleteFieldTx(form: FormDto, fieldId: string): OpTx | null {
  const idx = form.fields.findIndex((f) => f.id === fieldId);
  const field = form.fields[idx];
  if (!field) return null;
  const ops: (Op | null)[] = form.fields
    .filter((f) => f.id !== fieldId && f.rules.some((r) => r.targetFieldId === fieldId || r.targetSectionId === fieldId))
    .map((f) => diffField(f, { ...f, rules: f.rules.filter((r) => r.targetFieldId !== fieldId && r.targetSectionId !== fieldId).map((r, i) => ({ ...r, position: i })) }));
  ops.push({ kind: 'delete', entity: 'field', id: fieldId, expect: field, afterId: form.fields[idx - 1]?.id ?? null });
  return tx(field.label ? `Delete “${short(field.label)}”` : 'Delete question', ops);
}

export function moveFieldTx(form: FormDto, fieldId: string, toIndex: number): OpTx | null {
  const from = form.fields.findIndex((f) => f.id === fieldId);
  if (from < 0 || from === toIndex) return null;
  const order = form.fields.filter((f) => f.id !== fieldId);
  order.splice(toIndex, 0, form.fields[from]!);
  return tx('Move question', [{ kind: 'move', id: fieldId, fromAfterId: form.fields[from - 1]?.id ?? null, toAfterId: toIndex === 0 ? null : order[toIndex - 1]!.id }]);
}

export function createVariableTx(form: FormDto, input: CreateVariableInput): { tx: OpTx; variableId: string } {
  const v = createVariableSchema.parse(input);
  const variableId = newTxId();
  const snapshot: FormVariableDto = { id: variableId, key: v.key, type: v.type, initialValue: v.initialValue, formula: v.formula || null, position: form.variables.length };
  return { variableId, tx: { txId: newTxId(), label: `Add variable “${v.key}”`, ops: [{ kind: 'create', entity: 'variable', snapshot, afterId: form.variables.at(-1)?.id ?? null }] } };
}

export function updateVariableTx(form: FormDto, variableId: string, input: UpdateVariableInput): OpTx | null {
  const v = form.variables.find((x) => x.id === variableId);
  if (!v) return null;
  const next: FormVariableDto = { ...v, ...withoutUndefined(input), formula: input.formula !== undefined ? input.formula || null : v.formula };
  return tx(`Edit variable “${v.key}”`, [diff('variable', v.id, v, next, [...OP_PATHS.variable])]);
}

export function deleteVariableTx(form: FormDto, variableId: string): OpTx | null {
  const idx = form.variables.findIndex((v) => v.id === variableId);
  const variable = form.variables[idx];
  if (!variable) return null;
  const ops: (Op | null)[] = form.fields
    .filter((f) => f.rules.some((r) => r.targetVariableId === variableId))
    .map((f) => diffField(f, { ...f, rules: f.rules.filter((r) => r.targetVariableId !== variableId).map((r, i) => ({ ...r, position: i })) }));
  ops.push({ kind: 'delete', entity: 'variable', id: variableId, expect: variable, afterId: form.variables[idx - 1]?.id ?? null });
  return tx(`Delete variable “${variable.key}”`, ops);
}
