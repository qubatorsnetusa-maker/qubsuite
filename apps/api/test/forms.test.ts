import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formResponseAnswers, formResponses } from '../src/db/schema';
import { client, createTestApp, data, PNG_1PX, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Forms');
  bob = await registerUser(ctx.app, 'Bob Forms');
});
afterAll(async () => {
  await ctx.close();
});

/** Builds: Q1 "Do you own a car?" (Yes/No) — NO jumps to "Final"; section "Car details" with required model; section "Final". */
async function buildCarForm() {
  const api = client(ctx.app, alice);
  let form = data(await api.post('/api/forms', { title: 'Car survey' }));
  const q1 = form.fields[0];
  form = data(await api.patch(`/api/forms/${form.id}/fields/${q1.id}`, { label: 'Do you own a car?', required: true, options: [{ id: q1.options[0].id, label: 'Yes' }, { label: 'No' }] }));
  form = data(await api.post(`/api/forms/${form.id}/fields`, { type: 'SECTION', label: 'Car details' }));
  form = data(await api.post(`/api/forms/${form.id}/fields`, { type: 'SHORT_ANSWER', label: 'Car model' }));
  const model = form.fields.at(-1);
  await api.patch(`/api/forms/${form.id}/fields/${model.id}`, { required: true });
  form = data(await api.post(`/api/forms/${form.id}/fields`, { type: 'RATING', label: 'Rate your car' }));
  const rating = form.fields.at(-1);
  form = data(await api.post(`/api/forms/${form.id}/fields`, { type: 'SECTION', label: 'Final' }));
  const final = form.fields.at(-1);
  form = data(await api.post(`/api/forms/${form.id}/fields`, { type: 'CHECKBOXES', label: 'Hobbies' }));
  const hobbies = form.fields.at(-1);
  form = data(await api.patch(`/api/forms/${form.id}/fields/${hobbies.id}`, { options: [{ label: 'Chess' }, { label: 'Hiking' }, { label: 'Music' }] }));
  const q1Fresh = form.fields.find((f: { id: string }) => f.id === q1.id);
  const no = q1Fresh.options.find((o: { label: string }) => o.label === 'No');
  const yes = q1Fresh.options.find((o: { label: string }) => o.label === 'Yes');
  form = data(await api.put(`/api/forms/${form.id}/fields/${q1.id}/logic`, { rules: [{ operator: 'EQUALS', value: no.id, action: 'GO_TO_SECTION', targetSectionId: final.id }] }));
  const hobbyOpts = form.fields.find((f: { id: string }) => f.id === hobbies.id).options;
  return { form, q1, yes, no, model, rating, final, hobbies, hobbyOpts };
}

describe('form builder', () => {
  it('creates drive_file (FORM) + form with a starter question', async () => {
    const form = data(await client(ctx.app, alice).post('/api/forms', { title: 'Feedback' }));
    expect(form.fields).toHaveLength(1);
    expect(form.fields[0]).toMatchObject({ type: 'MULTIPLE_CHOICE', options: [{ label: 'Option 1' }] });
    expect(data(await client(ctx.app, alice).get(`/api/drive/files/${form.fileId}`))).toMatchObject({ fileType: 'FORM', resourceId: form.id });
    expect(form.publicId).not.toBe(form.id);
  });

  it('reorders, duplicates and deletes questions; stores logic rules in the database', async () => {
    const { form, q1, final } = await buildCarForm();
    expect(form.fields.find((f: { id: string }) => f.id === q1.id).rules).toHaveLength(1);
    const api = client(ctx.app, alice);
    const dup = data(await api.post(`/api/forms/${form.id}/fields/${q1.id}/duplicate`));
    const copy = dup.fields[1];
    expect(copy.label).toBe('Do you own a car? (copy)');
    expect(copy.rules[0].targetSectionId).toBe(final.id);
    expect(copy.options.map((o: { id: string }) => o.id)).not.toContain(form.fields[0].options[0].id);

    const reversed = [...dup.fields].reverse().map((f: { id: string }) => f.id);
    const reordered = data(await api.put(`/api/forms/${form.id}/fields/order`, { fieldIds: reversed }));
    expect(reordered.fields.map((f: { id: string }) => f.id)).toEqual(reversed);
    expect((await api.put(`/api/forms/${form.id}/fields/order`, { fieldIds: reversed.slice(1) })).statusCode).toBe(422);
    const after = data(await api.delete(`/api/forms/${form.id}/fields/${copy.id}`));
    expect(after.fields.map((f: { id: string }) => f.id)).not.toContain(copy.id);
  });

  it('rejects rules that jump backwards or to non-sections', async () => {
    const { form, q1, model, hobbies } = await buildCarForm();
    const api = client(ctx.app, alice);
    const toQuestion = await api.put(`/api/forms/${form.id}/fields/${hobbies.id}/logic`, { rules: [{ operator: 'ALWAYS', action: 'GO_TO_SECTION', targetSectionId: model.id }] });
    expect(toQuestion.statusCode).toBe(422);
    const sectionBefore = form.fields.find((f: { label: string }) => f.label === 'Car details');
    const backwards = await api.put(`/api/forms/${form.id}/fields/${hobbies.id}/logic`, { rules: [{ operator: 'ALWAYS', action: 'GO_TO_SECTION', targetSectionId: sectionBefore.id }] });
    expect(backwards.statusCode).toBe(422);
    void q1;
  });
});

describe('publishing and responses', () => {
  it('unpublished forms are not reachable by respondents', async () => {
    const { form } = await buildCarForm();
    expect((await ctx.app.inject({ method: 'GET', url: `/api/public/forms/${form.publicId}` })).statusCode).toBe(404);
  });

  it('validates on the server following the branch path the answers take', async () => {
    const { form, q1, yes, no, model, rating, hobbies, hobbyOpts } = await buildCarForm();
    const api = client(ctx.app, alice);
    expect(data(await api.post(`/api/forms/${form.id}/publish`)).isPublished).toBe(true);
    const submit = (answers: Record<string, unknown>) => ctx.app.inject({ method: 'POST', url: `/api/public/forms/${form.publicId}/responses`, payload: { answers } });

    // "No" skips Car details, so the required model question is not enforced and stray answers are discarded.
    const skipped = await submit({ [q1.id]: no.id, [model.id]: 'should be dropped', [hobbies.id]: [hobbyOpts[0].id] });
    expect(skipped.statusCode).toBe(201);
    const [resp] = await ctx.db.db.select().from(formResponses).where(eq(formResponses.id, data(skipped).id));
    const answers = await ctx.db.db.select().from(formResponseAnswers).where(eq(formResponseAnswers.responseId, resp!.id));
    expect(answers.map((a) => a.fieldId).sort()).toEqual([q1.id, hobbies.id].sort());

    // "Yes" enters Car details, where the model is required.
    const missing = await submit({ [q1.id]: yes.id });
    expect(missing.statusCode).toBe(422);
    expect(missing.json().error.details.fieldErrors[model.id]).toMatch(/required/);

    const invalid = await submit({ [q1.id]: yes.id, [model.id]: 'Civic', [rating.id]: 9 });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json().error.details.fieldErrors[rating.id]).toMatch(/1 to 5/);

    const forged = await submit({ [q1.id]: 'not-an-option' });
    expect(forged.statusCode).toBe(422);

    for (const [m, r, h] of [['Civic', 4, [0, 2]], ['Model 3', 5, [1]], ['Golf', 4, [0]]] as const) {
      expect((await submit({ [q1.id]: yes.id, [model.id]: m, [rating.id]: r, [hobbies.id]: h.map((i) => hobbyOpts[i].id) })).statusCode).toBe(201);
    }

    // Owner is notified and sees the responses.
    const notes = data(await client(ctx.app, alice).get('/api/notifications')).items;
    expect(notes.find((n: { type: string }) => n.type === 'FORM_RESPONSE').title).toMatch(/responses? to "Car survey"/);
    const list = data(await api.get(`/api/forms/${form.id}/responses`));
    expect(list.total).toBe(4);

    // Analytics are computed from the stored answers.
    await ctx.app.inject({ method: 'GET', url: `/api/public/forms/${form.publicId}?view=1` });
    const analytics = data(await api.get(`/api/forms/${form.id}/analytics`));
    expect(analytics.totalResponses).toBe(4);
    expect(analytics.views).toBe(1);
    const carStats = analytics.fields.find((f: { fieldId: string }) => f.fieldId === q1.id);
    expect(carStats.distribution.map((d: { label: string; count: number; percentage: number }) => [d.label, d.count, d.percentage])).toEqual([
      ['Yes', 3, 75],
      ['No', 1, 25],
    ]);
    const ratingStats = analytics.fields.find((f: { fieldId: string }) => f.fieldId === rating.id);
    expect(ratingStats.numeric).toMatchObject({ average: 4.33, min: 4, max: 5, median: 4 });
    expect(ratingStats.answered).toBe(3);
    expect(ratingStats.skipped).toBe(1);
    const hobbyStats = analytics.fields.find((f: { fieldId: string }) => f.fieldId === hobbies.id);
    expect(hobbyStats.distribution.map((d: { count: number }) => d.count)).toEqual([3, 1, 1]);
    const today = analytics.trend.at(-1);
    expect(today.count).toBe(4);
    expect(analytics.fields.find((f: { fieldId: string }) => f.fieldId === model.id).samples).toEqual(expect.arrayContaining(['Civic', 'Golf']));

    const csv = await api.get(`/api/forms/${form.id}/responses/export`);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain('Car model');
    expect(csv.body).toContain('Chess; Music');
  });

  it('enforces sign-in and one response per person when configured', async () => {
    const api = client(ctx.app, alice);
    const form = data(await api.post('/api/forms', { title: 'Once only' }));
    await api.patch(`/api/forms/${form.id}/fields/${form.fields[0].id}`, { label: 'Pick one' });
    await api.patch(`/api/forms/${form.id}`, { settings: { limitOneResponse: true } });
    const published = data(await api.post(`/api/forms/${form.id}/publish`));
    expect(published.settings.requireSignIn).toBe(true);
    const answers = { [form.fields[0].id]: form.fields[0].options[0].id };

    const anon = await ctx.app.inject({ method: 'POST', url: `/api/public/forms/${form.publicId}/responses`, payload: { answers } });
    expect(anon.statusCode).toBe(401);
    const B = client(ctx.app, bob);
    expect((await B.post(`/api/public/forms/${form.publicId}/responses`, { answers })).statusCode).toBe(201);
    expect((await B.post(`/api/public/forms/${form.publicId}/responses`, { answers })).statusCode).toBe(409);
    expect(data(await B.get(`/api/public/forms/${form.publicId}`)).alreadyResponded).toBe(true);
  });

  it('accepts file uploads only for the question, within its limits', async () => {
    const api = client(ctx.app, alice);
    let form = data(await api.post('/api/forms', { title: 'Uploads' }));
    await api.delete(`/api/forms/${form.id}/fields/${form.fields[0].id}`);
    form = data(await api.post(`/api/forms/${form.id}/fields`, { type: 'FILE_UPLOAD', label: 'Photo' }));
    const field = form.fields[0];
    await api.patch(`/api/forms/${form.id}/fields/${field.id}`, { settings: { allowedFileTypes: ['image'], maxFiles: 1 } });
    await api.post(`/api/forms/${form.id}/publish`);
    const anon = client(ctx.app);

    const rejected = await anon.upload(`/api/public/forms/${form.publicId}/uploads?fieldId=${field.id}`, 'doc.txt', 'plain text', 'image/png');
    expect(rejected.statusCode).toBe(415);
    const uploaded = data(await anon.upload(`/api/public/forms/${form.publicId}/uploads?fieldId=${field.id}`, 'me.png', PNG_1PX, 'image/png'));
    const res = await ctx.app.inject({ method: 'POST', url: `/api/public/forms/${form.publicId}/responses`, payload: { answers: { [field.id]: [uploaded.id] } } });
    expect(res.statusCode).toBe(201);
    // The same upload cannot be attached twice.
    const replay = await ctx.app.inject({ method: 'POST', url: `/api/public/forms/${form.publicId}/responses`, payload: { answers: { [field.id]: [uploaded.id] } } });
    expect(replay.statusCode).toBe(422);
    const responses = data(await api.get(`/api/forms/${form.id}/responses`));
    const fileRef = responses.items[0].answers[0].files[0];
    const download = await api.get(`/api/forms/${form.id}/uploads/${fileRef.id}`);
    expect(download.rawPayload.equals(PNG_1PX)).toBe(true);
  });

  it('only editors can see responses', async () => {
    const api = client(ctx.app, alice);
    const form = data(await api.post('/api/forms', { title: 'Private results' }));
    await api.post(`/api/drive/files/${form.fileId}/share`, { email: bob.email, role: 'VIEWER', notify: false });
    expect((await client(ctx.app, bob).get(`/api/forms/${form.id}`)).statusCode).toBe(200);
    expect((await client(ctx.app, bob).get(`/api/forms/${form.id}/responses`)).statusCode).toBe(403);
    expect((await client(ctx.app, bob).get(`/api/forms/${form.id}/analytics`)).statusCode).toBe(403);
  });
});
