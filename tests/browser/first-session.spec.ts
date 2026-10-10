import { test, expect } from './fixtures';
const base = {
  mode: 'personal',
  ownerId: '60000000-0000-4000-8000-000000000001',
  day: '2026-10-04',
  timezone: 'America/Chicago',
  version: 1,
  intention: 'Make room for deliberate progress',
  nextAction: null,
  updatedAt: null,
};
for (const width of [360, 768, 1440]) {
  test(`reviewed first session saves a next move and returns at ${width}px (API fixtures)`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let writes = 0;
    await page.route('**/api/world/priority', async (route) => {
      const input = route.request().postDataJSON();
      writes++;
      expect(input.ownerId).toBe(base.ownerId);
      expect(input.nextAction).toBe('Train for twenty minutes after work');
      await route.fulfill({
        json: { ...base, version: 2, intention: input.intention, nextAction: input.nextAction },
      });
    });
    await page.goto('http://127.0.0.1:3102/?mode=first-session&paid=1');
    await page.getByLabel('Get stronger', { exact: true }).check();
    await page.getByLabel('What matters today?').fill('Build a consistent week');
    await page
      .getByLabel('My next move', { exact: true })
      .fill('Train for twenty minutes after work');
    await expect(
      page.getByRole('link', { name: 'Talk this through with Aethelios' }),
    ).toHaveAttribute('href', '/app/aethelios?starter=first-session');
    expect(writes).toBe(0);
    await page.getByRole('button', { name: 'Save priority and next move' }).click();
    await expect(page.getByRole('status')).toContainText('saved to your daily plan');
    expect(writes).toBe(1);
    await expect(page.getByRole('link', { name: 'Open Performance' })).toHaveAttribute(
      'href',
      '/app/performance',
    );
    await expect(page.getByRole('link', { name: 'Return to my saved plan' })).toHaveAttribute(
      'href',
      '/app/daily',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('first-session.png'), fullPage: true });
  });
}
test('unknown save preserves draft and requires readback; account changes cannot adopt it (API fixtures)', async ({
  page,
}) => {
  let writes = 0,
    foreign = false;
  await page.route('**/api/world/priority', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: {
          ...base,
          ownerId: foreign ? '60000000-0000-4000-8000-000000000002' : base.ownerId,
          version: 2,
        },
      });
    writes++;
    return route.fulfill({ status: 503, json: { error: 'Save acknowledgment lost.' } });
  });
  await page.goto('http://127.0.0.1:3102/?mode=first-session');
  await expect(page.getByRole('link', { name: /Talk this through/ })).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Review membership access to Aethelios' }),
  ).toBeVisible();
  await page.getByLabel('My next move', { exact: true }).fill('Keep this reviewed draft');
  await page.getByRole('button', { name: 'Save priority and next move' }).click();
  await expect(page.getByRole('status')).toContainText('Reload saved context');
  await expect(page.getByRole('button', { name: 'Save priority and next move' })).toBeDisabled();
  await expect(page.getByLabel('My next move', { exact: true })).toHaveValue(
    'Keep this reviewed draft',
  );
  foreign = true;
  await page.getByRole('button', { name: 'Reload saved context' }).click();
  await expect(page.getByRole('status')).toContainText('Your account changed');
  await expect(page.getByRole('button', { name: 'Save priority and next move' })).toBeDisabled();
  foreign = false;
  await page.getByRole('button', { name: 'Reload saved context' }).click();
  await expect(page.getByRole('button', { name: 'Save priority and next move' })).toBeEnabled();
  expect(writes).toBe(1);
  await expect(page.getByLabel('My next move', { exact: true })).toHaveValue(
    'Keep this reviewed draft',
  );
});
test('Facebook entry explains browser handoff and excludes private draft from copied link', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Android FBAN/FB4A FBAV/500',
    }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=first-session&private=draft');
  await expect(page.getByRole('complementary', { name: 'Open in your browser' })).toContainText(
    'Device drafts stay in the browser',
  );
  const value = await page.evaluate(async () => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          copied = text;
        },
      },
    });
    (document.querySelector('.browser-entry-notice button') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    return copied;
  });
  expect(value).toBe('http://127.0.0.1:3102/enter');
});
