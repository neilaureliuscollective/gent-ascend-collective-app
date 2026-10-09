import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';
import { movementFixture } from '../component-fixture/performance';
import type { Mutation } from '../../src/domains/performance/schema';
const url = componentUrl('/?mode=performance-movement');
for (const width of [344, 390, 768, 1440])
  test(`Movement record round trip at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const data = structuredClone(movementFixture);
    const writes: Mutation[] = [];
    await page.route('**/api/performance', async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: data });
      const command = route.request().postDataJSON() as Mutation;
      writes.push(command);
      if (command.kind === 'movement')
        data.movements!.push({ version: 1, updatedAt: '', data: command.payload });
      await route.fulfill({ json: { version: 1 } });
    });
    await page.goto(url);
    await page.getByRole('button', { name: 'Movement', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Seven-day movement' })).toContainText('20 min');
    expect(writes).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('phase7-movement.png'), fullPage: true });
    await page.getByRole('button', { name: 'Record activity', exact: true }).click();
    await page.getByRole('combobox', { name: 'Activity', exact: true }).selectOption('cycle');
    await page.getByLabel('Duration · minutes').fill('30');
    await page.getByLabel('Distance · optional').fill('2');
    await page.getByLabel('Distance unit').selectOption('km');
    await expect(page.getByLabel('Distance · optional')).toHaveValue('3.22');
    await page.getByRole('button', { name: 'Save activity', exact: true }).click();
    expect(writes[0]).toMatchObject({
      kind: 'movement',
      expectedVersion: 0,
      payload: { kind: 'cycle', minutes: 30, distance: 3.22, unit: 'km', intensity: null },
    });
    await expect(page.getByRole('region', { name: 'Seven-day movement' })).toContainText('50 min');
    await expect(page.getByRole('region', { name: 'Activity history' })).toContainText('3.22 km');
  });
test('Movement retry is exact, mobility clears cardio fields, and removal retains saved values', async ({
  page,
}) => {
  const data = structuredClone(movementFixture);
  const writes: Mutation[] = [];
  await page.route('**/api/performance', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: data });
    const command = route.request().postDataJSON() as Mutation;
    writes.push(command);
    if (writes.length === 1)
      return route.fulfill({ status: 409, json: { error: 'Record changed' } });
    if (command.kind === 'movement') {
      const row = data.movements!.find((r) => r.data.id === command.payload.id);
      if (row) {
        row.data = command.payload;
        row.version++;
      } else data.movements!.push({ version: 1, updatedAt: '', data: command.payload });
    }
    await route.fulfill({ json: { version: 1 } });
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Movement', exact: true }).click();
  await page.getByRole('button', { name: 'Record activity', exact: true }).click();
  await page.getByLabel('Distance · optional').fill('3');
  await page.getByLabel('Intensity · self-reported').selectOption('moderate');
  await page.getByRole('combobox', { name: 'Activity', exact: true }).selectOption('mobility');
  await page.getByLabel('Activity note · optional').fill('Evening practice');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(page.getByText('Your entry is still here.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0]).toMatchObject({
    payload: { kind: 'mobility', distance: null, intensity: null },
  });
  await page
    .getByRole('region', { name: 'Activity history' })
    .locator('li')
    .filter({ hasText: 'Evening practice' })
    .getByRole('button')
    .click();
  await page.getByLabel('Duration · minutes').fill('99');
  await page.getByRole('button', { name: 'Remove activity', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  expect(writes[2]).toMatchObject({ expectedVersion: 1, payload: { minutes: 20, voided: true } });
  await expect(page.getByRole('region', { name: 'Activity history' })).not.toContainText(
    'Evening practice',
  );
});
test('Library replacement previews before save and starts a separate manual identity', async ({
  page,
}, info) => {
  const writes: Mutation[] = [];
  await page.route('**/api/performance', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: movementFixture });
    writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { version: 2 } });
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Edit training plan', exact: true }).click();
  await page.getByRole('button', { name: 'Replace movement 1 from library', exact: true }).click();
  await page.getByLabel('Search exercises').fill('Goblet');
  await page.getByRole('button', { name: /Goblet squat/ }).click();
  expect(writes).toHaveLength(0);
  await page.screenshot({ path: info.outputPath('phase7-library.png'), fullPage: true });
  await page.getByRole('button', { name: 'Use Goblet squat', exact: true }).click();
  await expect(page.getByLabel('Exercise 1 progression')).toHaveValue('manual');
  await page.getByRole('button', { name: 'Save training plan', exact: true }).click();
  expect(writes[0]).toMatchObject({
    kind: 'plan',
    payload: { exercises: [{ name: 'Goblet squat', load: 0, progression: 'manual' }] },
  });
  if (writes[0]?.kind === 'plan')
    expect(writes[0].payload.exercises[0]!.id).not.toBe(
      movementFixture.plan!.data.exercises[0]!.id,
    );
});
