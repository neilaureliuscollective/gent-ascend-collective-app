import { expect, test } from '@playwright/test';
for (const width of [344, 720, 768, 1440]) {
  test(`catalog navigation restores filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3102/?mode=lifestyle-list');
    await page.getByRole('searchbox').fill('no matching product');
    await expect(page).toHaveURL(/q=no\+matching\+product/);
    await page.getByLabel('Available to order', { exact: true }).check();
    await page.getByLabel('Sort products').selectOption('name');
    await page.goBack();
    await expect(page.getByLabel('Sort products')).toHaveValue('featured');
    await expect(page.getByLabel('Available to order', { exact: true })).toBeChecked();
    await page.goBack();
    await expect(page.getByLabel('Available to order', { exact: true })).not.toBeChecked();
    await expect(page.getByRole('searchbox')).toHaveValue('no matching product');
    await page.reload();
    await expect(page.getByRole('searchbox')).toHaveValue('no matching product');
    await page.getByRole('button', { name: 'Remove search: no matching product ×' }).click();
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(page).not.toHaveURL(/[?&]q=/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('unsupported URL filters recover without inventing catalog attributes', async ({ page }) => {
  await page.goto(
    'http://127.0.0.1:3102/?mode=lifestyle-list&chapter=fiction&brand=fiction&sort=fiction',
  );
  await expect(page.getByRole('button', { name: 'All essentials', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('Sort products')).toHaveValue('featured');
  await expect(page.getByRole('group', { name: 'Applied filters' })).toHaveCount(0);
});
