import { test, expect } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
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

function localControlPlane() {
  const status = JSON.parse(
    execFileSync('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' }),
  ) as { API_URL?: string; SERVICE_ROLE_KEY?: string };
  if (!status.API_URL || !status.SERVICE_ROLE_KEY) throw new Error('Local Supabase control plane unavailable.');
  if (new URL(status.API_URL).hostname !== '127.0.0.1') throw new Error('Loopback Supabase required for the Apps worker.');
  return { url: status.API_URL, serviceRoleKey: status.SERVICE_ROLE_KEY };
}

function workerEnv(workerId = 'apps-connected'): NodeJS.ProcessEnv {
  const plane = localControlPlane();
  const next = { ...process.env, ...env };
  delete next.VERCEL;
  delete next.VERCEL_ENV;
  return {
    ...next,
    PATH: process.env.PATH,
    NODE_ENV: 'development',
    APP_ENV: 'local',
    NEXT_PUBLIC_SUPABASE_URL: plane.url,
    SUPABASE_SERVICE_ROLE_KEY: plane.serviceRoleKey,
    ARCHITECT_ORIGIN_ENABLED: 'true',
    ARCHITECT_CONSTRUCT_ENABLED: 'true',
    ARCHITECT_APPS_ENABLED: 'true',
    ARCHITECT_CONSTRUCT_STORE: 'database',
    ARCHITECT_CONSTRUCT_WORKER_TOKEN: env.ARCHITECT_CONSTRUCT_WORKER_TOKEN || 'x'.repeat(32),
    ARCHITECT_CONSTRUCT_WORKER_ID: workerId,
    ARCHITECT_APPS_WORKER_ID: workerId,
  } as NodeJS.ProcessEnv;
}

async function runAppsWorkerTick(workerId?: string) {
  const workRoot = process.env.ARCHITECT_APPS_WORK_ROOT || '/tmp/architect-apps-work';
  mkdirSync(workRoot, { recursive: true });
  const child = spawn('node', ['scripts/architect-apps-packaged-worker.mjs', '--once'], {
    env: {
      ...workerEnv(workerId),
      ARCHITECT_APPS_WORK_ROOT: workRoot,
      ARCHITECT_APPS_REQUIRE_ISOLATION: 'true',
      ARCHITECT_APPS_IMAGE: process.env.ARCHITECT_APPS_IMAGE || 'aethelios-architect-apps:2026-10-15.1',
    },
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

async function runAppsWorkerUntilSucceeded() {
  let last = { code: 1, out: '' };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    last = await runAppsWorkerTick();
    if (last.code === 0 && /"appStatus":"succeeded"/.test(last.out) && /"appIsolation":"docker"/.test(last.out)) {
      return last;
    }
  }
  return last;
}

async function runAppsWorkerUntilFailed() {
  let last = { code: 1, out: '' };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    last = await runAppsWorkerTick();
    if (last.code === 0 && /"appStatus":"failed"/.test(last.out) && !/"appStatus":"succeeded"/.test(last.out)) {
      return last;
    }
  }
  return last;
}

function appsServerEnv(processId: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...env,
    PATH: process.env.PATH,
    NODE_ENV: 'development',
    APP_ENV: 'local',
    ARCHITECT_ORIGIN_ENABLED: 'true',
    ARCHITECT_ORIGIN_AI_ENABLED: 'false',
    ARCHITECT_APPS_ENABLED: 'true',
    ARCHITECT_APPS_AI_MOCK: 'true',
    ARCHITECT_APPS_PREVIEW_SECRET: env.ARCHITECT_APPS_PREVIEW_SECRET || 'origin-apps-preview-secret-key',
    ARCHITECT_APPS_PROCESS_ID: processId,
  } as NodeJS.ProcessEnv;
}

async function readAppRuntime(target: import('@playwright/test').Page) {
  const projectId = new URL(target.url()).searchParams.get('project');
  if (!projectId) throw new Error('Project identity missing from the Architect URL.');
  return target.evaluate(async (id) => {
    const response = await fetch(`/api/architect-apps?project=${id}`, { credentials: 'same-origin' });
    const body = (await response.json()) as { runtime?: { processId?: string } };
    return {
      status: response.status,
      processId: body.runtime?.processId ?? null,
      origin: window.location.origin,
    };
  }, projectId);
}

async function waitForUrl(url: string, child: ChildProcess, timeoutMs = 60000, logs?: { text: string }) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode != null)
      throw new Error(`Replacement application server exited ${child.exitCode}. ${(logs?.text ?? '').slice(-1200)}`);
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status > 0) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new Error(`Replacement application server did not start at ${url}.`);
}

test('connected Architect Apps journey uses Auth, worker, Docker and the compiled iframe', async ({ page, browser }) => {
  test.setTimeout(300000);
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
  await page.getByLabel('Request').fill('Create field notes I can save.');
  await expect(page.getByRole('button', { name: 'Review proposed files' })).toBeEnabled();
  await page.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.locator('code', { hasText: 'src/App.tsx' })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('code', { hasText: 'src/pages/Board.tsx' })).toHaveCount(0);
  await expect(page.getByText('Reviewed files are shown before approval.')).toBeVisible();
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 1 accepted\. Start remains explicit/)).toBeVisible();
  await page.getByRole('button', { name: 'Start approved build' }).click();
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', /preparing|building|checking/);

  const first = await runAppsWorkerUntilSucceeded();
  expect(first.code, first.out).toBe(0);
  expect(first.out, first.out).toMatch(/"appStatus":"succeeded"/);
  expect(first.out, first.out).toMatch(/"appIsolation":"docker"/);
  expect(first.out).not.toMatch(/"appStatus":"failed"|"appStatus":"cancelled"/);
  await page.getByRole('button', { name: 'Reload receipts' }).click();

  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'preview-ready', { timeout: 180000 });
  await expect(page.getByText(/Compiled preview is ready/)).toBeVisible();
  const frame = page.frameLocator('iframe[title="Private generated application preview"]');
  await expect(frame.getByRole('heading', { name: /field notes/i })).toBeVisible({ timeout: 15000 });

  let dropCreateAck = true;
  const capturedCreate: { body?: Record<string, unknown> } = {};
  await page.route('**/api/architect-apps/data', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (dropCreateAck && body?.operation === 'create') {
      dropCreateAck = false;
      capturedCreate.body = body;
      const response = await route.fetch();
      if (!response.ok()) {
        await route.fulfill({
          status: response.status(),
          headers: response.headers(),
          body: await response.text(),
        });
        return;
      }
      await route.abort('connectionreset');
      return;
    }
    await route.continue();
  });

  await frame.getByRole('button', { name: /new note/i }).click();
  const form = frame.locator('form');
  await form.locator('input').first().fill('Site visit A');
  await form.locator('textarea').fill('North wall');
  await form.locator('input').nth(1).fill('2');
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/The host did not confirm/i)).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-stage="failed"]')).toContainText('The last edit is still in the form');
  await expect(page.locator('[data-flag="uncertain"]')).toHaveText('Retry keeps the same record');
  await form.getByRole('button', { name: /retry save/i }).click();
  await expect(frame.getByText(/2h logged/i)).toBeVisible({ timeout: 15000 });
  if (!capturedCreate.body || typeof capturedCreate.body.idempotencyKey !== 'string') {
    throw new Error('Committed create did not keep an operation identity.');
  }
  const changedIdentity = await page.evaluate(async (body) => {
    const response = await fetch('/api/architect-apps/data', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, text: await response.text() };
  }, {
    ...capturedCreate.body,
    requestId: crypto.randomUUID(),
    payload: { ...(capturedCreate.body.payload as Record<string, unknown>), title: 'Should not revert' },
  });
  expect(changedIdentity.status, changedIdentity.text).toBe(409);
  await form.locator('input').first().fill('Site visit A edited');
  await form.locator('input').nth(1).fill('3');
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(page.locator('[data-flag="saved"]')).toBeVisible({ timeout: 20000 });
  await expect(frame.getByText(/3h logged/i)).toBeVisible({ timeout: 20000 });
  await frame.getByRole('button', { name: /new note/i }).click();
  await form.locator('input').first().fill('Site visit B');
  await form.locator('textarea').fill('South gate');
  await form.locator('input').nth(1).fill('4');
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/7h logged/i)).toBeVisible({ timeout: 15000 });
  await frame.getByRole('button', { name: /^notes$/i }).click();
  await expect(frame.getByRole('button', { name: /site visit a edited/i })).toBeVisible();
  await expect(frame.getByRole('button', { name: /site visit b/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Records' })).toBeVisible();
  await page.getByRole('button', { name: 'Records' }).click();
  await expect(page.locator('[data-record-title="Site visit A edited"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-record-title="Site visit B"]')).toBeVisible();

  await page.getByRole('button', { name: 'Refine' }).click();
  await page.getByLabel('Request').fill('Add an optional tag for office or field notes.');
  await page.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.locator('code', { hasText: 'src/App.tsx' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 2 accepted/)).toBeVisible();
  await page.getByRole('button', { name: 'Start approved build' }).click();
  const second = await runAppsWorkerUntilSucceeded();
  expect(second.code, second.out).toBe(0);
  expect(second.out, second.out).toMatch(/"appStatus":"succeeded"/);
  expect(second.out).not.toMatch(/"appStatus":"failed"|"appStatus":"cancelled"/);
  await page.getByRole('button', { name: 'Reload receipts' }).click();
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'preview-ready', { timeout: 180000 });
  await page.getByRole('button', { name: 'Records' }).click();
  await expect(page.locator('[data-record-title="Site visit A edited"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-record-title="Site visit B"]')).toBeVisible();

  if (!(await page.getByLabel('Request').isVisible())) {
    await page.getByRole('button', { name: 'Refine' }).click();
  }
  await page.getByLabel('Request').fill('Break the isolated typecheck so the last good preview stays.');
  await page.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.locator('code', { hasText: 'src/App.tsx' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 3 accepted/)).toBeVisible();
  await page.getByRole('button', { name: 'Start approved build' }).click();
  const failed = await runAppsWorkerUntilFailed();
  expect(failed.code, failed.out).toBe(0);
  expect(failed.out, failed.out).toMatch(/"appStatus":"failed"/);
  expect(failed.out).not.toMatch(/"appStatus":"succeeded"/);
  await page.getByRole('button', { name: 'Reload receipts' }).click();
  await expect(page.locator('[data-flag="retained"]')).toHaveText('Last good preview kept');
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'failed');
  await expect(frame.getByRole('heading', { name: /field notes/i })).toBeVisible();
  await expect(frame.getByRole('button', { name: /site visit a edited/i })).toBeVisible();
  await expect(frame.getByRole('button', { name: /site visit b/i })).toBeVisible();
  await page.getByRole('button', { name: 'Records' }).click();
  await expect(page.locator('[data-record-title="Site visit B"]')).toBeVisible({ timeout: 15000 });

  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/architect-apps/workbench-desktop.png', fullPage: true });
  await page.screenshot({ path: 'test-results/architect-apps-workbench-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('button', { name: 'Fold' }).click();
  await page.screenshot({ path: 'docs/evidence/architect-apps/workbench-fold.png', fullPage: true });
  await page.screenshot({ path: 'test-results/architect-apps-workbench-fold.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Phone' }).click();
  await page.screenshot({ path: 'docs/evidence/architect-apps/workbench-phone.png', fullPage: true });
  await page.screenshot({ path: 'test-results/architect-apps-workbench-phone.png', fullPage: true });

  const originalOrigin = new URL(page.url()).origin;
  const projectPath = `${new URL(page.url()).pathname}${new URL(page.url()).search}`;
  expect(originalOrigin).toBe('http://127.0.0.1:3103');
  expect(new URL(projectUrl).origin).toBe(originalOrigin);
  const originalRuntime = await readAppRuntime(page);
  expect(originalRuntime.status).toBe(200);
  expect(originalRuntime.processId).toBe('origin-apps-3103');
  const replacementId = `replacement-apps-3108-${Date.now()}`;
  const restartedWorkerId = `apps-restarted-${Date.now()}`;
  const replacementLogs = { text: '' };
  const replacement = spawn('npm', ['run', 'dev', '--', '--port', '3108'], {
    env: { ...appsServerEnv(replacementId), NEXT_DIST_DIR: '.next-apps-3108' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  replacement.stdout.on('data', (chunk: Buffer) => {
    replacementLogs.text += chunk.toString('utf8');
  });
  replacement.stderr.on('data', (chunk: Buffer) => {
    replacementLogs.text += chunk.toString('utf8');
  });
  try {
    await waitForUrl('http://127.0.0.1:3108/enter', replacement, 60000, replacementLogs);
    const stillOriginal = await readAppRuntime(page);
    expect(stillOriginal.origin).toBe(originalOrigin);
    expect(stillOriginal.processId).toBe(originalRuntime.processId);
    const restartedWorker = await runAppsWorkerTick(restartedWorkerId);
    expect(restartedWorker.code, restartedWorker.out).toBe(0);
    const restarted = await browser.newContext({ baseURL: 'http://127.0.0.1:3108' });
    const next = await restarted.newPage();
    await next.goto('/enter');
    await next.getByLabel('Email').fill('founder@aurelius.test');
    await next.getByLabel('Password').fill(env.AURELIUS_FOUNDER_PASSWORD!);
    await next.getByRole('button', { name: 'Enter Aethelios', exact: true }).click();
    await expect(next).toHaveURL(/\/app\/founder$/);
    await next.goto(projectPath);
    expect(new URL(next.url()).origin).toBe('http://127.0.0.1:3108');
    expect(new URL(next.url()).origin).not.toBe(originalOrigin);
    expect(new URL(next.url()).origin).not.toBe(new URL(projectUrl).origin);
    const replacementRuntime = await readAppRuntime(next);
    expect(replacementRuntime.status).toBe(200);
    expect(replacementRuntime.origin).toBe('http://127.0.0.1:3108');
    expect(replacementRuntime.processId).toBe(replacementId);
    expect(replacementRuntime.processId).not.toBe(originalRuntime.processId);
    await next.getByRole('button', { name: 'App', exact: true }).click();
    await expect(next.locator('[data-stage]')).toHaveAttribute('data-stage', 'failed', { timeout: 30000 });
    await expect(next.locator('[data-flag="retained"]')).toHaveText('Last good preview kept');
    const reopened = next.frameLocator('iframe[title="Private generated application preview"]');
    await expect(reopened.getByRole('heading', { name: /field notes/i })).toBeVisible({ timeout: 15000 });
    await expect(reopened.getByRole('button', { name: /site visit a edited/i })).toBeVisible();
    await expect(reopened.getByRole('button', { name: /site visit b/i })).toBeVisible();
    await next.getByRole('button', { name: 'Records' }).click();
    await expect(next.locator('[data-record-title="Site visit A edited"]')).toBeVisible({ timeout: 15000 });
    await expect(next.locator('[data-record-title="Site visit B"]')).toBeVisible();
    await next.screenshot({ path: 'docs/evidence/architect-apps/workbench-reopen.png', fullPage: true });
    await next.screenshot({ path: 'test-results/architect-apps-workbench-reopen.png', fullPage: true });
    await restarted.close();
  } finally {
    replacement.kill('SIGTERM');
  }

  mkdirSync('docs/evidence/architect-apps', { recursive: true });
  writeFileSync(
    'docs/evidence/architect-apps/connected-journey.json',
    JSON.stringify(
      {
        schema: 'architect-apps-connected-journey/v1',
        projectUrl,
        name,
        worker: { first: first.out.slice(-800), second: second.out.slice(-800), failed: failed.out.slice(-800) },
        note: 'Signed-in UI journey used real Auth, application APIs, durable records, the packaged Apps worker image for each tick, Docker compile and the compiled iframe. The first create committed, then only the HTTP acknowledgment was dropped and retried with the same operation identity through page fetch so verifyOrigin still ran. A labelled compile-failure revision kept the last good preview. A replacement Next.js process on :3108 reopened that revision and records; the captured :3103 URL could not satisfy the replacement identity check. Playwright did not kill its own webServer. Preview revocation uses shared database sessions, so missing local process state is not authorization.',
      },
      null,
      2,
    ),
  );
});
