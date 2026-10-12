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
test('real Auth creation journey: persist Blueprint and editable document, revise, leave and resume', async ({
  page,
}) => {
  await page.goto('/enter');
  await page.getByLabel('Email').fill('founder@aurelius.test');
  await page.getByLabel('Password').fill(env.AURELIUS_FOUNDER_PASSWORD!);
  await page.getByRole('button', { name: 'Enter Aethelios', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/founder$/);
  await page.goto('/app/architect');
  await expect(page.locator('.environment-immersive')).toBeVisible();
  await page.getByRole('button', { name: 'Aethelios menu' }).click();
  await expect(page.getByRole('link', { name: 'Founder Office' })).toBeVisible();
  await page.keyboard.press('Escape');
  const name = `Synthetic Origin ${Date.now()}`;
  await page
    .getByLabel('Tell Aethelios what you want to create')
    .fill('Create a synthetic local business with no real customer information.');
  await page.getByLabel('Project name (optional)').fill(name);
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  const projectUrl = page.url();
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await page.getByLabel('Blueprint section').selectOption('requirements');
  await page
    .getByLabel('Requirements & constraints', { exact: true })
    .fill('Validate audience interviews and supplier quotes before committing funds.');
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 2');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page.getByText(/AI generation and live research are unavailable/)).toBeVisible();
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page.getByRole('button', { name: 'Create from approved Blueprint' }).click();
  await expect(page.getByLabel('Editable Markdown')).toContainText('supplier quotes');
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 3');
  await page
    .getByLabel('Editable Markdown')
    .fill(
      '# Synthetic revised plan\n\nValidate supplier quality and a conservative launch budget.',
    );
  await page.getByRole('button', { name: 'Mark reviewed & approved in draft' }).click();
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 4');
  await page.getByRole('button', { name: 'Aethelios menu' }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Work', exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/work$/);
  await expect(page.locator('.environment-immersive')).toHaveCount(0);
  await page.goto(projectUrl);
  await expect(page.getByRole('status')).toContainText('Resumed revision 4');
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page
    .getByLabel('Selected document')
    .selectOption({ label: `${name} — Business plan · approved` });
  await expect(page.getByLabel('Editable Markdown')).toContainText('conservative launch budget');
  for (const width of [390, 720, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector('.origin-workspace')?.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `test-results/architect-origin-real-workspace-${width}.png`,
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Focus canvas', exact: true }).click();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('article', { name: 'Document preview' }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/architect-origin-real-document-${width}.png`,
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await page.getByRole('button', { name: 'Show Aethelios tools', exact: true }).click();
    await page.getByRole('button', { name: 'Aethelios menu' }).click();
    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Health', exact: true }),
    ).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Aethelios', exact: true })).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Council ↗', exact: true })).toBeInViewport();
    await page.screenshot({
      path: `test-results/architect-immersive-real-menu-${width}.png`,
      fullPage: false,
    });
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page
    .getByLabel('Editable Markdown')
    .fill('# Unsaved local draft\n\nKeep this when navigation is declined.');
  const draftUrl = page.url();
  await page.getByRole('button', { name: 'Aethelios menu' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Aethelios', exact: true }).click();
  await expect(page).toHaveURL(draftUrl);
  await expect(page.getByRole('dialog', { name: 'Your Aethelios environments' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Editable Markdown')).toContainText(
    'Keep this when navigation is declined.',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await expect(page.getByLabel('Editable Markdown')).toContainText('conservative launch budget');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('button', { name: /Revision 1 —/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-origin-real-auth.png', fullPage: true });
});
