import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.env.LIFESTYLE_CAPTURE_DIR || '/opt/cursor/artifacts/lifestyle-product-world';
mkdirSync(out, { recursive: true });

const views = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'fold', width: 884, height: 690 },
  { name: 'desktop', width: 1440, height: 900 },
];

const journeys = [
  { id: 'opening-ready', path: '/?mode=lifestyle-member' },
  { id: 'opening-house-art', path: '/?mode=lifestyle-member&empty=1' },
  { id: 'public-opening', path: '/?mode=lifestyle-home' },
  { id: 'catalog', path: '/?mode=lifestyle-list' },
  { id: 'product', path: '/?mode=lifestyle-product' },
  { id: 'bag', path: '/?mode=lifestyle-cart' },
];

const timings = [];
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const view of views) {
  const page = await browser.newPage({ viewport: { width: view.width, height: view.height } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://cdn.shopify.com/fixture/*.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#161616"/><text x="40" y="120" fill="#f2f2ee" font-size="32">SYNTHETIC PHOTO</text></svg>',
    }),
  );
  if (journeys.some((item) => item.id === 'bag')) {
    await page.route('**/api/commerce/cart', async (route) => {
      await route.fulfill({
        json: {
          cart: {
            totalQuantity: 1,
            cost: {
              subtotalAmount: { amount: '24.00', currencyCode: 'USD' },
              totalAmount: { amount: '24.00', currencyCode: 'USD' },
            },
            lines: {
              nodes: [
                {
                  id: 'gid://shopify/CartLine/fixture',
                  quantity: 1,
                  cost: { totalAmount: { amount: '24.00', currencyCode: 'USD' } },
                  merchandise: {
                    id: 'gid://shopify/ProductVariant/fixture',
                    title: '30 ml',
                    product: {
                      handle: 'fixture-oil',
                      title: 'Synthetic oil',
                      requiresSellingPlan: false,
                      featuredImage: {
                        url: 'https://cdn.shopify.com/fixture/front.png',
                        altText: 'Synthetic front image',
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      });
    });
  }
  for (const journey of journeys) {
    const started = Date.now();
    await page.goto(`http://127.0.0.1:3102${journey.path}`, { waitUntil: 'networkidle' });
    const durationMs = Date.now() - started;
    const paint = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        load: nav ? Math.round(nav.loadEventEnd) : null,
      };
    });
    timings.push({ view: view.name, journey: journey.id, gotoMs: durationMs, ...paint });
    await page.screenshot({
      path: `${out}/${journey.id}-${view.name}.png`,
      fullPage: false,
      animations: 'disabled',
    });
  }
  await page.close();
}

writeFileSync(`${out}/fixture-timings.json`, JSON.stringify({ capturedAt: new Date().toISOString(), timings }, null, 2));
await browser.close();
console.log(JSON.stringify(timings, null, 2));
