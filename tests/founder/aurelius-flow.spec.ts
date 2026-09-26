import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const token = readFileSync('.env.development.local', 'utf8')
  .split(/\r?\n/)
  .find((line) => line.startsWith('AURELIUS_DEV_TOKEN='))
  ?.slice('AURELIUS_DEV_TOKEN='.length);
test('founder memory persists through the real Next API and can be removed', async ({ page }) => {
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(token!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/');
  await page.goto('/app/aethelios');
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await page.getByLabel('What should Aethelios remember?').fill('Synthetic browser memory');
  await page.getByRole('button', { name: 'Confirm and remember' }).click();
  await expect(page.locator('.memory-list')).toContainText('Synthetic browser memory');
  await page.reload();
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  const row = page.locator('.memory-list li').filter({ hasText: 'Synthetic browser memory' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Forget', exact: true }).click();
  await row.getByRole('button', { name: 'Confirm forget' }).click();
  await expect(row).toHaveCount(0);
});
