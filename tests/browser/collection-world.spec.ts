import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`member Collection stays native through discovery and product selection at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/world');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('link', { name: 'Collection', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'The Collection.' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Collection', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link')).toHaveCount(5);
    await page.screenshot({
      path: `test-results/member-collection-home-${width}.png`,
      animations: 'disabled',
    });
    const search = page.getByRole('searchbox', { name: 'Find your essential' });
    await search.fill('Vitalis');
    await expect(page.locator('.collection-browse .reserve-collection-card')).toHaveCount(1);
    await page.getByRole('checkbox', { name: 'Available to order' }).check();
    await expect(page.locator('.collection-browse .reserve-collection-card')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Available to order' }).uncheck();
    await page.locator('.collection-browse .reserve-collection-card').click();
    await expect(page).toHaveURL(/\/app\/collection\/vitalis$/);
    await expect(page.getByRole('heading', { name: 'Vitalis.' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Collection', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('button', { name: /Add to cart/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Save to my collection/ }).click();
    await page.getByRole('link', { name: 'View your saved selection' }).click();
    await expect(page).toHaveURL(/\/app\/collection\?saved=1$/);
    await expect(page.locator('.collection-browse .reserve-collection-card')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /My selection/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/member-collection-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(errors).toEqual([]);
  });
}
