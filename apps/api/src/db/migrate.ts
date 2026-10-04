import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { env } from '../config/env';
import { createDb } from './index';

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function runMigrations(url: string): Promise<void> {
  const handle = createDb(url, { max: 1 });
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await handle.close();
  }
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  runMigrations(env.DATABASE_URL)
    .then(() => {
      console.log('Migrations applied');
    })
    .catch((err) => {
      console.error('Migration failed', err);
      process.exit(1);
    });
}
