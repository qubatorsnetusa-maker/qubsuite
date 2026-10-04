import type { FormDto, FormFieldDto, FormVariableDto } from '@qub/shared';
import {
  addFieldTx,
  applyTx,
  createVariableTx,
  deleteFieldTx,
  fieldSetTx,
  formSetTx,
  invertTx,
  logicTx,
  moveFieldTx,
  newTxId,
  themeSetTx,
  type Op,
  type OpTx,
} from '@qub/shared/forms';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { persistFormDiff } from '../src/modules/forms/ops-persist';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;
beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Ops');
  bob = await registerUser(ctx.app, 'Bob Ops');
});
afterAll(async () => {
  await ctx.close();
});

const as = (u: TestUser) => client(ctx.app, u);
const newForm = async (): Promise<FormDto> => data(await as(alice).post('/api/forms', { title: 'Ops form' }));
const send = (u: TestUser, form: { id: string }, tx: OpTx) => as(u).post(`/api/forms/${form.id}/ops`, tx);
const get = async (form: { id: string }): Promise<FormDto> => data(await as(alice).get(`/api/forms/${form.id}`));
const shape = (f: FormDto) => ({ title: f.title, description: f.description, settings: f.settings, theme: f.theme, fields: f.fields, variables: f.variables });

describe('POST /api/forms/:id/ops', () => {
  it('applies a transaction and returns the new revision and form', async () => {
    const form = await newForm();
    const res = await send(alice, form, fieldSetTx(form, form.fields[0]!.id, { label: 'Favourite colour', required: true })!);
    expect(res.statusCode).toBe(200);
    const out = data(res);
    expect(out.revision).toBe(form.revision + 1);
    expect(out.form.fields[0]).toMatchObject({ label: 'Favourite colour', required: true });
    expect(out.assigned).toEqual({ fields: {}, variables: {} });
  });

  it('refuses a stale change with the conflicting path and applies nothing', async () => {
    const form = await newForm();
    const id = form.fields[0]!.id;
    expect((await send(alice, form, fieldSetTx(form, id, { label: 'A' })!)).statusCode).toBe(200);
    const stale = await send(alice, form, fieldSetTx(form, id, { label: 'B', required: true })!);
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.details.conflicts).toEqual([{ opIndex: 0, entity: 'field', id, path: 'label', current: 'A' }]);
    expect((await get(form)).fields[0]).toMatchObject({ label: 'A', required: false });
  });

  it('rejects an invalid result with 422 and writes nothing', async () => {
    const form = await newForm();
    const tx = fieldSetTx(form, form.fields[0]!.id, { type: 'SHORT_ANSWER', settings: { scaleMax: 5 } })!;
    const res = await send(alice, form, tx);
    expect(res.statusCode).toBe(422);
    const after = await get(form);
    expect(after.revision).toBe(form.revision);
    expect(after.fields[0]!.type).toBe('MULTIPLE_CHOICE');
  });

  it('applies a retried transaction only once', async () => {
    const form = await newForm();
    const { tx } = addFieldTx(form, 'NUMBER', null);
    const first = data(await send(alice, form, tx));
    const again = await send(alice, form, tx);
    expect(again.statusCode).toBe(200);
    expect(data(again).revision).toBe(first.revision);
    expect((await get(form)).fields.filter((f) => f.type === 'NUMBER')).toHaveLength(1);
  });

  it('lets two editors change different settings of one question, and refuses the same setting', async () => {
    const form = await newForm();
    await as(alice).post(`/api/drive/files/${form.fileId}/share`, { email: bob.email, role: 'EDITOR', notify: false });
    const id = form.fields[0]!.id;
    expect((await send(alice, form, fieldSetTx(form, id, { label: 'Alice' })!)).statusCode).toBe(200);
    expect((await send(bob, form, fieldSetTx(form, id, { required: true })!)).statusCode).toBe(200);
    expect((await send(bob, form, fieldSetTx(form, id, { label: 'Bob' })!)).statusCode).toBe(409);
    expect((await get(form)).fields[0]).toMatchObject({ label: 'Alice', required: true });
  });

  it('serialises concurrent adds from two editors without errors', async () => {
    const form = await newForm();
    await as(alice).post(`/api/drive/files/${form.fileId}/share`, { email: bob.email, role: 'EDITOR', notify: false });
    const [a, b] = await Promise.all([send(alice, form, addFieldTx(form, 'NUMBER', null).tx), send(bob, form, addFieldTx(form, 'EMAIL', null).tx)]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    const refs = (await get(form)).fields.map((f) => f.ref.toLowerCase());
    expect(new Set(refs).size).toBe(refs.length);
    const second = data(a).revision > data(b).revision ? data(a) : data(b);
    expect(Object.keys(second.assigned.fields)).toHaveLength(1);
  });

  it('undoes a delete, restoring the same ids and the rules that pointed at it', async () => {
    let form = await newForm();
    const add = addFieldTx(form, 'SHORT_ANSWER', null);
    form = data(await send(alice, form, add.tx)).form;
    const q1 = form.fields[0]!.id;
    form = data(await send(alice, form, logicTx(form, q1, [{ condition: { all: [] }, action: 'JUMP_TO_FIELD', targetFieldId: add.fieldId }])!)).form;
    const del = deleteFieldTx(form, add.fieldId)!;
    const afterDelete = data(await send(alice, form, del)).form as FormDto;
    expect(afterDelete.fields.map((f) => f.id)).not.toContain(add.fieldId);
    expect(afterDelete.fields[0]!.rules).toEqual([]);
    const restored = data(await send(alice, afterDelete, invertTx(del))).form as FormDto;
    expect(shape(restored)).toEqual(shape(form));
  });

  it('forbids viewers', async () => {
    const form = await newForm();
    await as(alice).post(`/api/drive/files/${form.fileId}/share`, { email: bob.email, role: 'VIEWER', notify: false });
    expect((await send(bob, form, fieldSetTx(form, form.fields[0]!.id, { label: 'x' })!)).statusCode).toBe(403);
  });

  it('keeps the old endpoints and the ops endpoint on one revision counter', async () => {
    const form = await newForm();
    const viaPatch = data(await as(alice).patch(`/api/forms/${form.id}/fields/${form.fields[0]!.id}`, { label: 'x' }));
    const viaOps = data(await send(alice, viaPatch, formSetTx(viaPatch, { description: 'd' })!));
    expect([viaPatch.revision, viaOps.revision]).toEqual([form.revision + 1, form.revision + 2]);
  });

  it('survives 100 consecutive mixed edits without losing anything', async () => {
    let server = await newForm();
    let local = server;
    const history: OpTx[] = [];
    for (let i = 0; i < 100; i++) {
      const questions = local.fields.filter((f) => f.type !== 'ENDING' && f.type !== 'WELCOME');
      const target = questions[i % Math.max(questions.length, 1)];
      let tx: OpTx | null = null;
      switch (i % 10) {
        case 0:
        case 5:
          tx = addFieldTx(local, i % 20 === 0 ? 'MULTIPLE_CHOICE' : 'SHORT_ANSWER', target?.id ?? null).tx;
          break;
        case 1:
          tx = target ? fieldSetTx(local, target.id, { label: `Label ${i}` }) : null;
          break;
        case 2:
          tx = target ? fieldSetTx(local, target.id, { required: !target.required }) : null;
          break;
        case 3:
          tx = formSetTx(local, { description: `Description ${i}` });
          break;
        case 4:
          tx = target && questions.length > 1 ? moveFieldTx(local, target.id, 0) : null;
          break;
        case 6:
          tx = themeSetTx(local, { ...local.theme, primaryColor: i % 4 ? '#1a73e8' : '#673ab7' });
          break;
        case 7:
          tx = questions.length > 3 ? deleteFieldTx(local, questions.at(-1)!.id) : null;
          break;
        case 8:
          tx = createVariableTx(local, { key: `v${i}`, type: 'NUMBER', initialValue: 0, formula: null }).tx;
          break;
        case 9:
          tx = history.length ? invertTx(history.pop()!) : null;
          break;
      }
      if (!tx) continue;
      local = applyTx(local, tx);
      const res = await send(alice, server, tx);
      expect(res.statusCode, `edit ${i}: ${res.body}`).toBe(200);
      server = data(res).form;
      if (i % 10 !== 9) history.push(tx);
    }
    expect(shape(await get(server))).toEqual(shape(local));
  });

  it('rejects new ids that belong to another form with 422 and leaves both forms untouched', async () => {
    let a = await newForm();
    a = data(await send(alice, a, createVariableTx(a, { key: 'points', type: 'NUMBER', initialValue: 0, formula: null }).tx)).form;
    const aTarget = addFieldTx(a, 'SHORT_ANSWER', null);
    a = data(await send(alice, a, aTarget.tx)).form;
    a = data(await send(alice, a, logicTx(a, a.fields[0]!.id, [{ condition: { all: [] }, action: 'JUMP_TO_FIELD', targetFieldId: aTarget.fieldId }])!)).form;
    const aField = a.fields[0]!;
    let b = await newForm();
    const bTarget = addFieldTx(b, 'SHORT_ANSWER', null);
    b = data(await send(alice, b, bTarget.tx)).form;

    const withSnapshot = (tx: OpTx, edit: (snapshot: any) => any): OpTx => ({
      txId: newTxId(),
      label: tx.label,
      ops: tx.ops.map((op) => (op.kind === 'create' ? ({ ...op, snapshot: edit(structuredClone(op.snapshot)) } as Op) : op)),
    });
    const stealRuleId = (tx: OpTx, ruleId: string): OpTx => {
      const out = structuredClone(tx);
      const op = out.ops[0] as Extract<Op, { kind: 'set' }>;
      (op.changes.rules!.to as { id: string }[])[0]!.id = ruleId;
      return out;
    };
    const field = addFieldTx(b, 'MULTIPLE_CHOICE', null).tx;
    const attempts: OpTx[] = [
      withSnapshot(field, (s) => ({ ...s, id: aField.id })),
      withSnapshot(field, (s) => ({ ...s, options: s.options.map((o: any, i: number) => (i === 0 ? { ...o, id: aField.options[0]!.id } : o)) })),
      withSnapshot(createVariableTx(b, { key: 'other', type: 'NUMBER', initialValue: 0, formula: null }).tx, (s) => ({ ...s, id: a.variables[0]!.id })),
      stealRuleId(logicTx(b, b.fields[0]!.id, [{ condition: { all: [] }, action: 'JUMP_TO_FIELD', targetFieldId: bTarget.fieldId }])!, aField.rules[0]!.id),
    ];
    for (const [i, tx] of attempts.entries()) {
      const res = await send(alice, b, tx);
      expect(res.statusCode, `attempt ${i}: ${res.body}`).toBe(422);
    }
    const aAfter = await get(a);
    expect(aAfter.revision).toBe(a.revision);
    expect(shape(aAfter)).toEqual(shape(a));
    expect((await get(b)).revision).toBe(b.revision);
  });

  it('runs a legacy PATCH and an ops transaction on the same question side by side without a deadlock', async () => {
    for (let round = 0; round < 8; round++) {
      const form = await newForm();
      const id = form.fields[0]!.id;
      const [legacy, ops] = await Promise.all([
        as(alice).patch(`/api/forms/${form.id}/fields/${id}`, { label: `Legacy ${round}` }),
        send(alice, form, fieldSetTx(form, id, { required: true })!),
      ]);
      expect(legacy.statusCode, legacy.body).toBe(200);
      expect(ops.statusCode, ops.body).toBe(200);
      const after = await get(form);
      expect(after.fields[0]).toMatchObject({ label: `Legacy ${round}`, required: true });
      expect(after.revision).toBe(form.revision + 2);
    }
  });

  it('cleans a title set through ops like a rename and records the rename', async () => {
    const form = await newForm();
    // Built by hand: the builder already cleans titles (formSetTx), but the server must not rely on that.
    const rawTitle = (f: FormDto, to: string): OpTx => ({ txId: newTxId(), label: 'Rename form', ops: [{ kind: 'set', entity: 'form', id: f.id, changes: { title: { from: f.title, to } } }] });
    const res = await send(alice, form, rawTitle(form, 'Quarterly: survey?  2026 '));
    expect(res.statusCode, res.body).toBe(200);
    expect(data(res).form.title).toBe('Quarterly survey 2026');
    expect((await get(form)).title).toBe('Quarterly survey 2026');
    const renames = async () =>
      data(await as(alice).get(`/api/drive/files/${form.fileId}/activity`)).items.filter((i: { action: string }) => i.action === 'FILE_RENAMED');
    expect(await renames()).toEqual([expect.objectContaining({ resourceName: 'Quarterly survey 2026', metadata: { from: 'Ops form', to: 'Quarterly survey 2026' } })]);
    // A title that cleans to the current name is no rename.
    const same = data(res).form as FormDto;
    expect((await send(alice, same, rawTitle(same, 'Quarterly survey 2026?'))).statusCode).toBe(200);
    expect((await get(form)).title).toBe('Quarterly survey 2026');
    expect(await renames()).toHaveLength(1);
  });

  it('undoes a rename to a title that needed cleaning', async () => {
    const form = await newForm();
    const rename = formSetTx(form, { title: 'Survey: Q3?' }, 'Rename form')!;
    const renamed = await send(alice, form, rename);
    expect(renamed.statusCode, renamed.body).toBe(200);
    expect(data(renamed).form.title).toBe('Survey Q3');
    const undo = await send(alice, data(renamed).form, invertTx(rename));
    expect(undo.statusCode, undo.body).toBe(200);
    expect(data(undo).form.title).toBe('Ops form');
  });

  it('undoes a delete built from the form GET returns', async () => {
    const form = await newForm();
    const current = await get(form);
    const del = deleteFieldTx(current, current.fields[0]!.id)!;
    const afterDelete = data(await send(alice, current, del)).form as FormDto;
    const undo = await send(alice, afterDelete, invertTx(del));
    expect(undo.statusCode, undo.body).toBe(200);
    expect(shape(data(undo).form)).toEqual(shape(current));
  });
});

describe('persistFormDiff', () => {
  it('writes only known columns, ignoring anything extra on the snapshots', async () => {
    const a = await newForm();
    const b = await newForm();
    const before = await get(b);
    const smuggled = { formId: a.id, fieldId: a.fields[0]!.id, createdAt: 'not a date', updatedAt: 'not a date' };
    const newFieldId = newTxId();
    const newVariableId = newTxId();
    const after: FormDto = {
      ...before,
      theme: { ...before.theme, primaryColor: '#123456', ...smuggled } as FormDto['theme'],
      fields: [
        { ...before.fields[0]!, label: 'Changed', ...smuggled, options: before.fields[0]!.options.map((o) => ({ ...o, label: `${o.label}!`, ...smuggled })) } as FormFieldDto,
        { ...before.fields[0]!, id: newFieldId, ref: 'fresh_ref', position: 1, ...smuggled, options: [{ id: newTxId(), label: 'Only', kind: before.fields[0]!.options[0]!.kind, imageUrl: null, value: null, position: 0, ...smuggled }], rules: [] } as FormFieldDto,
        ...before.fields.slice(1).map((f) => ({ ...f, position: f.position + 1 })),
      ],
      variables: [{ id: newVariableId, key: 'smuggled', type: 'NUMBER', initialValue: 0, formula: null, position: 0, ...smuggled } as FormVariableDto],
    };
    await ctx.db.db.transaction((tx) => persistFormDiff(tx, before, after));

    const bAfter = await get(b);
    expect(bAfter.theme.primaryColor).toBe('#123456');
    expect(bAfter.fields[0]).toMatchObject({ id: before.fields[0]!.id, label: 'Changed' });
    expect(bAfter.fields[0]!.options.every((o) => o.label.endsWith('!'))).toBe(true);
    expect(bAfter.fields[1]).toMatchObject({ id: newFieldId, ref: 'fresh_ref' });
    expect(bAfter.fields[1]!.options.map((o) => o.label)).toEqual(['Only']);
    expect(bAfter.variables.map((v) => v.id)).toEqual([newVariableId]);
    expect(shape(await get(a))).toEqual(shape(a));
  });
});

describe('theme extras', () => {
  it('persists theme extras through the ops endpoint and reads them back', async () => {
    const form = await newForm();
    await as(alice).put(`/api/forms/${form.id}/theme`, {
      primaryColor: '#111827',
      backgroundColor: '#ffffff',
      fontFamily: 'sans',
      extras: { preset: 'mono', fontPair: 'mono', buttonRadius: 'sharp', background: { kind: 'color' }, showPoweredBy: false },
    });
    const got = data(await as(alice).get(`/api/forms/${form.id}`));
    expect(got.theme.extras).toEqual({ preset: 'mono', fontPair: 'mono', buttonRadius: 'sharp', background: { kind: 'color' }, showPoweredBy: false });
  });

  it('defaults extras to an empty object for a form that never set one', async () => {
    const form = await newForm();
    expect(data(await as(alice).get(`/api/forms/${form.id}`)).theme.extras).toEqual({});
  });

  it('rejects an invalid extras payload', async () => {
    const form = await newForm();
    const res = await as(alice).put(`/api/forms/${form.id}/theme`, {
      primaryColor: '#111827',
      backgroundColor: '#ffffff',
      fontFamily: 'sans',
      extras: { fontPair: 'comic' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('a drive copy carries theme extras to the copy', async () => {
    const form = await newForm();
    await as(alice).put(`/api/forms/${form.id}/theme`, {
      primaryColor: '#be185d', backgroundColor: '#fdf2f8', fontFamily: 'sans',
      extras: { preset: 'blossom', fontPair: 'playfair' },
    });
    // Form duplication goes through the drive file copy, exactly as forms-engine.test.ts:211 does.
    const copyFile = data(await as(alice).post(`/api/drive/files/${form.fileId}/copy`, {}));
    const copy = data(await as(alice).get(`/api/forms/${copyFile.resourceId}`));
    expect(copy.theme.extras).toEqual({ preset: 'blossom', fontPair: 'playfair' });
  });

  it('the public respondent payload carries theme extras', async () => {
    const form = await newForm();
    await as(alice).put(`/api/forms/${form.id}/theme`, {
      primaryColor: '#0369a1', backgroundColor: '#f0f9ff', fontFamily: 'sans',
      extras: { fontPair: 'inter', background: { kind: 'gradient', from: '#e0f2fe', to: '#f0f9ff', angle: 180 } },
    });
    // POST /:id/publish takes no body (forms.routes.ts:63); the public GET is anonymous, so inject directly.
    await as(alice).post(`/api/forms/${form.id}/publish`, {});
    const res = await ctx.app.inject({ method: 'GET', url: `/api/public/forms/${form.publicId}` });
    expect(JSON.parse(res.body).data.theme.extras.background).toEqual({ kind: 'gradient', from: '#e0f2fe', to: '#f0f9ff', angle: 180 });
  });
});
