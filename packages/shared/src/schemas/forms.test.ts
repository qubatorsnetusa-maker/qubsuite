import { describe, expect, it } from 'vitest';
import {
  answerValueSchema,
  conditionSchema,
  DEFAULT_FORM_SETTINGS,
  DEFAULT_FORM_THEME_EXTRAS,
  fieldRefSchema,
  formThemeSchema,
  legacyLogicRuleSchema,
  logicRuleSchema,
  setLogicSchema,
  submitResponseSchema,
  themeExtrasSchema,
  type Condition,
} from './forms';

const F = '11111111-1111-4111-8111-111111111111';
const S = '22222222-2222-4222-8222-222222222222';
const V = '33333333-3333-4333-8333-333333333333';
const leaf: Condition = { subject: { type: 'field', id: F }, op: 'eq', value: 'x' };

describe('condition schema', () => {
  it('accepts nested AND/OR/NOT trees', () => {
    const c = { all: [leaf, { any: [leaf, { not: leaf }] }] };
    expect(conditionSchema.parse(c)).toEqual(c);
  });
  it('accepts the score and variable subjects', () => {
    expect(conditionSchema.safeParse({ subject: { type: 'score' }, op: 'gt', value: 3 }).success).toBe(true);
    expect(conditionSchema.safeParse({ subject: { type: 'variable', id: V }, op: 'answered' }).success).toBe(true);
  });
  it('rejects unknown operators and extra keys', () => {
    expect(conditionSchema.safeParse({ ...leaf, op: 'like' }).success).toBe(false);
    expect(conditionSchema.safeParse({ all: [], any: [] }).success).toBe(false);
  });
});

describe('logic rule schema', () => {
  it('defaults trigger/scope and nullable targets', () => {
    const r = logicRuleSchema.parse({ condition: leaf, action: 'END_FORM' });
    expect(r).toMatchObject({ trigger: 'ON_LEAVE', scope: 'FIELD', targetFieldId: null, targetSectionId: null, targetVariableId: null, payload: null });
  });
  it('requires the right target per action', () => {
    expect(logicRuleSchema.safeParse({ condition: leaf, action: 'JUMP_TO_FIELD' }).success).toBe(false);
    expect(logicRuleSchema.safeParse({ condition: leaf, action: 'GO_TO_SECTION', targetSectionId: S }).success).toBe(true);
    expect(logicRuleSchema.safeParse({ condition: leaf, action: 'REDIRECT' }).success).toBe(false);
    expect(logicRuleSchema.safeParse({ condition: leaf, action: 'CALCULATE', targetVariableId: V, payload: { formula: '{{a}}+1' } }).success).toBe(true);
    expect(logicRuleSchema.safeParse({ condition: leaf, action: 'SET_VARIABLE', targetVariableId: V }).success).toBe(false);
  });
  it('pairs SHOW/HIDE with the VISIBILITY trigger only', () => {
    expect(logicRuleSchema.safeParse({ condition: leaf, action: 'SHOW' }).success).toBe(false);
    expect(logicRuleSchema.safeParse({ condition: leaf, action: 'SHOW', trigger: 'VISIBILITY' }).success).toBe(true);
    expect(logicRuleSchema.safeParse({ condition: leaf, action: 'END_FORM', trigger: 'VISIBILITY' }).success).toBe(false);
  });
  it('limits depth to 5 and leaves to 50', () => {
    let deep: Condition = leaf;
    for (let i = 0; i < 5; i++) deep = { not: deep };
    expect(logicRuleSchema.safeParse({ condition: deep, action: 'END_FORM' }).success).toBe(false);
    const wide = { any: Array.from({ length: 51 }, () => leaf) };
    expect(logicRuleSchema.safeParse({ condition: wide, action: 'END_FORM' }).success).toBe(false);
  });
  it('setLogicSchema accepts legacy and v2 rules side by side', () => {
    const parsed = setLogicSchema.parse({
      rules: [
        { operator: 'EQUALS', value: 'x', action: 'GO_TO_SECTION', targetSectionId: S },
        { condition: leaf, action: 'END_FORM' },
      ],
    });
    expect('operator' in parsed.rules[0]!).toBe(true);
    expect('condition' in parsed.rules[1]!).toBe(true);
    expect(legacyLogicRuleSchema.safeParse({ operator: 'EQUALS', value: 'x', action: 'END_FORM' }).success).toBe(false);
  });
});

describe('answers, refs, settings, submissions', () => {
  it.each([
    ['text', 'hello'],
    ['number', 4],
    ['boolean', false],
    ['option ids', ['a', 'b']],
    ['matrix/address record', { row1: 'col2' }],
    ['location', { label: 'Kampala', lat: 0.31, lng: 32.58 }],
    ['empty', null],
  ])('accepts %s answers', (_n, v) => expect(answerValueSchema.safeParse(v).success).toBe(true));
  it('rejects nested objects and out-of-range coordinates', () => {
    expect(answerValueSchema.safeParse({ a: { b: 'c' } }).success).toBe(false);
    expect(answerValueSchema.safeParse({ label: 'x', lat: 200 }).success).toBe(false);
  });
  it('validates refs', () => {
    expect(fieldRefSchema.safeParse('firstName').success).toBe(true);
    expect(fieldRefSchema.safeParse('first-name').success).toBe(false);
    expect(fieldRefSchema.safeParse('1st').success).toBe(false);
    expect(fieldRefSchema.safeParse('Score').success).toBe(false);
  });
  it('has classic as the default layout', () => {
    expect(DEFAULT_FORM_SETTINGS.layout).toBe('classic');
    expect(DEFAULT_FORM_SETTINGS.quiz).toEqual({ enabled: false, showScore: false });
  });
  it('accepts hidden values and an idempotency key on submit', () => {
    const r = submitResponseSchema.safeParse({ answers: {}, hidden: { utm_source: 'mail' }, clientSubmissionId: F, startedAt: '2026-09-26T10:00:00.000Z' });
    expect(r.success).toBe(true);
  });
});

describe('theme schema', () => {
  const theme = { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans' as const };
  it('accepts only http(s) header images', () => {
    expect(formThemeSchema.safeParse({ ...theme, headerImageUrl: 'https://example.com/a.png' }).success).toBe(true);
    expect(formThemeSchema.safeParse({ ...theme, headerImageUrl: null }).success).toBe(true);
    for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://example.com/a.png']) {
      const r = formThemeSchema.safeParse({ ...theme, headerImageUrl: bad });
      expect(r.success, bad).toBe(false);
      expect(r.error?.issues[0]?.message).toBe('Use a link starting with http:// or https://');
    }
  });
});

const base = { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans' as const };

describe('formThemeSchema extras', () => {
  it('accepts a theme with no extras at all', () => {
    expect(formThemeSchema.parse(base).extras).toBeUndefined();
  });

  it('accepts a full extras object', () => {
    const extras = {
      preset: 'midnight',
      questionColor: '#f8fafc',
      fontPair: 'grotesk' as const,
      background: { kind: 'gradient' as const, from: '#0f172a', to: '#1e1b4b', angle: 160, blur: 'none' as const },
      buttonRadius: 'pill' as const,
      logoUrl: 'https://cdn.example.com/logo.png',
      logoAlign: 'center' as const,
      headerStyle: 'prominent' as const,
      showLogo: true,
      logoHeight: 48,
      brandName: 'Acme Inc.',
      showBrandName: true,
      brandTagline: 'Customer experience',
      websiteUrl: 'https://acme.example.com',
      websiteLabel: 'Back to Acme',
      headerBannerUrl: 'https://cdn.example.com/banner.jpg',
      headerBannerHeight: 180,
      footerText: 'Acme Inc.',
      showPoweredBy: false,
    };
    expect(formThemeSchema.parse({ ...base, extras }).extras).toEqual(extras);
  });

  it('accepts a right-aligned logo', () => {
    expect(formThemeSchema.safeParse({ ...base, extras: { logoAlign: 'right' } }).success).toBe(true);
  });

  it.each([
    ['a 3-digit hex questionColor', { questionColor: '#fff' }],
    ['an unknown font pair', { fontPair: 'comic' }],
    ['dim above 80', { background: { kind: 'image', imageUrl: 'https://x.test/a.png', dim: 81 } }],
    ['an angle above 360', { background: { kind: 'gradient', from: '#000000', to: '#ffffff', angle: 361 } }],
    ['an unknown background kind', { background: { kind: 'video' } }],
    ['an unknown background blur', { background: { kind: 'image', imageUrl: 'https://x.test/a.png', blur: 'xl' } }],
    ['a javascript: logo URL', { logoUrl: 'javascript:alert(1)' }],
    ['footer text over 200 chars', { footerText: 'x'.repeat(201) }],
    ['an unknown logo alignment', { logoAlign: 'justify' }],
    ['an unknown header style', { headerStyle: 'hero' }],
    ['a logo height below 20', { logoHeight: 19 }],
    ['a logo height above 64', { logoHeight: 65 }],
    ['a fractional logo height', { logoHeight: 40.5 }],
    ['a brand name over 80 chars', { brandName: 'x'.repeat(81) }],
    ['a tagline over 120 chars', { brandTagline: 'x'.repeat(121) }],
    ['a javascript: website URL', { websiteUrl: 'javascript:alert(1)' }],
    ['a link label over 40 chars', { websiteLabel: 'x'.repeat(41) }],
    ['a data: banner URL', { headerBannerUrl: 'data:image/png;base64,AAAA' }],
    ['a banner height below 60', { headerBannerHeight: 59 }],
    ['a banner height above 240', { headerBannerHeight: 241 }],
    ['an unknown extras key', { wobble: true }],
  ])('rejects %s', (_label, extras) => {
    expect(formThemeSchema.safeParse({ ...base, extras }).success).toBe(false);
  });

  it('exposes display defaults the Design tab can show for unset keys', () => {
    expect(DEFAULT_FORM_THEME_EXTRAS.background).toEqual({ kind: 'color' });
    expect(DEFAULT_FORM_THEME_EXTRAS.logoAlign).toBe('left');
    expect(DEFAULT_FORM_THEME_EXTRAS.showPoweredBy).toBe(true);
    expect(DEFAULT_FORM_THEME_EXTRAS.headerStyle).toBe('minimal');
    expect(DEFAULT_FORM_THEME_EXTRAS.showLogo).toBe(true);
    expect(DEFAULT_FORM_THEME_EXTRAS.showBrandName).toBe(true);
    expect(DEFAULT_FORM_THEME_EXTRAS.logoHeight).toBe(40);
    expect(DEFAULT_FORM_THEME_EXTRAS.headerBannerHeight).toBe(120);
    expect(DEFAULT_FORM_THEME_EXTRAS.websiteLabel).toBe('Visit website');
    expect(themeExtrasSchema.safeParse(DEFAULT_FORM_THEME_EXTRAS).success).toBe(true);
  });
});
