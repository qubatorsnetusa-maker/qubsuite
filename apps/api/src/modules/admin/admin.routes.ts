import { Readable } from 'node:stream';
import {
  adminActivityQuerySchema,
  adminAuditQuerySchema,
  adminBulkUsersSchema,
  adminContentQuerySchema,
  adminCreateUserSchema,
  adminDeleteUserSchema,
  adminSessionsQuerySchema,
  adminStorageQuotaSchema,
  adminTransferSchema,
  adminUpdateUserSchema,
  adminUsersQuerySchema,
  emailSettingsSchema,
  emailTestSchema,
  orgPoliciesSchema,
} from '@qub/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { auditContext, ok } from '../../http/respond';
import { requireAuth } from '../../plugins/auth';
import { csvRow } from '../../utils/csv';
import { AppError } from '../../utils/errors';

const idParams = z.object({ id: z.uuid() });

/**
 * The admin console API. Every route requires a signed-in super admin; the role is read from the database on each
 * request (with the session check), so demoting or suspending an admin takes effect immediately.
 */
export async function adminRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { adminUsers, adminInsights, policies, email } = app.services;

  app.addHook('preHandler', async (request) => {
    if ((request.routeOptions.config as { media?: boolean } | undefined)?.media) await app.mediaAuth(request);
    else await app.authenticate(request);
    if (requireAuth(request).platformRole !== 'SUPER_ADMIN') throw new AppError('FORBIDDEN', 'Super administrator access is required.');
  });
  const actor = (req: FastifyRequest) => {
    const a = requireAuth(req);
    return { userId: a.userId, name: a.name, sessionId: a.sessionId };
  };
  const csv = (reply: import('fastify').FastifyReply, name: string, rows: AsyncGenerator<string>) =>
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${name}"`)
      .header('X-Content-Type-Options', 'nosniff')
      .send(
        Readable.from(
          (async function* () {
            yield '﻿';
            yield* rows;
          })(),
        ),
      );

  // ---------- overview ----------

  r.get('/overview', async () => ok(await adminInsights.overview()));
  r.get('/alerts', async () => ok(await adminInsights.alerts()));

  // ---------- users ----------

  r.get('/users', { schema: { querystring: adminUsersQuerySchema } }, async (request) => ok(await adminUsers.list(request.query)));
  r.get('/users/export', { config: { media: true }, schema: { querystring: adminUsersQuerySchema.omit({ cursor: true, limit: true }) } }, async (request, reply) => {
    const q = request.query;
    return csv(
      reply,
      `qub-users-${new Date().toISOString().slice(0, 10)}.csv`,
      (async function* () {
        yield csvRow(['Name', 'Email', 'Role', 'Status', 'Email verified', 'Storage used (bytes)', 'Storage quota (bytes)', 'Files owned', 'Active sessions', 'Last sign-in (UTC)', 'Created (UTC)']);
        let cursor: string | undefined;
        do {
          const page = await adminUsers.list({ ...q, cursor, limit: 200 });
          for (const u of page.items) {
            yield csvRow([u.name, u.email, u.platformRole, u.status, u.emailVerified, u.storageUsed, u.storageQuota ?? 'unlimited', u.ownedFiles, u.activeSessions, u.lastLoginAt ?? '', u.createdAt]);
          }
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
      })(),
    );
  });
  r.post('/users', { schema: { body: adminCreateUserSchema } }, async (request, reply) => reply.code(201).send(ok(await adminUsers.create(actor(request), request.body, auditContext(request)))));
  r.post('/users/bulk', { schema: { body: adminBulkUsersSchema } }, async (request) => ok(await adminUsers.bulk(actor(request).userId, request.body, auditContext(request))));
  r.get('/users/:id', { schema: { params: idParams } }, async (request) => ok(await adminUsers.get(request.params.id)));
  r.patch('/users/:id', { schema: { params: idParams, body: adminUpdateUserSchema } }, async (request) =>
    ok(await adminUsers.update(actor(request).userId, request.params.id, request.body, auditContext(request))),
  );
  r.post('/users/:id/sign-out', { schema: { params: idParams } }, async (request) => {
    await adminUsers.signOut(actor(request).userId, request.params.id, auditContext(request));
    return ok({ signedOut: true });
  });
  r.post('/users/:id/password-link', { schema: { params: idParams } }, async (request) => {
    await adminUsers.sendPasswordReset(actor(request), request.params.id, auditContext(request));
    return ok({ sent: true });
  });
  r.put('/users/:id/storage', { schema: { params: idParams, body: adminStorageQuotaSchema } }, async (request) =>
    ok(await adminUsers.setStorage(actor(request), request.params.id, request.body, auditContext(request))),
  );
  r.post('/users/:id/delete', { schema: { params: idParams, body: adminDeleteUserSchema } }, async (request) =>
    ok(await adminUsers.delete(actor(request).userId, request.params.id, request.body, auditContext(request))),
  );

  // ---------- policies ----------

  r.get('/policies', async () => ok({ policies: await policies.get(), serverMaxUploadMb: app.services.env.MAX_UPLOAD_MB }));
  r.put('/policies', { schema: { body: orgPoliciesSchema } }, async (request) => ok({ policies: await policies.update(request.body, auditContext(request)), serverMaxUploadMb: app.services.env.MAX_UPLOAD_MB }));

  // ---------- email delivery ----------

  r.get('/email', async () => ok(await email.get()));
  r.put('/email', { schema: { body: emailSettingsSchema } }, async (request) => ok(await email.update(request.body, auditContext(request))));
  r.post('/email/test', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, schema: { body: emailTestSchema } }, async (request) =>
    ok(await email.test(request.body.to, request.body.settings, auditContext(request))),
  );

  // ---------- storage & content ----------

  r.get('/storage', async () => ok(await adminInsights.storage()));
  r.get('/content', { schema: { querystring: adminContentQuerySchema } }, async (request) => ok(await adminInsights.content(request.query)));
  r.post('/content/:id/revoke-link', { schema: { params: idParams } }, async (request) => {
    await adminInsights.revokeLink(request.params.id, auditContext(request));
    return ok({ revoked: true });
  });
  r.post('/content/:id/transfer', { schema: { params: idParams, body: adminTransferSchema } }, async (request) => {
    await adminUsers.transferFile(request.params.id, request.body.toUserId, auditContext(request));
    return ok({ transferred: true });
  });

  // ---------- audit & activity ----------

  r.get('/audit', { schema: { querystring: adminAuditQuerySchema } }, async (request) => ok(await adminInsights.auditPage(request.query)));
  r.get('/audit/export', { config: { media: true }, schema: { querystring: adminAuditQuerySchema.omit({ cursor: true, limit: true }) } }, async (request, reply) =>
    csv(reply, `qub-audit-${new Date().toISOString().slice(0, 10)}.csv`, adminInsights.auditCsv(request.query)),
  );
  r.get('/activity', { schema: { querystring: adminActivityQuerySchema } }, async (request) => ok(await adminInsights.activityPage(request.query)));

  // ---------- security ----------

  r.get('/security', async () => ok(await adminInsights.security()));
  r.get('/sessions', { schema: { querystring: adminSessionsQuerySchema } }, async (request) => ok(await adminInsights.sessions(actor(request).sessionId, request.query)));
  r.delete('/sessions/:id', { schema: { params: idParams } }, async (request) => {
    await adminUsers.revokeSession(request.params.id, auditContext(request));
    return ok({ revoked: true });
  });
  r.post('/sessions/revoke-all', async (request) => ok(await adminUsers.revokeAllSessions(actor(request).sessionId, auditContext(request))));

  // ---------- system ----------

  r.get('/system', async () => ok(await adminInsights.system()));
}
