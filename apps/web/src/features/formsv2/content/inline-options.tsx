import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormFieldDto, OptionKind, UpdateFieldInput } from '@qub/shared';
import { newTxId, QUESTION_TYPES } from '@qub/shared/forms';
import { GripVertical, ImageIcon, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { optionDrafts, optionsInput, type OptionDraft } from '@/features/forms/builder/options-editor';
import { letterFor } from '@/features/forms/registry';

/** Respondent-facing names: Typeform calls options "choices". */
const NOUN: Record<OptionKind, string> = { option: 'Choice', row: 'Row', column: 'Column' };
/** Types whose respondent view shows A/B/C key badges on each choice. */
const LETTERED = new Set<FormFieldDto['type']>(['MULTIPLE_CHOICE', 'CHECKBOXES', 'IMAGE_CHOICE']);

/** `color` blended into transparent, for tinted borders and fills in the form's theme colour. */
export const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/**
 * Moves the draft `activeId` to where `overId` sits. Only within one kind (a matrix row never becomes a column);
 * null when the move is a no-op or crosses kinds.
 */
export function reorderDrafts(drafts: OptionDraft[], activeId: string, overId: string): OptionDraft[] | null {
  const from = drafts.findIndex((d) => d.id === activeId);
  const to = drafts.findIndex((d) => d.id === overId);
  if (from < 0 || to < 0 || from === to || drafts[from]!.kind !== drafts[to]!.kind) return null;
  return arrayMove(drafts, from, to);
}

/**
 * The choices of a choice question, edited in place and styled like the conversational respondent view: type to
 * rename (saved on blur), Enter adds the next choice and focuses it, Backspace in an empty choice removes it, × removes,
 * drag the grip to reorder, "Add choice" appends. Matrix rows and columns are edited the same way, side by side.
 * Saving goes through the same `optionsInput` as the classic options editor, so both builders send identical changes.
 */
export function InlineOptions({ field, canEdit, color, onUpdate }: { field: FormFieldDto; canEdit: boolean; color: string; onUpdate(input: UpdateFieldInput): void }) {
  const [drafts, setDrafts] = useState<OptionDraft[]>(() => optionDrafts(field));
  const key = field.options.map((o) => `${o.id}:${o.kind}:${o.label}:${o.imageUrl}`).join('|');
  const root = useRef<HTMLDivElement>(null);
  // Accept the form's options (undo, a collaborator) only when nobody is typing here.
  useEffect(() => {
    if (root.current?.contains(document.activeElement)) return;
    setDrafts(optionDrafts(field));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    const el = inputs.current.get(focusId);
    el?.focus();
    el?.select();
    setFocusId(null);
  }, [focusId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const kinds = QUESTION_TYPES[field.type].optionKinds;

  const commit = (next: OptionDraft[]) => {
    const input = optionsInput(field.type, next);
    if (input) onUpdate(input);
    return input;
  };
  const change = (next: OptionDraft[]) => {
    setDrafts(next);
    commit(next);
  };
  /** A new choice after `afterIndex` (or at the end of its kind), saved at once with its own id so later renames keep it. */
  const insert = (kind: OptionKind, afterIndex: number | null) => {
    const count = drafts.filter((d) => d.kind === kind).length;
    const draft: OptionDraft = { id: newTxId(), label: `${NOUN[kind]} ${count + 1}`, kind, imageUrl: null, value: null };
    const at = afterIndex === null ? drafts.length : afterIndex + 1;
    change([...drafts.slice(0, at), draft, ...drafts.slice(at)]);
    setFocusId(draft.id!);
  };
  const remove = (index: number, focusPrevious: boolean) => {
    const kind = drafts[index]!.kind;
    const previous = drafts.slice(0, index).findLast((d) => d.kind === kind);
    change(drafts.filter((_, j) => j !== index));
    if (focusPrevious && previous) setFocusId(previous.id!);
  };
  const edit = (index: number, patch: Partial<OptionDraft>) => setDrafts(drafts.map((d, j) => (j === index ? { ...d, ...patch } : d)));
  /** Leaving a choice saves the list; choices left empty are dropped (they can't be saved) unless that would empty a kind. */
  const blur = () => {
    if (!commit(drafts)) return;
    if (drafts.some((d) => !d.label.trim())) setDrafts(drafts.filter((d) => d.label.trim()));
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const next = reorderDrafts(drafts, String(e.active.id), String(e.over.id));
    if (next) change(next);
  };

  return (
    <div ref={root} className={cn(kinds.length > 1 && 'grid gap-8 sm:grid-cols-2')}>
      {kinds.map((kind) => {
        const items = drafts.map((d, index) => ({ d, index })).filter((x) => x.d.kind === kind);
        const noun = NOUN[kind];
        const lettered = kind === 'option' && LETTERED.has(field.type);
        return (
          <div key={kind} className="space-y-2">
            {kinds.length > 1 && <h3 className="text-xs font-semibold uppercase tracking-wider opacity-60">{noun}s</h3>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map(({ d }) => d.id!)} strategy={verticalListSortingStrategy}>
                <ol className={cn('grid gap-2', kinds.length === 1 && 'sm:max-w-md')}>
                  {items.map(({ d, index }, i) => (
                    <ChoiceRow
                      key={d.id}
                      draft={d}
                      noun={noun}
                      position={i}
                      badge={lettered ? letterFor(i) : String(i + 1)}
                      lettered={lettered}
                      withImage={field.type === 'IMAGE_CHOICE' && kind === 'option'}
                      color={color}
                      canEdit={canEdit}
                      removable={canEdit && items.length > 1}
                      inputRef={(el) => {
                        if (el) inputs.current.set(d.id!, el);
                        else inputs.current.delete(d.id!);
                      }}
                      onLabel={(label) => edit(index, { label })}
                      onImage={(imageUrl) => edit(index, { imageUrl })}
                      onBlur={blur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          insert(kind, index);
                        } else if (e.key === 'Backspace' && d.label === '' && items.length > 1) {
                          e.preventDefault();
                          remove(index, true);
                        }
                      }}
                      onRemove={() => remove(index, false)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
            {canEdit && (
              <button
                type="button"
                onClick={() => insert(kind, null)}
                className="flex items-center gap-1.5 rounded-md px-1 py-1.5 text-base font-medium underline-offset-4 hover:underline"
                style={{ color }}
              >
                <Plus className="size-4" aria-hidden /> Add {noun.toLowerCase()}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChoiceRow({
  draft,
  noun,
  position,
  badge,
  lettered,
  withImage,
  color,
  canEdit,
  removable,
  inputRef,
  onLabel,
  onImage,
  onBlur,
  onKeyDown,
  onRemove,
}: {
  draft: OptionDraft;
  noun: string;
  position: number;
  badge: string;
  lettered: boolean;
  withImage: boolean;
  color: string;
  canEdit: boolean;
  removable: boolean;
  inputRef(el: HTMLInputElement | null): void;
  onLabel(v: string): void;
  onImage(v: string): void;
  onBlur(): void;
  onKeyDown(e: KeyboardEvent<HTMLInputElement>): void;
  onRemove(): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: draft.id!, disabled: !canEdit });
  const n = position + 1;
  return (
    <li
      ref={setNodeRef}
      // The focus ring uses the theme colour, like the respondent's selected choice.
      style={{ transform: CSS.Transform.toString(transform), transition, borderColor: tint(color, 45), background: tint(color, 7), ['--choice-ring' as string]: tint(color, 25) }}
      className={cn('group relative rounded-lg border-2 transition-shadow focus-within:shadow-[0_0_0_3px_var(--choice-ring)]', isDragging && 'z-10 opacity-80 shadow-pop')}
    >
      {canEdit && (
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="absolute -left-8 top-1/2 -translate-y-1/2 cursor-grab rounded p-1 text-subtle opacity-0 transition-opacity hover:bg-hover focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={`Reorder ${noun.toLowerCase()} ${n}`}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      {withImage && (
        <div className="m-2 mb-0 grid aspect-video place-items-center overflow-hidden rounded-md bg-white/60">
          {draft.imageUrl ? <img src={draft.imageUrl} alt="" className="size-full object-cover" /> : <ImageIcon className="size-8 opacity-30" aria-hidden />}
        </div>
      )}
      <div className="flex items-center gap-3 px-3 py-2">
        <span
          aria-hidden
          data-testid={lettered ? `choice-letter-${position}` : undefined}
          className={cn('grid size-7 shrink-0 place-items-center rounded border bg-white/70 text-sm font-semibold', !lettered && 'border-transparent bg-transparent')}
          style={{ borderColor: lettered ? color : undefined, color }}
        >
          {badge}
        </span>
        <input
          ref={inputRef}
          value={draft.label}
          disabled={!canEdit}
          onChange={(e) => onLabel(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          aria-label={`${noun} ${n}`}
          placeholder={`${noun} ${n}`}
          className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:opacity-40 disabled:cursor-default"
        />
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-full p-1 opacity-50 transition-opacity hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Remove ${noun.toLowerCase()} ${n}`}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {withImage && (
        <div className="px-3 pb-2">
          <input
            value={draft.imageUrl ?? ''}
            disabled={!canEdit}
            onChange={(e) => onImage(e.target.value)}
            onBlur={onBlur}
            placeholder="Image URL (https://…)"
            aria-label={`Image URL for ${noun.toLowerCase()} ${n}`}
            className="w-full rounded border border-black/10 bg-white/70 px-2 py-1 text-sm outline-none focus:border-black/30"
          />
        </div>
      )}
    </li>
  );
}
