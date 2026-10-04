import { describe, expect, it } from 'vitest';
import { compileFormula, evaluateFormula, FormulaDefinitionError, formulaRefs } from './formula';

const run = (src: string, vars: Record<string, string | number | boolean | null> = {}) =>
  evaluateFormula(compileFormula(src), (k) => (k in vars ? vars[k] : undefined));

describe('formula bridge', () => {
  it.each([
    ['{{price}} * {{quantity}}', { price: 2.5, quantity: 4 }, 10],
    ['{{subtotal}} + {{tax}}', { subtotal: 100, tax: 18 }, 118],
    ['{{score}} / {{total}} * 100', { score: 7, total: 10 }, 70],
    ['({{score}} / {{maximumScore}}) * 100', { score: 3, maximumScore: 4 }, 75],
    ['ROUND({{a}} / 3, 2)', { a: 10 }, 3.33],
    ['IF({{age}} < 18, "minor", "adult")', { age: 17 }, 'minor'],
    ['IF({{age}} < 18, "minor", "adult")', { age: 30 }, 'adult'],
    ['{{first}} & " " & {{last}}', { first: 'Ada', last: 'Lovelace' }, 'Ada Lovelace'],
    ['CONCAT("Hi ", {{name}})', { name: 'Bo' }, 'Hi Bo'],
    ['SUM({{a}}, {{b}}, {{c}})', { a: 1, b: 2, c: 3 }, 6],
    ['MAX({{a}}, {{b}})', { a: 1, b: 9 }, 9],
    ['MIN({{a}}, {{b}})', { a: 1, b: 9 }, 1],
    ['ABS({{a}})', { a: -4 }, 4],
    ['{{a}} ^ 2', { a: 3 }, 9],
    ['{{a}} = 3', { a: 3 }, true],
    ['{{a}} <> 3', { a: 3 }, false],
    ['AND({{a}} > 1, {{b}} > 1)', { a: 2, b: 0 }, false],
    ['OR({{a}} > 1, {{b}} > 1)', { a: 2, b: 0 }, true],
    ['NOT({{flag}})', { flag: true }, false],
    ['{{n}} * 2', { n: '5' }, 10],
    ['=  {{x}} + 1', { x: 1 }, 2],
    ['{{ spaced }} + 1', { spaced: 1 }, 2],
    ['{{tax1}} + 1', { tax1: 1 }, 2],
    ['{{missing}} + 1', {}, 1],
    ['LEN({{t}})', { t: 'hello' }, 5],
    ['UPPER({{t}})', { t: 'hi' }, 'HI'],
    ['IF(ISBLANK({{t}}), "empty", "set")', { t: null }, 'empty'],
    ['MOD({{a}}, 3)', { a: 10 }, 1],
  ])('%s → %s', (src, vars, expected) => expect(run(src, vars as never)).toEqual(expected));

  it('turns errors into null instead of throwing', () => {
    expect(run('{{a}} / 0', { a: 1 })).toBeNull();
    expect(run('NOSUCHFN({{a}})', { a: 1 })).toBeNull();
    expect(run('SQRT(-1)')).toBeNull();
  });

  it('rejects cell references and ranges', () => {
    expect(() => compileFormula('A1 + 1')).toThrow(FormulaDefinitionError);
    expect(() => compileFormula('SUM(A1:B2)')).toThrow(/cell/i);
  });

  it('rejects malformed placeholders and syntax errors with a position', () => {
    expect(() => compileFormula('{{bad-key}} + 1')).toThrow(FormulaDefinitionError);
    try {
      compileFormula('1 +');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(FormulaDefinitionError);
    }
  });

  it('lists unique refs in order of appearance', () => {
    expect(formulaRefs('{{b}} + {{a}} * {{b}}')).toEqual(['b', 'a']);
    expect(compileFormula('{{b}} + {{a}} * {{b}}').refs).toEqual(['b', 'a']);
  });
});
