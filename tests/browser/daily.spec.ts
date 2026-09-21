import { test, expect } from '@playwright/test';
import { sampleData } from '../../src/domains/daily/model';
for (const width of [360, 768, 1440])
  test(`sample dashboard is useful, isolated and responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(r.url());
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore a sample day' }).click();
    await expect(page.getByText('Sample experience', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const action = page.getByRole('checkbox', {
      name: 'Give the most important project 45 focused minutes',
    });
    await action.click();
    await expect(action).toBeChecked();
    await action.click();
    await expect(action).not.toBeChecked();
    await page.getByRole('button', { name: 'Update your check-in' }).click();
    await page
      .getByLabel('What matters most today?')
      .fill('Make room for a meaningful conversation');
    await page.getByRole('button', { name: '3 Steady', exact: true }).click();
    await page.getByLabel('Hours slept').fill('8');
    await page.getByRole('button', { name: 'Apply to sample' }).click();
    await expect(
      page.getByRole('heading', { name: 'Make room for a meaningful conversation' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add a deliberate action' }).click();
    await page.getByLabel('One action you can take').fill('Call a friend');
    await page.getByRole('button', { name: 'Apply to sample' }).click();
    await expect(page.getByRole('checkbox', { name: 'Call a friend' })).toBeVisible();
    await page.getByRole('button', { name: 'Evening', exact: true }).click();
    await page.getByRole('button', { name: 'Reflect on today', exact: true }).click();
    await page
      .getByLabel('A win, a lesson, or something to remember')
      .fill('A small step was enough.');
    await page.getByRole('button', { name: 'Apply to sample' }).click();
    await expect(page.locator('.reflection-card')).toContainText('A small step was enough.');
    await page.getByRole('button', { name: '30 days', exact: true }).click();
    await page.getByText('Read the daily values').click();
    await expect(page.locator('.daily-table-scroll tbody tr')).toHaveCount(30);
    expect(writes).toEqual([]);
    await page.getByRole('button', { name: 'Exit sample' }).click();
    await expect(page.getByRole('heading', { name: 'Make today yours.' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Call a friend' })).toHaveCount(0);
  });
test('daily editor preserves unsaved text on conflict and reloads only deliberately', async ({
  page,
}) => {
  const data = { ...sampleData('2026-09-21'), mode: 'personal' as const, name: 'Synthetic tester' };
  let conflict = true;
  await page.route('**/api/daily', async (route) => {
    if (route.request().method() === 'PUT') {
      if (conflict)
        return route.fulfill({
          status: 409,
          json: { error: 'Your day changed in another session. Reload first.' },
        });
      const update = route.request().postDataJSON();
      data.entries = data.entries.map((e) =>
        e.day === update.day ? { ...e, ...update, version: update.version + 1 } : e,
      );
    }
    return route.fulfill({ json: data });
  });
  await page.goto('http://127.0.0.1:3102/?mode=daily');
  await page.getByRole('button', { name: 'Update your check-in' }).click();
  await page.getByLabel('What matters most today?').fill('Keep this draft');
  await page.getByRole('button', { name: 'Save your day', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('another session');
  await expect(page.getByLabel('What matters most today?')).toHaveValue('Keep this draft');
  await expect(page.getByRole('button', { name: 'Save your day', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload saved day (discard draft)' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  conflict = false;
  await page.getByRole('button', { name: 'Update your check-in' }).click();
  await page.getByLabel('What matters most today?').fill('A saved intention');
  await page.getByRole('button', { name: 'Save your day', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Your day is saved.');
  await expect(page.getByRole('heading', { name: 'A saved intention' })).toBeVisible();
});
test('dashboard conversation starter is a draft, never an automatic model request', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/aurelius')) writes.push(r.url());
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Plan with Aurelius' }).click();
  await expect(page.getByLabel('Message Aurelius')).toHaveValue(
    'Help me choose what matters most today and turn it into a manageable plan.',
  );
  expect(writes).toEqual([]);
});
test('daily API rejects anonymous reads/writes and hostile origins', async ({ request }) => {
  expect((await request.get('/api/daily')).status()).toBe(401);
  const input = {
    day: '2026-09-21',
    version: 0,
    energy: null,
    sleep_minutes: null,
    intention: '',
    reflection: '',
    actions: [],
  };
  expect(
    (
      await request.put('/api/daily', {
        headers: { Origin: 'https://attacker.example' },
        data: input,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.put('/api/daily', { headers: { Origin: 'http://127.0.0.1:3100' }, data: input })
    ).status(),
  ).toBe(401);
});

test('short-screen daily editor supports keyboard dismissal, focus return and large text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const trigger = page.getByRole('button', { name: 'Update your check-in' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Hours slept').fill('0');
  await page.getByRole('button', { name: 'Apply to sample' }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel('Hours slept')).toHaveValue('0');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('unrecognized conversation starter stays empty', async ({ page }) => {
  await page.goto('/aurelius?starter=constructor');
  await expect(page.getByLabel('Message Aurelius')).toHaveValue('');
});
