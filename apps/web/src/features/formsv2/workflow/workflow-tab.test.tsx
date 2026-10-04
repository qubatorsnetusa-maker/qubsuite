import type { FormDto, FormFieldDto, FormLogicRuleDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithOps } from '@/features/forms/builder/ops/test-utils';
import { WorkflowTab } from './workflow-tab';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }) }));

beforeEach(() => vi.clearAllMocks());

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const rule = (over: Partial<FormLogicRuleDto>): FormLogicRuleDto => ({
  id: over.id ?? uid(500),
  fieldId: over.fieldId!,
  trigger: 'ON_LEAVE',
  scope: 'FIELD',
  condition: { all: [] },
  action: 'JUMP_TO_FIELD',
  targetFieldId: null,
  targetSectionId: null,
  targetVariableId: null,
  payload: null,
  position: 0,
  operator: null,
  value: null,
  ...over,
});

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

describe('WorkflowTab', () => {
  it('renders each question\'s rule summaries and the otherwise fallback (end on the last question)', () => {
    const rating = field({ id: uid(1), ref: 'rating', type: 'RATING', label: 'Rating', position: 0 });
    const whySoLow = field({ id: uid(2), ref: 'why', type: 'SHORT_ANSWER', label: 'Why so low?', position: 1 });
    rating.rules = [rule({ id: uid(10), fieldId: rating.id, condition: { subject: { type: 'field', id: rating.id }, op: 'lt', value: 3 }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id })];
    const form = makeForm([rating, whySoLow]);

    renderWithOps(<WorkflowTab />, { form });

    expect(screen.getByRole('button', { name: 'If Rating is less than 3 → Why so low?' })).toBeInTheDocument();
    // rating has a next field (why so low), so its fallback says "next question"...
    expect(screen.getByText('Otherwise → next question')).toBeInTheDocument();
    // ...but "why so low" is the last field, so its fallback ends the form.
    expect(screen.getByText('Otherwise → end')).toBeInTheDocument();
  });

  it('clicking a question\'s rule summary opens the existing LogicPanel in a sheet', async () => {
    const rating = field({ id: uid(1), ref: 'rating', type: 'RATING', label: 'Rating', position: 0 });
    const whySoLow = field({ id: uid(2), ref: 'why', type: 'SHORT_ANSWER', label: 'Why so low?', position: 1 });
    rating.rules = [rule({ id: uid(10), fieldId: rating.id, condition: { all: [] }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id })];
    const form = makeForm([rating, whySoLow]);

    renderWithOps(<WorkflowTab />, { form });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Always → Why so low?' }));
    const sheet = screen.getByRole('dialog', { name: 'Logic for “Rating”' });
    expect(within(sheet).getByText('After this question')).toBeInTheDocument();
  });

  it('clicking "Add rule" for a question with no rules opens the LogicPanel too', async () => {
    const rating = field({ id: uid(1), ref: 'rating', type: 'RATING', label: 'Rating', position: 0 });
    const form = makeForm([rating]);

    renderWithOps(<WorkflowTab />, { form });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add rule' }));
    expect(screen.getByRole('dialog', { name: 'Logic for “Rating”' })).toBeInTheDocument();
  });

  it('shows validateDefinition problems inline next to the affected question', () => {
    const unnamed = field({ id: uid(1), ref: 'q1', type: 'SHORT_ANSWER', label: '', position: 0 });
    const form = makeForm([unnamed]);

    renderWithOps(<WorkflowTab />, { form });
    expect(screen.getByRole('alert')).toHaveTextContent('Every question needs a title');
  });

  it('disables rule and "Add rule" buttons for viewers', async () => {
    const rating = field({ id: uid(1), ref: 'rating', type: 'RATING', label: 'Rating', position: 0 });
    const whySoLow = field({ id: uid(2), ref: 'why', type: 'SHORT_ANSWER', label: 'Why so low?', position: 1 });
    rating.rules = [rule({ id: uid(10), fieldId: rating.id, condition: { all: [] }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id })];
    const form = makeForm([rating, whySoLow], { canEdit: false, canTrash: false });

    const { unmount } = renderWithOps(<WorkflowTab />, { form, readOnly: true });
    expect(screen.getByRole('button', { name: 'Always → Why so low?' })).toBeDisabled();
    unmount();

    const noRules = field({ id: uid(3), ref: 'q3', type: 'RATING', label: 'Another', position: 2 });
    const form2 = makeForm([noRules], { canEdit: false, canTrash: false });
    renderWithOps(<WorkflowTab />, { form: form2, readOnly: true });
    expect(screen.getByRole('button', { name: 'Add rule' })).toBeDisabled();
  });

  it('shows variables read-only to viewers: no add or delete controls, formulas disabled', () => {
    const q = field({ id: uid(1), ref: 'q1', type: 'NUMBER', label: 'Q1', position: 0 });
    const form = {
      ...makeForm([q], { canEdit: false, canTrash: false }),
      variables: [{ id: uid(70), key: 'total', type: 'NUMBER', initialValue: 0, formula: '{{q1}} * 2', position: 0 }],
    } as unknown as FormDto;
    renderWithOps(<WorkflowTab />, { form, readOnly: true });
    expect(screen.getByText('{{total}}')).toBeInTheDocument();
    expect(screen.getByLabelText('Formula for total')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Delete total' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New variable name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add variable' })).not.toBeInTheDocument();
  });

  // jsdom doesn't lay anything out, so this can't see the clipping itself: it pins the classes that fix it. An
  // absolutely positioned <svg> is a replaced element — `inset-y-0` alone leaves it at the default 150px tall, so
  // without `h-full` every jump arrow below ~150px of list was cut off.
  it('sizes the jump-arrow layer to the whole list, not the default 150px svg height', () => {
    const q = field({ id: uid(1), ref: 'q1', type: 'SHORT_ANSWER', label: 'Q1', position: 0 });
    const form = makeForm([q]);
    renderWithOps(<WorkflowTab />, { form });
    const svg = screen.getByTestId('workflow-arrows');
    expect(svg).toHaveClass('absolute', 'inset-y-0', 'h-full', 'overflow-visible');
  });

  it('renders the variables panel', () => {
    const q = field({ id: uid(1), ref: 'q1', type: 'SHORT_ANSWER', label: 'Q1', position: 0 });
    const form = makeForm([q]);
    renderWithOps(<WorkflowTab />, { form });
    expect(screen.getByRole('heading', { name: 'Variables' })).toBeInTheDocument();
    expect(screen.getByText('No variables yet.')).toBeInTheDocument();
  });
});
