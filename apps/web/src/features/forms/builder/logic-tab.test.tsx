import type { Condition, FormDto, FormFieldDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LogicPanel } from './logic-tab';
import { renderWithOps } from './ops/test-utils';

const f = (id: string, type: FormFieldDto['type'], label: string, position: number, extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
  id, ref: id, type, label, description: null, required: false, position, validation: {}, settings: {}, options: [], rules: [], placeholder: null, defaultValue: null, scoreConfig: null, ...extra,
});
const form = {
  id: 'form1',
  settings: { ...DEFAULT_FORM_SETTINGS },
  variables: [{ id: 'v1', key: 'total', type: 'NUMBER', initialValue: 0, formula: null, position: 0 }],
  fields: [
    f('age', 'NUMBER', 'Age', 0),
    f('q2', 'SHORT_ANSWER', 'Why?', 1),
    f('q3', 'SHORT_ANSWER', 'Anything else?', 2),
    f('end', 'ENDING', 'Bye', 3),
  ],
} as unknown as FormDto;

describe('LogicPanel', () => {
  it('saves an "IF age < 18 THEN end at ending" rule in the v2 shape', async () => {
    const { apply } = renderWithOps(<LogicPanel form={form} field={form.fields[0]!} onClose={() => {}} />, { form });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add rule' }));
    await user.selectOptions(screen.getByLabelText('Operator 1'), 'lt');
    await user.type(screen.getByLabelText('Value 1'), '18');
    await user.selectOptions(screen.getByLabelText('Then'), 'END_FORM');
    await user.selectOptions(screen.getByLabelText('Ending'), 'end');
    // Jump targets only list later steps.
    await user.selectOptions(screen.getByLabelText('Then'), 'JUMP_TO_FIELD');
    // “Choose…” + the two later questions; the ending and the current question are not jump targets.
    expect(screen.getByLabelText('Question').querySelectorAll('option')).toHaveLength(3);
    expect(screen.getByLabelText('Question')).not.toHaveTextContent('Age');
    await user.selectOptions(screen.getByLabelText('Then'), 'END_FORM');
    await user.selectOptions(screen.getByLabelText('Ending'), 'end');
    await user.click(screen.getByRole('button', { name: 'Save logic' }));
    const tx = apply.mock.calls.at(-1)![0];
    expect(tx.ops[0]).toMatchObject({ kind: 'set', entity: 'field', id: 'age' });
    expect(tx.ops[0].changes.rules.to).toMatchObject([
      { trigger: 'ON_LEAVE', scope: 'FIELD', condition: { all: [{ subject: { type: 'field', id: 'age' }, op: 'lt', value: 18 }] }, action: 'END_FORM', targetFieldId: 'end', targetSectionId: null, targetVariableId: null, payload: null },
    ]);
  });

  it('keeps a VISIBILITY rule deeper than the editor supports untouched when only the ON_LEAVE rule is edited', async () => {
    const deepCondition: Condition = { all: [{ any: [{ all: [{ subject: { type: 'field', id: 'q2' }, op: 'answered' }] }] }] };
    const fieldWithRules: FormFieldDto = {
      ...form.fields[0]!,
      rules: [
        { id: 'r1', fieldId: 'age', trigger: 'VISIBILITY', scope: 'FIELD', condition: deepCondition, action: 'SHOW', targetFieldId: null, targetSectionId: null, targetVariableId: null, payload: null, position: 0, operator: null, value: null },
        { id: 'r2', fieldId: 'age', trigger: 'ON_LEAVE', scope: 'FIELD', condition: { all: [{ subject: { type: 'field', id: 'age' }, op: 'lt', value: 18 }] }, action: 'END_FORM', targetFieldId: 'end', targetSectionId: null, targetVariableId: null, payload: null, position: 0, operator: null, value: null },
      ],
    };
    const formWithField: FormDto = { ...form, fields: [fieldWithRules, form.fields[1]!, form.fields[2]!, form.fields[3]!] };
    const { apply } = renderWithOps(<LogicPanel form={formWithField} field={fieldWithRules} onClose={() => {}} />, { form: formWithField });
    expect(screen.getByText('Advanced condition — edit via the API.')).toBeInTheDocument();
    const user = userEvent.setup();
    // Edit only the ON_LEAVE rule.
    await user.selectOptions(screen.getByLabelText('Operator 1'), 'lte');
    await user.click(screen.getByRole('button', { name: 'Save logic' }));
    const tx = apply.mock.calls.at(-1)![0];
    expect(tx.ops[0]).toMatchObject({ kind: 'set', entity: 'field', id: 'age' });
    expect(tx.ops[0].changes.rules.to).toMatchObject([
      { trigger: 'VISIBILITY', scope: 'FIELD', condition: deepCondition, action: 'SHOW', targetFieldId: null, targetSectionId: null, targetVariableId: null, payload: null },
      { trigger: 'ON_LEAVE', scope: 'FIELD', condition: { all: [{ subject: { type: 'field', id: 'age' }, op: 'lte', value: 18 }] }, action: 'END_FORM', targetFieldId: 'end', targetSectionId: null, targetVariableId: null, payload: null },
    ]);
  });

  it('saves HIDE rules and additional SHOW rules back unchanged', async () => {
    const answered = (id: string): Condition => ({ all: [{ subject: { type: 'field', id }, op: 'answered' }] });
    const base = { targetFieldId: null, targetSectionId: null, targetVariableId: null, payload: null, operator: null, value: null, fieldId: 'q3', scope: 'FIELD' as const, trigger: 'VISIBILITY' as const };
    const fieldWithRules: FormFieldDto = {
      ...form.fields[2]!,
      rules: [
        { ...base, id: 'r1', condition: answered('age'), action: 'SHOW', position: 0 },
        { ...base, id: 'r2', condition: answered('q2'), action: 'HIDE', position: 1 },
        { ...base, id: 'r3', condition: { any: [] }, action: 'SHOW', position: 2 },
      ],
    };
    const formWithField: FormDto = { ...form, fields: [form.fields[0]!, form.fields[1]!, fieldWithRules, form.fields[3]!] };
    const { apply } = renderWithOps(<LogicPanel form={formWithField} field={fieldWithRules} onClose={() => {}} />, { form: formWithField });
    expect(screen.getByText('2 more show/hide rules — kept as is; edit via the API.')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Always show' }));
    await user.click(screen.getByRole('button', { name: 'Save logic' }));
    const strip = { targetFieldId: null, targetSectionId: null, targetVariableId: null, payload: null, scope: 'FIELD', trigger: 'VISIBILITY' };
    const tx = apply.mock.calls.at(-1)![0];
    expect(tx.ops[0]).toMatchObject({ kind: 'set', entity: 'field', id: 'q3' });
    expect(tx.ops[0].changes.rules.to).toMatchObject([
      { ...strip, condition: answered('q2'), action: 'HIDE' },
      { ...strip, condition: { any: [] }, action: 'SHOW' },
    ]);
  });
});
