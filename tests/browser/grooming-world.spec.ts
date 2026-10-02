import { test, expect, type Page } from './fixtures';
const ownerId = '60000000-0000-4000-8000-000000000001',
  ritualId = '65000000-0000-4000-8000-000000000001';
const member = {
  mode: 'personal',
  ownerId,
  day: '2026-10-02',
  timezone: 'America/Chicago',
  rituals: [
    {
      id: ritualId,
      kind: 'morning',
      title: 'A considered morning',
      steps:
        'Follow my familiar cleansing routine.\nShape the beard with care.\nFinish with the products I already use.',
      version: 2,
      lastRecordedAt: null,
    },
  ],
};
async function finalStep(page: Page) {
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
}
for (const width of [360, 768, 1440]) {
  test(`Grooming world and guest ritual at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    let posts = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/world/grooming') && r.method() === 'POST') posts++;
    });
    await page.goto('/experience/world?world=grooming');
    await page.getByRole('link', { name: 'Enter Grooming' }).click();
    await expect(page.getByRole('heading', { name: 'Your standard. Made daily.' })).toBeFocused();
    await page.getByRole('button', { name: 'Explore a ritual' }).click();
    await expect(page.getByRole('dialog')).toContainText('SAMPLE / NOT SAVED TO AN ACCOUNT');
    await finalStep(page);
    await page.getByRole('button', { name: 'Finish sample practice' }).click();
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('Nothing was saved');
    expect(posts).toBe(0);
    await page.getByRole('button', { name: 'Close Your grooming ritual' }).click();
    await expect(page.getByRole('button', { name: 'Explore a ritual' })).toBeFocused();
    for (const [name, id, link] of [
      ['Ascend Scan', 'scan', '/app/grooming/scan'],
      ['My Look', 'look', '/app/grooming/look'],
      ['Professional', 'professional', '/app/grooming/professional'],
    ]) {
      await page
        .getByRole('group', { name: 'Grooming areas' })
        .getByRole('button', { name, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`area=${id}`));
      await expect(page.locator('#grooming-area .gw-action')).toHaveAttribute('href', link!);
    }
    await page.reload();
    await expect(page.getByRole('button', { name: 'Professional', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Ritual', exact: true }).click();
    await page.locator('.gw-grooming-mirror img').evaluate((img: HTMLImageElement) => img.decode());
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath('grooming-world.png'),
      fullPage: true,
      animations: 'disabled',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('link', { name: '← Whole-Man World' }).click();
    await expect(page.getByRole('button', { name: 'Grooming', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}
test('member recording retries the same request after a lost response (API fixture)', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 850 });
  const ids: string[] = [];
  let completed = false;
  await page.route('**/api/world/grooming', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: member });
    const body = route.request().postDataJSON();
    ids.push(body.requestId);
    expect(body.ritualId).toBe(ritualId);
    expect(body.ownerId).toBe(ownerId);
    if (!completed) {
      completed = true;
      return route.abort();
    }
    return route.fulfill({
      json: { id: body.requestId, ritualId, occurredAt: '2026-10-02T14:00:00Z' },
    });
  });
  await page.goto('/experience/grooming');
  await page.getByRole('button', { name: 'Begin your ritual' }).click();
  await finalStep(page);
  await page.getByRole('button', { name: 'Record this practice' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'save could not be confirmed',
  );
  await page.getByRole('button', { name: 'Record this practice' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    'Recorded in your grooming history',
  );
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  await page.screenshot({
    path: testInfo.outputPath('ritual-member-fixture.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Close Your grooming ritual' }).click();
  await expect(page.getByRole('button', { name: 'Review your ritual' })).toBeVisible();
  await page.getByRole('button', { name: 'evening', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Create your ritual' })).toBeVisible();
});
test('unavailable personal records do not appear as empty or prevent navigation', async ({
  page,
}) => {
  await page.route('**/api/world/grooming', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  );
  await page.goto('/experience/grooming');
  await expect(page.getByRole('alert').filter({ hasText: 'saved rituals' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create your ritual' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ascend Scan', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Begin Ascend Scan' })).toBeVisible();
});
test('Still, failed imagery and enlarged phone text retain Grooming controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/_next/image?**', (route) => route.abort());
  await page.goto('/experience/grooming');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '24px';
  });
  await expect(page.locator('.gw-grooming')).toHaveAttribute('data-animated', 'false');
  await page.getByRole('button', { name: 'Explore a ritual' }).click();
  await finalStep(page);
  await page.getByRole('button', { name: 'Finish sample practice' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Sample complete');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('real guest API is private and rejects recording without identity', async ({ request }) => {
  const read = await request.get('/api/world/grooming');
  expect(read.headers()['cache-control']).toContain('no-store');
  expect(await read.json()).toEqual({ mode: 'guest' });
  const write = await request.post('/api/world/grooming', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: {
      ownerId,
      ritualId,
      requestId: '66000000-0000-4000-8000-000000000001',
      day: '2026-10-02',
    },
  });
  expect(write.status()).toBe(401);
});
