import type { AddressInfo } from 'node:net';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { spreadsheetCells, spreadsheetSheets } from '../src/db/schema';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Sheets');
  bob = await registerUser(ctx.app, 'Bob Sheets');
});
afterAll(async () => {
  await ctx.close();
});

async function newSheet(title = 'Budget') {
  const s = data(await client(ctx.app, alice).post('/api/sheets', { title }));
  return { id: s.id as string, fileId: s.fileId as string, sheetId: s.sheets[0].id as string };
}

const set = (sheetId: string, cells: Record<string, string>) => ({
  type: 'setCells',
  sheetId,
  cells: Object.entries(cells).map(([ref, input]) => ({ row: Number(ref.slice(1)) - 1, col: ref.charCodeAt(0) - 65, input })),
});

async function cells(id: string, sheetId: string) {
  const res = data(await client(ctx.app, alice).get(`/api/sheets/${id}/worksheets/${sheetId}/cells?rowStart=0&rowEnd=50&colStart=0&colEnd=10`));
  return new Map<string, { input: string; value: unknown; formattedValue: string }>(
    res.cells.map((c: { row: number; col: number }) => [`${String.fromCharCode(65 + c.col)}${c.row + 1}`, c]),
  );
}

describe('spreadsheet creation', () => {
  it('creates drive_file (SPREADSHEET) + spreadsheet + default worksheet', async () => {
    const s = await newSheet();
    const detail = data(await client(ctx.app, alice).get(`/api/sheets/${s.id}`));
    expect(detail.sheets).toHaveLength(1);
    expect(detail.sheets[0].name).toBe('Sheet1');
    const file = data(await client(ctx.app, alice).get(`/api/drive/files/${s.fileId}`));
    expect(file).toMatchObject({ fileType: 'SPREADSHEET', resourceId: s.id });
  });
});

describe('formula engine through the API', () => {
  it('stores formulas and computed values, and recalculates dependents (A1 → A3)', async () => {
    const s = await newSheet();
    const api = client(ctx.app, alice);
    const res = await api.post(`/api/sheets/${s.id}/ops`, { ops: [set(s.sheetId, { A1: '10', A2: '20', A3: '=SUM(A1:A2)', B1: '=IF(A1>5,"Yes","No")' })] });
    expect(res.statusCode).toBe(200);
    let c = await cells(s.id, s.sheetId);
    expect(c.get('A3')).toMatchObject({ input: '=SUM(A1:A2)', value: 30 });
    expect(c.get('B1')!.value).toBe('Yes');

    const applied = data(await api.post(`/api/sheets/${s.id}/ops`, { ops: [set(s.sheetId, { A1: '1' })] }));
    // The response reports the edited cell and every recalculated dependent.
    const changed = applied.changes[0].cells.map((x: { row: number; col: number }) => `${x.row}:${x.col}`).sort();
    expect(changed).toEqual(['0:0', '0:1', '2:0']);
    c = await cells(s.id, s.sheetId);
    expect(c.get('A3')!.value).toBe(21);
    expect(c.get('B1')!.value).toBe('No');
  });

  it('stores cells sparsely', async () => {
    const s = await newSheet();
    await client(ctx.app, alice).post(`/api/sheets/${s.id}/ops`, { ops: [set(s.sheetId, { A1: '1', J50: 'far' })] });
    const rows = await ctx.db.db.select().from(spreadsheetCells).where(eq(spreadsheetCells.sheetId, s.sheetId));
    expect(rows).toHaveLength(2);
    // Clearing a cell removes the row entirely.
    await client(ctx.app, alice).post(`/api/sheets/${s.id}/ops`, { ops: [set(s.sheetId, { J50: '' })] });
    expect(await ctx.db.db.select().from(spreadsheetCells).where(eq(spreadsheetCells.sheetId, s.sheetId))).toHaveLength(1);
  });

  it('inserts/deletes rows and rewrites references', async () => {
    const s = await newSheet();
    const api = client(ctx.app, alice);
    await api.post(`/api/sheets/${s.id}/ops`, { ops: [set(s.sheetId, { A1: '5', A2: '7', B1: '=A2*2' })] });
    await api.post(`/api/sheets/${s.id}/ops`, { ops: [{ type: 'insertRows', sheetId: s.sheetId, index: 1, count: 2 }] });
    let c = await cells(s.id, s.sheetId);
    expect(c.get('A4')!.value).toBe(7);
    expect(c.get('B1')).toMatchObject({ input: '=A4*2', value: 14 });
    await api.post(`/api/sheets/${s.id}/ops`, { ops: [{ type: 'deleteRows', sheetId: s.sheetId, index: 3, count: 1 }] });
    c = await cells(s.id, s.sheetId);
    expect(c.get('B1')).toMatchObject({ input: '=#REF!*2', value: '#REF!' });
  });

  it('sorts, filters and formats on the server', async () => {
    const s = await newSheet();
    const api = client(ctx.app, alice);
    await api.post(`/api/sheets/${s.id}/ops`, { ops: [set(s.sheetId, { A1: 'Item', B1: 'Cost', A2: 'pen', B2: '3', A3: 'desk', B3: '250', A4: 'lamp', B4: '40' })] });
    await api.post(`/api/sheets/${s.id}/ops`, {
      ops: [
        { type: 'sortRange', sheetId: s.sheetId, range: { startRow: 0, endRow: 3, startCol: 0, endCol: 1 }, col: 1, direction: 'desc', hasHeader: true },
        { type: 'setStyle', sheetId: s.sheetId, range: { startRow: 1, endRow: 3, startCol: 1, endCol: 1 }, style: { numberFormat: 'currency', bold: true } },
      ],
    });
    const c = await cells(s.id, s.sheetId);
    expect(['A2', 'A3', 'A4'].map((k) => c.get(k)!.value)).toEqual(['desk', 'lamp', 'pen']);
    expect(c.get('B2')!.formattedValue).toBe('$250.00');
    const filtered = data(await api.get(`/api/sheets/${s.id}/worksheets/${s.sheetId}/filter?col=1&op=gt&value=10`));
    expect(filtered.rows).toEqual([1, 2]);
  });

  it('supports multiple worksheets and cross-sheet formulas with renames', async () => {
    const s = await newSheet();
    const api = client(ctx.app, alice);
    const sheets = data(await api.post(`/api/sheets/${s.id}/worksheets`, { name: 'January' }));
    const jan = sheets.find((w: { name: string }) => w.name === 'January').id;
    await api.post(`/api/sheets/${s.id}/ops`, { ops: [set(jan, { A1: '99' }), set(s.sheetId, { A1: '=January!A1+1' })] });
    expect((await cells(s.id, s.sheetId)).get('A1')!.value).toBe(100);
    await api.patch(`/api/sheets/${s.id}/worksheets/${jan}`, { name: 'Jan 2026', frozenRows: 1 });
    const c = await cells(s.id, s.sheetId);
    expect(c.get('A1')).toMatchObject({ input: "='Jan 2026'!A1+1", value: 100 });
    const [row] = await ctx.db.db.select().from(spreadsheetSheets).where(and(eq(spreadsheetSheets.id, jan)));
    expect(row!.frozenRows).toBe(1);
  });

  it('snapshots and restores versions', async () => {
    const s = await newSheet();
    const api = client(ctx.app, alice);
    await api.post(`/api/sheets/${s.id}/ops`, { ops: [set(s.sheetId, { A1: '1', A2: '=A1*10' })] });
    const versions = data(await api.post(`/api/sheets/${s.id}/versions`, { name: 'Baseline' }));
    const baseline = versions.find((v: { name: string }) => v.name === 'Baseline');
    await api.post(`/api/sheets/${s.id}/ops`, { ops: [set(s.sheetId, { A1: '5', B1: 'extra' })] });
    await api.post(`/api/sheets/${s.id}/versions/${baseline.id}/restore`);
    const c = await cells(s.id, s.sheetId);
    expect(c.get('A2')!.value).toBe(10);
    expect(c.has('B1')).toBe(false);
  });

  it('refuses edits from viewers', async () => {
    const s = await newSheet();
    await client(ctx.app, alice).post(`/api/drive/files/${s.fileId}/share`, { email: bob.email, role: 'VIEWER', notify: false });
    const res = await client(ctx.app, bob).post(`/api/sheets/${s.id}/ops`, { ops: [set(s.sheetId, { A1: 'hack' })] });
    expect(res.statusCode).toBe(403);
    expect((await client(ctx.app, bob).get(`/api/sheets/${s.id}/worksheets/${s.sheetId}/cells`)).statusCode).toBe(200);
  });
});

describe('real-time sheets collaboration', () => {
  it('broadcasts applied ops with recalculated values and presence to other users', async () => {
    const s = await newSheet('Live sheet');
    await client(ctx.app, alice).post(`/api/drive/files/${s.fileId}/share`, { email: bob.email, role: 'EDITOR', notify: false });
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const url = `ws://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}/api/ws/sheets/${s.id}`;
    const open = (token: string) => {
      const ws = new WebSocket(`${url}?token=${token}`);
      const messages: any[] = [];
      ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
      return { ws, messages, opened: new Promise((r) => ws.on('open', r)) };
    };
    const a = open(alice.token);
    const b = open(bob.token);
    await Promise.all([a.opened, b.opened]);
    const until = async (fn: () => boolean) => {
      for (let i = 0; i < 200 && !fn(); i++) await new Promise((r) => setTimeout(r, 25));
      expect(fn()).toBe(true);
    };
    await until(() => a.messages.some((m) => m.type === 'welcome') && b.messages.some((m) => m.type === 'welcome'));

    a.ws.send(JSON.stringify({ type: 'ops', clientOpId: 'op-1', baseRevision: 0, ops: [set(s.sheetId, { A1: '2', A2: '=A1^10' })] }));
    await until(() => b.messages.some((m) => m.type === 'applied'));
    const applied = b.messages.find((m) => m.type === 'applied');
    expect(applied.changes[0].cells.find((c: { row: number }) => c.row === 1).value).toBe(1024);
    expect(a.messages.find((m) => m.type === 'applied').clientOpId).toBe('op-1');

    b.ws.send(JSON.stringify({ type: 'presence', selection: { sheetId: s.sheetId, activeRow: 4, activeCol: 2, range: null } }));
    await until(() => a.messages.some((m) => m.type === 'presence' && m.presence.some((p: any) => p.user.id === bob.id && p.selection?.activeRow === 4)));
    a.ws.close();
    b.ws.close();
  });
});
