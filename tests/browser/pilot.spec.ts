import { expect, test } from './fixtures';

test('public member arrival offers free entry and founder console stays closed', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 344, height: 740 });
  await page.goto('/app/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome to your ascent.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your own space begins here.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create an account or sign in' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/app/founder/pilot');
  await expect(page.getByRole('heading', { name: 'Founder access required.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Founding members.' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('bad invite token returns a safe arrival state', async ({ page }) => {
  await page.goto('/auth/confirm?type=invite');
  await expect(page).toHaveURL(/\/welcome\?status=auth$/);
  await expect(page.getByRole('status')).toContainText('email link was not accepted');
});
