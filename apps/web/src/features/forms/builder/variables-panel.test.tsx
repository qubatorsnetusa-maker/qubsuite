import type { FormDto } from '@qub/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formsService } from '@/services/forms';
import { renderWithOps } from './ops/test-utils';
import { VariablesPanel } from './variables-panel';

vi.mock('@/services/forms', () => ({ formsService: { validateFormula: vi.fn() } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }) }));

const form = { id: 'form1', fields: [{ id: 'p', ref: 'price', label: 'Price', type: 'NUMBER', rules: [] }], variables: [] } as unknown as FormDto;
const V = '00000000-0000-4000-8000-000000000001';

beforeEach(() => vi.clearAllMocks());

describe('VariablesPanel', () => {
  it('creates a calculated variable after checking its formula', async () => {
    vi.mocked(formsService.validateFormula).mockResolvedValueOnce({ ok: false, error: 'Unknown name: {{qty}}' }).mockResolvedValue({ ok: true });
    const { apply } = renderWithOps(<VariablesPanel form={form} issues={[]} />, { form });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New variable name'), 'total');
    await user.type(screen.getByRole('combobox', { name: 'New variable formula' }), '{{{{price}} * {{{{qty}}');
    expect(await screen.findByText('Unknown name: {{qty}}')).toBeInTheDocument();
    await user.clear(screen.getByRole('combobox', { name: 'New variable formula' }));
    await user.type(screen.getByRole('combobox', { name: 'New variable formula' }), '{{{{price}} * 2');
    await waitFor(() => expect(screen.queryByText(/Unknown name/)).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    expect(apply.mock.calls.at(-1)![0].ops[0]).toMatchObject({ kind: 'create', entity: 'variable', snapshot: { key: 'total', type: 'NUMBER', initialValue: 0, formula: '{{price}} * 2' } });
  });

  it('will not add a variable under a reserved or overlong name', async () => {
    renderWithOps(<VariablesPanel form={form} issues={[]} />, { form });
    const user = userEvent.setup();
    const name = screen.getByLabelText('New variable name');
    await user.type(name, 'score');
    expect(screen.getByRole('button', { name: 'Add variable' })).toBeDisabled();
    await user.clear(name);
    await user.type(name, `a${'b'.repeat(64)}`);
    expect(screen.getByRole('button', { name: 'Add variable' })).toBeDisabled();
    await user.clear(name);
    await user.type(name, 'total');
    expect(screen.getByRole('button', { name: 'Add variable' })).toBeEnabled();
  });

  it('will not add a variable under a name a question or variable already uses, whatever the case', async () => {
    const withVar = { ...form, variables: [{ id: V, key: 'total', type: 'NUMBER', initialValue: 0, formula: null, position: 0 }] } as unknown as FormDto;
    const { apply } = renderWithOps(<VariablesPanel form={withVar} issues={[]} />, { form: withVar });
    const user = userEvent.setup();
    const name = screen.getByLabelText('New variable name');
    for (const taken of ['Price', 'TOTAL']) {
      await user.clear(name);
      await user.type(name, taken);
      expect(screen.getByText(`The name “${taken}” is already used in this form.`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add variable' })).toBeDisabled();
    }
    await user.clear(name);
    await user.type(name, 'subtotal');
    expect(screen.queryByText(/is already used/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    expect(apply.mock.calls.at(-1)![0].ops[0]).toMatchObject({ kind: 'create', entity: 'variable', snapshot: { key: 'subtotal' } });
  });

  it('explains instead of silently doing nothing when the formula is too long', async () => {
    vi.mocked(formsService.validateFormula).mockResolvedValue({ ok: true });
    const { apply } = renderWithOps(<VariablesPanel form={form} issues={[]} />, { form });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New variable name'), 'total');
    fireEvent.change(screen.getByRole('combobox', { name: 'New variable formula' }), { target: { value: '1+'.repeat(1001) } });
    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    expect(apply).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/^Can’t add this variable: formula/));
  });

  it('is editable by default, and read-only (no add or delete, formulas disabled) when canEdit is false', () => {
    const withVar = { ...form, variables: [{ id: V, key: 'total', type: 'NUMBER', initialValue: 0, formula: null, position: 0 }] } as unknown as FormDto;
    const { unmount } = renderWithOps(<VariablesPanel form={withVar} issues={[]} />, { form: withVar });
    expect(screen.getByLabelText('Formula for total')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete total' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add variable' })).toBeInTheDocument();
    unmount();
    renderWithOps(<VariablesPanel form={withVar} issues={[]} canEdit={false} />, { form: withVar, readOnly: true });
    expect(screen.getByLabelText('Formula for total')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Delete total' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New variable name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add variable' })).not.toBeInTheDocument();
  });

  it('deletes a variable and its toast undoes only that deletion', async () => {
    const withVar = { ...form, variables: [{ id: V, key: 'total', type: 'NUMBER', initialValue: 0, formula: null, position: 0 }] } as unknown as FormDto;
    const undoIf = vi.fn(() => false);
    const { apply } = renderWithOps(<VariablesPanel form={withVar} issues={[]} />, { form: withVar, undoIf });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete total' }));
    const tx = apply.mock.calls.at(-1)![0];
    expect(tx.ops.at(-1)).toMatchObject({ kind: 'delete', entity: 'variable', id: V });
    const [message, opts] = vi.mocked(toast).mock.calls.at(-1)!;
    expect(message).toBe('Variable “total” deleted');
    (opts as unknown as { action: { onClick(): void } }).action.onClick();
    expect(undoIf).toHaveBeenCalledWith(tx.txId);
    expect(toast.info).toHaveBeenCalled();
  });
});
