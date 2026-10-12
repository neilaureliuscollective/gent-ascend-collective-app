import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`member Lifestyle navigation and unavailable product state at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/world');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('link', { name: 'Lifestyle', exact: true }).click();
    await expect(page.getByRole('heading', { name: /The art of.*living well/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Lifestyle', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link')).toHaveCount(6);
    await page.getByRole('link', { name: 'Explore the collection →', exact: true }).click();
    await expect(page).toHaveURL('/app/collection');
    await expect(page.getByRole('heading', { name: 'The Collection.' })).toBeVisible();
    await expect(
      page.getByText('Live product availability is not connected yet.', { exact: false }),
    ).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Find your essential' });
    await search.fill('Vitalis');
    await page.getByRole('checkbox', { name: 'Available to order' }).check();
    await expect(page.locator('.collection-browse .reserve-collection-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Add to cart|checkout/ })).toHaveCount(0);
    await page.screenshot({
      path: `test-results/member-collection-home-${width}.png`,
      animations: 'disabled',
    });
    await page.goto('/app/collection/vitalis');
    await expect(
      page.getByRole('heading', { name: 'Product availability could not be verified.' }),
    ).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Lifestyle', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('button', { name: /Add to cart|checkout/ })).toHaveCount(0);
    await page.getByRole('link', { name: 'Return to the collection →', exact: true }).click();
    await expect(page).toHaveURL('/app/collection');
    await page
      .getByRole('group', { name: 'Collection chapters' })
      .getByRole('button', { name: /My selection/ })
      .click();
    await expect(page.locator('.collection-browse .reserve-collection-card')).toHaveCount(0);
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

