import { expect, test } from './fixtures';
for (const width of [344, 768, 1440]) {
  test(`guided direction and considered selection at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/shop');
    const guide = page.locator('#discovery');
    await page.getByRole('link', { name: 'Find your next essential' }).click();
    await expect(
      guide.getByRole('heading', { name: 'Begin with your intention.' }),
    ).toBeInViewport();
    await guide.getByRole('radio', { name: /Hair & beard/ }).check();
    await guide.getByRole('radio', { name: 'Available to order', exact: true }).check();
    await guide.getByRole('button', { name: 'Explore my direction' }).click();
    await expect(
      guide.getByRole('heading', { name: 'Your direction: Hair & beard' }),
    ).toBeFocused();
    await expect(guide.getByText('This direction is not open for ordering yet.')).toBeVisible();
    await expect(guide.locator('.reserve-collection-card')).toHaveCount(0);
    await guide.getByRole('button', { name: 'Include previews' }).click();
    await expect(guide.locator('.reserve-collection-card')).toHaveCount(1);
    await expect(guide.getByText(/Editorial hair & beard care preview/)).toBeVisible();
    await page.screenshot({ path: `test-results/commerce-guide-${width}.png`, fullPage: true });
    await guide.getByRole('button', { name: 'Save Vitalis to my collection', exact: true }).click();
    await expect(
      guide.getByRole('button', { name: 'Remove Vitalis from my collection' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await guide.getByRole('link', { name: 'Review my saved selection' }).click();
    await expect(page.locator('.reserve-selection-facts')).toContainText(
      'Texture details have not been published.',
    );
    await expect(page.locator('.reserve-selection-facts')).toContainText(
      'Scent details have not been published.',
    );
    await expect(page.locator('.reserve-collection-card')).toHaveCount(1);
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Remove Vitalis from my collection' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: `test-results/commerce-dossier-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Remove Vitalis from my collection' }).click();
    await expect(page.locator('.reserve-collection-card')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
test('discovery is keyboard usable, optional, and keeps the full shelf available without JavaScript', async ({
  page,
  browser,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/shop');
  const guide = page.locator('#discovery');
  await guide.getByRole('radio', { name: /The whole collection/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(guide.getByRole('radio', { name: /Hair & beard/ })).toBeChecked();
  await guide.getByRole('button', { name: 'Explore my direction' }).focus();
  await page.keyboard.press('Enter');
  await expect(guide.getByRole('heading', { name: 'Your direction: Hair & beard' })).toBeFocused();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto('/shop');
  await expect(staticPage.locator('#collection .reserve-collection-card')).toHaveCount(4);
  await expect(
    staticPage.getByText('The interactive guide needs JavaScript.', { exact: false }),
  ).toBeVisible();
  await context.close();
});
test('saved selection handles missing catalog entries and storage denial', async ({ page }) => {
  await page.goto('/shop');
  await page.evaluate(() =>
    localStorage.setItem(
      'gent-ascend-collection-v1',
      JSON.stringify(['missing-product', 'missing-product', 'bad/<handle>']),
    ),
  );
  await page.goto('/shop?saved=1');
  await expect(page.locator('.reserve-unresolved-selection')).toContainText(
    '1 saved item is not in this collection view',
  );
  await page.getByRole('button', { name: 'Remove missing-product', exact: true }).click();
  await expect(page.locator('.reserve-unresolved-selection')).toHaveCount(0);
  await page.goto('/shop');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Synthetic storage denial');
    };
  });
  await page
    .locator('#collection')
    .getByRole('button', { name: 'Save Vitalis to my collection' })
    .click();
  await expect(
    page
      .locator('#collection')
      .getByText('Saving is unavailable in this browser. You can bookmark this page.'),
  ).toBeVisible();
});
test('approved alternatives and ritual chapters disclose reason, price and availability', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/?mode=commerce');
  const related = page.locator('.reserve-related');
  await expect(related.getByRole('heading', { name: 'Another option to consider' })).toBeVisible();
  await expect(related.getByRole('heading', { name: 'Another part of the ritual' })).toBeVisible();
  await expect(related).toContainText('Synthetic alternative for browser verification.');
  await expect(related).toContainText('From $28.00');
  await expect(related).toContainText('Pricing at release');
  await expect(related).toContainText('Collection preview');
  await expect(related.getByRole('button', { name: /Add to cart/ })).toHaveCount(0);
  await related.getByRole('button', { name: 'Save Fixture Wash to my collection' }).click();
  await expect(
    related.getByRole('button', { name: 'Remove Fixture Wash from my collection' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('saved selection synchronizes across open tabs', async ({ page }) => {
  await page.goto('/shop');
  const selection = await page.context().newPage();
  await selection.goto('/shop?saved=1');
  await expect(selection.locator('.reserve-collection-card')).toHaveCount(0);
  await page
    .locator('#collection')
    .getByRole('button', { name: 'Save Vitalis to my collection' })
    .click();
  await expect(selection.locator('.reserve-collection-card')).toHaveCount(1);
  await selection.getByRole('button', { name: 'Remove Vitalis from my collection' }).click();
  await expect(
    page.locator('#collection').getByRole('button', { name: 'Save Vitalis to my collection' }),
  ).toHaveAttribute('aria-pressed', 'false');
  await selection.close();
});
