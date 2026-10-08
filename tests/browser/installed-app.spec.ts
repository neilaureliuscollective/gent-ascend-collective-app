import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { test, expect } from './fixtures';

test('fresh installation has one current crest identity across manifest and Apple/browser icons', async ({
  page,
  request,
}) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/app');
  expect(manifest.icons).toHaveLength(3);
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
    '/brand/aether-20261007-192.png',
    '/brand/aether-20261007-512.png',
    '/brand/aether-20261007-maskable-512.png',
  ]);
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
    const metadata = await sharp(await response.body()).metadata();
    expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes);
  }
  expect(manifest.icons.filter((icon: { purpose: string }) => icon.purpose === 'any')).toHaveLength(
    2,
  );
  const mask = await request.get(manifest.icons[2].src);
  // Preserve the approved textured asset. Physical launcher mask acceptance is separate.
  expect(
    createHash('sha256')
      .update(await mask.body())
      .digest('hex'),
  ).toBe('fe8a377931bfb0796b933800da9dcf08c7e9ee55e2410d290d19034073593970');
  await page.goto('/app/install');
  for (const [relation, size] of [
    ['apple-touch-icon', 180],
    ['icon', 64],
  ] as const) {
    const href = await page.locator(`link[rel="${relation}"]`).getAttribute('href');
    expect(href).toBeTruthy();
    const image = await request.get(href!);
    expect(image.ok()).toBe(true);
    const metadata = await sharp(await image.body()).metadata();
    expect(metadata.width).toBe(size);
  }
  await page.getByText('Refresh an older app icon', { exact: true }).click();
  await expect(page.getByText(/Review app update/)).toBeVisible();
});

test('fallback upgrade removes old app cache without reloading the open workspace or unrelated caches', async ({
  page,
}) => {
  await page.goto('/enter');
  await page.evaluate(async () => {
    const old = await caches.open('gent-ascend-fallback-v3');
    await old.put('/brand/icon-v2-192.png', new Response('old-icon'));
    const unrelated = await caches.open('unrelated-test-cache');
    await unrelated.put('/keep', new Response('keep'));
  });
  await page.goto('/app/install');
  await page.evaluate(() => {
    (window as Window & { draftSentinel?: string }).draftSentinel = 'unsaved-draft';
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return {
          cache: await caches.keys(),
          controlled: Boolean(navigator.serviceWorker.controller),
          waiting: Boolean(registration.waiting),
          updateViaCache: registration.updateViaCache,
        };
      }),
    )
    .toEqual({
      cache: ['unrelated-test-cache', 'gent-ascend-fallback-v5'],
      controlled: true,
      waiting: false,
      updateViaCache: 'none',
    });
  expect(
    await page.evaluate(() => (window as Window & { draftSentinel?: string }).draftSentinel),
  ).toBe('unsaved-draft');
});

for (const platform of ['Android', 'Apple'] as const) {
  test(`${platform} standalone return opens Aethelios immediately without an entrance`, async ({
    page,
  }) => {
    await page.addInitScript((platform) => {
      if (platform === 'Apple') Object.defineProperty(navigator, 'standalone', { value: true });
      else {
        const original = window.matchMedia.bind(window);
        window.matchMedia = (query) => {
          const result = original(query);
          if (query === '(display-mode: standalone)')
            Object.defineProperty(result, 'matches', { value: true });
          return result;
        };
      }
    }, platform);
    await page.clock.install();
    await page.goto('/app');
    await expect(page.locator('.aethelios-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Replay arrival' })).toHaveCount(0);
    await page.clock.runFor(500);
    await expect(page.locator('.command-opening')).toHaveCount(0);
    await page.clock.runFor(1900);
    await expect(page.locator('.command-opening')).toHaveCount(0);
  });
}
