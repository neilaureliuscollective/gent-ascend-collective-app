import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`Cabinet retains a failed draft and reviewed state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    let submitted: Record<string, string> | null = null;
    await page.route('**/fixture-cabinet-save', (route) => {
      submitted = route.request().postDataJSON();
      return route.fulfill({
        json: {
          error: 'This record changed. Reload before saving again. Your draft is retained.',
          message: '',
        },
      });
    });
    await page.goto('http://127.0.0.1:3102/?mode=cabinet');
    await page.getByLabel('My experience').selectOption('running_low');
    await page.getByLabel('My note').fill('My bottle is almost empty');
    await page.getByLabel('Grooming ritual').selectOption({ label: 'Morning ritual' });
    await page.getByRole('button', { name: 'Save my experience' }).click();
    await expect(page.getByRole('alert')).toContainText('draft is retained');
    await expect(page.getByLabel('My note')).toHaveValue('My bottle is almost empty');
    await expect(page.getByLabel('My experience')).toHaveValue('running_low');
    expect(submitted).toMatchObject({ version: '1', relation: 'running_low', operation: 'save' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('Cabinet signed-out route and world entry are accessible', async ({ page }) => {
  await page.goto('/app/collection/cabinet');
  await expect(page.getByRole('heading', { name: 'Your Cabinet.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in →' })).toBeVisible();
  await page.goto('/app/collection');
  await expect(
    page.getByRole('link', { name: 'Saved product records', exact: true }),
  ).toHaveAttribute('href', '/app/collection/cabinet');
});
