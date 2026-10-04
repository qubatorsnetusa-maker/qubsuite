import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormDto, FormFieldDto, FormFieldType } from '@qub/shared';
import { addFieldTx, duplicateFieldTx, moveFieldTx, validateDefinition } from '@qub/shared/forms';
import { Copy, GripVertical, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { Fragment, useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';
import { cn } from '@/lib/utils';
import { useBuilderOps, type BuilderOps } from '@/features/forms/builder/ops/builder-ops';
import { useDeleteQuestion } from '@/features/forms/builder/use-delete-question';
import { FIELD_UI } from '@/features/forms/registry';
import { TypePicker } from '@/features/forms/builder/type-picker';
import { questionNumbers } from './question-numbers';

/**
 * Computes the drop target index for a reorder and applies it as `moveFieldTx`. Exported (rather than kept as a
 * closure inside `QuestionList`) so tests can call it directly with a fabricated `DragEndEvent`, without simulating
 * a real pointer drag through dnd-kit's sensors.
 *
 * The welcome screen and endings never move via drag (their rows disable the sortable handle), and a question can't
 * be dropped above the welcome screen or below the endings — the index is clamped into the zone between them.
 *
 * `moveFieldTx`'s `toIndex` indexes the field list with the dragged field already removed (see its splice in
 * op-builders.ts), not the original `form.fields` array `to` is first computed against. The dragged field is never
 * welcome or an ending, so: welcome — always at original index 0, always before the dragged field — keeps index 0
 * once the dragged field is removed, so the "never above welcome" floor of 1 needs no adjustment; but every ending
 * sits after the dragged field, so removing it shifts each ending's index left by one, and the "never at/after the
 * first ending" ceiling must be `firstEnding - 1`, not `firstEnding` (using `firstEnding` would splice the dragged
 * field in immediately after the first ending instead of before it).
 */
export function handleReorder(form: FormDto, ops: Pick<BuilderOps, 'apply'>, event: DragEndEvent): void {
  if (!event.over) return;
  const fieldId = String(event.active.id);
  const overId = String(event.over.id);
  if (fieldId === overId) return;
  const active = form.fields.find((f) => f.id === fieldId);
  if (!active || active.type === 'WELCOME' || active.type === 'ENDING') return;
  let to = form.fields.findIndex((f) => f.id === overId);
  if (to < 0) return;
  const hasWelcome = form.fields[0]?.type === 'WELCOME';
  const firstEnding = form.fields.findIndex((f) => f.type === 'ENDING');
  if (hasWelcome) to = Math.max(to, 1);
  if (firstEnding >= 0) to = Math.min(to, firstEnding - 1);
  ops.apply(moveFieldTx(form, fieldId, to));
}

/**
 * Left panel of the Content tab: welcome screen pinned at top (unnumbered), questions numbered in order (other
 * content blocks listed but unnumbered), endings at the bottom. Drag to reorder, a row menu to duplicate or
 * delete, "Add question" (and Add welcome / Add ending) to insert after the current selection, ↑/↓ to move the
 * selection while the list has focus.
 */
export function QuestionList({
  form,
  canEdit,
  selectedId,
  onSelect,
}: {
  form: FormDto;
  canEdit: boolean;
  selectedId: string | null;
  onSelect(id: string | null): void;
}) {
  const ops = useBuilderOps();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const issueFieldIds = useMemo(() => {
    const issues = validateDefinition(
      { fields: form.fields, variables: form.variables },
      { quiz: form.settings.quiz.enabled, confirmationMessage: form.settings.confirmationMessage },
    );
    return new Set(issues.map((i) => i.fieldId).filter((id): id is string => id !== null));
  }, [form.fields, form.variables, form.settings.quiz.enabled, form.settings.confirmationMessage]);

  // Numbered the way the respondent sees them (shared with the canvas and the Workflow tab).
  const numbers = questionNumbers(form.fields);
  const rows = form.fields.map((field, i) => ({ field, number: numbers[i] ?? null }));
  const hasWelcome = form.fields.some((f) => f.type === 'WELCOME');

  const addField = (type: FormFieldType) => {
    const { tx, fieldId } = addFieldTx(form, type, selectedId);
    ops.apply(tx);
    onSelect(fieldId);
  };

  const duplicate = (fieldId: string) => {
    const result = duplicateFieldTx(form, fieldId);
    if (!result) return;
    ops.apply(result.tx);
    onSelect(result.fieldId);
  };

  // Same guarded delete as classic Forms: asks first when the question has collected answers.
  const deletion = useDeleteQuestion(form);
  const remove = (fieldId: string) => {
    const idx = form.fields.findIndex((f) => f.id === fieldId);
    const neighbourId = form.fields[idx + 1]?.id ?? form.fields[idx - 1]?.id ?? null;
    void deletion.remove(fieldId, () => onSelect(neighbourId));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const ids = form.fields.map((f) => f.id);
    if (!ids.length) return;
    e.preventDefault();
    const idx = selectedId ? ids.indexOf(selectedId) : -1;
    const nextIdx = e.key === 'ArrowDown' ? Math.min(idx + 1, ids.length - 1) : Math.max(idx - 1, 0);
    const id = ids[nextIdx];
    if (id) onSelect(id);
  };

  return (
    <nav aria-label="Questions" className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleReorder(form, ops, e)}>
          <SortableContext items={form.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-0.5" onKeyDown={onKeyDown}>
              {rows.map(({ field, number }, i) => {
                const prevType = rows[i - 1]?.field.type;
                return (
                  <Fragment key={field.id}>
                    {field.type === 'WELCOME' && <GroupLabel first>Welcome</GroupLabel>}
                    {field.type !== 'WELCOME' && field.type !== 'ENDING' && (i === 0 || prevType === 'WELCOME') && <GroupLabel first={i === 0}>Questions</GroupLabel>}
                    {field.type === 'ENDING' && prevType !== 'ENDING' && <GroupLabel first={i === 0}>Ending</GroupLabel>}
                    <QuestionRow
                      field={field}
                      number={number}
                      active={selectedId === field.id}
                      hasIssue={issueFieldIds.has(field.id)}
                      draggable={canEdit && field.type !== 'WELCOME' && field.type !== 'ENDING'}
                      canEdit={canEdit}
                      deleting={deletion.checking}
                      onSelect={() => onSelect(field.id)}
                      onDuplicate={() => duplicate(field.id)}
                      onDelete={() => remove(field.id)}
                    />
                  </Fragment>
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
      {/* Hide the footer on an empty form: EmptyForm in the canvas is the designated entry point there. */}
      {canEdit && form.fields.length > 0 && (
        <div className="shrink-0 space-y-1 border-t border-border p-2">
          <TypePicker
            onPick={addField}
            trigger={
              <Button type="button" variant="ghost" size="sm" className="w-full justify-start">
                <Plus /> Add question
              </Button>
            }
          />
          {!hasWelcome && (
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => addField('WELCOME')}>
              <Plus /> Add welcome
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => addField('ENDING')}>
            <Plus /> Add ending
          </Button>
        </div>
      )}
      {deletion.dialog}
    </nav>
  );
}

function GroupLabel({ children, first }: { children: ReactNode; first: boolean }) {
  return (
    <li aria-hidden className={cn('px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted', first && 'pt-0')}>
      {children}
    </li>
  );
}

function QuestionRow({
  field,
  number,
  active,
  hasIssue,
  draggable,
  canEdit,
  deleting,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  field: FormFieldDto;
  number: number | null;
  active: boolean;
  hasIssue: boolean;
  draggable: boolean;
  canEdit: boolean;
  /** A delete is waiting for its answer count: don't start another. */
  deleting: boolean;
  onSelect(): void;
  onDuplicate(): void;
  onDelete(): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id, disabled: !draggable });
  const Icon = FIELD_UI[field.type].icon;
  const name = field.label || 'Untitled';
  const canDuplicate = field.type !== 'WELCOME';
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group flex items-center gap-1 rounded-md text-sm', active ? 'bg-[#ede7f6]' : 'hover:bg-hover', isDragging && 'opacity-60 shadow-pop')}
    >
      {draggable && (
        <button {...attributes} {...listeners} type="button" className="cursor-grab p-1 text-subtle" aria-label={`Reorder ${name}`}>
          <GripVertical className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cn('flex min-w-0 flex-1 items-center gap-2 truncate py-1.5 pr-1 text-left', !draggable && 'pl-2')}
      >
        <Icon className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="truncate">
          {number !== null ? `${number}. ` : ''}
          {name}
        </span>
        {hasIssue && (
          <>
            {' '}
            <span role="img" className="size-1.5 shrink-0 rounded-full bg-danger" aria-label="Has problems" />
          </>
        )}
      </button>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-subtle opacity-0 hover:bg-hover focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`More options for ${name}`}
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {canDuplicate && (
              <DropdownMenuItem icon={<Copy className="size-4" />} onSelect={onDuplicate}>
                Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem icon={<Trash2 className="size-4" />} destructive disabled={deleting} onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
