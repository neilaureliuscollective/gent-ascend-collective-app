import { expect, test } from './fixtures';

test('in-app identity uses the Human Ascendance lockup and keeps the install icon', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.world-wordmark img')).toBeVisible();
  expect(
    await page.locator('.world-wordmark img').evaluate((img) => (img as HTMLImageElement).src),
  ).toContain('aethelios-human-ascendance-20261015-crest');
  expect(
    await page.locator('.imperial-presence-mark').evaluate((img) => (img as HTMLImageElement).src),
  ).toContain('aethelios-human-ascendance-20261015-lockup');
  expect(
    await page.locator('.footer-crest').evaluate((img) => (img as HTMLImageElement).src),
  ).toContain('aethelios-human-ascendance-20261015-lockup');
  expect(
    await page.locator('.world-wordmark img').evaluate((img) => getComputedStyle(img).borderRadius),
  ).toBe('0px');
  await page.screenshot({ path: 'test-results/human-ascendance-home.png', fullPage: true });

  await page.goto('/enter');
  expect(
    await page.locator('.entrance-emblem img').evaluate((img) => (img as HTMLImageElement).src),
  ).toContain('aethelios-human-ascendance-20261015-lockup');
  await page.screenshot({ path: 'test-results/human-ascendance-enter.png', fullPage: true });

  await page.goto('/about');
  expect(
    await page.locator('.story-lockup').evaluate((img) => (img as HTMLImageElement).src),
  ).toContain('aethelios-human-ascendance-20261015-lockup');
  await page.screenshot({ path: 'test-results/human-ascendance-about.png', fullPage: true });

  await page.goto('/app');
  await expect(page.locator('.brand-seal').first()).toBeVisible();
  expect(
    await page
      .locator('.brand-seal')
      .first()
      .evaluate((img) => (img as HTMLImageElement).src),
  ).toContain('aethelios-human-ascendance-20261015-crest');
  await page.screenshot({ path: 'test-results/human-ascendance-command.png' });

  await page.goto('/lifestyle');
  expect(
    await page.locator('.lifestyle-lockup').evaluate((img) => (img as HTMLImageElement).src),
  ).toContain('aethelios-human-ascendance-20261015-crest');
  await page.screenshot({ path: 'test-results/human-ascendance-lifestyle.png', fullPage: true });

  const manifest = await (await request.get('/manifest.webmanifest')).json();
  for (const icon of manifest.icons) {
    expect(icon.src).toContain('aethelios-official-20261015');
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  expect((await request.get('/icon.png')).ok()).toBe(true);
  expect((await request.get('/apple-icon.png')).ok()).toBe(true);
  expect((await request.get('/opengraph-image.png')).ok()).toBe(true);
});
