import { scaleBounds } from '@qub/shared/forms';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRovingRadio } from './roving';
import type { InputProps } from './types';

const numberOrUndefined = (v: unknown) => (typeof v === 'number' ? v : undefined);

export function StarRating({ field, value, onChange, disabled, labelledBy, color }: InputProps) {
  const [, max] = scaleBounds(field)!;
  const values = Array.from({ length: max }, (_, i) => i + 1);
  const radioProps = useRovingRadio(values, numberOrUndefined(value), onChange);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex gap-1">
      {values.map((n, i) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} disabled={disabled} onClick={() => onChange(n)} {...radioProps(i)} className="p-1">
          <Star className="size-8" style={{ color, fill: typeof value === 'number' && n <= value ? color : 'transparent' }} />
        </button>
      ))}
    </div>
  );
}

/** LINEAR_SCALE, OPINION_SCALE and NPS: a row of numbered buttons with end labels. */
export function ScaleInput({ field, value, onChange, disabled, labelledBy, color, variant }: InputProps) {
  const [lo, hi] = scaleBounds(field)!;
  const values = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const radioProps = useRovingRadio(values, numberOrUndefined(value), onChange);
  return (
    <div className="max-w-2xl">
      <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {values.map((n, i) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            disabled={disabled}
            onClick={() => onChange(n)}
            {...radioProps(i)}
            className={cn('rounded-md border-2 font-medium tabular-nums', variant === 'conversational' ? 'h-12 text-base' : 'h-10 text-sm')}
            style={{ borderColor: value === n ? color : 'rgba(0,0,0,.15)', background: value === n ? color : 'transparent', color: value === n ? '#fff' : undefined }}
          >
            {n}
          </button>
        ))}
      </div>
      {(field.settings.minLabel || field.settings.maxLabel) && (
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>{field.settings.minLabel}</span>
          <span>{field.settings.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

const EMOJI: Record<3 | 5, string[]> = { 3: ['🙁', '😐', '🙂'], 5: ['😞', '🙁', '😐', '🙂', '😄'] };

export function EmojiRating({ field, value, onChange, disabled, labelledBy, color }: InputProps) {
  const [, max] = scaleBounds(field)!;
  const faces = EMOJI[max as 3 | 5] ?? EMOJI[5];
  const values = faces.map((_, i) => i + 1);
  const radioProps = useRovingRadio(values, numberOrUndefined(value), onChange);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex gap-2">
      {faces.map((face, i) => (
        <button
          key={face}
          type="button"
          role="radio"
          aria-checked={value === i + 1}
          aria-label={`${i + 1} of ${max}`}
          disabled={disabled}
          onClick={() => onChange(i + 1)}
          {...radioProps(i)}
          className="grid size-14 place-items-center rounded-full border-2 text-3xl transition-transform hover:scale-110"
          style={{ borderColor: value === i + 1 ? color : 'transparent' }}
        >
          <span aria-hidden>{face}</span>
        </button>
      ))}
    </div>
  );
}

export function SliderInput({ field, value, onChange, disabled, labelledBy, color }: InputProps) {
  const min = field.settings.rangeMin ?? 0;
  const max = field.settings.rangeMax ?? 100;
  const step = field.settings.step ?? 1;
  const current = typeof value === 'number' ? value : min;
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-4">
        <input
          type="range"
          aria-labelledby={labelledBy}
          min={min}
          max={max}
          step={step}
          value={current}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: color }}
        />
        <output className="min-w-16 text-right text-lg tabular-nums">{typeof value === 'number' ? `${field.settings.prefix ?? ''}${value}${field.settings.suffix ?? ''}` : '—'}</output>
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{field.settings.minLabel ?? min}</span>
        <span>{field.settings.maxLabel ?? max}</span>
      </div>
    </div>
  );
}
