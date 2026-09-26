import { expect, test } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`public arrival, product preview and member entrance at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'A life, deliberately built.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Make today yours.' })).toHaveCount(0);
    await expect(page.locator('.estate-landscape img')).toBeVisible();
    expect(
      await page
        .locator('.estate-landscape img')
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Still mode', exact: true }).click();
    await expect(page.locator('.estate-journey')).toHaveAttribute('data-still', 'true');
    await page.screenshot({ path: `test-results/public-home-${width}.png`, fullPage: true });
    if (width <= 850) await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Public navigation' })
      .getByRole('link', { name: 'Shop', exact: true })
      .click();
    await expect(page).toHaveURL('/shop');
    await page.getByRole('link', { name: /Vitalis/ }).click();
    await expect(page).toHaveURL('/shop/vitalis');
    await expect(
      page.getByText('This item is not available to order.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /buy|cart|checkout/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/reserve');
    await expect(page.getByRole('heading', { name: 'The Reserve at Sanctum.' })).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/barbershop/i);
    await page.goto('/enter');
    await expect(page).toHaveURL('/app/you');
    expect(errors).toEqual([]);
  });
}

test('legacy routes retain destinations and the installed app opens Command', async ({
  request,
}) => {
  for (const path of [
    'you',
    'welcome',
    'world',
    'goals',
    'progress',
    'captures',
    'ascend-profile',
    'founder/pilot',
  ]) {
    const response = await request.get(`/${path}`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(`/app/${path}`);
  }
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/app');
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('/');
  expect((await request.get('/')).headers()['cache-control']).not.toContain('private');
  expect((await request.get('/app/install')).headers()['cache-control']).toContain('private');
});

test('install guide and reduced motion remain usable on a short phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 344, height: 660 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.scene-orbit')).toBeHidden();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Explore', exact: true })).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeHidden();
  await page.goto('/app/install');
  await page.getByText('Android / Samsung Fold', { exact: true }).click();
  await expect(page.getByText('The layout adapts as you fold', { exact: false })).toBeVisible();
  await expect(page.getByText('iPhone / iPad', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('offline fallback caches no personal responses', async ({ page, context }) => {
  await page.goto('/app/install');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const cache = await caches.open('gent-ascend-fallback-v1');
    return (await cache.keys()).map((request) => new URL(request.url).pathname).sort();
  });
  expect(cached).toEqual(['/brand/icon-192.png', '/offline.html']);
  await context.setOffline(true);
  await page.goto('/app/progress');
  await expect(page.getByRole('heading', { name: 'A moment to reconnect.' })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('link', { name: 'Try Command again' }).click();
  await expect(page.getByRole('heading', { name: 'Make today yours.' })).toBeVisible();
});
