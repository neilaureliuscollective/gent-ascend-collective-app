import { test, expect } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
});

test('film loads only on entry, plays inline, and returns directly next visit', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 850 });
  let requested = false;
  page.on('request', (request) => {
    if (request.url().endsWith('collective-journey-v1.mp4')) requested = true;
  });
  await page.goto('/experience');
  await expect(page.getByRole('button', { name: 'Replay entrance' })).toBeVisible();
  expect(requested).toBe(false);
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await page.waitForFunction(() => {
    const film = document.querySelector('video');
    return film && film.currentTime > 3 && !film.paused;
  });
  expect(requested).toBe(true);
  const video = page.locator('video');
  await expect(video).toHaveAttribute('playsinline', '');
  expect(await video.evaluate((v) => (v as HTMLVideoElement).muted)).toBe(true);
  await page.screenshot({ path: info.outputPath('product-film-mobile.png') });
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.gw-cinematic-arrival')!).opacity) > 0.9,
  );
  await page.screenshot({ path: info.outputPath('orb-arrival-mobile.png') });
  await expect(page).toHaveURL(/\/experience\/world$/);
  await page.goto('/experience');
  requested = false;
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 3000 });
  expect(requested).toBe(false);
});

test('failed media preserves crest then enters through orb fallback', async ({ page }) => {
  await page.route('**/collective-journey-v1.mp4', (route) => route.abort());
  await page.goto('/experience');
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.gw-arrival-name')!).opacity) > 0.9,
  );
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 12000 });
});

test('skip stops an active film and still mode bypasses replay', async ({ page }) => {
  await page.goto('/experience');
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await page.waitForFunction(() => (document.querySelector('video')?.currentTime ?? 0) > 0.5);
  await page.getByRole('link', { name: 'Skip entrance' }).click();
  await expect(page).toHaveURL(/\/experience\/world$/);
  await page.goto('/experience');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Replay entrance' }).click();
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 3000 });
});

test('Data Saver enters without fetching film', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'connection', {
      value: Object.assign(new EventTarget(), { saveData: true }),
      configurable: true,
    }),
  );
  let requested = false;
  page.on('request', (request) => {
    if (request.url().endsWith('collective-journey-v1.mp4')) requested = true;
  });
  await page.goto('/experience');
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 3000 });
  expect(requested).toBe(false);
});
