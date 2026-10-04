import {
  createCommentSchema,
  createDocumentSchema,
  createReplySchema,
  createSuggestionSchema,
  createVersionSchema,
  renameResourceSchema,
  updateCommentSchema,
} from '@qub/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok, sendStored } from '../../http/respond';
import { requireAuth } from '../../plugins/auth';
import { badRequest } from '../../utils/errors';

const idParams = z.object({ id: z.uuid() });
const commentParams = idParams.extend({ commentId: z.uuid() });
const replyParams = commentParams.extend({ replyId: z.uuid() });

export async function docsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { docs, comments, storage } = app.services;
  app.addHook('preHandler', async (request) =>
    request.routeOptions.config?.media ? app.mediaAuth(request) : app.authenticate(request),
  );
  const uid = (req: FastifyRequest) => requireAuth(req).userId;

  r.post('/', { schema: { body: createDocumentSchema } }, async (request, reply) => reply.code(201).send(ok(await docs.create(uid(request), request.body))));
  r.get('/:id', { schema: { params: idParams } }, async (request) => ok(await docs.get(uid(request), request.params.id)));
  r.patch('/:id', { schema: { params: idParams, body: renameResourceSchema } }, async (request) => ok(await docs.rename(uid(request), request.params.id, request.body.title)));
  r.post('/:id/trash', { schema: { params: idParams } }, async (request) => {
    await docs.trash(uid(request), request.params.id);
    return ok({ trashed: true });
  });
  r.get('/:id/collaborators', { schema: { params: idParams } }, async (request) => ok(await docs.collaborators(uid(request), request.params.id)));

  r.post('/:id/images', { schema: { params: idParams } }, async (request, reply) => {
    const part = await request.file({ limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
    if (!part) throw badRequest('No image uploaded.');
    return reply.code(201).send(ok(await docs.uploadAsset(uid(request), request.params.id, { stream: part.file, filename: part.filename })));
  });
  r.get('/:id/assets/:assetId', { config: { media: true }, schema: { params: idParams.extend({ assetId: z.uuid() }) } }, async (request, reply) => {
    const asset = await docs.assetForDownload(uid(request), request.params.id, request.params.assetId);
    return sendStored(request, reply, storage, { key: asset.storageKey, size: asset.size, mimeType: asset.mimeType, name: 'image' }, 'inline');
  });

  // versions
  r.get('/:id/versions', { schema: { params: idParams } }, async (request) => ok(await docs.listVersions(uid(request), request.params.id)));
  r.post('/:id/versions', { schema: { params: idParams, body: createVersionSchema } }, async (request, reply) =>
    reply.code(201).send(ok(await docs.createVersion(uid(request), request.params.id, request.body.name))),
  );
  const versionParams = idParams.extend({ versionId: z.uuid() });
  r.get('/:id/versions/:versionId', { schema: { params: versionParams } }, async (request) => ok(await docs.getVersion(uid(request), request.params.id, request.params.versionId)));
  r.post('/:id/versions/:versionId/restore', { schema: { params: versionParams } }, async (request) =>
    ok(await docs.restoreVersion(uid(request), request.params.id, request.params.versionId)),
  );

  // comments
  r.get('/:id/comments', { schema: { params: idParams } }, async (request) => ok(await comments.list(uid(request), request.params.id)));
  r.post('/:id/comments', { schema: { params: idParams, body: createCommentSchema } }, async (request, reply) =>
    reply.code(201).send(ok(await comments.create(uid(request), request.params.id, request.body))),
  );
  r.patch('/:id/comments/:commentId', { schema: { params: commentParams, body: updateCommentSchema } }, async (request) => {
    await comments.update(uid(request), request.params.id, request.params.commentId, request.body);
    return ok(await comments.list(uid(request), request.params.id));
  });
  r.delete('/:id/comments/:commentId', { schema: { params: commentParams } }, async (request) => {
    await comments.remove(uid(request), request.params.id, request.params.commentId);
    return ok({ deleted: true });
  });
  r.post('/:id/comments/:commentId/resolve', { schema: { params: commentParams } }, async (request) => {
    await comments.setResolved(uid(request), request.params.id, request.params.commentId, true);
    return ok(await comments.list(uid(request), request.params.id));
  });
  r.post('/:id/comments/:commentId/reopen', { schema: { params: commentParams } }, async (request) => {
    await comments.setResolved(uid(request), request.params.id, request.params.commentId, false);
    return ok(await comments.list(uid(request), request.params.id));
  });
  r.post('/:id/comments/:commentId/replies', { schema: { params: commentParams, body: createReplySchema } }, async (request, reply) => {
    await comments.reply(uid(request), request.params.id, request.params.commentId, request.body);
    return reply.code(201).send(ok(await comments.list(uid(request), request.params.id)));
  });
  r.patch('/:id/comments/:commentId/replies/:replyId', { schema: { params: replyParams, body: updateCommentSchema } }, async (request) => {
    await comments.updateReply(uid(request), request.params.id, request.params.commentId, request.params.replyId, request.body);
    return ok(await comments.list(uid(request), request.params.id));
  });
  r.delete('/:id/comments/:commentId/replies/:replyId', { schema: { params: replyParams } }, async (request) => {
    await comments.removeReply(uid(request), request.params.id, request.params.commentId, request.params.replyId);
    return ok({ deleted: true });
  });

  // suggestions
  r.get('/:id/suggestions', { schema: { params: idParams } }, async (request) => ok(await comments.listSuggestions(uid(request), request.params.id)));
  r.post('/:id/suggestions', { schema: { params: idParams, body: createSuggestionSchema } }, async (request, reply) => {
    await comments.createSuggestion(uid(request), request.params.id, request.body);
    return reply.code(201).send(ok(await comments.listSuggestions(uid(request), request.params.id)));
  });
  const suggestionParams = idParams.extend({ suggestionId: z.uuid() });
  r.post('/:id/suggestions/:suggestionId/accept', { schema: { params: suggestionParams } }, async (request) => {
    await comments.resolveSuggestion(uid(request), request.params.id, request.params.suggestionId, 'ACCEPTED');
    return ok(await comments.listSuggestions(uid(request), request.params.id));
  });
  r.post('/:id/suggestions/:suggestionId/reject', { schema: { params: suggestionParams } }, async (request) => {
    await comments.resolveSuggestion(uid(request), request.params.id, request.params.suggestionId, 'REJECTED');
    return ok(await comments.listSuggestions(uid(request), request.params.id));
  });
}
