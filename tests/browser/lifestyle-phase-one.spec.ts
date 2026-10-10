import { expect, test } from '@playwright/test';
for (const width of [390, 768, 1440]) {
  test(`Lifestyle discovery and cart at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const mode of ['home', 'brand', 'list', 'product']) {
      await page.goto(`/?mode=lifestyle-${mode}`);
      await expect(page.getByText('Synthetic commerce fixture', { exact: false })).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `docs/evidence/lifestyle/fixture-${mode}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
    await page.route('**/api/commerce/cart', async (route) => {
      const input = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
      if (input?.action === 'remove') return route.fulfill({ json: { cart: null } });
      const quantity = input?.quantity ?? 1;
      await route.fulfill({
        json: {
          cart: {
            totalQuantity: quantity,
            cost: {
              subtotalAmount: { amount: String(quantity * 24), currencyCode: 'USD' },
              totalAmount: { amount: String(quantity * 24), currencyCode: 'USD' },
            },
            lines: {
              nodes: [
                {
                  id: 'gid://shopify/CartLine/fixture',
                  quantity,
                  cost: { totalAmount: { amount: String(quantity * 24), currencyCode: 'USD' } },
                  merchandise: {
                    id: 'gid://shopify/ProductVariant/fixture',
                    title: '30 ml',
                    product: {
                      handle: 'fixture-oil',
                      title: 'Synthetic oil',
                      requiresSellingPlan: false,
                      featuredImage: null,
                    },
                  },
                },
              ],
            },
          },
        },
      });
    });
    await page.goto('/?mode=lifestyle-cart');
    await expect(page.getByText('Synthetic oil')).toBeVisible();
    await page.screenshot({
      path: `docs/evidence/lifestyle/fixture-cart-${width}.png`,
      fullPage: true,
    });
    const quantity = page.getByRole('combobox').first();
    await quantity.selectOption('2');
    await expect(page.getByText('$48.00').first()).toBeVisible();
    await page.getByRole('button', { name: /Remove/ }).click();
    await expect(page.getByText('Your cart is ready when you are.')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test('search, unavailable catalog and product options remain usable', async ({ page }) => {
  await page.goto('/?mode=lifestyle-list');
  await page.getByRole('searchbox').fill('no matching product');
  await expect(page.getByText('No essentials match this view.')).toBeVisible();
  await page.goto('/?mode=lifestyle-list&error=1');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.route('**/api/commerce/cart', (route) =>
    route.fulfill({ status: 502, json: { error: 'Synthetic cart failure.' } }),
  );
  await page.goto('/?mode=lifestyle-product');
  await page
    .getByRole('combobox', { name: 'Choose an option' })
    .selectOption('gid://shopify/ProductVariant/fixture-large');
  await page.getByRole('combobox', { name: 'Quantity' }).selectOption('3');
  await expect(page.locator('.reserve-sticky-purchase')).toContainText('$114.00');
  await page.locator('.commerce-add').click();
  await expect(page.getByText('Synthetic cart failure.')).toBeVisible();
  await page.getByRole('link', { name: 'The formula', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#formula')).toBeInViewport();
});
