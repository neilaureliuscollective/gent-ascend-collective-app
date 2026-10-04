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
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: completed
          ? {
              ...member,
              rituals: [{ ...member.rituals[0], lastRecordedAt: '2026-10-02T14:00:00Z' }],
            }
          : member,
      });
    const body = route.request().postDataJSON();
    ids.push(body.requestId);
    expect(body.ritualId).toBe(ritualId);
    expect(body.ownerId).toBe(ownerId);
    if (!completed) {
      completed = true;
      return route.abort();
    }
    return route.fulfill({
      json: {
        id: body.requestId,
        requestId: body.requestId,
        ritualId,
        occurredAt: '2026-10-02T14:00:00Z',
      },
    });
  });
  await page.goto('/experience/grooming');
  await page.getByRole('button', { name: 'Start today’s ritual' }).click();
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
  await expect(page.getByRole('button', { name: 'Create your ritual' })).toBeVisible();
});
test('unavailable personal records do not appear as empty or prevent navigation', async ({
  page,
}) => {
  await page.route('**/api/world/grooming', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  );
  await page.goto('/experience/grooming');
  await expect(page.getByRole('alert').filter({ hasText: 'saved rituals' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create your ritual' })).toHaveCount(0);
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
      version: 2,
      day: '2026-10-02',
    },
  });
  expect(write.status()).toBe(401);
});

test('quick completion, linked products and optional feedback need no step-by-step navigation', async ({
  page,
}, testInfo) => {
  let writes = 0,
    feedbackWrites = 0;
  const data = {
    ...member,
    suggestedKind: 'morning',
    week: [{ day: member.day, completed: 0, notes: [] }],
    rituals: [
      {
        ...member.rituals[0],
        products: [
          {
            id: '67000000-0000-4000-8000-000000000001',
            name: 'My external beard oil',
            relation: 'in_use',
            note: 'Follow my label directions',
          },
        ],
        productCount: 1,
      },
    ],
  };
  await page.route('**/api/world/grooming', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: writes
          ? {
              ...data,
              week: [{ day: member.day, completed: 1, notes: [] }],
              rituals: [{ ...data.rituals[0], lastRecordedAt: '2026-10-02T14:00:00Z' }],
            }
          : data,
      });
    writes++;
    const body = route.request().postDataJSON();
    expect(body.version).toBe(2);
    return route.fulfill({
      json: {
        id: body.requestId,
        requestId: body.requestId,
        ritualId,
        occurredAt: '2026-10-02T14:00:00Z',
      },
    });
  });
  await page.route('**/api/grooming/feedback', (route) => {
    feedbackWrites++;
    expect(route.request().postDataJSON().note).toBe('Comfortable');
    return route.fulfill({ json: { saved: true } });
  });
  await page.setViewportSize({ width: 344, height: 850 });
  await page.goto('/experience/grooming');
  await page.getByRole('button', { name: 'I’ve done it' }).click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('status')
      .filter({ hasText: 'Recorded in your grooming history' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(0);
  await page.getByText('Your linked products · 1').click();
  await expect(page.getByRole('dialog')).toContainText('My external beard oil');
  await page.getByRole('button', { name: 'Comfortable', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Feedback saved.');
  expect(writes).toBe(1);
  expect(feedbackWrites).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('quick-practice-phone.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close Your grooming ritual' }).click();
  await page.getByRole('button', { name: 'Progress ↗' }).click();
  await expect(page.getByRole('dialog')).toContainText('1 ritual recorded');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [344, 768])
  test(`ritual editor retains and locks an uncertain save at ${width}px`, async ({
    page,
  }, testInfo) => {
    const requests: unknown[] = [];
    let saved = false;
    await page.route('**/api/world/grooming', (route) =>
      route.fulfill({
        json: {
          ...member,
          rituals: saved ? [{ ...member.rituals[0], title: 'My sharper morning' }] : member.rituals,
        },
      }),
    );
    await page.route('**/api/grooming/ritual', (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (requests.length === 1) return route.abort();
      saved = true;
      return route.fulfill({ json: { id: ritualId, requestId: body.requestId } });
    });
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/experience/grooming');
    await page.getByRole('button', { name: 'Refine ritual ↗' }).click();
    await page.getByLabel('Name', { exact: true }).fill('My sharper morning');
    await page
      .getByLabel('Steps · one per line')
      .fill('Keep my familiar cleansing.\nShape the beard.');
    await page.getByRole('button', { name: 'Close Refine your ritual' }).click();
    await page.getByRole('button', { name: 'Refine ritual ↗' }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('My sharper morning');
    await page.getByRole('button', { name: 'Review ritual →' }).click();
    await page.getByText('Compare with your current ritual').click();
    await expect(page.getByRole('dialog')).toContainText('A considered morning');
    await page.getByRole('button', { name: 'Save reviewed ritual' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'save could not be confirmed',
    );
    await expect(page.getByRole('button', { name: 'Edit draft' })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('review-draft.png'), fullPage: true });
    await page.getByRole('button', { name: 'Confirm this same save' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual(requests[1]);
    await expect(page.locator('#grooming-area')).toContainText('My sharper morning');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test('local time can select evening; an empty ritual starts with a reviewed draft', async ({
  page,
}) => {
  let writes = 0;
  await page.route('**/api/world/grooming', (route) =>
    route.fulfill({ json: { ...member, suggestedKind: 'evening' } }),
  );
  await page.route('**/api/grooming/ritual', (route) => {
    writes++;
    const body = route.request().postDataJSON();
    expect(body.kind).toBe('evening');
    expect(body.expectedVersion).toBe(0);
    return route.fulfill({ json: { id: ritualId, requestId: body.requestId } });
  });
  await page.goto('/experience/grooming');
  await expect(page.getByRole('button', { name: 'evening', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Create your ritual' }).click();
  await page.getByRole('button', { name: 'beard', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Evening beard ritual');
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Review ritual →' }).click();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Save reviewed ritual' }).click();
  expect(writes).toBe(1);
});

test('all-steps navigation is a read-only shortcut to the exact saved step', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/world/grooming', (route) => {
    if (route.request().method() === 'POST') writes++;
    return route.fulfill({ json: member });
  });
  await page.goto('/experience/grooming');
  await page.getByText('3 steps · 0 linked products', { exact: true }).click();
  await expect(page.locator('.ritual-glance')).toContainText('Shape the beard with care.');
  await page.getByRole('button', { name: 'Start today’s ritual' }).click();
  await page.getByRole('button', { name: 'All steps', exact: true }).click();
  await page.getByRole('list', { name: 'Saved ritual steps' }).getByRole('button').nth(1).click();
  await expect(page.locator('.gw-ritual-step')).toHaveText('Shape the beard with care.');
  await expect(page.getByRole('button', { name: 'Guided', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Close Your grooming ritual' }).click();
  expect(writes).toBe(0);
});

for (const width of [344, 768])
  test(`step arrangement reviews exact order before saving at ${width}px`, async ({
    page,
  }, testInfo) => {
    let writes = 0;
    await page.route('**/api/world/grooming', (route) => route.fulfill({ json: member }));
    await page.route('**/api/grooming/ritual', (route) => {
      writes++;
      const body = route.request().postDataJSON();
      expect(body.steps).toBe(
        'Shape the beard with care.\nFollow my familiar cleansing routine.\nKeep my own finishing step.',
      );
      expect(body.expectedVersion).toBe(2);
      return route.fulfill({ json: { id: ritualId, requestId: body.requestId } });
    });
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/experience/grooming');
    await page.getByRole('button', { name: 'Refine ritual ↗' }).click();
    await page.getByText('Arrange individual steps', { exact: true }).click();
    await page.getByRole('button', { name: 'Move step 2 up', exact: true }).click();
    await expect(page.getByLabel('Step 1', { exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Remove step 3', exact: true }).click();
    await page.getByRole('button', { name: 'Add a step', exact: false }).click();
    await page.getByLabel('Step 3', { exact: true }).fill('Keep my own finishing step.');
    await expect(page.getByLabel('Steps · one per line')).toHaveValue(
      'Shape the beard with care.\nFollow my familiar cleansing routine.\nKeep my own finishing step.',
    );
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds?.y).toBe(0);
    expect(bounds?.height).toBe(850);
    await page.screenshot({ path: testInfo.outputPath('step-arrangement.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Review ritual →' }).click();
    expect(writes).toBe(0);
    await expect(page.getByRole('dialog')).toContainText('3 current steps → 3 reviewed steps');
    await page.getByRole('button', { name: 'Save reviewed ritual' }).click();
    expect(writes).toBe(1);
  });

test('confirmed feedback refreshes progress and invites explicit review without changing a ritual', async ({
  page,
}) => {
  let feedbackSaved = false,
    ritualWrites = 0;
  await page.route('**/api/world/grooming', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: {
          ...member,
          week: [
            {
              day: member.day,
              completed: feedbackSaved ? 1 : 0,
              notes: feedbackSaved ? ['Too much effort'] : [],
            },
          ],
        },
      });
    const body = route.request().postDataJSON();
    return route.fulfill({
      json: {
        id: body.requestId,
        requestId: body.requestId,
        ritualId,
        occurredAt: '2026-10-02T14:00:00Z',
      },
    });
  });
  await page.route('**/api/grooming/feedback', (route) => {
    feedbackSaved = true;
    return route.fulfill({ json: { saved: true } });
  });
  await page.route('**/api/grooming/ritual', (route) => {
    ritualWrites++;
    return route.abort();
  });
  await page.goto('/experience/grooming');
  await page.getByRole('button', { name: 'I’ve done it' }).click();
  await page.getByRole('button', { name: 'Too much effort', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Feedback saved.');
  await page.getByRole('button', { name: 'Close Your grooming ritual' }).click();
  await page.getByRole('button', { name: 'Progress ↗' }).click();
  await expect(page.locator('.ritual-week-summary')).toContainText('1 day with practice');
  await expect(page.locator('.ritual-week-summary')).toContainText('recorded 1 time');
  await expect(page.locator('.ritual-week-summary')).toContainText('does not identify a cause');
  await page.getByRole('button', { name: 'Review selected morning ritual' }).click();
  await expect(page.getByRole('dialog', { name: 'Refine your ritual' })).toBeVisible();
  expect(ritualWrites).toBe(0);
});
