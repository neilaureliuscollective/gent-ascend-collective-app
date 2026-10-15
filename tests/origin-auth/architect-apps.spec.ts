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
  throw new Error('Disposable local synthetic Supabase required');

test('authenticated Architect Apps workbench uses the real API and truthful stages', async ({ page }) => {
  await page.goto('/enter');
  await page.getByLabel('Email').fill('founder@aurelius.test');
  await page.getByLabel('Password').fill(env.AURELIUS_FOUNDER_PASSWORD!);
  await page.getByRole('button', { name: 'Enter Aethelios', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/founder$/);
  await page.goto('/app/architect');
  const name = `Synthetic Apps ${Date.now()}`;
  await page.getByLabel('Tell Aethelios what you want to create').fill('Create field notes I can save.');
  await page.getByLabel('Project name (optional)').fill(name);
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'App', exact: true }).click();
  await expect(page.getByRole('heading', { name: /No application yet|Revision/ })).toBeVisible();
  await page.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.getByText(/src\/App\.tsx|Reviewed files/)).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 1 accepted\. Start remains explicit/)).toBeVisible();
  await page.getByRole('button', { name: 'Start approved build' }).click();
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', /preparing|building|checking|failed|cancelled|preview-ready/);
  await page.screenshot({ path: 'test-results/architect-apps-auth-desktop.png', fullPage: true });
  await page.screenshot({ path: 'docs/evidence/architect-apps/workbench-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('button', { name: 'Fold' }).click();
  await page.screenshot({ path: 'test-results/architect-apps-auth-fold.png', fullPage: true });
  await page.screenshot({ path: 'docs/evidence/architect-apps/workbench-fold.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Phone' }).click();
  await page.screenshot({ path: 'test-results/architect-apps-auth-phone.png', fullPage: true });
  await page.screenshot({ path: 'docs/evidence/architect-apps/workbench-phone.png', fullPage: true });
  const cancel = page.getByRole('button', { name: 'Cancel build' });
  if (await cancel.isVisible()) {
    await cancel.click();
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', /cancelled|failed|idle|preview-ready/);
  }
});
