import { test, expect } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`cinematic journey, products and navigation at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'A life, deliberately built.' })).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('.estate-landscape img')
          .evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.screenshot({ path: `test-results/estate-arrival-${width}.png` });
    await page.evaluate(() => scrollTo(0, 800));
    await expect
      .poll(() =>
        page.locator('.estate-landscape').evaluate((el) => getComputedStyle(el).transform),
      )
      .not.toBe('none');
    await page
      .getByRole('navigation', { name: 'Explore the world' })
      .getByRole('link', { name: /The ritual/ })
      .click();
    await expect(page).toHaveURL(/#the-ritual$/);
    await page
      .locator('#the-ritual')
      .screenshot({ path: `test-results/estate-ritual-${width}.png` });
    await page.getByRole('button', { name: /05.*Hydros/ }).click();
    await expect(page.getByRole('heading', { name: 'Hydros', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /05.*Hydros/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('Preview only. Not available to order.')).toBeVisible();
    await page
      .locator('.estate-collection')
      .screenshot({ path: `test-results/estate-products-${width}.png` });
    await page.locator('#the-intelligence').scrollIntoViewIfNeeded();
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(1);
    await page.screenshot({ path: `test-results/estate-intelligence-${width}.png` });
    await expect(page.locator('#the-intelligence .scene-atmosphere')).toHaveAttribute(
      'data-running',
      'true',
    );
    const light = page.locator('#the-intelligence .atmosphere-light');
    const before = await light.evaluate((el) => getComputedStyle(el).transform);
    await expect
      .poll(() => light.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe(before);
    await page.getByRole('button', { name: 'Still mode', exact: true }).click();
    await expect(page.locator('.estate-journey')).toHaveAttribute('data-still', 'true');
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(0);
    await expect(page.locator('#the-intelligence .scene-atmosphere')).toHaveAttribute(
      'data-running',
      'false',
    );
    await expect
      .poll(() =>
        page
          .locator('#the-intelligence .atmosphere-light')
          .evaluate((el) => getComputedStyle(el).animationName),
      )
      .toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('#the-reserve').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/estate-reserve-${width}.png` });
    await page.locator('.estate-invitation').scrollIntoViewIfNeeded();
    await expect(page.locator('.estate-seal-mount img')).toHaveAttribute('src', /crest-v2/);
    await page.screenshot({ path: `test-results/estate-invitation-${width}.png` });
    await page.getByRole('link', { name: /Discover The Reserve/ }).click();
    await expect(page).toHaveURL('/reserve');
    await expect(page.getByRole('heading', { name: 'The Reserve at Sanctum.' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/#the-ritual$/);
    await expect(page.locator('.estate-journey')).toHaveAttribute('data-still', 'true');
    expect(errors).toEqual([]);
  });
}

test('reduced motion preserves the complete story without WebGL', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reduced motion' })).toBeDisabled();
  await page.locator('#the-intelligence').scrollIntoViewIfNeeded();
  await expect(page.locator('.estate-sculpture canvas')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Your direction. Carried forward.' }),
  ).toBeVisible();
  await page.locator('#the-legacy').scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('heading', { name: 'For the life you build. And the people in it.' }),
  ).toBeVisible();
});
