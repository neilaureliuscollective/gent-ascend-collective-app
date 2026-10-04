import { test, expect } from '@playwright/test';
for (const width of [360, 768, 1440]) {
  test(`read-only Shopify order history is explicit and fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let writes = 0;
    await page.route('**/api/commerce/customer/disconnect', (route) => {
      writes++;
      return route.fulfill({
        status: 303,
        headers: { location: 'http://127.0.0.1:3102/?mode=customer-orders&state=disconnected' },
      });
    });
    await page.goto('http://127.0.0.1:3102/?mode=customer-orders');
    await expect(page.getByText(/Synthetic Shopify order fixture/)).toBeVisible();
    await expect(page.getByText('Connected Shopify account:', { exact: false })).toContainText(
      'Synthetic customer',
    );
    await expect(
      page.getByText('Payment: paid · Fulfillment: unfulfilled', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Payment: refunded · Fulfillment: unfulfilled', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(page.getByText(/More orders exist in Shopify/)).toBeVisible();
    await expect(page.getByText(/at most one hour/)).toBeVisible();
    expect(writes).toBe(0);
    expect(
      await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        stored: localStorage.length,
      })),
    ).toEqual({ overflow: false, stored: 0 });
    await page.screenshot({
      path: `test-results/customer-orders-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Disconnect from this browser' }).click();
    await expect(
      page.getByRole('button', { name: 'Connect Shopify account', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '#1001' })).toHaveCount(0);
    expect(writes).toBe(1);
  });
}
test('unconfigured, signed-out, provider-error and empty-order views remain distinct', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/?mode=customer-orders&state=unconfigured');
  await expect(page.getByText(/account connection is not open yet/)).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await page.goto('http://127.0.0.1:3102/?mode=customer-orders&state=signed-out');
  await expect(page.getByRole('link', { name: 'Sign in', exact: false })).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await page.goto('http://127.0.0.1:3102/?mode=customer-orders&state=unavailable&failed=1');
  await expect(page.getByRole('alert')).toHaveCount(2);
  await expect(page.getByText(/No orders returned/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Retry order history' })).toBeVisible();
  await page.goto('http://127.0.0.1:3102/?mode=customer-orders&empty=1');
  await expect(page.getByText(/No orders returned/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('hosted runtime keeps order entry private and denies hostile connection requests', async ({
  page,
}) => {
  const response = await page.goto('/app/collection/orders');
  expect(response?.headers()['cache-control']).toContain('no-store');
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  await expect(page.getByText(/Sign in to your Gent Ascend account/)).toBeVisible();
  const hostile = await page.request.post('/api/commerce/customer', {
    headers: { origin: 'https://evil.example' },
    maxRedirects: 0,
  });
  expect(hostile.status()).toBe(403);
  const callback = await page.request.get(
    '/api/commerce/customer/callback?code=synthetic&state=invalid',
    { maxRedirects: 0 },
  );
  expect(callback.status()).toBe(303);
  expect(callback.headers().location).not.toContain('synthetic');
  expect(callback.headers()['cache-control']).toContain('no-store');
  expect(callback.headers()['referrer-policy']).toBe('no-referrer');
});
