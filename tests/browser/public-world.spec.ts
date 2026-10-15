import { expect, test } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`current public arrival, honest Lifestyle and member entrance at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Bring the ambition.*Build the company/ }),
    ).toBeVisible();
    await expect(page.locator('.world-wordmark img')).toBeVisible();
    expect(
      await page
        .locator('.world-wordmark img')
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    expect(
      await page.locator('.world-wordmark img').evaluate((img) => (img as HTMLImageElement).src),
    ).toContain('aethelios-human-ascendance-20261015-crest');
    await expect(page.getByRole('link', { name: 'Open Aethelios ↗', exact: true })).toHaveAttribute(
      'href',
      '/enter',
    );
    await page.screenshot({ path: `test-results/public-home-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Global navigation' })
      .getByRole('link', { name: 'Lifestyle', exact: true })
      .click();
    await expect(page).toHaveURL('/lifestyle');
    await expect(page.getByRole('heading', { name: /The art of.*living well/ })).toBeVisible();
    await expect(
      page.getByText('Live product availability is not connected yet.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /buy|checkout|add to cart/i })).toHaveCount(0);
    await page.goto('/shop/vitalis');
    await expect(
      page.getByRole('heading', { name: 'Product availability could not be verified.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /buy|checkout|add to cart/i })).toHaveCount(0);
    await page.goto('/enter');
    await expect(page.getByRole('heading', { name: 'The world becomes yours.' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'The entrance is being prepared.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore the collection/ })).toHaveAttribute(
      'href',
      '/shop',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}

test('member entrance keeps its story and exits in reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 344, height: 660 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/enter');
  await expect(page.getByRole('button', { name: 'Reduced motion' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'The world becomes yours.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Return to the journey/ })).toHaveAttribute(
    'href',
    '/',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

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
  // Root entry now varies by verified session; never share its redirect through a cache.
  expect((await request.get('/')).headers()['cache-control']).toContain('private');
  expect((await request.get('/app/install')).headers()['cache-control']).toContain('private');
});

test('install guide and reduced motion remain usable on a short phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 344, height: 660 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Bring the ambition/ })).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Global navigation' })).toBeHidden();
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
    const cache = await caches.open('gent-ascend-fallback-v8');
    return (await cache.keys()).map((request) => new URL(request.url).pathname).sort();
  });
  expect(cached).toEqual([
    '/brand/aethelios-official-20261015-192.png',
    '/offline.html',
    '/performance-offline.css',
    '/performance-offline.html',
    '/performance-offline.js',
    '/performance-store.js',
  ]);
  await context.setOffline(true);
  await page.goto('/app/progress');
  await expect(page.getByRole('heading', { name: 'A moment to reconnect.' })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('link', { name: 'Try Talk again' }).click();
  await expect(page).toHaveURL(/\/app\/aethelios$/);
  await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toBeVisible();
});
