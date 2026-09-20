// Required real-Supabase gate. Run against a fresh synthetic local reset only.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== '127.0.0.1')
  throw new Error('Local Supabase required');
test('founder can save a profile and goal without paid membership, then retain completed history', async ({
  page,
  context,
}) => {
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/');
  await page.goto('/dev');
  await page.getByLabel('Membership scenario').selectOption('free');
  await page.getByLabel('Billing simulation').selectOption('none');
  await page.getByRole('button', { name: 'Apply scenario' }).click();
  await expect(page.getByRole('status')).toHaveText('Scenario saved.');
  await page.goto('/you');
  const stale = await context.newPage();
  await stale.goto('/you');
  await page.getByLabel('What should we call you?').fill('Founder');
  await page.getByLabel('What matters most right now?').fill('Make room for deliberate progress.');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved.');
  await stale.getByLabel('What should we call you?').fill('Stale name');
  await stale.getByRole('button', { name: 'Save profile' }).click();
  await expect(stale.getByRole('alert')).toContainText('changed in another session');
  await stale.close();
  await page.reload();
  await expect(page.getByLabel('What matters most right now?')).toHaveValue(
    'Make room for deliberate progress.',
  );
  await page.goto('/goals');
  await expect(page.getByRole('form', { name: 'Create goal' })).toBeVisible();
  await page.getByLabel('What are you working toward?').fill('Synthetic founder goal');
  await page.getByLabel('Your next concrete step').fill('Plan tomorrow deliberately.');
  await page.getByRole('button', { name: 'Set my goal' }).click();
  await expect(page.getByRole('form', { name: 'Edit goal' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Your next concrete step')).toHaveValue(
    'Plan tomorrow deliberately.',
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Synthetic founder goal' })).toBeVisible();
  await expect(page.getByText('Plan tomorrow deliberately.', { exact: true })).toBeVisible();
  await page.goto('/goals');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByRole('button', { name: 'Confirm completion' }).click();
  await expect(page.getByRole('form', { name: 'Create goal' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Synthetic founder goal' })).toBeVisible();
  await expect(page.locator('.goal-history').getByText('Completed', { exact: true })).toBeVisible();
});
