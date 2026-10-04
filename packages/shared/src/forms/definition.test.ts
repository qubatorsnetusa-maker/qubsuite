import { describe, expect, it } from 'vitest';
import type { Condition } from '../schemas/forms';
import { validateDefinition } from './definition';
import { baseField, opt } from './registry/fixtures';
import type { EngineField, EngineRule, EngineVariable, FormDefinition } from './types';

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
const form = (fields: EngineField[], variables: EngineVariable[] = []): FormDefinition => ({ fields: fields.map((f, i) => ({ ...f, position: i })), variables });
const variable = (id: string, key: string, extra: Partial<EngineVariable> = {}): EngineVariable => ({ id, key, type: 'NUMBER', initialValue: 0, formula: null, position: 0, ...extra });
const codes = (def: FormDefinition, quiz = false) => validateDefinition(def, { quiz }).map((i) => i.code);

describe('validateDefinition', () => {
  it('accepts a clean form', () => {
    expect(validateDefinition(form([baseField('SHORT_ANSWER', { id: 'a', ref: 'a' }), baseField('NUMBER', { id: 'b', ref: 'b' })]))).toEqual([]);
  });
  it('flags invalid and duplicate refs, and clashes with variable keys', () => {
    expect(codes(form([baseField('SHORT_ANSWER', { ref: 'bad-ref' })]))).toContain('invalid_ref');
    expect(codes(form([baseField('SHORT_ANSWER', { ref: 'x' }), baseField('NUMBER', { ref: 'X' })]))).toContain('duplicate_ref');
    expect(codes(form([baseField('SHORT_ANSWER', { ref: 'total' })], [variable('v', 'total')]))).toContain('duplicate_key');
    expect(codes(form([], [variable('v', 'score')]))).toContain('invalid_variable_key');
  });
  it('allows only one welcome screen', () => {
    expect(codes(form([baseField('WELCOME'), baseField('WELCOME')]))).toContain('multiple_welcome');
  });
  it('checks formulas: syntax, unknown keys, cell refs and cycles', () => {
    expect(codes(form([], [variable('v', 'a', { formula: '1 +' })]))).toContain('formula_error');
    expect(codes(form([], [variable('v', 'a', { formula: '{{nope}} + 1' })]))).toContain('unknown_reference');
    expect(codes(form([], [variable('v', 'a', { formula: 'A1 + 1' })]))).toContain('formula_error');
    expect(codes(form([], [variable('v1', 'a', { formula: '{{b}}' }), variable('v2', 'b', { formula: '{{a}}' })]))).toContain('circular_variable');
    expect(codes(form([baseField('NUMBER', { ref: 'n' })], [variable('v', 'a', { formula: '{{n}} * {{score}}' })]))).toEqual([]);
  });
  it('classifies an unknown error literal as a formula error, not an unknown reference', () => {
    const issues = validateDefinition(form([], [variable('v', 'a', { formula: '{{score}} + #FOO' })]));
    expect(issues.map((i) => i.code)).toContain('formula_error');
    expect(issues.map((i) => i.code)).not.toContain('unknown_reference');
  });
  it('reports dangling condition subjects and targets', () => {
    const cond: Condition = { subject: { type: 'field', id: 'gone' }, op: 'answered' };
    expect(codes(form([baseField('SHORT_ANSWER', { rules: [rule({ action: 'SHOW', condition: cond })] })]))).toContain('dangling_reference');
    expect(codes(form([baseField('SHORT_ANSWER', { rules: [rule({ action: 'JUMP_TO_FIELD', targetFieldId: 'gone' })] })]))).toContain('dangling_reference');
    expect(codes(form([baseField('SHORT_ANSWER', { rules: [rule({ action: 'SET_VARIABLE', targetVariableId: 'gone', payload: { value: 1 } })] })]))).toContain('dangling_reference');
  });
  it('rejects backward jumps and wrong target types', () => {
    const def = form([baseField('SECTION', { id: 's' }), baseField('SHORT_ANSWER', { id: 'a' }), baseField('SHORT_ANSWER', { id: 'b', rules: [rule({ action: 'JUMP_TO_FIELD', targetFieldId: 'a' }), rule({ action: 'GO_TO_SECTION', targetSectionId: 's', position: 1 })] })]);
    expect(codes(def).filter((c) => c === 'backward_jump')).toHaveLength(2);
    expect(codes(form([baseField('SHORT_ANSWER', { id: 'a', rules: [rule({ action: 'GO_TO_SECTION', targetSectionId: 'b' })] }), baseField('SHORT_ANSWER', { id: 'b' })]))).toContain('invalid_target');
    expect(codes(form([baseField('SHORT_ANSWER', { id: 'a', rules: [rule({ action: 'END_FORM', targetFieldId: 'b' })] }), baseField('SHORT_ANSWER', { id: 'b' })]))).toContain('invalid_target');
  });
  it('rejects rules on fields that cannot hold them', () => {
    expect(codes(form([baseField('SECTION', { rules: [rule({ action: 'END_FORM' })] })]))).toContain('rules_not_allowed');
  });
  it('rejects operators the subject type does not support', () => {
    const def = form([baseField('MATRIX', { id: 'm' }), baseField('SHORT_ANSWER', { rules: [rule({ action: 'SHOW', condition: { subject: { type: 'field', id: 'm' }, op: 'gt', value: 1 } })] })]);
    expect(codes(def)).toContain('operator_not_supported');
  });
  it('rejects non-http redirects and rule targets that are computed variables', () => {
    expect(codes(form([baseField('SHORT_ANSWER', { rules: [rule({ action: 'REDIRECT', payload: { url: 'javascript:alert(1)' } })] })]))).toContain('invalid_redirect');
    expect(codes(form([baseField('SHORT_ANSWER', { rules: [rule({ action: 'REDIRECT', payload: { url: 'https://x.test/?a={{a}}' } })] })]))).not.toContain('invalid_redirect');
    const def = form([baseField('SHORT_ANSWER', { rules: [rule({ action: 'SET_VARIABLE', targetVariableId: 'c', payload: { value: 1 } })] })], [variable('c', 'c', { formula: '1' })]);
    expect(codes(def)).toContain('computed_variable_target');
  });
  it('checks CALCULATE formulas', () => {
    const def = form([baseField('SHORT_ANSWER', { rules: [rule({ action: 'CALCULATE', targetVariableId: 'v', payload: { formula: '{{ghost}} + 1' } })] })], [variable('v', 'v')]);
    expect(codes(def)).toContain('unknown_reference');
  });
  it('rejects unsafe regex patterns and untitled questions', () => {
    expect(codes(form([baseField('SHORT_ANSWER', { validation: { pattern: '^(a+)+$' } })]))).toContain('unsafe_pattern');
    expect(codes(form([baseField('SHORT_ANSWER', { label: '  ' })]))).toContain('missing_label');
  });
  describe('quiz logic that depends on the score (answers are hidden from respondents)', () => {
    const scoreGt1: Condition = { subject: { type: 'score' }, op: 'gt', value: 1 };
    const varGt1 = (id: string): Condition => ({ subject: { type: 'variable', id }, op: 'gt', value: 1 });
    const quizIssues = (def: FormDefinition) => validateDefinition(def, { quiz: true }).filter((i) => i.code === 'quiz_score_navigation');

    it('blocks publishing when navigation reads the score, only in quizzes', () => {
      const def = form([baseField('SHORT_ANSWER', { id: 'a', rules: [rule({ action: 'END_FORM', condition: scoreGt1 })] })]);
      expect(quizIssues(def)).toEqual([expect.objectContaining({ severity: 'error', fieldId: 'a', ruleIndex: 0 })]);
      expect(codes(def, false)).not.toContain('quiz_score_navigation');
    });

    it('flags VISIBILITY rules that read the score', () => {
      const def = form([baseField('SHORT_ANSWER', { rules: [rule({ action: 'SHOW', condition: scoreGt1 })] })]);
      expect(quizIssues(def)).toHaveLength(1);
    });

    it('flags conditions on a computed variable that uses the score, transitively', () => {
      const vars = [variable('v1', 'pct', { formula: '{{score}} * 10' }), variable('v2', 'band', { formula: '{{pct}} + 1' })];
      const def = form([baseField('SHORT_ANSWER', { rules: [rule({ action: 'JUMP_TO_FIELD', targetFieldId: 'b', condition: varGt1('v2') })] }), baseField('SHORT_ANSWER', { id: 'b' })], vars);
      expect(quizIssues(def)).toHaveLength(1);
    });

    it('flags conditions on variables set by rules whose condition or formula reads the score', () => {
      const vars = [variable('flag', 'flag'), variable('calc', 'calc'), variable('chain', 'chain')];
      const def = form(
        [
          baseField('SHORT_ANSWER', {
            id: 'a',
            rules: [
              rule({ action: 'SET_VARIABLE', targetVariableId: 'flag', payload: { value: 5 }, condition: scoreGt1 }),
              rule({ action: 'CALCULATE', targetVariableId: 'calc', payload: { formula: '{{score}} + 1' }, position: 1 }),
              // chain is set from a condition on flag, so it inherits the dependency.
              rule({ action: 'SET_VARIABLE', targetVariableId: 'chain', payload: { value: 1 }, condition: varGt1('flag'), position: 2 }),
            ],
          }),
          baseField('SHORT_ANSWER', { id: 'b', rules: [rule({ action: 'SHOW', condition: varGt1('calc') })] }),
          baseField('SHORT_ANSWER', { id: 'c', rules: [rule({ action: 'END_FORM', condition: varGt1('chain') })] }),
        ],
        vars,
      );
      expect(quizIssues(def).map((i) => i.fieldId)).toEqual(['b', 'c']);
    });

    it('allows score-free logic and non-path rules that read the score', () => {
      const vars = [variable('plain', 'plain')];
      const def = form(
        [
          baseField('NUMBER', { id: 'n', ref: 'n', rules: [rule({ action: 'SET_VARIABLE', targetVariableId: 'plain', payload: { value: 1 }, condition: { subject: { type: 'field', id: 'n' }, op: 'gt', value: 1 } })] }),
          baseField('SHORT_ANSWER', { id: 'b', rules: [rule({ action: 'SHOW', condition: varGt1('plain') }), rule({ action: 'SHOW_MESSAGE', payload: { message: 'Score {{score}}' }, condition: scoreGt1, position: 1 })] }),
        ],
        vars,
      );
      expect(quizIssues(def)).toEqual([]);
    });
  });

  describe('unknown {{keys}} in piped text', () => {
    const unknown = (def: FormDefinition, opts = {}) => validateDefinition(def, opts).filter((i) => i.code === 'unknown_reference');

    it('reports unknown keys in labels and descriptions with the field id', () => {
      const def = form([baseField('SHORT_ANSWER', { id: 'a', ref: 'name', label: 'Hi {{ nme }}' }), baseField('ENDING', { id: 'e', label: 'Bye', description: 'Thanks {{name}}, {{gone}}' })]);
      expect(unknown(def)).toEqual([
        expect.objectContaining({ severity: 'error', fieldId: 'a', ruleIndex: null, message: 'Unknown name: {{nme}}' }),
        expect.objectContaining({ severity: 'error', fieldId: 'e', message: 'Unknown name: {{gone}}' }),
      ]);
    });

    it('accepts field refs, variable keys and the score', () => {
      const def = form([baseField('SHORT_ANSWER', { id: 'a', ref: 'name', label: '{{name}} {{total}} {{score}}' })], [variable('v', 'total')]);
      expect(unknown(def)).toEqual([]);
    });

    it('reports unknown keys in SHOW_MESSAGE and REDIRECT payloads with the rule index', () => {
      const def = form([
        baseField('SHORT_ANSWER', {
          id: 'a',
          rules: [rule({ action: 'SHOW_MESSAGE', payload: { message: 'You said {{old_ref}}' } }), rule({ action: 'REDIRECT', payload: { url: 'https://x.test/?e={{mail}}' }, position: 1 })],
        }),
      ]);
      expect(unknown(def).map((i) => [i.fieldId, i.ruleIndex])).toEqual([
        ['a', 0],
        ['a', 1],
      ]);
    });

    it('checks the default confirmation message when given', () => {
      const issues = unknown(form([baseField('SHORT_ANSWER')]), { confirmationMessage: 'Thanks {{who}}' });
      expect(issues).toEqual([expect.objectContaining({ fieldId: null, message: 'Unknown name: {{who}}' })]);
    });
  });
  it('validates choice-option subjects', () => {
    const def = form([baseField('MULTIPLE_CHOICE', { id: 'c', options: [opt('a')] }), baseField('SHORT_ANSWER', { rules: [rule({ action: 'SHOW', condition: { subject: { type: 'field', id: 'c' }, op: 'eq', value: 'zzz' } })] })]);
    expect(codes(def)).toContain('unknown_option');
  });
  it('checks ending links and redirects like REDIRECT rules', () => {
    const ending = (settings: EngineField['settings']) => baseField('ENDING', { id: 'e', ref: 'e', label: 'Bye', settings });
    expect(codes(form([baseField('SHORT_ANSWER', { id: 'q', ref: 'q' }), ending({ buttonUrl: 'javascript:alert(1)' })]))).toContain('invalid_redirect');
    expect(codes(form([baseField('SHORT_ANSWER', { id: 'q', ref: 'q' }), ending({ redirectUrl: 'ftp://x.test' })]))).toContain('invalid_redirect');
    expect(codes(form([baseField('SHORT_ANSWER', { id: 'q', ref: 'q' }), ending({ buttonUrl: 'https://x.test/?n={{q}}', redirectUrl: 'https://x.test' })]))).toEqual([]);
    expect(codes(form([baseField('SHORT_ANSWER', { id: 'q', ref: 'q' }), ending({ redirectUrl: 'https://x.test/?n={{nope}}' })]))).toContain('unknown_reference');
  });
});
