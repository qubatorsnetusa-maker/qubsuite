import { describe, expect, it } from 'vitest';
import { csvImportInput, CsvError, detectDelimiter, parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded newlines, CRLF and BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"multi\nline",3\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['multi\nline', '3'],
    ]);
  });
  it('detects ; and tab delimiters and keeps empty fields', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(parseCsv('a;b;;\n1;2;3;4')).toEqual([['a', 'b', '', ''], ['1', '2', '3', '4']]);
    expect(parseCsv('a\tb\n"c;d"\te')).toEqual([['a', 'b'], ['c;d', 'e']]);
  });
  it('reports the line of an unterminated quote', () => {
    try {
      parseCsv('a,b\nc,"oops\nd');
      throw new Error('expected failure');
    } catch (e) {
      expect(e).toBeInstanceOf(CsvError);
      expect((e as CsvError).line).toBe(2);
    }
  });
});

describe('toCsv', () => {
  it('writes BOM, CRLF, quotes and neutralises formula-like text only', () => {
    const out = toCsv([
      [{ text: 'name', isText: true }, { text: 'n', isText: true }],
      [{ text: 'a,b', isText: true }, { text: '-5', isText: false }],
      [{ text: '=HYPERLINK("x")', isText: true }, { text: '', isText: true }],
    ]);
    expect(out).toBe('﻿name,n\r\n"a,b",-5\r\n"\'=HYPERLINK(""x"")",\r\n');
  });
});

describe('csvImportInput', () => {
  it('never creates formulas and keeps numbers', () => {
    expect(csvImportInput('=1+1')).toBe("'=1+1");
    expect(csvImportInput('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvImportInput('-5')).toBe('-5');
    expect(csvImportInput('+3')).toBe("'+3");
    expect(csvImportInput("'already")).toBe("'already");
    expect(csvImportInput('plain')).toBe('plain');
  });
});

describe('csvLine', () => {
  it('builds one CRLF-terminated line with the same quoting rules as toCsv', async () => {
    const { csvLine } = await import('./csv');
    expect(csvLine([{ text: 'a,b', isText: true }, { text: '-5', isText: false }, { text: '@x', isText: true }])).toBe('"a,b",-5,\'@x\r\n');
  });
});
