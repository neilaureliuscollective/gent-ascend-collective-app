// Required real-Supabase gate. Run against a fresh synthetic local reset only.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== '127.0.0.1')
  throw new Error('Local Supabase required');
test('public entrance rejects invalid credentials without leaving the world', async ({ page }) => {
  await page.goto('/enter');
  await page.getByLabel('Email').fill('not-invited@example.test');
  await page.getByLabel('Password').fill('incorrect-password');
  await page.getByRole('button', { name: 'Enter Gent Ascend' }).click();
  await expect(page).toHaveURL(/\/enter\?error=credentials$/);
  await expect(page.locator('.entrance-error')).toContainText(
    'email and password were not accepted',
  );
  await expect(page.getByRole('heading', { name: 'The world becomes yours.' })).toBeVisible();
});
test('founder can save a profile and goal without paid membership, then retain completed history', async ({
  page,
  context,
}) => {
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/app');
  await page.goto('/enter');
  await expect(page.getByRole('heading', { name: 'The door is yours.' })).toBeVisible();
  const personalDoor = page.locator('.entrance-panel a.entrance-primary');
  await expect(personalDoor).toHaveAttribute('href', /\/app(?:\/welcome)?/);
  await personalDoor.click();
  await expect(page).toHaveURL(/\/app(?:\/welcome)?$/);
  await page.goto('/dev');
  await page.getByLabel('Membership scenario').selectOption('free');
  await page.getByLabel('Billing simulation').selectOption('none');
  await page.getByRole('button', { name: 'Apply scenario' }).click();
  await expect(page.getByRole('status')).toHaveText('Scenario saved.');
  await page.goto('/app/you');
  const stale = await context.newPage();
  await stale.goto('/app/you');
  await page.getByLabel('What should we call you?').fill('Founder');
  await page.getByLabel('What matters most right now?').fill('Make room for deliberate progress.');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved.');
  await stale.getByLabel('What should we call you?').fill('Stale name');
  await stale.getByRole('button', { name: 'Save profile' }).click();
  await expect(
    stale.getByRole('form', { name: 'Personal profile' }).getByRole('alert'),
  ).toContainText('changed in another session');
  await stale.close();
  await page.reload();
  await expect(page.getByLabel('What matters most right now?')).toHaveValue(
    'Make room for deliberate progress.',
  );
  await page.goto('/app/goals');
  await expect(page.getByRole('form', { name: 'Create goal' })).toBeVisible();
  await page.getByLabel('What are you working toward?').fill('Synthetic founder goal');
  await page.getByLabel('Your next concrete step').fill('Plan tomorrow deliberately.');
  await page.getByRole('button', { name: 'Set my goal' }).click();
  await expect(page.getByRole('form', { name: 'Edit goal' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Your next concrete step')).toHaveValue(
    'Plan tomorrow deliberately.',
  );
  await page.goto('/app/daily');
  await page.getByRole('button', { name: 'Open day workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic founder goal' })).toBeVisible();
  await expect(
    page.locator('.goal-daily-card').getByText('Plan tomorrow deliberately.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Take a moment to check in' }).click();
  await page.getByLabel('What matters most today?').fill('Synthetic saved daily intention');
  await page.getByRole('button', { name: '3 Steady', exact: true }).click();
  await page.getByLabel('Hours slept').fill('7.5');
  await page.getByRole('button', { name: 'Save your day', exact: true }).click();
  await expect(page.locator('.daily-notice')).toHaveText('Your day is saved.');
  await page.reload();
  await page.getByRole('button', { name: 'Open day workspace', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Synthetic saved daily intention' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add a deliberate action' }).click();
  await page.getByLabel('One action you can take').fill('Synthetic persistence action');
  await page.getByRole('button', { name: 'Save your day', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Synthetic persistence action' }).click();
  await expect(page.locator('.daily-notice')).toHaveText('Your day is saved.');
  await page.reload();
  await page.getByRole('button', { name: 'Open day workspace', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Synthetic persistence action' })).toBeChecked();
  await page.goto('/app/goals');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByRole('button', { name: 'Confirm completion' }).click();
  await expect(page.getByRole('form', { name: 'Create goal' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Synthetic founder goal' })).toBeVisible();
  await expect(page.locator('.goal-history').getByText('Completed', { exact: true })).toBeVisible();
});

test('Fuel & Body persists references and daily records through the real app and Auth', async ({
  page,
}) => {
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/app');
  await page.goto('/app/performance');
  await page.getByRole('button', { name: 'Fuel & Body', exact: true }).click();
  await page.getByRole('button', { name: /(?:Set|Edit) my references/ }).click();
  await page.getByLabel('Daily calories · kcal').fill('2550');
  await page.getByRole('button', { name: 'Save references', exact: true }).click();
  await expect(page.getByText('Your reference: 2,550 kcal', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record intake & weight' }).click();
  await page.getByLabel('Calories · kcal', { exact: true }).fill('2350');
  await page.getByLabel('Protein · g', { exact: true }).fill('145');
  await page.getByRole('button', { name: 'These are my full-day totals' }).click();
  await page.getByRole('button', { name: 'Save daily record' }).click();
  await expect(
    page.getByRole('region', { name: "Today's fuel" }).getByText('2,350 kcal', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Fuel & Body', exact: true }).click();
  await expect(page.getByText('Your reference: 2,550 kcal', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: "Today's fuel" }).getByText('2,350 kcal', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('FULL DAY REPORTED', { exact: true })).toBeVisible();
});

test('Restore saves a practice and recovery check-in through the real authenticated app', async ({
  page,
}) => {
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/app');
  await page.goto('/app/performance');
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByRole('button', { name: /^(Choose|Edit) today’s practice$/ }).click();
  await page.getByRole('button', { name: 'Protected rest', exact: true }).click();
  await page.getByLabel('Minutes to set aside').fill('25');
  await page.getByLabel('Your cue · optional').fill('After my shift');
  await page.getByRole('button', { name: 'Save practice', exact: true }).click();
  await expect(page.getByRole('region', { name: "Today's recovery practice" })).toContainText(
    'Protected rest',
  );
  await page.getByRole('button', { name: 'Record recovery', exact: true }).click();
  await page.getByLabel('Sleep · hours', { exact: true }).fill('7.5');
  await page.getByRole('button', { name: '4 · Good', exact: true }).click();
  await page.getByRole('button', { name: 'No soreness', exact: true }).click();
  await page.getByRole('button', { name: 'Save recovery check-in' }).click();
  await expect(page.getByRole('heading', { name: 'Make room to recover.' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByRole('region', { name: "Today's recovery practice" })).toContainText(
    '25 minutes · After my shift',
  );
  await page.getByRole('button', { name: 'Record recovery', exact: true }).click();
  await expect(page.getByLabel('Sleep · hours', { exact: true })).toHaveValue('7.5');
  await expect(page.getByRole('button', { name: '4 · Good', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Fuel & Body', exact: true }).click();
  await expect(
    page.getByRole('region', { name: "Today's fuel" }).getByText('2,350 kcal', { exact: true }),
  ).toBeVisible();
});

test('Movement persists activity and removal through the real authenticated app', async ({
  page,
}) => {
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/app');
  await page.goto('/app/performance');
  await page.getByRole('button', { name: 'Movement', exact: true }).click();
  await page.getByRole('button', { name: 'Record activity', exact: true }).click();
  await page.getByRole('combobox', { name: 'Activity', exact: true }).selectOption('cycle');
  await page.getByLabel('Duration · minutes').fill('30');
  await page.getByLabel('Distance · optional').fill('2');
  await page.getByLabel('Activity note · optional').fill('Founder cycle persistence');
  await page.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Activity history' })).toContainText(
    'Founder cycle persistence',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Movement', exact: true }).click();
  const row = page
    .getByRole('region', { name: 'Activity history' })
    .locator('li')
    .filter({ hasText: 'Founder cycle persistence' });
  await expect(row).toContainText('2 mi');
  await row.getByRole('button').click();
  await page.getByRole('button', { name: 'Remove activity', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(row).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Movement', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Activity history' })).not.toContainText(
    'Founder cycle persistence',
  );
});

test('Daily Command saves arrival and feedback through real Auth, then reloads the saved loop', async ({
  page,
}) => {
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/app');
  await page.goto('/app/arrival');
  const commandResponse = await page.request.get('/api/daily-command');
  const commandData = await commandResponse.json();
  expect(commandResponse.ok(), commandData.error).toBe(true);
  await expect(page.getByRole('region', { name: 'Daily Command' })).toBeVisible();
  await page.getByText('Morning arrival · optional', { exact: true }).click();
  await page.getByLabel('Sleep · minutes').fill('450');
  await page.getByLabel('Energy · 1 very low to 5 high').fill('4');
  await page.getByLabel('Soreness', { exact: true }).selectOption('mild');
  await page.getByRole('button', { name: 'Save arrival & command' }).click();
  await expect(page.getByRole('status')).toContainText('arrival and command are saved');
  await page.reload();
  await page.getByText('Morning arrival · optional', { exact: true }).click();
  await expect(page.getByLabel('Sleep · minutes')).toHaveValue('450');
  await page.getByText('Close the loop', { exact: true }).click();
  await page.getByLabel('Did the direction fit?').selectOption('right');
  await page.getByLabel('What should tomorrow know?').fill('Synthetic command follow-through.');
  await page.getByRole('button', { name: 'Save evening feedback' }).click();
  await expect(page.getByRole('status')).toContainText('feedback is saved for tomorrow');
  await page.reload();
  await page.getByText('Close the loop', { exact: true }).click();
  await expect(page.getByLabel('What should tomorrow know?')).toHaveValue(
    'Synthetic command follow-through.',
  );
});
