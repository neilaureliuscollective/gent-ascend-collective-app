import { expect, test, type Page } from '@playwright/test';
function cart(quantity = 1, available = true, warnings: { code: string; message: string }[] = []) {
  return {
    totalQuantity: quantity,
    cost: {
      subtotalAmount: { amount: String(quantity * 24), currencyCode: 'USD' },
      totalAmount: { amount: String(quantity * 24), currencyCode: 'USD' },
    },
    warnings,
    lines: {
      nodes: [
        {
          id: 'gid://shopify/CartLine/fixture',
          quantity,
          cost: { totalAmount: { amount: String(quantity * 24), currencyCode: 'USD' } },
          merchandise: {
            id: 'gid://shopify/ProductVariant/fixture',
            title: '30 ml',
            availableForSale: available,
            product: {
              handle: 'fixture-oil',
              title: 'Synthetic oil',
              requiresSellingPlan: false,
              featuredImage: null,
            },
          },
        },
      ],
    },
  };
}
async function connected(page: Page, mode = 'lifestyle-cart', quantity = 1) {
  await page.route('**/api/commerce/cart', (route) =>
    route.fulfill({ json: { cart: cart(quantity) } }),
  );
  await page.goto(`http://127.0.0.1:3102/?mode=${mode}`);
}
for (const width of [344, 720, 768, 1440]) {
  test(`native cart isolates focus and restores it at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await connected(page, 'lifestyle-drawer');
    const trigger = page.getByRole('button', { name: /Open cart/ });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Your cart' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close cart' })).toBeFocused();
    expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
    await trigger.evaluate((element) => (element as HTMLElement).focus());
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await expect(dialog.getByRole('combobox')).toBeEnabled();
    expect(await dialog.evaluate((element) => element.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close cart' }).click();
    await expect(dialog).not.toBeVisible();
  });
}
test('quick quantities use server-adjusted results and cannot replay while pending', async ({
  page,
}) => {
  let posts = 0;
  await page.route('**/api/commerce/cart', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { cart: cart() } });
    posts++;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return route.fulfill({
      json: {
        cart: cart(1, true, [
          { code: 'QUANTITY_ADJUSTED', message: 'Synthetic inventory adjustment.' },
        ]),
      },
    });
  });
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-cart');
  const increase = page.getByRole('button', { name: 'Increase quantity of Synthetic oil' });
  await increase.click();
  await expect(increase).toBeDisabled();
  await expect(page.getByRole('link', { name: /Continue to secure checkout/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.getByText('Synthetic inventory adjustment.')).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveValue('1');
  await expect(page.getByRole('button', { name: /Decrease quantity/ })).toBeDisabled();
  expect(posts).toBe(1);
});
test('return-to-cart revalidation blocks stale checkout and respects changed stock', async ({
  page,
}) => {
  let refresh = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/commerce/cart', async (route) => {
    if (!refresh) return route.fulfill({ json: { cart: cart() } });
    await gate;
    return route.fulfill({ json: { cart: cart(1, false) } });
  });
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-cart');
  await expect(page.getByRole('combobox')).toBeEnabled();
  refresh = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Checking your current cart…')).toBeVisible();
  await expect(page.getByRole('combobox')).toBeDisabled();
  await expect(page.getByRole('link', { name: /Continue to secure checkout/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  release();
  await expect(page.getByText(/Currently unavailable/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Continue to secure checkout/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Remove Synthetic oil/ })).toBeEnabled();
});
test('uncertain writes require a read before another mutation or checkout', async ({ page }) => {
  let posts = 0;
  await page.route('**/api/commerce/cart', (route) => {
    if (route.request().method() === 'POST') {
      posts++;
      return route.abort();
    }
    return route.fulfill({ json: { cart: cart(posts ? 2 : 1) } });
  });
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-cart');
  await page.getByRole('button', { name: /Increase quantity/ }).click();
  await expect(page.getByRole('alert')).toContainText('Refresh the cart');
  await expect(page.getByRole('button', { name: /Increase quantity/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('combobox')).toHaveValue('2');
  await expect(page.getByRole('button', { name: /Increase quantity/ })).toBeEnabled();
  expect(posts).toBe(1);
});
test('larger existing quantities stay visible without unbounded options or invalid increments', async ({
  page,
}) => {
  await connected(page, 'lifestyle-cart', 250);
  await expect(page.getByRole('combobox')).toHaveValue('250');
  await expect(page.getByRole('combobox').locator('option')).toHaveCount(26);
  await expect(page.getByRole('button', { name: /Increase quantity/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Remove Synthetic oil/ })).toBeEnabled();
});

test('a timed-out cart read offers recovery without writes', async ({ page }) => {
  let posts = 0;
  await page.addInitScript(() => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    AbortSignal.timeout = (milliseconds: number) =>
      timeout(milliseconds === 20000 ? 100 : milliseconds);
  });
  await page.route('**/api/commerce/cart', async (route) => {
    if (route.request().method() === 'POST') posts++;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({ json: { cart: cart() } }).catch(() => {});
  });
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-cart');
  await expect(page.getByRole('alert')).toContainText('Cart is temporarily unavailable.');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  await expect(page.getByRole('link', { name: /Continue to secure checkout/ })).toHaveCount(0);
  expect(posts).toBe(0);
});
