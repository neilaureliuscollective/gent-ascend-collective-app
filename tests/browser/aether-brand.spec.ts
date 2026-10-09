import { test, expect } from './fixtures';
for (const width of [344, 720, 1440, 2560]) {
  test(`Imperial material, readable navigation and static orb at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/aethelios');
    await expect(page.locator('.imperial-workspace')).toHaveCSS(
      'background-color',
      'rgb(18, 20, 23)',
    );
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
test('Imperial manifest and official installed icon variants resolve', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.theme_color).toBe('#F5F1E8');
  expect(manifest.background_color).toBe('#F5F1E8');
  for (const icon of manifest.icons) {
    expect(icon.src).toContain('aethelios-official-20261008');
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

for (const width of [360, 1440]) {
  for (const [route, selector] of [
    [
      '/app/aethelios',
      '.aethelios-room-heading nav a, .workspace-preview-note p, .workspace-preview-note a, .aurelius-welcome p',
    ],
    ['/app/work', '.company-job h2, .company-job p, .company-work-note p, .company-work-links a'],
    [
      '/app/studio',
      '.studio-world-heading h1, .studio-empty h2, .studio-empty > p, .studio-section-head > button',
    ],
  ] as const) {
    test(`Reading surfaces retain readable text on ${route} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(route);
      await expect(page.locator(selector).first()).toBeVisible();
      const contrasts = await page.locator(selector).evaluateAll((elements) => {
        const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
        const luminance = (channels: number[]) =>
          channels
            .slice(0, 3)
            .map((channel) => {
              const v = channel / 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
        return elements
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => {
            let parent: Element | null = el;
            let background = [245, 241, 232];
            while (parent) {
              const color = rgb(getComputedStyle(parent).backgroundColor);
              if (color.length === 3 || color[3] === 1) {
                background = color;
                break;
              }
              parent = parent.parentElement;
            }
            const a = luminance(rgb(getComputedStyle(el).color));
            const b = luminance(background);
            return {
              text: el.textContent,
              ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
            };
          });
      });
      expect(contrasts.length).toBeGreaterThan(0);
      for (const result of contrasts)
        expect(result.ratio, result.text ?? '').toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
}
