import { expect, test } from '@playwright/test';

test('private pilot arrival is legible without a session and founder console stays closed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 344, height: 740 });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome to your ascent.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accept your invitation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to sign in' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const denied = await page.goto('/founder/pilot');
  expect(denied?.status()).toBe(404);
  expect(errors).toEqual([]);
});

test('bad invite token returns a safe arrival state', async ({ page }) => {
  await page.goto('/auth/confirm?type=invite');
  await expect(page).toHaveURL(/\/welcome\?status=auth$/);
  await expect(page.getByRole('status')).toContainText('invitation link was not accepted');
});
