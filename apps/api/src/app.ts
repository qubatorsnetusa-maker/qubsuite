import path from 'node:path';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify, { LogController, type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import type { Env } from './config/env';
import type { DbHandle } from './db';
import { ok } from './http/respond';
import { scheduleTrashPurge } from './jobs/purge-trash';
import { adminRoutes } from './modules/admin/admin.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { docsRoutes } from './modules/docs/docs.routes';
import { aiRoutes } from './modules/ai/ai.routes';
import { driveRoutes } from './modules/drive/drive.routes';
import { formsRoutes, publicFormRoutes } from './modules/forms/forms.routes';
import { notificationRoutes } from './modules/notifications/notifications.routes';
import { sheetsRoutes } from './modules/sheets/sheets.routes';
import { publicShareRoutes } from './modules/sharing/public-share.routes';
import { userRoutes } from './modules/users/users.routes';
import { authPlugin } from './plugins/auth';
import { errorsPlugin } from './plugins/errors';
import { requestLoggingPlugin } from './plugins/request-logging';
import { securityPlugin } from './plugins/security';
import { createServices, type ServiceOverrides } from './services/container';
import { wsRoutes } from './websocket/ws.routes';

export interface BuildAppOptions {
  env: Env;
  db: DbHandle;
  overrides?: ServiceOverrides;
  logger?: FastifyServerOptions['logger'];
  /** Disable background jobs (tests). */
  jobs?: boolean;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env, db } = options;
  const app = Fastify({
    logger: options.logger ?? {
      level: env.LOG_LEVEL,
      // Never log credentials or tokens.
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.passwordHash', '*.token', '*.refreshToken', '*.accessToken'],
        censor: '[redacted]',
      },
      serializers: {
        req: (req) => ({ method: req.method, url: String(req.url).split('?')[0], id: req.id }),
      },
      transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } : undefined,
    },
    // Request logging is done by requestLoggingPlugin (one structured line with user, resource and duration).
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 5 * 1024 * 1024,
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorsPlugin);
  await app.register(securityPlugin, { env });
  await app.register(authPlugin, { env, db: db.db });
  await app.register(requestLoggingPlugin);
  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 10, fieldSize: 64 * 1024, parts: 12 },
    throwFileSizeLimit: true,
  });
  await app.register(websocket, { options: { maxPayload: 16 * 1024 * 1024 } });

  const services = createServices(app, env, db.db, options.overrides);
  app.decorate('services', services);

  app.get('/api/health', async () => ok({ status: 'ok' }));
  app.get('/api/ready', async (_req, reply) => {
    const [dbOk, storageOk] = await Promise.all([
      db.db.execute(sql`select 1`).then(() => true, () => false),
      services.storage.provider.healthy(),
    ]);
    const ready = dbOk && storageOk;
    return reply.code(ready ? 200 : 503).send(ok({ database: dbOk, storage: storageOk, realtime: services.realtime.docs.stats() }));
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(driveRoutes, { prefix: '/api/drive' });
  await app.register(docsRoutes, { prefix: '/api/docs' });
  await app.register(aiRoutes, { prefix: '/api/ai' });
  await app.register(sheetsRoutes, { prefix: '/api/sheets' });
  await app.register(formsRoutes, { prefix: '/api/forms' });
  await app.register(publicFormRoutes, { prefix: '/api/public/forms' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(publicShareRoutes, { prefix: '/api/share' });
  await app.register(wsRoutes, { prefix: '/api/ws' });

  // Optional: serve the built SPA from the API process (single-container deployments).
  if (env.SERVE_WEB_DIST) {
    const root = path.resolve(env.SERVE_WEB_DIST);
    await app.register(fastifyStatic, { root, prefix: '/qubsuite/', wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
      }
      return reply.sendFile('index.html');
    });
  }

  const stopJobs = options.jobs === false ? () => {} : scheduleTrashPurge(services, app.log);
  app.addHook('onClose', async () => {
    stopJobs();
    await services.shutdown();
  });

  return app;
}
