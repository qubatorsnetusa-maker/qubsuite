import { DOC_TEMPLATES, FORM_TEMPLATES, SHEET_TEMPLATES } from '@qub/shared/templates';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Templates');
  bob = await registerUser(ctx.app, 'Bob Templates');
});
afterAll(async () => {
  await ctx.close();
});

type Cell = { row: number; col: number; input: string; value: unknown; formattedValue: string; style: unknown };
const cellMap = (cells: Cell[]) => new Map(cells.map((c) => [`${String.fromCharCode(65 + c.col)}${c.row + 1}`, c]));

describe('creating from templates', () => {
  it('creates a document from every Docs template, named after it, with the template content', async () => {
    const api = client(ctx.app, alice);
    for (const t of DOC_TEMPLATES) {
      const res = await api.post('/api/docs', { templateId: t.id });
      expect(res.statusCode, t.id).toBe(201);
      const doc = data(res);
      expect(doc.title).toBe(t.name);
      expect(doc.content.content.length).toBe(t.content.content!.length);
    }
    const resume = data(await api.post('/api/docs', { templateId: 'doc-resume', title: 'My CV' }));
    expect(resume.title).toBe('My CV');
    expect(JSON.stringify(resume.content)).toContain('Experience');
  });

  it('creates a spreadsheet whose template formulas are computed and stay live', async () => {
    const api = client(ctx.app, alice);
    for (const t of SHEET_TEMPLATES) expect((await api.post('/api/sheets', { templateId: t.id })).statusCode, t.id).toBe(201);

    const sheet = data(await api.post('/api/sheets', { templateId: 'sheet-invoice' }));
    expect(sheet.title).toBe('Invoice');
    const ws = sheet.sheets[0];
    expect(ws).toMatchObject({ name: 'Invoice' });
    expect(ws.colWidths['0']).toBe(280);
    const url = `/api/sheets/${sheet.id}/worksheets/${ws.id}/cells?rowStart=0&rowEnd=30&colStart=0&colEnd=8`;
    let cells = cellMap(data(await api.get(url)).cells);
    expect(cells.get('D10')).toMatchObject({ input: '=B10*C10', value: 500 });
    expect(cells.get('D18')).toMatchObject({ value: 810, formattedValue: '$810.00' });
    expect(cells.get('A9')!.style).toMatchObject({ bold: true });

    // The stored dependency graph is live: changing a quantity recalculates the total.
    await api.post(`/api/sheets/${sheet.id}/ops`, { ops: [{ type: 'setCells', sheetId: ws.id, cells: [{ row: 9, col: 1, input: '3' }] }] });
    cells = cellMap(data(await api.get(url)).cells);
    expect(cells.get('D18')!.value).toBe(1890); // (1500 + 250) * 1.08
  });

  it('creates a form with the template questions, options, description and theme', async () => {
    const api = client(ctx.app, alice);
    for (const t of FORM_TEMPLATES) expect((await api.post('/api/forms', { templateId: t.id })).statusCode, t.id).toBe(201);

    const form = data(await api.post('/api/forms', { templateId: 'form-rsvp' }));
    const template = FORM_TEMPLATES.find((t) => t.id === 'form-rsvp')!;
    expect(form.title).toBe('RSVP');
    expect(form.description).toBe(template.description);
    expect(form.theme).toMatchObject({ primaryColor: template.theme.primaryColor, fontFamily: 'serif' });
    expect(form.fields.map((f: { label: string }) => f.label)).toEqual(template.fields.map((f) => f.label));
    const attend = form.fields[0];
    expect(attend).toMatchObject({ type: 'MULTIPLE_CHOICE', required: true });
    expect(attend.options.map((o: { label: string }) => o.label)).toEqual(template.fields[0]!.options);
  });

  it('rejects unknown templates and templates from another app', async () => {
    const api = client(ctx.app, alice);
    expect((await api.post('/api/docs', { templateId: 'doc-nope' })).statusCode).toBe(400);
    expect((await api.post('/api/sheets', { templateId: 'doc-resume' })).statusCode).toBe(400);
    // Malformed ids fail body validation before reaching the service.
    expect((await api.post('/api/forms', { templateId: 'Robert"); drop' })).statusCode).toBe(422);
  });
});

describe('app library (home page listing)', () => {
  it('lists only accessible files of one type, with previews, owner filter and search', async () => {
    const a = client(ctx.app, alice);
    const b = client(ctx.app, bob);
    const bobPrivate = data(await b.post('/api/docs', { title: 'Bob private plan' }));
    const bobShared = data(await b.post('/api/docs', { templateId: 'doc-meeting-notes', title: 'Bob shared notes' }));
    await b.post(`/api/drive/files/${bobShared.fileId}/share`, { email: alice.email, role: 'VIEWER', notify: false });

    const list = data(await a.get('/api/drive/library?type=DOCUMENT&limit=60'));
    const names = list.items.map((i: { name: string }) => i.name);
    expect(names).toContain('Bob shared notes');
    expect(names).not.toContain('Bob private plan');
    expect(list.items.every((i: { fileType: string }) => i.fileType === 'DOCUMENT')).toBe(true);

    const shared = list.items.find((i: { name: string }) => i.name === 'Bob shared notes');
    expect(shared.preview.kind).toBe('document');
    expect(shared.preview.blocks.length).toBeGreaterThan(0);
    expect(JSON.stringify(shared.preview.blocks)).toContain('Meeting name');

    const notMine = data(await a.get('/api/drive/library?type=DOCUMENT&owner=not_me'));
    expect(notMine.items.map((i: { name: string }) => i.name)).toEqual(['Bob shared notes']);

    const found = data(await a.get('/api/drive/library?type=DOCUMENT&q=shared%20notes'));
    expect(found.items.map((i: { name: string }) => i.name)).toEqual(['Bob shared notes']);
    expect(bobPrivate.id).toBeTruthy();
  });

  it('orders by the caller’s last open and hides trashed files', async () => {
    const carol = await registerUser(ctx.app, 'Carol Library');
    const api = client(ctx.app, carol);
    const first = data(await api.post('/api/sheets', { title: 'First' }));
    const second = data(await api.post('/api/sheets', { templateId: 'sheet-monthly-budget', title: 'Second' }));
    const third = data(await api.post('/api/sheets', { title: 'Third' }));

    // Opening "First" makes it the most recently opened.
    await new Promise((r) => setTimeout(r, 20));
    await api.get(`/api/sheets/${first.id}`);
    let items = data(await api.get('/api/drive/library?type=SPREADSHEET')).items;
    expect(items.map((i: { name: string }) => i.name)).toEqual(['First', 'Third', 'Second']);
    expect(items[0].lastOpenedAt).toBeTruthy();

    const budget = items.find((i: { name: string }) => i.name === 'Second');
    expect(budget.preview.kind).toBe('spreadsheet');
    expect(budget.preview.cells.find((c: { row: number; col: number }) => c.row === 0 && c.col === 0).formattedValue).toBe('Monthly budget');

    items = data(await api.get('/api/drive/library?type=SPREADSHEET&sort=name')).items;
    expect(items.map((i: { name: string }) => i.name)).toEqual(['First', 'Second', 'Third']);

    await api.post(`/api/drive/files/${third.fileId}/trash`);
    items = data(await api.get('/api/drive/library?type=SPREADSHEET')).items;
    expect(items.map((i: { name: string }) => i.name)).not.toContain('Third');
    expect(second.id).toBeTruthy();
  });

  it('returns form previews and paginates', async () => {
    const dave = await registerUser(ctx.app, 'Dave Library');
    const api = client(ctx.app, dave);
    await api.post('/api/forms', { templateId: 'form-customer-feedback' });
    await api.post('/api/forms', { title: 'Second form' });
    await api.post('/api/forms', { title: 'Third form' });

    const page1 = data(await api.get('/api/drive/library?type=FORM&sort=name&limit=2'));
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = data(await api.get(`/api/drive/library?type=FORM&sort=name&limit=2&cursor=${page1.nextCursor}`));
    expect(page2.items).toHaveLength(1);

    const feedback = page1.items.find((i: { name: string }) => i.name === 'Customer Feedback');
    expect(feedback.preview).toMatchObject({ kind: 'form', primaryColor: '#e8710a' });
    expect(feedback.preview.fields).toHaveLength(4);
    expect(feedback.preview.fields[1]).toEqual({ type: 'RATING', label: 'Overall, how satisfied are you with us?' });
  });

  it('validates the type', async () => {
    expect((await client(ctx.app, alice).get('/api/drive/library?type=PDF')).statusCode).toBe(400);
    expect((await client(ctx.app).get('/api/drive/library?type=DOCUMENT')).statusCode).toBe(401);
  });
});
