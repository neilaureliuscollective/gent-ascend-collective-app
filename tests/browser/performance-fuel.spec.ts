import { test, expect } from './fixtures';
import { fuelFixture } from '../component-fixture/performance';
import type { Mutation } from '../../src/domains/performance/schema';
const url = 'http://127.0.0.1:3102/?mode=performance-fuel';
for (const width of [344, 390, 768, 1440])
  test(`fuel capture and evidence at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const data = structuredClone(fuelFixture);
    const writes: Mutation[] = [];
    await page.route('**/api/performance', async (route) => {
      if (route.request().method() === 'POST') {
        const command = route.request().postDataJSON() as Mutation;
        writes.push(command);
        if (command.kind === 'checkin') {
          const record = data.checkins.find((c) => c.data.day === command.payload.day)!;
          record.data = command.payload;
          record.version++;
        }
        await route.fulfill({ json: { version: 2 } });
      } else await route.fulfill({ json: data });
    });
    await page.goto(url);
    await page.getByRole('button', { name: 'Fuel & Body', exact: true }).click();
    await expect(page.getByText('2 complete days with calories', { exact: true })).toBeVisible();
    await expect(
      page.getByText('1 partial intake days are excluded', { exact: false }),
    ).toBeVisible();
    await expect(page.getByText('Weekly average change:', { exact: false })).toBeVisible();
    expect(writes).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath('phase5-fuel.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Record intake & weight' }).click();
    await page.getByLabel('Calories · kcal', { exact: true }).fill('2450');
    await page.getByRole('button', { name: 'These are my full-day totals' }).click();
    await page.getByRole('combobox', { name: /Weight unit/ }).selectOption('kg');
    await expect(page.getByLabel('Body weight', { exact: true })).toHaveValue('81.6');
    await page.getByRole('button', { name: 'Save daily record' }).click();
    await expect(
      page.getByRole('heading', { name: 'See the pattern. Keep the context.' }),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      kind: 'checkin',
      expectedVersion: 1,
      payload: {
        sleepMinutes: 450,
        energy: 4,
        soreness: 'none',
        weight: 81.6,
        unit: 'kg',
        calories: 2450,
        nutritionComplete: true,
      },
    });
    await expect(page.getByText('3 complete days with calories', { exact: true })).toBeVisible();
  });
test('reference conflict retains draft and unchanged retry ID; successful reload and clear', async ({
  page,
}) => {
  const data = structuredClone(fuelFixture);
  const writes: Mutation[] = [];
  await page.route('**/api/performance', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: data });
      return;
    }
    const command = route.request().postDataJSON() as Mutation;
    writes.push(command);
    if (writes.length === 1) {
      await route.fulfill({
        status: 409,
        json: { error: 'Targets changed; reload saved version' },
      });
      return;
    }
    if (command.kind === 'fuel-targets')
      data.fuelTargets = { version: 2, updatedAt: '', data: command.payload };
    await route.fulfill({ json: { version: 2 } });
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Fuel & Body', exact: true }).click();
  await page.getByRole('button', { name: 'Edit my references' }).click();
  await page.getByLabel('Display weight in').selectOption('kg');
  await expect(page.getByLabel('Goal weight', { exact: true })).toHaveValue('79.4');
  await page.getByLabel('Daily calories · kcal').fill('2600');
  await page.getByRole('button', { name: 'Save references', exact: true }).click();
  await expect(page.getByText('Your references are still here.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Daily calories · kcal')).toHaveValue('2600');
  await page.getByRole('button', { name: 'Save references', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'See the pattern. Keep the context.' }),
  ).toBeVisible();
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0]).toMatchObject({
    kind: 'fuel-targets',
    expectedVersion: 1,
    payload: { goalWeight: 79.4, unit: 'kg', calories: 2600 },
  });
  await expect(page.getByText('Your reference: 2,600 kcal', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit my references' }).click();
  for (const label of [
    'Daily calories · kcal',
    'Daily protein · g',
    'Daily water · ml',
    'Goal weight',
  ])
    await page.getByLabel(label, { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save references', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Set my references' })).toBeVisible();
  expect(writes[2]).toMatchObject({
    kind: 'fuel-targets',
    expectedVersion: 2,
    payload: { calories: null, protein: null, waterMl: null, goalWeight: null },
  });
  expect(writes[2]!.requestId).not.toBe(writes[0]!.requestId);
});
test('past-day capture keeps selected date and failed daily save retries exactly', async ({
  page,
}) => {
  const writes: Mutation[] = [];
  await page.route('**/api/performance', async (route) => {
    if (route.request().method() === 'POST') {
      writes.push(route.request().postDataJSON());
      await route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
    } else await route.fulfill({ json: fuelFixture });
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Fuel & Body', exact: true }).click();
  const day = fuelFixture.checkins[1]!.data.day;
  await page.getByLabel('Record date').fill(day);
  await page.getByRole('button', { name: 'Record intake & weight' }).click();
  await page.getByLabel('Calories · kcal', { exact: true }).fill('2100');
  await page.getByRole('button', { name: 'Save daily record' }).click();
  await expect(page.getByText('Your entries are still here.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save daily record' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0]).toMatchObject({ payload: { day, calories: 2100, sleepMinutes: 450 } });
});
