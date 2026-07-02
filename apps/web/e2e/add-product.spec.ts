import { expect, test } from './fixtures';
import { uniqueProductName } from './helpers';

/**
 * The catalog-add golden path: search for a product Wudly doesn't have yet,
 * trigger the research-and-create action, and land on its product page. This
 * is the path a real barcode scan also feeds into (resolveEan → ensureProduct)
 * — the UI entry differs, the backend create/research path is identical, and
 * a camera can't be driven in a headless browser, so this is the meaningful cut.
 */
test('searching an unknown product creates and opens it', async ({ page, dismissOnboarding }) => {
  const productName = uniqueProductName('Testgeraet');

  await page.goto('/check');
  await dismissOnboarding();
  const searchInput = page.getByPlaceholder('Produkt, Marke oder Link');
  await searchInput.waitFor({ state: 'visible' });
  await searchInput.fill(productName);

  const createButton = page.getByRole('button', { name: new RegExp(`${productName}.*neu anlegen`) });
  await expect(createButton).toBeVisible({ timeout: 10_000 });
  await createButton.click();

  await page.waitForURL(/\/produkte\//, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: productName })).toBeVisible();

  // The empty-state CTA confirms the product was created with zero experiences
  // yet — proves this is a genuinely new product, not a duplicate match.
  await expect(page.getByText('Noch keine Erfahrungen')).toBeVisible();
});
