import type { FormDto, FormFieldDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { fieldSetTx, formSetTx } from '@qub/shared/forms';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithOps } from '@/features/forms/builder/ops/test-utils';
import { SettingsSidebar } from './settings-sidebar';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }) }));

beforeEach(() => vi.clearAllMocks());

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const field = (over: Partial<FormFieldDto>): FormFieldDto => ({
  id: over.id!,
  ref: over.ref ?? 'q',
  type: 'SHORT_ANSWER',
  label: 'Untitled',
  description: null,
  required: false,
  position: 0,
  validation: {},
  settings: {},
  options: [],
  rules: [],
  scoreConfig: null,
  placeholder: null,
  defaultValue: null,
  ...over,
});

const welcome = field({ id: uid(1), ref: 'welcome', type: 'WELCOME', label: 'Welcome', position: 0 });
const name = field({ id: uid(2), ref: 'name', type: 'SHORT_ANSWER', label: 'What is your name?', position: 1 });
const age = field({ id: uid(3), ref: 'age', type: 'NUMBER', label: 'How old are you?', position: 2 });

function makeForm(fields: FormFieldDto[], settings: Partial<FormDto['settings']> = {}): FormDto {
  return {
    id: uid(900),
    title: 'Survey',
    description: null,
    revision: 0,
    acceptingResponses: true,
    settings: { ...DEFAULT_FORM_SETTINGS, layout: 'conversational', ...settings },
    variables: [],
    fields,
    isTrashed: false,
    theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null },
    capabilities: { canEdit: true, canTrash: true },
  } as unknown as FormDto;
}

describe('SettingsSidebar', () => {
  it('toggling Required applies the builder’s field change', async () => {
    const form = makeForm([welcome, name, age]);
    const { apply } = renderWithOps(<SettingsSidebar form={form} field={name} canEdit />, { form });
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Required' }));
    const tx = apply.mock.calls.at(-1)![0];
    expect(tx.ops).toEqual(fieldSetTx(form, name.id, { required: true }, 'Make required')!.ops);
    expect(tx.label).toBe('Make required');
  });

  it('changing the type applies the builder’s type conversion', async () => {
    const form = makeForm([welcome, name, age]);
    const { apply } = renderWithOps(<SettingsSidebar form={form} field={name} canEdit />, { form });
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Question type' }), 'PARAGRAPH');
    const tx = apply.mock.calls.at(-1)![0];
    expect(tx.ops).toEqual(fieldSetTx(form, name.id, { type: 'PARAGRAPH' }, 'Change question type')!.ops);
  });

  it('screens keep their type and have no Required switch', () => {
    const form = makeForm([welcome, name]);
    renderWithOps(<SettingsSidebar form={form} field={welcome} canEdit />, { form });
    expect(screen.getByRole('combobox', { name: 'Question type' })).toBeDisabled();
    expect(screen.queryByRole('switch', { name: 'Required' })).not.toBeInTheDocument();
    // The screen's own settings panel (button text, image).
    expect(screen.getByLabelText('Button text')).toBeInTheDocument();
  });

  it('shows the type’s settings panel wired to field changes', async () => {
    const form = makeForm([welcome, name, age]);
    const { apply } = renderWithOps(<SettingsSidebar form={form} field={age} canEdit />, { form });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Maximum'), '120');
    await user.tab();
    const tx = apply.mock.calls.at(-1)![0];
    expect(tx.ops).toEqual(fieldSetTx(form, age.id, { validation: { max: 120 } }, 'Change settings')!.ops);
  });

  it('changes the question key on blur', async () => {
    const form = makeForm([welcome, name]);
    const { apply } = renderWithOps(<SettingsSidebar form={form} field={name} canEdit />, { form });
    const user = userEvent.setup();
    const key = screen.getByLabelText('Question key');
    await user.clear(key);
    await user.type(key, 'full_name');
    await user.tab();
    expect(apply.mock.calls.at(-1)![0].ops).toEqual(fieldSetTx(form, name.id, { ref: 'full_name' }, 'Change key')!.ops);
  });

  it('shows scoring only in quiz mode', () => {
    const form = makeForm([welcome, name]);
    const { unmount } = renderWithOps(<SettingsSidebar form={form} field={name} canEdit />, { form });
    expect(screen.queryByText('Correct answer')).not.toBeInTheDocument();
    unmount();
    const quiz = makeForm([welcome, name], { quiz: { enabled: true, showScore: true } });
    renderWithOps(<SettingsSidebar form={quiz} field={quiz.fields[1]!} canEdit />, { form: quiz });
    expect(screen.getByText('Correct answer')).toBeInTheDocument();
  });

  it('counts logic rules and opens the logic editor in a side sheet', async () => {
    const form = makeForm([welcome, name, age]);
    renderWithOps(<SettingsSidebar form={form} field={name} canEdit />, { form });
    expect(screen.getByText('No rules')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit logic' }));
    const sheet = screen.getByRole('dialog', { name: 'Logic for “What is your name?”' });
    expect(within(sheet).getByRole('button', { name: 'Only show when…' })).toBeInTheDocument();
  });

  it('shows form settings when nothing is selected, including Layout', async () => {
    const form = makeForm([welcome, name]);
    const { apply } = renderWithOps(<SettingsSidebar form={form} field={null} canEdit />, { form });
    expect(screen.getByRole('heading', { name: 'Form settings' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Layout' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /One question at a time/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /Theme/ })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('switch', { name: /Show progress bar/ }));
    expect(apply.mock.calls.at(-1)![0].ops).toEqual(formSetTx(form, { settings: { showProgressBar: !form.settings.showProgressBar } }, 'Change settings')!.ops);
  });

  it('is read-only for viewers', () => {
    const form = makeForm([welcome, name]);
    const { unmount } = renderWithOps(<SettingsSidebar form={form} field={name} canEdit={false} />, { form, readOnly: true });
    expect(screen.getByRole('combobox', { name: 'Question type' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Required' })).toBeDisabled();
    expect(screen.getByLabelText('Question key')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit logic' })).toBeDisabled();
    unmount();
    renderWithOps(<SettingsSidebar form={form} field={null} canEdit={false} />, { form, readOnly: true });
    for (const s of screen.getAllByRole('switch')) expect(s).toBeDisabled();
    expect(screen.getByRole('radio', { name: /One question at a time/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Theme/ })).not.toBeInTheDocument();
  });
});
