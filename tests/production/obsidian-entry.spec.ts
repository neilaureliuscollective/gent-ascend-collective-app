import { test, expect } from '@playwright/test';

test('the verified production application serves Obsidian and preserves public entry paths', async ({
  page,
  request,
}) => {
  await expect
    .poll(
      async () => {
        const response = await request.get('/manifest.webmanifest');
        if (!response.ok()) return '';
        return (await response.json()).theme_color;
      },
      { timeout: 120000, intervals: [2000, 5000] },
    )
    .toBe('#080A0B');

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of [
      '/',
      '/enter',
      '/app/aethelios',
      '/app/work',
      '/app/studio',
      '/app/ecosystem',
    ]) {
      const response = await page.goto(route);
      expect(response?.ok(), route).toBe(true);
      await expect(page.locator('main').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route,
      ).toBe(true);
      if (route.startsWith('/app/')) {
        await expect(page.locator('.imperial-workspace')).toHaveCSS(
          'background-color',
          'rgb(8, 10, 11)',
        );
        await expect(
          page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link'),
        ).toHaveCount(4);
      }
      await page.screenshot({
        path: `test-results/production-${route.replaceAll('/', '-') || 'home'}-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.goto('/');
    await page.getByRole('link', { name: 'Open Aethelios ↗', exact: true }).click();
    await expect(page).toHaveURL(/\/enter$/);
  }
  expect((await request.get('/dev')).status()).toBe(404);
  expect((await request.get('/api/aurelius')).status()).toBeGreaterThanOrEqual(400);
});
