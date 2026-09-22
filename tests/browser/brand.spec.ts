import { test, expect } from '@playwright/test';

for (const width of [344, 768, 1440]) {
  test(`Gent Ascend identity and account layout at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    await expect(page).toHaveTitle('Gent Ascend Collective');
    await expect(
      page.getByRole('link', { name: 'Gent Ascend Collective home' }).filter({ visible: true }),
    ).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Aurelius');
    if (width > 1100) {
      const nav = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
      const launcher = await page
        .getByRole('button', { name: 'Aethelios', exact: true })
        .boundingBox();
      expect(launcher!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height);
    }
    await page.screenshot({ path: `test-results/gent-command-${width}.png`, fullPage: true });
    await page.goto('/you');
    await expect(
      page.getByRole('heading', { name: 'Build the man behind the life.' }),
    ).toBeVisible();
    await expect(page.locator('.account-brand img')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page
        .locator('.account-brand img')
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    await page.screenshot({ path: `test-results/gent-account-${width}.png`, fullPage: true });
    await page.goto('/world');
    await expect(page.getByRole('heading', { name: 'Legacy Reserve', exact: true })).toBeVisible();
    await page.goto('/aethelios');
    await expect(page.getByRole('heading', { name: 'Aethelios.', exact: true })).toBeVisible();
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.name).toBe('Gent Ascend Collective');
    expect(manifest.short_name).toBe('Gent Ascend');
    expect(manifest.theme_color).toBe('#050706');
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  });
}
