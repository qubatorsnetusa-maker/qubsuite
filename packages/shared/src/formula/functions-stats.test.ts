import { describe, expect, it } from 'vitest';
import { FUNCTIONS } from './functions';
import { isError } from './values';
import { Workbook } from './workbook';

function book(cells: Record<string, string> = {}) {
  const wb = new Workbook();
  wb.addSheet({ id: 's1', name: 'Sheet1' });
  const at = (ref: string) => ({ col: ref.charCodeAt(0) - 65, row: Number(ref.slice(1)) - 1 });
  wb.setInputs('s1', Object.entries(cells).map(([ref, input]) => ({ ...at(ref), input })));
  return (formula: string) => {
    wb.setInputs('s1', [{ row: 99, col: 25, input: formula }]);
    const v = wb.getCell('s1', 99, 25)!.value;
    return isError(v) ? v.code : v;
  };
}

// A1:A6 = 2, 4, 4, 4, 5, 5 (plus 7, 9 in A7:A8 for some tests); B = region labels.
const data = { A1: '2', A2: '4', A3: '4', A4: '4', A5: '5', A6: '5', A7: '7', A8: '9', B1: 'N', B2: 'S', B3: 'N', B4: 'S', B5: 'N', B6: 'S', B7: 'N', B8: 'S', C1: 'x', C2: '' };

describe('references to text cells in aggregates', () => {
  const calc = book({ A1: 'x', B1: '5', C1: '=1/0' });

  it('are ignored like text inside a range (typed text arguments still error)', () => {
    expect(calc('=SUM(A1, B1)')).toBe(5);
    expect(calc('=SUM(A1)')).toBe(0);
    expect(calc('=AVERAGE(A1, B1)')).toBe(5);
    expect(calc('=MAX(A1, B1)')).toBe(5);
    expect(calc('=COUNT(A1, B1)')).toBe(1);
    expect(calc('=SUM("x", 1)')).toBe('#VALUE!');
    expect(calc('=SUM("2", 1)')).toBe(3);
    expect(calc('=SUM(C1, B1)')).toBe('#DIV/0!');
  });
});

describe('statistical functions', () => {
  const calc = book(data);
  const close = (v: unknown, want: number) => expect(v as number).toBeCloseTo(want, 9);

  it('standard deviation and variance, sample and population', () => {
    close(calc('=STDEVP(A1:A8)'), 2);
    close(calc('=STDEV.P(A1:A8)'), 2);
    close(calc('=VARP(A1:A8)'), 4);
    close(calc('=VAR.P(A1:A8)'), 4);
    close(calc('=VAR(A1:A8)'), 32 / 7);
    close(calc('=VAR.S(A1:A8)'), 32 / 7);
    close(calc('=STDEV(A1:A8)'), Math.sqrt(32 / 7));
    close(calc('=STDEV.S(A1:A8)'), Math.sqrt(32 / 7));
    expect(calc('=STDEV(A1)')).toBe('#DIV/0!');
    expect(calc('=VARP(C1:C2)')).toBe('#DIV/0!');
    expect(calc('=VARP(C1)')).toBe('#DIV/0!');
  });

  it('MODE returns the most frequent value (first on ties) and #N/A when nothing repeats', () => {
    expect(calc('=MODE(A1:A8)')).toBe(4);
    expect(calc('=MODE.SNGL(5, 5, 2, 2)')).toBe(5);
    expect(calc('=MODE(1, 2, 3)')).toBe('#N/A');
  });

  it('LARGE, SMALL and RANK', () => {
    expect(calc('=LARGE(A1:A8, 1)')).toBe(9);
    expect(calc('=LARGE(A1:A8, 3)')).toBe(5);
    expect(calc('=SMALL(A1:A8, 2)')).toBe(4);
    expect(calc('=SMALL(A1:A8, 9)')).toBe('#NUM!');
    expect(calc('=LARGE(A1:A8, 0)')).toBe('#NUM!');
    expect(calc('=RANK(9, A1:A8)')).toBe(1);
    expect(calc('=RANK(4, A1:A8)')).toBe(5);
    expect(calc('=RANK.EQ(4, A1:A8, 1)')).toBe(2);
    expect(calc('=RANK(3, A1:A8)')).toBe('#N/A');
  });

  it('MAXIFS and MINIFS', () => {
    expect(calc('=MAXIFS(A1:A8, B1:B8, "N")')).toBe(7);
    expect(calc('=MINIFS(A1:A8, B1:B8, "S", A1:A8, ">4")')).toBe(5);
    expect(calc('=MAXIFS(A1:A8, B1:B8, "none")')).toBe(0);
    expect(calc('=MAXIFS(A1:A8, B1:B2, "N")')).toBe('#VALUE!');
  });

  it('SUMPRODUCT, SUMSQ and COUNTUNIQUE', () => {
    expect(calc('=SUMPRODUCT(A1:A3, A4:A6)')).toBe(2 * 4 + 4 * 5 + 4 * 5);
    expect(calc('=SUMPRODUCT(A1:A2, B1:B2)')).toBe(0);
    expect(calc('=SUMPRODUCT(A1:A3, A1:A2)')).toBe('#VALUE!');
    expect(calc('=SUMSQ(A1:A2, 3)')).toBe(4 + 16 + 9);
    expect(calc('=COUNTUNIQUE(A1:A8)')).toBe(5);
    expect(calc('=COUNTUNIQUE(B1:B8, C1:C2)')).toBe(3);
  });
});

describe('math functions', () => {
  const calc = book(data);

  it('CEILING, FLOOR, TRUNC and QUOTIENT', () => {
    expect(calc('=CEILING(4.2)')).toBe(5);
    expect(calc('=CEILING(22, 5)')).toBe(25);
    expect(calc('=CEILING(-4.2, -1)')).toBe(-5);
    expect(calc('=CEILING(4.2, -1)')).toBe('#NUM!');
    expect(calc('=FLOOR(4.8)')).toBe(4);
    expect(calc('=FLOOR(22, 5)')).toBe(20);
    expect(calc('=FLOOR(1.26, 0.1)')).toBeCloseTo(1.2, 12);
    expect(calc('=CEILING(0.3, 0.1)')).toBeCloseTo(0.3, 12);
    expect(calc('=TRUNC(-4.78)')).toBe(-4);
    expect(calc('=TRUNC(3.14159, 2)')).toBe(3.14);
    expect(calc('=QUOTIENT(7, 2)')).toBe(3);
    expect(calc('=QUOTIENT(-7, 2)')).toBe(-3);
    expect(calc('=QUOTIENT(1, 0)')).toBe('#DIV/0!');
  });

  it('SIGN, PI, EXP, LN, LOG, LOG10', () => {
    expect(calc('=SIGN(-3)')).toBe(-1);
    expect(calc('=SIGN(0)')).toBe(0);
    expect(calc('=PI()')).toBe(Math.PI);
    expect(calc('=EXP(1)')).toBe(Math.E);
    expect(calc('=LN(EXP(2))')).toBeCloseTo(2, 12);
    expect(calc('=LOG(1000)')).toBeCloseTo(3, 12);
    expect(calc('=LOG(8, 2)')).toBeCloseTo(3, 12);
    expect(calc('=LOG10(100)')).toBe(2);
    expect(calc('=LN(0)')).toBe('#NUM!');
    expect(calc('=LOG(10, 1)')).toBe('#DIV/0!');
  });

  it('RAND and RANDBETWEEN stay in range and are volatile', () => {
    for (let i = 0; i < 20; i++) {
      const r = calc('=RAND()') as number;
      expect(r >= 0 && r < 1).toBe(true);
      const n = calc('=RANDBETWEEN(3, 5)') as number;
      expect([3, 4, 5]).toContain(n);
    }
    expect(calc('=RANDBETWEEN(5, 3)')).toBe('#NUM!');
    expect(FUNCTIONS.RAND!.volatile).toBe(true);
    expect(FUNCTIONS.RANDBETWEEN!.volatile).toBe(true);
  });
});

describe('logical and text functions', () => {
  const calc = book(data);

  it('IFS returns the value of the first true condition, #N/A when none is', () => {
    expect(calc('=IFS(A1>5, "big", A1>1, "medium", TRUE, "small")')).toBe('medium');
    expect(calc('=IFS(A1>5, "big")')).toBe('#N/A');
    expect(calc('=IFS(A1>5)')).toBe('#N/A');
  });

  it('SWITCH matches cases with an optional default', () => {
    expect(calc('=SWITCH(B1, "N", "North", "S", "South")')).toBe('North');
    expect(calc('=SWITCH(A1, 1, "one", 2, "two")')).toBe('two');
    expect(calc('=SWITCH("W", "N", "North", "other")')).toBe('other');
    expect(calc('=SWITCH("W", "N", "North")')).toBe('#N/A');
  });

  it('IFNA, EXACT and ISTEXT', () => {
    expect(calc('=IFNA(MATCH(99, A1:A8, 0), "missing")')).toBe('missing');
    expect(calc('=IFNA(1/0, "missing")')).toBe('#DIV/0!');
    expect(calc('=EXACT("Hello", "hello")')).toBe(false);
    expect(calc('=EXACT("hi", "hi")')).toBe(true);
    expect(calc('=ISTEXT(B1)')).toBe(true);
    expect(calc('=ISTEXT(A1)')).toBe(false);
  });
});
