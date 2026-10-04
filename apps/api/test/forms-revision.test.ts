import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, createTestApp, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let alice: TestUser;
beforeAll(async () => {
  ctx = await createTestApp();
  alice = await registerUser(ctx.app, 'Alice Revision');
});
afterAll(async () => {
  await ctx.close();
});
const api = () => client(ctx.app, alice);

describe('form revision', () => {
  it('starts at 0 and increases once per builder change', async () => {
    const form = data(await api().post('/api/forms', { title: 'Rev' }));
    expect(form.revision).toBe(0);
    const a = data(await api().patch(`/api/forms/${form.id}/fields/${form.fields[0].id}`, { label: 'Hello' }));
    expect(a.revision).toBe(1);
    const b = data(await api().patch(`/api/forms/${form.id}`, { description: 'x' }));
    expect(b.revision).toBe(2);
    const c = data(await api().post(`/api/forms/${form.id}/fields`, { type: 'NUMBER' }));
    expect(c.revision).toBe(3);
  });
});

describe('shared question rules on PATCH /fields/:id', () => {
  it('rejects a default answer on a consent question', async () => {
    let form = data(await api().post('/api/forms', { title: 'Consent' }));
    form = data(await api().post(`/api/forms/${form.id}/fields`, { type: 'CONSENT' }));
    const consent = form.fields.at(-1);
    const res = await api().patch(`/api/forms/${form.id}/fields/${consent.id}`, { defaultValue: true });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.message).toMatch(/can’t have a default answer/);
  });

  it('still rejects a setting that belongs to another type, with the same message', async () => {
    const form = data(await api().post('/api/forms', { title: 'Settings' }));
    const res = await api().patch(`/api/forms/${form.id}/fields/${form.fields[0].id}`, { type: 'SHORT_ANSWER', settings: { scaleMax: 5 } });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.message).toBe('“scaleMax” doesn’t apply to Short answer questions.');
  });
});
