import { test, expect } from './fixtures';
test('entrance holds the illuminated brand, starts sound and completes', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/experience');
  await expect(page.getByRole('button', { name: 'Pause ambient motion' })).toBeVisible();
  const started = Date.now();
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await expect(page.getByRole('button', { name: 'Mute ambient sound' })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.gw-arrival-name')!).opacity) > .95);
  expect(page.url()).toContain('/experience');
  expect(await page.locator('.gw-crest-flight').evaluate(e => getComputedStyle(e).mixBlendMode)).toBe('screen');
  await page.screenshot({ path: info.outputPath('entrance-awakening.png'), animations: 'allow' });
  await expect(page).toHaveURL(/\/experience\/world$/);
  expect(Date.now() - started).toBeGreaterThan(3600);
  await page.getByRole('button', { name: 'Mute ambient sound' }).click();
  await page.goto('/experience');
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await expect(page.getByRole('button', { name: 'Enable ambient sound' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('link', { name: 'Skip entrance' }).click();
  await expect(page).toHaveURL(/\/experience\/world$/);
});
test('reduced motion enters directly and remembered mute stays off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('gent-world-muted', 'true'));
  await page.goto('/experience');
  await page.getByRole('link', { name: /^ENTER/ }).click();
  await expect(page).toHaveURL(/\/experience\/world$/);
  await expect(page.getByRole('button', { name: 'Enable ambient sound' })).toHaveAttribute('aria-pressed', 'false');
});
