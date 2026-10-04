import { sql } from 'drizzle-orm';
import type { Database } from '../../db';

export async function ensureFormsV3Tables(db: Database): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS formsv3_workspaces (
      id TEXT PRIMARY KEY,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      folders TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS formsv3_workspaces_owner_id_idx ON formsv3_workspaces(owner_id);

    CREATE TABLE IF NOT EXISTS formsv3_forms (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES formsv3_workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      folder TEXT,
      is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
      starts INTEGER NOT NULL DEFAULT 0,
      completions INTEGER NOT NULL DEFAULT 0,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS formsv3_forms_workspace_id_idx ON formsv3_forms(workspace_id);

    CREATE TABLE IF NOT EXISTS formsv3_submissions (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL REFERENCES formsv3_forms(id) ON DELETE CASCADE,
      form_title TEXT NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completion_time_seconds INTEGER NOT NULL DEFAULT 0,
      responses JSONB NOT NULL,
      notification_sent_to TEXT
    );
    CREATE INDEX IF NOT EXISTS formsv3_submissions_form_id_idx ON formsv3_submissions(form_id);

    CREATE TABLE IF NOT EXISTS formsv3_user_preferences (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      default_view_mode TEXT NOT NULL DEFAULT 'grid',
      default_sort_option TEXT NOT NULL DEFAULT 'updated_desc',
      notify_on_submission BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);
}
