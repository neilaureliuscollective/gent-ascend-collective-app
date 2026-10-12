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
    await expect(page.getByText('Cart is temporarily unavailable.')).toBeVisible();
  });
}
test('closed cart and checkout cannot invent an order', async ({ request }) => {
  const response = await request.get('/api/commerce/cart');
  expect(response.status()).toBe(503);
  const checkout = await request.get('/checkout', { maxRedirects: 0 });
  expect(checkout.status()).toBe(307);
  expect(checkout.headers().location).toContain('/lifestyle');
});
