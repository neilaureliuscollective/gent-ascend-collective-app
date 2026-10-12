import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`company work opens reviewable briefs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app');
    await expect(page).toHaveURL('/app/aethelios');
    await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toBeVisible();
    const mainNav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(mainNav.getByRole('link')).toHaveText([
      'Talk',
      'Work',
      'Studio',
      'Lifestyle',
      'Ecosystem',
    ]);
    await mainNav.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'What are we building?' })).toBeVisible();
    await expect(
      page.getByText('Company rooms keep confirmed briefs and Talk history separate', {
        exact: false,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('link', { name: /Scope a client engagement/ }).click();
    await expect(page.getByLabel('Message Aethelios')).toHaveValue(
      /scope an Ascend Architects engagement/,
    );
    await page.getByRole('button', { name: 'Tools & context' }).click();
    await expect(page.getByRole('checkbox', { name: 'Use personal context' })).not.toBeChecked();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `test-results/company-talk-${width}.png`, fullPage: true });
  });
}
test('public arrival and unconnected Lifestyle keep commerce state honest', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Bring the ambition/ })).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Public navigation' })
      .getByRole('link', { name: 'Lifestyle', exact: true }),
  ).toHaveAttribute('href', '/lifestyle');
  for (const route of ['/shop', '/app/collection']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'The Collection.' })).toBeVisible();
    await expect(
      page.getByText('Live product availability is not connected yet.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /checkout|add to cart/i })).toHaveCount(0);
  }
  for (const route of ['/shop/cart', '/app/collection/cart']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'Cart.', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Shopping is not open yet.');
    await expect(page.getByRole('button', { name: /checkout/i })).toHaveCount(0);
  }
  const response = await request.post('/api/commerce/cart', {
    data: { action: 'add', variantId: 'gid://shopify/ProductVariant/1', quantity: 1 },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: 'Shopping is not open yet.' });
  expect(response.headers()['cache-control']).toBe('private, no-store');
});
