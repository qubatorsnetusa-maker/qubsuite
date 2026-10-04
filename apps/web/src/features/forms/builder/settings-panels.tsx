import type { AnswerValue, FieldSettings, FieldValidation, FormFieldDto, FormFieldType, UpdateFieldInput } from '@qub/shared';
import { DEFAULT_ANSWER_TYPES, deepEqual, validateFieldAnswer } from '@qub/shared/forms';
import { useEffect, useId, useState, type ComponentType, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Switch, Textarea } from '@/components/ui/form-controls';
import { FIELD_UI } from '../registry';

export interface PanelProps {
  field: FormFieldDto;
  canEdit: boolean;
  onUpdate(input: UpdateFieldInput): void;
  quiz?: boolean;
}

function NumberSetting({ label, value, onChange, min, max, step, disabled }: { label: string; value: number | undefined; onChange(v: number | undefined): void; min?: number; max?: number; step?: number | 'any'; disabled?: boolean }) {
  const id = useId();
  return (
    <span className="flex items-center gap-2 text-sm text-muted">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        key={String(value ?? '')}
        type="number"
        disabled={disabled}
        className="h-8 w-24"
        min={min}
        max={max}
        step={step}
        defaultValue={value ?? ''}
        onBlur={(e) => {
          const next = e.target.value === '' ? undefined : Number(e.target.value);
          if (next !== value) onChange(next);
        }}
      />
    </span>
  );
}

function TextSetting({ label, value, onCommit, placeholder, disabled, multiline, mono, type = 'text' }: { label: string; value: string | undefined | null; onCommit(v: string): void; placeholder?: string; disabled?: boolean; multiline?: boolean; mono?: boolean; type?: string }) {
  const id = useId();
  return (
    <span className="flex flex-col gap-1 text-sm text-muted">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <Textarea id={id} key={value ?? ''} disabled={disabled} defaultValue={value ?? ''} placeholder={placeholder} onBlur={(e) => e.target.value !== (value ?? '') && onCommit(e.target.value)} />
      ) : (
        <Input id={id} key={value ?? ''} type={type} disabled={disabled} defaultValue={value ?? ''} placeholder={placeholder} className={mono ? 'h-8 max-w-xs font-mono' : 'h-8 max-w-md'} onBlur={(e) => e.target.value !== (value ?? '') && onCommit(e.target.value)} />
      )}
    </span>
  );
}

function ToggleSetting({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange(v: boolean): void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label} <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as { [K in keyof T]: Exclude<T[K], undefined> };
const setters = ({ field, onUpdate }: PanelProps) => ({
  setS: (patch: Partial<FieldSettings>) => onUpdate({ settings: patch }),
  setV: (patch: Partial<FieldValidation>) => onUpdate({ validation: clean({ ...field.validation, ...patch }) }),
});
const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-4">{children}</div>;

function TextPanel(p: PanelProps) {
  const { setV } = setters(p);
  const v = p.field.validation;
  return (
    <div className="space-y-3">
      <Row>
        <NumberSetting label="Min length" value={v.minLength} min={0} disabled={!p.canEdit} onChange={(x) => setV({ minLength: x })} />
        <NumberSetting label="Max length" value={v.maxLength} min={1} disabled={!p.canEdit} onChange={(x) => setV({ maxLength: x })} />
      </Row>
      {p.field.type === 'SHORT_ANSWER' && (
        <Row>
          <TextSetting label="Pattern (regex)" mono value={v.pattern} placeholder="^[A-Z]{3}-\d+$" disabled={!p.canEdit} onCommit={(x) => setV({ pattern: x || undefined })} />
          <TextSetting label="Pattern error message" value={v.patternMessage} disabled={!p.canEdit} onCommit={(x) => setV({ patternMessage: x || undefined })} />
        </Row>
      )}
    </div>
  );
}

function NumberPanel(p: PanelProps) {
  const { setV } = setters(p);
  const v = p.field.validation;
  return (
    <Row>
      <NumberSetting label="Minimum" value={v.min} step="any" disabled={!p.canEdit} onChange={(x) => setV({ min: x })} />
      <NumberSetting label="Maximum" value={v.max} step="any" disabled={!p.canEdit} onChange={(x) => setV({ max: x })} />
      <ToggleSetting label="Whole numbers only" checked={!!v.integer} disabled={!p.canEdit} onChange={(x) => setV({ integer: x || undefined })} />
    </Row>
  );
}

function DatePanel(p: PanelProps) {
  const { setV } = setters(p);
  const type = p.field.type === 'DATETIME' ? 'datetime-local' : 'date';
  return (
    <Row>
      <TextSetting type={type} label="Earliest" value={p.field.validation.minDate} disabled={!p.canEdit} onCommit={(x) => setV({ minDate: x || undefined })} />
      <TextSetting type={type} label="Latest" value={p.field.validation.maxDate} disabled={!p.canEdit} onCommit={(x) => setV({ maxDate: x || undefined })} />
    </Row>
  );
}

function ChoicePanel(p: PanelProps) {
  const { setS, setV } = setters(p);
  const { settings: s, validation: v, type } = p.field;
  const multi = type === 'CHECKBOXES' || (type === 'IMAGE_CHOICE' && s.allowMultiple);
  return (
    <Row>
      <ToggleSetting label="Shuffle options" checked={!!s.shuffleOptions} disabled={!p.canEdit} onChange={(x) => setS({ shuffleOptions: x })} />
      {type === 'DROPDOWN' && <ToggleSetting label="Searchable" checked={!!s.searchable} disabled={!p.canEdit} onChange={(x) => setS({ searchable: x })} />}
      {type === 'IMAGE_CHOICE' && <ToggleSetting label="Allow several pictures" checked={!!s.allowMultiple} disabled={!p.canEdit} onChange={(x) => setS({ allowMultiple: x })} />}
      {multi && (
        <>
          <NumberSetting label="Select at least" value={v.minSelected} min={0} disabled={!p.canEdit} onChange={(x) => setV({ minSelected: x })} />
          <NumberSetting label="Select at most" value={v.maxSelected} min={1} disabled={!p.canEdit} onChange={(x) => setV({ maxSelected: x })} />
        </>
      )}
    </Row>
  );
}

function EndLabels(p: PanelProps) {
  const { setS } = setters(p);
  return (
    <>
      <TextSetting label="Low label" value={p.field.settings.minLabel} disabled={!p.canEdit} onCommit={(x) => setS({ minLabel: x })} />
      <TextSetting label="High label" value={p.field.settings.maxLabel} disabled={!p.canEdit} onCommit={(x) => setS({ maxLabel: x })} />
    </>
  );
}

function ScalePanel(p: PanelProps) {
  const { setS } = setters(p);
  const s = p.field.settings;
  return (
    <Row>
      <NativeSelect aria-label="Scale start" value={s.scaleMin ?? 1} disabled={!p.canEdit} onChange={(e) => setS({ scaleMin: Number(e.target.value) })}>
        <option value={0}>0</option>
        <option value={1}>1</option>
      </NativeSelect>
      <span className="text-sm text-muted">to</span>
      <NativeSelect aria-label="Scale end" value={s.scaleMax ?? 5} disabled={!p.canEdit} onChange={(e) => setS({ scaleMax: Number(e.target.value) })}>
        {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </NativeSelect>
      <EndLabels {...p} />
    </Row>
  );
}

function RatingPanel(p: PanelProps) {
  const { setS } = setters(p);
  const emoji = p.field.type === 'EMOJI_RATING';
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {emoji ? 'Faces' : 'Number of stars'}
      <NativeSelect value={emoji ? (p.field.settings.scaleMax === 3 ? 3 : 5) : p.field.settings.scaleMax ?? 5} disabled={!p.canEdit} onChange={(e) => setS({ scaleMax: Number(e.target.value) })}>
        {(emoji ? [3, 5] : [3, 4, 5, 6, 7, 8, 9, 10]).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function SliderPanel(p: PanelProps) {
  const { setS } = setters(p);
  const s = p.field.settings;
  return (
    <Row>
      <NumberSetting label="Min" value={s.rangeMin ?? 0} step="any" disabled={!p.canEdit} onChange={(x) => setS({ rangeMin: x ?? 0 })} />
      <NumberSetting label="Max" value={s.rangeMax ?? 100} step="any" disabled={!p.canEdit} onChange={(x) => setS({ rangeMax: x ?? 100 })} />
      <NumberSetting label="Step" value={s.step ?? 1} step="any" min={0} disabled={!p.canEdit} onChange={(x) => setS({ step: x ?? 1 })} />
      <EndLabels {...p} />
    </Row>
  );
}

function FilePanel(p: PanelProps) {
  const { setS } = setters(p);
  const s = p.field.settings;
  const types = ['image', 'pdf', 'document', 'spreadsheet', 'video', 'audio'] as const;
  return (
    <div className="space-y-3 text-sm text-muted">
      <div className="flex flex-wrap gap-3">
        {types.map((t) => (
          <label key={t} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              disabled={!p.canEdit}
              checked={s.allowedFileTypes?.includes(t) ?? false}
              onChange={(e) => {
                const next = new Set(s.allowedFileTypes ?? []);
                if (e.target.checked) next.add(t);
                else next.delete(t);
                setS({ allowedFileTypes: [...next] });
              }}
            />
            {t}
          </label>
        ))}
      </div>
      <Row>
        <NumberSetting label="Max files" value={s.maxFiles ?? 1} min={1} max={10} disabled={!p.canEdit} onChange={(x) => setS({ maxFiles: x ?? 1 })} />
        <NumberSetting label="Max size (MB)" value={s.maxFileSizeMb ?? 10} min={1} max={100} disabled={!p.canEdit} onChange={(x) => setS({ maxFileSizeMb: x ?? 10 })} />
      </Row>
    </div>
  );
}

function ImageSettings(p: PanelProps) {
  const { setS } = setters(p);
  return (
    <Row>
      <TextSetting type="url" label="Image URL" value={p.field.settings.imageUrl} placeholder="https://…" disabled={!p.canEdit} onCommit={(x) => setS({ imageUrl: x || null })} />
      <TextSetting label="Image description (alt text)" value={p.field.settings.imageAlt} disabled={!p.canEdit} onCommit={(x) => setS({ imageAlt: x })} />
    </Row>
  );
}

function ScreenPanel(p: PanelProps) {
  const { setS } = setters(p);
  return (
    <div className="space-y-3">
      <TextSetting label="Button text" value={p.field.settings.buttonLabel} disabled={!p.canEdit} onCommit={(x) => setS({ buttonLabel: x })} />
      <ImageSettings {...p} />
    </div>
  );
}

function VideoPanel(p: PanelProps) {
  const { setS } = setters(p);
  return <TextSetting type="url" label="Video URL" value={p.field.settings.videoUrl} placeholder="YouTube, Vimeo or https:// video" disabled={!p.canEdit} onCommit={(x) => setS({ videoUrl: x })} />;
}

function ConsentPanel(p: PanelProps) {
  const { setS } = setters(p);
  return <TextSetting multiline label="Consent text" value={p.field.settings.consentText} disabled={!p.canEdit} onCommit={(x) => setS({ consentText: x })} />;
}

function LocationPanel(p: PanelProps) {
  const { setS } = setters(p);
  return <ToggleSetting label="Offer “Use my location”" checked={p.field.settings.allowGeolocation !== false} disabled={!p.canEdit} onChange={(x) => setS({ allowGeolocation: x })} />;
}

function HiddenPanel(p: PanelProps) {
  return (
    <p className="text-sm text-muted">
      Filled from the form link: add <code className="rounded bg-surface px-1">?{p.field.ref}=value</code> to the live URL. Respondents never see it.
    </p>
  );
}

export const SETTINGS_PANELS: Record<FormFieldType, ComponentType<PanelProps> | null> = {
  SHORT_ANSWER: TextPanel,
  PARAGRAPH: TextPanel,
  EMAIL: null,
  PHONE: null,
  URL: null,
  NUMBER: NumberPanel,
  DATE: DatePanel,
  TIME: null,
  DATETIME: DatePanel,
  HIDDEN: HiddenPanel,
  MULTIPLE_CHOICE: ChoicePanel,
  CHECKBOXES: ChoicePanel,
  DROPDOWN: ChoicePanel,
  IMAGE_CHOICE: ChoicePanel,
  RANKING: ChoicePanel,
  MATRIX: null,
  YES_NO: null,
  RATING: RatingPanel,
  EMOJI_RATING: RatingPanel,
  LINEAR_SCALE: ScalePanel,
  OPINION_SCALE: ScalePanel,
  NPS: (p) => (
    <Row>
      <EndLabels {...p} />
    </Row>
  ),
  SLIDER: SliderPanel,
  FILE_UPLOAD: FilePanel,
  SIGNATURE: null,
  ADDRESS: null,
  LOCATION: LocationPanel,
  CONSENT: ConsentPanel,
  SECTION: null,
  STATEMENT: ScreenPanel,
  IMAGE_BLOCK: ImageSettings,
  VIDEO_BLOCK: VideoPanel,
  WELCOME: ScreenPanel,
  ENDING: ScreenPanel,
};

const PLACEHOLDER_TYPES = new Set<FormFieldType>(['SHORT_ANSWER', 'PARAGRAPH', 'EMAIL', 'PHONE', 'URL', 'NUMBER', 'LOCATION']);

export function PlaceholderSetting(p: PanelProps) {
  if (!PLACEHOLDER_TYPES.has(p.field.type)) return null;
  return <TextSetting label="Placeholder" value={p.field.placeholder} disabled={!p.canEdit} onCommit={(x) => p.onUpdate({ placeholder: x || null })} />;
}

/** The answer respondents see prefilled. Uses the respondent control itself, so the default looks exactly as it will. */
export function DefaultAnswerSetting(p: PanelProps & { color: string }) {
  const [draft, setDraft] = useState<AnswerValue>(p.field.defaultValue);
  useEffect(() => setDraft(p.field.defaultValue), [p.field.defaultValue]);
  const labelId = useId();
  const Control = FIELD_UI[p.field.type].Input;
  if (!Control || !DEFAULT_ANSWER_TYPES.has(p.field.type)) return null;
  const probe = { ...p.field, required: false };
  const problem = draft === null ? null : validateFieldAnswer(probe, draft);
  const commit = () => {
    if (!problem && !deepEqual(draft, p.field.defaultValue)) p.onUpdate({ defaultValue: draft });
  };
  return (
    <details className="text-sm" open={p.field.defaultValue !== null || undefined}>
      <summary id={labelId} className="cursor-pointer text-muted">
        Default answer
      </summary>
      <div className="mt-2 space-y-2">
        <div
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit();
          }}
        >
          <Control field={probe} value={draft ?? undefined} onChange={setDraft} color={p.color} disabled={!p.canEdit} invalid={!!problem} labelledBy={labelId} variant="classic" uploaded={[]} onUploaded={() => {}} />
        </div>
        {problem && <p className="text-xs text-danger">{problem.message}</p>}
        <Button
          type="button"
          variant="subtle"
          size="sm"
          disabled={!p.canEdit || draft === null}
          onClick={() => {
            setDraft(null);
            p.onUpdate({ defaultValue: null });
          }}
        >
          Clear default
        </Button>
      </div>
    </details>
  );
}

/** Quiz scoring: the correct choice for single-answer questions, points per option for multi-answer ones. */
export function ScorePanel(p: PanelProps) {
  if (!p.quiz) return null;
  const sc = p.field.scoreConfig ?? {};
  const options = p.field.options.filter((o) => o.kind === 'option');
  const points = sc.points ?? 1;
  const setCorrect = (correct: string | boolean | number | undefined) => p.onUpdate({ scoreConfig: correct === undefined || correct === '' ? null : { correct, points } });
  if (p.field.type === 'CHECKBOXES' || p.field.type === 'IMAGE_CHOICE') {
    return (
      <div className="space-y-1 rounded-md bg-surface p-3 text-sm">
        <p className="font-medium">Points per option</p>
        {options.map((o) => (
          <NumberSetting key={o.id} label={o.label} value={sc.optionPoints?.[o.id]} step="any" disabled={!p.canEdit} onChange={(x) => p.onUpdate({ scoreConfig: { optionPoints: clean({ ...sc.optionPoints, [o.id]: x }) } })} />
        ))}
      </div>
    );
  }
  const id = `correct-${p.field.id}`;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface p-3 text-sm">
      <label htmlFor={id}>Correct answer</label>
      {options.length > 0 || p.field.type === 'YES_NO' ? (
        <NativeSelect id={id} disabled={!p.canEdit} value={sc.correct === undefined ? '' : String(sc.correct)} onChange={(e) => setCorrect(p.field.type === 'YES_NO' ? (e.target.value === '' ? undefined : e.target.value === 'true') : e.target.value)}>
          <option value="">No correct answer</option>
          {p.field.type === 'YES_NO'
            ? [
                <option key="t" value="true">Yes</option>,
                <option key="f" value="false">No</option>,
              ]
            : options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
        </NativeSelect>
      ) : (
        <Input
          id={id}
          key={sc.correct === undefined ? '' : String(sc.correct)}
          className="h-8 w-48"
          disabled={!p.canEdit}
          defaultValue={sc.correct === undefined ? '' : String(sc.correct)}
          onBlur={(e) => e.target.value !== (sc.correct === undefined ? '' : String(sc.correct)) && setCorrect(p.field.type === 'NUMBER' && e.target.value !== '' ? Number(e.target.value) : e.target.value)}
        />
      )}
      <NumberSetting label="Points" value={points} step="any" disabled={!p.canEdit || sc.correct === undefined} onChange={(x) => sc.correct !== undefined && p.onUpdate({ scoreConfig: { correct: sc.correct, points: x ?? 1 } })} />
    </div>
  );
}
