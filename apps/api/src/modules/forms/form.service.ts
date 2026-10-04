import type { CreateFieldInput, CreateFormInput, FormDto, FormFieldDto, FormThemeInput, SetLogicRuleInput, UpdateFieldInput, UpdateFormInput } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS, legacyLogicRuleSchema, logicRuleSchema, presenceColor } from '@qub/shared';
import { cannotBeRequired, DEFAULT_ANSWER_TYPES, defaultOptionsFor, fieldStateProblem, freshRef, hasOptions, legacyRuleToV2, QUESTION_TYPES, remapCondition, validateDefinition, validateFieldAnswer } from '@qub/shared/forms';
import { findTemplate, type FormTemplateField } from '@qub/shared/templates';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import { formCollaborators, formFieldOptions, formFields, formLogicRules, formResponses, forms, formThemes, formUploads, formVariables } from '../../db/schema';
import { randomToken } from '../../utils/crypto';
import { isUniqueViolation } from '../../utils/pg';
import { AppError, badRequest, notFound, unprocessable } from '../../utils/errors';
import type { ActivityService } from '../activity/activity.service';
import type { NativeResourceRegistry } from '../drive/native-registry';
import type { FileService } from '../files/file.service';
import { toCapabilities, type PermissionService } from '../permissions/permission.service';
import { UserRepository } from '../users/user.repository';
import { FormRepository } from './form.repository';

/** Attempts per builder mutation when concurrent writers collide on a unique index (see `mutate`). */
const MUTATION_ATTEMPTS = 3;

/** Realtime notification to builders viewing the form. */
export interface FormBroadcaster {
  formChanged(formId: string, byUserId: string, meta?: { txId?: string; revision?: number }): void;
}

export class FormService {
  private broadcaster: FormBroadcaster | null = null;

  constructor(
    private readonly db: Database,
    private readonly files: FileService,
    private readonly permissions: PermissionService,
    private readonly activity: ActivityService,
    natives: NativeResourceRegistry,
  ) {
    natives.register('FORM', {
      copy: (tx, src, dst, userId) => this.copyInto(tx, src, dst, userId),
      storageKeys: async (tx, fileIds) => {
        const rows = await tx
          .select({ key: formUploads.storageKey })
          .from(formUploads)
          .innerJoin(forms, eq(forms.id, formUploads.formId))
          .where(inArray(forms.fileId, fileIds));
        return rows.map((r) => r.key);
      },
    });
  }

  attachBroadcaster(b: FormBroadcaster): void {
    this.broadcaster = b;
  }

  /** Forms creation flow: drive_files (FORM) → forms (+ theme, first question) → activity. One transaction. */
  async create(userId: string, input: CreateFormInput, tx?: Executor): Promise<FormDto> {
    const template = input.templateId ? findTemplate('FORM', input.templateId) : undefined;
    if (input.templateId && !template) throw badRequest('That template doesn’t exist.');
    const run = async (t: Executor) => {
      const file = await this.files.createNative(t, userId, 'FORM', input.title ?? template?.name ?? 'Untitled form', input.folderId);
      const [form] = await t
        .insert(forms)
        .values({
          fileId: file.id,
          publicId: randomToken(18),
          description: template?.description ?? null,
          settings: { ...DEFAULT_FORM_SETTINGS, ...template?.settings },
          createdBy: userId,
        })
        .returning();
      await t.insert(formThemes).values({ formId: form!.id, ...template?.theme });
      const fields: FormTemplateField[] = template?.fields ?? [{ type: 'MULTIPLE_CHOICE', label: 'Untitled question', options: ['Option 1'] }];
      for (const [position, f] of fields.entries()) {
        const [field] = await t
          .insert(formFields)
          .values({
            formId: form!.id,
            type: f.type,
            label: f.label,
            description: f.description ?? null,
            required: !!f.required,
            position,
            validation: f.validation ?? {},
            settings: f.settings ?? {},
            ref: `q${position + 1}`,
          })
          .returning();
        if (f.options?.length) await t.insert(formFieldOptions).values(f.options.map((label, i) => ({ fieldId: field!.id, label, position: i })));
      }
      return form!;
    };
    const form = tx ? await run(tx) : await this.db.transaction(run);
    return this.get(userId, form.id, { recordOpen: false }, tx);
  }

  async access(userId: string, formId: string, requirement: 'VIEWER' | 'EDITOR' = 'VIEWER', tx: Executor = this.db) {
    const row = await FormRepository.findById(tx, formId);
    if (!row) throw notFound('form');
    const access = await this.permissions.requireFile(userId, row.file.id, requirement, tx);
    return { ...row, access };
  }

  async get(userId: string, formId: string, opts: { recordOpen?: boolean } = {}, tx: Executor = this.db): Promise<FormDto> {
    const { form, file, access } = await this.access(userId, formId, 'VIEWER', tx);
    if (opts.recordOpen !== false) await this.files.recordOpened(userId, file);
    const [fields, variables, theme, owners, [countRow]] = await Promise.all([
      FormRepository.fields(tx, formId),
      FormRepository.variables(tx, formId),
      FormRepository.theme(tx, formId),
      UserRepository.summaries(tx, [file.ownerId]),
      tx.select({ n: count() }).from(formResponses).where(eq(formResponses.formId, formId)),
    ]);
    return {
      id: form.id,
      fileId: file.id,
      publicId: form.publicId,
      title: file.name,
      description: form.description,
      folderId: file.folderId,
      owner: owners.get(file.ownerId)!,
      isPublished: form.isPublished,
      acceptingResponses: form.acceptingResponses,
      publishedAt: form.publishedAt?.toISOString() ?? null,
      settings: { ...DEFAULT_FORM_SETTINGS, ...form.settings },
      theme: {
        primaryColor: theme?.primaryColor ?? '#673ab7',
        backgroundColor: theme?.backgroundColor ?? '#f0ebf8',
        fontFamily: theme?.fontFamily ?? 'sans',
        headerImageUrl: theme?.headerImageUrl ?? null,
        extras: theme?.extras ?? {},
      },
      fields,
      variables,
      responseCount: countRow?.n ?? 0,
      isTrashed: file.isTrashed,
      createdAt: form.createdAt.toISOString(),
      updatedAt: form.updatedAt.toISOString(),
      revision: form.revision,
      capabilities: toCapabilities(access),
    };
  }

  /**
   * Every builder mutation runs as an editor, updates timestamps, bumps the form's revision and notifies
   * other open builders. A unique violation (e.g. two concurrent adds picking the same fresh ref) reruns
   * the whole transaction, which then sees the other writer's committed row; a violation that persists
   * surfaces as a 409. The form row is locked first, as POST /ops does, so both paths take their locks in the same
   * order and apply one at a time per form instead of deadlocking.
   */
  async mutate<T>(userId: string, formId: string, fn: (tx: Executor, form: { id: string; fileId: string }) => Promise<T>): Promise<FormDto> {
    let revision = 0;
    for (let attempt = 1; ; attempt++) {
      try {
        await this.db.transaction(async (tx) => {
          await tx.select({ id: forms.id }).from(forms).where(eq(forms.id, formId)).for('update');
          const { form, file } = await this.access(userId, formId, 'EDITOR', tx);
          if (file.isTrashed) throw badRequest('Restore this form from the trash to edit it.');
          await fn(tx, { id: form.id, fileId: file.id });
          const [row] = await tx
            .update(forms)
            .set({ updatedAt: new Date(), revision: sql`${forms.revision} + 1` })
            .where(eq(forms.id, formId))
            .returning({ revision: forms.revision });
          revision = row!.revision;
          await this.files.recordEdited(userId, file, tx);
        });
        break;
      } catch (err) {
        if (attempt >= MUTATION_ATTEMPTS || !isUniqueViolation(err)) throw err;
      }
    }
    this.notifyChanged(formId, userId, { revision });
    return this.get(userId, formId, { recordOpen: false });
  }

  /** Tells other open builders that the form changed (they refetch). */
  notifyChanged(formId: string, userId: string, meta?: { txId?: string; revision?: number }): void {
    this.broadcaster?.formChanged(formId, userId, meta);
  }

  async update(userId: string, formId: string, input: UpdateFormInput): Promise<FormDto> {
    const { file, form } = await this.access(userId, formId, 'EDITOR');
    if (input.title !== undefined) await this.files.update(userId, file.id, { name: input.title });
    return this.mutate(userId, formId, async (tx) => {
      await tx
        .update(forms)
        .set({
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.acceptingResponses !== undefined ? { acceptingResponses: input.acceptingResponses } : {}),
          ...(input.settings ? { settings: { ...DEFAULT_FORM_SETTINGS, ...form.settings, ...input.settings } } : {}),
        })
        .where(eq(forms.id, formId));
      // One response per person requires knowing who they are.
      const settings = { ...form.settings, ...input.settings };
      if (settings.limitOneResponse && !settings.requireSignIn) {
        await tx.update(forms).set({ settings: { ...DEFAULT_FORM_SETTINGS, ...settings, requireSignIn: true } }).where(eq(forms.id, formId));
      }
    });
  }

  private async resequence(tx: Executor, formId: string, orderedIds: string[]): Promise<void> {
    for (const [i, id] of orderedIds.entries()) {
      await tx.update(formFields).set({ position: i }).where(and(eq(formFields.id, id), eq(formFields.formId, formId)));
    }
  }

  private async orderedFieldIds(tx: Executor, formId: string): Promise<string[]> {
    const rows = await tx.select({ id: formFields.id }).from(formFields).where(eq(formFields.formId, formId)).orderBy(asc(formFields.position));
    return rows.map((r) => r.id);
  }

  async addField(userId: string, formId: string, input: CreateFieldInput): Promise<FormDto> {
    return this.mutate(userId, formId, async (tx) => {
      const existing = await tx.select({ id: formFields.id, type: formFields.type }).from(formFields).where(eq(formFields.formId, formId)).orderBy(asc(formFields.position));
      if (existing.length >= 500) throw badRequest('A form can have at most 500 questions.');
      if (input.type === 'WELCOME' && existing.some((f) => f.type === 'WELCOME')) throw new AppError('CONFLICT', 'A form can have only one welcome screen.');
      const def = QUESTION_TYPES[input.type];
      const [field] = await tx
        .insert(formFields)
        .values({
          formId,
          type: input.type,
          label: input.label ?? def.defaultLabel,
          position: existing.length,
          settings: def.defaultSettings,
          ref: freshRef(await FormRepository.usedKeys(tx, formId)),
        })
        .returning();
      const options = defaultOptionsFor(input.type);
      if (options.length) await tx.insert(formFieldOptions).values(options.map((o, i) => ({ fieldId: field!.id, label: o.label, kind: o.kind, position: i })));

      const ids = existing.map((f) => f.id);
      const firstEnding = existing.findIndex((f) => f.type === 'ENDING');
      let at: number;
      if (input.type === 'WELCOME') at = 0;
      else if (input.type === 'ENDING') at = ids.length;
      else if (input.afterFieldId && ids.includes(input.afterFieldId)) at = ids.indexOf(input.afterFieldId) + 1;
      else at = firstEnding >= 0 ? firstEnding : ids.length;
      // Never place a question before the welcome screen or after an ending.
      if (input.type !== 'WELCOME' && existing[0]?.type === 'WELCOME') at = Math.max(at, 1);
      if (input.type !== 'ENDING' && firstEnding >= 0) at = Math.min(at, firstEnding);
      ids.splice(at, 0, field!.id);
      await this.resequence(tx, formId, ids);
    });
  }

  private async loadField(tx: Executor, formId: string, fieldId: string) {
    const [field] = await tx.select().from(formFields).where(and(eq(formFields.id, fieldId), eq(formFields.formId, formId))).limit(1);
    if (!field) throw notFound('question');
    return field;
  }

  async updateField(userId: string, formId: string, fieldId: string, input: UpdateFieldInput): Promise<FormDto> {
    return this.mutate(userId, formId, async (tx) => {
      const field = await this.loadField(tx, formId, fieldId);
      const type = input.type ?? field.type;
      const def = QUESTION_TYPES[type];
      const typeChanged = type !== field.type;
      if (typeChanged && (type === 'WELCOME' || field.type === 'WELCOME' || type === 'ENDING' || field.type === 'ENDING')) {
        throw unprocessable('Welcome and ending screens can’t be converted to other types.');
      }
      if (input.ref !== undefined && input.ref.toLowerCase() !== field.ref.toLowerCase()) {
        const used = (await FormRepository.usedKeys(tx, formId)).map((k) => k.toLowerCase());
        if (used.includes(input.ref.toLowerCase())) throw new AppError('CONFLICT', `The key “${input.ref}” is already used in this form.`);
      }
      const s = { ...(typeChanged ? def.defaultSettings : field.settings), ...input.settings };
      await tx
        .update(formFields)
        .set({
          type,
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          required: cannotBeRequired(type) ? false : (input.required ?? field.required),
          ...(input.validation ? { validation: input.validation } : typeChanged ? { validation: {} } : {}),
          settings: s,
          ...(input.ref !== undefined ? { ref: input.ref } : {}),
          ...(input.placeholder !== undefined ? { placeholder: input.placeholder } : {}),
          ...(input.defaultValue !== undefined ? { defaultValue: input.defaultValue } : {}),
          ...(input.scoreConfig !== undefined ? { scoreConfig: input.scoreConfig } : {}),
        })
        .where(eq(formFields.id, fieldId));

      if (input.options) {
        // Keep ids of existing options so saved answers and logic rules stay attached.
        const existing = await tx.select().from(formFieldOptions).where(eq(formFieldOptions.fieldId, fieldId));
        const keep = new Set(input.options.filter((o) => o.id).map((o) => o.id!));
        const stale = existing.filter((o) => !keep.has(o.id)).map((o) => o.id);
        if (stale.length) {
          await tx.delete(formFieldOptions).where(inArray(formFieldOptions.id, stale));
          // Legacy rules stored the option id in `value`; v2 conditions are reported by definition validation instead.
          await tx.delete(formLogicRules).where(and(eq(formLogicRules.fieldId, fieldId), inArray(formLogicRules.value, stale)));
        }
        for (const [i, o] of input.options.entries()) {
          const values = { label: o.label, position: i, kind: o.kind ?? 'option', imageUrl: o.imageUrl ?? null, value: o.value ?? null };
          if (o.id && existing.some((e) => e.id === o.id)) await tx.update(formFieldOptions).set(values).where(eq(formFieldOptions.id, o.id));
          else await tx.insert(formFieldOptions).values({ fieldId, ...values });
        }
      } else if (typeChanged) {
        const current = await tx.select().from(formFieldOptions).where(eq(formFieldOptions.fieldId, fieldId));
        const compatible = current.filter((o) => def.optionKinds.includes(o.kind));
        if (compatible.length !== current.length) await tx.delete(formFieldOptions).where(inArray(formFieldOptions.id, current.filter((o) => !compatible.includes(o)).map((o) => o.id)));
        if (!hasOptions(type)) await tx.delete(formLogicRules).where(and(eq(formLogicRules.fieldId, fieldId), sql`${formLogicRules.operator} is not null`));
        else if (compatible.length === 0) {
          const seeds = defaultOptionsFor(type);
          await tx.insert(formFieldOptions).values(seeds.map((o, i) => ({ fieldId, label: o.label, kind: o.kind, position: i })));
        }
      }

      if (input.defaultValue === undefined && typeChanged && field.defaultValue !== null) {
        // The kept default may not fit the new type (or the new type takes no default): drop it rather than store it.
        const [fresh] = (await FormRepository.fields(tx, formId)).filter((f) => f.id === fieldId);
        if (!DEFAULT_ANSWER_TYPES.has(type) || validateFieldAnswer({ ...fresh!, required: false }, field.defaultValue)) {
          await tx.update(formFields).set({ defaultValue: null }).where(eq(formFields.id, fieldId));
        }
      }

      // Same rules as the ops endpoint; a violation rolls the whole change back.
      const [fresh] = (await FormRepository.fields(tx, formId)).filter((f) => f.id === fieldId);
      const problem = fieldStateProblem(fresh!);
      if (problem) throw unprocessable(problem);
    });
  }

  async deleteField(userId: string, formId: string, fieldId: string): Promise<FormDto> {
    return this.mutate(userId, formId, async (tx) => {
      await this.loadField(tx, formId, fieldId);
      await tx.delete(formFields).where(eq(formFields.id, fieldId));
      await this.resequence(tx, formId, await this.orderedFieldIds(tx, formId));
    });
  }

  async duplicateField(userId: string, formId: string, fieldId: string): Promise<FormDto> {
    return this.mutate(userId, formId, async (tx) => {
      const field = await this.loadField(tx, formId, fieldId);
      if (field.type === 'WELCOME') throw new AppError('CONFLICT', 'A form can have only one welcome screen.');
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = field;
      const [copy] = await tx
        .insert(formFields)
        .values({ ...rest, label: field.label ? `${field.label} (copy)` : field.label, ref: freshRef(await FormRepository.usedKeys(tx, formId)) })
        .returning();
      const options = await tx.select().from(formFieldOptions).where(eq(formFieldOptions.fieldId, fieldId)).orderBy(asc(formFieldOptions.position));
      const optionMap = new Map<string, string>();
      for (const o of options) {
        const [created] = await tx
          .insert(formFieldOptions)
          .values({ fieldId: copy!.id, label: o.label, position: o.position, kind: o.kind, imageUrl: o.imageUrl, value: o.value })
          .returning();
        optionMap.set(o.id, created!.id);
      }
      if (field.scoreConfig?.optionPoints) {
        const optionPoints = Object.fromEntries(Object.entries(field.scoreConfig.optionPoints).map(([k, v]) => [optionMap.get(k) ?? k, v]));
        await tx.update(formFields).set({ scoreConfig: { ...field.scoreConfig, optionPoints } }).where(eq(formFields.id, copy!.id));
      }
      const rules = await tx.select().from(formLogicRules).where(eq(formLogicRules.fieldId, fieldId));
      const maps = { fields: new Map([[fieldId, copy!.id]]), options: optionMap };
      for (const { id: _rid, createdAt: _rc, ...r } of rules) {
        await tx.insert(formLogicRules).values({
          ...r,
          fieldId: copy!.id,
          condition: remapCondition(r.condition, maps),
          value: r.value && optionMap.get(r.value) ? optionMap.get(r.value)! : r.value,
        });
      }
      const ids = (await this.orderedFieldIds(tx, formId)).filter((id) => id !== copy!.id);
      ids.splice(ids.indexOf(fieldId) + 1, 0, copy!.id);
      await this.resequence(tx, formId, ids);
    });
  }

  async reorderFields(userId: string, formId: string, fieldIds: string[]): Promise<FormDto> {
    return this.mutate(userId, formId, async (tx) => {
      const current = await this.orderedFieldIds(tx, formId);
      if (current.length !== fieldIds.length || new Set(fieldIds).size !== fieldIds.length || !fieldIds.every((id) => current.includes(id))) {
        throw unprocessable('The new order must contain exactly the form’s questions.');
      }
      const types = new Map((await tx.select({ id: formFields.id, type: formFields.type }).from(formFields).where(eq(formFields.formId, formId))).map((r) => [r.id, r.type]));
      const welcomeAt = fieldIds.findIndex((id) => types.get(id) === 'WELCOME');
      const firstEnding = fieldIds.findIndex((id) => types.get(id) === 'ENDING');
      const lastNonEnding = fieldIds.findLastIndex((id) => types.get(id) !== 'ENDING');
      if (welcomeAt > 0 || (firstEnding >= 0 && lastNonEnding > firstEnding)) throw unprocessable('Welcome screens stay first and ending screens stay last.');
      await this.resequence(tx, formId, fieldIds);
    });
  }

  /**
   * Replaces a field's rules. Accepts the legacy branching shape (converted) and the v2 shape, then validates the
   * rules against the whole proposed form definition.
   */
  async setLogic(userId: string, formId: string, fieldId: string, rawRules: SetLogicRuleInput[]): Promise<FormDto> {
    return this.mutate(userId, formId, async (tx) => {
      await this.loadField(tx, formId, fieldId);
      const rows = rawRules.map((raw, i) => {
        if ('operator' in raw) {
          const r = legacyLogicRuleSchema.parse(raw);
          return { ...legacyRuleToV2(fieldId, r, i), operator: r.operator, value: r.value };
        }
        return { ...logicRuleSchema.parse(raw), position: i, operator: null, value: null };
      });
      const [fields, variables] = await Promise.all([FormRepository.fields(tx, formId), FormRepository.variables(tx, formId)]);
      const proposed = { fields: fields.map((f) => (f.id === fieldId ? { ...f, rules: rows.map((r) => ({ ...r, id: '', fieldId })) } : f)), variables };
      const issues = validateDefinition(proposed).filter((i) => i.severity === 'error' && i.fieldId === fieldId && (i.ruleIndex !== null || i.code === 'rules_not_allowed'));
      if (issues.length) throw unprocessable(issues[0]!.message, { issues });
      await tx.delete(formLogicRules).where(eq(formLogicRules.fieldId, fieldId));
      if (rows.length) await tx.insert(formLogicRules).values(rows.map((r) => ({ formId, fieldId, ...r })));
    });
  }

  async setTheme(userId: string, formId: string, input: FormThemeInput): Promise<FormDto> {
    return this.mutate(userId, formId, async (tx) => {
      await tx
        .insert(formThemes)
        .values({ formId, ...input, headerImageUrl: input.headerImageUrl ?? null })
        .onConflictDoUpdate({ target: formThemes.formId, set: { ...input, headerImageUrl: input.headerImageUrl ?? null, updatedAt: new Date() } });
    });
  }

  async setPublished(userId: string, formId: string, published: boolean): Promise<FormDto> {
    const { file } = await this.access(userId, formId, 'EDITOR');
    return this.mutate(userId, formId, async (tx) => {
      if (published) {
        const [fields, variables, [row]] = await Promise.all([
          FormRepository.fields(tx, formId),
          FormRepository.variables(tx, formId),
          tx.select({ settings: forms.settings }).from(forms).where(eq(forms.id, formId)),
        ]);
        if (!fields.some((f) => QUESTION_TYPES[f.type].isInput && f.type !== 'HIDDEN')) throw unprocessable('Add at least one question before publishing.');
        if (fields.some((f) => QUESTION_TYPES[f.type].isInput && f.type !== 'HIDDEN' && !f.label.trim())) throw unprocessable('Every question needs a title before publishing.');
        const issues = validateDefinition({ fields, variables }, { quiz: !!row?.settings.quiz?.enabled, confirmationMessage: row?.settings.confirmationMessage }).filter((i) => i.severity === 'error');
        if (issues.length) throw unprocessable('Fix the highlighted problems before publishing.', { issues });
      }
      await tx
        .update(forms)
        .set(published ? { isPublished: true, publishedAt: sql`coalesce(${forms.publishedAt}, now())`, acceptingResponses: true } : { isPublished: false })
        .where(eq(forms.id, formId));
      await this.activity.record(
        { userId, action: published ? 'FORM_PUBLISHED' : 'FORM_UNPUBLISHED', resourceType: 'FILE', resourceId: file.id, resourceName: file.name },
        tx,
      );
    });
  }

  async touchCollaborator(formId: string, userId: string): Promise<string> {
    const color = presenceColor(userId);
    await this.db
      .insert(formCollaborators)
      .values({ formId, userId, color })
      .onConflictDoUpdate({ target: [formCollaborators.formId, formCollaborators.userId], set: { lastSeenAt: new Date() } });
    return color;
  }

  /** Copies definition, options, logic (with remapped ids) and theme — never responses. */
  private async copyInto(tx: Executor, sourceFileId: string, targetFileId: string, userId: string): Promise<void> {
    const source = await FormRepository.findByFileId(tx, sourceFileId);
    if (!source) return;
    const [copy] = await tx
      .insert(forms)
      .values({ fileId: targetFileId, publicId: randomToken(18), description: source.description, settings: source.settings, createdBy: userId })
      .returning();
    const theme = await FormRepository.theme(tx, source.id);
    await tx.insert(formThemes).values({ formId: copy!.id, primaryColor: theme?.primaryColor, backgroundColor: theme?.backgroundColor, fontFamily: theme?.fontFamily, headerImageUrl: theme?.headerImageUrl, extras: theme?.extras ?? {} });
    const fields: FormFieldDto[] = await FormRepository.fields(tx, source.id);
    const variables = await FormRepository.variables(tx, source.id);
    const fieldMap = new Map<string, string>();
    const optionMap = new Map<string, string>();
    const variableMap = new Map<string, string>();
    for (const v of variables) {
      const [created] = await tx
        .insert(formVariables)
        .values({ formId: copy!.id, key: v.key, type: v.type, initialValue: v.initialValue, formula: v.formula, position: v.position })
        .returning();
      variableMap.set(v.id, created!.id);
    }
    for (const f of fields) {
      const [created] = await tx
        .insert(formFields)
        .values({
          formId: copy!.id,
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
        })
        .returning();
      fieldMap.set(f.id, created!.id);
      for (const o of f.options) {
        const [opt] = await tx.insert(formFieldOptions).values({ fieldId: created!.id, label: o.label, position: o.position, kind: o.kind, imageUrl: o.imageUrl, value: o.value }).returning();
        optionMap.set(o.id, opt!.id);
      }
    }
    const maps = { fields: fieldMap, options: optionMap, variables: variableMap };
    const remapOptionIds = (sc: FormFieldDto['scoreConfig']) =>
      sc?.optionPoints ? { ...sc, optionPoints: Object.fromEntries(Object.entries(sc.optionPoints).map(([k, v]) => [optionMap.get(k) ?? k, v])) } : sc;
    for (const f of fields) {
      if (f.scoreConfig?.optionPoints) await tx.update(formFields).set({ scoreConfig: remapOptionIds(f.scoreConfig) }).where(eq(formFields.id, fieldMap.get(f.id)!));
      for (const r of f.rules) {
        await tx.insert(formLogicRules).values({
          formId: copy!.id,
          fieldId: fieldMap.get(f.id)!,
          operator: r.operator,
          value: r.value && optionMap.has(r.value) ? optionMap.get(r.value)! : r.value,
          trigger: r.trigger,
          scope: r.scope,
          condition: remapCondition(r.condition, maps),
          action: r.action,
          targetSectionId: r.targetSectionId ? (fieldMap.get(r.targetSectionId) ?? null) : null,
          targetFieldId: r.targetFieldId ? (fieldMap.get(r.targetFieldId) ?? null) : null,
          targetVariableId: r.targetVariableId ? (variableMap.get(r.targetVariableId) ?? null) : null,
          payload: r.payload,
          position: r.position,
        });
      }
    }
    if (!copy) throw new AppError('INTERNAL_ERROR', 'Form copy failed');
  }
}
