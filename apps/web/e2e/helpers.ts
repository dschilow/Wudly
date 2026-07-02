import type { Page } from '@playwright/test';

/**
 * Register a fresh account for this test run and land on /me. A new random
 * email each run keeps tests independent (no shared-fixture cleanup needed) —
 * the DummyAiService (no AI key locally) makes this fully deterministic.
 */
export async function registerAndLogin(page: Page, prefix: string): Promise<string> {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.wudly.test`;
  await page.goto('/login?mode=register');
  await page.getByPlaceholder('Name (optional)').fill(`E2E ${prefix}`);
  await page.getByPlaceholder('E-Mail').fill(email);
  await page.getByPlaceholder(/Passwort \(min\. 8 Zeichen\)/).fill('e2e-test-password-1');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await page.waitForURL(/\/me/, { timeout: 15_000 });
  return email;
}

/** A unique product name per test so runs never collide with a prior run's data. */
export function uniqueProductName(prefix: string): string {
  return `${prefix} E2E ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
