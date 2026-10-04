import type { FormDto, UpdateFormInput } from '@qub/shared';
import { formSetTx } from '@qub/shared/forms';
import { useEffect, useId, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label, Switch, Textarea } from '@/components/ui/form-controls';
import { useBuilderOps } from './ops/builder-ops';

export function FormSettingsDialog({ form, open, onOpenChange }: { form: FormDto; open: boolean; onOpenChange(o: boolean): void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Settings" className="max-w-lg">
        <FormSettingsFields form={form} />
      </DialogContent>
    </Dialog>
  );
}

/** The form-wide settings (responses, layout, progress, quiz…), each change applied as a form operation. */
export function FormSettingsFields({ form, disabled }: { form: FormDto; disabled?: boolean }) {
  const ops = useBuilderOps();
  const save = (input: UpdateFormInput) => ops.apply(formSetTx(form, input, 'Change settings'));
  const s = form.settings;
  const confirmId = useId();
  const [message, setMessage] = useState(s.confirmationMessage);
  // Show the current message after undo, redo or someone else's edit.
  useEffect(() => setMessage(s.confirmationMessage), [s.confirmationMessage]);
  const toggles = useMemo(
    () =>
      [
        ['collectEmail', 'Collect email addresses', 'Respondents enter their email (or it’s taken from their account).'],
        ['requireSignIn', 'Require sign-in', 'Only signed-in Qub users can respond.'],
        ['limitOneResponse', 'Limit to 1 response', 'Requires sign-in; each person can submit once.'],
        ['showProgressBar', 'Show progress bar', 'For multi-section forms.'],
      ] as const,
    [],
  );
  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-4 rounded-lg bg-surface p-3">
        <span>
          <span className="block text-sm font-medium">Accepting responses</span>
          <span className="text-xs text-muted">Turn off to close the form.</span>
        </span>
        <Switch checked={form.acceptingResponses} disabled={disabled} onCheckedChange={(v) => save({ acceptingResponses: v })} />
      </label>
      {toggles.map(([key, label, hint]) => (
        <label key={key} className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">{label}</span>
            <span className="text-xs text-muted">{hint}</span>
          </span>
          <Switch checked={!!s[key]} disabled={disabled} onCheckedChange={(v) => save({ settings: { [key]: v } })} />
        </label>
      ))}
      <div>
        <Label htmlFor={confirmId}>Confirmation message</Label>
        <Textarea id={confirmId} className="mt-1.5" value={message} disabled={disabled} onChange={(e) => setMessage(e.target.value)} onBlur={() => message !== s.confirmationMessage && save({ settings: { confirmationMessage: message } })} />
      </div>
      <fieldset className="space-y-2 rounded-lg bg-surface p-3">
        <legend className="text-sm font-medium">Layout</legend>
        {(
          [
            ['classic', 'Classic', 'Pages of questions, like Google Forms.'],
            ['conversational', 'One question at a time', 'Full-screen, keyboard-friendly, like Typeform.'],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="flex items-start gap-2 text-sm">
            <input type="radio" name="layout" className="mt-1" checked={s.layout === value} disabled={disabled} onChange={() => save({ settings: { layout: value } })} />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="text-xs text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {(
        [
          ['showTimeEstimate', 'Show time estimate', 'On the welcome screen.'],
          ['autoAdvance', 'Move on after a choice', 'One-question layout: go to the next question after a single choice.'],
          ['saveProgress', 'Save unfinished answers', 'Respondents can continue later on the same device.'],
        ] as const
      ).map(([key, label, hint]) => (
        <label key={key} className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">{label}</span>
            <span className="text-xs text-muted">{hint}</span>
          </span>
          <Switch checked={!!s[key]} disabled={disabled} onCheckedChange={(v) => save({ settings: { [key]: v } })} />
        </label>
      ))}
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">Quiz mode</span>
          <span className="text-xs text-muted">Score answers. Correct answers are never sent to respondents.</span>
        </span>
        <Switch checked={s.quiz.enabled} disabled={disabled} onCheckedChange={(v) => save({ settings: { quiz: { ...s.quiz, enabled: v } } })} />
      </label>
      {s.quiz.enabled && (
        <label className="flex items-center justify-between gap-4 pl-4">
          <span className="text-sm">Show the score after submitting</span>
          <Switch checked={s.quiz.showScore} disabled={disabled} onCheckedChange={(v) => save({ settings: { quiz: { ...s.quiz, showScore: v } } })} />
        </label>
      )}
    </div>
  );
}
