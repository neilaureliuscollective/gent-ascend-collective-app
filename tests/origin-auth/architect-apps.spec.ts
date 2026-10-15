import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

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

function workerEnv() {
  return {
    ...process.env,
    ...env,
    ARCHITECT_ORIGIN_ENABLED: 'true',
    ARCHITECT_CONSTRUCT_ENABLED: 'true',
    ARCHITECT_APPS_ENABLED: 'true',
    ARCHITECT_CONSTRUCT_WORKER_TOKEN: env.ARCHITECT_CONSTRUCT_WORKER_TOKEN || 'a'.repeat(32),
    APP_ENV: 'local',
    VERCEL: '',
    VERCEL_ENV: '',
  };
}

async function runAppsWorkerTick() {
  const child = spawn('node', ['scripts/architect-construct-worker.mjs'], {
    env: workerEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (chunk: Buffer) => {
    out += chunk.toString('utf8');
  });
  child.stderr.on('data', (chunk: Buffer) => {
    out += chunk.toString('utf8');
  });
  const code = await new Promise<number>((resolve) => child.on('close', (value) => resolve(value ?? 1)));
  return { code, out };
}

test('connected Architect Apps journey uses Auth, worker, Docker and the compiled iframe', async ({ page, browser }) => {
  test.setTimeout(240000);
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
  const projectUrl = page.url();
  await page.getByRole('button', { name: 'App', exact: true }).click();
  await expect(page.getByRole('heading', { name: /No application yet|Revision/ })).toBeVisible();
  await page.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.locator('code', { hasText: 'src/App.tsx' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('status')).toContainText('Reviewed files are shown');
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 1 accepted\. Start remains explicit/)).toBeVisible();
  await page.getByRole('button', { name: 'Start approved build' }).click();
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', /preparing|building|checking/);

  const first = await runAppsWorkerTick();
  expect(first.code, first.out).toBe(0);
  expect(first.out).toMatch(/"appStatus":"succeeded"|"appIsolation":"docker"/);

  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'preview-ready', { timeout: 180000 });
  await expect(page.getByText(/Compiled preview is ready/)).toBeVisible();
  const frame = page.frameLocator('iframe[title="Private generated application preview"]');
  await expect(frame.getByRole('heading', { name: /field notes/i })).toBeVisible({ timeout: 15000 });

  let dropCreate = true;
  await page.route('**/api/architect-apps/data', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { operation?: string };
    if (dropCreate && body?.operation === 'create') {
      dropCreate = false;
      await route.abort('connectionreset');
      return;
    }
    await route.continue();
  });

  await frame.getByRole('button', { name: /new note/i }).click();
  const form = frame.locator('form');
  await form.locator('input').first().fill('Site visit');
  await form.locator('textarea').fill('North wall');
  await form.locator('input').nth(1).fill('2');
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/The host did not confirm/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Retry keeps the same record|The last edit is still in the form/)).toBeVisible();
  await form.getByRole('button', { name: /retry save/i }).click();
  await expect(frame.getByText(/2h logged/i)).toBeVisible({ timeout: 15000 });
  await form.locator('input').first().fill('Site visit edited');
  await form.locator('input').nth(1).fill('3');
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/3h logged/i)).toBeVisible({ timeout: 15000 });
  await form.locator('input').first().fill('Site visit B');
  await form.locator('input').nth(1).fill('4');
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/4h logged/i)).toBeVisible({ timeout: 15000 });
  await frame.getByRole('button', { name: /^notes$/i }).click();
  await expect(frame.getByRole('button', { name: /site visit b/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Records' })).toBeVisible();
  await page.getByRole('button', { name: 'Records' }).click();
  await expect(page.getByText(/Site visit B/)).toBeVisible();

  await page.getByRole('button', { name: 'Refine' }).click();
  await page.getByLabel('Request').fill('Add an optional tag for office or field notes.');
  await page.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.locator('code', { hasText: 'src/App.tsx' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 2 accepted/)).toBeVisible();
  await page.getByRole('button', { name: 'Start approved build' }).click();
  const second = await runAppsWorkerTick();
  expect(second.code, second.out).toBe(0);
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'preview-ready', { timeout: 180000 });
  await page.getByRole('button', { name: 'Records' }).click();
  await expect(page.getByText(/Site visit B/)).toBeVisible();

  await page.screenshot({ path: 'docs/evidence/architect-apps/workbench-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('button', { name: 'Fold' }).click();
  await page.screenshot({ path: 'docs/evidence/architect-apps/workbench-fold.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Phone' }).click();
  await page.screenshot({ path: 'docs/evidence/architect-apps/workbench-phone.png', fullPage: true });

  const restarted = await browser.newContext();
  const next = await restarted.newPage();
  await next.goto('/enter');
  await next.getByLabel('Email').fill('founder@aurelius.test');
  await next.getByLabel('Password').fill(env.AURELIUS_FOUNDER_PASSWORD!);
  await next.getByRole('button', { name: 'Enter Aethelios', exact: true }).click();
  await expect(next).toHaveURL(/\/app\/founder$/);
  await next.goto(projectUrl);
  await next.getByRole('button', { name: 'App', exact: true }).click();
  await expect(next.locator('[data-stage]')).toHaveAttribute('data-stage', 'preview-ready', { timeout: 30000 });
  const reopened = next.frameLocator('iframe[title="Private generated application preview"]');
  await expect(reopened.getByRole('heading', { name: /field notes/i })).toBeVisible({ timeout: 15000 });
  await expect(reopened.getByRole('button', { name: /site visit b/i })).toBeVisible();
  await next.screenshot({ path: 'docs/evidence/architect-apps/workbench-reopen.png', fullPage: true });
  await restarted.close();

  mkdirSync('docs/evidence/architect-apps', { recursive: true });
  writeFileSync(
    'docs/evidence/architect-apps/connected-journey.json',
    JSON.stringify(
      {
        schema: 'architect-apps-connected-journey/v1',
        projectUrl,
        name,
        worker: { first: first.out.slice(-800), second: second.out.slice(-800) },
        note: 'Signed-in UI journey used real Auth, application APIs, durable records, a new worker process per build, Docker compile and the compiled iframe. Next.js webServer stayed for the session; browser context and worker processes were restarted.',
      },
      null,
      2,
    ),
  );
});
