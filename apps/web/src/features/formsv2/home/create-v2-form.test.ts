import type { ApplyOpsResult, FormDto } from '@qub/shared';
import { applyTx, formSetTx } from '@qub/shared/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { announceDriveChange } from '@/features/drive/create-actions';
import { formsService } from '@/services/forms';
import { createV2Form } from './create-v2-form';

vi.mock('@/services/forms', () => ({ formsService: { create: vi.fn(), applyOps: vi.fn() } }));
vi.mock('@/features/drive/create-actions', () => ({ announceDriveChange: vi.fn() }));

const FOLDER = '00000000-0000-4000-8000-000000000001';
const created = (layout: 'classic' | 'conversational'): FormDto =>
  ({
    id: '00000000-0000-4000-8000-000000000900',
    revision: 1,
    title: 'Untitled form',
    description: null,
    acceptingResponses: true,
    settings: { layout, quiz: { enabled: false, showScore: false } },
    fields: [],
    variables: [],
  }) as unknown as FormDto;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(formsService.applyOps).mockImplementation(async (_id, tx) => ({ revision: 2, form: applyTx(created('classic'), tx), assigned: { fields: {}, variables: {} } }) as ApplyOpsResult);
});

describe('createV2Form', () => {
  it('creates the form (from the template, in the folder) and switches it to one question at a time', async () => {
    const form = created('classic');
    vi.mocked(formsService.create).mockResolvedValue(form);

    const id = await createV2Form({ folder: FOLDER, template: 'contact' });

    expect(id).toBe(form.id);
    expect(formsService.create).toHaveBeenCalledWith({ folderId: FOLDER, templateId: 'contact' });
    expect(formsService.applyOps).toHaveBeenCalledTimes(1);
    const [formId, tx] = vi.mocked(formsService.applyOps).mock.calls[0]!;
    expect(formId).toBe(form.id);
    // Exactly what the shared op builder produces, so v2 and old Forms write identical transactions.
    const expected = formSetTx(form, { settings: { layout: 'conversational' } }, 'Use one question at a time')!;
    expect(tx.ops).toEqual(expected.ops);
    expect(applyTx(form, tx).settings.layout).toBe('conversational');
    expect(announceDriveChange).toHaveBeenCalled();
  });

  it('sends nothing more when the new form is already conversational', async () => {
    vi.mocked(formsService.create).mockResolvedValue(created('conversational'));
    await createV2Form({});
    expect(formsService.create).toHaveBeenCalledWith({ folderId: undefined, templateId: undefined });
    expect(formsService.applyOps).not.toHaveBeenCalled();
    expect(announceDriveChange).toHaveBeenCalled();
  });

  it('still tells Drive about the new form when switching the layout fails, and reports the failure', async () => {
    vi.mocked(formsService.create).mockResolvedValue(created('classic'));
    vi.mocked(formsService.applyOps).mockRejectedValue(new Error('offline'));
    await expect(createV2Form({})).rejects.toThrow('offline');
    expect(announceDriveChange).toHaveBeenCalled();
  });
});
