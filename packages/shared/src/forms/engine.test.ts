import { describe, expect, it } from 'vitest';
import type { ConditionOp } from '../enums';
import type { Condition, ConditionValue } from '../schemas/forms';
import { evaluateForm, hiddenAnswers } from './engine';
import { legacyRuleToV2 } from './legacy';
import { computePath, splitSections, type LogicField } from './__fixtures__/legacy-logic';
import { buildPipingContext, interpolate, resolveOutcome, safeRedirectUrl } from './piping';
import { baseField, opt } from './registry/fixtures';
import type { EngineField, EngineRule, EngineVariable, FormDefinition } from './types';

const leaf = (id: string, op: ConditionOp, value?: ConditionValue): Condition => ({ subject: { type: 'field', id }, op, value });
const rule = (r: Partial<EngineRule> & Pick<EngineRule, 'action'>): EngineRule => ({
  trigger: r.action === 'SHOW' || r.action === 'HIDE' ? 'VISIBILITY' : 'ON_LEAVE',
  scope: 'FIELD',
  condition: { all: [] },
  targetSectionId: null,
  targetFieldId: null,
  targetVariableId: null,
  payload: null,
  position: 0,
  ...r,
});
/** Builds a definition with positions following array order. */
function form(fields: EngineField[], variables: EngineVariable[] = []): FormDefinition {
  return { fields: fields.map((f, i) => ({ ...f, position: i })), variables };
}
const variable = (id: string, key: string, extra: Partial<EngineVariable> = {}): EngineVariable => ({ id, key, type: 'NUMBER', initialValue: 0, formula: null, position: 0, ...extra });

describe('path', () => {
  it('walks every step and skips sections, screens and hidden fields', () => {
    const def = form([baseField('WELCOME', { id: 'w' }), baseField('SHORT_ANSWER', { id: 'a' }), baseField('SECTION', { id: 's' }), baseField('STATEMENT', { id: 'st' }), baseField('HIDDEN', { id: 'h' }), baseField('NUMBER', { id: 'b' }), baseField('ENDING', { id: 'e' })]);
    const r = evaluateForm(def, {});
    expect(r.path).toEqual(['a', 'st', 'b']);
    expect(r.endingId).toBe('e');
  });

  it('JUMP_TO_FIELD skips the questions in between', () => {
    const def = form([baseField('YES_NO', { id: 'q1', rules: [rule({ action: 'JUMP_TO_FIELD', condition: leaf('q1', 'eq', false), targetFieldId: 'q3' })] }), baseField('SHORT_ANSWER', { id: 'q2' }), baseField('SHORT_ANSWER', { id: 'q3' })]);
    expect(evaluateForm(def, { q1: false }).path).toEqual(['q1', 'q3']);
    expect(evaluateForm(def, { q1: true }).path).toEqual(['q1', 'q2', 'q3']);
  });

  it('ignores backward jumps so forms cannot loop', () => {
    const def = form([baseField('SHORT_ANSWER', { id: 'q1' }), baseField('SHORT_ANSWER', { id: 'q2', rules: [rule({ action: 'JUMP_TO_FIELD', targetFieldId: 'q1' })] })]);
    expect(evaluateForm(def, {}).path).toEqual(['q1', 'q2']);
  });

  it('first matching navigational rule wins; earlier variable actions still apply', () => {
    const def = form(
      [
        baseField('NUMBER', {
          id: 'q1',
          rules: [
            rule({ action: 'SET_VARIABLE', targetVariableId: 'v', payload: { value: 5 }, position: 0 }),
            rule({ action: 'JUMP_TO_FIELD', targetFieldId: 'q3', position: 1 }),
            rule({ action: 'END_FORM', position: 2 }),
          ],
        }),
        baseField('NUMBER', { id: 'q2' }),
        baseField('NUMBER', { id: 'q3' }),
      ],
      [variable('v', 'v')],
    );
    const r = evaluateForm(def, { q1: 1 });
    expect(r.path).toEqual(['q1', 'q3']);
    expect(r.variables.v).toBe(5);
  });

  it('IF age < 18 THEN end the form at a specific ending', () => {
    const def = form([baseField('NUMBER', { id: 'age', rules: [rule({ action: 'END_FORM', condition: leaf('age', 'lt', 18), targetFieldId: 'minor' })] }), baseField('SHORT_ANSWER', { id: 'next' }), baseField('ENDING', { id: 'adult' }), baseField('ENDING', { id: 'minor' })]);
    expect(evaluateForm(def, { age: 16 })).toMatchObject({ path: ['age'], endingId: 'minor' });
    expect(evaluateForm(def, { age: 30 })).toMatchObject({ path: ['age', 'next'], endingId: 'adult' });
  });

  it('END_FORM without a target uses the first ending; SUBMIT_FORM behaves the same', () => {
    const def = form([baseField('YES_NO', { id: 'q', rules: [rule({ action: 'END_FORM' })] }), baseField('SHORT_ANSWER', { id: 'x' }), baseField('ENDING', { id: 'e1' }), baseField('ENDING', { id: 'e2' })]);
    expect(evaluateForm(def, {})).toMatchObject({ path: ['q'], endingId: 'e1' });
    const legacy = form([baseField('YES_NO', { id: 'q', rules: [rule({ action: 'SUBMIT_FORM' })] }), baseField('SHORT_ANSWER', { id: 'x' })]);
    expect(evaluateForm(legacy, {})).toMatchObject({ path: ['q'], endingId: null });
  });

  it('REDIRECT ends the form with the raw template', () => {
    const def = form([baseField('SHORT_ANSWER', { id: 'q', rules: [rule({ action: 'REDIRECT', payload: { url: 'https://x.test/?n={{q}}' } })] }), baseField('SHORT_ANSWER', { id: 'z' })]);
    expect(evaluateForm(def, { q: 'hi' })).toMatchObject({ path: ['q'], redirect: 'https://x.test/?n={{q}}', endingId: null });
  });

  it('GO_TO_SECTION jumps to the first step after the section; an empty trailing section ends the path', () => {
    const def = form([
      baseField('YES_NO', { id: 'q', rules: [rule({ action: 'GO_TO_SECTION', scope: 'SECTION', condition: leaf('q', 'eq', true), targetSectionId: 's2' }), rule({ action: 'GO_TO_SECTION', scope: 'SECTION', condition: leaf('q', 'eq', false), targetSectionId: 's3', position: 1 })] }),
      baseField('SECTION', { id: 's1' }),
      baseField('SHORT_ANSWER', { id: 'a' }),
      baseField('SECTION', { id: 's2' }),
      baseField('SHORT_ANSWER', { id: 'b' }),
      baseField('SECTION', { id: 's3' }),
    ]);
    expect(evaluateForm(def, { q: true }).path).toEqual(['q', 'b']);
    expect(evaluateForm(def, { q: false }).path).toEqual(['q']);
    expect(evaluateForm(def, {}).path).toEqual(['q', 'a', 'b']);
  });
});

describe('visibility', () => {
  const country = baseField('DROPDOWN', { id: 'country', options: [opt('ug', 'Uganda'), opt('ke', 'Kenya')] });
  const type = baseField('MULTIPLE_CHOICE', { id: 'type', options: [opt('biz', 'Business'), opt('per', 'Personal')] });
  const bizReg = baseField('SHORT_ANSWER', { id: 'reg', rules: [rule({ action: 'SHOW', condition: { all: [leaf('country', 'eq', 'ug'), leaf('type', 'eq', 'biz')] } })] });
  const def = form([country, type, bizReg, baseField('SHORT_ANSWER', { id: 'end' })]);

  it('IF country = Uganda AND type = Business THEN show business registration', () => {
    expect(evaluateForm(def, { country: 'ug', type: 'biz' }).path).toEqual(['country', 'type', 'reg', 'end']);
    expect(evaluateForm(def, { country: 'ke', type: 'biz' }).path).toEqual(['country', 'type', 'end']);
    expect(evaluateForm(def, { country: 'ug', type: 'per' }).path).toEqual(['country', 'type', 'end']);
  });

  it('HIDE hides; HIDE wins over SHOW', () => {
    const d = form([baseField('YES_NO', { id: 'q' }), baseField('SHORT_ANSWER', { id: 'x', rules: [rule({ action: 'SHOW' }), rule({ action: 'HIDE', condition: leaf('q', 'eq', true), position: 1 })] })]);
    expect(evaluateForm(d, { q: true }).path).toEqual(['q']);
    expect(evaluateForm(d, { q: false }).path).toEqual(['q', 'x']);
  });

  it('answers off the path are invisible to conditions, score and variables', () => {
    const d = form(
      [
        baseField('YES_NO', { id: 'q1', rules: [rule({ action: 'JUMP_TO_FIELD', condition: leaf('q1', 'eq', false), targetFieldId: 'q3' })] }),
        baseField('NUMBER', { id: 'q2', ref: 'q2', scoreConfig: { correct: 1, points: 10 } }),
        baseField('SHORT_ANSWER', { id: 'q3', rules: [rule({ action: 'SHOW_MESSAGE', condition: leaf('q2', 'answered'), payload: { message: 'saw q2' } })] }),
      ],
      [variable('v', 'double', { formula: '{{q2}} * 2' })],
    );
    // Stale q2 answer from an abandoned branch.
    const r = evaluateForm(d, { q1: false, q2: 1 });
    expect(r.path).toEqual(['q1', 'q3']);
    expect(r.message).toBeNull();
    expect(r.score).toBe(0);
    expect(r.variables.double).toBe(0);
  });

  it('hidden fields are readable by conditions', () => {
    const d = form([baseField('HIDDEN', { id: 'h', ref: 'utm' }), baseField('SHORT_ANSWER', { id: 'x', rules: [rule({ action: 'SHOW', condition: leaf('h', 'eq', 'vip') })] })]);
    expect(evaluateForm(d, hiddenAnswers(d, { utm: 'vip' })).path).toEqual(['x']);
    expect(evaluateForm(d, hiddenAnswers(d, { utm: 'ad' })).path).toEqual([]);
    expect(hiddenAnswers(d, { other: 'x' })).toEqual({});
  });
});

describe('variables and scoring', () => {
  it('CALCULATE price × quantity into a variable', () => {
    const d = form([baseField('NUMBER', { id: 'p', ref: 'price' }), baseField('NUMBER', { id: 'q', ref: 'quantity', rules: [rule({ action: 'CALCULATE', targetVariableId: 't', payload: { formula: '{{price}} * {{quantity}}' } })] })], [variable('t', 'total')]);
    expect(evaluateForm(d, { p: 2.5, q: 4 }).variables.total).toBe(10);
  });

  it('computed variables follow their formulas in dependency order', () => {
    const d = form([baseField('NUMBER', { id: 's', ref: 'subtotal' })], [variable('v2', 'total', { formula: '{{subtotal}} + {{tax}}', position: 0 }), variable('v1', 'tax', { formula: 'ROUND({{subtotal}} * 0.18, 2)', position: 1 })]);
    expect(evaluateForm(d, { s: 100 }).variables).toEqual({ total: 118, tax: 18 });
  });

  it('percentage of the maximum score', () => {
    const d = form(
      [baseField('MULTIPLE_CHOICE', { id: 'q1', options: [opt('a'), opt('b')], scoreConfig: { correct: 'a', points: 3 } }), baseField('MULTIPLE_CHOICE', { id: 'q2', options: [opt('a'), opt('b')], scoreConfig: { correct: 'b', points: 1 } })],
      [variable('m', 'maximumScore', { initialValue: 4 }), variable('pct', 'percent', { formula: '({{score}} / {{maximumScore}}) * 100' })],
    );
    const r = evaluateForm(d, { q1: 'a', q2: 'a' });
    expect(r.score).toBe(3);
    expect(r.variables.percent).toBe(75);
  });

  it('IF score > X THEN show section Z (score subject)', () => {
    const d = form([
      baseField('CHECKBOXES', { id: 'q', options: [opt('a'), opt('b')], scoreConfig: { optionPoints: { a: 5, b: 5 } } }),
      baseField('SHORT_ANSWER', { id: 'bonus', rules: [rule({ action: 'SHOW', condition: { subject: { type: 'score' }, op: 'gt', value: 8 } })] }),
    ]);
    expect(evaluateForm(d, { q: ['a', 'b'] }).path).toEqual(['q', 'bonus']);
    expect(evaluateForm(d, { q: ['a'] }).path).toEqual(['q']);
  });

  it('SET_VARIABLE drives a later condition', () => {
    const d = form(
      [
        baseField('YES_NO', { id: 'q', rules: [rule({ action: 'SET_VARIABLE', condition: leaf('q', 'eq', true), targetVariableId: 'seg', payload: { value: 'business' } })] }),
        baseField('SHORT_ANSWER', { id: 'b', rules: [rule({ action: 'SHOW', condition: { subject: { type: 'variable', id: 'seg' }, op: 'eq', value: 'business' } })] }),
      ],
      [variable('seg', 'segment', { type: 'TEXT', initialValue: null })],
    );
    expect(evaluateForm(d, { q: true }).path).toEqual(['q', 'b']);
    expect(evaluateForm(d, { q: false }).path).toEqual(['q']);
  });

  it('circular variables evaluate to null instead of hanging', () => {
    const d = form([], [variable('a', 'a', { formula: '{{b}} + 1' }), variable('b', 'b', { formula: '{{a}} + 1' })]);
    expect(evaluateForm(d, {}).variables).toEqual({ a: null, b: null });
  });

  it('computed variables ignore SET_VARIABLE', () => {
    const d = form([baseField('NUMBER', { id: 'q', ref: 'n', rules: [rule({ action: 'SET_VARIABLE', targetVariableId: 'c', payload: { value: 99 } })] })], [variable('c', 'c', { formula: '{{n}} + 1' })]);
    expect(evaluateForm(d, { q: 1 }).variables.c).toBe(2);
  });

  it('coerces by variable type', () => {
    const d = form([], [variable('t', 'flag', { type: 'BOOLEAN', formula: '1' }), variable('d', 'when', { type: 'DATE', formula: '"2026-09-26"' }), variable('x', 'txt', { type: 'TEXT', formula: '3 + 4' })]);
    expect(evaluateForm(d, {}).variables).toEqual({ flag: true, when: '2026-09-26', txt: '7' });
  });
});

describe('legacy parity', () => {
  // The pre-engine car survey: "No" jumps to Final.
  const legacyFields: LogicField[] = [
    { id: 'car', type: 'MULTIPLE_CHOICE', label: 'car', required: true, validation: {}, settings: {}, options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], rules: [{ operator: 'EQUALS', value: 'no', action: 'GO_TO_SECTION', targetSectionId: 'final', position: 0 }] },
    { id: 'details', type: 'SECTION', label: 'details', required: false, validation: {}, settings: {}, options: [], rules: [] },
    { id: 'model', type: 'SHORT_ANSWER', label: 'model', required: true, validation: {}, settings: {}, options: [], rules: [{ operator: 'CONTAINS', value: 'tesla', action: 'SUBMIT_FORM', targetSectionId: null, position: 0 }] },
    { id: 'color', type: 'SHORT_ANSWER', label: 'color', required: false, validation: {}, settings: {}, options: [], rules: [{ operator: 'NOT_ANSWERED', value: null, action: 'GO_TO_SECTION', targetSectionId: 'final', position: 0 }] },
    { id: 'extra', type: 'SECTION', label: 'extra', required: false, validation: {}, settings: {}, options: [], rules: [] },
    { id: 'notes', type: 'PARAGRAPH', label: 'notes', required: false, validation: {}, settings: {}, options: [], rules: [{ operator: 'ALWAYS', value: null, action: 'GO_TO_SECTION', targetSectionId: 'details', position: 0 }] },
    { id: 'final', type: 'SECTION', label: 'final', required: false, validation: {}, settings: {}, options: [], rules: [] },
    { id: 'comments', type: 'PARAGRAPH', label: 'comments', required: false, validation: {}, settings: {}, options: [], rules: [] },
  ];
  const engineDef = form(
    legacyFields.map((f) => baseField(f.type, { id: f.id, options: f.options.map((o) => opt(o.id, o.label)), rules: f.rules.map((r, i) => legacyRuleToV2(f.id, r as never, i)) })),
  );
  const legacyPath = (answers: Record<string, string>) => {
    const sections = splitSections(legacyFields);
    return computePath(sections, answers).flatMap((i) => sections[i]!.fields.map((f) => f.id));
  };

  it.each([
    [{ car: 'yes', model: 'Civic', color: 'red' }],
    [{ car: 'yes', model: 'Civic' }],
    [{ car: 'yes', model: 'Tesla 3', color: 'red' }],
    [{ car: 'no' }],
    [{}],
  ])('matches computePath for %j', (answers) => {
    expect(evaluateForm(engineDef, answers).path).toEqual(legacyPath(answers));
  });
});

describe('piping and outcome', () => {
  const def = form(
    [
      baseField('SHORT_ANSWER', { id: 'n', ref: 'firstName' }),
      baseField('MULTIPLE_CHOICE', { id: 'c', ref: 'plan', options: [opt('p1', 'Pro')] }),
      baseField('ENDING', { id: 'e', label: 'Thanks {{firstName}}!', description: 'Your total is {{totalAmount}} on {{plan}}. Score {{score}}. {{unknown}}' }),
    ],
    [variable('t', 'totalAmount', { initialValue: 42 })],
  );

  it('interpolates answers (as labels), variables and score; unknown keys are blank', () => {
    const answers = { n: 'Ada', c: 'p1' };
    const r = evaluateForm(def, answers);
    const out = resolveOutcome(def, answers, r, 'Recorded.');
    expect(out).toEqual({ endingId: 'e', title: 'Thanks Ada!', message: 'Your total is 42 on Pro. Score 0. ', redirectUrl: null, endingButtonUrl: null, endingRedirectUrl: null });
  });

  it('keeps hostile input as literal text', () => {
    const answers = { n: '<img src=x onerror=alert(1)>' };
    const ctx = buildPipingContext(def, answers, evaluateForm(def, answers));
    expect(interpolate('Hi {{firstName}}', ctx)).toBe('Hi <img src=x onerror=alert(1)>');
  });

  it('uses the default message when there is no ending, and a SHOW_MESSAGE override when set', () => {
    const plain = form([baseField('SHORT_ANSWER', { id: 'q', ref: 'q', rules: [rule({ action: 'SHOW_MESSAGE', condition: leaf('q', 'eq', 'vip'), payload: { message: 'Welcome, {{q}}' } })] })]);
    expect(resolveOutcome(plain, { q: 'x' }, evaluateForm(plain, { q: 'x' }), 'Recorded.').message).toBe('Recorded.');
    expect(resolveOutcome(plain, { q: 'vip' }, evaluateForm(plain, { q: 'vip' }), 'Recorded.').message).toBe('Welcome, vip');
  });

  it('falls back to the default message when an ending has an empty description', () => {
    const def2 = form([baseField('SHORT_ANSWER', { id: 'q', ref: 'q', rules: [rule({ action: 'END_FORM', targetFieldId: 'e' })] }), baseField('ENDING', { id: 'e', label: 'Bye', description: '' })]);
    const out = resolveOutcome(def2, { q: 'x' }, evaluateForm(def2, { q: 'x' }), 'Recorded.');
    expect(out).toMatchObject({ endingId: 'e', title: 'Bye', message: 'Recorded.' });
  });

  it('builds safe redirect URLs', () => {
    const ctx = { resolve: (k: string) => (k === 'q' ? 'a b&c' : undefined) };
    expect(safeRedirectUrl('https://x.test/?q={{q}}', ctx)).toBe('https://x.test/?q=a%20b%26c');
    expect(safeRedirectUrl('javascript:alert({{q}})', ctx)).toBeNull();
    expect(safeRedirectUrl('{{q}}', { resolve: () => 'javascript:alert(1)' })).toBeNull();
    expect(safeRedirectUrl('not a url', ctx)).toBeNull();
  });

  it('resolves ending link and redirect URLs, and lets a REDIRECT rule win', () => {
    const q = baseField('SHORT_ANSWER', { id: 'q', ref: 'q' });
    const end = baseField('ENDING', { id: 'e', ref: 'e', label: 'Bye', settings: { buttonUrl: 'https://x.test/b?n={{q}}', redirectUrl: 'https://x.test/r?n={{q}}' } });
    const def = { fields: [{ ...q, position: 0 }, { ...end, position: 1 }], variables: [] };
    const out = resolveOutcome(def, { q: 'a&b' }, evaluateForm(def, { q: 'a&b' }), 'Done');
    expect(out).toMatchObject({ endingId: 'e', endingButtonUrl: 'https://x.test/b?n=a%26b', endingRedirectUrl: 'https://x.test/r?n=a%26b', redirectUrl: null });
  });
});

describe('scale', () => {
  it('evaluates a 500-question form quickly', () => {
    const fields = Array.from({ length: 500 }, (_, i) => baseField('SHORT_ANSWER', { id: `q${i}`, ref: `q${i}`, rules: i % 10 === 0 && i > 0 ? [rule({ action: 'SHOW', condition: leaf(`q${i - 1}`, 'answered') })] : [] }));
    const answers = Object.fromEntries(fields.map((f) => [f.id, 'x']));
    const t = performance.now();
    const r = evaluateForm(form(fields), answers);
    expect(r.path).toHaveLength(500);
    expect(performance.now() - t).toBeLessThan(200);
  });
});
