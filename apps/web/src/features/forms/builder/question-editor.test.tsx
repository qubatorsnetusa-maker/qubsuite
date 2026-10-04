import type { FormDto, FormFieldDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formsService } from '@/services/forms';
import { renderWithOps } from './ops/test-utils';
import { ANSWER_COUNT_TIMEOUT_MS, QuestionEditor } from './question-editor';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const field: FormFieldDto = { id: uid(1), ref: 'q1', type: 'SHORT_ANSWER', label: 'Name', description: null, required: false, position: 0, validation: {}, settings: {}, options: [], rules: [], scoreConfig: null, placeholder: null, defaultValue: null };
const form = { id: uid(900), revision: 0, settings: { ...DEFAULT_FORM_SETTINGS }, variables: [], fields: [field], theme: { primaryColor: '#673ab7' } } as unknown as FormDto;

describe('QuestionEditor on operations', () => {
  it('sends typed text as one debounced label change and toggles Required', async () => {
    const { apply } = renderWithOps(<QuestionEditor form={form} field={field} active onActivate={() => {}} canEdit />, { form });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Question text'), ' please');
    await user.tab();
    const labelTx = apply.mock.calls.map((c) => c[0]).find((tx) => tx?.ops[0]?.changes?.label);
    expect(labelTx.ops[0]).toMatchObject({ kind: 'set', entity: 'field', id: uid(1), changes: { label: { from: 'Name', to: 'Name please' } } });
    await user.click(screen.getByRole('switch'));
    expect(apply.mock.calls.at(-1)![0].ops[0]).toMatchObject({ changes: { required: { from: false, to: true } } });
  });

  it('deletes immediately and offers Undo', async () => {
    const { toast } = await import('sonner');
    const undoIf = vi.fn(() => true);
    const { apply } = renderWithOps(<QuestionEditor form={form} field={field} active onActivate={() => {}} canEdit />, { form, undoIf });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    const deleteTx = apply.mock.calls.at(-1)![0];
    expect(deleteTx.ops.at(-1)).toMatchObject({ kind: 'delete', id: uid(1) });
    const [, opts] = vi.mocked(toast).mock.calls.at(-1)!;
    expect(opts).toMatchObject({ duration: 8000, action: { label: 'Undo' } });
    (opts as unknown as { action: { onClick(): void } }).action.onClick();
    // Only that deletion is undone, never whatever happens to be on top.
    expect(undoIf).toHaveBeenCalledWith(deleteTx.txId);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('the toast’s Undo points to the Undo button once other edits were made since the delete', async () => {
    const { toast } = await import('sonner');
    const undo = vi.fn();
    renderWithOps(<QuestionEditor form={form} field={field} active onActivate={() => {}} canEdit />, { form, undo, undoIf: () => false });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    const [, opts] = vi.mocked(toast).mock.calls.at(-1)!;
    (opts as unknown as { action: { onClick(): void } }).action.onClick();
    expect(undo).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/Undo button/));
  });
});

describe('deleting a question that has answers', () => {
  const answered = (n: number) => ({ totalResponses: 3, views: 0, responseRate: null, firstResponseAt: null, lastResponseAt: null, trend: [], fields: [{ fieldId: uid(1), label: 'Name', type: 'SHORT_ANSWER' as const, answered: n, skipped: 3 - n }] });
  const withResponses = { ...form, responseCount: 3 } as FormDto;

  it('asks first, and Cancel keeps the question', async () => {
    vi.spyOn(formsService, 'analytics').mockResolvedValue(answered(2));
    const { apply } = renderWithOps(<QuestionEditor form={withResponses} field={field} active onActivate={() => {}} canEdit />, { form: withResponses });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete this question and its 2 answers?');
    expect(dialog).toHaveTextContent('Undo won’t bring the answers back.');
    expect(apply).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(apply).not.toHaveBeenCalled();
  });

  it('deletes with the Undo toast once confirmed', async () => {
    const { toast } = await import('sonner');
    vi.spyOn(formsService, 'analytics').mockResolvedValue(answered(1));
    const { apply } = renderWithOps(<QuestionEditor form={withResponses} field={field} active onActivate={() => {}} canEdit />, { form: withResponses });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete this question and its 1 answer?');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(apply.mock.calls.at(-1)![0].ops.at(-1)).toMatchObject({ kind: 'delete', id: uid(1) });
    expect(vi.mocked(toast).mock.calls.at(-1)![0]).toBe('Question deleted');
  });

  it('deletes at once when this question has no answers, even if the form has responses', async () => {
    vi.spyOn(formsService, 'analytics').mockResolvedValue(answered(0));
    const { apply } = renderWithOps(<QuestionEditor form={withResponses} field={field} active onActivate={() => {}} canEdit />, { form: withResponses });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(apply).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks without the number when the answer count takes too long', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.spyOn(formsService, 'analytics').mockReturnValue(new Promise(() => {}));
      const { apply } = renderWithOps(<QuestionEditor form={withResponses} field={field} active onActivate={() => {}} canEdit />, { form: withResponses });
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Delete' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await act(async () => void vi.advanceTimersByTime(ANSWER_COUNT_TIMEOUT_MS));
      expect(await screen.findByRole('alertdialog')).toHaveTextContent('Delete this question and its answers?');
      expect(apply).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('still asks when the answer count can’t be loaded', async () => {
    vi.spyOn(formsService, 'analytics').mockRejectedValue(new Error('offline'));
    const { apply } = renderWithOps(<QuestionEditor form={withResponses} field={field} active onActivate={() => {}} canEdit />, { form: withResponses });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Delete this question and its answers?');
    expect(apply).not.toHaveBeenCalled();
  });

  it('never asks for screens and content blocks, which collect no answers', async () => {
    const spy = vi.spyOn(formsService, 'analytics');
    const ending = { ...field, type: 'ENDING' as const, label: 'Thanks' };
    const f = { ...withResponses, fields: [ending] } as FormDto;
    const { apply } = renderWithOps(<QuestionEditor form={f} field={ending} active onActivate={() => {}} canEdit />, { form: f });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(apply).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});
