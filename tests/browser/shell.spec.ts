import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`shell and Aethelios panel at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Make today yours.' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const trigger = page.getByRole('button', { name: 'Aethelios' });
    await trigger.click();
    if (width <= 1100) {
      await expect(page).toHaveURL('/app/aethelios');
      await expect(page.getByLabel('Message Aethelios')).toBeInViewport();
      await page.getByRole('link', { name: 'Back to Command' }).click();
    } else {
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByText('Sign in to use your Aethelios workspace.', { exact: false }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'My world', exact: false })
      .click();
    await expect(page.getByRole('heading', { name: 'My world.' })).toBeVisible();
    await page.getByRole('link', { name: 'Progress', exact: false }).click();
    await expect(
      page.getByText('Sign in to see your history.', {
        exact: false,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    if (width === 360 || width === 1440) {
      await page.goto('/app');
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
  await page.goto('/app?dev=true');
  await expect(page.getByRole('link', { name: 'Developer console' })).toHaveCount(0);
  await page.goto('/app/you');
  await expect(
    page.getByText('Personal profiles are not connected', { exact: false }),
  ).toBeVisible();
  await page.goto('/app/goals');
  await expect(page.getByRole('link', { name: 'Go to your account' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Create goal' })).toHaveCount(0);
});
