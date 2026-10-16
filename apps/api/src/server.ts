import { buildApp } from './app';
import { env } from './config/env';
import { createDb } from './db';

async function main() {
  const db = createDb(env.DATABASE_URL, { max: env.DATABASE_POOL_MAX });

  // Ensure invite_tokens and access_requests tables exist
  try {
    await db.sql.unsafe(`
      CREATE TABLE IF NOT EXISTS invite_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        target_url TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS invite_tokens_email_idx ON invite_tokens(email);

      CREATE TABLE IF NOT EXISTS access_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_type resource_type NOT NULL,
        file_id UUID REFERENCES drive_files(id) ON DELETE CASCADE,
        folder_id UUID REFERENCES drive_folders(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role role NOT NULL DEFAULT 'EDITOR',
        message TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at TIMESTAMPTZ,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS access_requests_file_idx ON access_requests(file_id);
      CREATE INDEX IF NOT EXISTS access_requests_user_idx ON access_requests(user_id);
      CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests(status);
    `);
  } catch (err: any) {
    console.warn('table init check:', err?.message);
  }

  const app = await buildApp({ env, db });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down');
    // Stop accepting requests, persist open documents, then close the pool.
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    try {
      await app.close();
      await db.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => app.log.error({ err: reason }, 'Unhandled promise rejection'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
