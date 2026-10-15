import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { test, expect } from './fixtures';
import { healthFixture } from '../component-fixture/health';
import type { Mutation } from '../../src/domains/health/schema';
const fixture = 'http://127.0.0.1:3102/?mode=health';
if (process.env.HEALTH_OFFLINE_BROWSER === 'true') {
  test.beforeEach(async ({ page }) => {
    await page.route('http://127.0.0.1:3102/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const file = path.startsWith('/assets/')
        ? resolve('validation/health/browser-bundle/assets', basename(path))
        : path === '/'
          ? resolve('validation/health/browser-bundle/index.html')
          : null;
      if (!file) {
        await route.fulfill({ status: 404, body: '' });
        return;
      }
      await route.fulfill({
        body: await readFile(file),
        contentType: file.endsWith('.js')
          ? 'application/javascript'
          : file.endsWith('.css')
            ? 'text/css'
            : 'text/html',
      });
    });
  });
}

for (const width of [344, 390, 768, 1440]) {
  test(`Health workspace layout at ${width}px viewport emulation`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/health', (route) => route.fulfill({ json: healthFixture }));
    await page.goto(fixture);
    await expect(page.getByRole('heading', { name: 'A personal Health workspace' })).toBeVisible();
    await page.getByRole('button', { name: 'Open evening sequence' }).click();
    await expect(
      page.getByRole('heading', { name: 'Finish at 18:00, then cook with a real time limit.' }),
    ).toBeVisible();
    if (width <= 768) {
      await page.getByRole('tab', { name: 'Library' }).click();
      await expect(
        page.getByRole('button', { name: /Evenings, made usable/ }).first(),
      ).toBeVisible();
      await page.getByRole('tab', { name: 'Workspace' }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`health-atelier-${width}.png`),
      fullPage: true,
    });
  });
}
test('evening foundation changes a constraint, accepts, times, saves and resumes', async ({
  page,
}) => {
  const data = structuredClone(healthFixture);
  const writes: Mutation[] = [];
  await page.route('**/api/health', async (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as Mutation;
      writes.push(input);
      if (input.kind === 'workspace_save') {
        data.workspaces = [
          {
            id: input.id,
            foundation: input.foundation,
            title: input.title,
            sample: input.sample,
            version: data.workspaces[0] ? input.expected + 1 : 1,
            workingRevision: 1,
            lastWorkingRevision: 1,
            settings: input.settings,
            progress: input.progress as never,
            architect: null,
            created_at: data.asOf,
            updated_at: data.asOf,
            last_opened_at: data.asOf,
          },
        ];
      }
    }
    await route.fulfill({ json: data });
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Open evening sequence' }).click();
  await page.getByLabel('Available minutes').fill('10');
  await expect(page.getByText('Proposed change', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Accept update' }).click();
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(writes[0]).toMatchObject({ kind: 'workspace_save', foundation: 'evening-routine' });
  await expect(page.getByLabel('Available minutes')).toHaveValue('10');
  await page
    .getByRole('navigation', { name: 'Health workspace' })
    .getByRole('button', { name: 'Bloodwork Tracker' })
    .click();
  await page
    .getByRole('navigation', { name: 'Health workspace' })
    .getByRole('button', { name: /Evenings, made usable/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: /Finish at/ })).toBeVisible();
  await expect(page.getByLabel('Available minutes')).toHaveValue('10');
});
test('synthetic bloodwork stays labelled, inspects sources and reopens a saved view', async ({
  page,
}, info) => {
  const data = structuredClone(healthFixture);
  await page.route('**/api/health', async (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as Mutation;
      if (input.kind === 'workspace_save') {
        data.workspaces = [
          {
            id: input.id,
            foundation: input.foundation,
            title: input.title,
            sample: input.sample,
            version: 1,
            workingRevision: 1,
            lastWorkingRevision: 1,
            settings: input.settings,
            progress: input.progress as never,
            architect: null,
            created_at: data.asOf,
            updated_at: data.asOf,
            last_opened_at: data.asOf,
          },
        ];
      }
    }
    await route.fulfill({ json: data });
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Open Bloodwork Tracker' }).click();
  await expect(
    page.getByText('Sample workspace. These values are synthetic and are not your records.'),
  ).toBeVisible();
  await page.getByRole('button', { name: /LDL cholesterol 128/ }).click();
  await expect(page.getByRole('heading', { name: 'LDL cholesterol' })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Source inspection' })
      .getByText('Synthetic sample laboratory report'),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: info.outputPath('health-bloodwork-1440.png'), fullPage: true });
  await page.getByLabel('Compact density').check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Health workspace' })
    .getByRole('button', { name: 'Evenings, made usable' })
    .click();
  await page
    .getByRole('navigation', { name: 'Health workspace' })
    .getByRole('button', { name: /Bloodwork Tracker/ })
    .first()
    .click();
  await expect(
    page.getByText('Sample workspace. These values are synthetic and are not your records.'),
  ).toBeVisible();
  await expect(page.getByLabel('Compact density')).toBeChecked();
});
test('Architect compile is blocked on the unmerged Apps dependency and keeps the working version', async ({
  page,
}, info) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: healthFixture }));
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Open Bloodwork Tracker' }).click();
  await page.getByRole('button', { name: 'Customize with Architect' }).click();
  await page.getByRole('button', { name: 'Request isolated compile' }).click();
  await expect(page.getByText('Dynamic compilation is blocked', { exact: false })).toBeVisible();
  await expect(page.getByText('9f858d1b5af4df710c4a01dd43668db7366f6626')).toBeVisible();
  await expect(page.getByText('Working revision 1', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: info.outputPath('health-architect-1440.png'), fullPage: true });
});
test('lost workspace save retries the exact request without duplicating', async ({ page }) => {
  const data = structuredClone(healthFixture);
  const writes: Mutation[] = [];
  let fail = true;
  await page.route('**/api/health', async (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as Mutation;
      writes.push(input);
      if (fail) {
        fail = false;
        await route.abort();
        return;
      }
      if (input.kind === 'workspace_save') {
        data.workspaces = [
          {
            id: input.id,
            foundation: input.foundation,
            title: input.title,
            sample: input.sample,
            version: 1,
            workingRevision: 1,
            lastWorkingRevision: 1,
            settings: input.settings,
            progress: input.progress as never,
            architect: null,
            created_at: data.asOf,
            updated_at: data.asOf,
            last_opened_at: data.asOf,
          },
        ];
      }
    }
    await route.fulfill({ json: data });
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Open evening sequence' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('New changes are paused.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Retry exact request' }).click();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});
test('Health lab review preserves exact uncertain request and requires confirmation', async ({
  page,
}) => {
  const data = structuredClone(healthFixture),
    writes: Mutation[] = [];
  let fail = true;
  await page.route('**/api/health', async (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as Mutation;
      writes.push(input);
      if (fail) {
        fail = false;
        await route.abort();
        return;
      }
      if (input.kind === 'confirm') {
        data.records[0]!.status = 'confirmed';
        data.records[0]!.version++;
        data.observations = input.observations.map((o) => ({
          ...o,
          record_id: input.id,
          version: 1,
          status: 'active',
          confirmed_at: data.asOf,
        }));
      }
    }
    await route.fulfill({ json: data });
  });
  await page.goto(`${fixture}&view=records`);
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Review results' }).click();
  await page.getByText('review fields', { exact: false }).click();
  await page.getByLabel('Reported value', { exact: true }).fill('13');
  await page.getByRole('button', { name: 'Confirm reviewed results' }).click();
  await expect(page.getByText('New changes are paused.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm reviewed results' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry exact request' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(data.observations[0]!.value).toBe('13');
});
test('Health permissions withdraw access explicitly and unknown sources do not fabricate connections', async ({
  page,
}) => {
  const data = structuredClone(healthFixture),
    writes: Mutation[] = [];
  await page.route('**/api/health', (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON() as Mutation;
      writes.push(input);
      if (input.kind === 'consent')
        data.consents = data.consents.map((c) =>
          c.purpose === input.purpose
            ? { ...c, granted: input.granted, version: c.version + 1 }
            : c,
        );
    }
    return route.fulfill({ json: data });
  });
  await page.goto(`${fixture}&view=connections`);
  await expect(page.getByText('Apple Health · future', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Withdraw access', exact: true }).first().click();
  await expect(
    page.getByRole('button', { name: 'Allow access', exact: true }).first(),
  ).toBeDisabled();
  expect(writes[0]).toMatchObject({ kind: 'consent', purpose: 'wellness', granted: false });
});
test('Health clears visible private records after account change', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { ...healthFixture, owner: 'another-owner' } }),
  );
  await page.goto(`${fixture}&view=records`);
  await expect(page.getByRole('heading', { name: 'Synthetic laboratory report' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('heading', { name: 'Synthetic laboratory report' })).toHaveCount(0);
  await expect(page.getByText('Your session changed.', { exact: false })).toBeVisible();
});
test('production Health API rejects signed-out writes and page preserves privacy headers', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('no-store');
  const mutation = await request.post('/api/health', {
    data: {
      kind: 'consent',
      request: crypto.randomUUID(),
      purpose: 'records',
      granted: true,
      adult: true,
    },
  });
  expect(mutation.status()).toBe(403);
  const pageResponse = await page.goto('/app/health');
  expect(pageResponse?.headers()['referrer-policy']).toBe('no-referrer');
  await expect(page.getByRole('button', { name: 'Capture', exact: false })).toHaveCount(0);
});
