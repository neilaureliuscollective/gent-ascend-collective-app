import { expect, test } from './fixtures';

for (const width of [320, 390, 720, 1024, 1440, 1920]) {
  test(`Luminous environments retain usable layouts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of ['aethelios', 'work', 'studio', 'ecosystem']) {
      await page.goto(`/app/${route}`);
      await expect(page.locator('.imperial-workspace')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/luminous-${route}-${width}.png`,
        fullPage: true,
      });
    }
  });
}

test('Talk keeps its draft and compact composer through appearance changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/app/aethelios');
  const composer = page.locator('.aurelius-composer');
  const input = page.getByLabel('Message Aethelios', { exact: true });
  await input.fill('A founder review draft');
  await input.focus();
  await expect(input).toBeFocused();
  await expect(composer).toHaveCSS('border-color', 'rgb(79, 174, 126)');
  // Talk hides the global topbar; exercise the shared preference event directly.
  await page.evaluate(() => {
    localStorage.setItem('aurelius-material', 'solid');
    window.dispatchEvent(new Event('aurelius-appearance'));
  });
  await expect(page.locator('html')).toHaveAttribute('data-material', 'solid');
  await expect(input).toHaveValue('A founder review draft');
  expect(await composer.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(180);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
});

test('Solid and forced-color modes remove atmospheric hero decoration', async ({ page }) => {
  await page.goto('/app/ecosystem');
  await page.getByRole('button', { name: 'Use solid surfaces' }).click();
  await expect(page.locator('.io-hero')).toHaveCSS('background-image', 'none');
  await expect(page.locator('.io-horizon')).toBeHidden();
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('.io-hero')).toHaveCSS('background-image', 'none');
  await expect(page.getByRole('link', { name: 'Your membership' })).toBeVisible();
});
