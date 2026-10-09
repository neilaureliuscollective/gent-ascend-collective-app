import { test, expect } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`Aethelios identity and account layout at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/app');
    await expect(page).toHaveTitle(/Aethelios/);
    await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toBeVisible();
    // Narrow Talk intentionally hides the redundant mobile brand bar to retain reading room.
    await expect(page.locator('body')).not.toContainText('Aurelius');
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link'),
    ).toHaveCount(3);
    await page.screenshot({
      path: `test-results/gent-command-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto('/app/you');
    await expect(page.getByRole('heading', { name: 'Your account. Your context.' })).toBeVisible();
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
    await page.goto('/app/world');
    await expect(page.getByRole('heading', { name: 'My world.', exact: true })).toBeVisible();
    await page.getByText('Explore the Collective', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Legacy Reserve', exact: true })).toBeVisible();
    await page.goto('/app/aethelios');
    await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toHaveText(
      'Aethelios',
    );
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.name).toBe('Aethelios');
    expect(manifest.short_name).toBe('Aethelios');
    expect(manifest.theme_color).toBe('#F5F1E8');
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  });
}
