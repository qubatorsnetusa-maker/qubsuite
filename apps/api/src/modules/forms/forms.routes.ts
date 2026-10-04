import {
  createFieldSchema,
  createFormSchema,
  createVariableSchema,
  formThemeSchema,
  paginationQuerySchema,
  reorderFieldsSchema,
  setLogicSchema,
  submitResponseSchema,
  updateFieldSchema,
  updateFormSchema,
  updateVariableSchema,
  validateFormulaSchema,
} from '@qub/shared';
import { opTxSchema, type OpTx } from '@qub/shared/forms';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { ok, sendStored } from '../../http/respond';
import { requireAuth } from '../../plugins/auth';
import { badRequest } from '../../utils/errors';
import { contentDisposition } from '../../utils/filename';

const idParams = z.object({ id: z.uuid() });
const fieldParams = idParams.extend({ fieldId: z.uuid() });

export async function formsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { forms, ops, responses, storage, variables } = app.services;
  app.addHook('preHandler', async (request) =>
    request.routeOptions.config?.media ? app.mediaAuth(request) : app.authenticate(request),
  );
  const uid = (req: FastifyRequest) => requireAuth(req).userId;

  r.post('/', { schema: { body: createFormSchema } }, async (request, reply) => reply.code(201).send(ok(await forms.create(uid(request), request.body))));
  r.get('/:id', { schema: { params: idParams } }, async (request) => ok(await forms.get(uid(request), request.params.id)));
  r.patch('/:id', { schema: { params: idParams, body: updateFormSchema } }, async (request) => ok(await forms.update(uid(request), request.params.id, request.body)));
  r.post('/:id/trash', { schema: { params: idParams } }, async (request) => {
    const { file } = await forms.access(uid(request), request.params.id);
    await app.services.files.trash(uid(request), file.id);
    return ok({ trashed: true });
  });

  r.post('/:id/fields', { schema: { params: idParams, body: createFieldSchema } }, async (request, reply) =>
    reply.code(201).send(ok(await forms.addField(uid(request), request.params.id, request.body))),
  );
  r.put('/:id/fields/order', { schema: { params: idParams, body: reorderFieldsSchema } }, async (request) =>
    ok(await forms.reorderFields(uid(request), request.params.id, request.body.fieldIds)),
  );
  r.patch('/:id/fields/:fieldId', { schema: { params: fieldParams, body: updateFieldSchema } }, async (request) =>
    ok(await forms.updateField(uid(request), request.params.id, request.params.fieldId, request.body)),
  );
  r.delete('/:id/fields/:fieldId', { schema: { params: fieldParams } }, async (request) => ok(await forms.deleteField(uid(request), request.params.id, request.params.fieldId)));
  r.post('/:id/fields/:fieldId/duplicate', { schema: { params: fieldParams } }, async (request) =>
    ok(await forms.duplicateField(uid(request), request.params.id, request.params.fieldId)),
  );
  r.put('/:id/fields/:fieldId/logic', { schema: { params: fieldParams, body: setLogicSchema } }, async (request) =>
    ok(await forms.setLogic(uid(request), request.params.id, request.params.fieldId, request.body.rules)),
  );
  r.put('/:id/theme', { schema: { params: idParams, body: formThemeSchema } }, async (request) => ok(await forms.setTheme(uid(request), request.params.id, request.body)));
  r.post('/:id/ops', { schema: { params: idParams, body: opTxSchema } }, async (request) => ok(await ops.apply(uid(request), request.params.id, request.body as unknown as OpTx)));
  r.post('/:id/publish', { schema: { params: idParams } }, async (request) => ok(await forms.setPublished(uid(request), request.params.id, true)));
  r.post('/:id/unpublish', { schema: { params: idParams } }, async (request) => ok(await forms.setPublished(uid(request), request.params.id, false)));

  const variableParams = idParams.extend({ variableId: z.uuid() });
  r.post('/:id/variables', { schema: { params: idParams, body: createVariableSchema } }, async (request, reply) =>
    reply.code(201).send(ok(await variables.create(uid(request), request.params.id, request.body))),
  );
  r.patch('/:id/variables/:variableId', { schema: { params: variableParams, body: updateVariableSchema } }, async (request) =>
    ok(await variables.update(uid(request), request.params.id, request.params.variableId, request.body)),
  );
  r.delete('/:id/variables/:variableId', { schema: { params: variableParams } }, async (request) => ok(await variables.remove(uid(request), request.params.id, request.params.variableId)));
  r.post('/:id/formulas/validate', { schema: { params: idParams, body: validateFormulaSchema } }, async (request) =>
    ok(await variables.validateFormula(uid(request), request.params.id, request.body.formula)),
  );

  r.get('/:id/responses', { schema: { params: idParams, querystring: paginationQuerySchema } }, async (request) =>
    ok(await responses.list(uid(request), request.params.id, { cursor: request.query.cursor, limit: request.query.limit })),
  );
  r.get('/:id/responses/export', { config: { media: true }, schema: { params: idParams } }, async (request, reply) => {
    const { file } = await forms.access(uid(request), request.params.id, 'EDITOR');
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', contentDisposition('attachment', `${file.name} (responses).csv`))
      .header('X-Content-Type-Options', 'nosniff');
    // UTF-8 BOM so spreadsheet apps detect the encoding.
    return reply.send(Readable.from((async function* () {
      yield '﻿';
      yield* responses.exportCsv(uid(request), request.params.id);
    })()));
  });
  const responseParams = idParams.extend({ responseId: z.uuid() });
  r.get('/:id/responses/:responseId', { schema: { params: responseParams } }, async (request) =>
    ok(await responses.getOne(uid(request), request.params.id, request.params.responseId)),
  );
  r.delete('/:id/responses/:responseId', { schema: { params: responseParams } }, async (request) => {
    await responses.remove(uid(request), request.params.id, request.params.responseId);
    return ok({ deleted: true });
  });
  r.get('/:id/analytics', { schema: { params: idParams, querystring: z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }) } }, async (request) =>
    ok(await responses.analytics(uid(request), request.params.id, { days: request.query.days })),
  );
  r.get('/:id/uploads/:uploadId', { config: { media: true }, schema: { params: idParams.extend({ uploadId: z.uuid() }) } }, async (request, reply) => {
    const upload = await responses.uploadForDownload(uid(request), request.params.id, request.params.uploadId);
    return sendStored(request, reply, storage, { key: upload.storageKey, size: upload.size, mimeType: upload.mimeType, name: upload.originalName }, 'attachment');
  });
}

/** Respondent-facing endpoints. Authentication is optional unless the form requires sign-in. */
export async function publicFormRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const { responses, env } = app.services;
  app.addHook('preHandler', app.optionalAuth);
  const params = z.object({ publicId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/) });

  const respondent = (request: FastifyRequest) => ({
    userId: request.auth?.userId ?? null,
    email: request.auth?.email ?? null,
    ip: request.ip,
    userAgent: request.headers['user-agent'] ?? null,
  });

  r.get('/:publicId', { schema: { params, querystring: z.object({ view: z.enum(['1', '0']).default('0') }) } }, async (request) =>
    ok(await responses.getPublic(request.params.publicId, respondent(request), request.query.view === '1')),
  );

  r.post(
    '/:publicId/responses',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, schema: { params, body: submitResponseSchema } },
    async (request, reply) => reply.code(201).send(ok(await responses.submit(request.params.publicId, request.body, respondent(request)))),
  );

  r.post(
    '/:publicId/uploads',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } }, schema: { params, querystring: z.object({ fieldId: z.uuid() }) } },
    async (request, reply) => {
      const part = await request.file({ limits: { fileSize: Math.min(env.MAX_UPLOAD_MB, 100) * 1024 * 1024, files: 1 } });
      if (!part) throw badRequest('No file uploaded.');
      return reply.code(201).send(ok(await responses.upload(request.params.publicId, request.query.fieldId, respondent(request), { stream: part.file, filename: part.filename })));
    },
  );
}
