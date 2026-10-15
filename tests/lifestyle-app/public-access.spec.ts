import { openGlobalMenu, globalDestinations } from "../support/global-navigation";
import { expect, test } from '@playwright/test';
// Real built routes with no Shopify/Auth credentials. These prove public access and
// closed-configuration behavior, not published stock, merchant login or payment.
for (const width of [344, 720, 1440]) {
  test(`public Lifestyle is reachable without a membership at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const path of [
      '/lifestyle',
      '/lifestyle/legacy-reserve',
      '/shop',
      '/app/lifestyle',
      '/app/collection',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expect(
        page.getByText('Live product availability is not connected yet.', { exact: false }),
      ).toBeVisible();
      await expect(page.getByText('A separate destination.', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.goto('/shop/unknown-product');
    await expect(
      page.getByRole('heading', { name: 'Product availability could not be verified.' }),
    ).toBeVisible();
    await page.goto('/shop/cart');
    await expect(page.getByText('Shopping is not open yet.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue to secure checkout/ })).toHaveCount(0);
  });
}
test('closed cart and checkout cannot invent an order', async ({ request }) => {
  const response = await request.get('/api/commerce/cart');
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: 'Shopping is not open yet.' });
  const checkout = await request.get('/checkout', { maxRedirects: 0 });
  expect(checkout.status()).toBe(307);
  expect(checkout.headers().location).toContain('/lifestyle');
});

for (const width of [344, 720, 1440]) {
  test(`global Menu reaches Studio and Lifestyle through actual routes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app/lifestyle');
    await expect(page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link')).toHaveText(['Home', 'Talk', 'Work', 'Architect']);
    await openGlobalMenu(page);
    await globalDestinations(page).getByRole('link', { name: 'Studio', exact: true }).click();
    await expect(page).toHaveURL('/app/studio');
    await expect(page.getByRole('heading', { name: 'Make the vision visible.' })).toBeVisible();
    await openGlobalMenu(page);
    const lifestyle = globalDestinations(page).getByRole('link', { name: 'Lifestyle', exact: true });
    await expect(lifestyle).toHaveAttribute('href', '/lifestyle');
    await lifestyle.click();
    await expect(page).toHaveURL('/lifestyle');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('Live product availability is not connected yet.')).toBeVisible();
  });
}
