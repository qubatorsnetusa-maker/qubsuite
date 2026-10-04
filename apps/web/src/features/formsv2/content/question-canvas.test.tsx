import type { FormDto, FormFieldDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { fieldSetTx } from '@qub/shared/forms';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/misc';
import { BuilderOpsContext, type BuilderOps } from '@/features/forms/builder/ops/builder-ops';
import { renderWithOps } from '@/features/forms/builder/ops/test-utils';
import { QuestionCanvas } from './question-canvas';

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

const opt = (id: string, label: string, position: number) => ({ id, label, kind: 'option' as const, position, value: null, imageUrl: null });

const welcome = field({ id: uid(1), ref: 'welcome', type: 'WELCOME', label: 'Hello there', position: 0, settings: { buttonLabel: 'Start' } });
const name = field({ id: uid(2), ref: 'name', type: 'SHORT_ANSWER', label: 'What is your name?', position: 1 });
const colour = field({ id: uid(3), ref: 'colour', type: 'MULTIPLE_CHOICE', label: 'Favourite colour?', position: 2, options: [opt(uid(31), 'Red', 0), opt(uid(32), 'Green', 1), opt(uid(33), 'Blue', 2)] });

function makeForm(fields: FormFieldDto[]): FormDto {
  return {
    id: uid(900),
    title: 'Survey',
    description: null,
    revision: 0,
    settings: { ...DEFAULT_FORM_SETTINGS, layout: 'conversational' },
    variables: [],
    fields,
    isTrashed: false,
    theme: { primaryColor: '#0b8043', backgroundColor: '#e6f4ea', fontFamily: 'sans', headerImageUrl: null },
    capabilities: { canEdit: true, canTrash: true },
  } as unknown as FormDto;
}

const txs = (apply: ReturnType<typeof vi.fn>) => apply.mock.calls.map((c) => c[0]).filter(Boolean);

describe('QuestionCanvas', () => {
  it('shows the question the way respondents see it: number, arrow, title, description and the answer control', () => {
    const form = makeForm([welcome, name, colour]);
    renderWithOps(<QuestionCanvas form={form} field={name} canEdit onSelect={() => {}} />, { form });
    expect(screen.getByTestId('question-number')).toHaveTextContent('1');
    expect(screen.getByLabelText('Question text')).toHaveValue('What is your name?');
    expect(screen.getByLabelText('Description')).toHaveAttribute('placeholder', 'Description (optional)');
    // The real respondent control, disabled.
    const answer = screen.getByRole('region', { name: 'Answer preview' });
    expect(answer.querySelector('input')).toBeDisabled();
  });

  it('commits a typing burst in the title as ONE builder-produced label change with a merge key, and seals on blur', async () => {
    const form = makeForm([welcome, name]);
    const seal = vi.fn();
    const { apply } = renderWithOps(<QuestionCanvas form={form} field={name} canEdit onSelect={() => {}} />, { form, seal });
    const user = userEvent.setup();
    const title = screen.getByLabelText('Question text');
    await user.clear(title);
    await user.type(title, 'Your name?');
    expect(apply).not.toHaveBeenCalled();
    await user.tab();
    expect(apply).toHaveBeenCalledTimes(1);
    const [tx, opts] = apply.mock.calls[0]!;
    expect(opts).toEqual({ mergeKey: `label:${name.id}` });
    expect(tx.ops).toEqual(fieldSetTx(form, name.id, { label: 'Your name?' }, 'Edit question text')!.ops);
    expect(tx.label).toBe('Edit question text');
    expect(seal).toHaveBeenCalled();
  });

  it('keeps the draft being typed when a refetch brings a different title (Review Focus 4)', async () => {
    const form = makeForm([welcome, name]);
    const value = (f: FormDto): BuilderOps => ({
      form: f,
      apply: vi.fn(),
      seal: vi.fn(),
      undo: vi.fn(),
      undoIf: vi.fn(() => true),
      redo: vi.fn(),
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
      status: 'saved',
      retry: vi.fn(),
      flush: () => Promise.resolve(),
      readOnly: false,
      isOwnTx: () => false,
    });
    const client = new QueryClient();
    const tree = (f: FormDto) => (
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <BuilderOpsContext.Provider value={value(f)}>
            <QuestionCanvas form={f} field={f.fields[1]!} canEdit onSelect={() => {}} />
          </BuilderOpsContext.Provider>
        </TooltipProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(tree(form));
    const user = userEvent.setup();
    const title = screen.getByLabelText('Question text');
    await user.type(title, ' please');
    // A collaborator's edit arrives mid-burst.
    rerender(tree(makeForm([welcome, { ...name, label: 'Changed elsewhere' }])));
    expect(screen.getByLabelText('Question text')).toHaveValue('What is your name? please');
  });

  it('edits the description the same way', async () => {
    const form = makeForm([welcome, name]);
    const { apply } = renderWithOps(<QuestionCanvas form={form} field={name} canEdit onSelect={() => {}} />, { form });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Description'), 'First and last');
    await user.tab();
    const [tx, opts] = apply.mock.calls.at(-1)!;
    expect(opts).toEqual({ mergeKey: `description:${name.id}` });
    expect(tx.ops).toEqual(fieldSetTx(form, name.id, { description: 'First and last' }, 'Edit description')!.ops);
  });

  it('renames, adds and removes choices inline as builder-produced options changes', async () => {
    const form = makeForm([welcome, colour]);
    const { apply } = renderWithOps(<QuestionCanvas form={form} field={colour} canEdit onSelect={() => {}} />, { form });
    const user = userEvent.setup();
    // Letter badges like the respondent view.
    expect(screen.getByTestId(`choice-letter-0`)).toHaveTextContent('A');
    expect(screen.getByTestId(`choice-letter-2`)).toHaveTextContent('C');

    // Rename: commits on blur.
    const green = screen.getByRole('textbox', { name: 'Choice 2' });
    await user.clear(green);
    await user.type(green, 'Lime');
    await user.tab();
    const renameTx = txs(apply).at(-1);
    expect(renameTx.ops).toEqual(
      fieldSetTx(form, colour.id, { options: [
        { id: uid(31), label: 'Red', kind: 'option', imageUrl: null, value: null },
        { id: uid(32), label: 'Lime', kind: 'option', imageUrl: null, value: null },
        { id: uid(33), label: 'Blue', kind: 'option', imageUrl: null, value: null },
      ] }, 'Edit choices')!.ops,
    );

    // Remove the third choice.
    await user.click(screen.getByRole('button', { name: 'Remove choice 3' }));
    const removeTx = txs(apply).at(-1);
    expect(removeTx.label).toBe('Edit choices');
    const removeChange = removeTx.ops[0].changes.options;
    expect(removeChange.to.map((o: { label: string }) => o.label)).toEqual(['Red', 'Lime']);
  });

  it('Enter in a choice adds a new choice right after it and focuses it', async () => {
    const form = makeForm([welcome, colour]);
    const { apply } = renderWithOps(<QuestionCanvas form={form} field={colour} canEdit onSelect={() => {}} />, { form });
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: 'Choice 1' }));
    await user.keyboard('{Enter}');
    const added = screen.getByRole('textbox', { name: 'Choice 2' });
    expect(added).toHaveFocus();
    expect(added).toHaveValue('Choice 4');
    const tx = txs(apply).at(-1);
    const labels = tx.ops[0].changes.options.to.map((o: { label: string }) => o.label);
    expect(labels).toEqual(['Red', 'Choice 4', 'Green', 'Blue']);
    // The new choice has a real id from the start, so renaming it later keeps that id.
    expect(tx.ops[0].changes.options.to[1].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('"Add choice" appends a choice', async () => {
    const form = makeForm([welcome, colour]);
    const { apply } = renderWithOps(<QuestionCanvas form={form} field={colour} canEdit onSelect={() => {}} />, { form });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add choice' }));
    const labels = txs(apply).at(-1).ops[0].changes.options.to.map((o: { label: string }) => o.label);
    expect(labels).toEqual(['Red', 'Green', 'Blue', 'Choice 4']);
  });

  it('edits the welcome screen title and button label in place', async () => {
    const form = makeForm([welcome, name]);
    const { apply } = renderWithOps(<QuestionCanvas form={form} field={welcome} canEdit onSelect={() => {}} />, { form });
    const user = userEvent.setup();
    expect(screen.getByLabelText('Screen title')).toHaveValue('Hello there');
    const button = screen.getByRole('textbox', { name: 'Button text' });
    await user.clear(button);
    await user.type(button, 'Begin');
    await user.tab();
    const [tx, opts] = apply.mock.calls.at(-1)!;
    expect(opts).toEqual({ mergeKey: `buttonLabel:${welcome.id}` });
    expect(tx.ops).toEqual(fieldSetTx(form, welcome.id, { settings: { buttonLabel: 'Begin' } }, 'Edit button text')!.ops);
  });

  it('prompts to add the first question on an empty form', () => {
    const form = makeForm([]);
    renderWithOps(<QuestionCanvas form={form} field={null} canEdit onSelect={() => {}} />, { form });
    expect(screen.getByRole('button', { name: 'Add question' })).toBeInTheDocument();
  });

  it('edits the form title and description when nothing is selected', async () => {
    const form = makeForm([welcome, name]);
    const { apply } = renderWithOps(<QuestionCanvas form={form} field={null} canEdit onSelect={() => {}} />, { form });
    const user = userEvent.setup();
    const title = screen.getByLabelText('Form title');
    await user.type(title, ' 2026');
    await user.tab();
    const [tx, opts] = apply.mock.calls.at(-1)!;
    expect(opts).toEqual({ mergeKey: 'form-title' });
    expect(tx.ops[0].changes.title).toEqual({ from: 'Survey', to: 'Survey 2026' });
  });

  it('puts the stored title back when the form title is cleared and left, without saving anything', async () => {
    const form = makeForm([welcome, name]);
    const { apply } = renderWithOps(<QuestionCanvas form={form} field={null} canEdit onSelect={() => {}} />, { form });
    const user = userEvent.setup();
    const title = screen.getByLabelText('Form title');
    await user.clear(title);
    expect(title).toHaveValue('');
    await user.tab();
    expect(title).toHaveValue('Survey');
    expect(txs(apply).some((tx) => tx.ops.some((o: { changes?: { title?: unknown } }) => o.changes?.title))).toBe(false);
  });

  it('numbers questions like the list does: a hidden field takes no number and shifts none', () => {
    const hidden = field({ id: uid(4), ref: 'src', type: 'HIDDEN', label: 'Source', position: 2 });
    const email = field({ id: uid(5), ref: 'email', type: 'EMAIL', label: 'Email?', position: 3 });
    const form = makeForm([welcome, name, hidden, email]);
    const { unmount } = renderWithOps(<QuestionCanvas form={form} field={hidden} canEdit onSelect={() => {}} />, { form });
    expect(screen.queryByTestId('question-number')).not.toBeInTheDocument();
    unmount();
    renderWithOps(<QuestionCanvas form={form} field={email} canEdit onSelect={() => {}} />, { form });
    expect(screen.getByTestId('question-number')).toHaveAccessibleName('Question 2');
  });

  it('is read-only for viewers', () => {
    const form = makeForm([welcome, colour]);
    renderWithOps(<QuestionCanvas form={form} field={colour} canEdit={false} onSelect={() => {}} />, { form, readOnly: true });
    expect(screen.getByLabelText('Question text')).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Choice 1' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add choice' })).not.toBeInTheDocument();
  });

  it('shows the ending\'s chosen badge', () => {
    const end = field({ id: uid(6), ref: 'end', type: 'ENDING', label: 'Bye', position: 2, settings: { badgeIcon: 'heart' } });
    const form = makeForm([welcome, name, end]);
    renderWithOps(<QuestionCanvas form={form} field={end} canEdit onSelect={() => {}} />, { form });
    expect(screen.getByTestId('ending-badge-heart')).toBeInTheDocument();
  });

  it('edits an ending\'s button text in place once it has a link', async () => {
    const plain = field({ id: uid(6), ref: 'end', type: 'ENDING', label: 'Bye', position: 2 });
    const f1 = makeForm([welcome, name, plain]);
    const { unmount } = renderWithOps(<QuestionCanvas form={f1} field={plain} canEdit onSelect={() => {}} />, { form: f1 });
    expect(screen.queryByRole('textbox', { name: 'Button text' })).not.toBeInTheDocument();
    unmount();
    const linked = { ...plain, settings: { buttonUrl: 'https://x.test' } };
    const form = makeForm([welcome, name, linked]);
    const { apply } = renderWithOps(<QuestionCanvas form={form} field={linked} canEdit onSelect={() => {}} />, { form });
    const user = userEvent.setup();
    const button = screen.getByRole('textbox', { name: 'Button text' });
    expect(button).toHaveAttribute('placeholder', 'Continue');
    await user.type(button, 'Visit us');
    await user.tab();
    expect(apply.mock.calls.at(-1)![0].ops).toEqual(fieldSetTx(form, linked.id, { settings: { buttonLabel: 'Visit us' } }, 'Edit button text')!.ops);
  });
});
