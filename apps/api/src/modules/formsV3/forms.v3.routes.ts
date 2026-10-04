import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from '../../db';
import { ok } from '../../http/respond';
import {
  clearWorkspaceSubmissionsInDb,
  createFormInDb,
  createWorkspaceInDb,
  deleteFormInDb,
  duplicateFormInDb,
  getFormInDb,
  getPublishedFormInDb,
  getUserPreferencesInDb,
  incrementFormStartInDb,
  incrementPublicFormStartInDb,
  listWorkspaceFormsInDb,
  listWorkspaceSubmissionsInDb,
  listWorkspacesInDb,
  resetWorkspaceFormsInDb,
  seedWorkspaceTemplatesInDb,
  submitPublicFormInDb,
  updateFormInDb,
  updateUserPreferencesInDb,
  updateWorkspaceInDb,
} from './forms.v3.repository';
import { generateWelcomeCopy } from './forms.v3.service';
import type {
  CreateWorkspaceInput,
  FormConfig,
  GenerateWelcomeCopyInput,
  SubmitPublicFormInput,
  UpdateUserPreferencesInput,
  UpdateWorkspaceInput,
} from './forms.v3.types';
import { unauthenticated } from '../../utils/errors';

export async function formsV3Routes(app: FastifyInstance, opts: { db: Database }) {
  const db = opts.db;

  const getUserId = (req: FastifyRequest) => {
    if (!req.auth?.userId) {
      throw unauthenticated();
    }
    return req.auth.userId;
  };

  // -------------------------------------------------------------------------
  // Auth Session Route
  // -------------------------------------------------------------------------
  app.get('/auth/session', { preHandler: [app.optionalAuth] }, async (req) => {
    if (req.auth) {
      return ok({
        user: {
          id: req.auth.userId,
          email: req.auth.email,
          name: req.auth.name,
        },
      });
    }
    return ok({ user: null });
  });

  // -------------------------------------------------------------------------
  // User Preferences
  // -------------------------------------------------------------------------
  app.get('/preferences', { preHandler: [app.authenticate] }, async (req) => {
    const preferences = await getUserPreferencesInDb(db, getUserId(req));
    return ok({ preferences });
  });

  app.patch('/preferences', { preHandler: [app.authenticate] }, async (req) => {
    await updateUserPreferencesInDb(db, req.body as UpdateUserPreferencesInput, getUserId(req));
    return ok({});
  });

  // -------------------------------------------------------------------------
  // AI Copy Generation
  // -------------------------------------------------------------------------
  app.post('/ai/welcome-copy', { preHandler: [app.authenticate] }, async (req) => {
    return ok(await generateWelcomeCopy(req.body as GenerateWelcomeCopyInput));
  });

  // -------------------------------------------------------------------------
  // Workspaces Routes
  // -------------------------------------------------------------------------
  app.get('/workspaces', { preHandler: [app.authenticate] }, async (req) => {
    const workspaces = await listWorkspacesInDb(db, getUserId(req));
    return ok({ workspaces });
  });

  app.post('/workspaces', { preHandler: [app.authenticate] }, async (req, reply) => {
    const workspace = await createWorkspaceInDb(db, req.body as CreateWorkspaceInput, getUserId(req));
    return reply.code(201).send(ok({ workspace }));
  });

  app.put('/workspaces/:workspaceId', { preHandler: [app.authenticate] }, async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const workspace = await updateWorkspaceInDb(
      db,
      { ...(req.body as UpdateWorkspaceInput), id: workspaceId },
      getUserId(req)
    );
    return ok({ workspace });
  });

  app.get('/workspaces/:workspaceId/forms', { preHandler: [app.authenticate] }, async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const result = await listWorkspaceFormsInDb(db, workspaceId, getUserId(req));
    return ok(result);
  });

  app.post('/workspaces/:workspaceId/forms', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const body = req.body as FormConfig;
    const form = await createFormInDb(db, { ...body, workspaceId }, getUserId(req));
    return reply.code(201).send(ok(form));
  });

  app.post('/workspaces/:workspaceId/forms/reset', { preHandler: [app.authenticate] }, async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const result = await resetWorkspaceFormsInDb(db, workspaceId, getUserId(req));
    return ok(result);
  });

  app.post('/workspaces/:workspaceId/forms/seed-templates', { preHandler: [app.authenticate] }, async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const result = await seedWorkspaceTemplatesInDb(db, workspaceId, getUserId(req));
    return ok(result);
  });

  app.get('/workspaces/:workspaceId/submissions', { preHandler: [app.authenticate] }, async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const result = await listWorkspaceSubmissionsInDb(db, workspaceId, getUserId(req));
    return ok(result);
  });

  app.delete('/workspaces/:workspaceId/submissions', { preHandler: [app.authenticate] }, async (req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    await clearWorkspaceSubmissionsInDb(db, workspaceId, getUserId(req));
    return ok({});
  });

  // -------------------------------------------------------------------------
  // Forms Routes
  // -------------------------------------------------------------------------
  app.get('/forms/:formId', { preHandler: [app.authenticate] }, async (req) => {
    const { formId } = req.params as { formId: string };
    const result = await getFormInDb(db, formId, getUserId(req));
    return ok(result);
  });

  app.put('/forms/:formId', { preHandler: [app.authenticate] }, async (req) => {
    const { formId } = req.params as { formId: string };
    const body = req.body as FormConfig;
    const result = await updateFormInDb(db, { ...body, id: formId }, getUserId(req));
    return ok(result);
  });

  app.delete('/forms/:formId', { preHandler: [app.authenticate] }, async (req) => {
    const { formId } = req.params as { formId: string };
    await deleteFormInDb(db, formId, getUserId(req));
    return ok({});
  });

  app.post('/forms/:formId/duplicate', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { formId } = req.params as { formId: string };
    const result = await duplicateFormInDb(db, formId, getUserId(req));
    return reply.code(201).send(ok(result));
  });

  app.post('/forms/:formId/starts', { preHandler: [app.authenticate] }, async (req) => {
    const { formId } = req.params as { formId: string };
    const result = await incrementFormStartInDb(db, formId, getUserId(req));
    return ok(result);
  });

  // -------------------------------------------------------------------------
  // Public Forms (Anonymous Respondent) Routes
  // -------------------------------------------------------------------------
  app.get('/public/forms/:formId', async (req) => {
    const { formId } = req.params as { formId: string };
    const form = await getPublishedFormInDb(db, formId);
    return ok({ form });
  });

  app.post('/public/forms/:formId/starts', async (req) => {
    const { formId } = req.params as { formId: string };
    await incrementPublicFormStartInDb(db, formId);
    return ok({});
  });

  app.post('/public/forms/:formId/submissions', async (req, reply) => {
    const { formId } = req.params as { formId: string };
    const body = req.body as Omit<SubmitPublicFormInput, 'formId'>;
    await submitPublicFormInDb(db, formId, body.answers, body.completionTimeSeconds);
    return reply.code(201).send(ok({}));
  });
}
