import { describe, expect, it } from 'vitest';
import { makeField, makeForm, makeVariable, uid } from './__fixtures__/form-dto';
import type { OpTx } from './ops';
import { QUESTION_TYPES } from './registry';
import {
  assignFreshKeys,
  changeFieldType,
  DEFAULT_ANSWER_TYPES,
  defaultOptionsFor,
  fieldStateProblem,
  formStateProblem,
  txProblem,
} from './ops-validate';

const A = uid(1), B = uid(2), C = uid(3);
const opt = (n: number, label: string, kind: 'option' | 'row' | 'column' = 'option') => ({ id: uid(100 + n), label, kind, imageUrl: null, value: null, position: n });
let ids = 200;
const makeId = () => uid(ids++);

describe('defaults and type changes', () => {
  it('seeds options per type', () => {
    expect(defaultOptionsFor('MULTIPLE_CHOICE')).toEqual([{ label: 'Option 1', kind: 'option' }]);
    expect(defaultOptionsFor('RANKING')).toHaveLength(2);
    expect(defaultOptionsFor('MATRIX').map((o) => o.kind)).toEqual(['row', 'row', 'column', 'column']);
    expect(defaultOptionsFor('SHORT_ANSWER')).toEqual([]);
  });

  it('lists exactly the types that take a default answer', () => {
    expect([...DEFAULT_ANSWER_TYPES].sort()).toEqual(
      ['ADDRESS', 'CHECKBOXES', 'DATE', 'DATETIME', 'DROPDOWN', 'EMAIL', 'EMOJI_RATING', 'IMAGE_CHOICE', 'LINEAR_SCALE', 'LOCATION', 'MATRIX', 'MULTIPLE_CHOICE', 'NPS', 'NUMBER', 'OPINION_SCALE', 'PARAGRAPH', 'PHONE', 'RANKING', 'RATING', 'SHORT_ANSWER', 'SLIDER', 'TIME', 'URL', 'YES_NO'].sort(),
    );
  });

  it('drops options and legacy rules when switching to a type without options', () => {
    const f = makeField(A, 'MULTIPLE_CHOICE', 0, {
      options: [opt(1, 'Yes')],
      defaultValue: uid(101),
      rules: [
        { id: uid(50), fieldId: A, operator: 'EQUALS', value: uid(101), trigger: 'ON_LEAVE', scope: 'SECTION', condition: { subject: { type: 'field', id: A }, op: 'eq', value: uid(101) }, action: 'SUBMIT_FORM', targetSectionId: null, targetFieldId: null, targetVariableId: null, payload: null, position: 0 },
        { id: uid(51), fieldId: A, operator: null, value: null, trigger: 'ON_LEAVE', scope: 'FIELD', condition: { all: [] }, action: 'END_FORM', targetSectionId: null, targetFieldId: null, targetVariableId: null, payload: null, position: 1 },
      ],
    });
    const next = changeFieldType(f, 'SHORT_ANSWER', makeId);
    expect(next).toMatchObject({ type: 'SHORT_ANSWER', options: [], validation: {}, defaultValue: uid(101) });
    expect(next.rules.map((r) => r.id)).toEqual([uid(51)]);
    expect(changeFieldType(f, 'NUMBER', makeId).defaultValue).toBeNull();
  });

  it('keeps compatible options, seeds new ones otherwise, and clears required on non-input types', () => {
    const mc = makeField(A, 'MULTIPLE_CHOICE', 0, { options: [opt(1, 'Yes')], required: true });
    expect(changeFieldType(mc, 'DROPDOWN', makeId).options.map((o) => o.label)).toEqual(['Yes']);
    expect(changeFieldType(mc, 'MATRIX', makeId).options.map((o) => o.kind)).toEqual(['row', 'row', 'column', 'column']);
    expect(changeFieldType(mc, 'STATEMENT', makeId).required).toBe(false);
    expect(changeFieldType(makeField(A, 'SHORT_ANSWER', 0), 'RATING', makeId).settings).toEqual(QUESTION_TYPES.RATING.defaultSettings);
  });
});

describe('fieldStateProblem', () => {
  it.each([
    ['ok', makeField(A, 'SHORT_ANSWER', 0), null],
    ['setting for another type', makeField(A, 'SHORT_ANSWER', 0, { settings: { scaleMax: 5 } }), '“scaleMax” doesn’t apply to Short answer questions.'],
    ['min length above max', makeField(A, 'SHORT_ANSWER', 0, { validation: { minLength: 5, maxLength: 2 } }), 'Minimum length cannot exceed maximum length.'],
    ['min above max', makeField(A, 'NUMBER', 0, { validation: { min: 5, max: 2 } }), 'Minimum cannot exceed maximum.'],
    ['unsafe pattern', makeField(A, 'SHORT_ANSWER', 0, { validation: { pattern: '(a+)+$' } }), 'This pattern is invalid or too slow to check safely.'],
    ['slider range', makeField(A, 'SLIDER', 0, { settings: { rangeMin: 5, rangeMax: 5 } }), 'The slider minimum must be below the maximum.'],
    ['emoji scale', makeField(A, 'EMOJI_RATING', 0, { settings: { scaleMax: 4 } }), 'Emoji ratings use a 3- or 5-point scale.'],
    ['required statement', makeField(A, 'STATEMENT', 0, { required: true }), 'Statement can’t be required.'],
    ['options on text', makeField(A, 'SHORT_ANSWER', 0, { options: [opt(1, 'x')] }), 'Short answer questions don’t have options.'],
    ['wrong option kind', makeField(A, 'MULTIPLE_CHOICE', 0, { options: [opt(1, 'x', 'row')] }), 'Multiple choice questions don’t use row options.'],
    ['hidden default', makeField(A, 'HIDDEN', 0, { defaultValue: 'x' }), 'Hidden fields take their value from the link, so they can’t have a default.'],
    ['consent default', makeField(A, 'CONSENT', 0, { defaultValue: true }), 'Consent questions can’t have a default answer.'],
    ['invalid default', makeField(A, 'EMAIL', 0, { defaultValue: 'nope' }), 'Default value: Enter a valid email address'],
  ])('%s', (_name, field, expected) => {
    expect(fieldStateProblem(field)).toBe(expected);
  });

  it('rejects a field snapshot with an unrecognized key', () => {
    const field = { ...makeField(A, 'SHORT_ANSWER', 0), extra: 'nope' };
    expect(fieldStateProblem(field as unknown as ReturnType<typeof makeField>)).not.toBeNull();
  });

  it('rejects a rule missing a required key (no defaulting on a snapshot)', () => {
    const rule = { id: uid(50), fieldId: A, operator: null, value: null, scope: 'FIELD' as const, condition: { all: [] }, action: 'END_FORM' as const, targetSectionId: null, targetFieldId: null, targetVariableId: null, payload: null, position: 0 };
    const field = makeField(A, 'SHORT_ANSWER', 0, { rules: [rule as unknown as ReturnType<typeof makeField>['rules'][number]] });
    expect(fieldStateProblem(field)).not.toBeNull();
  });
});

describe('formStateProblem', () => {
  const q = (id: string, type: Parameters<typeof makeField>[1], pos: number, extra = {}) => makeField(id, type, pos, extra);
  it('accepts a normal form', () => {
    expect(formStateProblem(makeForm([q(A, 'WELCOME', 0), q(B, 'SHORT_ANSWER', 1), q(C, 'ENDING', 2)]))).toBeNull();
  });
  it('keeps welcome first and endings last', () => {
    expect(formStateProblem(makeForm([q(B, 'SHORT_ANSWER', 0), q(A, 'WELCOME', 1)]))).toBe('Welcome screens stay first and ending screens stay last.');
    expect(formStateProblem(makeForm([q(C, 'ENDING', 0), q(B, 'SHORT_ANSWER', 1)]))).toBe('Welcome screens stay first and ending screens stay last.');
    expect(formStateProblem(makeForm([q(A, 'WELCOME', 0), q(B, 'WELCOME', 1)]))).toBe('A form can have only one welcome screen.');
  });
  it('requires unique keys across questions and variables, case-insensitively', () => {
    expect(formStateProblem(makeForm([q(A, 'SHORT_ANSWER', 0, { ref: 'name' }), q(B, 'SHORT_ANSWER', 1, { ref: 'Name' })]))).toBe('The key “Name” is already used in this form.');
    expect(formStateProblem(makeForm([q(A, 'SHORT_ANSWER', 0, { ref: 'total' })], { variables: [makeVariable(uid(10), 'TOTAL', 0)] }))).toBe('The key “TOTAL” is already used in this form.');
  });
  it('rejects rules that target missing questions or computed variables', () => {
    const rule = (extra: object) => ({ id: uid(60), fieldId: A, operator: null, value: null, trigger: 'ON_LEAVE' as const, scope: 'FIELD' as const, condition: { all: [] }, action: 'JUMP_TO_FIELD' as const, targetSectionId: null, targetFieldId: null, targetVariableId: null, payload: null, position: 0, ...extra });
    expect(formStateProblem(makeForm([q(A, 'SHORT_ANSWER', 0, { rules: [rule({ targetFieldId: uid(77) })] })]))).toBe('A rule points to a question that no longer exists.');
    expect(formStateProblem(makeForm([q(A, 'SHORT_ANSWER', 0, { rules: [rule({ action: 'SET_VARIABLE', targetVariableId: uid(78), payload: { value: 1 } })] })]))).toBe('A rule sets a variable that no longer exists.');
    const computed = makeVariable(uid(10), 'total', 0, { formula: '1' });
    expect(formStateProblem(makeForm([q(A, 'SHORT_ANSWER', 0, { rules: [rule({ action: 'SET_VARIABLE', targetVariableId: computed.id, payload: { value: 1 } })] })], { variables: [computed] }))).toBe(
      'Rules set this variable. Remove those rules before giving it a formula.',
    );
  });
  it('requires sign-in when limiting to one response', () => {
    const f = makeForm([q(A, 'SHORT_ANSWER', 0)]);
    expect(formStateProblem({ ...f, settings: { ...f.settings, limitOneResponse: true, requireSignIn: false } })).toBe('Limiting to one response requires sign-in.');
  });
  it('rejects duplicate option ids, within one field and across fields', () => {
    const dupId = opt(1, 'A').id;
    const withinField = q(A, 'MULTIPLE_CHOICE', 0, { options: [opt(1, 'A'), { ...opt(2, 'B'), id: dupId }] });
    expect(formStateProblem(makeForm([withinField]))).toBe('An option id is used more than once in this form.');
    const acrossFields = [q(A, 'MULTIPLE_CHOICE', 0, { options: [opt(1, 'A')] }), q(B, 'MULTIPLE_CHOICE', 1, { options: [opt(1, 'B')] })];
    expect(formStateProblem(makeForm(acrossFields))).toBe('An option id is used more than once in this form.');
  });
  it('rejects duplicate rule ids, within one field and across fields', () => {
    const dupRule = (id: string, fieldId: string, position: number) => ({ id, fieldId, operator: null, value: null, trigger: 'ON_LEAVE' as const, scope: 'FIELD' as const, condition: { all: [] }, action: 'END_FORM' as const, targetSectionId: null, targetFieldId: null, targetVariableId: null, payload: null, position });
    const ruleId = uid(70);
    const withinField = q(A, 'SHORT_ANSWER', 0, { rules: [dupRule(ruleId, A, 0), dupRule(ruleId, A, 1)] });
    expect(formStateProblem(makeForm([withinField]))).toBe('A rule id is used more than once in this form.');
    const acrossFields = [q(A, 'SHORT_ANSWER', 0, { rules: [dupRule(ruleId, A, 0)] }), q(B, 'SHORT_ANSWER', 1, { rules: [dupRule(ruleId, B, 0)] })];
    expect(formStateProblem(makeForm(acrossFields))).toBe('A rule id is used more than once in this form.');
  });
});

describe('txProblem and assignFreshKeys', () => {
  const tx = (ops: OpTx['ops']): OpTx => ({ txId: uid(500), label: 't', ops });
  it('checks only the items a transaction touched', () => {
    const broken = makeField(B, 'SHORT_ANSWER', 1, { settings: { scaleMax: 5 } });
    const before = makeForm([makeField(A, 'SHORT_ANSWER', 0), broken]);
    const after = { ...before, fields: [{ ...before.fields[0]!, label: 'Renamed' }, broken] };
    expect(txProblem(before, after, tx([{ kind: 'set', entity: 'field', id: A, changes: { label: { from: 'Question 1', to: 'Renamed' } } }]))).toBeNull();
    expect(txProblem(before, after, tx([{ kind: 'set', entity: 'field', id: B, changes: { label: { from: 'x', to: 'y' } } }]))?.message).toBe('“scaleMax” doesn’t apply to Short answer questions.');
  });
  it('validates form, theme and variable values', () => {
    const f = makeForm([makeField(A, 'SHORT_ANSWER', 0)], { variables: [makeVariable(uid(10), 'total', 0)] });
    expect(txProblem(f, { ...f, title: '' }, tx([{ kind: 'set', entity: 'form', id: f.id, changes: { title: { from: 'Test form', to: '' } } }]))).not.toBeNull();
    expect(txProblem(f, { ...f, theme: { ...f.theme, primaryColor: 'red' } }, tx([{ kind: 'set', entity: 'theme', id: f.id, changes: { primaryColor: { from: '#673ab7', to: 'red' } } }]))).not.toBeNull();
    const bad = { ...f, variables: [{ ...f.variables[0]!, key: '1bad' }] };
    expect(txProblem(f, bad, tx([{ kind: 'set', entity: 'variable', id: uid(10), changes: { key: { from: 'total', to: '1bad' } } }]))).not.toBeNull();
  });
  it('rejects an unknown key added to form settings', () => {
    const f = makeForm([makeField(A, 'SHORT_ANSWER', 0)]);
    const after = { ...f, settings: { ...f.settings, foo: 'bar' } };
    const problem = txProblem(f, after, tx([{ kind: 'set', entity: 'form', id: f.id, changes: { 'settings.foo': { from: null, to: 'bar' } } }]));
    expect(problem?.message).toBe('Form settings: Unrecognized key: "foo"');
  });
  it('blocks converting a welcome or ending screen to another type, and vice versa', () => {
    const before = makeForm([makeField(A, 'WELCOME', 0), makeField(B, 'SHORT_ANSWER', 1)]);
    const toShortAnswer = { ...before, fields: [{ ...before.fields[0]!, type: 'SHORT_ANSWER' as const }, before.fields[1]!] };
    expect(txProblem(before, toShortAnswer, tx([{ kind: 'set', entity: 'field', id: A, changes: { type: { from: 'WELCOME', to: 'SHORT_ANSWER' } } }]))?.message).toBe(
      'Welcome and ending screens can’t be converted to other types.',
    );
    const toWelcome = { ...before, fields: [before.fields[0]!, { ...before.fields[1]!, type: 'WELCOME' as const }] };
    expect(txProblem(before, toWelcome, tx([{ kind: 'set', entity: 'field', id: B, changes: { type: { from: 'SHORT_ANSWER', to: 'WELCOME' } } }]))?.message).toBe(
      'Welcome and ending screens can’t be converted to other types.',
    );
  });
  it('reports rule-level definition errors on touched questions', () => {
    const before = makeForm([makeField(A, 'SHORT_ANSWER', 0), makeField(B, 'SHORT_ANSWER', 1)]);
    const backward = { id: uid(61), fieldId: B, operator: null, value: null, trigger: 'ON_LEAVE' as const, scope: 'FIELD' as const, condition: { all: [] }, action: 'JUMP_TO_FIELD' as const, targetSectionId: null, targetFieldId: A, targetVariableId: null, payload: null, position: 0 };
    const after = { ...before, fields: [before.fields[0]!, { ...before.fields[1]!, rules: [backward] }] };
    const problem = txProblem(before, after, tx([{ kind: 'set', entity: 'field', id: B, changes: { rules: { from: [], to: [backward] } } }]));
    expect(problem?.issues?.[0]?.code).toBe('backward_jump');
  });
  it('gives a created question a fresh key when its key is taken', () => {
    const D = uid(4);
    const after = makeForm([makeField(A, 'SHORT_ANSWER', 0, { ref: 'q1' }), makeField(D, 'NUMBER', 1, { ref: 'Q1' })]);
    const { form, assigned } = assignFreshKeys(after, tx([{ kind: 'create', entity: 'field', snapshot: after.fields[1]!, afterId: A }]));
    expect(assigned.fields[D]).toBe('q2');
    expect(form.fields[1]!.ref).toBe('q2');
    expect(assignFreshKeys(makeForm([makeField(A, 'SHORT_ANSWER', 0)]), tx([])).assigned).toEqual({ fields: {}, variables: {} });
  });
});
