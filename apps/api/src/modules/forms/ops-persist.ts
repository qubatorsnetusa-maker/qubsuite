import type { FormDto, FormFieldDto, FormVariableDto } from '@qub/shared';
import { deepEqual } from '@qub/shared/forms';
import { eq, inArray } from 'drizzle-orm';
import type { Executor } from '../../db';
import { driveFiles, formFieldOptions, formFields, formLogicRules, forms, formThemes, formVariables } from '../../db/schema';
import { unprocessable } from '../../utils/errors';

const fieldColumns = (f: FormFieldDto) => ({
  type: f.type,
  label: f.label,
  description: f.description,
  required: f.required,
  position: f.position,
  validation: f.validation,
  settings: f.settings,
  ref: f.ref,
  placeholder: f.placeholder,
  defaultValue: f.defaultValue,
  scoreConfig: f.scoreConfig,
});
const variableColumns = (v: FormVariableDto) => ({ key: v.key, type: v.type, initialValue: v.initialValue, formula: v.formula, position: v.position });
const themeColumns = (t: FormDto['theme']) => ({ primaryColor: t.primaryColor, backgroundColor: t.backgroundColor, fontFamily: t.fontFamily, headerImageUrl: t.headerImageUrl, extras: t.extras ?? {} });

/** Ids of every row a form state owns, by table. */
function ownedIds(form: FormDto) {
  return {
    fields: form.fields.map((f) => f.id),
    options: form.fields.flatMap((f) => f.options.map((o) => o.id)),
    rules: form.fields.flatMap((f) => f.rules.map((r) => r.id)),
    variables: form.variables.map((v) => v.id),
  };
}

/**
 * Ids are chosen by the client, so an id new to this form may already belong to another form. Refuse that before
 * writing anything: an insert would fail on the primary key, and nothing may ever touch another form's rows.
 */
async function assertNewIdsUnused(tx: Executor, before: FormDto, after: FormDto): Promise<void> {
  const had = ownedIds(before);
  const has = ownedIds(after);
  const checks: [keyof typeof has, string, (ids: string[]) => Promise<unknown[]>][] = [
    ['fields', 'question', (ids) => tx.select({ id: formFields.id }).from(formFields).where(inArray(formFields.id, ids)).limit(1)],
    ['options', 'choice', (ids) => tx.select({ id: formFieldOptions.id }).from(formFieldOptions).where(inArray(formFieldOptions.id, ids)).limit(1)],
    ['rules', 'logic rule', (ids) => tx.select({ id: formLogicRules.id }).from(formLogicRules).where(inArray(formLogicRules.id, ids)).limit(1)],
    ['variables', 'variable', (ids) => tx.select({ id: formVariables.id }).from(formVariables).where(inArray(formVariables.id, ids)).limit(1)],
  ];
  for (const [key, noun, existing] of checks) {
    const known = new Set(had[key]);
    const fresh = has[key].filter((id) => !known.has(id));
    if (!fresh.length) continue;
    if ((await existing(fresh)).length) throw unprocessable(`This ${noun} id is already in use. Reload the form and try again.`);
  }
}

/**
 * Writes the difference between two states of a form. Order matters: rules of rewritten questions are removed first,
 * then deleted items, then inserts/updates, and rules last — so every rule's targets exist when it is written.
 */
export async function persistFormDiff(tx: Executor, before: FormDto, after: FormDto): Promise<void> {
  const formId = before.id;
  await assertNewIdsUnused(tx, before, after);
  if (before.title !== after.title) await tx.update(driveFiles).set({ name: after.title, updatedAt: new Date() }).where(eq(driveFiles.id, before.fileId));
  if (before.description !== after.description || before.acceptingResponses !== after.acceptingResponses || !deepEqual(before.settings, after.settings)) {
    await tx.update(forms).set({ description: after.description, acceptingResponses: after.acceptingResponses, settings: after.settings }).where(eq(forms.id, formId));
  }
  if (!deepEqual(before.theme, after.theme)) {
    const theme = themeColumns(after.theme);
    await tx.insert(formThemes).values({ formId, ...theme }).onConflictDoUpdate({ target: formThemes.formId, set: { ...theme, updatedAt: new Date() } });
  }

  const beforeFields = new Map(before.fields.map((f) => [f.id, f]));
  const afterFields = new Map(after.fields.map((f) => [f.id, f]));
  const beforeVars = new Map(before.variables.map((v) => [v.id, v]));
  const afterVars = new Map(after.variables.map((v) => [v.id, v]));

  const rewritten = after.fields.filter((f) => !beforeFields.has(f.id) || !deepEqual(beforeFields.get(f.id)!.rules, f.rules));
  const existingRewritten = rewritten.filter((f) => beforeFields.has(f.id)).map((f) => f.id);
  if (existingRewritten.length) await tx.delete(formLogicRules).where(inArray(formLogicRules.fieldId, existingRewritten));

  const goneFields = before.fields.filter((f) => !afterFields.has(f.id)).map((f) => f.id);
  if (goneFields.length) await tx.delete(formFields).where(inArray(formFields.id, goneFields));
  const goneVars = before.variables.filter((v) => !afterVars.has(v.id)).map((v) => v.id);
  if (goneVars.length) await tx.delete(formVariables).where(inArray(formVariables.id, goneVars));

  for (const v of after.variables) {
    const b = beforeVars.get(v.id);
    if (!b) await tx.insert(formVariables).values({ id: v.id, formId, ...variableColumns(v) });
    else if (!deepEqual(variableColumns(b), variableColumns(v))) await tx.update(formVariables).set({ ...variableColumns(v), updatedAt: new Date() }).where(eq(formVariables.id, v.id));
  }

  for (const f of after.fields) {
    const b = beforeFields.get(f.id);
    if (!b) {
      await tx.insert(formFields).values({ id: f.id, formId, ...fieldColumns(f) });
      if (f.options.length) {
        await tx.insert(formFieldOptions).values(f.options.map((o, i) => ({ id: o.id, fieldId: f.id, label: o.label, kind: o.kind, imageUrl: o.imageUrl, value: o.value, position: i })));
      }
      continue;
    }
    if (!deepEqual(fieldColumns(b), fieldColumns(f))) await tx.update(formFields).set(fieldColumns(f)).where(eq(formFields.id, f.id));
    if (!deepEqual(b.options, f.options)) {
      const keep = new Set(f.options.map((o) => o.id));
      const stale = b.options.filter((o) => !keep.has(o.id)).map((o) => o.id);
      if (stale.length) await tx.delete(formFieldOptions).where(inArray(formFieldOptions.id, stale));
      const existing = new Set(b.options.map((o) => o.id));
      for (const [i, o] of f.options.entries()) {
        const values = { label: o.label, kind: o.kind, imageUrl: o.imageUrl, value: o.value, position: i };
        if (existing.has(o.id)) await tx.update(formFieldOptions).set(values).where(eq(formFieldOptions.id, o.id));
        else await tx.insert(formFieldOptions).values({ id: o.id, fieldId: f.id, ...values });
      }
    }
  }

  const rules = rewritten.flatMap((f) =>
    f.rules.map((r, i) => ({
      id: r.id,
      formId,
      fieldId: f.id,
      operator: r.operator,
      value: r.value,
      trigger: r.trigger,
      scope: r.scope,
      condition: r.condition,
      action: r.action,
      targetSectionId: r.targetSectionId,
      targetFieldId: r.targetFieldId,
      targetVariableId: r.targetVariableId,
      payload: r.payload,
      position: i,
    })),
  );
  if (rules.length) await tx.insert(formLogicRules).values(rules);
}
