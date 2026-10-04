import type { FormDto, FormFieldDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { fieldSetTx, PATTERN_PRESETS } from '@qub/shared/forms';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithOps } from '@/features/forms/builder/ops/test-utils';
import { ExtraSettings } from './extra-settings';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }) }));
beforeEach(() => vi.clearAllMocks());

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const field = (over: Partial<FormFieldDto>): FormFieldDto => ({
  id: uid(2), ref: 'q', type: 'SHORT_ANSWER', label: 'Q', description: null, required: false, position: 0,
  validation: {}, settings: {}, options: [], rules: [], scoreConfig: null, placeholder: null, defaultValue: null, ...over,
});
const makeForm = (f: FormFieldDto): FormDto =>
  ({ id: uid(900), title: 'S', description: null, revision: 0, acceptingResponses: true, settings: { ...DEFAULT_FORM_SETTINGS, layout: 'conversational' }, variables: [], fields: [f], isTrashed: false, theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null }, capabilities: { canEdit: true, canTrash: true } }) as unknown as FormDto;
const lastTx = (apply: ReturnType<typeof vi.fn>) => apply.mock.calls.at(-1)![0];

describe('ExtraSettings', () => {
  it('picking a format fills in the pattern and its message in one change', async () => {
    const f = field({});
    const form = makeForm(f);
    const { apply } = renderWithOps(<ExtraSettings form={form} field={f} canEdit />, { form });
    const zip = PATTERN_PRESETS.find((p) => p.id === 'us_zip')!;
    await userEvent.setup().selectOptions(screen.getByLabelText('Format'), 'us_zip');
    expect(lastTx(apply).ops).toEqual(fieldSetTx(form, f.id, { validation: { pattern: zip.pattern, patternMessage: zip.message } }, 'Change format')!.ops);
  });

  it('None clears the pattern and message', async () => {
    const f = field({ validation: { pattern: '^a$', patternMessage: 'A', maxLength: 5 } });
    const form = makeForm(f);
    const { apply } = renderWithOps(<ExtraSettings form={form} field={f} canEdit />, { form });
    await userEvent.setup().selectOptions(screen.getByLabelText('Format'), 'none');
    expect(lastTx(apply).ops).toEqual(fieldSetTx(form, f.id, { validation: { maxLength: 5 } }, 'Change format')!.ops);
  });

  it('shows a hand-typed pattern that equals a preset as that preset, and any other as Custom', () => {
    const zip = PATTERN_PRESETS.find((p) => p.id === 'us_zip')!;
    const a = field({ validation: { pattern: zip.pattern } });
    const { unmount } = renderWithOps(<ExtraSettings form={makeForm(a)} field={a} canEdit />, { form: makeForm(a) });
    expect(screen.getByLabelText('Format')).toHaveValue('us_zip');
    unmount();
    const b = field({ validation: { pattern: '^x+$' } });
    renderWithOps(<ExtraSettings form={makeForm(b)} field={b} canEdit />, { form: makeForm(b) });
    expect(screen.getByLabelText('Format')).toHaveValue('custom');
  });

  it('edits error messages that apply, keeping other validation', async () => {
    const f = field({ required: true, validation: { minLength: 2 } });
    const form = makeForm(f);
    const { apply } = renderWithOps(<ExtraSettings form={form} field={f} canEdit />, { form });
    expect(screen.queryByLabelText('Range message')).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Required message'), 'Please answer');
    await user.tab();
    expect(lastTx(apply).ops).toEqual(fieldSetTx(form, f.id, { validation: { minLength: 2, requiredMessage: 'Please answer' } }, 'Change error message')!.ops);
    expect(screen.getByLabelText('Length message')).toHaveAttribute('placeholder', 'Must be at least 2 characters');
  });

  it('hides the required message on optional questions', () => {
    const f = field({ required: false });
    renderWithOps(<ExtraSettings form={makeForm(f)} field={f} canEdit />, { form: makeForm(f) });
    expect(screen.queryByLabelText('Required message')).not.toBeInTheDocument();
  });

  it('number prefix and Yes/No labels', async () => {
    const n = field({ type: 'NUMBER' });
    const form = makeForm(n);
    const { apply, unmount } = renderWithOps(<ExtraSettings form={form} field={n} canEdit />, { form });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Prefix'), '$');
    await user.tab();
    expect(lastTx(apply).ops).toEqual(fieldSetTx(form, n.id, { settings: { prefix: '$' } }, 'Change display')!.ops);
    unmount();
    const yn = field({ type: 'YES_NO' });
    const form2 = makeForm(yn);
    const r2 = renderWithOps(<ExtraSettings form={form2} field={yn} canEdit />, { form: form2 });
    await user.type(screen.getByLabelText('Yes label'), 'Count me in');
    await user.tab();
    expect(lastTx(r2.apply).ops).toEqual(fieldSetTx(form2, yn.id, { settings: { yesLabel: 'Count me in' } }, 'Change display')!.ops);
  });

  it('character count needs a maximum length first', async () => {
    const off = field({});
    const { unmount } = renderWithOps(<ExtraSettings form={makeForm(off)} field={off} canEdit />, { form: makeForm(off) });
    expect(screen.getByRole('switch', { name: 'Show character count' })).toBeDisabled();
    expect(screen.getByText('Set a maximum length first')).toBeInTheDocument();
    unmount();
    const on = field({ validation: { maxLength: 100 } });
    const form = makeForm(on);
    const { apply } = renderWithOps(<ExtraSettings form={form} field={on} canEdit />, { form });
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Show character count' }));
    expect(lastTx(apply).ops).toEqual(fieldSetTx(form, on.id, { settings: { showCharCount: true } }, 'Change display')!.ops);
  });

  it('ending: badge, link, redirect, delay and Submit-another', async () => {
    const e = field({ type: 'ENDING', label: 'Bye' });
    const form = makeForm(e);
    const { apply } = renderWithOps(<ExtraSettings form={form} field={e} canEdit />, { form });
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Rocket' }));
    expect(lastTx(apply).ops).toEqual(fieldSetTx(form, e.id, { settings: { badgeIcon: 'rocket' } }, 'Change ending')!.ops);
    await user.type(screen.getByLabelText('Button link'), 'https://x.test');
    await user.tab();
    expect(lastTx(apply).ops).toEqual(fieldSetTx(form, e.id, { settings: { buttonUrl: 'https://x.test' } }, 'Change ending')!.ops);
    await user.type(screen.getByLabelText('Redirect after (seconds)'), '75');
    await user.tab();
    expect(lastTx(apply).ops).toEqual(fieldSetTx(form, e.id, { settings: { redirectDelay: 60 } }, 'Change ending')!.ops);
    await user.click(screen.getByRole('switch', { name: 'Show "Submit another response"' }));
    expect(lastTx(apply).ops).toEqual(fieldSetTx(form, e.id, { settings: { showSubmitAnother: false } }, 'Change ending')!.ops);
  });

  it('is read-only for viewers', () => {
    const e = field({ type: 'ENDING' });
    renderWithOps(<ExtraSettings form={makeForm(e)} field={e} canEdit={false} />, { form: makeForm(e), readOnly: true });
    expect(screen.getByRole('radio', { name: 'Heart' })).toBeDisabled();
    expect(screen.getByLabelText('Button link')).toBeDisabled();
  });
});
