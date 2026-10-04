import { formSetTx } from '@qub/shared/forms';
import { announceDriveChange } from '@/features/drive/create-actions';
import { formsService } from '@/services/forms';

/**
 * Creates a Forms v2 form (blank, or a copy of a template) and switches it to one question at a time, using the
 * same op builder as the builder so both apps write identical changes. Returns the new form's id.
 */
export async function createV2Form(search: { folder?: string; template?: string }): Promise<string> {
  const form = await formsService.create({ folderId: search.folder, templateId: search.template });
  try {
    const tx = form.settings.layout === 'conversational' ? null : formSetTx(form, { settings: { layout: 'conversational' } }, 'Use one question at a time');
    if (tx) await formsService.applyOps(form.id, tx);
  } finally {
    // The form exists either way; other tabs' Drive listings should show it.
    announceDriveChange();
  }
  return form.id;
}
