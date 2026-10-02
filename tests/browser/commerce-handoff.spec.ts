import { expect, test } from './fixtures';

test('a delayed cart refresh cannot restore removed merchandise', async ({ page }) => {
  const original = {
    id: 'synthetic-cart',
    checkoutUrl: 'https://example.test/unused',
    totalQuantity: 1,
    cost: {
      subtotalAmount: { amount: '24.00', currencyCode: 'USD' },
      totalAmount: { amount: '24.00', currencyCode: 'USD' },
    },
    lines: {
      nodes: [
        {
          id: 'line',
          quantity: 1,
          cost: { totalAmount: { amount: '24.00', currencyCode: 'USD' } },
          merchandise: {
            id: 'variant',
            title: '30 ml',
            product: {
              title: 'Race fixture',
              handle: 'race-fixture',
              featuredImage: null,
              launchState: { value: 'ready' },
              requiresSellingPlan: false,
            },
          },
        },
      ],
    },
  };
  let reads = 0;
  let release!: () => void;
  let started!: () => void;
  let completed!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  const done = new Promise<void>((resolve) => {
    completed = resolve;
  });
  await page.route('**/api/commerce/cart', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: { cart: { ...original, totalQuantity: 0, lines: { nodes: [] } } },
      });
    } else {
      if (++reads === 2) {
        started();
        await waiting;
      }
      await route.fulfill({ json: { cart: original } });
      if (reads === 2) completed();
    }
  });
  await page.goto('/shop/cart');
  await expect(page.getByRole('button', { name: 'Remove Race fixture from cart' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('gent-ascend-cart-updated')));
  await pending;
  await page.getByRole('button', { name: 'Remove Race fixture from cart' }).click();
  await expect(page.getByText('Your cart is ready when you are.')).toBeVisible();
  release();
  await done;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByRole('button', { name: 'Remove Race fixture from cart' })).toHaveCount(0);
  await expect(page.getByText('Your cart is ready when you are.')).toBeVisible();
});

test('purchase review exposes approved terms and updates the item subtotal', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/?mode=commerce');
  await page
    .getByRole('combobox', { name: 'Choose an option' })
    .selectOption('gid://shopify/ProductVariant/fixture-large');
  await page.getByRole('combobox', { name: 'Quantity' }).selectOption('3');
  await expect(page.locator('.reserve-order-summary')).toContainText('$114.00');
  await page.locator('.reserve-purchase-terms summary').click();
  await expect(page.locator('.reserve-purchase-terms')).toContainText('Synthetic shipping terms.');
  await expect(page.locator('.reserve-purchase-terms')).toContainText(
    'Synthetic cancellation terms.',
  );
  await expect(page.locator('.reserve-purchase-terms')).toContainText(
    'final total at Shopify checkout',
  );
});

for (const width of [344, 768, 1440]) {
  test(`cart identifies held lines and recovers after removal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let removed = false;
    const line = (id: string, state: string) => ({
      id,
      quantity: 1,
      cost: { totalAmount: { amount: '24.00', currencyCode: 'USD' } },
      merchandise: {
        id: `variant-${id}`,
        title: '30 ml',
        product: {
          handle: id,
          title: id,
          featuredImage: null,
          launchState: { value: state },
          requiresSellingPlan: false,
        },
      },
    });
    await page.route('**/api/commerce/cart', async (route) => {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({ action: 'remove', lineId: 'held-item' });
        removed = true;
      }
      await route.fulfill({
        json: {
          cart: {
            id: 'synthetic-cart',
            checkoutUrl: 'https://example.test/unused',
            totalQuantity: removed ? 1 : 2,
            cost: {
              subtotalAmount: { amount: removed ? '24.00' : '48.00', currencyCode: 'USD' },
              totalAmount: { amount: '48.00', currencyCode: 'USD' },
            },
            lines: {
              nodes: [
                line('ready-item', 'ready'),
                ...(removed ? [] : [line('held-item', 'preorder')]),
              ],
            },
          },
        },
      });
    });
    await page.goto('/shop/cart');
    await expect(page.getByText('Your selection needs a small adjustment.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue to secure checkout' })).toHaveCount(0);
    await expect(
      page.getByText('Preorder opening soon · Remove this item to continue.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Remove held-item from cart' }).click();
    await expect(page.getByRole('link', { name: 'Continue to secure checkout' })).toBeVisible();
    await expect(page.getByText('Your selection needs a small adjustment.')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Review your saved collection' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
