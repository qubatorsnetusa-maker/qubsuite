import type { ApiSuccess } from '@qub/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { StorageService } from '../services/storage';
import { AppError } from '../utils/errors';
import { contentDisposition } from '../utils/filename';
import { isInlineSafe } from '../utils/mime';

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function auditContext(request: FastifyRequest) {
  return {
    actorId: request.auth?.userId ?? null,
    ip: request.ip,
    userAgent: request.headers['user-agent'] ?? null,
    requestId: request.id,
  };
}

function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

/**
 * Streams a stored object with HTTP range support (video/audio seeking, resumable downloads).
 * Only known-safe types render inline, and a sandbox CSP prevents served content from executing scripts.
 */
export async function sendStored(
  request: FastifyRequest,
  reply: FastifyReply,
  storage: StorageService,
  file: { key: string; size: number; mimeType: string; name: string },
  mode: 'inline' | 'attachment',
) {
  const disposition = mode === 'inline' && isInlineSafe(file.mimeType) ? 'inline' : 'attachment';
  const range = parseRange(request.headers.range, file.size);
  if (range === 'invalid') {
    reply.header('Content-Range', `bytes */${file.size}`);
    throw new AppError('BAD_REQUEST', 'Invalid range.');
  }
  const object = await storage.get(file.key, range ?? undefined);
  reply
    .header('Content-Type', disposition === 'inline' ? file.mimeType : 'application/octet-stream')
    .header('Content-Disposition', contentDisposition(disposition, file.name))
    .header('X-Content-Type-Options', 'nosniff')
    .header('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'")
    .header('Cache-Control', 'private, max-age=0, must-revalidate')
    .header('Accept-Ranges', 'bytes');
  if (range) {
    reply.code(206).header('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`).header('Content-Length', range.end - range.start + 1);
  } else {
    reply.header('Content-Length', file.size);
  }
  return reply.send(object.stream);
}
