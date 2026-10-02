import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`direction survives refresh and email claim at ${width}px (API fixtures)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let authenticated = false,
      intention = '',
      imports = 0;
    const base = {
      mode: 'personal',
      ownerId: '60000000-0000-4000-8000-000000000001',
      day: '2026-10-02',
      timezone: 'America/Chicago',
      version: 1,
      updatedAt: '2026-10-02T15:00:00Z',
      nextAction: null,
    };
    await page.route('**/api/world/priority', (route) =>
      route.fulfill({ json: authenticated ? { ...base, intention } : { mode: 'guest' } }),
    );
    await page.route('**/api/account/auth', async (route) => {
      if (route.request().method() === 'GET')
        return route.fulfill({
          json: { authenticated, ready: true, google: true, siteKey: '', captchaRequired: false },
        });
      const input = route.request().postDataJSON();
      if (input.action === 'verify') {
        authenticated = true;
        return route.fulfill({ json: { destination: '/experience/world?claim=1' } });
      }
      return route.fulfill({ json: { sent: true } });
    });
    await page.route('**/api/account/claim', (route) => {
      const { draft } = route.request().postDataJSON();
      intention = draft.intention;
      imports++;
      return route.fulfill({
        json: {
          status: 'saved',
          id: draft.id,
          day: base.day,
          intention,
          version: 1,
          focus: draft.focus,
        },
      });
    });
    await page.goto('/experience/world#direction');
    await page.getByLabel('My presence', { exact: true }).check();
    await page.getByLabel('My next move').fill('Keep my morning grooming deliberate.');
    await page.getByRole('button', { name: 'Set my direction' }).click();
    await page.getByRole('button', { name: 'Close Your next move' }).click();
    await expect(page.getByRole('link', { name: 'Enter Grooming', exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Find my next move' }).click();
    await expect(page.getByLabel('My next move')).toHaveValue(
      'Keep my morning grooming deliberate.',
    );
    await page.getByRole('button', { name: 'Save my direction' }).click();
    const dialog = page.getByRole('dialog', { name: 'Make this yours.' });
    await expect(dialog).toContainText('Free account. No payment required.');
    await page.screenshot({ path: testInfo.outputPath('claim.png'), animations: 'disabled' });
    await page.getByLabel('Email', { exact: true }).fill('synthetic@example.test');
    await page.getByRole('button', { name: 'Continue with email' }).click();
    await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button', { name: 'Continue my ascent' }).click();
    await expect(page.getByRole('heading', { name: 'Your direction is saved.' })).toBeVisible();
    expect(imports).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('gent-direction-draft-v1'))).toBeNull();
    await page.getByRole('button', { name: 'Return to my world' }).click();
    await expect(page.getByRole('region', { name: 'Your saved priority' })).toContainText(
      intention,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath('claimed-world.png'),
      animations: 'disabled',
    });
  });
}
test('failed import keeps draft and existing priority requires explicit replacement (API fixtures)', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'gent-direction-draft-v1',
      JSON.stringify({
        version: 1,
        id: '60000000-0000-4000-8000-000000000001',
        focus: 'body',
        intention: 'Train tomorrow',
        createdAt: Date.now(),
        timezone: 'America/Chicago',
      }),
    ),
  );
  await page.route('**/api/account/auth', (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        ready: true,
        google: false,
        siteKey: '',
        captchaRequired: false,
      },
    }),
  );
  let imports = 0;
  await page.route('**/api/account/claim', (route) => {
    imports++;
    if (imports === 1) return route.fulfill({ status: 503, json: { error: 'Retry your save.' } });
    const input = route.request().postDataJSON();
    return route.fulfill({
      json: {
        status: input.replace ? 'saved' : 'conflict',
        id: input.draft.id,
        day: '2026-10-02',
        intention: input.replace ? 'Train tomorrow' : 'Existing priority',
        version: 2,
        focus: 'body',
      },
    });
  });
  await page.goto('/experience/world?claim=1');
  await expect(page.getByRole('dialog', { name: 'Make this yours.' }).getByRole('alert')).toContainText('Retry your save.');
  expect(await page.evaluate(() => localStorage.getItem('gent-direction-draft-v1'))).not.toBeNull();
  await page.getByRole('button', { name: 'Save my direction', exact: true }).click();
  await expect(page.getByText('Your saved priority: Existing priority')).toBeVisible();
  expect(imports).toBe(2);
  await page.getByRole('button', { name: 'Replace it with this direction' }).click();
  await expect(page.getByRole('heading', { name: 'Your direction is saved.' })).toBeVisible();
  expect(imports).toBe(3);
});
