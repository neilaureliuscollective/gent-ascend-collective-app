import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

function compiledSrcDoc(parentOrigin = '*') {
  return readFileSync('docs/evidence/architect-apps/compiled-preview.html', 'utf8').replace(
    'window.__AETHELIOS_PARENT_ORIGIN__="http://127.0.0.1:3100"',
    `window.__AETHELIOS_PARENT_ORIGIN__=${JSON.stringify(parentOrigin)}`,
  );
}

test('compiled Field Notes bundle mounts in a sandboxed iframe and cannot read parent storage', async ({ page }) => {
  const parentOrigin = 'http://127.0.0.1:3310';
  const srcDoc = compiledSrcDoc(parentOrigin);
  expect(srcDoc).toMatch(/Field notes|createRoot/i);
  expect(srcDoc).toContain('$&');
  expect(srcDoc).not.toContain('</body>/');
  expect(srcDoc).toContain(`window.__AETHELIOS_PARENT_ORIGIN__=${JSON.stringify(parentOrigin)}`);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('http://127.0.0.1:3310/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body style="margin:0;background:#111"><p id="host">parent</p><iframe id="app" sandbox="allow-scripts allow-forms" title="Generated application" style="width:100%;height:720px;border:0;background:#050706"></iframe></body></html>',
    });
  });
  await page.goto('http://127.0.0.1:3310/parent.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('aethelios-parent-secret', 'parent-only');
    sessionStorage.setItem('aethelios-parent-session', 'parent-only');
    const records: Array<Record<string, unknown>> = [];
    const replay = new Map<string, Array<Record<string, unknown>>>();
    (window as unknown as { __APP_RECORDS__: typeof records }).__APP_RECORDS__ = records;
    window.addEventListener('message', (event) => {
      const data = event.data as {
        schema?: string;
        requestId?: string;
        operation?: string;
        payload?: Record<string, unknown>;
        idempotencyKey?: string;
      };
      if (!data || data.schema !== 'architect-apps-data/v1' || !event.source) return;
      const reply = (rows: Array<Record<string, unknown>>, ok = true, error?: string) => {
        (event.source as Window).postMessage(
          { schema: 'architect-apps-data/v1', requestId: data.requestId, ok, records: rows, error },
          '*',
        );
      };
      if (data.operation === 'list') {
        reply(records);
        return;
      }
      if (data.idempotencyKey && replay.has(data.idempotencyKey)) {
        reply(replay.get(data.idempotencyKey) ?? []);
        return;
      }
      if (data.operation === 'create') {
        const record = { ...data.payload, persisted: true };
        records.push(record);
        const stored = [record];
        if (data.idempotencyKey) replay.set(data.idempotencyKey, stored);
        reply(stored);
        return;
      }
      if (data.operation === 'update') {
        const index = records.findIndex((row) => row.id === data.payload?.id);
        const current = index >= 0 ? records[index] : undefined;
        if (!current) {
          reply([], false, 'missing');
          return;
        }
        const stored = [{ ...current, ...data.payload, persisted: true }];
        records[index] = stored[0]!;
        if (data.idempotencyKey) replay.set(data.idempotencyKey, stored);
        reply(stored);
      }
    });
  });
  await page.locator('#app').evaluate((frame, documentSource) => {
    (frame as HTMLIFrameElement).srcdoc = documentSource;
  }, srcDoc);
  const frame = page.frameLocator('#app');
  await expect(frame.getByRole('heading', { name: /field notes/i })).toBeVisible({ timeout: 15000 });
  await expect(frame.getByText(/0h logged/i)).toBeVisible();
  expect(errors.filter((row) => /unexpected identifier|document\.write|\$&/i.test(row))).toEqual([]);

  await frame.getByRole('button', { name: /new note/i }).click();
  const form = frame.locator('form');
  await expect(form).toBeVisible();
  await form.locator('input').first().fill('Site visit');
  await form.locator('textarea').fill('North wall');
  await form.locator('input').nth(1).fill('2');
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/2h logged/i)).toBeVisible({ timeout: 10000 });

  await form.locator('input').first().fill('Site visit edited');
  await form.locator('input').nth(1).fill('3');
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/3h logged/i)).toBeVisible({ timeout: 10000 });
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/3h logged/i)).toBeVisible();
  await form.locator('input').first().fill('Site visit B');
  await form.locator('input').nth(1).fill('4');
  await form.getByRole('button', { name: /save record/i }).click();
  await expect(frame.getByText(/4h logged/i)).toBeVisible({ timeout: 10000 });
  await frame.getByRole('button', { name: /^notes$/i }).click();
  await expect(frame.getByRole('button', { name: /site visit b/i })).toBeVisible();

  const afterCreate = await page.evaluate(() => (window as unknown as { __APP_RECORDS__: Array<{ title?: string; hours?: number }> }).__APP_RECORDS__);
  expect(afterCreate).toHaveLength(1);
  expect(afterCreate[0]?.title).toBe('Site visit B');
  expect(afterCreate[0]?.hours).toBe(4);

  await page.locator('#app').evaluate((frame, documentSource) => {
    (frame as HTMLIFrameElement).srcdoc = documentSource;
  }, srcDoc);
  await expect(frame.getByRole('heading', { name: /field notes/i })).toBeVisible({ timeout: 15000 });
  await expect(frame.getByText(/4h logged/i)).toBeVisible();
  await expect(frame.getByRole('button', { name: /site visit b/i })).toBeVisible();

  const isolation = await page.evaluate(() => {
    const iframe = document.getElementById('app') as HTMLIFrameElement;
    const child = iframe.contentWindow;
    let origin = 'missing';
    let childSawParent = 'threw';
    try {
      origin = child?.origin ?? 'missing';
    } catch (error) {
      origin = error instanceof Error ? error.name : 'blocked';
    }
    try {
      childSawParent = child?.localStorage.getItem('aethelios-parent-secret') ?? 'null';
    } catch (error) {
      childSawParent = error instanceof Error ? error.name : 'threw';
    }
    return {
      origin,
      parentStorage: localStorage.getItem('aethelios-parent-secret'),
      childSawParent,
      contentDocument: iframe.contentDocument ? 'same-origin' : 'unique-origin',
    };
  });
  expect(isolation.parentStorage).toBe('parent-only');
  expect(isolation.contentDocument).toBe('unique-origin');
  expect(isolation.childSawParent === 'parent-only').toBe(false);
  expect(isolation.origin === 'null' || isolation.origin === 'SecurityError' || isolation.childSawParent !== 'parent-only').toBe(true);
  await frame.locator('.shell').screenshot({ path: 'test-results/architect-apps-compiled-mount.png' });
  await frame.locator('.shell').screenshot({ path: 'docs/evidence/architect-apps/compiled-mount.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await frame.locator('.shell').screenshot({ path: 'docs/evidence/architect-apps/compiled-desktop.png' });
  await page.setViewportSize({ width: 768, height: 1024 });
  await frame.locator('.shell').screenshot({ path: 'docs/evidence/architect-apps/compiled-fold.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await frame.locator('.shell').screenshot({ path: 'docs/evidence/architect-apps/compiled-phone.png' });
});
