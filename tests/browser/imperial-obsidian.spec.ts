import { expect, test } from './fixtures';

for (const width of [320, 360, 768, 1024, 1920]) {
  test(`Ecosystem has honest offers and usable navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/ecosystem');
    await expect(page.getByRole('heading', { name: /One world/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aethelios Intelligence' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aethelios Health' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aethelios Lifestyle' })).toBeVisible();
    await expect(page.locator('.eco-chamber')).toHaveCount(5);
    await expect(page.locator('.eco-chamber-architect')).toContainText('$129.00');
    await expect(page.locator('.eco-chamber-continuum')).toContainText('Coming soon');
    await expect(
      page.getByText('No prescribing or clinical care is offered here.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Your membership ↗', exact: true })).toHaveAttribute(
      'href',
      '/app/membership',
    );
    await expect(page.getByRole('button', { name: /buy|subscribe|checkout/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(navigation.getByRole('link', { name: 'Ecosystem' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.screenshot({
      path: `test-results/imperial-obsidian-ecosystem-${width}.png`,
      fullPage: true,
    });
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(page.locator('.io-ecosystem-hero')).toHaveCSS('background-image', 'none');
  });
}
