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
  // The smoked composer retains optical focus emphasis and a visible editor outline.
  await expect(composer.locator('> .bplus-optics .bplus-emphasis')).toHaveCSS('opacity', '0.12');
  await expect(input).toHaveCSS('outline-style', 'solid');
  await expect(input).toHaveCSS('outline-width', '2px');
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
  await expect(page.getByRole('link', { name: 'Your membership ↗', exact: true })).toBeVisible();
});

test('Compact welcome suggestions stage the existing draft without sending', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/aethelios');
  const input = page.getByLabel('Message Aethelios', { exact: true });
  await page.getByRole('button', { name: 'Pressure-test an idea', exact: true }).click();
  await expect(input).toHaveValue(
    'I have an idea to pressure-test. Help me turn it into a clear decision.',
  );
  await expect(input).toBeFocused();
  await expect(page.locator('.conversation-turn')).toHaveCount(0);
  await expect(page.locator('textarea.talk-input')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
});
