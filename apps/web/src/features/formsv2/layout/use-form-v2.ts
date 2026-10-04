import type { FormDto } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBuilderOps, type BuilderOps } from '@/features/forms/builder/ops/builder-ops';
import { ApiError, errorMessage } from '@/lib/api';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';

/** Loads the form with the same query (and cache entry) as the classic builder, so both apps stay in step. */
export function useFormV2Query(formId: string) {
  return useQuery({ queryKey: qk.forms.one(formId), queryFn: () => formsService.get(formId) });
}

/** Inside the frame: the form as shown (pending edits folded in), the builder operations, and whether this person may edit. */
export function useFormV2() {
  const ops = useBuilderOps();
  const form = ops.form;
  const canEdit = form.capabilities.canEdit && !form.isTrashed && !ops.readOnly;
  return { form, ops, canEdit };
}

/**
 * Publishes or unpublishes the form: flushes every pending edit first, then calls the same publish endpoint as
 * the classic builder. Shared by the frame's header Publish/Unpublish button and the Share tab's Publish
 * action, so both trigger the exact same call.
 */
export function usePublishFormV2(form: FormDto, ops: Pick<BuilderOps, 'flush'>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (published: boolean) => {
      await ops.flush();
      return formsService.publish(form.id, published);
    },
    onSuccess: (f: FormDto) => {
      qc.setQueryData(qk.forms.one(form.id), f);
      toast.success(f.isPublished ? 'Form published — share the link to collect responses' : 'Form unpublished');
    },
    onError: (e) => {
      const issues = e instanceof ApiError ? (e.details as { issues?: unknown[] } | undefined)?.issues : undefined;
      toast.error(issues?.length ? `Fix ${issues.length} problem(s) highlighted in the form before publishing` : errorMessage(e));
    },
  });
}
