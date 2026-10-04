import { buildAppV3 } from './app.v3';
import { env } from './config/env';
import { createDb } from './db';

async function main() {
  const db = createDb(env.DATABASE_URL, { max: env.DATABASE_POOL_MAX });
  const app = await buildAppV3({ env, db });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down Forms V3 API');
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
  console.error('Failed to start Forms V3 server', err);
  process.exit(1);
});
