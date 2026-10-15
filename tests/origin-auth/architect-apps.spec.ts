import { test, expect, type Locator, type Page } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';

test.use({
  viewport: { width: 1440, height: 900 },
});

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

function primaryStatus(target: Page) {
  return target.getByRole('region', { name: 'Application status', exact: true }).locator('.architect-app-status');
}

function buildDiagnostics(target: Page) {
  return target.getByLabel('Build diagnostics', { exact: true });
}

async function openBuildDiagnostics(target: Page) {
  const details = buildDiagnostics(target);
  const toggle = details.getByText('Build details', { exact: true });
  await expect(toggle).toBeVisible();
  if (!(await details.evaluate((node) => node instanceof HTMLDetailsElement && node.open))) {
    await toggle.click();
  }
  await expect(details).toHaveJSProperty('open', true);
}

async function closeBuildDiagnostics(target: Page) {
  const details = buildDiagnostics(target);
  const toggle = details.getByText('Build details', { exact: true });
  if (await details.evaluate((node) => node instanceof HTMLDetailsElement && node.open)) {
    await toggle.click();
  }
  await expect(details).toHaveJSProperty('open', false);
}

function evidenceDir() {
  mkdirSync('test-results/architect-apps-connected', { recursive: true });
  mkdirSync('docs/evidence/architect-apps', { recursive: true });
  return {
    docs: 'docs/evidence/architect-apps',
    connected: 'test-results/architect-apps-connected',
  };
}

async function captureWorkbench(target: Page, name: string) {
  const dirs = evidenceDir();
  await target.screenshot({ path: `${dirs.docs}/${name}.png`, fullPage: true });
  await target.screenshot({ path: `${dirs.connected}/${name}.png`, fullPage: true });
}

async function fillNote(form: Locator, input: { title: string; note: string; hours: string }) {
  await form.getByRole('textbox', { name: 'Title', exact: true }).fill(input.title);
  await form.getByRole('textbox', { name: 'Note', exact: true }).fill(input.note);
  await form.getByRole('textbox', { name: 'Hours', exact: true }).fill(input.hours);
}

async function enableAppsExecutionPolicy() {
  const plane = localControlPlane();
  const response = await fetch(`${plane.url}/rest/v1/rpc/architect_apps_set_execution_policy`, {
    method: 'POST',
    headers: {
      apikey: plane.serviceRoleKey,
      Authorization: `Bearer ${plane.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_enabled: true }),
  });
  if (!response.ok) {
    throw new Error(`Local execution policy could not be enabled (${response.status}). ${await response.text()}`);
  }
}

test('connected Architect Apps journey uses Auth, worker, Docker and the compiled iframe', async ({ page, browser }) => {
  test.setTimeout(300000);
  await enableAppsExecutionPolicy();
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
  const changeDraft = page.getByRole('region', { name: 'Application change draft' });
  const requestField = changeDraft.getByRole('textbox', { name: 'Request', exact: true });
  await page.getByRole('button', { name: 'Request a change' }).click();
  await expect(changeDraft).toBeVisible();
  await expect(requestField).toHaveCount(1);
  await expect(requestField).toBeFocused();
  await requestField.fill('Create field notes I can save.');
  await changeDraft.getByRole('button', { name: 'Close change draft' }).click();
  await expect(page.getByRole('button', { name: 'Request a change' })).toBeFocused();
  await page.getByRole('button', { name: 'Request a change' }).click();
  await expect(requestField).toHaveValue('Create field notes I can save.');
  await expect(changeDraft.getByRole('button', { name: 'Review proposed files' })).toBeEnabled();
  await changeDraft.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.locator('code', { hasText: 'src/App.tsx' })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('code', { hasText: 'src/pages/Board.tsx' })).toHaveCount(0);
  await expect(page.getByText('Reviewed files are shown before approval.')).toBeVisible();
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 1 accepted\. Start remains explicit/)).toBeVisible();
  await expect(primaryStatus(page)).toHaveText('Approved revision 1 recovered');
  await expect(buildDiagnostics(page)).toHaveJSProperty('open', false);
  await openBuildDiagnostics(page);
  await expect(buildDiagnostics(page)).toContainText('Approved revision 1 recovered. Start remains explicit.');
  await closeBuildDiagnostics(page);
  await page.getByRole('button', { name: 'Start approved build' }).click();
  await expect(primaryStatus(page)).toHaveAttribute('data-stage', /preparing|building|checking/);
  await expect(primaryStatus(page)).toHaveText('Building');

  const first = await runAppsWorkerUntilSucceeded();
  expect(first.code, first.out).toBe(0);
  expect(first.out, first.out).toMatch(/"appStatus":"succeeded"/);
  expect(first.out, first.out).toMatch(/"appIsolation":"docker"/);
  expect(first.out).not.toMatch(/"appStatus":"failed"|"appStatus":"cancelled"/);
  await page.getByRole('button', { name: 'Reload receipts' }).click();

  await expect(primaryStatus(page)).toHaveAttribute('data-stage', 'preview-ready', { timeout: 180000 });
  await expect(primaryStatus(page)).toHaveText('Preview ready');
  await expect(buildDiagnostics(page)).toHaveJSProperty('open', false);
  await expect(primaryStatus(page)).not.toContainText('Compiled preview is ready');
  await openBuildDiagnostics(page);
  await expect(buildDiagnostics(page)).toContainText('Compiled preview is ready');
  await expect(buildDiagnostics(page)).toContainText('Labelled development generation is in use');
  await closeBuildDiagnostics(page);
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
  await fillNote(form, { title: 'Site visit A', note: 'North wall', hours: '2' });
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/The host did not confirm/i)).toBeVisible({ timeout: 15000 });
  await expect(primaryStatus(page)).toHaveAttribute('data-stage', 'failed');
  await expect(primaryStatus(page)).toHaveText('Uncertain');
  await openBuildDiagnostics(page);
  await expect(buildDiagnostics(page)).toContainText('The last edit is still in the form');
  await expect(buildDiagnostics(page).locator('[data-flag="uncertain"]')).toHaveText('Retry keeps the same record');
  await closeBuildDiagnostics(page);
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
  await fillNote(form, { title: 'Site visit A edited', note: 'North wall', hours: '3' });
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(primaryStatus(page)).toHaveText('Preview ready', { timeout: 20000 });
  await openBuildDiagnostics(page);
  await expect(buildDiagnostics(page).locator('[data-flag="saved"]')).toHaveText('Record saved');
  await closeBuildDiagnostics(page);
  await expect(frame.getByText(/3h logged/i)).toBeVisible({ timeout: 20000 });
  await frame.getByRole('button', { name: /new note/i }).click();
  await fillNote(form, { title: 'Site visit B', note: 'South gate', hours: '4' });
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/7h logged/i)).toBeVisible({ timeout: 15000 });
  await frame.getByRole('button', { name: /^notes$/i }).click();
  await expect(frame.getByRole('button', { name: /site visit a edited/i })).toBeVisible();
  await expect(frame.getByRole('button', { name: /site visit b/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Records' })).toBeVisible();
  await page.getByRole('button', { name: 'Records' }).click();
  await expect(page.locator('[data-record-title="Site visit A edited"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-record-title="Site visit B"]')).toBeVisible();

  await page.getByRole('button', { name: 'Use' }).click();
  await expect(page.getByRole('button', { name: 'Use' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Inspect' }).click();
  await expect(page.getByRole('button', { name: 'Inspect' })).toHaveAttribute('aria-pressed', 'true');
  await frame.getByRole('heading', { name: /field notes/i }).click();
  await expect(page.getByRole('button', { name: /src\/App\.tsx|Field notes/ })).toBeVisible();
  await page.getByRole('button', { name: 'Explain' }).click();
  await expect(page.getByText(/Host evidence, not a filename guess/)).toBeVisible();
  await page.getByRole('button', { name: 'Change' }).click();
  await expect(changeDraft).toBeVisible();
  await expect(requestField).toHaveValue(/Change src\/App\.tsx in revision/);
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(
    page.getByText(/Comparing does not restore or apply a revision|No current\/previous file difference is available to compare/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept revision' })).toHaveCount(0);
  await changeDraft.getByRole('button', { name: 'Close change draft' }).click();
  await expect(page.getByRole('button', { name: 'Request a change' })).toBeFocused();
  await page.getByRole('button', { name: 'Use' }).click();

  await page.getByRole('button', { name: 'Request a change' }).click();
  await expect(changeDraft).toBeVisible();
  await expect(requestField).toBeFocused();
  await requestField.fill('Add an optional tag for office or field notes.');
  await changeDraft.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.locator('code', { hasText: 'src/App.tsx' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 2 accepted/)).toBeVisible();
  await expect(primaryStatus(page)).toHaveText('Preview ready');
  await page.getByRole('button', { name: 'Start approved build' }).click();
  const second = await runAppsWorkerUntilSucceeded();
  expect(second.code, second.out).toBe(0);
  expect(second.out, second.out).toMatch(/"appStatus":"succeeded"/);
  expect(second.out).not.toMatch(/"appStatus":"failed"|"appStatus":"cancelled"/);
  await page.getByRole('button', { name: 'Reload receipts' }).click();
  await expect(primaryStatus(page)).toHaveAttribute('data-stage', 'preview-ready', { timeout: 180000 });
  await expect(primaryStatus(page)).toHaveText('Preview ready');
  await openBuildDiagnostics(page);
  await expect(buildDiagnostics(page)).toContainText('Compiled preview is ready');
  await closeBuildDiagnostics(page);
  await page.getByRole('button', { name: 'Records' }).click();
  await expect(page.locator('[data-record-title="Site visit A edited"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-record-title="Site visit B"]')).toBeVisible();

  await page.getByRole('button', { name: 'Request a change' }).click();
  await expect(changeDraft).toBeVisible();
  await expect(requestField).toBeFocused();
  await requestField.fill('Break the isolated typecheck so the last good preview stays.');
  await changeDraft.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.locator('code', { hasText: 'src/App.tsx' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 3 accepted/)).toBeVisible();
  await expect(primaryStatus(page)).toHaveText('Preview ready');
  await page.getByRole('button', { name: 'Start approved build' }).click();
  const failed = await runAppsWorkerUntilFailed();
  expect(failed.code, failed.out).toBe(0);
  expect(failed.out, failed.out).toMatch(/"appStatus":"failed"/);
  expect(failed.out).not.toMatch(/"appStatus":"succeeded"/);
  await page.getByRole('button', { name: 'Reload receipts' }).click();
  await expect(primaryStatus(page)).toHaveAttribute('data-stage', 'failed');
  await expect(primaryStatus(page)).toHaveText('Failed · last good preview kept');
  await openBuildDiagnostics(page);
  await expect(buildDiagnostics(page).locator('[data-flag="retained"]')).toHaveText('Last good preview kept');
  await closeBuildDiagnostics(page);
  await expect(frame.getByRole('heading', { name: /field notes/i })).toBeVisible();
  await expect(frame.getByRole('button', { name: /site visit a edited/i })).toBeVisible();
  await expect(frame.getByRole('button', { name: /site visit b/i })).toBeVisible();
  await page.getByRole('button', { name: 'Records' }).click();
  await expect(page.locator('[data-record-title="Site visit B"]')).toBeVisible({ timeout: 15000 });

  evidenceDir();
  await expect(primaryStatus(page)).toHaveText('Failed · last good preview kept');
  await page.waitForTimeout(600);
  await captureWorkbench(page, 'workbench-desktop');
  await page.setViewportSize({ width: 720, height: 900 });
  await page.getByRole('button', { name: 'Fold' }).click();
  await expect(primaryStatus(page)).toBeVisible();
  await page.waitForTimeout(400);
  await captureWorkbench(page, 'workbench-fold');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Phone' }).click();
  await expect(primaryStatus(page)).toHaveText('Failed · last good preview kept');
  await page.waitForTimeout(400);
  await captureWorkbench(page, 'workbench-phone');
  await page.setViewportSize({ width: 344, height: 882 });
  await expect(primaryStatus(page)).toBeVisible();
  await captureWorkbench(page, 'workbench-phone-344');
  await page.setViewportSize({ width: 390, height: 520 });
  await expect(primaryStatus(page)).toBeInViewport();
  await captureWorkbench(page, 'workbench-phone-keyboard');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Desktop' }).click();

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
    await expect(primaryStatus(next)).toHaveAttribute('data-stage', 'failed', { timeout: 30000 });
    await expect(primaryStatus(next)).toHaveText('Failed · last good preview kept');
    await openBuildDiagnostics(next);
    await expect(buildDiagnostics(next).locator('[data-flag="retained"]')).toHaveText('Last good preview kept');
    await closeBuildDiagnostics(next);
    const reopened = next.frameLocator('iframe[title="Private generated application preview"]');
    await expect(reopened.getByRole('heading', { name: /field notes/i })).toBeVisible({ timeout: 15000 });
    await expect(reopened.getByRole('button', { name: /site visit a edited/i })).toBeVisible();
    await expect(reopened.getByRole('button', { name: /site visit b/i })).toBeVisible();
    await next.getByRole('button', { name: 'Records' }).click();
    await expect(next.locator('[data-record-title="Site visit A edited"]')).toBeVisible({ timeout: 15000 });
    await expect(next.locator('[data-record-title="Site visit B"]')).toBeVisible();
    await captureWorkbench(next, 'workbench-reopen');
    await restarted.close();
  } finally {
    replacement.kill('SIGTERM');
  }

  const dirs = evidenceDir();
  const video = page.video();
  const videoPath = video ? await video.path() : null;
  if (videoPath) {
    try {
      copyFileSync(videoPath, `${dirs.docs}/connected-journey.webm`);
      copyFileSync(videoPath, `${dirs.connected}/connected-journey.webm`);
    } catch {
      /* Playwright finalizes the webm when the context closes; CI copies test-results/*.webm afterward. */
    }
  }
  const receipt = JSON.stringify(
    {
      schema: 'architect-apps-connected-journey/v1',
      kind: 'connected-local-acceptance',
      not: ['labelled-visual-fixture', 'hosted-production-proof'],
      generation: 'ARCHITECT_APPS_AI_MOCK=true labelled mocked model transport',
      execution: 'real local Auth, APIs, durable records, packaged worker, isolated Docker compile',
      projectUrl,
      name,
      worker: { first: first.out.slice(-800), second: second.out.slice(-800), failed: failed.out.slice(-800) },
      note: 'Signed-in UI journey used real Auth, application APIs, durable records, the packaged Apps worker image for each tick, Docker compile and the compiled iframe. Model transport is labelled mock. The first create committed, then only the HTTP acknowledgment was dropped and retried with the same operation identity through page fetch so verifyOrigin still ran. A labelled compile-failure revision kept the last good preview. A replacement Next.js process on :3108 reopened that revision and records; the captured :3103 URL could not satisfy the replacement identity check. Playwright did not kill its own webServer. Preview revocation uses shared database sessions, so missing local process state is not authorization.',
    },
    null,
    2,
  );
  writeFileSync(`${dirs.docs}/connected-journey.json`, receipt);
  writeFileSync(`${dirs.connected}/connected-journey.json`, receipt);
});
