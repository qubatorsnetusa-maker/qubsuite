import { buildApp } from '../app';
import { env } from '../config/env';
import { createDb } from '../db';
import { purgeTrash } from './purge-trash';

/** Runs the retention job once (for cron / Kubernetes CronJob in multi-instance deployments). */
async function main() {
  const db = createDb(env.DATABASE_URL, { max: 2 });
  const app = await buildApp({ env, db, jobs: false });
  try {
    await purgeTrash(app.services, app.log);
  } finally {
    await app.close();
    await db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
