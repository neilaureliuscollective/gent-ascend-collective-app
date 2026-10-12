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
  throw new Error('Local synthetic Supabase required');
test('real signed-in founder saves, reopens and resumes a company mission and decision history', async ({
  page,
  context,
}) => {
  await page.goto('/enter');
  await page.getByLabel('Email').fill('founder@aurelius.test');
  await page.getByLabel('Password').fill(env.AURELIUS_FOUNDER_PASSWORD!);
  await page.getByRole('button', { name: 'Enter Gent Ascend', exact: true }).click();
  await page.goto('/app/founder');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('office.');
  await page.getByRole('button', { name: 'Add a company or project' }).click();
  const company = `Synthetic Founder Journey ${Date.now()}`;
  await page.getByLabel('Company name').fill(company);
  await page
    .getByLabel('Confirmed business context')
    .fill('Synthetic founder acceptance project. No real customer records or financial claims.');
  await page.getByRole('button', { name: 'Confirm and save', exact: true }).click();
  await expect(page.getByLabel('Company or project')).toHaveValue(/^[a-f0-9-]{36}$/);
  await page.getByLabel('Assigned Coworker').selectOption('mara');
  await page
    .getByLabel('What needs to happen?')
    .fill('Prepare a synthetic review of supplied company evidence');
  await page.getByRole('button', { name: 'Save mission', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Mission saved');
  await page.getByRole('link', { name: 'Open or recover saved mission' }).click();
  await page.getByRole('button', { name: /Brief & presentation/ }).click();
  await page.getByLabel('Milestone or task').fill('Verify the source');
  await page.getByLabel('Task objective').fill('Verify the synthetic company context is correct');
  await page.getByLabel('Coworker', { exact: true }).selectOption('mara');
  await page.getByRole('button', { name: 'Save milestone', exact: true }).click();
  await expect(page.getByText('MARA · planned')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm task completed', exact: true }).click();
  await expect(page.getByText('MARA · completed')).toBeVisible();
  await page.getByLabel('Approval title').fill('Publish the synthetic review');
  await page
    .getByLabel('Exact proposed action, target and limits')
    .fill('Synthetic publication proposal. No external publishing occurs in this test.');
  await page.getByRole('button', { name: 'Save for approval', exact: true }).click();
  await page.getByRole('button', { name: 'Reject proposal', exact: true }).click();
  await expect(page.getByText('publishing · rejected')).toBeVisible();
  const savedUrl = page.url();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(savedUrl);
  await reopened.getByRole('button', { name: /Brief & presentation/ }).click();
  await expect(reopened.getByText('MARA · completed')).toBeVisible();
  await expect(reopened.getByText('publishing · rejected')).toBeVisible();
  await reopened.goto('/app/founder');
  await expect(reopened.getByText('Publish the synthetic review')).toBeVisible();
  // This authenticates and persists real records, but makes no paid model call.
});
