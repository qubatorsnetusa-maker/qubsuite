import type { FormFieldDto, FormThemeExtras, SubmitResponseResult } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SubmitFn } from '../session/use-form-session';
import type { RespondentForm } from './respondent-form';
import { RespondentView } from './respondent-view';

const f = (id: string, type: FormFieldDto['type'], label: string, position: number, extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
  id, ref: id, type, label, description: null, required: false, position, validation: {}, settings: {}, options: [], rules: [], placeholder: null, defaultValue: null, scoreConfig: null, ...extra,
});
const opt = (id: string, label: string, position: number) => ({ id, label, position, kind: 'option' as const, value: null, imageUrl: null });
const jump = (fieldId: string, value: string, target: string) => ({ id: `r-${fieldId}`, fieldId, operator: null, value: null, trigger: 'ON_LEAVE' as const, scope: 'FIELD' as const, condition: { subject: { type: 'field' as const, id: fieldId }, op: 'eq' as const, value }, action: 'JUMP_TO_FIELD' as const, targetSectionId: null, targetFieldId: target, targetVariableId: null, payload: null, position: 0 });

const fields = [
  f('w', 'WELCOME', 'Hello there', 0, { settings: { buttonLabel: 'Start' } }),
  f('name', 'SHORT_ANSWER', 'What is your name?', 1, { required: true }),
  f('plan', 'MULTIPLE_CHOICE', 'Pick a plan, {{name}}', 2, { options: [opt('free', 'Free', 0), opt('pro', 'Pro', 1)], rules: [jump('plan', 'free', 'bye')] }),
  f('seats', 'NUMBER', 'How many seats?', 3),
  f('notes', 'PARAGRAPH', 'Anything else?', 4),
  f('bye', 'STATEMENT', 'Almost done', 5, { settings: { buttonLabel: 'Finish' } }),
  f('end', 'ENDING', 'Thanks {{name}}!', 6, { description: 'See you soon.' }),
];
const form: RespondentForm = { title: 'Signup', description: null, fields, variables: [], theme: { primaryColor: '#673ab7', backgroundColor: '#fff', fontFamily: 'sans', headerImageUrl: null }, settings: { ...DEFAULT_FORM_SETTINGS, layout: 'conversational' } };
const result = (over: Partial<SubmitResponseResult> = {}): SubmitResponseResult => ({ id: 'r', confirmationMessage: 'See you soon.', message: 'See you soon.', endingId: 'end', title: 'Thanks Ada!', redirectUrl: null, score: null, ...over });
const themedForm = (extras: FormThemeExtras): RespondentForm => ({ ...form, theme: { ...form.theme, extras } });

function setup(submit = vi.fn<SubmitFn>(async () => result())) {
  render(<RespondentView form={form} submit={submit} storageKey={null} mode="fill" />);
  return { submit, user: userEvent.setup() };
}

describe('ConversationalRenderer', () => {
  it('starts on the welcome screen and focuses the first question', async () => {
    const { user } = setup();
    expect(screen.getByRole('heading', { name: 'Hello there' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('textbox', { name: /What is your name/ })).toHaveFocus();
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument();
  });

  it('Enter advances; required errors block and are announced', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('This question is required');
    expect(screen.getByText(/Question 1 of 5\. This question is required/)).toBeInTheDocument();
    await user.keyboard('Ada{Enter}');
    expect(await screen.findByText('Pick a plan, Ada')).toBeInTheDocument();
  });

  it('letter keys choose options and auto-advance along the branch', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('Ada{Enter}');
    await screen.findByText('Pick a plan, Ada');
    (document.activeElement as HTMLElement).blur();
    await user.keyboard('a');
    // "Free" jumps straight to the closing statement.
    expect(await screen.findByText('Almost done')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Pick a plan, Ada')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Free/ })).toBeChecked();
  });

  it('going Back within the auto-advance window cancels the pending advance', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('Ada{Enter}');
    await screen.findByText('Pick a plan, Ada');
    // Picking "Free" schedules a 350ms auto-advance (it also jumps to "bye" via the rule).
    await user.click(screen.getByRole('radio', { name: /Free/ }));
    // Back before the timer fires: this should land on "name" and stay there.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('textbox', { name: /What is your name/ })).toBeInTheDocument();
    // Let the stale timer's window pass; without the fix it would fire and jump forward again.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.getByRole('textbox', { name: /What is your name/ })).toBeInTheDocument();
    expect(screen.queryByText('Pick a plan, Ada')).not.toBeInTheDocument();
    expect(screen.queryByText('Almost done')).not.toBeInTheDocument();
  });

  it('Shift+Enter adds a new line in long answers', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('Ada{Enter}');
    await screen.findByText('Pick a plan, Ada');
    await user.click(screen.getByRole('radio', { name: /Pro/ }));
    await screen.findByText('How many seats?');
    await user.keyboard('3{Enter}');
    const notes = await screen.findByRole('textbox', { name: 'Anything else?' });
    await user.keyboard('line1{Shift>}{Enter}{/Shift}line2');
    expect(notes).toHaveValue('line1\nline2');
    expect(screen.getByText('Anything else?')).toBeInTheDocument();
  });

  it('shows progress and submits only the answers on the path', async () => {
    const { user, submit } = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('Ada{Enter}');
    await screen.findByText('Pick a plan, Ada');
    await user.click(screen.getByRole('radio', { name: /Free/ }));
    await screen.findByText('Almost done');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0]![0].answers).toEqual({ name: 'Ada', plan: 'free' });
    expect(await screen.findByRole('heading', { name: 'Thanks Ada!' })).toBeInTheDocument();
  });

  it('renders hostile piped text literally', async () => {
    const { user } = setup(vi.fn(async () => result({ title: 'Thanks <img src=x onerror=alert(1)>!' })));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('<img src=x onerror=alert(1)>{Enter}');
    await screen.findByText('Pick a plan, <img src=x onerror=alert(1)>');
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('marks steps for the CSS transition (disabled under reduced motion in index.css)', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(document.querySelector('.qub-step[data-direction="forward"]')).not.toBeNull();
  });
});

describe('theme', () => {
  // Review Focus 5
  it('renders no chrome and no radius variable for a pre-B1 form', () => {
    const { container } = render(<RespondentView form={themedForm({})} submit={vi.fn()} storageKey={null} mode="fill" />);
    expect(container.querySelector('[data-testid="form-bg-dim"]')).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
    expect(container.querySelector('img[alt=""]')).toBeNull();
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--form-radius')).toBe('');
  });

  it('paints a gradient, the logo and the footer around the step', async () => {
    const { container } = render(<RespondentView form={themedForm({ background: { kind: 'gradient', from: '#0f172a', to: '#1e1b4b', angle: 160 }, logoUrl: 'https://cdn.test/logo.png', footerText: 'Acme Inc.', buttonRadius: 'sharp' })} submit={vi.fn()} storageKey={null} mode="fill" />);
    expect(container.querySelector('[style*="linear-gradient"]')).toBeInTheDocument();
    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute('src', 'https://cdn.test/logo.png');
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--form-radius')).toBe('0px');
  });

  // Review Focus 3
  it('carries the brand header and footer onto the welcome screen', () => {
    render(<RespondentView form={themedForm({ logoUrl: 'https://cdn.test/logo.png', footerText: 'Acme Inc.' })} submit={vi.fn()} storageKey={null} mode="fill" />);
    expect(screen.getByRole('heading', { name: 'Hello there' })).toBeInTheDocument();
    expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument();
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
  });

  // Review Focus 3
  it('carries the brand header and footer onto the ending screen', async () => {
    const user = userEvent.setup();
    render(<RespondentView form={themedForm({ logoUrl: 'https://cdn.test/logo.png', footerText: 'Acme Inc.' })} submit={vi.fn<SubmitFn>(async () => result())} storageKey={null} mode="fill" />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.keyboard('Ada{Enter}');
    await screen.findByText('Pick a plan, Ada');
    await user.click(screen.getByRole('radio', { name: /Free/ }));
    await screen.findByText('Almost done');
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument();
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
  });
});
