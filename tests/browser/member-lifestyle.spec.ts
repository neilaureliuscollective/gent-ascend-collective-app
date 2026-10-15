import { openGlobalMenu, globalDestinations, globalMenu } from '../support/global-navigation';
import { expect, test } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:3102' });

async function fixtureImages(page: import('@playwright/test').Page) {
  await page.route('https://cdn.shopify.com/fixture/*.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#161616"/><text x="40" y="120" fill="#f2f2ee" font-size="32">SYNTHETIC PHOTO</text></svg>',
    }),
  );
}

function mainNav(page: import('@playwright/test').Page) {
  return page.getByRole('navigation', { name: 'Main navigation' });
}

for (const width of [344, 720, 1440]) {
  test(`member Lifestyle home composition at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixtureImages(page);
    await page.goto('http://127.0.0.1:3102/?mode=lifestyle-member');
    await expect(page.getByText('Synthetic commerce fixture', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your collection.' })).toBeVisible();
    await expect(mainNav(page).getByRole('link')).toHaveText(['Home', 'Talk', 'Work', 'Architect']);
    await openGlobalMenu(page);
    const destinations = globalDestinations(page);
    for (const [name, href] of [['Studio', '/app/studio'], ['Health', '/app/health'], ['Lifestyle', '/app/lifestyle'], ['Ecosystem', '/app/ecosystem']] as const) {
      await expect(destinations.getByRole('link', { name, exact: true })).toBeVisible();
      await expect(destinations.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    await expect(destinations.getByRole('link', { name: 'Lifestyle', exact: true })).toHaveAttribute('aria-current', 'page');
    await globalMenu(page).getByRole('button', { name: 'Close Aethelios menu', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Explore the collection' })).toHaveAttribute(
      'href',
      '/app/collection',
    );
    await expect(page.getByRole('link', { name: 'Open Cabinet' }).first()).toHaveAttribute(
      'href',
      '/app/collection/cabinet',
    );
    await expect(page.getByRole('link', { name: 'Open Grooming' }).first()).toHaveAttribute(
      'href',
      '/app/grooming',
    );
    await expect(
      page
        .getByRole('navigation', { name: 'Shopping utilities' })
        .getByRole('link', { name: 'Cart' }),
    ).toHaveAttribute('href', '/app/collection/cart');
    await expect(
      page
        .getByRole('navigation', { name: 'Shopping utilities' })
        .getByRole('link', { name: 'Orders' }),
    ).toHaveAttribute('href', '/app/collection/orders');
    await expect(page.getByText('Nothing is saved yet.', { exact: false })).toBeVisible();
    await expect(page.getByText('No ritual is recorded yet.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Legacy Reserve', exact: true })).toHaveCount(0);
    await expect(page.getByRole('img', { name: /Vitalis hair and beard oil/ })).toBeVisible();
    await expect(page.getByText('Aethelios Human Ascendance', { exact: false })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Synthetic front image' }).first()).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/↗|→|←/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 1440) {
      const focal = await page.locator('.member-lifestyle-focal').first().boundingBox();
      expect(focal?.height ?? 9999).toBeGreaterThanOrEqual(280);
      expect(focal?.height ?? 9999).toBeLessThan(360);
    }
    await page.screenshot({
      path: `docs/evidence/lifestyle/member-home-${width}-fold.png`,
      fullPage: false,
      animations: 'disabled',
    });
    await page.screenshot({
      path: `docs/evidence/lifestyle/member-home-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('empty catalog and returning Cabinet stay honest', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-member&empty=1');
  await expect(page.getByText('The collection is being prepared.')).toBeVisible();
  await expect(page.getByText('recommended for you', { exact: false })).toHaveCount(0);
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-member&unconfigured=1');
  await expect(page.getByText('Live product availability is not connected yet.')).toBeVisible();
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-member&error=1');
  await expect(page.getByText('The collection could not refresh.')).toBeVisible();
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-member&cabinet=1');
  await expect(page.getByText('Owned')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Synthetic Cabinet oil' })).toHaveAttribute(
    'href',
    '/app/collection/fixture-oil',
  );
  await expect(page.getByText('1 active ritual')).toBeVisible();
  await expect(page.getByText('5 products marked as kept')).toBeVisible();
  await page.screenshot({
    path: 'docs/evidence/lifestyle/member-cabinet-return-1440.png',
    fullPage: true,
    animations: 'disabled',
  });
});

for (const width of [344, 1440]) {
  test(`member collection and product materials at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixtureImages(page);
    await page.goto('http://127.0.0.1:3102/?mode=lifestyle-list');
    await expect(page.getByRole('heading', { name: 'The Collection.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Your Cabinet' })).toBeVisible();
    await openGlobalMenu(page);
    await expect(globalDestinations(page).getByRole('link', { name: 'Lifestyle', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `docs/evidence/lifestyle/member-collection-${width}-fold.png`,
      fullPage: false,
      animations: 'disabled',
    });
    await page.screenshot({
      path: `docs/evidence/lifestyle/member-collection-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto('http://127.0.0.1:3102/?mode=lifestyle-product');
    await expect(page.getByRole('heading', { name: /Fixture Vitalis/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Cabinet and Grooming' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Cabinet and Grooming' })).toHaveCount(1);
    await page.screenshot({
      path: `docs/evidence/lifestyle/member-product-${width}-fold.png`,
      fullPage: false,
      animations: 'disabled',
    });
    await page.screenshot({
      path: `docs/evidence/lifestyle/member-product-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('product decision area keeps Cabinet distinct from purchasing', async ({ page }) => {
  await fixtureImages(page);
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'aethelios-catalog-return',
      JSON.stringify({
        href: '/app/collection?q=oil&chapter=grooming',
        scroll: 180,
        context: 'member',
      }),
    );
  });
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-product');
  await expect(page.getByRole('link', { name: 'The collection' })).toHaveAttribute(
    'href',
    '/app/collection?q=oil&chapter=grooming',
  );
  const decision = page.locator('.reserve-product-copy');
  await expect(decision.getByRole('button', { name: 'Add to cart' }).first()).toBeVisible();
  await expect(decision.getByRole('region', { name: 'Cabinet and Grooming' })).toBeVisible();
  await expect(decision.getByRole('link', { name: 'Open Cabinet' })).toHaveAttribute(
    'href',
    '/app/collection/cabinet',
  );
  await expect(decision.getByRole('link', { name: 'Open Grooming' })).toHaveAttribute(
    'href',
    '/app/grooming',
  );
});

test('stale public catalog return does not restore a member product', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'aethelios-catalog-return',
      JSON.stringify({ href: '/shop?q=oil', scroll: 90, context: 'public' }),
    );
  });
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-product');
  await expect(page.getByRole('link', { name: 'The collection' })).toHaveAttribute(
    'href',
    '/app/collection',
  );
});
