import { test, expect } from './fixtures';

for (const width of [360, 768, 1440]) {
  test(`world slice remains usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/experience');
    await page.screenshot({ path: testInfo.outputPath('threshold.png'), animations: 'disabled' });
    await expect(
      page.getByRole('link', { name: 'ENTER', exact: false }).filter({ hasText: /^ENTER/ }),
    ).toBeVisible();
    await page.getByRole('link', { name: /^ENTER/ }).click();
    await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 25000 });
    await expect(page.getByRole('heading', { name: 'One life. Your world.' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      );
    });
    await page.screenshot({
      path: testInfo.outputPath('world.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'All destinations' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'All destinations' })).toBeFocused();
    await page.getByRole('button', { name: 'Find my next move' }).click();
    await page.getByLabel('My next move').fill('Tomorrow at 7, I will make time for training.');
    await page.getByRole('button', { name: 'Set my direction' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Your direction:' })).toContainText(
      'Tomorrow at 7',
    );
    await page.getByRole('button', { name: 'Close Your next move', exact: true }).click();
    await page.getByRole('link', { name: 'Enter Performance' }).click();
    await expect(
      page.getByRole('heading', { name: 'Strength for the life you carry.' }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('performance.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('link', { name: 'Enter your practice' }).click();
    await expect(page.getByRole('heading', { name: 'Try the practice.' })).toBeVisible();
    let writes = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/performance') && r.method() === 'POST') writes++;
    });
    await page.getByRole('button', { name: 'Try recording a set' }).click();
    await page.getByLabel('Set 1 reps', { exact: true }).fill('10');
    await page
      .getByRole('button', { name: /Record set/ })
      .first()
      .click();
    await expect(page.getByText('1/6 sets recorded')).toBeVisible();
    await page.getByRole('button', { name: /Finish/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sample complete' })).toContainText(
      'Sample complete',
    );
    expect(writes).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath('practice.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Try recording a set' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('reduced motion, direct entry, Aethelios and history preserve orientation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/experience');
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 25000 });
  await expect(page.locator('.gent-world')).toHaveAttribute('data-moving', 'false');
  await page.getByRole('button', { name: 'Aethelios', exact: false }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('link', { name: 'Open your conversation' }).click();
  await expect(page).toHaveURL(/\/experience\/aethelios$/);
  await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 25000 });
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('missing scenery and unavailable graphics never block entry', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.route('**/media/world/**', (route) => route.abort());
  await page.route('**/_next/image?**', (route) => route.abort());
  await page.goto('/experience');
  await page.getByRole('link', { name: 'Skip entrance' }).click();
  await expect(page.getByRole('link', { name: 'Enter Performance' })).toBeVisible();
  await page.getByRole('link', { name: 'Enter Performance' }).click();
  await expect(page.getByRole('link', { name: 'Enter your practice' })).toBeVisible();
});

test('sound is opt-in and pauses for Aethelios; private world pages are not cacheable', async ({
  page,
  request,
}) => {
  await page.goto('/experience/world');
  await expect(page.getByRole('button', { name: 'Enable ambient sound' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Enable ambient sound' }).click();
  await expect(page.getByRole('button', { name: 'Mute ambient sound' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Aethelios', exact: false }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Enable ambient sound' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enable ambient sound' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  for (const path of ['/experience/performance/practice', '/experience/aethelios']) {
    const response = await request.get(path);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

for (const width of [344, 390, 768, 1440]) {
  test(`spatial world selection, return and focused direction at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/experience/world');
    const nav = page.getByRole('navigation', { name: 'Choose a destination' });
    for (const [name, id, href] of [
      ['Grooming', 'grooming', '/experience/grooming'],
      ['Direction', 'focus', '/app/ascend'],
      ['Creation', 'work', '/app/studio'],
      ['Performance', 'performance', '/experience/performance'],
    ]) {
      const control = nav.getByRole('button', { name, exact: true });
      await control.click();
      await expect(control).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('link', { name: `Enter ${name}` })).toHaveAttribute(
        'href',
        href!,
      );
      await expect(page).toHaveURL(new RegExp(`world=${id}`));
      const box = await control.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await nav.getByRole('button', { name: 'Grooming', exact: true }).click();
    await page.reload();
    await expect(nav.getByRole('button', { name: 'Grooming' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByLabel('My next move')).not.toBeVisible();
    await page.getByRole('button', { name: 'Find my next move' }).click();
    await page.getByLabel('My next move').fill('Make time for one deliberate action.');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Find my next move' })).toBeFocused();
    await page.getByRole('button', { name: 'Find my next move' }).click();
    await expect(page.getByLabel('My next move')).toHaveValue(
      'Make time for one deliberate action.',
    );
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('ambient scenery pauses for dialogs and Still; direct reflection link remains usable', async ({
  page,
}) => {
  await page.goto('/experience/world');
  const world = page.locator('.gw-atlas');
  await expect(world).toHaveAttribute('data-animated', 'true');
  await page.getByRole('button', { name: 'Find my next move' }).click();
  await expect(world).toHaveAttribute('data-animated', 'false');
  await page.keyboard.press('Escape');
  await expect(world).toHaveAttribute('data-animated', 'true');
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(world).toHaveAttribute('data-animated', 'false');
  await expect(page.locator('.gw-chamber')).toHaveCSS('animation-play-state', 'paused');
  await page.goto('/experience/world?world=focus#direction');
  await expect(page.getByRole('dialog', { name: 'Your next move' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/world\?world=focus$/);
});

test('data saver and forced colors retain all navigation without enhanced graphics', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      value: Object.assign(new EventTarget(), { saveData: true }),
    });
  });
  await page.goto('/experience/world?world=grooming');
  await expect(page.locator('.gw-atlas')).toHaveAttribute('data-animated', 'false');
  await expect(page.locator('.gw-scenery')).toHaveCount(0);
  await expect(page.locator('.presence-canvas')).toHaveCount(0);
  await page.emulateMedia({ forcedColors: 'active' });
  const control = page
    .getByRole('navigation', { name: 'Choose a destination' })
    .getByRole('button', { name: 'Performance' });
  await control.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Enter Performance' })).toBeVisible();
});

test('phone actions clear the dock; short screens and enlarged text remain reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 850 });
  await page.goto('/experience/world');
  const utilities = await page.locator('.gw-world-utilities').boundingBox();
  const dock = await page.locator('.gw-dock').boundingBox();
  expect(utilities!.y + utilities!.height).toBeLessThan(dock!.y - 8);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: 'html { font-size: 24px !important; }' });
  await page.getByRole('button', { name: 'All destinations' }).click();
  await expect(page.getByRole('dialog', { name: 'Your destinations' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Enter Performance' }).click();
  await expect(page.getByRole('link', { name: 'Enter your practice' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('direct world entry is server-rendered with the selected action and image preload', async ({
  request,
}) => {
  const response = await request.get('/experience/world?world=grooming');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('id="world-heading"');
  expect(html).toContain('href="/experience/grooming"');
  expect(html).toContain('whole-man-chamber-v2.webp');
  expect(html).not.toContain('Opening your world');
});

test('energy orb renders, survives context loss and retains its Still identity', async ({
  page,
}) => {
  await page.goto('/experience/world');
  const orb = page.locator('.gw-atlas .gw-energy-orb');
  await expect(orb).toHaveAttribute('data-rendered', 'true');
  await expect(orb.locator('canvas')).toBeVisible();
  expect(
    await orb.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width),
  ).toBeLessThanOrEqual(480);
  await orb.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(orb).not.toHaveAttribute('data-rendered', 'true');
  await expect(orb.locator('svg')).toBeVisible();
  await page.getByRole('button', { name: 'Grooming', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Enter Grooming' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(orb.locator('canvas')).toHaveCount(0);
  await expect(orb.locator('svg')).toBeVisible();
});
