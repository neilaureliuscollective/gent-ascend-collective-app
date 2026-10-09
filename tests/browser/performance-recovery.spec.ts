import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';
import { recoveryFixture } from '../component-fixture/performance';
import type { Mutation } from '../../src/domains/performance/schema';
const url = componentUrl('/?mode=performance-recovery');
for (const width of [344, 390, 768, 1440])
  test(`recovery capture and next-day evidence at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const data = structuredClone(recoveryFixture);
    const writes: Mutation[] = [];
    await page.route('**/api/performance', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: data });
        return;
      }
      const command = route.request().postDataJSON() as Mutation;
      writes.push(command);
      if (command.kind === 'checkin') {
        const record = data.checkins.find((c) => c.data.day === command.payload.day)!;
        record.data = command.payload;
        record.version++;
      }
      await route.fulfill({ json: { version: 2 } });
    });
    await page.goto(url);
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Seven-day recovery' })).toContainText(
      '3/7 days recorded',
    );
    await expect(page.getByRole('region', { name: "Yesterday's follow-through" })).toContainText(
      'Follow-through: Not recorded',
    );
    expect(writes).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath('phase6-recovery.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Record recovery', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Recovery and sleep', exact: true }),
    ).toBeFocused();
    await page.getByLabel('Sleep · hours', { exact: true }).fill('6.5');
    await page.getByRole('button', { name: '2 · Low', exact: true }).click();
    await page.getByRole('button', { name: 'Mild soreness', exact: true }).click();
    await page.getByRole('button', { name: 'Save recovery check-in' }).click();
    await expect(page.getByRole('heading', { name: 'Make room to recover.' })).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      kind: 'checkin',
      expectedVersion: 1,
      payload: {
        sleepMinutes: 390,
        energy: 2,
        soreness: 'mild',
        calories: 2300,
        protein: 140,
        waterMl: 2200,
        weight: 180,
        unit: 'lb',
        nutritionComplete: false,
      },
    });
    await expect(page.getByRole('region', { name: "Yesterday's follow-through" })).toContainText(
      'Sleep 6.5 h',
    );
  });
test('routine conflict retains draft; exact retry saves once and reloads the chosen practice', async ({
  page,
}) => {
  const data = structuredClone(recoveryFixture);
  const writes: Mutation[] = [];
  await page.route('**/api/performance', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: data });
      return;
    }
    const command = route.request().postDataJSON() as Mutation;
    writes.push(command);
    if (writes.length === 1) {
      await route.fulfill({ status: 409, json: { error: 'Record changed' } });
      return;
    }
    if (command.kind === 'recovery-routine')
      data.recoveryRoutines!.push({ version: 1, updatedAt: '', data: command.payload });
    await route.fulfill({ json: { version: 1 } });
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByRole('button', { name: 'Choose today’s practice' }).click();
  await page.getByRole('button', { name: 'Screen break', exact: true }).click();
  await page.getByLabel('Minutes to set aside').fill('20');
  await page.getByLabel('Your cue · optional').fill('After my shift');
  await page.getByRole('button', { name: 'Save practice', exact: true }).click();
  await expect(page.getByText('Your draft is still here.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Your cue · optional')).toHaveValue('After my shift');
  await page.getByRole('button', { name: 'Save practice', exact: true }).click();
  await expect(page.getByRole('region', { name: "Today's recovery practice" })).toContainText(
    'Screen break',
  );
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0]).toMatchObject({
    kind: 'recovery-routine',
    expectedVersion: 0,
    payload: {
      day: data.today,
      action: 'screen-break',
      minutes: 20,
      cue: 'After my shift',
      outcome: null,
    },
  });
});
test('follow-through changes only the past report; missing next-day records remain explicit', async ({
  page,
}) => {
  const data = structuredClone(recoveryFixture);
  const writes: Mutation[] = [];
  await page.route('**/api/performance', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: data });
      return;
    }
    const command = route.request().postDataJSON() as Mutation;
    writes.push(command);
    if (command.kind === 'recovery-routine') {
      const row = data.recoveryRoutines!.find((r) => r.data.day === command.payload.day)!;
      row.data = command.payload;
      row.version++;
    }
    await route.fulfill({ json: { version: 2 } });
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByRole('button', { name: 'Review yesterday’s practice' }).click();
  await expect(page.getByLabel('Minutes to set aside')).toHaveCount(0);
  await page.getByRole('button', { name: 'Partly', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Save follow-through' }).click();
  expect(writes[0]).toMatchObject({
    kind: 'recovery-routine',
    expectedVersion: 1,
    payload: { ...recoveryFixture.recoveryRoutines![0]!.data, outcome: 'partial' },
  });
  await expect(page.getByRole('region', { name: "Yesterday's follow-through" })).toContainText(
    'Follow-through: Partly',
  );
  await page.getByText('Recovery history (2)', { exact: true }).click();
  // The older plan's following day has a fixture check-in; remove that record in a new fixture read.
  data.checkins = data.checkins.filter((c) => c.data.day !== recoveryFixture.checkins[2]!.data.day);
  await page.getByRole('button', { name: 'Review yesterday’s practice' }).click();
  await page.getByRole('button', { name: 'Not recorded', exact: true }).click();
  await page.getByRole('button', { name: 'Save follow-through' }).click();
  // Focused editing preserves the already-expanded history in the underlying world.
  await expect(page.locator('details').filter({ hasText: 'Recovery history (2)' })).toHaveAttribute(
    'open',
    '',
  );
  await expect(page.getByText(/Later days do not replace it\./)).toBeVisible();
  expect(writes[1]).toMatchObject({ expectedVersion: 2, payload: { outcome: null } });
});
