import { blockUserSchema, emailSchema, updateProfileSchema } from '@qub/shared';
import type { FastifyInstance } from 'fastify';
import { fileTypeFromBuffer } from 'file-type';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok, sendStored } from '../../http/respond';
import { requireAuth } from '../../plugins/auth';
import { AppError, badRequest, notFound } from '../../utils/errors';
import { UserRepository } from './user.repository';

const avatarKey = (userId: string) => `avatars/${userId.toLowerCase()}/avatar`;

export async function userRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { db, storage } = app.services;

  r.get('/me', { preHandler: app.authenticate }, async (request) => {
    const user = await UserRepository.findById(db, requireAuth(request).userId);
    return ok(await UserRepository.toCurrentUser(db, user!));
  });

  r.patch('/me', { preHandler: app.authenticate, schema: { body: updateProfileSchema } }, async (request) => {
    const updated = await UserRepository.update(db, requireAuth(request).userId, { ...(request.body.name ? { name: request.body.name } : {}) });
    return ok(await UserRepository.toCurrentUser(db, updated!));
  });

  r.post('/me/avatar', { preHandler: app.authenticate }, async (request) => {
    const userId = requireAuth(request).userId;
    const part = await request.file({ limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
    if (!part) throw badRequest('No file uploaded.');
    const tmpKey = storage.newKey('avatars', userId);
    const stored = await storage.ingest(part.file, { filename: part.filename, key: tmpKey, maxBytes: 5 * 1024 * 1024 });
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(stored.mimeType)) {
      await storage.safeDelete(tmpKey);
      throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Avatars must be PNG, JPEG, WebP or GIF images.');
    }
    await storage.copy(tmpKey, avatarKey(userId));
    await storage.safeDelete(tmpKey);
    const updated = await UserRepository.update(db, userId, { avatarUrl: `/api/users/${userId}/avatar?v=${Date.now()}` });
    return ok(await UserRepository.toCurrentUser(db, updated!));
  });

  r.delete('/me/avatar', { preHandler: app.authenticate }, async (request) => {
    const userId = requireAuth(request).userId;
    await storage.safeDelete(avatarKey(userId));
    const updated = await UserRepository.update(db, userId, { avatarUrl: null });
    return ok(await UserRepository.toCurrentUser(db, updated!));
  });

  /** Avatars are visible to any signed-in user (they appear on shared items, comments and presence). */
  r.get('/:id/avatar', { preHandler: app.mediaAuth, schema: { params: z.object({ id: z.uuid() }) } }, async (request, reply) => {
    const user = await UserRepository.findById(db, request.params.id);
    if (!user?.avatarUrl) throw notFound('avatar');
    const key = avatarKey(user.id);
    const size = await storage.provider.size(key);
    if (size === null) throw notFound('avatar');
    // The type was validated on upload; re-sniff the header bytes to label the response correctly.
    const head = await storage.get(key, { start: 0, end: Math.min(size, 4100) - 1 });
    const chunks: Buffer[] = [];
    for await (const chunk of head.stream) chunks.push(chunk as Buffer);
    const sniffed = await fileTypeFromBuffer(Buffer.concat(chunks));
    reply.header('Cache-Control', 'private, max-age=86400');
    return sendStored(request, reply, storage, { key, size, mimeType: sniffed?.mime ?? 'image/png', name: 'avatar' }, 'inline');
  });

  // People the user blocked: they can't share with or notify the user.
  r.get('/blocked', { preHandler: app.authenticate }, async (request) => ok(await app.services.spam.blocked(requireAuth(request).userId)));
  r.post('/blocked', { preHandler: app.authenticate, schema: { body: blockUserSchema } }, async (request) => {
    await app.services.spam.block(requireAuth(request).userId, request.body.userId);
    return ok({ blocked: true });
  });
  r.delete('/blocked/:id', { preHandler: app.authenticate, schema: { params: z.object({ id: z.uuid() }) } }, async (request) => {
    await app.services.spam.unblock(requireAuth(request).userId, request.params.id);
    return ok({ blocked: false });
  });

  /** Exact-match lookup for the share dialog. Never lists or searches other users. */
  r.get('/lookup', { preHandler: app.authenticate, schema: { querystring: z.object({ email: emailSchema }) } }, async (request) => {
    const user = await UserRepository.findByEmail(db, request.query.email);
    return ok(user && user.status === 'ACTIVE' ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } : null);
  });
}
