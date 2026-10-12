import { test, expect } from '@playwright/test';
for (const width of [344, 768, 1440]) {
  test(`motion gallery reflows at ${width} without issuing operations`, async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) requests.push(request.url());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3102/motion.html');
    await expect(page.getByText('Microphone off.', { exact: false })).toBeVisible();
    await page.getByLabel('Preview state').selectOption('speaking');
    await expect(page.locator('.gallery-stage .im-status')).toHaveText('Preview · Speaking');
    await expect(page.locator('.gallery-stage .im-presence')).toHaveCSS('--im-level', '0');
    await page.getByLabel('Illustrative audio level').fill('0.5');
    await expect(page.locator('.gallery-stage .im-presence')).toHaveCSS('--im-level', '0.5');
    await page.getByRole('button', { name: 'Pause ambient motion' }).click();
    await expect(page.locator('.gallery-stage .im-presence')).toHaveAttribute(
      'data-motion',
      'still',
    );
    await expect(page.locator('.gallery-stage .im-presence')).toHaveCSS('--im-level', '0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(requests).toEqual([]);
  });
}
test('OS motion changes and forced colors keep truthful status text', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/motion.html');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.gallery-stage .im-presence')).toHaveAttribute('data-motion', 'still');
  await expect(page.locator('.gallery-stage .identity-light')).toHaveCSS('animation-name', 'none');
  await expect(page.getByText('Preview · Save unconfirmed')).toBeVisible();
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('.gallery-stage .im-presence')).toBeHidden();
  await expect(page.locator('.gallery-stage .im-status')).toBeVisible();
});
