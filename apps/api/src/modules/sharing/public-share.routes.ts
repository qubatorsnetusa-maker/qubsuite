import { cellsQuerySchema } from '@qub/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok, sendStored } from '../../http/respond';
import { requireAuth } from '../../plugins/auth';

const tokenParams = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/) });
const access = z.object({ access: z.string().max(2000).optional() });

/** "Anyone with the link" endpoints. Every call re-validates the link and that the target lies within it. */
export async function publicShareRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { publicShare, storage } = app.services;
  const limited = { rateLimit: { max: 60, timeWindow: '1 minute' } };

  r.get('/:token', { config: limited, schema: { params: tokenParams } }, async (request) => ok(await publicShare.resolve(request.params.token, undefined)));

  // Passwords go in a POST body, never in URLs.
  r.post('/:token/access', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, schema: { params: tokenParams, body: z.object({ password: z.string().min(1).max(128) }) } }, async (request) =>
    ok(await publicShare.resolve(request.params.token, request.body.password)),
  );

  r.get('/:token/folders/:folderId', { config: limited, schema: { params: tokenParams.extend({ folderId: z.uuid() }), querystring: access } }, async (request) =>
    ok(await publicShare.listFolder(request.params.token, request.query.access, request.params.folderId)),
  );

  const fileParams = tokenParams.extend({ fileId: z.uuid() });
  r.get('/:token/files/:fileId/download', { config: limited, schema: { params: fileParams, querystring: access.extend({ inline: z.enum(['1', '0']).default('0') }) } }, async (request, reply) => {
    const file = await publicShare.fileForDownload(request.params.token, request.query.access, request.params.fileId);
    return sendStored(request, reply, storage, { key: file.storageKey!, size: file.size, mimeType: file.mimeType, name: file.name }, request.query.inline === '1' ? 'inline' : 'attachment');
  });
  r.get('/:token/files/:fileId/document', { config: limited, schema: { params: fileParams, querystring: access } }, async (request) =>
    ok(await publicShare.documentContent(request.params.token, request.query.access, request.params.fileId)),
  );
  r.get('/:token/files/:fileId/spreadsheet', { config: limited, schema: { params: fileParams, querystring: access } }, async (request) =>
    ok(await publicShare.spreadsheet(request.params.token, request.query.access, request.params.fileId)),
  );
  r.get(
    '/:token/files/:fileId/spreadsheet/:sheetId/cells',
    { config: limited, schema: { params: fileParams.extend({ sheetId: z.uuid() }), querystring: cellsQuerySchema.extend(access.shape) } },
    async (request) => {
      const { access: accessToken, ...range } = request.query;
      return ok(await publicShare.spreadsheetCells(request.params.token, accessToken, request.params.fileId, request.params.sheetId, range));
    },
  );

  r.post('/:token/redeem', { preHandler: app.authenticate, schema: { params: tokenParams, body: z.object({ password: z.string().max(128).optional() }) } }, async (request) =>
    ok(await publicShare.redeem(requireAuth(request).userId, request.params.token, request.body.password)),
  );
}
