import { test, expect } from '@playwright/test';
for (const width of [344, 390, 768, 1440]) {
  test(`identity studies remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('http://127.0.0.1:3102/identity-studies.html');
    await expect(
      page.getByText('No model, microphone, saving or live operation is running.', {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.locator('.pose-board article')).toHaveCount(17);
    for (const surface of ['Talk', 'Live', 'Work', 'Studio']) {
      await page.getByLabel('Preview layout').selectOption(surface);
      await expect(page.getByRole('region', { name: `${surface} layout study` })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });
}
test('save confirmation, voice envelope and Still preserve truthful presentation', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/identity-studies.html');
  const presence = page.locator('.presence-anchor .identity-presence');
  await page
    .getByRole('combobox', { name: 'Operation pose', exact: true })
    .selectOption('complete');
  await page.getByLabel('Save receipt').selectOption('pending');
  await expect(presence).toHaveAttribute('data-phase', 'saving');
  await expect(page.getByRole('status')).toHaveText('Saving · Preview');
  await page.getByLabel('Save receipt').selectOption('uncertain');
  await expect(page.getByRole('status')).toHaveText('Save unconfirmed · Preview');
  await expect(presence).toHaveAttribute('data-phase', 'failed');
  await page.getByLabel('Save receipt').selectOption('not-applicable');
  await page.getByLabel('Illustrative voice envelope').fill('0.8');
  await expect(presence).toHaveCSS('--level', '0');
  await page
    .getByRole('combobox', { name: 'Operation pose', exact: true })
    .selectOption('speaking');
  await expect(presence).toHaveCSS('--level', '0.8');
  await page
    .getByRole('combobox', { name: 'Operation pose', exact: true })
    .selectOption('thinking');
  await page.getByLabel('Still', { exact: true }).check();
  expect(
    await presence
      .locator('.identity-light')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
});
test('reduced motion stops the preview loops', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3102/identity-studies.html');
  const light = page.locator('.presence-anchor .identity-light');
  await expect(light).toHaveCSS('animation-name', 'none');
});
