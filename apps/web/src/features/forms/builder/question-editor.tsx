import type { FormDto, FormFieldDto, FormFieldType, UpdateFieldInput } from '@qub/shared';
import { duplicateFieldTx, fieldSetTx, QUESTION_TYPE_LIST, QUESTION_TYPES, type DefinitionIssue } from '@qub/shared/forms';
import { Copy, GitBranch, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Switch } from '@/components/ui/form-controls';
import { Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { canBranch } from './can-branch';
import { LogicPanel } from './logic-tab';
import { useBuilderOps } from './ops/builder-ops';
import { OptionsEditor } from './options-editor';
import { pipeSuggestions, PipingInput } from './piping-input';
import { DefaultAnswerSetting, PlaceholderSetting, ScorePanel, SETTINGS_PANELS } from './settings-panels';
import { useDebouncedCommit } from './use-debounced-commit';
import { useDeleteQuestion } from './use-delete-question';

export { ANSWER_COUNT_TIMEOUT_MS } from './use-delete-question';

export function QuestionEditor({
  form,
  field,
  active,
  onActivate,
  canEdit,
  issues,
}: {
  form: FormDto;
  field: FormFieldDto;
  active: boolean;
  onActivate(): void;
  canEdit: boolean;
  issues?: DefinitionIssue[];
}) {
  const ops = useBuilderOps();
  const update = (input: UpdateFieldInput, label?: string, mergeKey?: string) => ops.apply(fieldSetTx(form, field.id, input, label), mergeKey ? { mergeKey } : undefined);
  const [label, setLabel, flushLabel] = useDebouncedCommit(field.label, (v) => update({ label: v }, 'Edit question text', `label:${field.id}`));
  const [desc, setDesc, flushDesc] = useDebouncedCommit(field.description ?? '', (v) => update({ description: v || null }, 'Edit description', `description:${field.id}`));
  const def = QUESTION_TYPES[field.type];
  // Asks first when the question has collected answers (Undo won't bring them back).
  const { remove, checking, dialog: deleteDialog } = useDeleteQuestion(form);
  const duplicate = () => ops.apply(duplicateFieldTx(form, field.id)?.tx ?? null);
  const [logicOpen, setLogicOpen] = useState(false);
  const isScreen = field.type === 'WELCOME' || field.type === 'ENDING';
  const isSection = field.type === 'SECTION';
  const hasLogic = field.rules.length > 0;
  const branchable = canBranch(field);

  return (
    <section
      id={`q-${field.id}`}
      onClick={onActivate}
      className={cn('relative rounded-lg bg-background shadow-card transition-shadow', active && 'shadow-pop', isSection && 'mt-8')}
      aria-label={isSection ? `Section ${field.label}` : `Question ${field.label}`}
    >
      {active && <span className="absolute inset-y-0 left-0 w-1.5 rounded-l-lg bg-[#4285f4]" aria-hidden />}
      {isSection && <div className="rounded-t-lg px-6 py-2 text-sm text-white" style={{ background: 'var(--color-form)' }}>Section</div>}
      {isScreen && <div className="rounded-t-lg bg-[#3c4043] px-6 py-2 text-sm text-white">{def.label}</div>}
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-start gap-3">
          <PipingInput
            value={label}
            onChange={setLabel}
            onBlur={() => {
              flushLabel();
              ops.seal();
            }}
            disabled={!canEdit}
            placeholder={isSection ? 'Section title' : isScreen ? 'Screen title' : 'Question'}
            aria-label={isSection ? 'Section title' : isScreen ? 'Screen title' : 'Question text'}
            suggestions={pipeSuggestions(form, field.id)}
            className={cn('border-0 border-b bg-surface px-3 text-base', isSection && 'text-xl')}
          />
          {!isSection && !isScreen && (
            <NativeSelect aria-label="Question type" value={field.type} disabled={!canEdit} onChange={(e) => update({ type: e.target.value as FormFieldType }, 'Change question type')} className="h-10 w-48">
              {QUESTION_TYPE_LIST.filter((d) => !['SECTION', 'WELCOME', 'ENDING'].includes(d.type)).map((d) => (
                <option key={d.type} value={d.type}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
        {(active || desc) && (
          <PipingInput
            value={desc}
            onChange={setDesc}
            onBlur={() => {
              flushDesc();
              ops.seal();
            }}
            disabled={!canEdit}
            placeholder="Description (optional)"
            aria-label="Description"
            multiline
            suggestions={pipeSuggestions(form, field.id)}
            className="min-h-10 text-sm"
          />
        )}

        {def.optionKinds.length > 0 && <OptionsEditor field={field} canEdit={canEdit} onUpdate={(i) => update(i)} />}
        {(() => {
          const Panel = SETTINGS_PANELS[field.type];
          return Panel ? <Panel field={field} canEdit={canEdit} onUpdate={(i) => update(i)} /> : null;
        })()}
        {active && <PlaceholderSetting field={field} canEdit={canEdit} onUpdate={(i) => update(i)} />}
        {active && <DefaultAnswerSetting field={field} canEdit={canEdit} onUpdate={(i) => update(i, 'Change default answer')} color={form.theme.primaryColor} />}
        {active && def.isInput && <ScorePanel field={field} canEdit={canEdit} onUpdate={(i) => update(i)} quiz={form.settings.quiz.enabled} />}
        {active && !isSection && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Advanced</summary>
            <label className="mt-2 flex items-center gap-2 text-muted">
              Key for {'{{…}}'} and formulas
              <Input className="h-8 w-48 font-mono" disabled={!canEdit} defaultValue={field.ref} key={field.ref} aria-label="Question key" onBlur={(e) => e.target.value !== field.ref && update({ ref: e.target.value }, 'Change key')} />
            </label>
          </details>
        )}
        {issues && issues.some((i) => i.severity === 'error') && (
          <ul role="alert" className="space-y-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {issues.filter((i) => i.severity === 'error').map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        )}
        {issues && issues.some((i) => i.severity === 'warning') && (
          <ul className="space-y-1 rounded-md bg-[#fef7e0] px-3 py-2 text-sm text-warning">
            {issues.filter((i) => i.severity === 'warning').map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        )}

        {hasLogic && (
          <p className="flex items-center gap-2 text-xs text-form">
            <GitBranch className="size-4" /> {field.rules.length} logic rule{field.rules.length > 1 ? 's' : ''}
          </p>
        )}

        {canEdit && active && (
          <footer className="flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3">
            {branchable && (
              <Button variant="subtle" size="sm" onClick={() => setLogicOpen(true)}>
                <GitBranch /> Logic
              </Button>
            )}
            {field.type !== 'WELCOME' && (
              <Tooltip content="Duplicate">
                <Button variant="subtle" size="icon-sm" onClick={duplicate} aria-label="Duplicate">
                  <Copy />
                </Button>
              </Tooltip>
            )}
            <Tooltip content="Delete">
              <Button variant="subtle" size="icon-sm" onClick={() => void remove(field.id)} disabled={checking} aria-label="Delete">
                <Trash2 />
              </Button>
            </Tooltip>
            {def.isInput && field.type !== 'HIDDEN' && (
              <>
                <span className="mx-2 h-6 w-px bg-border" />
                <label className="flex items-center gap-2 text-sm">
                  Required <Switch checked={field.required} onCheckedChange={(v) => update({ required: v }, v ? 'Make required' : 'Make optional')} />
                </label>
              </>
            )}
          </footer>
        )}
      </div>
      {logicOpen && <LogicPanel form={form} field={field} onClose={() => setLogicOpen(false)} />}
      {deleteDialog}
    </section>
  );
}
