import { expect, test } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`founding levels and launch studies are truthful and usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/membership');
    for (const price of ['$19.99', '$49.99', '$74.99']) {
      await expect(page.locator('.founding-price').filter({ hasText: price })).toBeVisible();
    }
    await expect(page.getByText('Paid enrollment is not open.', { exact: false })).toBeVisible();
    const signature = page.locator('.founding-level--signature');
    await signature.getByText('Growing into this level', { exact: true }).click();
    await expect(
      signature.getByText('Coordinated weekly plans and suggested adjustments'),
    ).toBeVisible();
    await signature.getByText('Your founding product ritual', { exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(
      signature.getByText('A fuller grooming ritual, curated around your preferences.'),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/founding-${width}.png`, fullPage: true });
    await page.goto('/launch');
    await expect(page.getByRole('heading', { name: 'The ritual takes shape.' })).toBeVisible();
    await expect(page.locator('.launch-study-label')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /preorder|buy|cart|checkout/i })).toHaveCount(0);
    for (const image of await page.locator('.launch-image img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      await expect
        .poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/launch-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
