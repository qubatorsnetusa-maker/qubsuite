import { describe, expect, it, vi } from 'vitest';
import { todaySerial } from './dates';
import { isError } from './values';
import { Workbook } from './workbook';

function book(cells: Record<string, string> = {}) {
  const wb = new Workbook();
  wb.addSheet({ id: 's1', name: 'Sheet1' });
  const at = (ref: string) => ({ col: ref.charCodeAt(0) - 65, row: Number(ref.slice(1)) - 1 });
  wb.setInputs('s1', Object.entries(cells).map(([ref, input]) => ({ ...at(ref), input })));
  return {
    wb,
    calc(formula: string) {
      wb.setInputs('s1', [{ row: 99, col: 25, input: formula }]);
      const v = wb.getCell('s1', 99, 25)!.value;
      return isError(v) ? v.code : v;
    },
  };
}

const table = { A1: 'apple', B1: '10', A2: 'banana', B2: '20', A3: 'cherry', B3: '30' };

describe('lookup', () => {
  it('VLOOKUP exact and sorted', () => {
    const { calc } = book({ ...table, D1: '1', E1: 'low', D2: '15', E2: 'mid', D3: '25', E3: 'high' });
    expect(calc('=VLOOKUP("banana", A1:B3, 2, FALSE)')).toBe(20);
    expect(calc('=VLOOKUP("BANANA", A1:B3, 2)')).toBe(20);
    expect(calc('=VLOOKUP("kiwi", A1:B3, 2, FALSE)')).toBe('#N/A');
    expect(calc('=VLOOKUP(17, D1:E3, 2, TRUE)')).toBe('mid');
    expect(calc('=VLOOKUP(0, D1:E3, 2, TRUE)')).toBe('#N/A');
    expect(calc('=VLOOKUP("apple", A1:B3, 3, FALSE)')).toBe('#REF!');
    expect(calc('=VLOOKUP("apple", A1:B3, 0, FALSE)')).toBe('#VALUE!');
  });

  it('HLOOKUP', () => {
    const { calc } = book({ A1: 'x', B1: 'y', A2: '1', B2: '2' });
    expect(calc('=HLOOKUP("y", A1:B2, 2, FALSE)')).toBe(2);
  });

  it('INDEX and MATCH', () => {
    const { calc } = book(table);
    expect(calc('=INDEX(A1:B3, 3, 2)')).toBe(30);
    expect(calc('=INDEX(B1:B3, 2)')).toBe(20);
    expect(calc('=INDEX(A1:B1, 2)')).toBe(10);
    expect(calc('=INDEX(A1:B3, 4, 1)')).toBe('#REF!');
    expect(calc('=MATCH("cherry", A1:A3, 0)')).toBe(3);
    expect(calc('=MATCH(25, B1:B3, 1)')).toBe(2);
    expect(calc('=MATCH(5, B1:B3, 1)')).toBe('#N/A');
    expect(calc('=INDEX(B1:B3, MATCH("banana", A1:A3, 0))')).toBe(20);
  });

  it('MATCH -1 on a descending list', () => {
    const { calc } = book({ A1: '30', A2: '20', A3: '10' });
    expect(calc('=MATCH(25, A1:A3, -1)')).toBe(1);
  });

  it('XLOOKUP', () => {
    const { calc } = book(table);
    expect(calc('=XLOOKUP("cherry", A1:A3, B1:B3)')).toBe(30);
    expect(calc('=XLOOKUP("kiwi", A1:A3, B1:B3, "none")')).toBe('none');
    expect(calc('=XLOOKUP("kiwi", A1:A3, B1:B3)')).toBe('#N/A');
    expect(calc('=XLOOKUP("apple", A1:A3, B1:B2)')).toBe('#VALUE!');
  });
});

describe('conditional aggregates', () => {
  const data = { A1: 'east', B1: 'x', C1: '10', A2: 'west', B2: 'x', C2: '20', A3: 'east', B3: 'y', C3: '30', A4: 'east', B4: 'x', C4: '40' };
  it('SUMIFS / COUNTIFS / AVERAGEIFS', () => {
    const { calc } = book(data);
    expect(calc('=SUMIFS(C1:C4, A1:A4, "east", B1:B4, "x")')).toBe(50);
    expect(calc('=COUNTIFS(A1:A4, "east", C1:C4, ">15")')).toBe(2);
    expect(calc('=AVERAGEIFS(C1:C4, A1:A4, "east")')).toBeCloseTo(26.6666667, 6);
    expect(calc('=AVERAGEIFS(C1:C4, A1:A4, "north")')).toBe('#DIV/0!');
    expect(calc('=SUMIFS(C1:C4, A1:A3, "east")')).toBe('#VALUE!');
  });
});

describe('rounding', () => {
  it('ROUNDUP / ROUNDDOWN away from / toward zero', () => {
    const { calc } = book();
    expect(calc('=ROUNDUP(3.14159, 2)')).toBe(3.15);
    expect(calc('=ROUNDUP(-3.14159, 2)')).toBe(-3.15);
    expect(calc('=ROUNDDOWN(3.999, 1)')).toBe(3.9);
    expect(calc('=ROUNDUP(1234, -2)')).toBe(1300);
    expect(calc('=ROUNDDOWN(2.5)')).toBe(2);
    expect(calc('=ROUNDUP(1.1)')).toBe(2);
  });
});

describe('dates', () => {
  it('build and take apart dates', () => {
    const { calc } = book({ A1: '2026-09-27', A2: '2026-01-31 18:45' });
    expect(calc('=DATE(2026, 9, 27)')).toBe(46292);
    expect(calc('=DATE(2026, 13, 1)')).toBe(calc('=DATE(2027, 1, 1)'));
    expect(calc('=DATE(26, 1, 1)')).toBe(calc('=DATE(1926, 1, 1)'));
    expect(calc('=YEAR(A1)&"-"&MONTH(A1)&"-"&DAY(A1)')).toBe('2026-9-27');
    expect(calc('=HOUR(A2)*100+MINUTE(A2)')).toBe(1845);
    expect(calc('=WEEKDAY(A1)')).toBe(1);
    expect(calc('=WEEKDAY(A1, 2)')).toBe(7);
    expect(calc('=WEEKDAY(A1, 3)')).toBe(6);
    expect(calc('=TIME(18, 45, 0)')).toBeCloseTo(18.75 / 24, 10);
    expect(calc('=YEAR("2026-09-27")')).toBe(2026);
    expect(calc('=YEAR("not a date")')).toBe('#VALUE!');
    expect(calc('=DATE(-1, 1, 1)')).toBe('#NUM!');
  });

  it('EDATE / EOMONTH clamp and cross years', () => {
    const { calc } = book({ A1: '2026-01-31' });
    expect(calc('=EDATE(A1, 1)')).toBe(calc('=DATE(2026, 2, 28)'));
    expect(calc('=EDATE(A1, -2)')).toBe(calc('=DATE(2025, 11, 30)'));
    expect(calc('=EOMONTH(A1, 1)')).toBe(calc('=DATE(2026, 2, 28)'));
    expect(calc('=EOMONTH(A1, 11)')).toBe(calc('=DATE(2026, 12, 31)'));
  });

  it('DATEDIF units', () => {
    const { calc } = book({ A1: '2020-02-15', A2: '2026-09-10' });
    expect(calc('=DATEDIF(A1, A2, "Y")')).toBe(6);
    expect(calc('=DATEDIF(A1, A2, "M")')).toBe(78);
    expect(calc('=DATEDIF(A1, A2, "D")')).toBe(calc('=A2-A1'));
    expect(calc('=DATEDIF(A1, A2, "YM")')).toBe(6);
    expect(calc('=DATEDIF(A1, A2, "MD")')).toBe(26);
    expect(calc('=DATEDIF(A1, A2, "YD")')).toBe(207); // 2026-02-15 → 2026-09-10
    expect(calc('=DATEDIF(A2, A1, "D")')).toBe('#NUM!');
    expect(calc('=DATEDIF(A1, A2, "Q")')).toBe('#NUM!');
  });

  it('DATEVALUE and TODAY', () => {
    const { calc } = book();
    expect(calc('=DATEVALUE("27 Sep 2026")')).toBe(46292);
    expect(calc('=DATEVALUE("banana")')).toBe('#VALUE!');
    expect(calc('=TODAY()')).toBe(todaySerial());
    expect(Math.abs((calc('=NOW()') as number) - (todaySerial() + (Date.now() % 86_400_000) / 86_400_000))).toBeLessThan(0.001);
  });
});

describe('text', () => {
  it('SUBSTITUTE / FIND / SEARCH / MID / PROPER / REPT', () => {
    const { calc } = book();
    expect(calc('=SUBSTITUTE("a-b-c", "-", "+")')).toBe('a+b+c');
    expect(calc('=SUBSTITUTE("a-b-c", "-", "+", 2)')).toBe('a-b+c');
    expect(calc('=FIND("b", "abcb")')).toBe(2);
    expect(calc('=FIND("b", "abcb", 3)')).toBe(4);
    expect(calc('=FIND("B", "abc")')).toBe('#VALUE!');
    expect(calc('=SEARCH("B", "abc")')).toBe(2);
    expect(calc('=SEARCH("a?c", "xxabc")')).toBe(3);
    expect(calc('=SEARCH("x*z", "axyyz")')).toBe(2);
    expect(calc('=MID("spreadsheet", 3, 4)')).toBe('read');
    expect(calc('=MID("abc", 0, 1)')).toBe('#VALUE!');
    expect(calc('=PROPER("hello WORLD-wide o\'neil")')).toBe("Hello World-Wide O'Neil");
    expect(calc('=REPT("ab", 3)')).toBe('ababab');
    expect(calc('=REPT("ab", -1)')).toBe('#VALUE!');
  });

  it('VALUE / TEXTJOIN', () => {
    const { calc } = book({ A1: 'x', A2: '', A3: 'z' });
    expect(calc('=VALUE("1,234.5")')).toBe(1234.5);
    expect(calc('=VALUE("2026-09-27")')).toBe(46292);
    expect(calc('=VALUE("abc")')).toBe('#VALUE!');
    expect(calc('=TEXTJOIN(", ", TRUE, A1:A3)')).toBe('x, z');
    expect(calc('=TEXTJOIN("-", FALSE, A1:A3, "w")')).toBe('x--z-w');
  });

  it('TEXT number and date patterns', () => {
    const { calc } = book({ A1: '2026-09-27 14:05:09' });
    expect(calc('=TEXT(1234.567, "#,##0.00")')).toBe('1,234.57');
    expect(calc('=TEXT(1234.567, "0")')).toBe('1235');
    expect(calc('=TEXT(0.256, "0.0%")')).toBe('25.6%');
    expect(calc('=TEXT(-1234.5, "$#,##0.00")')).toBe('-$1,234.50');
    expect(calc('=TEXT(A1, "yyyy-mm-dd")')).toBe('2026-09-27');
    expect(calc('=TEXT(A1, "mm/dd/yyyy")')).toBe('09/27/2026');
    expect(calc('=TEXT(A1, "d mmm yyyy")')).toBe('27 Sep 2026');
    expect(calc('=TEXT(A1, "mmmm d, yyyy")')).toBe('September 27, 2026');
    expect(calc('=TEXT(A1, "dddd")')).toBe('Sunday');
    expect(calc('=TEXT(A1, "hh:mm:ss")')).toBe('14:05:09');
    expect(calc('=TEXT(A1, "h:mm AM/PM")')).toBe('2:05 PM');
    expect(calc('=TEXT(A1, "yyyy [red]")')).toBe('#VALUE!');
  });
});

describe('volatile functions', () => {
  it('re-evaluates TODAY and its dependents on demand', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
    const { wb } = book({ A1: '=TODAY()', B1: '=A1+1', C1: '=1+1' });
    expect(wb.hasVolatile()).toBe(true);
    expect(wb.getCell('s1', 0, 0)!.value).toBe(46292);
    vi.setSystemTime(new Date('2026-09-28T12:00:00Z'));
    const changes = wb.recalculateVolatile();
    expect(wb.getCell('s1', 0, 0)!.value).toBe(46293);
    expect(wb.getCell('s1', 0, 1)!.value).toBe(46294);
    expect(changes.map((c) => `${c.row}:${c.col}`).sort()).toEqual(['0:0', '0:1']);
    wb.setInputs('s1', [{ row: 0, col: 0, input: '5' }]);
    expect(wb.hasVolatile()).toBe(false);
    vi.useRealTimers();
  });

  it('follows volatile cells when rows move', () => {
    const { wb } = book({ A1: '=TODAY()' });
    wb.applyStructuralChange('s1', 'row', 'insert', 0, 2);
    expect(wb.hasVolatile()).toBe(true);
    wb.setInputs('s1', [{ row: 0, col: 1, input: 'x' }]);
    wb.sortRange('s1', { startRow: 0, endRow: 2, startCol: 0, endCol: 0 }, 0, 'desc', false);
    const at = [0, 1, 2].find((r) => wb.getCell('s1', r, 0)?.input === '=TODAY()')!;
    expect(wb.hasVolatile()).toBe(true);
    // Overwriting the moved TODAY() cell must stop tracking it — proves the tracking followed the move.
    wb.setInputs('s1', [{ row: at, col: 0, input: '1' }]);
    expect(wb.hasVolatile()).toBe(false);
  });
});
