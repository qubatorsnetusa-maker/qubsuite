import type { FormDto, FormFieldDto, FormFieldType, UpdateFieldInput } from '@qub/shared';
import { addFieldTx, estimateMinutes, fieldSetTx, formSetTx, QUESTION_TYPES } from '@qub/shared/forms';
import { ArrowRight, Clock, CornerDownLeft, EyeOff, ImageIcon, Plus, Sparkles, Video } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useBuilderOps } from '@/features/forms/builder/ops/builder-ops';
import { pipeSuggestions, PipingInput } from '@/features/forms/builder/piping-input';
import { TypePicker } from '@/features/forms/builder/type-picker';
import { useDebouncedCommit } from '@/features/forms/builder/use-debounced-commit';
import { ContentBlock, FIELD_UI } from '@/features/forms/registry';
import { respondentFormFromDto } from '@/features/forms/renderer/respondent-form';
import { EndingBadgeIcon, themeStyle } from '@/features/forms/renderer/screens';
import { InlineOptions } from './inline-options';
import { questionNumber } from './question-numbers';

const identity = (s: string) => s;
const noop = () => {};

/** Big, borderless text boxes that read as the respondent's typography until focused. */
const TITLE_CLASS = 'min-h-0 resize-none rounded-md border-0 bg-transparent px-2 py-1 -mx-2 text-3xl leading-tight shadow-none [field-sizing:content] hover:bg-black/[0.03] focus:bg-black/[0.04] focus:ring-0 disabled:bg-transparent disabled:opacity-100 sm:text-4xl';
const DESC_CLASS = 'min-h-0 resize-none rounded-md border-0 bg-transparent px-2 py-1 -mx-2 text-lg leading-relaxed text-muted shadow-none [field-sizing:content] hover:bg-black/[0.03] focus:bg-black/[0.04] focus:ring-0 disabled:bg-transparent disabled:opacity-100 sm:text-xl';

/** Titles are single paragraphs: Enter doesn't add a line (it still picks a `{{` suggestion, which handles Enter first). */
const noNewline = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.defaultPrevented) e.preventDefault();
};

/**
 * Centre of the Content tab: the selected question at full size, in the form's theme and the conversational
 * respondent typography, edited in place. Title, description and button text commit through `useDebouncedCommit`
 * (one undo step per typing burst, sealed on blur); choices are edited inline; other answer types show the real
 * respondent control, disabled. With nothing selected it edits the form's title and description, and an empty form
 * prompts for its first question.
 */
export function QuestionCanvas({ form, field, canEdit, onSelect }: { form: FormDto; field: FormFieldDto | null; canEdit: boolean; onSelect(id: string): void }) {
  const style = themeStyle(respondentFormFromDto(form));
  return (
    <div className="flex min-h-full w-full p-3 sm:p-6">
      <div className="flex w-full flex-1 flex-col rounded-2xl bg-white text-foreground shadow-card" style={style}>
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-2xl px-6 py-14 sm:px-12 sm:py-20">
            {field ? (
              <FieldEditor key={field.id} form={form} field={field} canEdit={canEdit} />
            ) : form.fields.length === 0 ? (
              <EmptyForm form={form} canEdit={canEdit} onSelect={onSelect} />
            ) : (
              <FormIntroEditor key={form.id} form={form} canEdit={canEdit} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyForm({ form, canEdit, onSelect }: { form: FormDto; canEdit: boolean; onSelect(id: string): void }) {
  const ops = useBuilderOps();
  const color = form.theme.primaryColor;
  const add = (type: FormFieldType) => {
    const { tx, fieldId } = addFieldTx(form, type, null);
    ops.apply(tx);
    onSelect(fieldId);
  };
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="grid size-14 place-items-center rounded-full text-white" style={{ background: color }} aria-hidden>
        <Sparkles className="size-6" />
      </span>
      <h2 className="text-3xl sm:text-4xl">Start with a question</h2>
      <p className="max-w-md text-lg text-muted">Add your first question to get started. It appears here exactly as respondents will see it, and you edit it in place.</p>
      {canEdit && (
        <TypePicker
          onPick={add}
          trigger={
            <Button type="button" className="h-11 px-6 text-base" style={{ background: color }}>
              <Plus /> Add question
            </Button>
          }
        />
      )}
    </div>
  );
}

function FormIntroEditor({ form, canEdit }: { form: FormDto; canEdit: boolean }) {
  const ops = useBuilderOps();
  const [title, setTitle, flushTitle, resetTitle] = useDebouncedCommit(form.title, (v) => {
    if (v.trim()) ops.apply(formSetTx(form, { title: v }, 'Rename form'), { mergeKey: 'form-title' });
  });
  const [desc, setDesc, flushDesc] = useDebouncedCommit(form.description ?? '', (v) => ops.apply(formSetTx(form, { description: v || null }, 'Edit form description'), { mergeKey: 'form-description' }));
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium uppercase tracking-wider" style={{ color: form.theme.primaryColor }}>
        Form
      </p>
      <div onKeyDown={noNewline}>
        <PipingInput
          multiline
          value={title}
          onChange={setTitle}
          onBlur={() => {
            // A form always has a title: an emptied box isn't saved, so show the stored title again.
            if (!title.trim()) resetTitle();
            else flushTitle();
            ops.seal();
          }}
          disabled={!canEdit}
          placeholder="Untitled form"
          aria-label="Form title"
          suggestions={[]}
          className={TITLE_CLASS}
        />
      </div>
      <PipingInput
        multiline
        value={desc}
        onChange={setDesc}
        onBlur={() => {
          flushDesc();
          ops.seal();
        }}
        disabled={!canEdit}
        placeholder="Description (optional)"
        aria-label="Form description"
        suggestions={[]}
        className={DESC_CLASS}
      />
      <p className="pt-6 text-sm text-muted">Pick a question on the left to edit it here. Form settings are on the right.</p>
    </div>
  );
}

function FieldEditor({ form, field, canEdit }: { form: FormDto; field: FormFieldDto; canEdit: boolean }) {
  const ops = useBuilderOps();
  const def = QUESTION_TYPES[field.type];
  const color = form.theme.primaryColor;
  const update = (input: UpdateFieldInput, label: string, mergeKey?: string) => ops.apply(fieldSetTx(form, field.id, input, label), mergeKey ? { mergeKey } : undefined);
  const [label, setLabel, flushLabel] = useDebouncedCommit(field.label, (v) => update({ label: v }, 'Edit question text', `label:${field.id}`));
  const [desc, setDesc, flushDesc] = useDebouncedCommit(field.description ?? '', (v) => update({ description: v || null }, 'Edit description', `description:${field.id}`));
  const [button, setButton, flushButton] = useDebouncedCommit(field.settings.buttonLabel ?? '', (v) => update({ settings: { buttonLabel: v.trim() ? v : undefined } }, 'Edit button text', `buttonLabel:${field.id}`));
  const sealed = (flush: () => void) => () => {
    flush();
    ops.seal();
  };

  const isWelcome = field.type === 'WELCOME';
  const isEnding = field.type === 'ENDING';
  const isScreen = isWelcome || isEnding;
  const isSection = field.type === 'SECTION';
  const isMedia = field.type === 'IMAGE_BLOCK' || field.type === 'VIDEO_BLOCK';
  const number = questionNumber(form, field.id);
  const suggestions = pipeSuggestions(form, field.id);
  const titleId = `canvas-title-${field.id}`;
  const titleName = isSection ? 'Section title' : isScreen ? 'Screen title' : 'Question text';
  const endingButton = isEnding && !!field.settings.buttonUrl;
  const editableButton = def.settingsKeys.includes('buttonLabel') && (!isEnding || endingButton);
  const hasLaterStep = form.fields.some((f) => f.position > field.position && QUESTION_TYPES[f.type].isStep);

  return (
    <section className="space-y-6" aria-label={def.label}>
      {isEnding && <EndingBadgeIcon badge={field.settings.badgeIcon} color={color} className="size-10" />}
      {(isScreen || field.type === 'STATEMENT') && field.settings.imageUrl && <img src={field.settings.imageUrl} alt={field.settings.imageAlt ?? ''} className="max-h-72 rounded-lg object-contain" />}

      <div className="space-y-3">
        <div className="flex items-start gap-3" onKeyDown={noNewline}>
          {number !== null && (
            <span data-testid="question-number" aria-label={`Question ${number}`} className="flex shrink-0 items-center gap-1 pt-2.5 text-lg font-medium sm:pt-3.5" style={{ color }}>
              {number} <ArrowRight className="size-4" aria-hidden />
            </span>
          )}
          <PipingInput
            id={titleId}
            multiline
            value={label}
            onChange={setLabel}
            onBlur={sealed(flushLabel)}
            disabled={!canEdit}
            placeholder={isWelcome ? form.title || 'Welcome' : isSection ? 'Section title' : isScreen ? 'Screen title' : 'Your question here'}
            aria-label={titleName}
            suggestions={suggestions}
            className={TITLE_CLASS}
          />
          {field.required && (
            <span className="pt-2 text-3xl text-danger" aria-hidden="true">
              *
            </span>
          )}
        </div>

        {!isMedia && (
          <PipingInput
            multiline
            value={desc}
            onChange={setDesc}
            onBlur={sealed(flushDesc)}
            disabled={!canEdit}
            placeholder="Description (optional)"
            aria-label="Description"
            suggestions={suggestions}
            className={DESC_CLASS}
          />
        )}
      </div>

      <AnswerArea form={form} field={field} canEdit={canEdit} labelledBy={titleId} onOptions={(i) => update(i, 'Edit choices')} />

      {(!isEnding || endingButton) && !isSection && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {editableButton ? (
            <input
              value={button}
              onChange={(e) => setButton(e.target.value)}
              onBlur={sealed(flushButton)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              disabled={!canEdit}
              maxLength={60}
              aria-label="Button text"
              placeholder={isWelcome ? 'Start' : 'Continue'}
              size={Math.max(button.length, isWelcome ? 5 : 8) + 1}
              className="h-11 rounded-full px-5 text-center text-base font-medium text-white shadow-sm outline-none placeholder:text-white/70 focus:ring-4 focus:ring-black/10 disabled:cursor-default"
              style={{ background: color }}
            />
          ) : (
            <span aria-hidden className="inline-flex h-11 items-center rounded-full px-5 text-base font-medium text-white shadow-sm" style={{ background: color }}>
              {def.isInput ? (hasLaterStep ? 'Next' : 'Submit') : 'Continue'}
            </span>
          )}
          {isWelcome && form.settings.showTimeEstimate ? (
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Clock className="size-4" aria-hidden /> Takes about {estimateMinutes(form.fields)} minute{estimateMinutes(form.fields) === 1 ? '' : 's'}
            </span>
          ) : (
            !isWelcome && !isEnding && (
              <span aria-hidden className="hidden items-center gap-1 text-xs text-muted sm:flex">
                press <strong>Enter</strong> <CornerDownLeft className="size-3" />
              </span>
            )
          )}
        </div>
      )}
    </section>
  );
}

/** What goes under the question: inline choices, the disabled respondent control, or a content block's media. */
function AnswerArea({ form, field, canEdit, labelledBy, onOptions }: { form: FormDto; field: FormFieldDto; canEdit: boolean; labelledBy: string; onOptions(i: UpdateFieldInput): void }) {
  const def = QUESTION_TYPES[field.type];
  const color = form.theme.primaryColor;
  if (def.optionKinds.length > 0) return <InlineOptions field={field} canEdit={canEdit} color={color} onUpdate={onOptions} />;
  if (field.type === 'IMAGE_BLOCK' || field.type === 'VIDEO_BLOCK') {
    const url = field.type === 'IMAGE_BLOCK' ? field.settings.imageUrl : field.settings.videoUrl;
    if (url) return <ContentBlock field={field} pipe={identity} />;
    const Icon = field.type === 'IMAGE_BLOCK' ? ImageIcon : Video;
    return (
      <MediaHint icon={<Icon className="size-8" aria-hidden />}>
        Add the {field.type === 'IMAGE_BLOCK' ? 'image' : 'video'} link in the settings panel.
      </MediaHint>
    );
  }
  if (field.type === 'HIDDEN') {
    return <MediaHint icon={<EyeOff className="size-8" aria-hidden />}>Hidden field — filled from the form link. Respondents never see it.</MediaHint>;
  }
  const Control = FIELD_UI[field.type].Input;
  if (!def.isInput || !Control) return null;
  return (
    // Answers typed here go nowhere: the control is disabled and shown only so the question looks as it will.
    <div role="region" aria-label="Answer preview" className="pointer-events-none select-none">
      <Control field={field} value={field.defaultValue ?? undefined} onChange={noop} color={color} disabled labelledBy={labelledBy} variant="conversational" uploaded={[]} onUploaded={noop} />
    </div>
  );
}

function MediaHint({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-black/15 text-muted">
      {icon}
      <p className="text-sm">{children}</p>
    </div>
  );
}
