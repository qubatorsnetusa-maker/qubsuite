import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorsPlugin } from '../src/plugins/errors';

const app = Fastify();

beforeAll(async () => {
  await app.register(errorsPlugin);
  // Drizzle wraps the driver error: the SQLSTATE lives on `cause`, not on the thrown error.
  app.get('/wrapped/:code', async (req) => {
    const { code } = req.params as { code: string };
    throw Object.assign(new Error('Failed query: insert into ...'), { cause: Object.assign(new Error('duplicate key'), { code }) });
  });
  app.get('/bare', async () => {
    throw Object.assign(new Error('duplicate key'), { code: '23505' });
  });
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('errors plugin: Postgres errors', () => {
  it('maps a unique violation wrapped under cause to 409', async () => {
    const res = await app.inject({ method: 'GET', url: '/wrapped/23505' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ success: false, error: { code: 'CONFLICT', message: 'This conflicts with an existing item.' } });
  });

  it('maps a wrapped check violation to 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/wrapped/23514' });
    expect(res.statusCode).toBe(422);
  });

  it('still maps an unwrapped driver error', async () => {
    const res = await app.inject({ method: 'GET', url: '/bare' });
    expect(res.statusCode).toBe(409);
  });
});
