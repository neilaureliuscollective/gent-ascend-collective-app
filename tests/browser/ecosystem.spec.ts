import { test, expect } from '@playwright/test';
for (const width of [320, 344, 390, 768, 1440, 2560]) {
  test(`ecosystem routes and retained navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const path of [
      '/app/ecosystem',
      '/app/entities',
      '/app/life',
      '/app/health',
      '/app/architect',
      '/app/lifestyle',
    ]) {
      expect((await page.goto(path))?.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.locator('.ecosystem-heading h1').evaluate((e) => getComputedStyle(e).color),
      ).toBe('rgb(245, 241, 232)');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
      for (const name of ['Talk', 'Work', 'Studio', 'Ecosystem'])
        await expect(navigation.getByRole('link', { name, exact: true })).toBeVisible();
      await expect(navigation.getByRole('link', { name: 'Ecosystem' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      if (width <= 1100) {
        const tops = await navigation
          .getByRole('link')
          .evaluateAll((nodes) => nodes.map((e) => e.getBoundingClientRect().top));
        expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2);
      }
    }
    await page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('link', { name: 'Talk', exact: true })
      .click();
    await expect(page).toHaveURL(/\/app\/aethelios$/);
  });
}
test('Health preparation is temporary and makes no account or provider writes', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/')) writes.push(request.url());
  });
  await page.goto('/app/health');
  const checkbox = page.getByRole('checkbox').first();
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await expect(page.getByRole('status').filter({ hasText: 'reminders selected' })).toHaveText(
    '1 of 6 reminders selected. Nothing saved to your account.',
  );
  await page.getByRole('button', { name: 'Clear selections' }).click();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.reload();
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();
  expect(writes).toEqual([]);
});
test('Entity starter prepares a draft without selecting a cast or sending', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/(aurelius|company-talk)/.test(r.url()))
      calls.push(r.url());
  });
  await page.goto('/app/entities');
  await page.getByRole('link', { name: 'Prepare a Prometheus brief' }).click();
  await expect(page).toHaveURL(/starter=entity-prometheus/);
  await expect(page.getByRole('textbox', { name: 'Message Aethelios' })).toHaveValue(
    /Help me architect an application/,
  );
  expect(calls).toEqual([]);
});
