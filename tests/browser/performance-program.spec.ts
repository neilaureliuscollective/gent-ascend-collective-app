import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';
import { programFixture } from '../component-fixture/performance';
import type { Session } from '../../src/domains/performance/schema';
const fixture = componentUrl('/?mode=performance-program');
for (const width of [344, 768, 1440])
  test(`program preparation stays readable and requires acceptance at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const writes: unknown[] = [];
    await page.route('**/api/performance', async (route) => {
      if (route.request().method() === 'POST') writes.push(route.request().postDataJSON());
      await route.abort();
    });
    await page.goto(fixture);
    await expect(page.getByRole('region', { name: 'Training cycle' })).toContainText('Strength A');
    await page.getByRole('button', { name: 'Enter training' }).click();
    await page.getByText('Use a plan or repeating program instead', { exact: true }).click();
    await page.getByRole('button', { name: 'Fewer sets', exact: true }).click();
    await expect(page.getByText('Cable row: 3 → 2 sets')).toBeVisible();
    await expect(page.getByText('No check-in today. Recovery is unknown.')).toBeVisible();
    expect(writes).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath('phase2-preparation.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Choose recovery today' }).click();
    await expect(page.getByRole('heading', { name: 'Make room to recover.' })).toBeVisible();
    expect(writes).toHaveLength(0);
  });
test('accepted program adjustment survives offline reload, syncs once and advances to the next session', async ({
  page,
}) => {
  let online = false,
    version = 0;
  let received: Session | null = null;
  const receipts = new Map<string, number>();
  await page.route('**/api/performance', async (route) => {
    if (!online) return route.abort();
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: {
          ...programFixture,
          program: {
            ...programFixture.program,
            nextSlotId:
              received?.status === 'complete'
                ? programFixture.program!.data.sessions[1]!.id
                : programFixture.program!.nextSlotId,
          },
          sessions: received
            ? [{ data: received, version, updatedAt: new Date().toISOString() }]
            : [],
        },
      });
    const body = route.request().postDataJSON();
    if (!receipts.has(body.requestId)) {
      version++;
      receipts.set(body.requestId, version);
      received = body.payload;
    }
    return route.fulfill({
      json: { owner: programFixture.owner, version: receipts.get(body.requestId) },
    });
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Enter training' }).click();
  await page.getByText('Use a plan or repeating program instead', { exact: true }).click();
  await page.getByRole('button', { name: 'Fewer sets', exact: true }).click();
  await page.getByRole('button', { name: 'Accept & start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Record set 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo set 1', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Training', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo set 1', exact: true })).toBeVisible();
  await page.getByText('What changed for this session', { exact: true }).click();
  await expect(page.getByText('Cable row: 3 → 2 sets')).toBeVisible();
  online = true;
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(page.getByText('Synced to your account', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible();
  await expect(page.getByText('Synced to your account', { exact: true })).toBeVisible();
  const count = receipts.size;
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  expect(receipts.size).toBe(count);
  expect(received).toMatchObject({
    prescription: {
      mode: 'lighter',
      originalPlan: { exercises: [{ sets: 3 }] },
      plan: { exercises: [{ sets: 2 }] },
    },
  });
  await page.getByRole('button', { name: 'Prepare next session' }).click();
  await page.getByText('Use a plan or repeating program instead', { exact: true }).click();
  await expect(page.getByLabel('Session to train')).toHaveValue(
    programFixture.program!.data.sessions[1]!.id,
  );
});
test('program builder stages distinct sessions and retains edits after a conflict', async ({
  page,
}) => {
  let body: unknown;
  await page.route('**/api/performance', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 409,
      json: { error: 'Program changed elsewhere. Reload before deciding.' },
    });
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Edit training program', exact: true }).click();
  await page.getByLabel('Program name').fill('My A / B / C cycle');
  await page.getByRole('button', { name: 'Duplicate', exact: true }).first().click();
  await page.getByLabel('Session name', { exact: true }).fill('Home session C');
  await page.getByRole('button', { name: 'Save training plan', exact: true }).click();
  expect(body).toBeUndefined();
  await page.getByRole('button', { name: 'Save program', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Your training plan' }).getByRole('alert'),
  ).toContainText('Program changed elsewhere');
  await expect(page.getByLabel('Program name')).toHaveValue('My A / B / C cycle');
  await expect(page.getByRole('heading', { name: 'Home session C' })).toBeVisible();
  expect(body).toMatchObject({
    kind: 'program',
    expectedVersion: 1,
    payload: { title: 'My A / B / C cycle' },
  });
});
