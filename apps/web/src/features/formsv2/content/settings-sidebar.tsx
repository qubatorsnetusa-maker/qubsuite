import type { FormDto, FormFieldDto, FormFieldType, UpdateFieldInput } from '@qub/shared';
import { cannotBeRequired, DEFAULT_ANSWER_TYPES, fieldSetTx, QUESTION_TYPE_LIST, QUESTION_TYPES } from '@qub/shared/forms';
import { GitBranch, Settings2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Switch } from '@/components/ui/form-controls';
import { canBranch } from '@/features/forms/builder/can-branch';
import { FormSettingsFields } from '@/features/forms/builder/form-settings-dialog';
import { LogicPanel } from '@/features/forms/builder/logic-tab';
import { useBuilderOps } from '@/features/forms/builder/ops/builder-ops';
import { DefaultAnswerSetting, PlaceholderSetting, ScorePanel, SETTINGS_PANELS } from '@/features/forms/builder/settings-panels';
import { ThemeButton } from '@/features/forms/builder/theme-button';
import { FIELD_UI } from '@/features/forms/registry';
import { ExtraSettings } from './extra-settings';
import { Section } from './sidebar-section';

/** Types a question can be converted to (same list as the classic editor's type dropdown). */
const CONVERTIBLE = QUESTION_TYPE_LIST.filter((d) => !['SECTION', 'WELCOME', 'ENDING'].includes(d.type));

/** Restyles the logic editor's dialog as a full-height sheet sliding in from the right. Reused by the Workflow tab. */
export const SHEET_CLASS = 'left-auto right-0 top-0 h-dvh max-h-none w-full max-w-xl translate-x-0 translate-y-0 rounded-none rounded-l-xl';

/**
 * Right panel of the Content tab: settings for the selected question (type, Required, the type's settings panels,
 * placeholder, default answer, scoring in quiz mode, logic, key), or the form's settings and theme when nothing is
 * selected. Every change is a builder operation; viewers see everything disabled.
 */
export function SettingsSidebar({ form, field, canEdit, onShowFormSettings }: { form: FormDto; field: FormFieldDto | null; canEdit: boolean; onShowFormSettings?(): void }) {
  return field ? <FieldSettings key={field.id} form={form} field={field} canEdit={canEdit} onShowFormSettings={onShowFormSettings} /> : <FormSettings form={form} canEdit={canEdit} />;
}

function FormSettings({ form, canEdit }: { form: FormDto; canEdit: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-base font-medium">Form settings</h2>
        {canEdit && <ThemeButton form={form} />}
      </div>
      <div className="px-4 py-4">
        <FormSettingsFields form={form} disabled={!canEdit} />
      </div>
    </div>
  );
}

function FieldSettings({ form, field, canEdit, onShowFormSettings }: { form: FormDto; field: FormFieldDto; canEdit: boolean; onShowFormSettings?(): void }) {
  const ops = useBuilderOps();
  const [logicOpen, setLogicOpen] = useState(false);
  const typeId = useId();
  const keyId = useId();
  const def = QUESTION_TYPES[field.type];
  const Icon = FIELD_UI[field.type].icon;
  const update = (input: UpdateFieldInput, label = 'Change settings') => ops.apply(fieldSetTx(form, field.id, input, label));
  const isScreen = field.type === 'WELCOME' || field.type === 'ENDING';
  const isSection = field.type === 'SECTION';
  const convertible = !isScreen && !isSection;
  const branchable = canBranch(field);
  const Panel = SETTINGS_PANELS[field.type];
  const panelProps = { field, canEdit, onUpdate: (i: UpdateFieldInput) => update(i) };
  const rules = field.rules.length;

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid size-7 place-items-center rounded-md bg-surface text-muted" aria-hidden>
          <Icon className="size-4" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-base font-medium">{def.label}</h2>
        {onShowFormSettings && (
          <Button type="button" variant="ghost" size="sm" onClick={onShowFormSettings}>
            <Settings2 /> Form settings
          </Button>
        )}
      </div>

      <Section title="Question">
        <label htmlFor={typeId} className="block text-sm text-muted">
          Type
        </label>
        <NativeSelect id={typeId} aria-label="Question type" className="w-full" value={field.type} disabled={!canEdit || !convertible} onChange={(e) => update({ type: e.target.value as FormFieldType }, 'Change question type')}>
          {(convertible ? CONVERTIBLE : [def]).map((d) => (
            <option key={d.type} value={d.type}>
              {d.label}
            </option>
          ))}
        </NativeSelect>
        {!cannotBeRequired(field.type) && (
          <label className="flex items-center justify-between gap-4 pt-1 text-sm">
            <span className="font-medium">Required</span>
            <Switch aria-label="Required" checked={field.required} disabled={!canEdit} onCheckedChange={(v) => update({ required: v }, v ? 'Make required' : 'Make optional')} />
          </label>
        )}
      </Section>

      {(Panel || DEFAULT_ANSWER_TYPES.has(field.type)) && (
        <Section title="Settings">
          {Panel && <Panel {...panelProps} />}
          <PlaceholderSetting {...panelProps} />
          <DefaultAnswerSetting {...panelProps} onUpdate={(i) => update(i, 'Change default answer')} color={form.theme.primaryColor} />
        </Section>
      )}

      {def.isInput && form.settings.quiz?.enabled && (
        <Section title="Scoring">
          <ScorePanel {...panelProps} onUpdate={(i) => update(i, 'Change scoring')} quiz />
        </Section>
      )}

      {branchable && (
        <Section title="Logic">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm">
              <GitBranch className="size-4 text-muted" aria-hidden />
              {rules === 0 ? 'No rules' : `${rules} rule${rules === 1 ? '' : 's'}`}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={!canEdit} onClick={() => setLogicOpen(true)}>
              Edit logic
            </Button>
          </div>
        </Section>
      )}

      {!isSection && (
        <Section title="Advanced">
          <label htmlFor={keyId} className="block text-sm text-muted">
            Key for {'{{…}}'} and formulas
          </label>
          <Input
            id={keyId}
            aria-label="Question key"
            className="h-8 font-mono"
            disabled={!canEdit}
            defaultValue={field.ref}
            key={field.ref}
            onBlur={(e) => e.target.value !== field.ref && update({ ref: e.target.value }, 'Change key')}
          />
        </Section>
      )}

      <ExtraSettings form={form} field={field} canEdit={canEdit} />

      {logicOpen && <LogicPanel form={form} field={field} onClose={() => setLogicOpen(false)} className={SHEET_CLASS} />}
    </div>
  );
}
