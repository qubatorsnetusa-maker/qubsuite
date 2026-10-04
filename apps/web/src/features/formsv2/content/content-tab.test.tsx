import type { FormDto, FormFieldDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithOps } from '@/features/forms/builder/ops/test-utils';
import { ContentTab } from './content-tab';

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

const welcome = field({ id: uid(1), ref: 'welcome', type: 'WELCOME', label: 'Welcome' });
const q1 = field({ id: uid(2), ref: 'name', type: 'SHORT_ANSWER', label: 'What is your name?' });
const q2 = field({ id: uid(3), ref: 'rating', type: 'RATING', label: 'Rate us' });

function makeForm(fields: FormFieldDto[], capabilities: Partial<FormDto['capabilities']> = { canEdit: true, canTrash: true }): FormDto {
  return {
    id: uid(900),
    revision: 0,
    settings: { ...DEFAULT_FORM_SETTINGS },
    variables: [],
    fields,
    isTrashed: false,
    theme: { primaryColor: '#673ab7' },
    capabilities,
  } as unknown as FormDto;
}

describe('ContentTab', () => {
  it('lays out the question list, the selected question at full size, and its type in the settings panel', () => {
    const form = makeForm([welcome, q1, q2]);
    renderWithOps(<ContentTab />, { form });
    // Left: the question list is present with both questions.
    expect(screen.getByRole('navigation', { name: 'Questions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1. What is your name?' })).toBeInTheDocument();
    // Centre: defaults to the first field (the welcome screen).
    expect(screen.getByLabelText('Screen title')).toHaveValue('Welcome');
    // Right: a heading with the selected item's type label, nothing else (Task 4 fills this in).
    expect(screen.getByRole('heading', { level: 2, name: 'Welcome screen' })).toBeInTheDocument();
  });

  it('shows the newly selected question in the centre and its type label on the right', async () => {
    const form = makeForm([welcome, q1, q2]);
    renderWithOps(<ContentTab />, { form });
    await userEvent.setup().click(screen.getByRole('button', { name: '2. Rate us' }));
    expect(screen.getByLabelText('Question text')).toHaveValue('Rate us');
    expect(screen.getByRole('heading', { level: 2, name: 'Rating' })).toBeInTheDocument();
  });

  it('shows "Form settings" on the right when nothing is selected', () => {
    // An empty form: no field is selected, and the centre prompts to add the first question.
    const form = makeForm([]);
    renderWithOps(<ContentTab />, { form });
    expect(screen.getByRole('heading', { name: 'Start with a question' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Form settings' })).toBeInTheDocument();
  });

  it('"Form settings" in the settings panel clears the selection: form settings on the right, form title in the centre', async () => {
    const form = makeForm([welcome, q1, q2]);
    renderWithOps(<ContentTab />, { form });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Form settings' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Form settings' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Layout' })).toBeInTheDocument();
    expect(screen.getByLabelText('Form title')).toBeInTheDocument();
  });

  it('hides editing controls for viewers but still shows every panel', () => {
    const form = makeForm([welcome, q1], { canEdit: false, canTrash: false });
    renderWithOps(<ContentTab />, { form, readOnly: true });
    expect(screen.queryByRole('button', { name: 'Add question' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Screen title')).toHaveValue('Welcome');
  });
});
