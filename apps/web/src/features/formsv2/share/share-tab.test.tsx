import type { FormDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { formSetTx } from '@qub/shared/forms';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithOps } from '@/features/forms/builder/ops/test-utils';
import { formsService } from '@/services/forms';
import { ShareTab } from './share-tab';

vi.mock('@/services/forms', () => ({ formsService: { publish: vi.fn() } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }) }));
vi.mock('@/features/sharing/share-dialog', () => ({ ShareDialog: ({ target }: { target: unknown }) => (target ? <div role="dialog" aria-label="collaborator share" /> : null) }));

beforeEach(() => vi.clearAllMocks());

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function makeForm(overrides: Partial<FormDto> = {}, capabilities: Partial<FormDto['capabilities']> = { canEdit: true, canTrash: true }): FormDto {
  return {
    id: uid(900),
    fileId: 'file1',
    publicId: 'pub-abc',
    title: 'Customer survey',
    revision: 0,
    isPublished: false,
    isTrashed: false,
    acceptingResponses: true,
    settings: { ...DEFAULT_FORM_SETTINGS },
    variables: [],
    fields: [],
    theme: { primaryColor: '#673ab7' },
    capabilities,
    ...overrides,
  } as unknown as FormDto;
}

describe('ShareTab', () => {
  it('shows a Publish action when the form is not published', () => {
    const form = makeForm({ isPublished: false });
    renderWithOps(<ShareTab />, { form });
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Public link' })).not.toBeInTheDocument();
  });

  it('publishing flushes pending edits first, then calls the publish service', async () => {
    const form = makeForm({ isPublished: false });
    const flush = vi.fn().mockResolvedValue(undefined);
    vi.mocked(formsService.publish).mockResolvedValue({ ...form, isPublished: true });
    renderWithOps(<ShareTab />, { form, flush });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Publish' }));
    expect(flush).toHaveBeenCalled();
    await vi.waitFor(() => expect(formsService.publish).toHaveBeenCalledWith(form.id, true));
  });

  it('shows the public link, Copy link and Open when published', () => {
    const form = makeForm({ isPublished: true, publicId: 'pub-abc' });
    renderWithOps(<ShareTab />, { form });
    const link = screen.getByRole('textbox', { name: 'Public link' });
    expect(link).toHaveValue(`${window.location.origin}/formsv2/f/pub-abc`);
    expect(link).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', `${window.location.origin}/formsv2/f/pub-abc`);
  });

  it('copying the link uses the clipboard and shows a toast', async () => {
    const form = makeForm({ isPublished: true, publicId: 'pub-abc' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWithOps(<ShareTab />, { form });
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/formsv2/f/pub-abc`);
  });

  it('toggling Accepting responses applies the same form op as form settings', async () => {
    const form = makeForm({ isPublished: true, acceptingResponses: true });
    const apply = vi.fn();
    renderWithOps(<ShareTab />, { form, apply });
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Accepting responses' }));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]![0]!.ops).toEqual(formSetTx(form, { acceptingResponses: false })!.ops);
  });

  it('toggling Require sign-in and Limit to 1 response applies the settings op', async () => {
    const form = makeForm({ isPublished: true });
    const apply = vi.fn();
    renderWithOps(<ShareTab />, { form, apply });
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Require sign-in' }));
    expect(apply.mock.calls[0]![0]!.ops).toEqual(formSetTx(form, { settings: { requireSignIn: true } })!.ops);

    apply.mockClear();
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Limit to 1 response' }));
    expect(apply.mock.calls[0]![0]!.ops).toEqual(formSetTx(form, { settings: { limitOneResponse: true } })!.ops);
  });

  it('once published, offers no Republish (edits are live once saved, and publishing again would reopen a closed form)', async () => {
    const form = makeForm({ isPublished: true, acceptingResponses: false });
    renderWithOps(<ShareTab />, { form });
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.getByText('Changes go live as soon as they’re saved.')).toBeInTheDocument();
    expect(formsService.publish).not.toHaveBeenCalled();
  });

  it('opens the collaborator share dialog', async () => {
    const form = makeForm({ isPublished: true });
    renderWithOps(<ShareTab />, { form });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('dialog', { name: 'collaborator share' })).toBeInTheDocument();
  });

  it('viewers see no Publish action on an unpublished form', () => {
    const form = makeForm({ isPublished: false }, { canEdit: false, canTrash: false });
    renderWithOps(<ShareTab />, { form, readOnly: true });
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getByText('Only editors can publish this form.')).toBeInTheDocument();
  });

  it('read-only: every editing control is disabled, but the link is still copyable', () => {
    const form = makeForm({ isPublished: true }, { canEdit: false, canTrash: false });
    renderWithOps(<ShareTab />, { form, readOnly: true });
    expect(screen.getByRole('switch', { name: 'Accepting responses' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Require sign-in' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Limit to 1 response' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeEnabled();
  });
});
