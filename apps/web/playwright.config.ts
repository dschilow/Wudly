import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke coverage for the three core flows: adding a product, submitting an
 * owner experience, and building a compare page. Assumes `pnpm --filter
 * @wudly/api dev` and `pnpm --filter @wudly/web dev` are already running (or
 * `webServer` below starts them) against the local dev DB (docker, port 5433).
 *
 * These are correctness/regression smoke tests, not exhaustive UI coverage —
 * they exist so a release can't silently break the golden paths.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
