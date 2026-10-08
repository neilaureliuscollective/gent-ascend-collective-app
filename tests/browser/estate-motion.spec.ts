import { test, expect } from './fixtures';
// The former gender-specific scroll story was replaced before Phase 1.
for (const width of [344, 768, 1440])
  test('inclusive public entry retains direct work access at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(r.url());
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Move your world forward/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Aethelios', exact: true })).toHaveAttribute(
      'href',
      '/enter',
    );
    await expect(
      page.getByRole('link', { name: 'Explore your work', exact: true }),
    ).toHaveAttribute('href', '/app/work');
    await expect(page.locator('body')).toContainText('personal project');
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
