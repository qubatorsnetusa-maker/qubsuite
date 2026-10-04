import { randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app';
import { env } from '../src/config/env';
import { createDb, type DbHandle } from '../src/db';
import { MemoryMailer } from '../src/services/mailer';

export interface TestContext {
  app: FastifyInstance;
  db: DbHandle;
  mailer: MemoryMailer;
  close(): Promise<void>;
}

export async function createTestApp(opts: { fetch?: typeof fetch } = {}): Promise<TestContext> {
  const db = createDb(env.DATABASE_URL, { max: 5 });
  const mailer = new MemoryMailer();
  const app = await buildApp({ env, db, overrides: { mailer, fetch: opts.fetch }, jobs: false, logger: false });
  await app.ready();
  return {
    app,
    db,
    mailer,
    async close() {
      await app.close();
      await db.close();
    },
  };
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
  rootFolderId: string;
  refreshCookie: string;
}

export function cookieFrom(res: LightMyRequestResponse, name: string): string | undefined {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const match = list.find((c) => c.startsWith(`${name}=`));
  return match?.split(';')[0]!.slice(name.length + 1);
}

export async function registerUser(app: FastifyInstance, name = 'Test User'): Promise<TestUser> {
  const email = `${name.toLowerCase().replace(/\W+/g, '.')}.${randomUUID().slice(0, 8)}@example.com`;
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, name, password: 'correct-horse-1' } });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const data = res.json().data;
  return {
    id: data.user.id,
    email,
    name,
    token: data.accessToken,
    rootFolderId: data.user.rootFolderId,
    refreshCookie: cookieFrom(res, 'qub_rt')!,
  };
}

/** Small typed wrapper over app.inject with the user's bearer token. */
export function client(app: FastifyInstance, user?: { token: string }) {
  const headers = (extra?: Record<string, string>) => ({ ...(user ? { authorization: `Bearer ${user.token}` } : {}), ...extra });
  return {
    get: (url: string) => app.inject({ method: 'GET', url, headers: headers() }),
    post: (url: string, payload?: unknown) => app.inject({ method: 'POST', url, headers: headers(), payload: payload as never }),
    patch: (url: string, payload?: unknown) => app.inject({ method: 'PATCH', url, headers: headers(), payload: payload as never }),
    put: (url: string, payload?: unknown) => app.inject({ method: 'PUT', url, headers: headers(), payload: payload as never }),
    delete: (url: string) => app.inject({ method: 'DELETE', url, headers: headers() }),
    upload: (url: string, filename: string, content: Buffer | string, contentType = 'application/octet-stream') => {
      const boundary = `----qub${randomUUID()}`;
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
        Buffer.isBuffer(content) ? content : Buffer.from(content),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      return app.inject({ method: 'POST', url, headers: headers({ 'content-type': `multipart/form-data; boundary=${boundary}` }), payload: body });
    },
  };
}

export const data = <T = any>(res: LightMyRequestResponse): T => res.json().data as T;

/** Minimal valid PNG (1x1). Used to prove MIME sniffing ignores the declared type. */
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
