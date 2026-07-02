import { test as base } from '@playwright/test';

/**
 * Extends the base `page` fixture with a helper that dismisses the one-time
 * onboarding sheet (`OnboardingIntro`, shown ~650ms after the first render)
 * if it appears, so it never intercepts a later click mid-test.
 *
 * Deliberately reactive, not preventive: `OnboardingIntro` reads its
 * localStorage flag inside a `useEffect` that runs once at mount — writing the
 * flag ahead of time (via `addInitScript`) or racing it right after `goto()`
 * (via `page.evaluate`) both proved unreliable (the effect can read the old
 * value before the write lands, especially over Next's dev-server HMR).
 * Waiting for the sheet and dismissing it is deterministic regardless of timing.
 */
export const test = base.extend<{ dismissOnboarding: () => Promise<void> }>({
  dismissOnboarding: async ({ page }, use) => {
    await use(async () => {
      const dismissButton = page.getByRole('button', { name: "Los geht's" });
      // The sheet only shows once per browser context and only after ~650ms —
      // give it a moment to appear, but don't fail the test if it never does
      // (e.g. a context that already dismissed it earlier in the same run).
      const appeared = await dismissButton
        .waitFor({ state: 'visible', timeout: 2_000 })
        .then(() => true)
        .catch(() => false);
      if (appeared) await dismissButton.click();
    });
  },
});

export { expect } from '@playwright/test';
