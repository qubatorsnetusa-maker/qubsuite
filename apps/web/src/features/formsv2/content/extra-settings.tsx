import { ENDING_BADGES, type EndingBadge, type FieldSettings, type FieldValidation, type FormDto, type FormFieldDto } from '@qub/shared';
import { fieldSetTx, PATTERN_PRESETS, PRESET_CATEGORIES, presetForPattern, QUESTION_TYPES } from '@qub/shared/forms';
import { CheckCircle2, Heart, Rocket, Sparkles, ThumbsUp, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { useBuilderOps } from '@/features/forms/builder/ops/builder-ops';
import { cn } from '@/lib/utils';
import { Section } from './sidebar-section';

const BADGE_UI: Record<EndingBadge, { icon: LucideIcon; label: string }> = {
  check: { icon: CheckCircle2, label: 'Check' },
  sparkles: { icon: Sparkles, label: 'Sparkles' },
  heart: { icon: Heart, label: 'Heart' },
  rocket: { icon: Rocket, label: 'Rocket' },
  thumbs_up: { icon: ThumbsUp, label: 'Thumbs up' },
};

function BlurText({
  label,
  value,
  placeholder,
  maxLength,
  type = 'text',
  disabled,
  onCommit,
}: {
  label: string;
  value: string | undefined;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  disabled: boolean;
  onCommit(v: string): void;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        key={value ?? ''}
        type={type}
        className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        defaultValue={value ?? ''}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        onBlur={(e) => e.target.value !== (value ?? '') && onCommit(e.target.value)}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  hint?: string;
  onChange(v: boolean): void;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>{label}</span>
        <button
          type="button"
          role="switch"
          aria-label={label}
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={cn(
            'relative h-5 w-9 rounded-full transition-colors',
            checked ? 'bg-primary' : 'bg-input',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
        </button>
      </label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function builtInLength(v: FieldValidation) {
  if (v.minLength != null) return `Must be at least ${v.minLength} characters`;
  if (v.maxLength != null) return `Must be at most ${v.maxLength} characters`;
  return 'Built-in message';
}

export function ExtraSettings({ form, field, canEdit }: { form: FormDto; field: FormFieldDto; canEdit: boolean }) {
  const ops = useBuilderOps();
  const formatId = useId();
  const def = QUESTION_TYPES[field.type];
  const disabled = !canEdit;
  const v = field.validation;
  const s = field.settings;

  const setValidation = (patch: Partial<FieldValidation>, label: string) =>
    ops.apply(fieldSetTx(form, field.id, { validation: { ...v, ...patch } }, label));

  const setSettings = (patch: Partial<FieldSettings>, label: string) =>
    ops.apply(fieldSetTx(form, field.id, { settings: patch }, label));

  const text = (x: string) => (x.trim() ? x : undefined);

  const has = (k: keyof FieldValidation) => (def.validationKeys as readonly string[]).includes(k);
  const hasSetting = (k: keyof FieldSettings) => (def.settingsKeys as readonly string[]).includes(k);
  const showFormat = has('pattern');
  const showRequired = has('requiredMessage') && field.required;
  const showLength = has('lengthMessage');
  const showRange = has('rangeMessage');
  const showDisplay = hasSetting('prefix') || hasSetting('yesLabel') || hasSetting('showCharCount');
  const isEnding = field.type === 'ENDING';
  const preset = presetForPattern(v.pattern);
  const formatValue = !v.pattern ? 'none' : (preset?.id ?? 'custom');

  return (
    <>
      {(showFormat || showRequired || showLength || showRange) && (
        <Section title="Validation">
          {showFormat && (
            <div className="space-y-1">
              <label htmlFor={formatId} className="block text-sm text-muted">
                Format
              </label>
              <select
                id={formatId}
                className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                value={formatValue}
                disabled={disabled}
                onChange={(e) => {
                  const next = PATTERN_PRESETS.find((p) => p.id === e.target.value);
                  if (next) {
                    setValidation({ pattern: next.pattern, patternMessage: next.message }, 'Change format');
                  } else {
                    // Clear: remove pattern and patternMessage, keep everything else
                    const { pattern: _p, patternMessage: _pm, ...rest } = v;
                    ops.apply(fieldSetTx(form, field.id, { validation: rest }, 'Change format'));
                  }
                }}
              >
                <option value="none">None</option>
                {PRESET_CATEGORIES.map((c) => (
                  <optgroup key={c} label={c}>
                    {PATTERN_PRESETS.filter((p) => p.category === c).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="custom" disabled>
                  Custom
                </option>
              </select>
              {preset && <p className="text-xs text-muted">e.g. {preset.example}</p>}
            </div>
          )}
          {showRequired && (
            <BlurText
              label="Required message"
              value={v.requiredMessage}
              placeholder="This question is required"
              maxLength={200}
              disabled={disabled}
              onCommit={(x) => setValidation({ requiredMessage: text(x) }, 'Change error message')}
            />
          )}
          {showLength && (
            <BlurText
              label="Length message"
              value={v.lengthMessage}
              placeholder={builtInLength(v)}
              maxLength={200}
              disabled={disabled}
              onCommit={(x) => setValidation({ lengthMessage: text(x) }, 'Change error message')}
            />
          )}
          {showRange && (
            <BlurText
              label="Range message"
              value={v.rangeMessage}
              placeholder="Built-in message"
              maxLength={200}
              disabled={disabled}
              onCommit={(x) => setValidation({ rangeMessage: text(x) }, 'Change error message')}
            />
          )}
        </Section>
      )}

      {showDisplay && (
        <Section title="Display">
          {hasSetting('prefix') && (
            <div className="grid grid-cols-2 gap-3">
              <BlurText
                label="Prefix"
                value={s.prefix}
                placeholder="$"
                maxLength={12}
                disabled={disabled}
                onCommit={(x) => setSettings({ prefix: text(x) }, 'Change display')}
              />
              <BlurText
                label="Suffix"
                value={s.suffix}
                placeholder="kg"
                maxLength={12}
                disabled={disabled}
                onCommit={(x) => setSettings({ suffix: text(x) }, 'Change display')}
              />
            </div>
          )}
          {hasSetting('yesLabel') && (
            <div className="grid grid-cols-2 gap-3">
              <BlurText
                label="Yes label"
                value={s.yesLabel}
                placeholder="Yes"
                maxLength={40}
                disabled={disabled}
                onCommit={(x) => setSettings({ yesLabel: text(x) }, 'Change display')}
              />
              <BlurText
                label="No label"
                value={s.noLabel}
                placeholder="No"
                maxLength={40}
                disabled={disabled}
                onCommit={(x) => setSettings({ noLabel: text(x) }, 'Change display')}
              />
            </div>
          )}
          {hasSetting('showCharCount') && (
            <Toggle
              label="Show character count"
              checked={!!s.showCharCount}
              disabled={disabled || v.maxLength == null}
              hint={v.maxLength == null ? 'Set a maximum length first' : undefined}
              onChange={(on) => setSettings({ showCharCount: on || undefined }, 'Change display')}
            />
          )}
        </Section>
      )}

      {isEnding && (
        <Section title="Ending">
          <div className="space-y-1">
            <span className="block text-sm text-muted">Badge</span>
            <div role="radiogroup" aria-label="Badge" className="flex gap-1">
              {ENDING_BADGES.map((b) => {
                const { icon: Icon, label } = BADGE_UI[b];
                const selected = (s.badgeIcon ?? 'check') === b;
                return (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    disabled={disabled}
                    onClick={() => setSettings({ badgeIcon: b === 'check' ? undefined : b }, 'Change ending')}
                    className={cn('grid size-9 place-items-center rounded-md border', selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-hover')}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
          <BlurText
            label="Button link"
            type="url"
            value={s.buttonUrl}
            placeholder="https://…"
            maxLength={2000}
            disabled={disabled}
            onCommit={(x) => setSettings({ buttonUrl: text(x) }, 'Change ending')}
          />
          <BlurText
            label="Redirect URL"
            type="url"
            value={s.redirectUrl}
            placeholder="https://…"
            maxLength={2000}
            disabled={disabled}
            onCommit={(x) => setSettings({ redirectUrl: text(x) }, 'Change ending')}
          />
          <BlurText
            label="Redirect after (seconds)"
            type="number"
            value={s.redirectDelay == null ? undefined : String(s.redirectDelay)}
            placeholder="0"
            disabled={disabled}
            onCommit={(x) => {
              const n = Math.round(Number(x));
              setSettings(
                { redirectDelay: x.trim() === '' || !Number.isFinite(n) ? undefined : Math.min(60, Math.max(0, n)) },
                'Change ending',
              );
            }}
          />
          <Toggle
            label='Show "Submit another response"'
            checked={s.showSubmitAnother !== false}
            disabled={disabled}
            onChange={(on) => setSettings({ showSubmitAnother: on ? undefined : false }, 'Change ending')}
          />
        </Section>
      )}
    </>
  );
}
