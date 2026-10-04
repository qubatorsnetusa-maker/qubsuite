import type { FormDto, FormFieldDto, FormLogicRuleDto, FormVariableDto } from '@qub/shared';
import { describe, expect, it } from 'vitest';
import { summarizeRule } from './rule-summary';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const field = (over: Partial<FormFieldDto>): FormFieldDto => ({
  id: over.id!,
  ref: over.ref ?? 'q',
  type: 'SHORT_ANSWER',
  label: 'Untitled',
  description: null,
  required: false,
  position: 0,
  validation: {},
  settings: {},
  options: [],
  rules: [],
  scoreConfig: null,
  placeholder: null,
  defaultValue: null,
  ...over,
});

const rating = field({ id: uid(1), ref: 'rating', type: 'RATING', label: 'Rating', position: 0 });
const whySoLow = field({ id: uid(2), ref: 'why_so_low', type: 'SHORT_ANSWER', label: 'Why so low?', position: 1 });
const section = field({ id: uid(3), ref: 'payment', type: 'SECTION', label: 'Payment details', position: 2 });
const thankYou = field({ id: uid(4), ref: 'thank_you', type: 'ENDING', label: 'Thank you', position: 3 });
const sorry = field({ id: uid(5), ref: 'sorry', type: 'ENDING', label: '', position: 4 });
const choice = field({
  id: uid(6),
  ref: 'color',
  type: 'MULTIPLE_CHOICE',
  label: 'Favourite colour',
  position: 5,
  options: [{ id: uid(60), label: 'Red', kind: 'option', value: null, imageUrl: null, position: 0 }],
});

const scoreVar: FormVariableDto = { id: uid(7), key: 'score', type: 'NUMBER', initialValue: 0, formula: null, position: 0 };
const totalVar: FormVariableDto = { id: uid(8), key: 'total', type: 'NUMBER', initialValue: 0, formula: null, position: 1 };

function makeForm(fields: FormFieldDto[], variables: FormVariableDto[] = []): Pick<FormDto, 'fields' | 'variables'> {
  return { fields, variables };
}

/** A rule with just enough fields for `summarizeRule`; everything else defaults to null/no-op. */
function rule(over: Partial<FormLogicRuleDto>): Pick<FormLogicRuleDto, 'condition' | 'action' | 'targetFieldId' | 'targetSectionId' | 'targetVariableId' | 'payload'> {
  return { condition: { all: [] }, action: 'END_FORM', targetFieldId: null, targetSectionId: null, targetVariableId: null, payload: null, ...over };
}

describe('summarizeRule', () => {
  it('renders a simple condition and a jump to a question', () => {
    const form = makeForm([rating, whySoLow]);
    const r = rule({ condition: { subject: { type: 'field', id: rating.id }, op: 'lt', value: 3 }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id });
    expect(summarizeRule(form, r)).toBe('If Rating is less than 3 → Why so low?');
  });

  it('renders an unconditional rule as "Always" and END_FORM with a target ending by the ending\'s label', () => {
    const form = makeForm([rating, thankYou]);
    const r = rule({ condition: { all: [] }, action: 'END_FORM', targetFieldId: thankYou.id });
    expect(summarizeRule(form, r)).toBe('Always → Thank you');
  });

  it('END_FORM with no target ending renders "End the form"; an unlabeled ending falls back to "Ending"', () => {
    const form = makeForm([rating, sorry]);
    expect(summarizeRule(form, rule({ action: 'END_FORM', targetFieldId: null }))).toBe('Always → End the form');
    expect(summarizeRule(form, rule({ action: 'END_FORM', targetFieldId: sorry.id }))).toBe('Always → Ending');
  });

  it('GO_TO_SECTION renders the section\'s label', () => {
    const form = makeForm([rating, section]);
    const r = rule({ condition: { subject: { type: 'field', id: rating.id }, op: 'gte', value: 8 }, action: 'GO_TO_SECTION', targetSectionId: section.id });
    expect(summarizeRule(form, r)).toBe('If Rating is at least 8 → Payment details');
  });

  it('REDIRECT renders the URL', () => {
    const form = makeForm([rating]);
    expect(summarizeRule(form, rule({ action: 'REDIRECT', payload: { url: 'https://example.com' } }))).toBe('Always → Redirect to https://example.com');
  });

  it('SHOW_MESSAGE renders the quoted message', () => {
    const form = makeForm([rating]);
    expect(summarizeRule(form, rule({ action: 'SHOW_MESSAGE', payload: { message: 'Thanks!' } }))).toBe('Always → Change the message to "Thanks!"');
  });

  it('SET_VARIABLE renders a plain fixed value', () => {
    const form = makeForm([rating], [totalVar]);
    expect(summarizeRule(form, rule({ action: 'SET_VARIABLE', targetVariableId: totalVar.id, payload: { value: 5 } }))).toBe('Always → Set total to 5');
  });

  it('CALCULATE renders the raw formula, e.g. "Set score to score + 1"', () => {
    const form = makeForm([rating], [scoreVar]);
    expect(summarizeRule(form, rule({ action: 'CALCULATE', targetVariableId: scoreVar.id, payload: { formula: 'score + 1' } }))).toBe('Always → Set score to score + 1');
  });

  it('renders SHOW and HIDE actions', () => {
    const form = makeForm([rating]);
    expect(summarizeRule(form, rule({ action: 'SHOW' }))).toBe('Always → Show this question');
    expect(summarizeRule(form, rule({ action: 'HIDE' }))).toBe('Always → Hide this question');
  });

  it('renders an option-based condition value by the option\'s label', () => {
    const form = makeForm([choice, whySoLow]);
    const r = rule({ condition: { subject: { type: 'field', id: choice.id }, op: 'eq', value: uid(60) }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id });
    expect(summarizeRule(form, r)).toBe('If Favourite colour is Red → Why so low?');
  });

  it('renders a variable subject and the score subject', () => {
    const form = makeForm([whySoLow], [totalVar]);
    const byVariable = rule({ condition: { subject: { type: 'variable', id: totalVar.id }, op: 'gte', value: 10 }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id });
    expect(summarizeRule(form, byVariable)).toBe('If {{total}} is at least 10 → Why so low?');
    const byScore = rule({ condition: { subject: { type: 'score' }, op: 'gte', value: 10 }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id });
    expect(summarizeRule(form, byScore)).toBe('If Score is at least 10 → Why so low?');
  });

  it('renders nested AND/OR groups, parenthesising the sub-group', () => {
    const form = makeForm([rating, whySoLow], [totalVar]);
    const r = rule({
      condition: {
        all: [
          { any: [{ subject: { type: 'field', id: rating.id }, op: 'lt', value: 3 }, { subject: { type: 'field', id: rating.id }, op: 'eq', value: 1 }] },
          { subject: { type: 'variable', id: totalVar.id }, op: 'gte', value: 5 },
        ],
      },
      action: 'JUMP_TO_FIELD',
      targetFieldId: whySoLow.id,
    });
    expect(summarizeRule(form, r)).toBe('If (Rating is less than 3 OR Rating is 1) AND {{total}} is at least 5 → Why so low?');
  });

  it('renders a negated leaf', () => {
    const form = makeForm([rating, whySoLow]);
    const r = rule({ condition: { not: { subject: { type: 'field', id: rating.id }, op: 'eq', value: 5 } }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id });
    expect(summarizeRule(form, r)).toBe('If not Rating is 5 → Why so low?');
  });

  it('renders "answered"/"unanswered" without a value', () => {
    const form = makeForm([rating, whySoLow]);
    const r = rule({ condition: { subject: { type: 'field', id: rating.id }, op: 'answered' }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id });
    expect(summarizeRule(form, r)).toBe('If Rating is answered → Why so low?');
  });

  it('is "Invalid rule" for a dangling jump target, a dangling condition subject, an unknown option, or a variable rule missing its target', () => {
    const form = makeForm([rating, whySoLow], [totalVar]);
    expect(summarizeRule(form, rule({ action: 'JUMP_TO_FIELD', targetFieldId: uid(999) }))).toBe('Invalid rule');
    expect(summarizeRule(form, rule({ condition: { subject: { type: 'field', id: uid(999) }, op: 'eq', value: 1 }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id }))).toBe('Invalid rule');
    expect(summarizeRule(makeForm([choice, whySoLow]), rule({ condition: { subject: { type: 'field', id: choice.id }, op: 'eq', value: uid(999) }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id }))).toBe('Invalid rule');
    expect(summarizeRule(form, rule({ action: 'SET_VARIABLE', targetVariableId: null, payload: { value: 1 } }))).toBe('Invalid rule');
  });

  it('renders a root "any" condition with no items as "Never" (an OR of nothing is vacuously false — reachable by switching to Any and removing every leaf), not "Invalid rule"', () => {
    const form = makeForm([rating, whySoLow]);
    const r = rule({ condition: { any: [] }, action: 'JUMP_TO_FIELD', targetFieldId: whySoLow.id });
    expect(summarizeRule(form, r)).toBe('Never → Why so low?');
  });
});
