import type { Session } from '../../src/domains/performance/schema';
import { test, expect } from './fixtures';
import { performanceFixture } from '../component-fixture/performance';
const fixture = 'http://127.0.0.1:3102/?mode=performance';
for (const width of [344, 768, 1440])
  test(`Performance navigation and workout controls fit ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture);
    await expect(page.getByRole('heading', { name: 'Ascend Performance.' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('performance-today.png'), fullPage: true });
    await page.getByRole('button', { name: 'Enter training' }).click();
    await expect(
      page.getByRole('button', { name: 'Start & keep workout on device' }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Listen. Then decide.' })).toBeVisible();
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'What carries forward.' })).toBeVisible();
  });
test('workout survives reload, retries the same pending request, and finishes once', async ({
  page,
}) => {
  let online = false;
  let version = 0;
  const receipts = new Map<string, number>();
  let received: Session | null = null;
  await page.route('**/api/performance', async (route) => {
    if (!online) {
      await route.abort();
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          ...performanceFixture,
          sessions: received
            ? [{ data: received, version, updatedAt: new Date().toISOString() }]
            : [],
        },
      });
      return;
    }
    const body = route.request().postDataJSON();
    if (!receipts.has(body.requestId)) {
      version++;
      receipts.set(body.requestId, version);
      received = body.payload;
    }
    await route.fulfill({
      json: { version: receipts.get(body.requestId), owner: performanceFixture.owner },
    });
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Enter training' }).click();
  await page.getByRole('button', { name: 'Start & keep workout on device' }).click();
  await page.getByLabel('Set 1 reps').fill('9');
  await page.getByLabel('Set 1 effort').fill('7');
  await page.getByRole('button', { name: 'Record set 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo set 1', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Training', exact: true }).click();
  await expect(page.getByLabel('Set 1 reps')).toHaveValue('9');
  await expect(page.getByRole('button', { name: 'Undo set 1', exact: true })).toBeVisible();
  online = true;
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(page.getByText('Synced to your account', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session complete.' })).toBeVisible();
  await expect(page.getByText('Synced to your account', { exact: true })).toBeVisible();
  const count = receipts.size;
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  expect(receipts.size).toBe(count);
  expect(received).toMatchObject({ status: 'complete', sets: [{ reps: 9 }, {}] });
});
test('stale remote edits retain the local draft and offer explicit reconciliation', async ({
  page,
}) => {
  await page.route('**/api/performance', async (route) =>
    route.fulfill({ status: 409, json: { error: 'This record changed elsewhere.' } }),
  );
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Enter training' }).click();
  await page.getByRole('button', { name: 'Start & keep workout on device' }).click();
  await expect(
    page.getByRole('heading', { name: 'Another version is saved to your account.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export both versions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record set 1', exact: true })).toBeDisabled();
});
test('production routes reject anonymous writes, hostile origins, and cache no private HTML', async ({
  request,
}) => {
  const result = await request.get('/app/performance');
  expect(result.status()).toBe(200);
  expect(result.headers()['cache-control']).toContain('no-store');
  const anonymous = await request.get('/api/performance');
  expect(anonymous.status()).toBe(401);
  const hostile = await request.post('/api/performance', {
    headers: { Origin: 'https://elsewhere.example' },
    data: { kind: 'review', requestId: 'c0000000-0000-4000-8000-000000000030' },
  });
  expect(hostile.status()).toBe(403);
});
test('service worker reopens static training offline without caching account pages', async ({
  page,
  context,
}) => {
  await page.goto('/app/performance');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto('/app/performance');
  await expect(page.getByRole('heading', { name: 'Your practice continues.' })).toBeVisible();
  await expect(
    page.getByText('No workout is saved on this device.', { exact: false }),
  ).toBeVisible();
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const entries = await Promise.all(
      keys.map(async (key) =>
        (await (await caches.open(key)).keys()).map((r) => new URL(r.url).pathname),
      ),
    );
    return entries.flat();
  });
  expect(cached.some((p) => p.startsWith('/api/') || p.startsWith('/app'))).toBe(false);
  await context.setOffline(false);
});
