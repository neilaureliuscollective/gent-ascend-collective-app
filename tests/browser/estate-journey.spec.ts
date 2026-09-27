import { test, expect } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`Ascend entry keeps the story and direct exits usable at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'A life is built from the inside.' }),
    ).toBeVisible();
    for (const name of [
      'One man. Many demands.',
      'A clearer way to see the whole.',
      'Direction becomes daily practice.',
      'Begin with the care you take.',
    ])
      await expect(page.getByRole('heading', { name })).toHaveCount(1);
    await expect(page.locator('.ascend-man-image img')).toHaveJSProperty('complete', true);
    await page
      .getByRole('navigation', { name: 'Explore the world' })
      .getByRole('link', { name: /The system/ })
      .click();
    await expect(page).toHaveURL(/#the-system$/);
    await expect(page.locator('.ascend-loop-system li')).toHaveCount(6);
    await expect(page.getByRole('link', { name: /Explore the OS/ }).first()).toHaveAttribute(
      'href',
      '/gent-ascend',
    );
    await expect(page.getByRole('link', { name: /Explore products/ }).first()).toHaveAttribute(
      'href',
      '/shop',
    );
    await page.getByRole('button', { name: 'Still mode', exact: true }).click();
    await expect(page.locator('.estate-journey')).toHaveAttribute('data-still', 'true');
    await page.locator('#the-intelligence').scrollIntoViewIfNeeded();
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(0);
    await expect(page.locator('.estate-sculpture .presence-fallback')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('#the-ritual').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /05.*Hydros/ }).click();
    await expect(page.getByRole('heading', { name: 'Hydros', exact: true })).toBeVisible();
    await expect(page.getByText('Preview only. Not available to order.')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('reduced motion retains the complete sequence and destinations', async ({ page }) => {
  await page.setViewportSize({ width: 344, height: 660 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reduced motion' })).toBeDisabled();
  await expect(page.locator('.ascend-man-resolution')).toBeVisible();
  await page.locator('#the-intelligence').scrollIntoViewIfNeeded();
  await expect(page.locator('.estate-sculpture canvas')).toHaveCount(0);
  await page.locator('#the-system').scrollIntoViewIfNeeded();
  await expect(page.locator('.ascend-loop-system li')).toHaveCount(6);
  await page.locator('#the-legacy').scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('heading', { name: 'For the life you build. And the people in it.' }),
  ).toBeVisible();
});
