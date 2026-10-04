import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { todaySerial } from '@qub/shared/formula';
import { spreadsheetCells, spreadsheetSheets } from '../src/db/schema';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Round1');
  bob = await registerUser(ctx.app, 'Bob Round1');
});
afterAll(async () => {
  await ctx.close();
});

async function newSheet(title = 'Round1') {
  const s = data(await client(ctx.app, alice).post('/api/sheets', { title }));
  return { id: s.id as string, fileId: s.fileId as string, sheetId: s.sheets[0].id as string };
}
const at = (ref: string) => ({ row: Number(ref.slice(1)) - 1, col: ref.charCodeAt(0) - 65 });
const set = (sheetId: string, cells: Record<string, string>) => ({ type: 'setCells', sheetId, cells: Object.entries(cells).map(([ref, input]) => ({ ...at(ref), input })) });
const ops = (id: string, list: unknown[], user = alice) => client(ctx.app, user).post(`/api/sheets/${id}/ops`, { ops: list });
async function cells(id: string, sheetId: string) {
  const res = data(await client(ctx.app, alice).get(`/api/sheets/${id}/worksheets/${sheetId}/cells?rowStart=0&rowEnd=200&colStart=0&colEnd=20`));
  return new Map<string, any>(res.cells.map((c: { row: number; col: number }) => [`${String.fromCharCode(65 + c.col)}${c.row + 1}`, c]));
}
const replaceAll = (sheetId: string | null, find: string, replace: string) => ({ type: 'findReplace', sheetId, find, replace, matchCase: false, wholeCell: false, includeFormulas: false });

describe('find and replace', () => {
  it('finds across sheets and replaces all, including cells no client loaded, with previous inputs for undo', async () => {
    const s = await newSheet();
    const second = data(await client(ctx.app, alice).post(`/api/sheets/${s.id}/worksheets`, {}))[1].id as string;
    await ops(s.id, [set(s.sheetId, { A1: 'apple pie', B150: 'Apple', C1: '=UPPER("apple")' }), set(second, { A1: 'apple' })]);

    const found = data(await client(ctx.app, alice).get(`/api/sheets/${s.id}/find?q=apple`));
    expect(found.total).toBe(3);
    expect(found.matches.map((m: any) => `${m.sheetId === s.sheetId ? 1 : 2}:${m.row}:${m.col}`)).toEqual(['1:0:0', '1:149:1', '2:0:0']);
    expect(data(await client(ctx.app, alice).get(`/api/sheets/${s.id}/find?q=apple&includeFormulas=true`)).total).toBe(4);
    expect(data(await client(ctx.app, alice).get(`/api/sheets/${s.id}/find?q=apple&sheetId=${second}`)).total).toBe(1);

    const res = data(await ops(s.id, [replaceAll(null, 'apple', 'pear')]));
    expect(res.replaced).toHaveLength(3);
    expect(res.replaced).toContainEqual({ sheetId: s.sheetId, row: 149, col: 1, previousInput: 'Apple' });
    const after = await cells(s.id, s.sheetId);
    expect(after.get('A1').input).toBe('pear pie');
    expect(after.get('B150').input).toBe('pear');
    expect(after.get('C1').input).toBe('=UPPER("apple")');
  });

  it('re-parses replaced text and refuses more than 10,000 matches without changing anything', async () => {
    const s = await newSheet();
    await ops(s.id, [set(s.sheetId, { A1: 'n5' })]);
    await ops(s.id, [replaceAll(s.sheetId, 'n', '')]);
    expect((await cells(s.id, s.sheetId)).get('A1').value).toBe(5);

    const many = Array.from({ length: 10_001 }, (_, i) => ({ row: i, col: 1, input: 'x' }));
    await ops(s.id, [{ type: 'setCells', sheetId: s.sheetId, cells: many.slice(0, 10_000) }]);
    await ops(s.id, [{ type: 'setCells', sheetId: s.sheetId, cells: many.slice(10_000) }]);
    const res = await ops(s.id, [replaceAll(s.sheetId, 'x', 'y')]);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/Too many matches to replace at once \(10001\)/);
    expect((await cells(s.id, s.sheetId)).get('B1').input).toBe('x');
  });

  it('viewers can find but not replace', async () => {
    const s = await newSheet();
    await ops(s.id, [set(s.sheetId, { A1: 'apple' })]);
    await client(ctx.app, alice).post(`/api/drive/files/${s.fileId}/share`, { email: bob.email, role: 'VIEWER', notify: false });
    expect(data(await client(ctx.app, bob).get(`/api/sheets/${s.id}/find?q=apple`)).total).toBe(1);
    expect((await ops(s.id, [replaceAll(null, 'apple', 'x')], bob)).statusCode).toBe(403);
  });
});

describe('dates, styles and volatile formulas', () => {
  it('stores typed dates with a date format and keeps validation and borders through inserts and sorts', async () => {
    const s = await newSheet();
    const thin = { style: 'thin', color: '#000000' };
    await ops(s.id, [
      set(s.sheetId, { A1: 'b', A2: 'a', B1: '2026-09-27' }),
      { type: 'setStyle', sheetId: s.sheetId, range: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }, style: { validation: { kind: 'list', values: ['a', 'b'] }, borders: { top: thin } } },
    ]);
    let c = await cells(s.id, s.sheetId);
    expect(c.get('B1')).toMatchObject({ value: 46292, formattedValue: '2026-09-27', style: { numberFormat: 'date' } });
    await ops(s.id, [{ type: 'insertRows', sheetId: s.sheetId, index: 0, count: 1 }]);
    await ops(s.id, [{ type: 'sortRange', sheetId: s.sheetId, range: { startRow: 1, endRow: 2, startCol: 0, endCol: 1 }, col: 0, direction: 'asc', hasHeader: false }]);
    c = await cells(s.id, s.sheetId);
    expect(c.get('A3')).toMatchObject({ input: 'b', style: { validation: { kind: 'list', values: ['a', 'b'] }, borders: { top: thin } } });
  });

  it('checkbox validation fills empty cells with FALSE on the server', async () => {
    const s = await newSheet();
    await ops(s.id, [{ type: 'setStyle', sheetId: s.sheetId, range: { startRow: 0, endRow: 1, startCol: 0, endCol: 0 }, style: { validation: { kind: 'checkbox' } } }]);
    const c = await cells(s.id, s.sheetId);
    expect(c.get('A1')).toMatchObject({ value: false, input: 'FALSE' });
    const rows = await ctx.db.db.select().from(spreadsheetCells).where(eq(spreadsheetCells.sheetId, s.sheetId));
    expect(rows).toHaveLength(2);
  });

  it('recalculates TODAY() when the spreadsheet is opened on a later day', async () => {
    const s = await newSheet();
    // Anchor at the real time (moving the clock backwards would make existing tokens look issued in the future).
    const start = new Date();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(start);
      await ops(s.id, [set(s.sheetId, { A1: '=TODAY()' })]);
      expect((await cells(s.id, s.sheetId)).get('A1').value).toBe(todaySerial(start));
      vi.setSystemTime(new Date(start.getTime() + 2 * 86_400_000));
      // The access token issued before the jump has expired: sign in again "today", then open the spreadsheet.
      const login = await ctx.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: alice.email, password: 'correct-horse-1' } });
      const today = { token: login.json().data.accessToken as string };
      expect((await client(ctx.app, today).get(`/api/sheets/${s.id}`)).statusCode).toBe(200);
      const res = data(await client(ctx.app, today).get(`/api/sheets/${s.id}/worksheets/${s.sheetId}/cells?rowStart=0&rowEnd=5&colStart=0&colEnd=5`));
      expect(res.cells.find((c: { row: number; col: number }) => c.row === 0 && c.col === 0).value).toBe(todaySerial(start) + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives RAND() and RANDBETWEEN() new values when the spreadsheet is opened', async () => {
    const s = await newSheet();
    await ops(s.id, [set(s.sheetId, { A1: '=RAND()', B1: '=RANDBETWEEN(1, 1000000000)' })]);
    const before = await cells(s.id, s.sheetId);
    expect((await client(ctx.app, alice).get(`/api/sheets/${s.id}`)).statusCode).toBe(200);
    const after = await cells(s.id, s.sheetId);
    expect(after.get('A1').value).not.toBe(before.get('A1').value);
    expect(after.get('B1').value).not.toBe(before.get('B1').value);
  });
});

describe('CSV', () => {
  it('exports formatted values with BOM, CRLF, quoting and formula neutralising; 403 without download permission', async () => {
    const s = await newSheet('Budget');
    await ops(s.id, [set(s.sheetId, { A1: 'item', B1: 'amount', A2: 'a, "b"', B2: '1234.5', A3: "'=cmd", B3: '=B2*2', C3: '2026-09-27' })]);
    await ops(s.id, [{ type: 'setStyle', sheetId: s.sheetId, range: { startRow: 1, endRow: 2, startCol: 1, endCol: 1 }, style: { numberFormat: 'currency' } }]);
    const res = await client(ctx.app, alice).get(`/api/sheets/${s.id}/worksheets/${s.sheetId}/export.csv`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('Budget%20-%20Sheet1.csv');
    expect(res.body).toBe('﻿item,amount,\r\n"a, ""b""","$1,234.50",\r\n\'=cmd,"$2,469.00",2026-09-27\r\n');

    await client(ctx.app, alice).post(`/api/drive/files/${s.fileId}/share`, { email: bob.email, role: 'VIEWER', notify: false, canDownload: false });
    expect((await client(ctx.app, bob).get(`/api/sheets/${s.id}/worksheets/${s.sheetId}/export.csv`)).statusCode).toBe(403);
  });

  it('imports into a new sheet, typing values and never creating formulas; round-trips an export', async () => {
    const s = await newSheet();
    const csv = 'name,qty,when,evil\r\n"Widget, large",3,2026-09-27,=HYPERLINK("http://x")\r\nGadget,-4.5,,@SUM(1)\r\n';
    const res = await client(ctx.app, alice).upload(`/api/sheets/${s.id}/import?mode=new_sheet`, 'Stock list.csv', csv, 'text/csv');
    expect(res.statusCode).toBe(200);
    const { sheetId, rows, cols } = data(res);
    expect({ rows, cols }).toEqual({ rows: 3, cols: 4 });
    const sheetsNow = data(await client(ctx.app, alice).get(`/api/sheets/${s.id}`)).sheets;
    expect(sheetsNow.find((x: any) => x.id === sheetId).name).toBe('Stock list');
    const c = await cells(s.id, sheetId);
    expect(c.get('A2').value).toBe('Widget, large');
    expect(c.get('B2').value).toBe(3);
    expect(c.get('B3').value).toBe(-4.5);
    expect(c.get('C2')).toMatchObject({ value: 46292, style: { numberFormat: 'date' } });
    expect(c.get('D2')).toMatchObject({ input: '\'=HYPERLINK("http://x")', value: '=HYPERLINK("http://x")', dataType: 'STRING' });
    expect(c.get('D3').value).toBe('@SUM(1)');
    const versions = data(await client(ctx.app, alice).get(`/api/sheets/${s.id}/versions`));
    expect(versions.map((v: any) => v.name)).toContain('Before CSV import');

    const exported = (await client(ctx.app, alice).get(`/api/sheets/${s.id}/worksheets/${sheetId}/export.csv`)).body;
    const again = data(await client(ctx.app, alice).upload(`/api/sheets/${s.id}/import?mode=new_sheet`, 'Stock list.csv', exported, 'text/csv'));
    const c2 = await cells(s.id, again.sheetId);
    for (const ref of ['A2', 'B2', 'B3', 'C2', 'D2', 'D3']) expect(c2.get(ref).value).toEqual(c.get(ref).value);
    const names = data(await client(ctx.app, alice).get(`/api/sheets/${s.id}`)).sheets.map((x: any) => x.name);
    expect(names).toContain('Stock list (2)');
    expect(names).toHaveLength(sheetsNow.length + 1);
  });

  it('replaces the current sheet, rejects malformed or oversized files and viewers', async () => {
    const s = await newSheet();
    await ops(s.id, [set(s.sheetId, { A1: 'old', Z50: 'old too' }), { type: 'setStyle', sheetId: s.sheetId, range: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }, style: { bold: true } }]);
    const ok = await client(ctx.app, alice).upload(`/api/sheets/${s.id}/import?mode=replace_sheet&sheetId=${s.sheetId}`, 'x.csv', 'new\n', 'text/csv');
    expect(ok.statusCode).toBe(200);
    const c = await cells(s.id, s.sheetId);
    expect(c.get('A1')).toMatchObject({ input: 'new', style: null });
    expect(await ctx.db.db.select().from(spreadsheetCells).where(eq(spreadsheetCells.sheetId, s.sheetId))).toHaveLength(1);

    const bad = await client(ctx.app, alice).upload(`/api/sheets/${s.id}/import?mode=new_sheet`, 'bad.csv', 'a,b\n"open,c\n', 'text/csv');
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.message).toMatch(/line 2/);

    const tooWide = Array.from({ length: 703 }, () => 'x').join(',');
    expect((await client(ctx.app, alice).upload(`/api/sheets/${s.id}/import?mode=new_sheet`, 'wide.csv', tooWide, 'text/csv')).statusCode).toBe(400);
    expect((await client(ctx.app, alice).upload(`/api/sheets/${s.id}/import?mode=replace_sheet`, 'x.csv', 'a\n', 'text/csv')).statusCode).toBe(400);
    const huge = await client(ctx.app, alice).upload(`/api/sheets/${s.id}/import?mode=new_sheet`, 'huge.csv', 'x,'.repeat(5_600_000), 'text/csv');
    expect([400, 413]).toContain(huge.statusCode);

    await client(ctx.app, alice).post(`/api/drive/files/${s.fileId}/share`, { email: bob.email, role: 'VIEWER', notify: false });
    expect((await client(ctx.app, bob).upload(`/api/sheets/${s.id}/import?mode=new_sheet`, 'x.csv', 'a\n', 'text/csv')).statusCode).toBe(403);
  });
});

describe('op delivery', () => {
  it('applies an op once even when the client resends the same clientOpId (e.g. after a reconnect)', async () => {
    const s = await newSheet();
    await ops(s.id, [set(s.sheetId, { A1: 'a' })]);
    const send = () => client(ctx.app, alice).post(`/api/sheets/${s.id}/ops`, { clientOpId: 'resend-1', ops: [replaceAll(null, 'a', 'aa')] });
    const first = data(await send());
    const second = data(await send());
    expect((await cells(s.id, s.sheetId)).get('A1').input).toBe('aa');
    expect(second.replaced).toEqual(first.replaced);
    expect(second.changes).toEqual([]);
  });
});

describe('CSV replace and other sheets', () => {
  it('recalculates and persists formulas on other sheets that read the replaced sheet', async () => {
    const s = await newSheet();
    const second = data(await client(ctx.app, alice).post(`/api/sheets/${s.id}/worksheets`, {}))[1].id as string;
    await ops(s.id, [set(s.sheetId, { Z50: '7' }), set(second, { A1: '=Sheet1!Z50*2' })]);
    expect((await cells(s.id, second)).get('A1').value).toBe(14);
    const res = await client(ctx.app, alice).upload(`/api/sheets/${s.id}/import?mode=replace_sheet&sheetId=${s.sheetId}`, 'x.csv', 'new\n', 'text/csv');
    expect(res.statusCode).toBe(200);
    const [row] = await ctx.db.db.select().from(spreadsheetCells).where(eq(spreadsheetCells.sheetId, second));
    expect(row!.valueNumber).toBe(0);
  });

  it('resets row heights (sized for the old content) but keeps column widths and frozen panes', async () => {
    const s = await newSheet();
    const patched = await client(ctx.app, alice).patch(`/api/sheets/${s.id}/worksheets/${s.sheetId}`, { rowHeights: { '5': 120 }, colWidths: { '0': 200 }, frozenRows: 1 });
    expect(patched.statusCode).toBe(200);
    const [before] = await ctx.db.db.select().from(spreadsheetSheets).where(eq(spreadsheetSheets.id, s.sheetId));
    expect(before!.rowHeights).toEqual({ '5': 120 });
    const res = await client(ctx.app, alice).upload(`/api/sheets/${s.id}/import?mode=replace_sheet&sheetId=${s.sheetId}`, 'x.csv', 'new\n', 'text/csv');
    expect(res.statusCode).toBe(200);
    const [meta] = await ctx.db.db.select().from(spreadsheetSheets).where(eq(spreadsheetSheets.id, s.sheetId));
    expect(meta!.rowHeights).toEqual({});
    expect(meta).toMatchObject({ colWidths: { '0': 200 }, frozenRows: 1 });
  });
});

describe('replace-all limits', () => {
  it('refuses replacements that would make a cell longer than 50,000 characters, changing nothing', async () => {
    const s = await newSheet();
    await ops(s.id, [set(s.sheetId, { A1: 'a'.repeat(100) })]);
    const res = await ops(s.id, [replaceAll(s.sheetId, 'a', 'b'.repeat(600))]);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/50,000 characters/);
    expect((await cells(s.id, s.sheetId)).get('A1').input).toBe('a'.repeat(100));
  });
});

describe('CSV export of an empty sheet', () => {
  it('returns just the BOM', async () => {
    const s = await newSheet();
    const res = await client(ctx.app, alice).get(`/api/sheets/${s.id}/worksheets/${s.sheetId}/export.csv`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('﻿');
  });
});

describe('print data', () => {
  it('returns every cell of the sheet (styled blanks too, beyond one fetch window) with its metadata; 403 without download permission', async () => {
    const s = await newSheet('Printable');
    await ops(s.id, [
      set(s.sheetId, { A1: 'Name', B1: 'Total', A2: 'x', B2: '=2*21' }),
      { type: 'setCells', sheetId: s.sheetId, cells: [{ row: 4999, col: 250, input: 'far away' }] },
      { type: 'setStyle', sheetId: s.sheetId, range: { startRow: 2, endRow: 2, startCol: 0, endCol: 0 }, style: { background: '#fce8e6' } },
    ]);
    await client(ctx.app, alice).patch(`/api/sheets/${s.id}/worksheets/${s.sheetId}`, { colWidths: { '0': 180 } });
    const res = await client(ctx.app, alice).get(`/api/sheets/${s.id}/worksheets/${s.sheetId}/print`);
    expect(res.statusCode).toBe(200);
    const body = data(res);
    expect(body.sheet).toMatchObject({ id: s.sheetId, name: 'Sheet1', colWidths: { '0': 180 } });
    const byRef = new Map(body.cells.map((c: any) => [`${c.row}:${c.col}`, c]));
    expect(byRef.get('1:1')).toMatchObject({ formattedValue: '42' });
    expect(byRef.get('4999:250')).toMatchObject({ formattedValue: 'far away' });
    expect(byRef.get('2:0')).toMatchObject({ style: { background: '#fce8e6' } });
    expect(body.cells).toHaveLength(6);

    await client(ctx.app, alice).post(`/api/drive/files/${s.fileId}/share`, { email: bob.email, role: 'VIEWER', notify: false, canDownload: false });
    expect((await client(ctx.app, bob).get(`/api/sheets/${s.id}/worksheets/${s.sheetId}/print`)).statusCode).toBe(403);
  });
});
