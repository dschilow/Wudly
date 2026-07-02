import { expect, test } from './fixtures';
import { registerAndLogin, uniqueProductName } from './helpers';

/**
 * The core "Würdest du es wieder kaufen?" wizard end to end: create a fresh
 * product, sign in, answer the buy-again/duration/mood cards (they
 * auto-advance on tap), skip the optional wish/instead-of step, and submit.
 * Verifies the experience actually lands (empty state gone, verdict shown).
 */
test('signed-in user completes the own-experience wizard', async ({ page, dismissOnboarding }) => {
  const productName = uniqueProductName('Erfahrungsgeraet');

  // Create the product via the same research-and-create path as add-product.spec.
  await page.goto('/check');
  await dismissOnboarding();
  const searchInput = page.getByPlaceholder('Produkt, Marke oder Link');
  await searchInput.waitFor({ state: 'visible' });
  await searchInput.fill(productName);
  await page.getByRole('button', { name: new RegExp(`${productName}.*neu anlegen`) }).click();
  await page.waitForURL(/\/produkte\//, { timeout: 20_000 });
  const productUrl = page.url();

  await registerAndLogin(page, 'experience');

  await page.goto(productUrl);
  await page.getByRole('link', { name: 'Ich besitze es' }).first().click();
  await page.waitForURL(/\/own$/, { timeout: 10_000 });

  // Each choice card auto-advances ~240ms after tap (ExperienceFlow's
  // advanceSoon). Match the exact card label (not the hint subtitle) so a
  // shared substring across cards can't pick the wrong one, and wait out the
  // transition before the next card's text is queried.
  await page.getByText('Ja', { exact: true }).click();
  await page.waitForTimeout(350);
  await page.getByText('1 bis 6 Monate', { exact: true }).click();
  await page.waitForTimeout(350);
  await page.getByText('Guter Alltag', { exact: true }).click();
  await page.waitForTimeout(350);

  // From here the remaining steps vary by product (aspects card only when the
  // category has known aspects, then zero or more product-specific prompt
  // cards — up to the 5-question COMMON_QUESTIONS pool the DummyAiService
  // falls back to, then the optional wish step) before landing on "share".
  // Rather than guess the exact sequence, repeatedly act on whichever known
  // button becomes visible until the final submit button appears.
  const submitButton = page.getByRole('button', { name: 'Urteil abschicken' });
  // Exact match: "Überspringen" (the bottom action-bar button, always advances
  // via goNext) vs. the substring match also picking up the in-card "Diese
  // Frage überspringen" link — both call goNext, but mixing selectors made
  // clicks land inconsistently between the two.
  const skipButton = page.getByRole('button', { name: 'Überspringen', exact: true });
  const weiterButton = page.getByRole('button', { name: 'Weiter', exact: true });
  for (let i = 0; i < 15; i++) {
    if (await submitButton.isVisible().catch(() => false)) break;
    await Promise.race([
      skipButton.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined),
      weiterButton.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined),
      submitButton.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined),
    ]);
    if (await submitButton.isVisible().catch(() => false)) break;
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click();
    } else if (await weiterButton.isVisible().catch(() => false)) {
      await weiterButton.click();
    }
    await page.waitForTimeout(200);
  }

  await expect(submitButton).toBeVisible({ timeout: 10_000 });
  await submitButton.click();

  await expect(page.getByRole('heading', { name: 'Urteil gefällt.' })).toBeVisible({
    timeout: 15_000,
  });

  // Back on the product page, the empty state is gone and a verdict shows.
  // The page has `revalidate = 20` (ISR) — the first load right after submit
  // can still serve the pre-experience snapshot, so poll with reloads.
  await page.getByRole('link', { name: 'Produktseite ansehen' }).click();
  await page.waitForURL(/\/produkte\//);
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('Noch keine Erfahrungen')).toHaveCount(0);
  }).toPass({ intervals: [1_000, 2_000, 3_000, 5_000], timeout: 25_000 });
});
