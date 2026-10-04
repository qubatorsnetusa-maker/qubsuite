import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formFields, formResponseAnswers, formResponses } from '../src/db/schema';
import { client, createTestApp, data, PNG_1PX, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Engine');
  bob = await registerUser(ctx.app, 'Bob Engine');
});
afterAll(async () => {
  await ctx.close();
});

const api = () => client(ctx.app, alice);
async function newForm(title = 'Engine form') {
  return data(await api().post('/api/forms', { title }));
}

describe('schema and DTOs', () => {
  it('exposes refs, option kinds and variables', async () => {
    const form = await newForm();
    expect(form.variables).toEqual([]);
    expect(form.settings).toMatchObject({ layout: 'classic', autoAdvance: true, quiz: { enabled: false, showScore: false } });
    expect(form.fields[0]).toMatchObject({ ref: 'q1', placeholder: null, defaultValue: null, scoreConfig: null });
    expect(form.fields[0].options[0]).toMatchObject({ kind: 'option', value: null, imageUrl: null });
  });

  it('stores legacy branching rules with an equivalent condition tree', async () => {
    let form = await newForm();
    const q = form.fields[0];
    form = data(await api().post(`/api/forms/${form.id}/fields`, { type: 'SECTION', label: 'Later' }));
    const section = form.fields.at(-1);
    form = data(await api().put(`/api/forms/${form.id}/fields/${q.id}/logic`, { rules: [{ operator: 'EQUALS', value: q.options[0].id, action: 'GO_TO_SECTION', targetSectionId: section.id }] }));
    expect(form.fields[0].rules[0]).toMatchObject({
      operator: 'EQUALS',
      trigger: 'ON_LEAVE',
      scope: 'SECTION',
      action: 'GO_TO_SECTION',
      targetSectionId: section.id,
      condition: { subject: { type: 'field', id: q.id }, op: 'eq', value: q.options[0].id },
    });
  });

  it('enforces one WELCOME field per form at the database level', async () => {
    const form = await newForm();
    await ctx.db.db.insert(formFields).values({ formId: form.id, type: 'WELCOME', position: 90, ref: 'w1' });
    try {
      await ctx.db.db.insert(formFields).values({ formId: form.id, type: 'WELCOME', position: 91, ref: 'w2' });
      expect.unreachable('expected a unique violation on form_fields_one_welcome');
    } catch (err) {
      expect(String((err as { cause?: unknown }).cause ?? err)).toContain('form_fields_one_welcome');
    }
  });

  it('public form includes variables', async () => {
    const form = await newForm();
    await api().post(`/api/forms/${form.id}/publish`);
    const pub = data(await client(ctx.app, bob).get(`/api/public/forms/${form.publicId}`));
    expect(pub.variables).toEqual([]);
    expect(pub.settings.layout).toBe('classic');
  });
});

describe('builder operations', () => {
  const add = async (formId: string, type: string, extra: Record<string, unknown> = {}) => data(await api().post(`/api/forms/${formId}/fields`, { type, ...extra }));

  it('creates every new type with registry defaults', async () => {
    const form = await newForm();
    let f = await add(form.id, 'NPS');
    expect(f.fields.at(-1)).toMatchObject({ type: 'NPS', ref: 'q2', settings: { minLabel: 'Not likely', maxLabel: 'Extremely likely' } });
    f = await add(form.id, 'MATRIX');
    expect(f.fields.at(-1).options.map((o: { kind: string; label: string }) => `${o.kind}:${o.label}`)).toEqual(['row:Row 1', 'row:Row 2', 'column:Column 1', 'column:Column 2']);
    f = await add(form.id, 'RANKING');
    expect(f.fields.at(-1).options).toHaveLength(2);
    f = await add(form.id, 'SLIDER');
    expect(f.fields.at(-1).settings).toEqual({ rangeMin: 0, rangeMax: 100, step: 1 });
    for (const type of ['PHONE', 'URL', 'DATETIME', 'YES_NO', 'OPINION_SCALE', 'EMOJI_RATING', 'IMAGE_CHOICE', 'ADDRESS', 'SIGNATURE', 'CONSENT', 'HIDDEN', 'LOCATION', 'STATEMENT', 'IMAGE_BLOCK', 'VIDEO_BLOCK']) {
      expect((await api().post(`/api/forms/${form.id}/fields`, { type })).statusCode, type).toBe(201);
    }
  });

  it('keeps one welcome screen first and endings last', async () => {
    const form = await newForm();
    await add(form.id, 'ENDING');
    await add(form.id, 'SHORT_ANSWER');
    const f = await add(form.id, 'WELCOME');
    expect(f.fields.map((x: { type: string }) => x.type)).toEqual(['WELCOME', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ENDING']);
    expect((await api().post(`/api/forms/${form.id}/fields`, { type: 'WELCOME' })).statusCode).toBe(409);
  });

  it('validates field updates against the type', async () => {
    const form = await newForm();
    const f = await add(form.id, 'SHORT_ANSWER');
    const q = f.fields.at(-1);
    const patch = (body: unknown) => api().patch(`/api/forms/${form.id}/fields/${q.id}`, body);
    expect((await patch({ settings: { searchable: true } })).statusCode).toBe(422);
    expect((await patch({ validation: { minSelected: 1 } })).statusCode).toBe(422);
    expect((await patch({ validation: { pattern: '^(a+)+$' } })).statusCode).toBe(422);
    expect((await patch({ ref: 'q1' })).statusCode).toBe(409);
    expect((await patch({ ref: 'bad-ref' })).statusCode).toBe(422); // body schema errors are 422 in this API
    expect(data(await patch({ ref: 'firstName', placeholder: 'Ada', defaultValue: 'x' })).fields.at(-1)).toMatchObject({ ref: 'firstName', placeholder: 'Ada', defaultValue: 'x' });
    const email = (await add(form.id, 'EMAIL')).fields.at(-1);
    expect((await api().patch(`/api/forms/${form.id}/fields/${email.id}`, { defaultValue: 'not-an-email' })).statusCode).toBe(422);
    const st = (await add(form.id, 'STATEMENT')).fields.at(-1);
    expect(data(await api().patch(`/api/forms/${form.id}/fields/${st.id}`, { required: true })).fields.find((x: { id: string }) => x.id === st.id).required).toBe(false);
  });

  it('allows only 3- or 5-point emoji ratings', async () => {
    const form = await newForm();
    const emoji = (await add(form.id, 'EMOJI_RATING')).fields.at(-1);
    const patch = (body: unknown) => api().patch(`/api/forms/${form.id}/fields/${emoji.id}`, body);
    expect((await patch({ settings: { scaleMax: 4 } })).statusCode).toBe(422);
    expect((await patch({ settings: { scaleMax: 10 } })).statusCode).toBe(422);
    expect(data(await patch({ settings: { scaleMax: 3 } })).fields.at(-1).settings.scaleMax).toBe(3);
    const rating = (await add(form.id, 'RATING')).fields.at(-1);
    expect((await api().patch(`/api/forms/${form.id}/fields/${rating.id}`, { settings: { scaleMax: 4 } })).statusCode).toBe(200);
    expect((await api().patch(`/api/forms/${form.id}/fields/${rating.id}`, { type: 'EMOJI_RATING', settings: { scaleMax: 4 } })).statusCode).toBe(422);
  });

  it('rejects a default value on HIDDEN fields', async () => {
    const form = await newForm();
    const hidden = (await add(form.id, 'HIDDEN')).fields.at(-1);
    const res = await api().patch(`/api/forms/${form.id}/fields/${hidden.id}`, { defaultValue: 'x' });
    expect(res.statusCode).toBe(422);
    expect(data(await api().patch(`/api/forms/${form.id}/fields/${hidden.id}`, { defaultValue: null })).fields.at(-1).defaultValue).toBeNull();
    // Converting a question with a default into a HIDDEN field drops the default.
    const text = (await add(form.id, 'SHORT_ANSWER', { label: 'Text' })).fields.find((x: { label: string }) => x.label === 'Text');
    await api().patch(`/api/forms/${form.id}/fields/${text.id}`, { defaultValue: 'x' });
    const converted = data(await api().patch(`/api/forms/${form.id}/fields/${text.id}`, { type: 'HIDDEN' })).fields.find((x: { id: string }) => x.id === text.id);
    expect(converted).toMatchObject({ type: 'HIDDEN', defaultValue: null });
  });

  it('clears a default value that no longer fits after a type change', async () => {
    const form = await newForm();
    const q = (await add(form.id, 'SHORT_ANSWER', { label: 'Changing' })).fields.find((x: { label: string }) => x.label === 'Changing');
    const byId = (f: { fields: { id: string; type: string; defaultValue: unknown }[] }) => f.fields.find((x) => x.id === q.id);
    await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { defaultValue: 'hello' });
    // Still valid as a paragraph: kept.
    expect(byId(data(await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { type: 'PARAGRAPH' })))).toMatchObject({ type: 'PARAGRAPH', defaultValue: 'hello' });
    // Not a number: cleared.
    expect(byId(data(await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { type: 'NUMBER' })))).toMatchObject({ type: 'NUMBER', defaultValue: null });
    // An explicit default in the same request is validated against the new type instead.
    expect(byId(data(await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { type: 'EMAIL', defaultValue: 'a@b.co' })))).toMatchObject({ type: 'EMAIL', defaultValue: 'a@b.co' });
  });

  it('resets settings and options when the type changes', async () => {
    const form = await newForm();
    const q = form.fields[0];
    const after = data(await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { type: 'NPS' }));
    expect(after.fields[0]).toMatchObject({ type: 'NPS', options: [], settings: { minLabel: 'Not likely' } });
    const back = data(await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { type: 'MATRIX' }));
    expect(back.fields[0].options.filter((o: { kind: string }) => o.kind === 'row')).toHaveLength(2);
  });

  it('duplicate gets a fresh ref and rewrites self-references', async () => {
    let form = await newForm();
    const q = form.fields[0];
    form = await add(form.id, 'SHORT_ANSWER');
    const target = form.fields.at(-1);
    form = data(await api().put(`/api/forms/${form.id}/fields/${q.id}/logic`, { rules: [{ condition: { subject: { type: 'field', id: q.id }, op: 'eq', value: q.options[0].id }, action: 'JUMP_TO_FIELD', targetFieldId: target.id }] }));
    const dup = data(await api().post(`/api/forms/${form.id}/fields/${q.id}/duplicate`));
    const copy = dup.fields[1];
    expect(copy.ref).not.toBe(q.ref);
    expect(copy.rules[0].condition).toEqual({ subject: { type: 'field', id: copy.id }, op: 'eq', value: copy.options[0].id });
    expect(copy.rules[0].targetFieldId).toBe(target.id);
  });

  it('duplicating a WELCOME screen is rejected, leaving exactly one', async () => {
    const form = await newForm();
    const withWelcome = await add(form.id, 'WELCOME');
    const welcome = withWelcome.fields.find((f: { type: string }) => f.type === 'WELCOME');
    expect((await api().post(`/api/forms/${form.id}/fields/${welcome.id}/duplicate`)).statusCode).toBe(409);
    const after = data(await api().get(`/api/forms/${form.id}`));
    expect(after.fields.filter((f: { type: string }) => f.type === 'WELCOME')).toHaveLength(1);
  });

  it('concurrent adds and duplicates each get a distinct ref instead of failing', async () => {
    const form = await newForm();
    const q = form.fields[0];
    const results = await Promise.all([
      ...Array.from({ length: 2 }, () => api().post(`/api/forms/${form.id}/fields`, { type: 'SHORT_ANSWER' })),
      api().post(`/api/forms/${form.id}/fields/${q.id}/duplicate`),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([201, 201, 200]);
    const after = data(await api().get(`/api/forms/${form.id}`));
    const refs = after.fields.map((f: { ref: string }) => f.ref);
    expect(refs).toHaveLength(4);
    expect(new Set(refs).size).toBe(4);
  });

  it('concurrent WELCOME adds yield one welcome screen and a 409, never a 500', async () => {
    const form = await newForm();
    const results = await Promise.all([1, 2, 3].map(() => api().post(`/api/forms/${form.id}/fields`, { type: 'WELCOME' })));
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([201, 409, 409]);
    const after = data(await api().get(`/api/forms/${form.id}`));
    expect(after.fields.filter((f: { type: string }) => f.type === 'WELCOME')).toHaveLength(1);
  });

  it('drive copy duplicates variables and remaps every rule', async () => {
    let form = await newForm('Copy me');
    const q = form.fields[0];
    form = data(await api().post(`/api/forms/${form.id}/variables`, { key: 'points', type: 'NUMBER', initialValue: 0 }));
    const v = form.variables[0];
    form = data(await api().put(`/api/forms/${form.id}/fields/${q.id}/logic`, { rules: [{ condition: { subject: { type: 'variable', id: v.id }, op: 'gte', value: 0 }, action: 'SET_VARIABLE', targetVariableId: v.id, payload: { value: 1 } }] }));
    const copyFile = data(await api().post(`/api/drive/files/${form.fileId}/copy`, {}));
    const copy = data(await api().get(`/api/forms/${copyFile.resourceId}`));
    expect(copy.variables).toHaveLength(1);
    expect(copy.variables[0].id).not.toBe(v.id);
    const rule = copy.fields[0].rules[0];
    expect(rule.targetVariableId).toBe(copy.variables[0].id);
    expect(rule.condition.subject.id).toBe(copy.variables[0].id);
    expect(copy.fields[0].ref).toBe(q.ref);
  });
});

describe('logic and variables', () => {
  const add = async (formId: string, type: string) => data(await api().post(`/api/forms/${formId}/fields`, { type })).fields.at(-1);

  it('accepts v2 rules and rejects invalid ones with issue codes', async () => {
    const form = await newForm();
    const q1 = form.fields[0];
    const q2 = await add(form.id, 'SHORT_ANSWER');
    const put = (fieldId: string, rules: unknown[]) => api().put(`/api/forms/${form.id}/fields/${fieldId}/logic`, { rules });
    const ok = await put(q1.id, [{ condition: { subject: { type: 'field', id: q1.id }, op: 'answered' }, action: 'JUMP_TO_FIELD', targetFieldId: q2.id }]);
    expect(ok.statusCode).toBe(200);
    const back = await put(q2.id, [{ condition: { all: [] }, action: 'JUMP_TO_FIELD', targetFieldId: q1.id }]);
    expect(back.statusCode).toBe(422);
    expect(back.json().error.details.issues[0].code).toBe('backward_jump');
    const unknown = await put(q2.id, [{ condition: { all: [] }, action: 'REDIRECT', payload: { url: 'javascript:alert(1)' } }]);
    expect(unknown.json().error.details.issues[0].code).toBe('invalid_redirect');
    const visibility = await put(q2.id, [{ trigger: 'VISIBILITY', condition: { subject: { type: 'field', id: q1.id }, op: 'eq', value: q1.options[0].id }, action: 'SHOW' }]);
    expect(data(visibility).fields[1].rules[0]).toMatchObject({ trigger: 'VISIBILITY', action: 'SHOW', operator: null });
    const section = await add(form.id, 'SECTION');
    expect((await put(section.id, [{ condition: { all: [] }, action: 'END_FORM' }])).statusCode).toBe(422);
  });

  it('manages variables with formula checks', async () => {
    const form = await newForm();
    const post = (body: unknown) => api().post(`/api/forms/${form.id}/variables`, body);
    const created = data(await post({ key: 'price', type: 'NUMBER', initialValue: 10 }));
    expect(created.variables[0]).toMatchObject({ key: 'price', type: 'NUMBER', initialValue: 10, formula: null });
    expect((await post({ key: 'q1', type: 'NUMBER' })).statusCode).toBe(409);
    expect((await post({ key: 'total', type: 'NUMBER', formula: '{{price}} * {{nope}}' })).statusCode).toBe(422);
    const withTotal = data(await post({ key: 'total', type: 'NUMBER', formula: '{{price}} * 2' }));
    const total = withTotal.variables.find((v: { key: string }) => v.key === 'total');
    const price = withTotal.variables.find((v: { key: string }) => v.key === 'price');
    const cyc = await api().patch(`/api/forms/${form.id}/variables/${price.id}`, { formula: '{{total}} + 1' });
    expect(cyc.statusCode).toBe(422);
    expect(cyc.json().error.details.issues.map((i: { code: string }) => i.code)).toContain('circular_variable');
    const check = data(await api().post(`/api/forms/${form.id}/formulas/validate`, { formula: 'ROUND({{price}} / 3' }));
    expect(check.ok).toBe(false);
    expect(data(await api().post(`/api/forms/${form.id}/formulas/validate`, { formula: '{{price}} + {{score}}' }))).toEqual({ ok: true });
    const afterDelete = data(await api().delete(`/api/forms/${form.id}/variables/${total.id}`));
    expect(afterDelete.variables.map((v: { key: string }) => v.key)).toEqual(['price']);
  });

  it('only editors change variables', async () => {
    const form = await newForm();
    await api().post(`/api/drive/files/${form.fileId}/share`, { email: bob.email, role: 'VIEWER', notify: false });
    expect((await client(ctx.app, bob).post(`/api/forms/${form.id}/variables`, { key: 'x', type: 'TEXT' })).statusCode).toBe(403);
  });

  it('blocks publishing on broken definitions but keeps live forms fillable', async () => {
    const form = await newForm();
    const q1 = form.fields[0];
    await api().patch(`/api/forms/${form.id}/fields/${q1.id}`, { label: 'Pick' });
    const q2 = await add(form.id, 'SHORT_ANSWER');
    await api().patch(`/api/forms/${form.id}/fields/${q2.id}`, { label: 'Why?' });
    await api().put(`/api/forms/${form.id}/fields/${q2.id}/logic`, { rules: [{ trigger: 'VISIBILITY', condition: { subject: { type: 'field', id: q1.id }, op: 'answered' }, action: 'SHOW' }] });
    expect((await api().post(`/api/forms/${form.id}/publish`)).statusCode).toBe(200);
    await api().delete(`/api/forms/${form.id}/fields/${q1.id}`);
    // Still fillable: the dangling condition evaluates as unanswered, so q2 stays hidden.
    expect((await ctx.app.inject({ method: 'GET', url: `/api/public/forms/${form.publicId}` })).statusCode).toBe(200);
    const res = await ctx.app.inject({ method: 'POST', url: `/api/public/forms/${form.publicId}/responses`, payload: { answers: {} } });
    expect(res.statusCode).toBe(201);
    await api().post(`/api/forms/${form.id}/unpublish`);
    const again = await api().post(`/api/forms/${form.id}/publish`);
    expect(again.statusCode).toBe(422);
    expect(again.json().error.details.issues.map((i: { code: string }) => i.code)).toContain('dangling_reference');
  });

  it('blocks publishing on unknown piped {{keys}}, including the confirmation message', async () => {
    const form = await newForm();
    const q1 = form.fields[0];
    await api().patch(`/api/forms/${form.id}/fields/${q1.id}`, { label: 'Hi {{nme}}' });
    let res = await api().post(`/api/forms/${form.id}/publish`);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details.issues).toEqual([expect.objectContaining({ code: 'unknown_reference', fieldId: q1.id })]);
    await api().patch(`/api/forms/${form.id}/fields/${q1.id}`, { label: 'Hi there' });
    await api().patch(`/api/forms/${form.id}`, { settings: { confirmationMessage: 'Thanks {{who}}' } });
    res = await api().post(`/api/forms/${form.id}/publish`);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details.issues).toEqual([expect.objectContaining({ code: 'unknown_reference', fieldId: null })]);
  });

  it('blocks publishing a quiz whose logic depends on the score', async () => {
    const form = await newForm('Quiz logic');
    const q1 = form.fields[0];
    await api().patch(`/api/forms/${form.id}/fields/${q1.id}`, { label: 'Pick' });
    await api().patch(`/api/forms/${form.id}`, { settings: { quiz: { enabled: true, showScore: false } } });
    const q2 = await add(form.id, 'SHORT_ANSWER');
    await api().patch(`/api/forms/${form.id}/fields/${q2.id}`, { label: 'Bonus' });
    await api().put(`/api/forms/${form.id}/fields/${q2.id}/logic`, { rules: [{ trigger: 'VISIBILITY', condition: { subject: { type: 'score' }, op: 'gt', value: 0 }, action: 'SHOW' }] });
    const res = await api().post(`/api/forms/${form.id}/publish`);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details.issues.map((i: { code: string }) => i.code)).toEqual(['quiz_score_navigation']);
  });
});

describe('submissions', () => {
  const seen = new Set<string>();
  const add = async (formId: string, type: string, patch: Record<string, unknown> = {}) => {
    const f = data(await api().post(`/api/forms/${formId}/fields`, { type })).fields;
    const created = f.find((x: { type: string; id: string }) => x.type === type && !seen.has(x.id)) ?? f.at(-1);
    seen.add(created.id);
    if (Object.keys(patch).length) {
      const after = data(await api().patch(`/api/forms/${formId}/fields/${created.id}`, patch));
      return after.fields.find((x: { id: string }) => x.id === created.id);
    }
    return created;
  };
  const submit = (publicId: string, body: Record<string, unknown>) => ctx.app.inject({ method: 'POST', url: `/api/public/forms/${publicId}/responses`, payload: body });

  /** Welcome → name → age (minors end early) → price & quantity → total (calculated) → personalised ending. */
  async function conversationalForm() {
    const form = await newForm('Order');
    await api().delete(`/api/forms/${form.id}/fields/${form.fields[0].id}`);
    await api().patch(`/api/forms/${form.id}`, { settings: { layout: 'conversational' } });
    await add(form.id, 'WELCOME', { label: 'Hi there' });
    const name = await add(form.id, 'SHORT_ANSWER', { label: 'Your name?', ref: 'firstName', required: true });
    const age = await add(form.id, 'NUMBER', { label: 'Age?', ref: 'age', required: true });
    const price = await add(form.id, 'NUMBER', { label: 'Price?', ref: 'price' });
    const quantity = await add(form.id, 'NUMBER', { label: 'Quantity?', ref: 'quantity' });
    const minors = await add(form.id, 'ENDING', { label: 'Sorry {{firstName}}', description: 'You must be 18.' });
    const done = await add(form.id, 'ENDING', { label: 'Thanks {{firstName}}!', description: 'Your total is {{totalAmount}}' });
    let f = data(await api().post(`/api/forms/${form.id}/variables`, { key: 'totalAmount', type: 'NUMBER', initialValue: 0 }));
    const total = f.variables[0];
    await api().put(`/api/forms/${form.id}/fields/${age.id}/logic`, { rules: [{ condition: { subject: { type: 'field', id: age.id }, op: 'lt', value: 18 }, action: 'END_FORM', targetFieldId: minors.id }] });
    await api().put(`/api/forms/${form.id}/fields/${quantity.id}/logic`, {
      rules: [
        { condition: { all: [] }, action: 'CALCULATE', targetVariableId: total.id, payload: { formula: '{{price}} * {{quantity}}' } },
        { condition: { all: [] }, action: 'END_FORM', targetFieldId: done.id, position: 1 },
      ],
    });
    f = data(await api().post(`/api/forms/${form.id}/publish`));
    return { form: f, name, age, price, quantity, minors, done };
  }

  it('Typeform-class journey: branch, calculation, personalised ending — all persisted', async () => {
    const { form, name, age, price, quantity, done } = await conversationalForm();
    const res = await submit(form.publicId, { answers: { [name.id]: 'Ada', [age.id]: 30, [price.id]: 2.5, [quantity.id]: 4 }, computed: { totalAmount: 1 } });
    expect(res.statusCode).toBe(201);
    expect(data(res)).toMatchObject({ endingId: done.id, title: 'Thanks Ada!', message: 'Your total is 10', confirmationMessage: 'Your total is 10', redirectUrl: null });
    const [row] = await ctx.db.db.select().from(formResponses).where(eq(formResponses.id, data(res).id));
    expect(row).toMatchObject({ computed: { totalAmount: 10 }, endingId: done.id });
  });

  it('minors end early and later answers are discarded', async () => {
    const { form, name, age, price, minors } = await conversationalForm();
    const res = await submit(form.publicId, { answers: { [name.id]: 'Tim', [age.id]: 15, [price.id]: 99 } });
    expect(data(res)).toMatchObject({ endingId: minors.id, title: 'Sorry Tim' });
    const answers = await ctx.db.db.select().from(formResponseAnswers).where(eq(formResponseAnswers.responseId, data(res).id));
    expect(answers.map((a) => a.fieldId).sort()).toEqual([name.id, age.id].sort());
  });

  it('returns structured validation issues', async () => {
    const { form, age } = await conversationalForm();
    const res = await submit(form.publicId, { answers: { [age.id]: 'old' } });
    expect(res.statusCode).toBe(422);
    const details = res.json().error.details;
    expect(details.fieldErrors[age.id]).toMatch(/number/);
    expect(details.issues).toEqual(expect.arrayContaining([expect.objectContaining({ fieldId: age.id, code: 'number' })]));
  });

  it('is idempotent on clientSubmissionId, including concurrent retries', async () => {
    const { form, name, age } = await conversationalForm();
    const body = { answers: { [name.id]: 'Ada', [age.id]: 16 }, clientSubmissionId: crypto.randomUUID() };
    const first = await submit(form.publicId, body);
    const retry = await submit(form.publicId, body);
    expect(retry.statusCode).toBe(201);
    expect(data(retry).id).toBe(data(first).id);
    const racing = { ...body, clientSubmissionId: crypto.randomUUID() };
    const [a, b] = await Promise.all([submit(form.publicId, racing), submit(form.publicId, racing)]);
    expect(data(a).id).toBe(data(b).id);
    const rows = await ctx.db.db.select().from(formResponses).where(eq(formResponses.formId, form.id));
    expect(rows).toHaveLength(2);
  });

  it('stores hidden fields only from the hidden map', async () => {
    const form = await newForm('Hidden');
    const q = form.fields[0];
    await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { label: 'Pick' });
    const h = await add(form.id, 'HIDDEN', { ref: 'utm_source' });
    await api().post(`/api/forms/${form.id}/publish`);
    const res = await submit(form.publicId, { answers: { [h.id]: 'forged' }, hidden: { utm_source: 'newsletter', nope: 'x' } });
    const answers = await ctx.db.db.select().from(formResponseAnswers).where(eq(formResponseAnswers.responseId, data(res).id));
    expect(answers.find((a) => a.fieldId === h.id)?.valueText).toBe('newsletter');
  });

  it('pipes safe redirect URLs', async () => {
    const form = await newForm('Redirect');
    const q = form.fields[0];
    const t = await add(form.id, 'SHORT_ANSWER', { label: 'Name', ref: 'who' });
    await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { label: 'Pick' });
    await api().put(`/api/forms/${form.id}/fields/${t.id}/logic`, { rules: [{ condition: { all: [] }, action: 'REDIRECT', payload: { url: 'https://example.test/thanks?n={{who}}' } }] });
    await api().post(`/api/forms/${form.id}/publish`);
    const res = await submit(form.publicId, { answers: { [t.id]: 'A&B' } });
    expect(data(res).redirectUrl).toBe('https://example.test/thanks?n=A%26B');
  });

  it("returns the ending's piped link and redirect URLs", async () => {
    const form = await newForm('Ending links');
    const q = form.fields[0];
    await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { label: 'Pick' });
    const t = await add(form.id, 'SHORT_ANSWER', { label: 'Name', ref: 'who' });
    await add(form.id, 'ENDING', { label: 'Bye', settings: { buttonUrl: 'https://example.test/next?n={{who}}', redirectUrl: 'https://example.test/r?n={{who}}', redirectDelay: 5 } });
    await api().post(`/api/forms/${form.id}/publish`);
    const res = await submit(form.publicId, { answers: { [t.id]: 'A&B' } });
    expect(data(res)).toMatchObject({ redirectUrl: null, endingButtonUrl: 'https://example.test/next?n=A%26B', endingRedirectUrl: 'https://example.test/r?n=A%26B' });
  });

  it('hides quiz answers from respondents and reveals the score only when allowed', async () => {
    const form = await newForm('Quiz');
    const q = form.fields[0];
    await api().patch(`/api/forms/${form.id}/fields/${q.id}`, { label: 'Capital of France?', options: [{ id: q.options[0].id, label: 'Paris' }, { label: 'Rome' }], scoreConfig: { correct: q.options[0].id, points: 1 } });
    await api().patch(`/api/forms/${form.id}`, { settings: { quiz: { enabled: true, showScore: true } } });
    await api().post(`/api/forms/${form.id}/publish`);
    const pub = data(await ctx.app.inject({ method: 'GET', url: `/api/public/forms/${form.publicId}` }));
    expect(pub.fields[0].scoreConfig).toBeNull();
    const res = await submit(form.publicId, { answers: { [q.id]: q.options[0].id } });
    expect(data(res).score).toBe(1);
    // showScore alone does nothing once the form is no longer a quiz.
    await api().patch(`/api/forms/${form.id}`, { settings: { quiz: { enabled: false, showScore: true } } });
    expect(data(await submit(form.publicId, { answers: { [q.id]: q.options[0].id } })).score).toBeNull();
    await api().patch(`/api/forms/${form.id}`, { settings: { quiz: { enabled: true, showScore: false } } });
    expect(data(await submit(form.publicId, { answers: { [q.id]: q.options[0].id } })).score).toBeNull();
  });

  it('stores, lists and exports the new answer types', async () => {
    const form = await newForm('Types');
    await api().delete(`/api/forms/${form.id}/fields/${form.fields[0].id}`);
    const yes = await add(form.id, 'YES_NO', { label: 'Happy?' });
    const matrix = await add(form.id, 'MATRIX', { label: 'Rate' });
    const rows = matrix.options.filter((o: { kind: string }) => o.kind === 'row');
    const cols = matrix.options.filter((o: { kind: string }) => o.kind === 'column');
    const rank = await add(form.id, 'RANKING', { label: 'Order' });
    const addr = await add(form.id, 'ADDRESS', { label: 'Where' });
    const loc = await add(form.id, 'LOCATION', { label: 'Pin' });
    const slider = await add(form.id, 'SLIDER', { label: 'How much' });
    const nps = await add(form.id, 'NPS', { label: 'Recommend?' });
    await api().post(`/api/forms/${form.id}/publish`);
    const answers = {
      [yes.id]: false,
      [matrix.id]: { [rows[0].id]: cols[1].id, [rows[1].id]: cols[0].id },
      [rank.id]: [rank.options[1].id, rank.options[0].id],
      [addr.id]: { line1: '1 Main St', city: 'Kampala', country: 'Uganda' },
      [loc.id]: { label: 'Kampala', lat: 0.3136, lng: 32.5811 },
      [slider.id]: 40,
      [nps.id]: 10,
    };
    expect((await submit(form.publicId, { answers })).statusCode).toBe(201);
    for (const score of [9, 8, 3]) await submit(form.publicId, { answers: { [nps.id]: score } });
    const list = data(await api().get(`/api/forms/${form.id}/responses`));
    const full = list.items.find((r: { answers: unknown[] }) => r.answers.length > 1);
    expect(full.answers.find((a: { fieldId: string }) => a.fieldId === yes.id).value).toBe(false);
    expect(full.answers.find((a: { fieldId: string }) => a.fieldId === matrix.id).value).toEqual(answers[matrix.id]);
    const csv = (await api().get(`/api/forms/${form.id}/responses/export`)).body;
    expect(csv).toContain('Row 1: Column 2; Row 2: Column 1');
    expect(csv).toContain('1 Main St, Kampala, Uganda');
    expect(csv).toContain('No');
    const analytics = data(await api().get(`/api/forms/${form.id}/analytics`));
    const npsStats = analytics.fields.find((f: { fieldId: string }) => f.fieldId === nps.id);
    expect(npsStats.nps).toEqual({ promoters: 2, passives: 1, detractors: 1, score: 25 });
    expect(npsStats.distribution).toHaveLength(11);
    const yesStats = analytics.fields.find((f: { fieldId: string }) => f.fieldId === yes.id);
    expect(yesStats.distribution.map((d: { label: string; count: number }) => [d.label, d.count])).toEqual([['Yes', 0], ['No', 1]]);
    const matrixStats = analytics.fields.find((f: { fieldId: string }) => f.fieldId === matrix.id);
    expect(matrixStats.matrix[0].distribution.map((d: { count: number }) => d.count)).toEqual([0, 1]);
    const rankStats = analytics.fields.find((f: { fieldId: string }) => f.fieldId === rank.id);
    expect(rankStats.ranking.find((r: { key: string }) => r.key === rank.options[1].id).averageRank).toBe(1);
    expect(analytics.fields.find((f: { fieldId: string }) => f.fieldId === addr.id).samples).toEqual(['1 Main St, Kampala, Uganda']);
  });

  it('accepts signature uploads as images only', async () => {
    const form = await newForm('Sign');
    await api().delete(`/api/forms/${form.id}/fields/${form.fields[0].id}`);
    const sig = await add(form.id, 'SIGNATURE', { label: 'Sign here', required: true });
    await api().post(`/api/forms/${form.id}/publish`);
    const anon = client(ctx.app);
    expect((await anon.upload(`/api/public/forms/${form.publicId}/uploads?fieldId=${sig.id}`, 'x.txt', 'text', 'text/plain')).statusCode).toBe(415);
    const up = data(await anon.upload(`/api/public/forms/${form.publicId}/uploads?fieldId=${sig.id}`, 'signature.png', PNG_1PX, 'image/png'));
    expect((await submit(form.publicId, { answers: { [sig.id]: [up.id] } })).statusCode).toBe(201);
  });
});

describe('screen ordering', () => {
  it('keeps the welcome screen first and endings last on reorder', async () => {
    const form = await newForm();
    await api().post(`/api/forms/${form.id}/fields`, { type: 'WELCOME' });
    const f = data(await api().post(`/api/forms/${form.id}/fields`, { type: 'ENDING' }));
    const ids = f.fields.map((x: { id: string }) => x.id); // [welcome, q, ending]
    expect((await api().put(`/api/forms/${form.id}/fields/order`, { fieldIds: [ids[1], ids[0], ids[2]] })).statusCode).toBe(422);
    expect((await api().put(`/api/forms/${form.id}/fields/order`, { fieldIds: [ids[0], ids[2], ids[1]] })).statusCode).toBe(422);
    expect((await api().put(`/api/forms/${form.id}/fields/order`, { fieldIds: ids })).statusCode).toBe(200);
  });
});
