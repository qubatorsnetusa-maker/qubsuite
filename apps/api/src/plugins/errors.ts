import type { ApiErrorBody, ErrorCode } from '@qub/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { pgErrorCode } from '../utils/pg';

function body(code: ErrorCode, message: string, details?: unknown): ApiErrorBody {
  return { success: false, error: details === undefined ? { code, message } : { code, message, details } };
}

/**
 * Postgres error codes that map to client errors. Messages never include SQL or constraint internals.
 * Drizzle wraps driver errors, so the SQLSTATE is read through `cause`.
 */
function fromPostgres(err: unknown): { status: number; code: ErrorCode; message: string } | null {
  switch (pgErrorCode(err)) {
    case '23505':
      return { status: 409, code: 'CONFLICT', message: 'This conflicts with an existing item.' };
    case '23503':
      return { status: 409, code: 'CONFLICT', message: 'A related item does not exist or is still in use.' };
    case '23514':
    case '23502':
    case '22P02':
    case '22001':
      return { status: 422, code: 'VALIDATION_ERROR', message: 'The request contains invalid data.' };
    case '40001':
    case '40P01':
      return { status: 409, code: 'CONFLICT', message: 'The operation conflicted with another change. Please retry.' };
    default:
      return null;
  }
}

/**
 * One error format for every endpoint: `{ success: false, error: { code, message, details? } }`.
 * Details are logged server-side; production responses never contain stack traces or SQL.
 */
export const errorsPlugin = fp(async (app: FastifyInstance) => {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send(body('ROUTE_NOT_FOUND', `Route ${request.method} ${request.url.split('?')[0]} not found.`));
  });

  app.setErrorHandler((error: FastifyError & { code?: string }, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, error.message);
      return reply.code(error.statusCode).send(body(error.code, error.message, error.details));
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const where = error.validationContext ?? 'body';
      const issues = error.validation.map((v) => ({
        path: (v.instancePath || '').replace(/^\//, '').split('/').filter(Boolean),
        message: v.message,
      }));
      // Malformed params/query are 400; well-formed JSON bodies that fail business validation are 422.
      const status = where === 'body' ? 422 : 400;
      return reply
        .code(status)
        .send(body(status === 422 ? 'VALIDATION_ERROR' : 'BAD_REQUEST', `Invalid request ${where}.`, { issues }));
    }

    if (error instanceof ZodError) {
      return reply.code(422).send(body('VALIDATION_ERROR', 'Invalid request.', { issues: error.issues.map((i) => ({ path: i.path, message: i.message })) }));
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, 'Response serialization failed');
      return reply.code(500).send(body('INTERNAL_ERROR', 'An unexpected error occurred.'));
    }

    if (error.statusCode === 429) {
      return reply.code(429).send(body('RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.'));
    }
    if (error.code === 'FST_REQ_FILE_TOO_LARGE' || error.code === 'FST_ERR_CTP_BODY_TOO_LARGE' || error.statusCode === 413) {
      return reply.code(413).send(body('PAYLOAD_TOO_LARGE', 'The upload is too large.'));
    }
    if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || error.code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
      return reply.code(415).send(body('UNSUPPORTED_MEDIA_TYPE', 'Unsupported content type.'));
    }
    if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
      return reply.code(400).send(body('BAD_REQUEST', 'Malformed JSON body.'));
    }
    if (error.code?.startsWith('FST_JWT')) {
      return reply.code(401).send(body('UNAUTHENTICATED', 'Authentication is required.'));
    }

    const pg = fromPostgres(error);
    if (pg) {
      request.log.warn({ err: error }, 'Database constraint rejected request');
      return reply.code(pg.status).send(body(pg.code, pg.message));
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send(body(error.statusCode === 401 ? 'UNAUTHENTICATED' : 'BAD_REQUEST', error.message));
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send(body('INTERNAL_ERROR', 'An unexpected error occurred.'));
  });
});
