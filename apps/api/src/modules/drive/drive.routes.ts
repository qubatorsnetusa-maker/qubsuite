import {
  copyItemSchema,
  createFolderSchema,
  createFolderTreeSchema,
  driveActivityQuerySchema,
  driveListQuerySchema,
  driveSearchQuerySchema,
  driveViewQuerySchema,
  generalAccessSchema,
  libraryQuerySchema,
  moveItemSchema,
  paginationQuerySchema,
  reportSpamSchema,
  shareSchema,
  updateItemSchema,
  updatePermissionSchema,
} from '@qub/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { auditContext, ok, sendStored } from '../../http/respond';
import { requireAuth } from '../../plugins/auth';
import { badRequest, notFound } from '../../utils/errors';

const idParams = z.object({ id: z.uuid() });
const kindParams = z.object({ kind: z.enum(['files', 'folders']), id: z.uuid() });

export async function driveRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { drive, files, folders, search, library, sharing, activity, permissions, storage, spam, thumbnails } = app.services;
  const env = app.services.env;
  app.addHook('preHandler', async (request) => {
    // Content endpoints use media auth (cookie or bearer); everything else requires a bearer token.
    if ((request.routeOptions.config as { media?: boolean } | undefined)?.media) return app.mediaAuth(request);
    return app.authenticate(request);
  });
  const uid = (req: FastifyRequest) => requireAuth(req).userId;

  // ---------- views ----------

  r.get('/root', async (request) => ok(await folders.get(uid(request), (await folders.rootOf(uid(request))).id)));

  r.get('/items', { schema: { querystring: driveListQuerySchema } }, async (request) => ok(await drive.list(uid(request), request.query)));
  r.get('/shared', { schema: { querystring: driveViewQuerySchema } }, async (request) => ok(await drive.sharedWithMe(uid(request), request.query)));
  r.get('/recent', { schema: { querystring: driveViewQuerySchema } }, async (request) => ok(await drive.recent(uid(request), request.query)));
  r.get('/starred', { schema: { querystring: driveViewQuerySchema } }, async (request) => ok(await drive.starred(uid(request), request.query)));
  r.get('/trash', { schema: { querystring: driveViewQuerySchema } }, async (request) => ok(await drive.trash(uid(request), request.query)));
  r.get('/trash/folders/:id', { schema: { params: idParams, querystring: driveViewQuerySchema } }, async (request) =>
    ok(await drive.listTrashedFolder(uid(request), request.params.id, request.query)),
  );
  r.post('/trash/empty', async (request) => ok(await drive.emptyTrash(uid(request))));
  r.get('/spam', { schema: { querystring: driveViewQuerySchema } }, async (request) => ok(await spam.list(uid(request), request.query)));
  r.post('/spam/empty', async (request) => ok(await spam.empty(uid(request))));
  r.get('/search', { schema: { querystring: driveSearchQuerySchema } }, async (request) => ok(await search.search(uid(request), request.query)));
  r.get('/library', { schema: { querystring: libraryQuerySchema } }, async (request) => ok(await library.list(uid(request), request.query)));
  r.get('/suggested', async (request) => ok(await library.suggested(uid(request))));
  r.get('/people', async (request) => ok(await drive.people(uid(request))));
  r.get('/storage', async (request) => ok(await drive.storageSummary(uid(request))));
  r.get('/activity', { schema: { querystring: driveActivityQuerySchema } }, async (request) => ok(await activity.feed(uid(request), request.query)));

  // ---------- files ----------

  r.post('/files/upload', { schema: { querystring: z.object({ folderId: z.uuid().optional() }) } }, async (request, reply) => {
    const part = await request.file({ limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 } });
    if (!part) throw badRequest('No file uploaded.');
    const dto = await files.upload(uid(request), request.query.folderId, { stream: part.file, filename: part.filename });
    return reply.code(201).send(ok(dto));
  });

  r.get('/files/:id', { schema: { params: idParams } }, async (request) => ok(await files.get(uid(request), request.params.id)));
  r.patch('/files/:id', { schema: { params: idParams, body: updateItemSchema } }, async (request) => ok(await files.update(uid(request), request.params.id, request.body)));
  r.post('/files/:id/move', { schema: { params: idParams, body: moveItemSchema } }, async (request) => ok(await files.move(uid(request), request.params.id, request.body.folderId)));
  r.post('/files/:id/trash', { schema: { params: idParams } }, async (request) => ok(await files.trash(uid(request), request.params.id)));
  r.post('/files/:id/restore', { schema: { params: idParams } }, async (request) => ok(await files.restore(uid(request), request.params.id)));
  r.delete('/files/:id', { schema: { params: idParams } }, async (request) => {
    await files.deletePermanently(uid(request), request.params.id);
    return ok({ deleted: true });
  });
  r.post('/files/:id/copy', { schema: { params: idParams, body: copyItemSchema } }, async (request, reply) =>
    reply.code(201).send(ok(await files.copy(uid(request), request.params.id, request.body))),
  );
  r.put('/files/:id/star', { schema: { params: idParams } }, async (request) => {
    await drive.setStar(uid(request), 'file', request.params.id, true);
    return ok({ starred: true });
  });
  r.delete('/files/:id/star', { schema: { params: idParams } }, async (request) => {
    await drive.setStar(uid(request), 'file', request.params.id, false);
    return ok({ starred: false });
  });

  r.get('/files/:id/download', { config: { media: true }, schema: { params: idParams } }, async (request, reply) => {
    const file = await files.forDownload(uid(request), request.params.id, 'download');
    return sendStored(request, reply, storage, { key: file.storageKey!, size: file.size, mimeType: file.mimeType, name: file.name }, 'attachment');
  });
  r.get('/files/:id/content', { config: { media: true }, schema: { params: idParams, querystring: z.object({ purpose: z.enum(['view', 'thumbnail']).default('view') }) } }, async (request, reply) => {
    // Grid cards read a video's first frame or a text file's first lines from here; that isn't an open.
    const file = request.query.purpose === 'thumbnail' ? await files.forThumbnail(uid(request), request.params.id) : await files.forDownload(uid(request), request.params.id, 'preview');
    if (!file.storageKey) throw badRequest('Open this file in its Qub app instead.');
    return sendStored(request, reply, storage, { key: file.storageKey!, size: file.size, mimeType: file.mimeType, name: file.name }, 'inline');
  });

  r.get('/files/:id/thumbnail', { config: { media: true }, schema: { params: idParams } }, async (request, reply) => {
    const image = await thumbnails.get(await files.forThumbnail(uid(request), request.params.id));
    if (!image) throw notFound('thumbnail');
    // The URL carries the content checksum (see the file DTO), so a cached thumbnail never goes stale.
    return reply
      .header('Content-Type', 'image/webp')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, max-age=31536000, immutable')
      .send(image);
  });

  r.get('/files/:id/versions', { schema: { params: idParams } }, async (request) => ok(await files.listVersions(uid(request), request.params.id)));
  r.post('/files/:id/versions', { schema: { params: idParams } }, async (request, reply) => {
    const part = await request.file({ limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });
    if (!part) throw badRequest('No file uploaded.');
    return reply.code(201).send(ok(await files.uploadVersion(uid(request), request.params.id, { stream: part.file, filename: part.filename })));
  });
  const versionParams = z.object({ id: z.uuid(), versionId: z.uuid() });
  r.post('/files/:id/versions/:versionId/restore', { schema: { params: versionParams } }, async (request) =>
    ok(await files.restoreVersion(uid(request), request.params.id, request.params.versionId)),
  );
  r.delete('/files/:id/versions/:versionId', { schema: { params: versionParams } }, async (request) =>
    ok(await files.deleteVersion(uid(request), request.params.id, request.params.versionId)),
  );
  r.get('/files/:id/versions/:versionId/download', { config: { media: true }, schema: { params: versionParams } }, async (request, reply) => {
    const { file, version } = await files.versionForDownload(uid(request), request.params.id, request.params.versionId);
    const dot = file.name.lastIndexOf('.');
    const name = dot > 0 ? `${file.name.slice(0, dot)} (v${version.versionNumber})${file.name.slice(dot)}` : `${file.name} (v${version.versionNumber})`;
    return sendStored(request, reply, storage, { key: version.storageKey, size: version.size, mimeType: version.mimeType, name }, 'attachment');
  });

  r.get('/files/:id/activity', { schema: { params: idParams, querystring: paginationQuerySchema } }, async (request) => {
    await permissions.requireFile(uid(request), request.params.id, 'VIEWER');
    return ok(await activity.listForResource([request.params.id], request.query.cursor, request.query.limit));
  });

  // ---------- folders ----------

  r.post('/folders', { schema: { body: createFolderSchema } }, async (request, reply) => reply.code(201).send(ok(await folders.create(uid(request), request.body))));
  r.post('/folders/tree', { schema: { body: createFolderTreeSchema } }, async (request, reply) =>
    reply.code(201).send(ok(await folders.createTree(uid(request), request.body.parentId, request.body.paths))),
  );
  r.get('/folders/:id', { schema: { params: idParams } }, async (request) => ok(await folders.get(uid(request), request.params.id)));
  r.patch('/folders/:id', { schema: { params: idParams, body: updateItemSchema } }, async (request) => ok(await folders.update(uid(request), request.params.id, request.body)));
  r.post('/folders/:id/move', { schema: { params: idParams, body: moveItemSchema } }, async (request) => ok(await folders.move(uid(request), request.params.id, request.body.folderId)));
  r.post('/folders/:id/trash', { schema: { params: idParams } }, async (request) => {
    await folders.trash(uid(request), request.params.id);
    return ok({ trashed: true });
  });
  r.post('/folders/:id/restore', { schema: { params: idParams } }, async (request) => ok(await folders.restore(uid(request), request.params.id)));
  r.delete('/folders/:id', { schema: { params: idParams } }, async (request) => {
    await folders.deletePermanently(uid(request), request.params.id);
    return ok({ deleted: true });
  });
  r.post('/folders/:id/copy', { schema: { params: idParams, body: copyItemSchema } }, async (request, reply) => {
    const result = await drive.copyFolder(uid(request), request.params.id, request.body);
    return reply.code(result.status === 'queued' ? 202 : 201).send(ok(result));
  });
  r.put('/folders/:id/star', { schema: { params: idParams } }, async (request) => {
    await drive.setStar(uid(request), 'folder', request.params.id, true);
    return ok({ starred: true });
  });
  r.delete('/folders/:id/star', { schema: { params: idParams } }, async (request) => {
    await drive.setStar(uid(request), 'folder', request.params.id, false);
    return ok({ starred: false });
  });
  r.get('/folders/:id/activity', { schema: { params: idParams, querystring: paginationQuerySchema } }, async (request) => {
    await permissions.requireFolder(uid(request), request.params.id, 'VIEWER');
    return ok(await activity.listForResource([request.params.id], request.query.cursor, request.query.limit));
  });

  // ---------- sharing (one implementation for files and folders; Docs/Sheets/Forms use their file) ----------

  // ---------- spam & removing items shared with you ----------

  const kindOf = (k: 'files' | 'folders') => (k === 'files' ? ('file' as const) : ('folder' as const));
  r.post('/:kind/:id/spam', { schema: { params: kindParams, body: reportSpamSchema } }, async (request) =>
    ok(await spam.report(uid(request), kindOf(request.params.kind), request.params.id, request.body)),
  );
  r.delete('/:kind/:id/spam', { schema: { params: kindParams } }, async (request) => {
    await spam.notSpam(uid(request), kindOf(request.params.kind), request.params.id);
    return ok({ spam: false });
  });
  r.delete('/:kind/:id/access', { schema: { params: kindParams } }, async (request) => {
    await spam.removeAccess(uid(request), kindOf(request.params.kind), request.params.id);
    return ok({ removed: true });
  });

  const ref = (p: { kind: 'files' | 'folders'; id: string }) => ({ type: p.kind === 'files' ? ('FILE' as const) : ('FOLDER' as const), id: p.id });

  r.get('/:kind/:id/share', { schema: { params: kindParams } }, async (request) => ok(await sharing.getState(uid(request), ref(request.params))));
  r.post('/:kind/:id/share', { schema: { params: kindParams, body: shareSchema } }, async (request) =>
    ok(await sharing.share(uid(request), ref(request.params), request.body, auditContext(request))),
  );
  const permParams = kindParams.extend({ permissionId: z.uuid() });
  r.patch('/:kind/:id/permissions/:permissionId', { schema: { params: permParams, body: updatePermissionSchema } }, async (request) =>
    ok(await sharing.updatePermission(uid(request), ref(request.params), request.params.permissionId, request.body, auditContext(request))),
  );
  r.delete('/:kind/:id/permissions/:permissionId', { schema: { params: permParams } }, async (request) => {
    await sharing.removePermission(uid(request), ref(request.params), request.params.permissionId, auditContext(request));
    return ok({ removed: true });
  });
  r.delete('/:kind/:id/invites/:inviteId', { schema: { params: kindParams.extend({ inviteId: z.uuid() }) } }, async (request) => {
    await sharing.cancelInvite(uid(request), ref(request.params), request.params.inviteId);
    return ok({ removed: true });
  });
  r.put('/:kind/:id/general-access', { schema: { params: kindParams, body: generalAccessSchema } }, async (request) =>
    ok(await sharing.setGeneralAccess(uid(request), ref(request.params), request.body, auditContext(request))),
  );
  r.post('/:kind/:id/link/rotate', { schema: { params: kindParams } }, async (request) =>
    ok(await sharing.rotateLink(uid(request), ref(request.params), auditContext(request))),
  );
}
