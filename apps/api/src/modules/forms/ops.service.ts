import { sanitizeFilename, type ApplyOpsResult, type FormDto } from '@qub/shared';
import { applyTx, assignFreshKeys, OpConflictError, OpInvalidError, txProblem, type AssignedKeys, type OpTx } from '@qub/shared/forms';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { Database } from '../../db';
import { formOpLog, forms } from '../../db/schema';
import { AppError, badRequest, notFound, unprocessable } from '../../utils/errors';
import type { ActivityService } from '../activity/activity.service';
import type { FileService } from '../files/file.service';
import type { FormService } from './form.service';
import { persistFormDiff } from './ops-persist';

/**
 * Applies builder transactions. The form row is locked so a form's transactions apply one at a time; each is checked
 * against the current state (preconditions), validated as a whole, persisted as a diff and logged for idempotency.
 */
export class OpsService {
  constructor(
    private readonly db: Database,
    private readonly forms: FormService,
    private readonly files: FileService,
    private readonly activity: ActivityService,
  ) {}

  async apply(userId: string, formId: string, input: OpTx): Promise<ApplyOpsResult> {
    let outcome: { revision: number; assigned: AssignedKeys; replayed: boolean } | undefined;
    await this.db.transaction(async (tx) => {
      const [locked] = await tx.select({ id: forms.id }).from(forms).where(eq(forms.id, formId)).for('update');
      if (!locked) throw notFound('form');
      const { file } = await this.forms.access(userId, formId, 'EDITOR', tx);
      if (file.isTrashed) throw badRequest('Restore this form from the trash to edit it.');

      const [prior] = await tx.select().from(formOpLog).where(and(eq(formOpLog.formId, formId), eq(formOpLog.txId, input.txId))).limit(1);
      if (prior) {
        outcome = { revision: prior.revision, assigned: prior.assigned, replayed: true };
        return;
      }

      const before = await this.forms.get(userId, formId, { recordOpen: false }, tx);
      let applied: FormDto;
      try {
        applied = applyTx(before, input);
      } catch (e) {
        if (e instanceof OpConflictError) throw new AppError('CONFLICT', e.message, { conflicts: e.conflicts });
        if (e instanceof OpInvalidError) throw unprocessable(e.message);
        throw e;
      }
      const { form: fresh, assigned } = assignFreshKeys(applied, input);
      const problem = txProblem(before, fresh, input);
      if (problem) throw unprocessable(problem.message, problem.issues ? { issues: problem.issues } : undefined);
      // The title is the Drive file's name: clean it exactly as a rename does.
      const after = fresh.title === before.title ? fresh : { ...fresh, title: sanitizeFilename(fresh.title, before.title) };
      if (after.title !== before.title) {
        await this.activity.record(
          { userId, action: 'FILE_RENAMED', resourceType: 'FILE', resourceId: file.id, resourceName: after.title, metadata: { from: before.title, to: after.title } },
          tx,
        );
      }

      await persistFormDiff(tx, before, after);
      const [row] = await tx
        .update(forms)
        .set({ updatedAt: new Date(), revision: sql`${forms.revision} + 1` })
        .where(eq(forms.id, formId))
        .returning({ revision: forms.revision });
      await this.files.recordEdited(userId, file, tx);
      await tx.insert(formOpLog).values({ formId, txId: input.txId, userId, revision: row!.revision, assigned });
      await tx.delete(formOpLog).where(and(eq(formOpLog.formId, formId), lt(formOpLog.appliedAt, sql`now() - interval '30 days'`)));
      outcome = { revision: row!.revision, assigned, replayed: false };
    });
    if (!outcome!.replayed) this.forms.notifyChanged(formId, userId, { txId: input.txId, revision: outcome!.revision });
    return { revision: outcome!.revision, assigned: outcome!.assigned, form: await this.forms.get(userId, formId, { recordOpen: false }) };
  }
}
