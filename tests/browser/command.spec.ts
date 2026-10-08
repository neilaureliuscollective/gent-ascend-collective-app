import { test, expect } from './fixtures';
for (const [width, height] of [
  [344, 740],
  [390, 844],
  [360, 640],
  [768, 900],
  [820, 1180],
  [1440, 900],
] as const)
  test(`Command clarity and source inspection ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/app/daily');
    await expect(page.locator('.command-briefing')).toBeVisible();
    await expect(page.locator('.command-briefing input,.command-briefing textarea')).toHaveCount(0);
    await page.getByRole('button', { name: 'Explore a sample day' }).click();
    await expect(page.locator('.command-next')).toContainText(
      'Give the most important project 45 focused minutes',
    );
    const moveBox = await page.locator('.command-next h2').boundingBox();
    expect(moveBox!.y).toBeLessThan(height - 90);
    await page.getByRole('button', { name: /Energy/ }).click();
    await expect(page.locator('.signal-detail')).toContainText('not a readiness score');
    await expect(page.locator('.command-presence canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/command-${width}x${height}.png`, fullPage: true });
  });
test('degraded decision status never becomes a false all clear', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/?mode=daily&state=unavailable');
  await expect(
    page.getByRole('heading', { name: 'Decision status is unavailable.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nothing needs you right now.' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/command-degraded.png', fullPage: true });
});
test('empty account has no manufactured signals', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/?mode=daily&state=empty');
  await expect(page.locator('.field-signal')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nothing needs you right now.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/command-empty.png', fullPage: true });
});
test('decision timeout blocks replay until deliberate saved-state reload', async ({ page }) => {
  await page.route('**/api/aurelius/actions', (route) =>
    route.fulfill({ status: 503, json: { error: 'Decision not confirmed.' } }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=daily&state=pending');
  await page.getByRole('button', { name: 'Approve action' }).click();
  await expect(page.getByRole('button', { name: 'Approve action' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reload saved context' })).toBeVisible();
});
test('signal inspection and depth support keyboard', async ({ page }) => {
  await page.goto('/app/daily');
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  const energy = page.getByRole('button', { name: /Energy/ });
  await energy.focus();
  await page.keyboard.press('Enter');
  await expect(energy).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Close detail' }).click();
  await expect(energy).toBeFocused();
  await page.getByRole('button', { name: 'Open day workspace', exact: true }).click();
  await expect(page.locator('#command-depth')).toBeFocused();
});
test('approved suggestion refreshes real saved state before all clear', async ({ page }) => {
  const { sampleData } = await import('../../src/domains/daily/model');
  const saved = {
    ...sampleData('2026-09-21'),
    mode: 'personal',
    pendingDecisions: [],
    decisionsAvailable: true,
  };
  const requests: unknown[] = [];
  await page.route('**/api/aurelius/actions', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { executed: true, day: '2026-09-21' } });
  });
  await page.route('**/api/command', (route) =>
    route.fulfill({
      json: {
        data: { ...saved, ownerId: '60000000-0000-4000-8000-000000000001' },
        asOf: '2026-09-21T14:00:00Z',
      },
    }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=daily&state=pending');
  await page.getByRole('button', { name: 'Approve action' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing needs you right now.' })).toBeVisible();
  expect(requests).toEqual([
    {
      proposalId: '10000000-0000-4000-8000-000000000009',
      approve: true,
      title: 'Protect 30 minutes for writing',
    },
  ]);
});
test('bounded Command scene pauses offscreen and is removed by Still', async ({ page }) => {
  await page.goto('/app/daily');
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  const canvas = page.locator('.command-presence canvas');
  await expect(canvas).toHaveCount(1);
  const host = page.locator('.command-presence');
  const size = await canvas.evaluate((e) => ({
    width: (e as HTMLCanvasElement).width,
    height: (e as HTMLCanvasElement).height,
  }));
  expect(size.width).toBeLessThanOrEqual(480);
  expect(size.height).toBeLessThanOrEqual(480);
  await page.getByRole('button', { name: 'Open day workspace', exact: true }).click();
  await expect(host).toHaveAttribute('data-animating', 'false');
  await page.getByRole('button', { name: 'Update your check-in' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(host).toHaveAttribute('data-animating', 'false');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(canvas).toHaveCount(0);
});

test('failed opening stays truthful and offers deliberate retry', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/?mode=command-error');
  await expect(
    page.getByRole('heading', { name: 'Your saved context is unavailable.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.screenshot({ path: 'test-results/command-error.png' });
});
test('Command uses the current energy identity in motion, Still and graphics loss', async ({
  page,
}) => {
  await page.goto('/app/daily');
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  const presence = page.locator('.command-presence');
  await expect(presence).toHaveClass(/gw-energy-orb/);
  await expect(presence.locator('.presence-fallback')).toHaveCount(0);
  await expect(presence).toHaveAttribute('data-rendered', 'true');
  await presence
    .locator('canvas')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
  await expect(presence).not.toHaveAttribute('data-rendered', 'true');
  await expect(presence.locator('.gw-energy-fallback')).toBeVisible();
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(presence.locator('canvas')).toHaveCount(0);
  await expect(presence.locator('.gw-energy-fallback')).toBeVisible();
  await page.getByRole('button', { name: 'Open day workspace', exact: true }).click();
  await expect(page.locator('#command-depth')).toBeVisible();
  await expect(
    page.locator('#command-depth .aurelius-presence, #command-depth .orbit-signature'),
  ).toHaveCount(0);
});

test('prepared review move requires confirmation and one acknowledged saved-state refresh', async ({
  page,
}) => {
  const { sampleData } = await import('../../src/domains/daily/model');
  const saved = {
    ...sampleData('2026-09-21'),
    mode: 'personal',
    ownerId: '60000000-0000-4000-8000-000000000001',
  };
  const posts: unknown[] = [];
  await page.route('**/api/command', async (route) => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON());
      await route.fulfill({ json: { saved: true, day: '2026-09-21' } });
    } else await route.fulfill({ json: { data: saved, asOf: '2026-09-21T14:00:00Z' } });
  });
  await page.goto('http://127.0.0.1:3102/?mode=daily&state=carry');
  await expect(page.locator('.command-next')).toContainText('Call the partner');
  await page.setViewportSize({ width: 344, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Use this move today' }).click();
  await expect(page.getByRole('dialog')).toContainText('Your confirmed review');
  expect(posts).toEqual([]);
  await page.screenshot({ path: 'test-results/command-prepared-confirmation.png' });
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.command-next')).toContainText('Give the most important project');
  expect(posts).toEqual([
    {
      ownerId: saved.ownerId,
      day: '2026-09-21',
      version: 0,
      source: 'review',
      title: 'Call the partner',
      approve: true,
    },
  ]);
});
test('direct completion is deliberate, versioned and restores keyboard focus', async ({ page }) => {
  const { sampleData } = await import('../../src/domains/daily/model');
  const data = {
    ...sampleData('2026-09-21'),
    mode: 'personal',
    ownerId: '60000000-0000-4000-8000-000000000001',
  };
  const requests: unknown[] = [];
  await page.route('**/api/daily/complete', async (route) => {
    requests.push(route.request().postDataJSON());
    data.entries.find((e) => e.day === data.today)!.actions[1]!.done = true;
    await route.fulfill({ json: { done: true, version: 2 } });
  });
  await page.route('**/api/command', (route) =>
    route.fulfill({ json: { data, asOf: '2026-09-21T14:00:00Z' } }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=daily');
  const trigger = page.getByRole('button', { name: 'Mark complete' });
  await trigger.click();
  expect(requests).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Confirm completion', exact: true }).click();
  await expect(page.locator('.command-next')).toContainText('Check in with someone');
  await expect(trigger).toBeFocused();
  expect(requests).toEqual([
    { day: '2026-09-21', version: 1, actionId: '61000000-0000-4000-8000-000000000002' },
  ]);
});
test('acknowledged write with failed readback blocks replay until refresh succeeds', async ({
  page,
}) => {
  await page.route('**/api/daily/complete', (route) => route.fulfill({ json: { done: true } }));
  await page.route('**/api/command', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=daily');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByRole('button', { name: 'Confirm completion', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark complete' })).toBeDisabled();
  await expect(page.locator('.command-continuity')).toContainText('last loaded context');
  await expect(page.getByRole('heading', { name: 'Nothing needs you right now.' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reload saved context' })).toBeVisible();
  await page.screenshot({ path: 'test-results/command-readback-degraded.png', fullPage: true });
});
test('return refresh is bounded, reports real differences and protects a deeper draft', async ({
  page,
}) => {
  await page.clock.install();
  const { sampleData } = await import('../../src/domains/daily/model');
  const data = {
    ...sampleData('2026-09-21'),
    mode: 'personal',
    ownerId: '60000000-0000-4000-8000-000000000001',
  };
  data.entries.find((e) => e.day === data.today)!.actions[1]!.done = true;
  let reads = 0;
  await page.route('**/api/command', (route) => {
    reads++;
    return route.fulfill({ json: { data, asOf: '2026-09-21T14:00:00Z' } });
  });
  await page.goto('http://127.0.0.1:3102/?mode=daily');
  await page.clock.fastForward(61000);
  expect(reads).toBe(0); // There is no background polling.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.command-changes')).toContainText('saved plan changed');
  expect(reads).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(reads).toBe(1);
  await page.getByRole('button', { name: /^Day workspace/ }).click();
  await page.getByRole('button', { name: 'Update your check-in' }).click();
  await page.getByLabel('What matters most today?').fill('Keep my private draft');
  await page.clock.fastForward(61000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(reads).toBe(1);
  await expect(page.getByLabel('What matters most today?')).toHaveValue('Keep my private draft');
});
test('session loss clears private context and cannot revive it by exiting sample', async ({
  page,
}) => {
  await page.route('**/api/command', (route) =>
    route.fulfill({ status: 401, json: { error: 'Sign in' } }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=daily');
  await page.locator('.home-records > summary').filter({ hasText: 'Your saved context' }).click();
  await page.getByRole('button', { name: 'Refresh briefing' }).click();
  await expect(page.locator('.field-signal')).toHaveCount(0);
  await expect(page.getByText('Synthetic tester', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  await page.getByRole('button', { name: 'Exit sample' }).click();
  await expect(page.locator('.field-signal')).toHaveCount(0);
});

test('additional saved suggestions disclose progressively without urgency', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/?mode=daily&state=several');
  await expect(page.getByRole('heading', { name: 'One decision at a time.' })).toBeVisible();
  await expect(page.locator('.command-oversight')).toContainText('Protect 30 minutes for writing');
  const more = page.locator('.command-more-decisions');
  await expect(more.locator('li')).not.toBeVisible();
  await more.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(more.locator('li')).toHaveText('Call the partner');
  await expect(more).toContainText('No urgency is inferred');
});
test('Command preparation API denies anonymous and hostile-origin writes in production', async ({
  request,
}) => {
  const data = {
    ownerId: '60000000-0000-4000-8000-000000000001',
    day: '2026-09-21',
    version: 0,
    source: 'goal',
    title: 'Call the partner',
    approve: true,
  };
  const read = await request.get('/api/command');
  expect(read.status()).toBe(401);
  expect(read.headers()['cache-control']).toBe('private, no-store');
  const write = await request.post('/api/command', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data,
  });
  expect(write.status()).toBe(401);
  const hostile = await request.post('/api/command', {
    headers: { origin: 'https://hostile.test' },
    data,
  });
  expect(hostile.status()).toBe(403);
});

test('enlarged text preserves source inspection and linear field controls on a short phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app/daily');
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  await page.addStyleTag({ content: 'html{font-size:200%}' });
  const energy = page.getByRole('button', { name: /Energy/ });
  await energy.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.signal-detail')).toContainText('Energy entered by you: 4 of 5');
  await page.getByRole('button', { name: 'Close detail' }).click();
  await expect(energy).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .locator('.command-field')
    .screenshot({ path: 'test-results/command-large-text-field.png' });
});

test('recovered Command opens current domains and preserves the separate saved arrival path', async ({
  page,
}) => {
  await page.goto('/app/daily');
  await expect(page.locator('.command-environment .gw-energy-orb')).toBeVisible();
  const domains = page.getByRole('navigation', { name: 'Your operating spaces' });
  await expect(domains.getByRole('link', { name: /Performance/ })).toHaveAttribute(
    'href',
    '/app/performance',
  );
  await expect(domains.getByRole('link', { name: /Presence/ })).toHaveAttribute(
    'href',
    '/app/presence',
  );
  await expect(
    page
      .getByRole('region', { name: 'Talk with Aethelios' })
      .getByRole('link', { name: /Sign in to talk/ }),
  ).toBeVisible();
  await page.goto('/app/arrival');
  await expect(page.getByRole('heading', { name: 'Your day is waiting.' })).toBeVisible();
});

test('member home is immediately usable with no arrival or replay gate', async ({ page }) => {
  await page.goto('/app/daily');
  await expect(page.locator('.command-environment')).toBeVisible();
  await expect(page.locator('.command-opening')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replay arrival' })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.command-environment')).toBeVisible();
});

test('Fold resize retains selected saved signal without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/daily');
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  await page.getByRole('button', { name: /Energy/ }).click();
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByRole('button', { name: /Energy/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 740, height: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('real arrival summary connects to the preserved workspace and clears on session loss', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/?mode=daily-summary');
  await page.locator('.home-records > summary').filter({ hasText: 'Your saved context' }).click();
  const connection = page.getByRole('region', { name: 'Daily Command connection' });
  await expect(connection.getByRole('heading', { name: 'READY', exact: true })).toBeVisible();
  await expect(connection.getByRole('link', { name: 'Arrival & feedback' })).toHaveAttribute(
    'href',
    '/app/arrival',
  );
  await page.route('**/api/command', (route) =>
    route.fulfill({ status: 401, json: { error: 'Sign in again.' } }),
  );
  await page.getByRole('button', { name: 'Refresh briefing' }).click();
  await expect(connection).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore a sample day' })).toBeVisible();
});

test('Command without JavaScript explains the workspace requirement and keeps a public exit', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3100/app');
    await expect(
      page.getByText('If this screen stays here, enable JavaScript', { exact: false }),
    ).toBeVisible();
    const fallback = page.getByRole('navigation', { name: 'Workspace fallback' });
    await expect(fallback.getByRole('link', { name: 'Member entrance' })).toHaveAttribute(
      'href',
      '/enter',
    );
    await expect(fallback.getByRole('link', { name: 'Gent Ascend', exact: true })).toHaveAttribute(
      'href',
      '/',
    );
  } finally {
    await context.close();
  }
});
