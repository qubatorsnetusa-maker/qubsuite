import { defineConfig, devices } from '@playwright/test';

const WEB = process.env.E2E_BASE_URL ?? 'http://localhost:5180';

/**
 * End-to-end tests against the real stack (Fastify API + PostgreSQL + Vite app).
 * Servers are started automatically unless already running. Each run registers fresh users.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    { command: 'pnpm --filter @qub/api dev', url: 'http://localhost:4100/api/health', reuseExistingServer: true, timeout: 120_000, cwd: '..' },
    { command: 'pnpm --filter @qub/web dev', url: WEB, reuseExistingServer: true, timeout: 120_000, cwd: '..' },
  ],
});
