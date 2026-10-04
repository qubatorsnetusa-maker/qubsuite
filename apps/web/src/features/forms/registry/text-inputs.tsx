import type { FormFieldType } from '@qub/shared';
import { useId, type ReactNode } from 'react';
import { Input, Textarea } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import type { InputProps } from './types';

const HTML: Partial<Record<FormFieldType, { type: string; autoComplete?: string; inputMode?: 'decimal' | 'tel' | 'email' | 'url' }>> = {
  SHORT_ANSWER: { type: 'text' },
  EMAIL: { type: 'email', autoComplete: 'email', inputMode: 'email' },
  PHONE: { type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
  URL: { type: 'url', autoComplete: 'url', inputMode: 'url' },
  NUMBER: { type: 'number', inputMode: 'decimal' },
  DATE: { type: 'date' },
  TIME: { type: 'time' },
  DATETIME: { type: 'datetime-local' },
};
const EMPTY_IS_NULL = new Set<FormFieldType>(['NUMBER', 'DATE', 'TIME', 'DATETIME']);
const DEFAULT_PLACEHOLDER: Partial<Record<FormFieldType, string>> = { SHORT_ANSWER: 'Your answer', EMAIL: 'name@example.com', URL: 'https://' };

function useCharCount(field: InputProps['field'], value: InputProps['value']) {
  const id = useId();
  const max = field.validation.maxLength;
  if (!field.settings.showCharCount || max == null) return { id: undefined, node: null };
  const length = typeof value === 'string' ? value.length : 0;
  return {
    id,
    node: (
      <p id={id} data-testid="char-count" className="mt-1 text-xs tabular-nums text-muted">
        {length} / {max}
      </p>
    ),
  };
}

function Affixes({ prefix, suffix, ids, big, children }: { prefix?: string; suffix?: string; ids: { prefix: string; suffix: string }; big: boolean; children: ReactNode }) {
  if (!prefix && !suffix) return <>{children}</>;
  const cls = cn('shrink-0 text-muted', big ? 'text-2xl' : 'text-sm');
  return (
    <div className="flex max-w-md items-center gap-2">
      {prefix && (
        <span id={ids.prefix} data-testid="affix-prefix" className={cls}>
          {prefix}
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
      {suffix && (
        <span id={ids.suffix} data-testid="affix-suffix" className={cls}>
          {suffix}
        </span>
      )}
    </div>
  );
}

const describedBy = (...ids: (string | undefined | false)[]) => ids.filter(Boolean).join(' ') || undefined;

export function TextLikeInput({ field, value, onChange, disabled, invalid, labelledBy, variant }: InputProps) {
  const spec = HTML[field.type] ?? { type: 'text' };
  const isNumber = field.type === 'NUMBER';
  const v = field.validation;
  const bounds = field.type === 'DATE' || field.type === 'DATETIME' ? { min: v.minDate, max: v.maxDate } : isNumber ? { min: v.min, max: v.max } : {};
  const base = useId();
  const ids = { prefix: `${base}-prefix`, suffix: `${base}-suffix` };
  const { prefix, suffix } = isNumber ? field.settings : {};
  const count = useCharCount(field, value);
  return (
    <div>
      <Affixes prefix={prefix} suffix={suffix} ids={ids} big={variant === 'conversational'}>
        <Input
          aria-labelledby={labelledBy}
          aria-describedby={describedBy(prefix && ids.prefix, suffix && ids.suffix, count.id)}
          aria-invalid={invalid || undefined}
          invalid={invalid}
          disabled={disabled}
          type={spec.type}
          inputMode={spec.inputMode}
          autoComplete={spec.autoComplete}
          step={isNumber ? (v.integer ? 1 : 'any') : undefined}
          {...bounds}
          placeholder={field.placeholder ?? DEFAULT_PLACEHOLDER[field.type]}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '' && EMPTY_IS_NULL.has(field.type)) onChange(null);
            else onChange(isNumber ? Number(raw) : raw);
          }}
          className={cn(
            variant === 'conversational'
              ? 'h-14 rounded-none border-0 border-b-2 bg-transparent px-0 text-2xl focus:ring-0'
              : field.type === 'SHORT_ANSWER'
                ? 'max-w-md rounded-none border-0 border-b px-0 focus:ring-0'
                : 'max-w-md',
          )}
        />
      </Affixes>
      {count.node}
    </div>
  );
}

export function ParagraphInput({ field, value, onChange, disabled, invalid, labelledBy, variant }: InputProps) {
  const big = variant === 'conversational';
  const count = useCharCount(field, value);
  return (
    <div>
      <Textarea
        aria-labelledby={labelledBy}
        aria-describedby={count.id}
        aria-invalid={invalid || undefined}
        invalid={invalid}
        disabled={disabled}
        placeholder={field.placeholder ?? 'Your answer'}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn(big && 'min-h-32 rounded-none border-0 border-b-2 bg-transparent px-0 text-xl focus:ring-0')}
      />
      {count.node}
      {big && <p className="mt-1 text-xs text-muted">Shift + Enter for a new line</p>}
    </div>
  );
}
