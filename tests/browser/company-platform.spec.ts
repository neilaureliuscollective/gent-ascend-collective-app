import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`company work opens reviewable briefs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app');
    await expect(page).toHaveURL('/app/aethelios');
    await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toBeVisible();
    const mainNav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(mainNav.getByRole('link')).toHaveCount(3);
    await mainNav.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'What are we building?' })).toBeVisible();
    await expect(
      page.getByText('Company rooms keep confirmed briefs and Talk history separate', { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('link', { name: /Scope a client engagement/ }).click();
    await expect(page.getByLabel('Message Aethelios')).toHaveValue(
      /scope an Ascend Architects engagement/,
    );
    await expect(page.getByRole('checkbox', { name: 'Use personal context' })).not.toBeChecked();
    await page.screenshot({ path: `test-results/company-talk-${width}.png`, fullPage: true });
  });
}
test('public arrival and old shops do not offer checkout', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Bring the ambition/ })).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Public navigation' })
      .getByRole('link', { name: 'Shop', exact: true }),
  ).toHaveCount(0);
  for (const route of [
    '/shop',
    '/shop/vitalis',
    '/shop/cart',
    '/app/collection',
    '/app/collection/vitalis',
    '/app/collection/cart',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'A separate destination.' })).toBeVisible();
    await expect(page.getByRole('button', { name: /checkout|add to cart/i })).toHaveCount(0);
  }
  expect(
    (
      await request.post('/api/commerce/cart', {
        data: { action: 'add', variantId: 'gid://shopify/ProductVariant/1', quantity: 1 },
      })
    ).status(),
  ).toBe(410);
});
