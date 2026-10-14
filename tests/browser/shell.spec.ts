import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`current workspace navigation and Aethelios presence at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/app/aethelios');
    await expect(page).toHaveURL('/app/aethelios');
    await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
    let navigation = page.getByRole('navigation', { name: 'Aethelios destinations' });
    await expect(navigation.getByRole('link')).toHaveCount(11);
    await expect(navigation.getByRole('link', { name: 'Lifestyle', exact: true })).toHaveAttribute(
      'href',
      '/app/lifestyle',
    );
    await expect(navigation.getByRole('link', { name: 'Architect', exact: true })).toHaveAttribute(
      'href',
      '/app/architect',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const trigger = page.getByRole('button', { name: 'Aethelios presence', exact: true });
    await trigger.click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
    await navigation.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'What are we building?' })).toBeVisible();
    navigation = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(navigation.getByRole('link', { name: 'Work', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await navigation.getByRole('link', { name: 'Studio', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Make the vision visible.' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Studio', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(errors).toEqual([]);
    if (width === 360 || width === 1440) {
      await page.goto('/app/aethelios');
      await page.screenshot({ path: `test-results/workspace-${width}.png`, fullPage: true });
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
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole('heading', { name: 'Command', exact: true })).toBeVisible();
  await page.goto('/app/aethelios');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Developer console' })).toHaveCount(0);
  await page.goto('/app/you');
  await expect(
    page.getByText('Personal profiles are not connected', { exact: false }),
  ).toBeVisible();
  await page.goto('/app/goals');
  await expect(page.getByRole('link', { name: 'Go to your account' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Create goal' })).toHaveCount(0);
});
