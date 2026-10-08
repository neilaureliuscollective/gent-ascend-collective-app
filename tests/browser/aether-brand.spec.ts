import { test, expect } from './fixtures';
for (const width of [344, 720, 1440, 2560]) {
  test(`Aether material, readable navigation and static orb at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/aethelios');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(6, 9, 13)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Aethelios presence', exact: true }).click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.intelligence-orb-static')).toHaveCSS('opacity', '1');
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/aether-presence-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Aethelios presence', exact: true }),
    ).toBeFocused();
  });
}
test('Aether manifest and all installed icon variants resolve', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.theme_color).toBe('#06090D');
  expect(manifest.background_color).toBe('#06090D');
  for (const icon of manifest.icons) {
    expect(icon.src).toContain('aethelios-app-20261008');
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});
