import { test, expect, type Page } from './fixtures';

const base = {
  mode: 'personal' as const,
  ownerId: '60000000-0000-4000-8000-000000000001',
  day: '2026-10-02',
  timezone: 'America/Chicago',
  version: 4,
  intention: 'Make space for the work that matters.',
  updatedAt: '2026-10-02T13:00:00Z',
  nextAction: 'Give the launch plan twenty focused minutes.',
};
async function fixture(page: Page, fail = false) {
  let saved = { ...base };
  let writes = 0;
  await page.route('**/api/world/priority', async (route) => {
    if (route.request().method() === 'PUT') {
      writes++;
      if (fail)
        return route.fulfill({
          status: 409,
          json: { error: 'Your saved day changed. Reload it before saving your priority.' },
        });
      const body = route.request().postDataJSON();
      expect(Object.keys(body).sort()).toEqual(['day', 'intention', 'ownerId', 'version']);
      expect(body.ownerId).toBe(base.ownerId);
      saved = { ...saved, intention: body.intention, version: saved.version + 1 };
    }
    return route.fulfill({ json: saved, headers: { 'Cache-Control': 'private, no-store' } });
  });
  return () => writes;
}
for (const width of [360, 768, 1440]) {
  test(`saved priority flow at ${width}px (API fixture)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    const writes = await fixture(page);
    await page.goto('/experience/world?world=grooming');
    await expect(page.getByRole('region', { name: 'Your saved priority' })).toContainText(
      base.intention,
    );
    await expect(page.getByRole('link', { name: 'Enter Grooming' })).toBeVisible();
    await page.getByRole('button', { name: base.intention }).click();
    const draft = page.getByLabel('What matters most today?');
    await expect(draft).toHaveValue(base.intention);
    await draft.fill('Give the people who matter my full attention.');
    await page.getByRole('button', { name: 'Close Your next move' }).click();
    await expect(page.getByRole('button', { name: base.intention })).toBeFocused();
    await page.getByRole('button', { name: base.intention }).click();
    await expect(draft).toHaveValue('Give the people who matter my full attention.');
    await page.getByRole('button', { name: 'Save my priority' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved to your day.' })).toBeVisible();
    expect(writes()).toBe(1);
    await expect(page.getByText(base.nextAction, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue my day' })).toHaveAttribute(
      'href',
      '/app#daily-actions',
    );
    await page.screenshot({
      path: testInfo.outputPath('priority-editor.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Close Your next move' }).click();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Your saved priority' })).toContainText(
      'Give the people who matter my full attention.',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 360) {
      const priority = await page
        .getByRole('region', { name: 'Your saved priority' })
        .boundingBox();
      const dock = await page.getByRole('navigation', { name: 'World navigation' }).boundingBox();
      expect(priority!.y + priority!.height).toBeLessThan(dock!.y);
    }
    await page.screenshot({
      path: testInfo.outputPath('personal-world.png'),
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('conflict keeps the draft and prevents blind retry (API fixture)', async ({ page }) => {
  const writes = await fixture(page, true);
  await page.goto('/experience/world#direction');
  await page
    .getByLabel('What matters most today?')
    .fill('Keep this draft when another session saves.');
  await page.getByRole('button', { name: 'Save my priority' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Your saved day changed');
  await expect(page.getByLabel('What matters most today?')).toHaveValue(
    'Keep this draft when another session saves.',
  );
  await expect(page.getByRole('button', { name: 'Save my priority' })).toBeDisabled();
  expect(writes()).toBe(1);
  await page.getByRole('button', { name: 'Reload saved priority (discard draft)' }).click();
  await expect(page.getByLabel('What matters most today?')).toHaveValue(base.intention);
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
});

test('lost response preserves draft; navigation stays available (API fixture)', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/experience/world');
  await page.getByRole('button', { name: base.intention }).click();
  await page.getByLabel('What matters most today?').fill('Keep my unconfirmed intention.');
  await page.route('**/api/world/priority', (route) => route.abort());
  await page.getByRole('button', { name: 'Save my priority' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'save could not be confirmed',
  );
  await expect(page.getByLabel('What matters most today?')).toHaveValue(
    'Keep my unconfirmed intention.',
  );
  await page.getByRole('button', { name: 'Close Your next move' }).click();
  await page.getByRole('button', { name: 'Grooming', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Enter Grooming' })).toBeVisible();
});

test('guest endpoint is private and mutation requires a session', async ({ request }) => {
  const read = await request.get('/api/world/priority');
  expect(read.headers()['cache-control']).toContain('no-store');
  expect(await read.json()).toEqual({ mode: 'guest' });
  const write = await request.put('/api/world/priority', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: {
      ownerId: base.ownerId,
      day: base.day,
      version: base.version,
      intention: 'Unauthorized',
    },
  });
  expect(write.status()).toBe(401);
});
