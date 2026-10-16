import { chromium } from '@playwright/test';

const out = '/opt/cursor/artifacts/lifestyle-product-world';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: out, size: { width: 1440, height: 900 } },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
await page.route('https://cdn.shopify.com/fixture/*.png', (route) =>
  route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#161616"/><text x="40" y="120" fill="#f2f2ee" font-size="32">SYNTHETIC PHOTO</text></svg>',
  }),
);
await page.route('**/api/commerce/cart', async (route) => {
  const input = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
  const quantity = input?.quantity ?? 1;
  await route.fulfill({
    json: {
      cart: {
        totalQuantity: quantity,
        cost: {
          subtotalAmount: { amount: String(quantity * 24), currencyCode: 'USD' },
          totalAmount: { amount: String(quantity * 24), currencyCode: 'USD' },
        },
        lines: {
          nodes: [
            {
              id: 'gid://shopify/CartLine/fixture',
              quantity,
              cost: { totalAmount: { amount: String(quantity * 24), currencyCode: 'USD' } },
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
await page.goto('http://127.0.0.1:3102/?mode=lifestyle-member&empty=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.goto('http://127.0.0.1:3102/?mode=lifestyle-member', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.goto('http://127.0.0.1:3102/?mode=lifestyle-list', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.goto('http://127.0.0.1:3102/?mode=lifestyle-product', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('.commerce-add').click();
await page.waitForTimeout(600);
await page.goto('http://127.0.0.1:3102/?mode=lifestyle-cart', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const video = page.video();
await page.close();
const path = await video?.path();
await context.close();
await browser.close();
if (path) {
  const { copyFileSync } = await import('node:fs');
  copyFileSync(path, `${out}/lifestyle_fixture_journey.webm`);
  console.log(`${out}/lifestyle_fixture_journey.webm`);
}
