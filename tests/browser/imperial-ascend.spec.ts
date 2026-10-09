import { expect, test } from './fixtures';

for (const width of [360, 768, 1440]) {
  test(`Imperial arrival and entrance remain usable at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of ['/', '/enter']) {
      await page.goto(route);
      await expect(page.locator('.public-world')).toHaveAttribute('data-imperial', 'editorial');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.getByRole('button', { name: 'Reduced motion' })).toBeDisabled();
    }
    await page.screenshot({ path: `test-results/imperial-enter-${width}.png`, fullPage: true });
    await expect(page.locator('.entrance-statement')).toHaveCSS('color', 'rgb(80, 97, 88)');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'From thought to possibility.' })).toBeVisible();
    await expect(page.locator('.imperial-workspace')).toHaveCount(3);
    await page.screenshot({ path: `test-results/imperial-home-${width}.png`, fullPage: true });
    await expect(page.getByRole('link', { name: 'Open Aethelios ↗', exact: true })).toHaveAttribute(
      'href',
      '/enter',
    );
    if (width < 1100) {
      await page.getByRole('button', { name: 'Explore', exact: false }).first().click();
      await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeHidden();
    }
    await page.goto('/support');
    await expect(page.locator('.public-world')).not.toHaveAttribute('data-imperial', 'editorial');
  });
}
