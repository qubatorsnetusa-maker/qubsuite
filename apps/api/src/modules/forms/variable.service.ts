import type { CreateVariableInput, FormDto, UpdateVariableInput } from '@qub/shared';
import { createVariableSchema, updateVariableSchema } from '@qub/shared';
import { checkFormula, validateDefinition } from '@qub/shared/forms';
import { and, count, eq } from 'drizzle-orm';
import type { Database, Executor } from '../../db';
import { formLogicRules, formVariables } from '../../db/schema';
import { AppError, notFound, unprocessable } from '../../utils/errors';
import { FormRepository } from './form.repository';
import type { FormService } from './form.service';

export class VariableService {
  constructor(
    private readonly db: Database,
    private readonly forms: FormService,
  ) {}

  private async assertKeyFree(tx: Executor, formId: string, key: string, exceptVariableId?: string) {
    const [fields, variables] = await Promise.all([FormRepository.fields(tx, formId), FormRepository.variables(tx, formId)]);
    const clash = fields.some((f) => f.ref.toLowerCase() === key.toLowerCase()) || variables.some((v) => v.id !== exceptVariableId && v.key.toLowerCase() === key.toLowerCase());
    if (clash) throw new AppError('CONFLICT', `The name “${key}” is already used in this form.`);
  }

  /** Validates the whole definition as it would be after the change; rejects errors that concern this variable. */
  private async assertValid(tx: Executor, formId: string, variableId: string) {
    const [fields, variables] = await Promise.all([FormRepository.fields(tx, formId), FormRepository.variables(tx, formId)]);
    const issues = validateDefinition({ fields, variables }).filter((i) => i.severity === 'error' && (i.variableId === variableId || i.code === 'computed_variable_target'));
    if (issues.length) throw unprocessable(issues[0]!.message, { issues });
  }

  async create(userId: string, formId: string, raw: CreateVariableInput): Promise<FormDto> {
    const input = createVariableSchema.parse(raw);
    return this.forms.mutate(userId, formId, async (tx) => {
      await this.assertKeyFree(tx, formId, input.key);
      const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(formVariables).where(eq(formVariables.formId, formId));
      if (n >= 100) throw unprocessable('A form can have at most 100 variables.');
      const [row] = await tx.insert(formVariables).values({ formId, key: input.key, type: input.type, initialValue: input.initialValue, formula: input.formula || null, position: n }).returning();
      await this.assertValid(tx, formId, row!.id);
    });
  }

  async update(userId: string, formId: string, variableId: string, raw: UpdateVariableInput): Promise<FormDto> {
    const input = updateVariableSchema.parse(raw);
    return this.forms.mutate(userId, formId, async (tx) => {
      const [existing] = await tx.select().from(formVariables).where(and(eq(formVariables.id, variableId), eq(formVariables.formId, formId))).limit(1);
      if (!existing) throw notFound('variable');
      if (input.key !== undefined && input.key.toLowerCase() !== existing.key.toLowerCase()) await this.assertKeyFree(tx, formId, input.key, variableId);
      if (input.formula) {
        const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(formLogicRules).where(eq(formLogicRules.targetVariableId, variableId));
        if (n > 0) throw unprocessable('Rules set this variable. Remove those rules before giving it a formula.');
      }
      await tx
        .update(formVariables)
        .set({
          ...(input.key !== undefined ? { key: input.key } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.initialValue !== undefined ? { initialValue: input.initialValue } : {}),
          ...(input.formula !== undefined ? { formula: input.formula || null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(formVariables.id, variableId));
      await this.assertValid(tx, formId, variableId);
    });
  }

  async remove(userId: string, formId: string, variableId: string): Promise<FormDto> {
    return this.forms.mutate(userId, formId, async (tx) => {
      const deleted = await tx.delete(formVariables).where(and(eq(formVariables.id, variableId), eq(formVariables.formId, formId))).returning({ id: formVariables.id });
      if (!deleted.length) throw notFound('variable');
    });
  }

  async validateFormula(userId: string, formId: string, formula: string): Promise<{ ok: true } | { ok: false; error: string }> {
    await this.forms.access(userId, formId, 'VIEWER');
    const known = new Set([...(await FormRepository.usedKeys(this.db, formId)), 'score']);
    const error = checkFormula(formula, known);
    return error ? { ok: false, error } : { ok: true };
  }
}
