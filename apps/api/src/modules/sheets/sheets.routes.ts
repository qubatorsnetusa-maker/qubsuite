import {
  cellsQuerySchema,
  createSheetCommentSchema,
  createSpreadsheetSchema,
  createVersionSchema,
  createWorksheetSchema,
  csvImportQuerySchema,
  filterQuerySchema,
  findQuerySchema,
  namedRangeSchema,
  renameResourceSchema,
  sheetOpsSchema,
  updateWorksheetSchema,
} from '@qub/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../../http/respond';
import { requireAuth } from '../../plugins/auth';
import { badRequest } from '../../utils/errors';

const idParams = z.object({ id: z.uuid() });
const sheetParams = idParams.extend({ sheetId: z.uuid() });

export async function sheetsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { sheets } = app.services;
  // Download links (CSV export) can't carry a bearer token, so they also accept the session-bound media cookie.
  app.addHook('preHandler', async (request) => (request.routeOptions.config?.media ? app.mediaAuth(request) : app.authenticate(request)));
  const uid = (req: FastifyRequest) => requireAuth(req).userId;

  r.post('/', { schema: { body: createSpreadsheetSchema } }, async (request, reply) => reply.code(201).send(ok(await sheets.create(uid(request), request.body))));
  r.get('/:id', { schema: { params: idParams } }, async (request) => ok(await sheets.get(uid(request), request.params.id)));
  r.patch('/:id', { schema: { params: idParams, body: renameResourceSchema } }, async (request) => ok(await sheets.rename(uid(request), request.params.id, request.body.title)));
  r.post('/:id/trash', { schema: { params: idParams } }, async (request) => {
    const { file } = await sheets.access(uid(request), request.params.id);
    await app.services.files.trash(uid(request), file.id);
    return ok({ trashed: true });
  });

  /** Viewport-sized reads: the client fetches only the visible window of cells. */
  r.get('/:id/worksheets/:sheetId/cells', { schema: { params: sheetParams, querystring: cellsQuerySchema } }, async (request) =>
    ok(await sheets.cells(uid(request), request.params.id, request.params.sheetId, request.query)),
  );
  /** The whole sheet at once, for printing (needs download permission). */
  r.get('/:id/worksheets/:sheetId/print', { schema: { params: sheetParams } }, async (request) =>
    ok(await sheets.printData(uid(request), request.params.id, request.params.sheetId)),
  );

  /** REST path for the same operations the WebSocket accepts (used for large pastes and non-realtime clients). */
  r.post('/:id/ops', { schema: { params: idParams, body: sheetOpsSchema.extend({ clientOpId: z.string().max(64).optional() }) } }, async (request) =>
    ok(await sheets.applyOps(uid(request), request.params.id, request.body.ops, { clientOpId: request.body.clientOpId ?? null })),
  );

  r.post('/:id/worksheets', { schema: { params: idParams, body: createWorksheetSchema } }, async (request, reply) =>
    reply.code(201).send(ok(await sheets.addSheet(uid(request), request.params.id, request.body.name))),
  );
  r.patch('/:id/worksheets/:sheetId', { schema: { params: sheetParams, body: updateWorksheetSchema } }, async (request) =>
    ok(await sheets.updateSheet(uid(request), request.params.id, request.params.sheetId, request.body)),
  );
  r.delete('/:id/worksheets/:sheetId', { schema: { params: sheetParams } }, async (request) =>
    ok(await sheets.deleteSheet(uid(request), request.params.id, request.params.sheetId)),
  );
  r.get('/:id/find', { schema: { params: idParams, querystring: findQuerySchema } }, async (request) => ok(await sheets.find(uid(request), request.params.id, request.query)));
  r.get('/:id/worksheets/:sheetId/export.csv', { config: { media: true }, schema: { params: sheetParams } }, async (request, reply) => {
    const { filename, body } = await sheets.exportCsv(uid(request), request.params.id, request.params.sheetId);
    return reply
      .header('content-disposition', `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .type('text/csv; charset=utf-8')
      .send(body);
  });
  r.post('/:id/import', { schema: { params: idParams, querystring: csvImportQuerySchema } }, async (request) => {
    const part = await request.file({ limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
    if (!part) throw badRequest('No file uploaded.');
    const buffer = await part.toBuffer();
    return ok(await sheets.importCsv(uid(request), request.params.id, request.query, part.filename, buffer.toString('utf8')));
  });
  r.get('/:id/worksheets/:sheetId/filter', { schema: { params: sheetParams, querystring: filterQuerySchema } }, async (request) =>
    ok(await sheets.filterRows(uid(request), request.params.id, request.params.sheetId, request.query)),
  );

  r.get('/:id/named-ranges', { schema: { params: idParams } }, async (request) => ok(await sheets.listNamedRanges(uid(request), request.params.id)));
  r.put('/:id/worksheets/:sheetId/named-ranges', { schema: { params: sheetParams, body: namedRangeSchema } }, async (request) =>
    ok(await sheets.setNamedRange(uid(request), request.params.id, request.params.sheetId, request.body.name, request.body.range)),
  );

  r.get('/:id/versions', { schema: { params: idParams } }, async (request) => ok(await sheets.listVersions(uid(request), request.params.id)));
  r.post('/:id/versions', { schema: { params: idParams, body: createVersionSchema } }, async (request, reply) =>
    reply.code(201).send(ok(await sheets.createVersion(uid(request), request.params.id, request.body.name))),
  );
  r.post('/:id/versions/:versionId/restore', { schema: { params: idParams.extend({ versionId: z.uuid() }) } }, async (request) =>
    ok(await sheets.restoreVersion(uid(request), request.params.id, request.params.versionId)),
  );

  r.get('/:id/worksheets/:sheetId/comments', { schema: { params: sheetParams } }, async (request) =>
    ok(await sheets.listComments(uid(request), request.params.id, request.params.sheetId)),
  );
  r.post('/:id/worksheets/:sheetId/comments', { schema: { params: sheetParams, body: createSheetCommentSchema } }, async (request, reply) =>
    reply.code(201).send(ok(await sheets.addComment(uid(request), request.params.id, request.params.sheetId, request.body))),
  );
  const commentParams = idParams.extend({ commentId: z.uuid() });
  r.post('/:id/comments/:commentId/resolve', { schema: { params: commentParams, body: z.object({ resolved: z.boolean() }) } }, async (request) => {
    await sheets.resolveComment(uid(request), request.params.id, request.params.commentId, request.body.resolved);
    return ok({ resolved: request.body.resolved });
  });
  r.delete('/:id/comments/:commentId', { schema: { params: commentParams } }, async (request) => {
    await sheets.deleteComment(uid(request), request.params.id, request.params.commentId);
    return ok({ deleted: true });
  });
}
