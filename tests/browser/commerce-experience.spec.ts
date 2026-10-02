import { expect, test } from './fixtures';
for (const width of [344, 768, 1440]) {
  test(`educated collection preview and saved selection at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/shop');
    await expect(page.getByRole('heading', { name: 'A higher daily standard.' })).toBeVisible();
    await page.getByRole('link', { name: 'Discover Vitalis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Vitalis.' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add to cart/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save to my collection' }).click();
    await expect(page.getByRole('button', { name: 'In your collection' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByText('Saved on this browser. This does not reserve stock or place an order.'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'The formula', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Know what goes into it.' })).toBeInViewport();
    await page.reload();
    await expect(page.getByRole('button', { name: 'In your collection' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('link', { name: 'View your saved selection' }).click();
    await expect(page.getByRole('button', { name: /My selection/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.reserve-collection-card')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/commerce-selection-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(errors).toEqual([]);
  });
}
test('reduced motion and keyboard-accessible preview education', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/shop/vitalis');
  await expect(page.locator('.public-world')).toHaveAttribute('data-world-still', 'true');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore in 3D' })).toHaveCount(0);
  await expect(page.getByText('Product photography forthcoming', { exact: true })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Do I need a membership to purchase?' }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('No. Products that are open for ordering can be purchased independently'),
  ).toBeVisible();
});

test('real purchase controls preserve variant, quantity, gallery and failure state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.route('https://cdn.shopify.com/fixture/*.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#153b2a"/></svg>',
    }),
  );
  let body: { variantId: string; quantity: number } | undefined;
  await page.route('**/api/commerce/cart', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 502,
      json: { error: 'Synthetic cart failure. Retry your selection.' },
    });
  });
  await page.goto('http://127.0.0.1:3102/?mode=commerce');
  await page
    .getByRole('combobox', { name: 'Choose an option' })
    .selectOption('gid://shopify/ProductVariant/fixture-large');
  await page.getByRole('combobox', { name: 'Quantity' }).selectOption('3');
  await expect(page.locator('.reserve-sticky-purchase')).toContainText('$114.00');
  await page
    .locator('.reserve-sticky-purchase')
    .getByRole('button', { name: 'Add to cart' })
    .click();
  await expect(page.getByText('Synthetic cart failure. Retry your selection.')).toBeVisible();
  expect(body?.variantId).toBe('gid://shopify/ProductVariant/fixture-large');
  expect(body?.quantity).toBe(3);
  await page.getByRole('button', { name: 'View image 2', exact: true }).click();
  await page.getByRole('button', { name: /Enlarge Fixture Vitalis image 2/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByText('View full ingredients', { exact: false }).click();
  await expect(page.getByText('Synthetic ingredient list.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('preorder stays locked and failed 3D preserves product inspection', async ({ page }) => {
  await page.route('https://cdn.shopify.com/fixture/*.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" />',
    }),
  );
  await page.route('https://cdn.shopify.com/fixture/missing.glb', (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=commerce&state=preorder&model=fail');
  await expect(page.getByRole('button', { name: 'Preorder opening soon' })).toBeDisabled();
  await expect(page.locator('.reserve-sticky-purchase')).toHaveCount(0);
  await page.getByRole('button', { name: 'Inspect in 3D' }).click();
  await expect(page.getByText('3D is unavailable. Product images remain available.')).toBeVisible();
  await page.getByRole('button', { name: 'Return to images' }).click();
  await expect(page.getByRole('button', { name: /Enlarge Fixture Vitalis image 1/ })).toBeVisible();
});
