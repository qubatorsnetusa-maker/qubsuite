import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { runMigrations } from '../src/db/migrate';

/** Recreates the test database schema from the real migrations before the suite runs. */
export default async function setup() {
  // Global setup runs in the main process, where test.env is not applied: use the test URL explicitly.
  const url = process.env.TEST_DATABASE_URL!;
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(`Refusing to wipe a database whose name does not contain "test": ${new URL(url).pathname}`);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe('drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;');
  await sql.end();
  await runMigrations(url);
  await rm(path.join(os.tmpdir(), 'qub-test-storage'), { recursive: true, force: true });
}
