import { test, expect } from './fixtures';

test('arrival uses the current crest and energy, never the retired film, then returns directly', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  const films: string[] = [];
  page.on('request', (request) => {
    if (/\.mp4(?:\?|$)/.test(request.url())) films.push(request.url());
  });
  await page.goto('/experience');
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await expect(page.locator('.gw-threshold')).toHaveAttribute('data-entering', 'true');
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 12000 });
  expect(films).toEqual([]);
  await page.goto('/experience');
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 3000 });
});

test('skip leaves arrival immediately and reduced motion bypasses replay', async ({ page }) => {
  await page.goto('/experience');
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await page.getByRole('link', { name: 'Skip entrance' }).click();
  await expect(page).toHaveURL(/\/experience\/world$/);
  await page.goto('/experience');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Replay entrance' }).click();
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 3000 });
});

test('Data Saver enters without playing an arrival', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'connection', {
      value: Object.assign(new EventTarget(), { saveData: true }),
      configurable: true,
    }),
  );
  await page.goto('/experience');
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 3000 });
});

for (const width of [360, 768, 1440]) {
  test(`current arrival can be replayed at ${width}px without the old video`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.addInitScript(() => localStorage.setItem('gent-entrance-seen-v2', 'true'));
    await page.goto('/experience/world');
    await page.getByRole('link', { name: 'Replay experience', exact: true }).click();
    await expect(page).toHaveURL(/\/experience\?replay=1$/);
    await page.getByRole('link', { name: 'Replay experience', exact: true }).click();
    await expect(page.locator('.gw-threshold')).toHaveAttribute('data-entering', 'true');
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page).toHaveURL(/\/experience\/world$/, { timeout: 12000 });
  });
}
