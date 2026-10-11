import { test, expect } from './fixtures';

// Real production-route rendering; no authentication or provider behavior is bypassed.
for (const viewport of [
  { width: 344, height: 882 }, // Fold cover
  { width: 390, height: 844 },
  { width: 720, height: 960 }, // unfolded portrait
  { width: 960, height: 720 }, // unfolded landscape
  { width: 1440, height: 900 }, // DeX / desktop
  { width: 2560, height: 1440 },
]) {
  test(`Obsidian product surfaces reflow at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of [
      '/',
      '/enter',
      '/app/aethelios',
      '/app/work',
      '/app/studio',
      '/app/ecosystem',
      '/app/you',
      '/app/missions',
    ]) {
      await page.goto(route);
      await expect(page.locator('main').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route,
      ).toBe(true);
      if (route.startsWith('/app/')) {
        const navigation = page.getByRole('navigation', { name: 'Main navigation' });
        await expect(navigation.getByRole('link')).toHaveCount(4);
        // A semantic-token cycle previously made inherited backgrounds transparent.
        const surface = await page.locator('.imperial-workspace').evaluate((el) => ({
          background: getComputedStyle(el).backgroundColor,
          text: getComputedStyle(el).color,
        }));
        expect(surface.background).toBe('rgb(8, 10, 11)');
        expect(surface.text).toBe('rgb(230, 231, 226)');
        for (const link of await navigation.getByRole('link').all()) {
          const box = await link.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
      }
      await page.screenshot({
        path: `test-results/obsidian-${route.replaceAll('/', '-') || 'home'}-${viewport.width}.png`,
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
}

test('navigation and writing remain accessible with enlarged text and forced colors', async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 960 });
  await page.goto('/app/aethelios');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const input = page.getByLabel('Message Aethelios', { exact: true });
  await input.fill('Preserve my draft across display preferences.');
  await input.focus();
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(input).toHaveValue('Preserve my draft across display preferences.');
  await expect(page.locator('.aurelius-composer')).toHaveCSS('background-image', 'none');
  await expect(input).toBeInViewport();
});
