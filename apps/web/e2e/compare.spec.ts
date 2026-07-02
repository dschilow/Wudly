import { expect, test } from './fixtures';
import { uniqueProductName } from './helpers';

/**
 * The compare builder end to end: create two products, add both via the
 * picker's search, and verify the comparison actually renders (not just an
 * empty shell) — the decision panel, the matrix, and both product names.
 */
test('building a compare with two fresh products renders a verdict', async ({
  page,
  dismissOnboarding,
}) => {
  const nameA = uniqueProductName('VergleichA');
  const nameB = uniqueProductName('VergleichB');

  let first = true;
  for (const name of [nameA, nameB]) {
    await page.goto('/check');
    if (first) {
      await dismissOnboarding();
      first = false;
    }
    const searchInput = page.getByPlaceholder('Produkt, Marke oder Link');
    await searchInput.waitFor({ state: 'visible' });
    await searchInput.fill(name);
    await page.getByRole('button', { name: new RegExp(`${name}.*neu anlegen`) }).click();
    await page.waitForURL(/\/produkte\//, { timeout: 20_000 });
  }

  await page.goto('/compare');

  // The picker closes itself after each pick, so it must be reopened for the
  // second product (CompareClient.add() calls setPicking(false)).
  for (const name of [nameA, nameB]) {
    await page.getByRole('button', { name: 'Produkt suchen' }).click();
    const pickerSearch = page.getByPlaceholder('Produkt, Marke oder Kategorie suchen...');
    await pickerSearch.waitFor({ state: 'visible' });
    await pickerSearch.fill(name);
    const resultButton = page.getByRole('button', { name: new RegExp(name) });
    await expect(resultButton).toBeVisible({ timeout: 10_000 });
    await resultButton.click();
  }

  // Both fresh products have zero signal, so the honest cold-start verdict
  // must show — never a fabricated "winner" between two data-less products.
  await expect(page.getByRole('heading', { name: 'Noch zu wenig Daten für ein Fazit' })).toBeVisible({
    timeout: 10_000,
  });
  // The specs matrix only renders when at least one product has specs — the
  // DummyAiService (no AI key locally) creates products with none, so this
  // section is legitimately absent here; the decision matrix always renders.
  await expect(page.getByText('Alle relevanten Kriterien')).toBeVisible();
  await expect(page.getByRole('heading', { name: nameA })).toBeVisible();
  await expect(page.getByRole('heading', { name: nameB })).toBeVisible();
});
