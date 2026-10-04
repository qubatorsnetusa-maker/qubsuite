import { buildApp } from './app';
import { env } from './config/env';
import { createDb } from './db';

async function main() {
  const db = createDb(env.DATABASE_URL, { max: env.DATABASE_POOL_MAX });

  // Ensure invite_tokens table exists for frictionless one-click invitation links
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
    `);
  } catch (err: any) {
    console.warn('invite_tokens table init check:', err?.message);
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
