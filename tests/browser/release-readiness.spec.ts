import { expect, test } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`support and release controls remain honest at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/support');
    await expect(page.getByRole('heading', { name: /Keep your\s*momentum\./ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Conversations and memory →' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('link', { name: 'Your membership →', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/membership/);
    await page.goto('/app/founder/launch');
    await expect(page.getByRole('heading', { name: 'Founder access required.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The launch ledger.' })).toHaveCount(0);
    await expect(page.getByText('Deployment source:', { exact: false })).toHaveCount(0);
  });
}
