import type { FormFieldDto, FormVariableDto } from '@qub/shared';
import { asc, eq, inArray } from 'drizzle-orm';
import type { Executor } from '../../db';
import { driveFiles, formFieldOptions, formFields, formLogicRules, forms, formThemes, formVariables } from '../../db/schema';

export type FormRow = typeof forms.$inferSelect;

export const FormRepository = {
  async findById(db: Executor, id: string) {
    const [row] = await db
      .select({ form: forms, file: driveFiles })
      .from(forms)
      .innerJoin(driveFiles, eq(driveFiles.id, forms.fileId))
      .where(eq(forms.id, id))
      .limit(1);
    return row;
  },

  async findByPublicId(db: Executor, publicId: string) {
    const [row] = await db
      .select({ form: forms, file: driveFiles })
      .from(forms)
      .innerJoin(driveFiles, eq(driveFiles.id, forms.fileId))
      .where(eq(forms.publicId, publicId))
      .limit(1);
    return row;
  },

  async findByFileId(db: Executor, fileId: string) {
    const [row] = await db.select().from(forms).where(eq(forms.fileId, fileId)).limit(1);
    return row;
  },

  /** Fields with their options and logic rules, in display order. */
  async fields(db: Executor, formId: string): Promise<FormFieldDto[]> {
    const fields = await db.select().from(formFields).where(eq(formFields.formId, formId)).orderBy(asc(formFields.position));
    if (!fields.length) return [];
    const ids = fields.map((f) => f.id);
    const [options, rules] = await Promise.all([
      db.select().from(formFieldOptions).where(inArray(formFieldOptions.fieldId, ids)).orderBy(asc(formFieldOptions.position)),
      db.select().from(formLogicRules).where(inArray(formLogicRules.fieldId, ids)).orderBy(asc(formLogicRules.position)),
    ]);
    return fields.map((f) => ({
      id: f.id,
      ref: f.ref,
      type: f.type,
      label: f.label,
      description: f.description,
      required: f.required,
      position: f.position,
      validation: f.validation,
      settings: f.settings,
      placeholder: f.placeholder,
      defaultValue: f.defaultValue ?? null,
      scoreConfig: f.scoreConfig ?? null,
      options: options
        .filter((o) => o.fieldId === f.id)
        .map((o) => ({ id: o.id, label: o.label, position: o.position, kind: o.kind, value: o.value, imageUrl: o.imageUrl })),
      rules: rules
        .filter((r) => r.fieldId === f.id)
        .map((r) => ({
          id: r.id,
          fieldId: r.fieldId,
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
          position: r.position,
        })),
    }));
  },

  async theme(db: Executor, formId: string) {
    const [row] = await db.select().from(formThemes).where(eq(formThemes.formId, formId)).limit(1);
    return row;
  },

  async variables(db: Executor, formId: string): Promise<FormVariableDto[]> {
    const rows = await db.select().from(formVariables).where(eq(formVariables.formId, formId)).orderBy(asc(formVariables.position), asc(formVariables.createdAt));
    return rows.map((v) => ({ id: v.id, key: v.key, type: v.type, initialValue: v.initialValue ?? null, formula: v.formula, position: v.position }));
  },

  /** Field refs and variable keys (one namespace). */
  async usedKeys(db: Executor, formId: string): Promise<string[]> {
    const [refs, keys] = await Promise.all([
      db.select({ k: formFields.ref }).from(formFields).where(eq(formFields.formId, formId)),
      db.select({ k: formVariables.key }).from(formVariables).where(eq(formVariables.formId, formId)),
    ]);
    return [...refs, ...keys].map((r) => r.k);
  },
};
