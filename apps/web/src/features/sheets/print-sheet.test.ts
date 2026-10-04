import type { CellDto, SheetPrintData, WorksheetDto } from '@qub/shared';
import { describe, expect, it } from 'vitest';
import { buildPrintHtml } from './print-sheet';

const sheet: WorksheetDto = { id: 's1', name: 'Budget', position: 0, rowCount: 1000, colCount: 26, frozenRows: 0, frozenCols: 0, colWidths: {}, rowHeights: {} };
const cell = (row: number, col: number, formattedValue: string, extra: Partial<CellDto> = {}): CellDto => ({
  row,
  col,
  input: formattedValue,
  value: formattedValue,
  formattedValue,
  dataType: 'STRING',
  style: null,
  ...extra,
});
const data = (cells: CellDto[], over: Partial<WorksheetDto> = {}): SheetPrintData => ({ spreadsheetTitle: 'Family', sheet: { ...sheet, ...over }, cells });
/** 7px per character, like a narrow sans-serif. */
const measure = (t: string) => t.length * 7;
const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('buildPrintHtml', () => {
  it('prints only the used area of the sheet, as a table, titled after the spreadsheet and sheet', () => {
    const d = doc(buildPrintHtml(data([cell(0, 0, 'Item'), cell(1, 2, '12', { dataType: 'NUMBER', value: 12 })]), new Set(), measure));
    expect(d.title).toBe('Family - Budget');
    const rows = d.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelectorAll('td')).toHaveLength(3);
    expect(d.querySelectorAll('col')).toHaveLength(3);
    expect(rows[1]!.querySelectorAll('td')[2]!.textContent).toBe('12');
    expect(rows[1]!.querySelectorAll('td')[2]!.getAttribute('style')).toContain('text-align:right');
    // Nothing but the sheet: no headings, menus or other text.
    expect(d.body.textContent).toBe('Item12');
  });

  it('carries formatting, borders, column widths and row heights; escapes text', () => {
    const d = doc(
      buildPrintHtml(
        data([cell(0, 0, '<b>&', { style: { bold: true, italic: true, color: '#d93025', background: '#fef7e0', align: 'center', borders: { bottom: { style: 'thick', color: '#000000' } } } })], {
          colWidths: { '0': 180 },
          rowHeights: { '0': 40 },
        }),
        new Set(),
        measure,
      ),
    );
    const td = d.querySelector('td')!;
    expect(td.textContent).toBe('<b>&');
    const css = td.getAttribute('style')!;
    for (const part of ['font-weight:600', 'font-style:italic', 'color:#d93025', 'background:#fef7e0', 'text-align:center', 'border-bottom:3px solid #000000']) expect(css).toContain(part);
    expect(d.querySelector('col')!.getAttribute('style')).toBe('width:180px');
    expect(d.querySelector('tr')!.getAttribute('style')).toBe('height:40px');
  });

  it('repeats frozen rows on every page and leaves out rows hidden by a filter', () => {
    const d = doc(buildPrintHtml(data([cell(0, 0, 'Head'), cell(1, 0, 'keep'), cell(2, 0, 'filtered out'), cell(3, 0, 'last')], { frozenRows: 1 }), new Set([2]), measure));
    expect(d.querySelector('thead')!.textContent).toBe('Head');
    expect([...d.querySelectorAll('tbody tr')].map((r) => r.textContent)).toEqual(['keep', 'last']);
  });

  it('spills long text over empty neighbours and shows ### for numbers that cannot fit', () => {
    const long = 'A heading much wider than one column';
    const d = doc(
      buildPrintHtml(
        data([cell(0, 0, long), cell(0, 4, 'x'), cell(1, 0, 'label'), cell(1, 1, '123456789012345', { dataType: 'NUMBER', value: 123456789012345 })]),
        new Set(),
        measure,
      ),
    );
    const first = d.querySelectorAll('tr')[0]!.querySelectorAll('td');
    expect(first[0]!.getAttribute('colspan')).toBe('3');
    expect(first[0]!.textContent).toBe(long);
    expect(first).toHaveLength(3); // spanned cell, D1, E1
    const second = d.querySelectorAll('tr')[1]!.querySelectorAll('td');
    expect(second[1]!.textContent).toMatch(/^#+$/);
  });

  it('prints checkboxes as ☑ / ☐ and styled blank cells', () => {
    const cb = { style: { validation: { kind: 'checkbox' as const } } };
    const d = doc(buildPrintHtml(data([cell(0, 0, 'TRUE', { ...cb, value: true, dataType: 'BOOLEAN' }), cell(0, 1, 'FALSE', { ...cb, value: false, dataType: 'BOOLEAN' }), cell(2, 2, '', { style: { background: '#e6f4ea' } })]), new Set(), measure));
    const tds = d.querySelectorAll('td');
    expect(tds[0]!.textContent).toBe('☑');
    expect(tds[1]!.textContent).toBe('☐');
    expect(d.querySelectorAll('tr')).toHaveLength(3);
  });

  it('fits a wide sheet to the page, in landscape', () => {
    const cells = Array.from({ length: 15 }, (_, c) => cell(0, c, 'v'));
    const html = buildPrintHtml(data(cells), new Set(), measure);
    expect(html).toContain('size:landscape');
    expect(html).toMatch(/zoom:0\.6733/); // 1010 / 1500
    expect(buildPrintHtml(data([cell(0, 0, 'v')]), new Set(), measure)).toContain('size:portrait');
  });

  it('says so when the sheet is empty', () => {
    expect(doc(buildPrintHtml(data([]), new Set(), measure)).body.textContent).toBe('This sheet is empty.');
  });
});
