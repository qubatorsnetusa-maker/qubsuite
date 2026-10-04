import os from 'node:os';
import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error('TEST_DATABASE_URL must be set (see .env.example). The test suite wipes that database.');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Tests share one database; run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDb,
      LOG_LEVEL: 'silent',
      STORAGE_PROVIDER: 'local',
      STORAGE_LOCAL_DIR: path.join(os.tmpdir(), 'qub-test-storage'),
      TRASH_PURGE_INTERVAL_MINUTES: '0',
      MAIL_TRANSPORT: 'console',
      REQUIRE_EMAIL_VERIFICATION: 'false',
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
      CORS_ORIGIN: 'http://localhost:5180',
    },
  },
});
