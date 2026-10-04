import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAppV3 } from '../src/app.v3';
import { env } from '../src/config/env';
import { createDb } from '../src/db';
import { MemoryMailer } from '../src/services/mailer';
import { client, data, registerUser, type TestContext, type TestUser } from './helpers';

let ctx: TestContext;
let user: TestUser;

async function createTestAppV3(): Promise<TestContext> {
  const db = createDb(env.DATABASE_URL, { max: 5 });
  const mailer = new MemoryMailer();
  const app = await buildAppV3({ env, db, overrides: { mailer }, jobs: false, logger: false });
  await app.ready();
  return {
    app,
    db,
    mailer,
    async close() {
      await app.close();
      await db.close();
    },
  };
}

beforeAll(async () => {
  ctx = await createTestAppV3();
  user = await registerUser(ctx.app, 'Forms V3 Tester');
});

afterAll(async () => {
  await ctx.close();
});

describe('Forms V3 End-to-End API', () => {
  let workspaceId: string;
  let formId: string;

  it('1. manages user preferences', async () => {
    const api = client(ctx.app, user);

    // Get default preferences
    const res1 = data(await api.get('/api/v3/preferences'));
    expect(res1.preferences).toBeDefined();
    expect(res1.preferences.defaultViewMode).toBe('grid');

    // Update preferences
    await api.patch('/api/v3/preferences', {
      defaultViewMode: 'table',
      defaultSortOption: 'title_asc',
    });

    const res2 = data(await api.get('/api/v3/preferences'));
    expect(res2.preferences.defaultViewMode).toBe('table');
    expect(res2.preferences.defaultSortOption).toBe('title_asc');
  });

  it('2. creates and updates workspaces', async () => {
    const api = client(ctx.app, user);

    // Create workspace
    const resCreate = data(
      await api.post('/api/v3/workspaces', {
        name: 'Product Research',
        description: 'Forms for feedback and surveys',
      })
    );
    expect(resCreate.workspace).toBeDefined();
    expect(resCreate.workspace.name).toBe('Product Research');
    workspaceId = resCreate.workspace.id;

    // Update workspace
    const resUpdate = data(
      await api.put(`/api/v3/workspaces/${workspaceId}`, {
        name: 'Product Research Updated',
        folders: ['Surveys', 'Interviews'],
      })
    );
    expect(resUpdate.workspace.name).toBe('Product Research Updated');
    expect(resUpdate.workspace.folders).toEqual(['Surveys', 'Interviews']);

    // List workspaces
    const resList = data(await api.get('/api/v3/workspaces'));
    expect(resList.workspaces.some((w: { id: string }) => w.id === workspaceId)).toBe(true);
  });

  it('3. seeds template forms into workspace', async () => {
    const api = client(ctx.app, user);

    const resSeed = data(await api.post(`/api/v3/workspaces/${workspaceId}/forms/seed-templates`, {}));
    expect(resSeed.forms.length).toBeGreaterThan(0);
    expect(resSeed.folders.length).toBeGreaterThan(0);

    // Form stats should be returned as a dictionary keyed by form id
    expect(resSeed.formStats).toBeDefined();
    expect(typeof resSeed.formStats).toBe('object');
  });

  it('4. creates, retrieves, and updates a custom form', async () => {
    const api = client(ctx.app, user);

    const newFormPayload = {
      title: 'Customer Satisfaction Survey',
      description: 'Quick NPS and feedback',
      status: 'published',
      isFavorite: true,
      folder: 'Surveys',
      welcomeScreen: {
        title: 'Welcome to our Survey',
        description: 'Takes 2 minutes',
        buttonText: 'Start Survey',
      },
      steps: [
        {
          id: 'step_1',
          type: 'rating',
          title: 'How satisfied are you?',
          required: true,
          scale: 5,
        },
        {
          id: 'step_2',
          type: 'text',
          title: 'Any additional comments?',
          required: false,
        },
      ],
      thankYou: {
        title: 'Thank you!',
        description: 'Your feedback helps us improve.',
      },
      theme: {
        primaryColor: '#6366f1',
        backgroundColor: '#ffffff',
        font: 'Inter',
      },
    };

    const resCreate = data(await api.post(`/api/v3/workspaces/${workspaceId}/forms`, newFormPayload));
    expect(resCreate.form).toBeDefined();
    expect(resCreate.form.title).toBe('Customer Satisfaction Survey');
    expect(resCreate.form.steps.length).toBe(2);
    formId = resCreate.form.id;

    // Retrieve form config
    const resGet = data(await api.get(`/api/v3/forms/${formId}`));
    expect(resGet.form.id).toBe(formId);
    expect(resGet.form.title).toBe('Customer Satisfaction Survey');

    // Update form
    const updatedPayload = {
      ...resGet.form,
      title: 'Customer Satisfaction Survey 2026',
    };
    const resUpdate = data(await api.put(`/api/v3/forms/${formId}`, updatedPayload));
    expect(resUpdate.form.title).toBe('Customer Satisfaction Survey 2026');
  });

  it('5. duplicates a form', async () => {
    const api = client(ctx.app, user);

    const resDup = data(await api.post(`/api/v3/forms/${formId}/duplicate`, {}));
    expect(resDup.form).toBeDefined();
    expect(resDup.form.id).not.toBe(formId);
    expect(resDup.form.title).toContain('Copy');
  });

  it('6. public respondent flow: start and submit response anonymously', async () => {
    // Public routes don't require authorization header
    const resPublic = await ctx.app.inject({
      method: 'GET',
      url: `/api/v3/public/forms/${formId}`,
    });
    expect(resPublic.statusCode).toBe(200);
    const publicBody = JSON.parse(resPublic.body);
    expect(publicBody.data.form.id).toBe(formId);

    // Record public form start
    const resStart = await ctx.app.inject({
      method: 'POST',
      url: `/api/v3/public/forms/${formId}/starts`,
    });
    expect(resStart.statusCode).toBe(200);

    // Submit public response
    const resSubmit = await ctx.app.inject({
      method: 'POST',
      url: `/api/v3/public/forms/${formId}/submissions`,
      payload: {
        answers: {
          step_1: '5',
          step_2: 'Everything was great!',
        },
        completionTimeSeconds: 42,
      },
    });
    expect(resSubmit.statusCode).toBe(201);
  });

  it('7. owner inspects submissions and form statistics', async () => {
    const api = client(ctx.app, user);

    // Verify workspace submissions
    const resSubmissions = data(await api.get(`/api/v3/workspaces/${workspaceId}/submissions`));
    expect(resSubmissions.submissions.length).toBeGreaterThan(0);
    const submission = resSubmissions.submissions.find((s: { formId: string }) => s.formId === formId);
    expect(submission).toBeDefined();
    expect(submission.responses.step_1).toBe('5');
    expect(submission.completionTimeSeconds).toBe(42);

    // Verify form stats (starts and completions incremented)
    const resForms = data(await api.get(`/api/v3/workspaces/${workspaceId}/forms`));
    const stats = resForms.formStats[formId];
    expect(stats).toBeDefined();
    expect(stats.starts).toBeGreaterThanOrEqual(1);
    expect(stats.completions).toBeGreaterThanOrEqual(1);

    // Clear submissions
    await api.delete(`/api/v3/workspaces/${workspaceId}/submissions`);
    const resSubmissionsAfter = data(await api.get(`/api/v3/workspaces/${workspaceId}/submissions`));
    expect(resSubmissionsAfter.submissions.length).toBe(0);
  });

  it('8. generates AI welcome copy', async () => {
    const api = client(ctx.app, user);

    const resAI = data(
      await api.post('/api/v3/ai/welcome-copy', {
        formTitle: 'Product Feedback',
        formDescription: 'Collecting user impressions on our new feature release.',
      })
    );
    expect(resAI.copy.title).toBeDefined();
    expect(resAI.copy.description).toBeDefined();
    expect(resAI.copy.tagline).toBeDefined();
    expect(resAI.copy.buttonLabel).toBeDefined();
  });
});
