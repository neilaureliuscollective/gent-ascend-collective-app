import { test, expect } from './fixtures';
// The former storefront is retired in main. Product records and orders retain separate tests.
for (const width of [344, 768, 1440])
  test(
    'retired commerce boundary /app/collection at ' + width + 'px',
    async ({ page, request }) => {
      await page.setViewportSize({ width, height: 900 });
      const writes: string[] = [];
      page.on('request', (r) => {
        if (r.method() !== 'GET' && r.url().includes('/api/commerce')) writes.push(r.url());
      });
      await page.goto('/app/collection');
      await expect(page.getByRole('heading', { name: 'A separate destination.' })).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Open Aethelios ↗', exact: true }),
      ).toHaveAttribute('href', '/app/aethelios');
      await expect(page.getByRole('link', { name: 'Earlier order history' })).toHaveAttribute(
        'href',
        '/app/collection/orders',
      );
      await expect(page.getByRole('button', { name: /Add to cart|Checkout/ })).toHaveCount(0);
      expect(writes).toEqual([]);
      expect((await request.get('/app/collection')).headers()['cache-control']).toContain(
        'private',
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    },
  );
