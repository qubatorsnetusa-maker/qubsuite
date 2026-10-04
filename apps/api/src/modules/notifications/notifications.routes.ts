import { paginationQuerySchema } from '@qub/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../../http/respond';
import { requireAuth } from '../../plugins/auth';

export async function notificationRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { notifications } = app.services;
  app.addHook('preHandler', app.authenticate);

  r.get('/', { schema: { querystring: paginationQuerySchema.extend({ unreadOnly: z.enum(['true', 'false']).default('false') }) } }, async (request) =>
    ok(await notifications.list(requireAuth(request).userId, { cursor: request.query.cursor, limit: request.query.limit, unreadOnly: request.query.unreadOnly === 'true' })),
  );
  r.get('/unread-count', async (request) => ok({ unreadCount: await notifications.unreadCount(requireAuth(request).userId) }));
  r.post('/read', { schema: { body: z.object({ ids: z.array(z.uuid()).min(1).max(200) }) } }, async (request) =>
    ok({ unreadCount: await notifications.markRead(requireAuth(request).userId, request.body.ids) }),
  );
  r.post('/read-all', async (request) => ok({ unreadCount: await notifications.markRead(requireAuth(request).userId, 'all') }));
}
