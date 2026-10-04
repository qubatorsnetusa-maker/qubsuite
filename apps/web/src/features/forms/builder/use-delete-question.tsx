import type { FormDto } from '@qub/shared';
import { deleteFieldTx, QUESTION_TYPES } from '@qub/shared/forms';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/dialog';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';
import { applyWithUndoToast, useBuilderOps } from './ops/builder-ops';

/** How long Delete waits for the answer count before asking without it. */
export const ANSWER_COUNT_TIMEOUT_MS = 5000;

/**
 * Deleting a question, guarded the way both builders need it: Undo brings the question back but not its answers
 * (deleting a question deletes them), so when the question has collected answers this asks first ("Delete this
 * question and its N answers?"); otherwise it deletes at once with the Undo toast. The answer count is looked up when
 * Delete is pressed; a slow lookup gives up after `ANSWER_COUNT_TIMEOUT_MS` and asks without the number.
 *
 * Render `dialog` somewhere in the calling component. `onDeleted` (per call) runs once the deletion is applied.
 */
export function useDeleteQuestion(form: FormDto): {
  remove(fieldId: string, onDeleted?: () => void): Promise<void>;
  checking: boolean;
  dialog: ReactNode;
} {
  const ops = useBuilderOps();
  const qc = useQueryClient();
  // Checking the answer count takes a request; delete from the form as it is by then.
  const latest = useRef(form);
  latest.current = form;
  /** Open when the question has collected answers: `answers` is `null` if their number couldn't be loaded. */
  const [pending, setPending] = useState<{ fieldId: string; answers: number | null; onDeleted?: () => void } | null>(null);
  const [checking, setChecking] = useState(false);

  const deleteNow = (fieldId: string, onDeleted?: () => void) => {
    applyWithUndoToast(ops, deleteFieldTx(latest.current, fieldId), 'Question deleted');
    onDeleted?.();
  };

  const remove = async (fieldId: string, onDeleted?: () => void) => {
    const field = form.fields.find((f) => f.id === fieldId);
    if (!field || !QUESTION_TYPES[field.type].isInput || !(form.responseCount > 0)) return deleteNow(fieldId, onDeleted);
    setChecking(true);
    let answers: number | null;
    try {
      // A slow lookup mustn't hold the delete up: after a while, ask without the number.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const analytics = await Promise.race([
        qc.fetchQuery({ queryKey: qk.forms.analytics(form.id, 30), queryFn: () => formsService.analytics(form.id, 30), staleTime: 0 }),
        new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), ANSWER_COUNT_TIMEOUT_MS))),
      ]).finally(() => clearTimeout(timer));
      answers = analytics.fields.find((f) => f.fieldId === fieldId)?.answered ?? 0;
    } catch {
      answers = null;
    } finally {
      setChecking(false);
    }
    if (answers === 0) deleteNow(fieldId, onDeleted);
    else setPending({ fieldId, answers, onDeleted });
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title={pending?.answers == null ? 'Delete this question and its answers?' : `Delete this question and its ${pending.answers} answer${pending.answers === 1 ? '' : 's'}?`}
      description="Undo won’t bring the answers back."
      confirmLabel="Delete"
      destructive
      onConfirm={() => {
        if (!pending) return;
        setPending(null);
        deleteNow(pending.fieldId, pending.onDeleted);
      }}
    />
  );

  return { remove, checking, dialog };
}
