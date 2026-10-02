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
    await expect(page).toHaveURL(/\/experience\/world$/);
    await expect(
      page.getByRole('heading', { name: 'The parts belong to one life.' }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath('world.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'All destinations' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'All destinations' })).toBeFocused();
    await page.getByLabel('My next move').fill('Tomorrow at 7, I will make time for training.');
    await page.getByRole('button', { name: 'Set my direction' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Your direction:' })).toContainText(
      'Tomorrow at 7',
    );
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
    await expect(page.getByText('1 of 6 sets recorded')).toBeVisible();
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
  await expect(page).toHaveURL(/\/experience\/world$/);
  await expect(page.locator('.gent-world')).toHaveAttribute('data-moving', 'false');
  await page.getByRole('button', { name: 'Aethelios', exact: false }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('link', { name: 'Open your conversation' }).click();
  await expect(page).toHaveURL(/\/experience\/aethelios$/);
  await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/experience\/world$/);
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
