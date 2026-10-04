import type { FormDto } from '@qub/shared';
import { QUESTION_TYPES } from '@qub/shared/forms';
import { useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { Input, Textarea } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

export interface PipeSuggestion {
  key: string;
  label: string;
}

/** Keys usable in {{…}}: answers of input questions, variables and the score. */
export function pipeSuggestions(form: Pick<FormDto, 'fields' | 'variables'>, exceptFieldId?: string): PipeSuggestion[] {
  return [
    ...form.fields.filter((f) => f.id !== exceptFieldId && QUESTION_TYPES[f.type].isInput).map((f) => ({ key: f.ref, label: f.label || 'Question' })),
    ...form.variables.map((v) => ({ key: v.key, label: 'Variable' })),
    { key: 'score', label: 'Quiz score' },
  ];
}

type Props = { value: string; onChange(v: string): void; onBlur?(): void; suggestions: PipeSuggestion[]; multiline?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>;

/** Text input with `{{` autocomplete for piping answers and variables. */
export function PipingInput({ value, onChange, onBlur, suggestions, multiline, className, ...rest }: Props) {
  const listId = useId();
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);
  const matches = query ? suggestions.filter((s) => s.key.toLowerCase().startsWith(query.text.toLowerCase())).slice(0, 8) : [];
  const open = matches.length > 0;

  const detect = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = /\{\{\s*([a-zA-Z0-9_]*)$/.exec(before);
    setQuery(m ? { start: caret - m[0].length, text: m[1]! } : null);
    setActive(0);
  };
  const insert = (key: string) => {
    if (!query || !ref.current) return;
    const caret = ref.current.selectionStart ?? value.length;
    const next = `${value.slice(0, query.start)}{{${key}}}${value.slice(caret)}`;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = query.start + key.length + 4;
      ref.current?.setSelectionRange(pos, pos);
    });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement & HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insert(matches[active]!.key);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery(null);
    }
  };
  const common = {
    ...rest,
    ref,
    role: 'combobox',
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant': open ? `${listId}-${active}` : undefined,
    value,
    onKeyDown,
    onBlur: () => {
      setQuery(null);
      onBlur?.();
    },
    onChange: (e: { target: { value: string; selectionStart: number | null } }) => {
      onChange(e.target.value);
      detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
    },
  };
  return (
    <div className="relative min-w-0 flex-1">
      {multiline ? <Textarea {...(common as any)} className={className} /> : <Input {...(common as any)} className={className} />}
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-md border border-border bg-background shadow-pop">
          {matches.map((s, i) => (
            <li
              key={s.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(s.key);
              }}
              className={cn('flex cursor-pointer justify-between gap-3 px-3 py-1.5 text-sm', i === active && 'bg-hover')}
            >
              <span className="font-mono">{s.key}</span>
              <span className="truncate text-xs text-muted">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
