import { expect, test } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`catalog search and availability preserve saved products at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/shop');
    const shelf = page.locator('#collection');
    await shelf.getByRole('searchbox', { name: 'Search this collection' }).fill('VITALIS');
    await expect(shelf.locator('.reserve-collection-card')).toHaveCount(1);
    await shelf.getByRole('button', { name: 'Save Vitalis to my collection' }).click();
    await shelf.getByRole('checkbox', { name: 'Available to order' }).check();
    await expect(shelf.locator('.reserve-collection-card')).toHaveCount(0);
    await expect(
      shelf.getByRole('heading', { name: 'No objects match these filters.' }),
    ).toBeVisible();
    await shelf.getByRole('button', { name: 'Clear search & availability' }).click();
    await expect(shelf.locator('.reserve-collection-card')).toHaveCount(4);
    await shelf.getByRole('button', { name: 'My selection' }).click();
    await expect(shelf.locator('.reserve-collection-card')).toHaveCount(1);
    await shelf.getByRole('searchbox', { name: 'Search this collection' }).fill('no-match');
    await expect(shelf.locator('.reserve-collection-card')).toHaveCount(0);
    await shelf.getByRole('button', { name: 'Clear search & availability' }).click();
    await expect(
      shelf.getByRole('button', { name: 'Remove Vitalis from my collection' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
