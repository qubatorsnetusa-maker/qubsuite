import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * One structured line per request: request id, user, route, resource id, status and duration.
 * Query strings are dropped (WebSocket tokens and share tokens travel there) and bodies are never logged.
 */
export const requestLoggingPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onResponse', async (request, reply) => {
    const params = (request.params ?? {}) as Record<string, string>;
    const resourceId = params.id ?? params.documentId ?? params.spreadsheetId ?? params.formId ?? params.publicId;
    const level = reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info';
    request.log[level](
      {
        http: {
          method: request.method,
          route: request.routeOptions.url ?? 'unmatched',
          path: request.url.split('?')[0]!.replace(/\/share\/[^/]+/, '/share/[token]'),
          ip: request.ip,
        },
        userId: request.auth?.userId ?? null,
        resourceId: resourceId && /^[0-9a-f-]{36}$/i.test(resourceId) ? resourceId : undefined,
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      'request completed',
    );
  });
});
