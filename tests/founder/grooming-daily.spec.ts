// Real Auth/browser persistence gate, synthetic local Supabase only.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== '127.0.0.1')
  throw new Error('Local Supabase required');
test('member chamber saves, reviews, records and restores the actual private ritual', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await page.goto('/app/grooming');
  await expect(page.locator('.ritual-chamber-member')).toBeVisible();
  await page.getByRole('button', { name: 'evening', exact: true }).click();
  const create = page.getByRole('button', { name: 'Create your ritual' });
  if (await create.count()) await create.click();
  else await page.getByRole('button', { name: 'Refine ritual ↗' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Synthetic daily evening');
  await page.getByLabel('Steps · one per line').fill('Follow my existing care.\nNotice comfort.');
  await page.getByRole('button', { name: 'Review ritual →' }).click();
  await page.getByRole('button', { name: 'Save reviewed ritual' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#grooming-area')).toContainText('Synthetic daily evening');
  await page.reload();
  await page.getByRole('button', { name: 'evening', exact: true }).click();
  await expect(page.locator('#grooming-area')).toContainText('Synthetic daily evening');
  await page.getByRole('button', { name: 'I’ve done it' }).click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('status')
      .filter({ hasText: 'Recorded in your grooming history' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Comfortable', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Feedback saved.');
  await page.getByRole('button', { name: 'Close Your grooming ritual' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'evening', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review your ritual' })).toBeVisible();
  await page.getByRole('button', { name: 'Progress ↗' }).click();
  await expect(page.getByRole('dialog')).toContainText('Comfortable');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
