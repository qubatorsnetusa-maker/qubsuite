import type { FastifyInstance } from 'fastify';
import { buildApp, type BuildAppOptions } from './app';
import { ensureFormsV3Tables } from './modules/formsV3/forms.v3.migrate';
import { formsV3Routes } from './modules/formsV3/forms.v3.routes';

export async function buildAppV3(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = await buildApp(options);

  // Automatically ensure formsV3 database tables and indices exist in postgres
  await ensureFormsV3Tables(options.db.db);

  // Register Forms V3 routes under /api/v3
  await app.register(formsV3Routes, {
    prefix: '/api/v3',
    db: options.db.db,
  });

  return app;
}
