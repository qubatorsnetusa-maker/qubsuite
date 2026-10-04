import type { FormFieldDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormRenderer } from './form-renderer';

const field = (id: string, type: FormFieldDto['type'], label: string, extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
  id,
  ref: id,
  type,
  label,
  description: null,
  required: false,
  position: 0,
  validation: {},
  settings: {},
  options: [],
  rules: [],
  placeholder: null,
  defaultValue: null,
  scoreConfig: null,
  ...extra,
});
const option = (id: string, label: string, position: number) => ({ id, label, position, kind: 'option' as const, value: null, imageUrl: null });

const fields: FormFieldDto[] = [
  field('car', 'MULTIPLE_CHOICE', 'Do you own a car?', {
    required: true,
    options: [option('yes', 'Yes', 0), option('no', 'No', 1)],
    rules: [{ id: 'r1', fieldId: 'car', operator: 'EQUALS', value: 'no', trigger: 'ON_LEAVE', scope: 'SECTION', condition: { subject: { type: 'field', id: 'car' }, op: 'eq', value: 'no' }, action: 'GO_TO_SECTION', targetSectionId: 'final', targetFieldId: null, targetVariableId: null, payload: null, position: 0 }],
  }),
  field('details', 'SECTION', 'Car details'),
  field('model', 'SHORT_ANSWER', 'Car model', { required: true }),
  field('final', 'SECTION', 'Final thoughts'),
  field('notes', 'PARAGRAPH', 'Anything else?'),
].map((x, i) => ({ ...x, position: i }));

const settings = { ...DEFAULT_FORM_SETTINGS, confirmationMessage: 'Thanks!' };
const theme = { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans' as const, headerImageUrl: null };

function setup(onSubmit = vi.fn(async () => ({ confirmationMessage: 'Thanks!' }))) {
  render(<FormRenderer mode="fill" title="Car survey" description={null} fields={fields} theme={theme} settings={settings} onSubmit={onSubmit} />);
  return { onSubmit, user: userEvent.setup() };
}

describe('FormRenderer', () => {
  it('blocks navigation until required questions are answered', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('This question is required');
    expect(screen.queryByText('Car model')).not.toBeInTheDocument();
  });

  it('follows the branching rule: "No" skips the car details section', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Final thoughts')).toBeInTheDocument();
    expect(screen.queryByText('Car model')).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Anything else?' }), 'Bikes only');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledWith({ car: 'no', notes: 'Bikes only' }, undefined);
    expect(await screen.findByText('Thanks!')).toBeInTheDocument();
  });

  it('"Yes" enters the car details section, and Back returns without losing answers', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Car details')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('required');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
  });

  it('only submits answers from sections on the path actually taken', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(screen.getByRole('textbox', { name: /Car model/ }), 'Civic');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledWith({ car: 'no' }, undefined);
  });
});

describe('FormRenderer — engine features', () => {
  const base = (id: string, type: FormFieldDto['type'], label: string, position: number, extra: Partial<FormFieldDto> = {}) => ({ ...field(id, type, label, extra), position });

  it('shows and hides questions within a page as answers change', async () => {
    const withVisibility = [
      base('pet', 'YES_NO', 'Do you have a pet?', 0),
      base('name', 'SHORT_ANSWER', 'Pet name', 1, {
        rules: [{ id: 'v', fieldId: 'name', operator: null, value: null, trigger: 'VISIBILITY', scope: 'FIELD', condition: { subject: { type: 'field', id: 'pet' }, op: 'eq', value: true }, action: 'SHOW', targetSectionId: null, targetFieldId: null, targetVariableId: null, payload: null, position: 0 }],
      }),
    ];
    const user = userEvent.setup();
    render(<FormRenderer mode="fill" title="Pets" description={null} fields={withVisibility} theme={theme} settings={settings} onSubmit={vi.fn(async () => ({ confirmationMessage: 'ok' }))} />);
    expect(screen.queryByText('Pet name')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(screen.getByText('Pet name')).toBeInTheDocument();
  });

  it('pipes earlier answers into later labels as plain text', async () => {
    const piped = [base('n', 'SHORT_ANSWER', 'Name', 0, { ref: 'name' }), base('q', 'SHORT_ANSWER', 'Hi {{name}}, how are you?', 1)];
    const user = userEvent.setup();
    const { container } = render(<FormRenderer mode="fill" title="Pipe" description={null} fields={piped} theme={theme} settings={settings} onSubmit={vi.fn(async () => ({ confirmationMessage: 'ok' }))} />);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '<b>Ada</b>');
    expect(screen.getByText('Hi <b>Ada</b>, how are you?')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });

  it('shows the welcome screen first when the form has one', async () => {
    const withWelcome = [base('w', 'WELCOME', 'Welcome aboard', 0, { settings: { buttonLabel: 'Begin' } }), base('q', 'SHORT_ANSWER', 'First question', 1)];
    const user = userEvent.setup();
    render(<FormRenderer mode="fill" title="W" description={null} fields={withWelcome} theme={theme} settings={settings} onSubmit={vi.fn(async () => ({ confirmationMessage: 'ok' }))} />);
    expect(screen.getByRole('heading', { name: 'Welcome aboard' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Begin' }));
    expect(screen.getByText('First question')).toBeInTheDocument();
  });
});
