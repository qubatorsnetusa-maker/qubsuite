import type { FormFieldDto, FormFieldType, OptionKind, UpdateFieldInput } from '@qub/shared';
import { QUESTION_TYPES } from '@qub/shared/forms';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

/** One option (or matrix row/column) being edited, before it is committed. */
export type OptionDraft = { id: string | undefined; label: string; kind: OptionKind; imageUrl: string | null; value: string | null };
type Draft = OptionDraft;
export const OPTION_NOUN: Record<OptionKind, string> = { option: 'Option', row: 'Row', column: 'Column' };
const NOUN = OPTION_NOUN;

/** The field's stored options as editable drafts (ids kept). */
export const optionDrafts = (field: FormFieldDto): OptionDraft[] => field.options.map((o) => ({ id: o.id as string | undefined, label: o.label, kind: o.kind, imageUrl: o.imageUrl, value: o.value }));

/**
 * The field change that saves `drafts`: labels and image URLs trimmed, empty entries dropped, grouped in the type's
 * kind order. Null when a kind the type needs would be left empty (nothing is saved then).
 */
export function optionsInput(type: FormFieldType, drafts: OptionDraft[]): UpdateFieldInput | null {
  const kinds = QUESTION_TYPES[type].optionKinds;
  const clean = drafts.map((o) => ({ ...o, label: o.label.trim(), imageUrl: o.imageUrl?.trim() || null })).filter((o) => o.label);
  if (kinds.some((k) => !clean.some((o) => o.kind === k))) return null; // every kind needs at least one entry
  return { options: kinds.flatMap((k) => clean.filter((o) => o.kind === k)) };
}

/** Edits every option kind a type uses (options, or matrix rows + columns). Saves the whole list, keeping ids. */
export function OptionsEditor({ field, canEdit, onUpdate }: { field: FormFieldDto; canEdit: boolean; onUpdate(i: UpdateFieldInput): void }) {
  const fromField = () => optionDrafts(field);
  const [drafts, setDrafts] = useState<Draft[]>(fromField);
  const key = field.options.map((o) => `${o.id}:${o.kind}:${o.label}:${o.imageUrl}`).join('|');
  const root = useRef<HTMLDivElement>(null);
  // Accept server state only when the user isn't typing here.
  useEffect(() => {
    if (root.current?.contains(document.activeElement)) return;
    setDrafts(fromField());
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const kinds = QUESTION_TYPES[field.type].optionKinds;
  const commit = (next: Draft[]) => {
    const input = optionsInput(field.type, next);
    if (input) onUpdate(input);
  };
  const add = (kind: OptionKind) => {
    const count = drafts.filter((o) => o.kind === kind).length;
    const next = [...drafts, { id: undefined, label: `${NOUN[kind]} ${count + 1}`, kind, imageUrl: null, value: null }];
    setDrafts(next);
    commit(next);
  };
  const marker = field.type === 'MULTIPLE_CHOICE' ? 'rounded-full' : field.type === 'CHECKBOXES' ? 'rounded-sm' : '';

  return (
    <div ref={root} className={cn('gap-6', kinds.length > 1 && 'grid sm:grid-cols-2')}>
      {kinds.map((kind) => {
        const items = drafts.map((d, index) => ({ d, index })).filter((x) => x.d.kind === kind);
        return (
          <div key={kind}>
            {kinds.length > 1 && <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{NOUN[kind]}s</h4>}
            <ol className="space-y-2">
              {items.map(({ d, index }, i) => (
                <li key={d.id ?? `new-${index}`} className="flex flex-wrap items-center gap-3">
                  {field.type === 'DROPDOWN' || field.type === 'RANKING' || kind !== 'option' ? <span className="w-5 text-sm text-muted">{i + 1}.</span> : <span className={cn('size-4 border-2 border-border-strong', marker)} aria-hidden />}
                  <Input
                    value={d.label}
                    disabled={!canEdit}
                    onChange={(e) => setDrafts(drafts.map((x, j) => (j === index ? { ...x, label: e.target.value } : x)))}
                    onBlur={() => commit(drafts)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        add(kind);
                      }
                    }}
                    aria-label={`${NOUN[kind]} ${i + 1}`}
                    className="h-9 max-w-md flex-1 rounded-none border-0 border-b px-0 focus:ring-0"
                  />
                  {field.type === 'IMAGE_CHOICE' && (
                    <Input
                      value={d.imageUrl ?? ''}
                      disabled={!canEdit}
                      placeholder="https://… image"
                      onChange={(e) => setDrafts(drafts.map((x, j) => (j === index ? { ...x, imageUrl: e.target.value } : x)))}
                      onBlur={() => commit(drafts)}
                      aria-label={`Image URL for option ${i + 1}`}
                      className="h-9 w-full sm:w-64"
                    />
                  )}
                  {canEdit && items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = drafts.filter((_, j) => j !== index);
                        setDrafts(next);
                        commit(next);
                      }}
                      className="rounded-full p-1 text-muted hover:bg-hover"
                      aria-label={`Remove ${NOUN[kind].toLowerCase()} ${i + 1}`}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </li>
              ))}
              {canEdit && (
                <li>
                  <button type="button" className="ml-7 text-sm text-muted hover:text-foreground" onClick={() => add(kind)}>
                    Add {NOUN[kind].toLowerCase()}
                  </button>
                </li>
              )}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
