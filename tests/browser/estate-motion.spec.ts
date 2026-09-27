import { test, expect } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`native scroll and Fold-width changes preserve the entry at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.estate-journey')).toHaveAttribute('data-choreographed', 'true');
    for (const selector of ['#the-man', '#the-intelligence', '#the-system', '#the-ritual']) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await expect(page.locator(selector)).toBeVisible();
      await page.evaluate(() => scrollBy(0, 180));
      await page.evaluate(() => scrollBy(0, -120));
    }
    await page.locator('#the-intelligence').scrollIntoViewIfNeeded();
    await expect(page.locator('.estate-sculpture .aurelius-presence')).toHaveAttribute(
      'data-state',
      'ready',
    );
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(1);
    await page.setViewportSize({ width: width === 344 ? 768 : 344, height: 760 });
    await page.getByRole('button', { name: 'Still mode', exact: true }).click();
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
