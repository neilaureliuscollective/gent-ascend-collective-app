import { test, expect } from '@playwright/test';
for (const width of [360, 768, 1440]) {
  test(`shell and Aurelius panel at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'A life built with intention.' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const trigger = page.getByRole('button', { name: 'Aurelius' });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByText('AI conversations are not active yet.', { exact: false }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await page.getByRole('link', { name: 'My world', exact: false }).click();
    await expect(page.getByRole('heading', { name: 'My world.' })).toBeVisible();
    await page.getByRole('link', { name: 'Progress', exact: false }).click();
    await expect(
      page.getByText('No progress measurements have been recorded.', { exact: false }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    if (width === 360 || width === 1440) {
      await page.goto('/');
      await page.screenshot({ path: `test-results/command-${width}.png`, fullPage: true });
    }
  });
}
test('production runtime denies developer routes and query bypass', async ({ page, request }) => {
  const response = await request.get('/dev');
  expect(response.status()).toBe(404);
  expect(
    (await request.post('/dev', { data: { membership: 'admin', token: 'fake' } })).status(),
  ).toBeGreaterThanOrEqual(400);
  await page.goto('/?dev=true');
  await expect(page.getByRole('link', { name: 'Developer console' })).toHaveCount(0);
  await page.goto('/you');
  await expect(
    page.getByText('Personal profiles are not connected', { exact: false }),
  ).toBeVisible();
});
