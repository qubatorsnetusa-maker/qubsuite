import type { FormDto, FormFieldDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { applyTx } from '@qub/shared/forms';
import type { DragEndEvent } from '@dnd-kit/core';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithOps } from '@/features/forms/builder/ops/test-utils';
import { formsService } from '@/services/forms';
import { handleReorder, QuestionList } from './question-list';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

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
const q1 = field({ id: uid(2), ref: 'name', type: 'SHORT_ANSWER', label: 'Name' });
// An invalid ref (starts with a digit) so `validateDefinition` reports an issue tied to this field.
const q2 = field({ id: uid(3), ref: '2bad', type: 'EMAIL', label: 'Email' });
const statement = field({ id: uid(4), ref: 'thanks', type: 'STATEMENT', label: 'Thanks for joining' });
const ending = field({ id: uid(5), ref: 'ending', type: 'ENDING', label: 'Thank you' });
const ending2 = field({ id: uid(6), ref: 'ending2', type: 'ENDING', label: 'See you soon' });

function makeForm(fields: FormFieldDto[]): FormDto {
  return {
    id: uid(900),
    revision: 0,
    settings: { ...DEFAULT_FORM_SETTINGS },
    variables: [],
    fields,
    theme: { primaryColor: '#673ab7' },
    capabilities: { canEdit: true, canTrash: true },
  } as unknown as FormDto;
}

describe('QuestionList', () => {
  it('numbers questions in order, leaves the welcome, endings and content blocks unnumbered, and flags issues', () => {
    const form = makeForm([welcome, q1, q2, statement, ending]);
    renderWithOps(<QuestionList form={form} canEdit selectedId={null} onSelect={vi.fn()} />, { form });
    expect(screen.getByRole('button', { name: 'Welcome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1. Name' })).toBeInTheDocument();
    // q2's row has an issue (invalid ref), so its accessible name includes the "Has problems" dot label.
    expect(screen.getByRole('button', { name: '2. Email Has problems' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thanks for joining' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thank you' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Name Has problems' })).not.toBeInTheDocument();
  });

  it('numbers by step position (matching the respondent view), not by counting only input questions', () => {
    // A content block between two questions still occupies a step, even though it shows no number itself — so the
    // question after it has to skip that step's number, the same way the conversational renderer counts steps.
    const form = makeForm([q1, statement, q2]);
    renderWithOps(<QuestionList form={form} canEdit selectedId={null} onSelect={vi.fn()} />, { form });
    expect(screen.getByRole('button', { name: '1. Name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thanks for joining' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3. Email Has problems' })).toBeInTheDocument();
  });

  it('selects a question when its row is clicked', async () => {
    const form = makeForm([welcome, q1, q2, ending]);
    const onSelect = vi.fn();
    renderWithOps(<QuestionList form={form} canEdit selectedId={null} onSelect={onSelect} />, { form });
    await userEvent.setup().click(screen.getByRole('button', { name: '2. Email Has problems' }));
    expect(onSelect).toHaveBeenCalledWith(q2.id);
  });

  it('adds exactly one question, after the selected question, and selects the new one', async () => {
    // Investigation (task-2-findings-r1.md): a stray extra field was once seen created during a browser session.
    // Asserting an exact call count here (not just inspecting the last call) guards against TypePicker's onPick,
    // or this list's own wiring, ever firing the add twice for one pick.
    const form = makeForm([welcome, q1, q2, ending]);
    const onSelect = vi.fn();
    const { apply } = renderWithOps(<QuestionList form={form} canEdit selectedId={q1.id} onSelect={onSelect} />, { form });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    await user.click(screen.getByRole('menuitem', { name: /Rating/ }));
    expect(apply).toHaveBeenCalledTimes(1);
    const tx = apply.mock.calls[0]![0];
    expect(tx.ops[0]).toMatchObject({ kind: 'create', entity: 'field', afterId: q1.id, snapshot: { type: 'RATING' } });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(tx.ops[0].snapshot.id);
  });

  it('adds an ending via the same builder used elsewhere', async () => {
    const form = makeForm([welcome, q1, ending]);
    const { apply } = renderWithOps(<QuestionList form={form} canEdit selectedId={q1.id} onSelect={vi.fn()} />, { form });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add ending' }));
    const tx = apply.mock.calls.at(-1)![0];
    // Endings always land after the last one, regardless of what's currently selected.
    expect(tx.ops[0]).toMatchObject({ kind: 'create', entity: 'field', afterId: ending.id, snapshot: { type: 'ENDING' } });
  });

  it('offers "Add welcome" only when the form has none yet', () => {
    const form1 = makeForm([q1, ending]);
    const { unmount } = renderWithOps(<QuestionList form={form1} canEdit selectedId={null} onSelect={vi.fn()} />, { form: form1 });
    expect(screen.getByRole('button', { name: 'Add welcome' })).toBeInTheDocument();
    unmount();
    const form2 = makeForm([welcome, q1, ending]);
    renderWithOps(<QuestionList form={form2} canEdit selectedId={null} onSelect={vi.fn()} />, { form: form2 });
    expect(screen.queryByRole('button', { name: 'Add welcome' })).not.toBeInTheDocument();
  });

  it('deletes a question, offers Undo in the toast, and selects its neighbour', async () => {
    const { toast } = await import('sonner');
    const form = makeForm([welcome, q1, q2, statement, ending]);
    const onSelect = vi.fn();
    const { apply } = renderWithOps(<QuestionList form={form} canEdit selectedId={null} onSelect={onSelect} />, { form });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More options for Email' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const deleteTx = apply.mock.calls.at(-1)![0];
    expect(deleteTx.ops.at(-1)).toMatchObject({ kind: 'delete', entity: 'field', id: q2.id });
    // q2's neighbour after deletion is the field right after it (the statement).
    expect(onSelect).toHaveBeenCalledWith(statement.id);
    const [, opts] = vi.mocked(toast).mock.calls.at(-1)!;
    expect(opts).toMatchObject({ duration: 8000, action: { label: 'Undo' } });
  });

  it('asks before deleting a question that has collected answers, and only deletes once confirmed', async () => {
    const { toast } = await import('sonner');
    vi.spyOn(formsService, 'analytics').mockResolvedValue({
      totalResponses: 3,
      views: 0,
      responseRate: null,
      firstResponseAt: null,
      lastResponseAt: null,
      trend: [],
      fields: [{ fieldId: q2.id, label: 'Email', type: 'EMAIL', answered: 2, skipped: 1 }],
    });
    const form = { ...makeForm([welcome, q1, q2, statement, ending]), responseCount: 3 } as FormDto;
    const onSelect = vi.fn();
    const { apply } = renderWithOps(<QuestionList form={form} canEdit selectedId={null} onSelect={onSelect} />, { form });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More options for Email' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete this question and its 2 answers?');
    expect(dialog).toHaveTextContent('Undo won’t bring the answers back.');
    expect(apply).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(apply.mock.calls.at(-1)![0].ops.at(-1)).toMatchObject({ kind: 'delete', entity: 'field', id: q2.id });
    expect(onSelect).toHaveBeenCalledWith(statement.id);
    expect(vi.mocked(toast).mock.calls.at(-1)![0]).toBe('Question deleted');
  });

  it('deletes at once, with the Undo toast, when the form has no responses', async () => {
    const { toast } = await import('sonner');
    const analytics = vi.spyOn(formsService, 'analytics');
    const form = { ...makeForm([welcome, q1, q2, ending]), responseCount: 0 } as FormDto;
    const { apply } = renderWithOps(<QuestionList form={form} canEdit selectedId={null} onSelect={vi.fn()} />, { form });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More options for Email' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(apply.mock.calls.at(-1)![0].ops.at(-1)).toMatchObject({ kind: 'delete', id: q2.id });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(analytics).not.toHaveBeenCalled();
    expect(vi.mocked(toast).mock.calls.at(-1)![1]).toMatchObject({ action: { label: 'Undo' } });
  });

  it('duplicates a question and selects the copy, but never offers to duplicate the welcome screen', async () => {
    const form = makeForm([welcome, q1, ending]);
    const onSelect = vi.fn();
    const { apply } = renderWithOps(<QuestionList form={form} canEdit selectedId={null} onSelect={onSelect} />, { form });
    const user = userEvent.setup();
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More options for Welcome' }));
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'More options for Name' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    const dupTx = apply.mock.calls.at(-1)![0];
    expect(dupTx.ops[0]).toMatchObject({ kind: 'create', entity: 'field', afterId: q1.id });
    expect(onSelect).toHaveBeenCalledWith(dupTx.ops[0].snapshot.id);
  });

  it('does not let the welcome or ending rows be dragged, and hides row controls for viewers', () => {
    const form = makeForm([welcome, q1, ending]);
    const { unmount } = renderWithOps(<QuestionList form={form} canEdit selectedId={null} onSelect={vi.fn()} />, { form });
    expect(screen.queryByLabelText(/Reorder Welcome/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Reorder Thank you/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reorder Name')).toBeInTheDocument();
    unmount();

    renderWithOps(<QuestionList form={form} canEdit={false} selectedId={null} onSelect={vi.fn()} />, { form });
    expect(screen.queryByLabelText(/Reorder/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /More options/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add question' })).not.toBeInTheDocument();
  });

  it('moves the selection with ArrowUp/ArrowDown while the list has focus', async () => {
    const form = makeForm([welcome, q1, q2, ending]);
    const onSelect = vi.fn();
    renderWithOps(<QuestionList form={form} canEdit selectedId={q1.id} onSelect={onSelect} />, { form });
    const user = userEvent.setup();
    // Focus lands on a row inside the list, the same way a real click would; the keydown then bubbles to the <ol>.
    await user.click(screen.getByRole('button', { name: '1. Name' }));
    await user.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenCalledWith(q2.id);
  });
});

// `moveFieldTx`'s `toIndex` indexes the field list with the dragged field already removed (op-builders.ts splices
// into that reduced list), so the actually-persisted order is what has to be checked — not just that some index
// was passed to `moveFieldTx` (task-2-findings-r1.md C1: the previous version of these tests only compared
// `handleReorder`'s output against a second, independently-computed `moveFieldTx` call, which could agree with a
// wrong clamp and still hide an off-by-one). `applyTx` gives the real resulting field order for that tx.
const resultingOrder = (form: FormDto, apply: ReturnType<typeof vi.fn>) => applyTx(form, apply.mock.calls.at(-1)![0]).fields.map((f) => f.id);

describe('handleReorder', () => {
  it('applies moveFieldTx at the dropped-on row’s index for an ordinary reorder', () => {
    const form = makeForm([welcome, q1, q2, statement, ending]);
    const apply = vi.fn();
    handleReorder(form, { apply }, { active: { id: q1.id }, over: { id: statement.id } } as DragEndEvent);
    // Dragging downward onto a target lands the dragged field right after it (the established reorder behaviour
    // this reuses from builder-page.tsx's outline — unaffected by the C1 fix, which only changes the zone clamps).
    expect(resultingOrder(form, apply)).toEqual([welcome.id, q2.id, statement.id, q1.id, ending.id]);
  });

  it('never drops a question above the welcome screen — it lands right after it instead', () => {
    const form = makeForm([welcome, q1, q2, ending]);
    const apply = vi.fn();
    handleReorder(form, { apply }, { active: { id: q2.id }, over: { id: welcome.id } } as DragEndEvent);
    expect(resultingOrder(form, apply)).toEqual([welcome.id, q2.id, q1.id, ending.id]);
  });

  it('never drops a question below (or between) the endings — one ending: it lands right before it', () => {
    const form = makeForm([welcome, q1, q2, statement, ending]);
    const apply = vi.fn();
    // Dropped directly onto the ending itself — the naive clamp (`firstEnding`, not `firstEnding - 1`) would
    // splice the dragged field in AFTER it once the dragged field is removed from the list moveFieldTx indexes.
    handleReorder(form, { apply }, { active: { id: q1.id }, over: { id: ending.id } } as DragEndEvent);
    const order = resultingOrder(form, apply);
    expect(order).toEqual([welcome.id, q2.id, statement.id, q1.id, ending.id]);
    expect(order.indexOf(q1.id)).toBe(order.indexOf(ending.id) - 1);
  });

  it('never drops a question below (or between) the endings — two endings: it lands before both', () => {
    const form = makeForm([welcome, q1, q2, ending, ending2]);
    const apply = vi.fn();
    // Dropped onto the SECOND ending — the naive clamp would land it between the two endings instead of before both.
    handleReorder(form, { apply }, { active: { id: q1.id }, over: { id: ending2.id } } as DragEndEvent);
    const order = resultingOrder(form, apply);
    expect(order).toEqual([welcome.id, q2.id, q1.id, ending.id, ending2.id]);
    expect(order.indexOf(q1.id)).toBeLessThan(order.indexOf(ending.id));
    expect(order.indexOf(q1.id)).toBeLessThan(order.indexOf(ending2.id));
  });

  it('ignores drags of the welcome or ending rows themselves', () => {
    const form = makeForm([welcome, q1, q2, ending]);
    const apply = vi.fn();
    handleReorder(form, { apply }, { active: { id: welcome.id }, over: { id: q2.id } } as DragEndEvent);
    handleReorder(form, { apply }, { active: { id: ending.id }, over: { id: q1.id } } as DragEndEvent);
    expect(apply).not.toHaveBeenCalled();
  });

  it('does nothing when there is no drop target', () => {
    const form = makeForm([welcome, q1, ending]);
    const apply = vi.fn();
    handleReorder(form, { apply }, { active: { id: q1.id }, over: null } as unknown as DragEndEvent);
    expect(apply).not.toHaveBeenCalled();
  });
});
