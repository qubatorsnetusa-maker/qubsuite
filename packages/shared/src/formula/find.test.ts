import { describe, expect, it } from 'vitest';
import { cellMatches, replaceInInput, type FindOptions } from './find';
import { Workbook } from './workbook';

const o = (x: Partial<FindOptions> = {}): FindOptions => ({ find: 'a', matchCase: false, wholeCell: false, includeFormulas: false, ...x });

describe('find rules', () => {
  it('matches text case-insensitively unless asked, skipping formulas unless included', () => {
    expect(cellMatches('Banana', o())).toBe(true);
    expect(cellMatches('BANANA', o({ matchCase: true }))).toBe(false);
    expect(cellMatches('=A1', o({ find: 'A1' }))).toBe(false);
    expect(cellMatches('=A1', o({ find: 'A1', includeFormulas: true }))).toBe(true);
    expect(cellMatches('ab', o({ wholeCell: true }))).toBe(false);
  });
  it('replaces every occurrence once, literally', () => {
    expect(replaceInInput('a a', 'aa', o())).toBe('aa aa');
    expect(replaceInInput('cost $5', '$&', o({ find: '$5' }))).toBe('cost $&');
    expect(replaceInInput('xyz', 'q', o())).toBeNull();
    expect(replaceInInput('A', 'b', o({ wholeCell: true }))).toBe('b');
  });
  it('Workbook.findMatches orders by sheet, row, col', () => {
    const wb = new Workbook();
    wb.addSheet({ id: 's1', name: 'One' });
    wb.addSheet({ id: 's2', name: 'Two' });
    wb.setInputs('s2', [{ row: 0, col: 0, input: 'apple' }]);
    wb.setInputs('s1', [{ row: 1, col: 0, input: 'grape' }, { row: 0, col: 2, input: 'pear' }]);
    expect(wb.findMatches(['s1', 's2'], o()).map((m) => `${m.sheetId}!${m.row}:${m.col}`)).toEqual(['s1!0:2', 's1!1:0', 's2!0:0']);
  });
});
