import type { AnswerValue, FormFieldDto, FormFieldOptionDto } from '@qub/shared';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Input, NativeSelect } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { useRovingRadio } from './roving';
import type { InputProps } from './types';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const letterFor = (i: number) => LETTERS[i] ?? '';

/** Per page load, so every respondent gets their own order but keyboard letters stay consistent within a visit. */
const SESSION_SEED = Math.floor(Math.random() * 2 ** 31);

/** Options in the order respondents see them (shuffled when the question asks for it). */
export function displayOptions(field: FormFieldDto): FormFieldOptionDto[] {
  const list = field.options.filter((o) => o.kind === 'option');
  if (!field.settings.shuffleOptions) return list;
  let seed = [...field.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, SESSION_SEED);
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const asArray = (v: AnswerValue | undefined) => (Array.isArray(v) ? v : []);

function optionRowClass(big: boolean, selected: boolean) {
  return cn('flex cursor-pointer items-center gap-3 text-sm', big && 'rounded-md border-2 px-3 py-2.5 text-base transition-colors hover:bg-black/5', big && selected && 'bg-black/5');
}

function LetterKey({ i, color, selected }: { i: number; color: string; selected: boolean }) {
  return (
    <kbd aria-hidden className="grid size-6 shrink-0 place-items-center rounded border text-xs font-semibold" style={{ borderColor: color, color: selected ? '#fff' : color, background: selected ? color : 'transparent' }}>
      {letterFor(i)}
    </kbd>
  );
}

export function ChoiceList({ field, value, onChange, disabled, labelledBy, color, variant }: InputProps) {
  const multi = field.type === 'CHECKBOXES';
  const big = variant === 'conversational';
  const selected = new Set(multi ? asArray(value) : typeof value === 'string' ? [value] : []);
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-labelledby={labelledBy} className={big ? 'grid gap-2 sm:max-w-md' : 'space-y-2'}>
      {displayOptions(field).map((o, i) => (
        <label key={o.id} className={optionRowClass(big, selected.has(o.id))} style={big ? { borderColor: selected.has(o.id) ? color : 'rgba(0,0,0,.15)' } : undefined}>
          {big && <LetterKey i={i} color={color} selected={selected.has(o.id)} />}
          <input
            type={multi ? 'checkbox' : 'radio'}
            name={field.id}
            disabled={disabled}
            checked={selected.has(o.id)}
            onChange={(e) => {
              if (!multi) return onChange(o.id);
              const next = new Set(selected);
              if (e.target.checked) next.add(o.id);
              else next.delete(o.id);
              onChange(field.options.filter((x) => next.has(x.id)).map((x) => x.id));
            }}
            style={{ accentColor: color }}
            className={cn('size-4', big && 'sr-only')}
          />
          <span className="flex-1">{o.label}</span>
          {big && selected.has(o.id) && <Check className="size-4" style={{ color }} aria-hidden />}
        </label>
      ))}
      {!multi && !big && typeof value === 'string' && !field.required && (
        <button type="button" onClick={() => onChange(null)} className="text-xs text-muted hover:underline">
          Clear selection
        </button>
      )}
    </div>
  );
}

export function DropdownInput(props: InputProps) {
  const { field, value, onChange, disabled, labelledBy, color, invalid } = props;
  const [query, setQuery] = useState('');
  const options = displayOptions(field);
  if (!field.settings.searchable) {
    return (
      <NativeSelect aria-labelledby={labelledBy} aria-invalid={invalid || undefined} disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)} className="min-w-[200px]">
        <option value="">Choose</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    );
  }
  const matches = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedLabel = options.find((o) => o.id === value)?.label;
  return (
    <div className="max-w-md space-y-2">
      <Input type="search" aria-label="Search options" placeholder={selectedLabel ?? 'Type to search'} value={query} disabled={disabled} onChange={(e) => setQuery(e.target.value)} />
      <div role="listbox" aria-labelledby={labelledBy} className="max-h-60 overflow-y-auto rounded-md border border-border">
        {matches.map((o) => (
          <div
            key={o.id}
            role="option"
            aria-selected={value === o.id}
            tabIndex={0}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(o.id);
              }
            }}
            className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-hover focus:bg-hover focus:outline-none"
          >
            {o.label}
            {value === o.id && <Check className="size-4" style={{ color }} aria-hidden />}
          </div>
        ))}
        {matches.length === 0 && <p className="px-3 py-2 text-sm text-muted">No matches</p>}
      </div>
    </div>
  );
}

const YES_NO_VALUES = [true, false] as const;

export function YesNoInput({ field, value, onChange, disabled, labelledBy, color, variant }: InputProps) {
  const big = variant === 'conversational';
  const current = typeof value === 'boolean' ? value : undefined;
  const radioProps = useRovingRadio(YES_NO_VALUES, current, onChange);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {YES_NO_VALUES.map((choice, i) => (
        <button
          key={String(choice)}
          type="button"
          role="radio"
          aria-checked={value === choice}
          disabled={disabled}
          onClick={() => onChange(choice)}
          {...radioProps(i)}
          className={cn('flex min-w-28 items-center gap-3 rounded-md border-2 px-4 py-2.5 text-left', big ? 'text-base' : 'text-sm')}
          style={{ borderColor: value === choice ? color : 'rgba(0,0,0,.15)', background: value === choice ? 'rgba(0,0,0,.05)' : undefined }}
        >
          <kbd aria-hidden className="grid size-6 place-items-center rounded border text-xs font-semibold" style={{ borderColor: color, color }}>
            {i === 0 ? 'Y' : 'N'}
          </kbd>
          {choice ? (field.settings.yesLabel || 'Yes') : (field.settings.noLabel || 'No')}
        </button>
      ))}
    </div>
  );
}

export function ImageChoiceInput({ field, value, onChange, disabled, labelledBy, color }: InputProps) {
  const multi = !!field.settings.allowMultiple;
  const selected = new Set(asArray(value));
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-labelledby={labelledBy} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {displayOptions(field).map((o, i) => (
        <label key={o.id} className="cursor-pointer overflow-hidden rounded-lg border-2 bg-white" style={{ borderColor: selected.has(o.id) ? color : 'rgba(0,0,0,.12)' }}>
          {o.imageUrl ? <img src={o.imageUrl} alt={o.label} className="aspect-square w-full object-cover" loading="lazy" /> : <div className="aspect-square w-full bg-surface-2" aria-hidden />}
          <span className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <LetterKey i={i} color={color} selected={selected.has(o.id)} />
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={field.id}
              aria-label={o.label}
              className="sr-only"
              disabled={disabled}
              checked={selected.has(o.id)}
              onChange={(e) => {
                if (!multi) return onChange([o.id]);
                const next = new Set(selected);
                if (e.target.checked) next.add(o.id);
                else next.delete(o.id);
                onChange(field.options.filter((x) => next.has(x.id)).map((x) => x.id));
              }}
            />
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}
