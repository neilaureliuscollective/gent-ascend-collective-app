import { test, expect } from './fixtures';

for (const width of [344, 390, 720, 960, 1440, 2560]) {
  test(`Imperial Emerald materials, focus and showroom reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/work');
    const chamber = page.locator('.company-work > header');
    await expect(chamber).toHaveCSS('background-image', /rgb\(23, 68, 56\)/);
    await expect(page.locator('.company-job-list').last()).toHaveCSS('gap', '0px');
    await chamber.getByRole('link', { name: 'Continue in Talk' }).focus();
    await expect(chamber.getByRole('link', { name: 'Continue in Talk' })).toBeFocused();
    await expect(chamber.getByRole('link', { name: 'Continue in Talk' })).toHaveCSS(
      'outline-style',
      'solid',
    );
    for (const route of [
      '/enter',
      '/app/ecosystem',
      '/lifestyle',
      '/shop',
      '/shop/cart',
      '/app/founder/launch',
    ]) {
      await page.goto(route);
      await expect(page.locator('main').first()).toBeVisible();
      await expect(page.locator('.workspace-loading')).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route,
      ).toBe(true);
      await page.screenshot({
        path: `test-results/emerald-${route.replaceAll('/', '-')}-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto('/app/ecosystem');
    await page.locator('html').evaluate((el) => el.setAttribute('data-material', 'solid'));
    await expect(page.locator('.io-division').first()).toHaveCSS('background-image', 'none');
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page.locator('.io-division').first()).toHaveCSS('background-image', 'none');
    await expect(page.locator('.io-ecosystem-hero')).toHaveCSS('background-image', 'none');
  });
}
