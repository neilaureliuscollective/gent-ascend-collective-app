import { test, expect } from './fixtures';

test('Vitalis preview preserves honest product inspection without approved media', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/shop/vitalis');
  await expect(page.locator('#atelier .reserve-gallery')).toBeVisible();
  await expect(page.getByText('Product photography forthcoming')).toBeVisible();
  await expect(page.getByRole('button', { name: /(?:Explore|Inspect) in 3D/ })).toHaveCount(0);
  await expect(page.locator('#atelier canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reduced motion and unsupported graphics retain usable content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof get>
    ) {
      if (String(args[0]).startsWith('webgl')) return null;
      return get.apply(this, args);
    } as typeof get;
  });
  await page.goto('/shop/vitalis');
  await expect(page.getByRole('button', { name: 'Reduced motion' })).toBeDisabled();
  await expect(page.locator('#atelier .reserve-gallery')).toBeVisible();
  await expect(page.getByText('Product photography forthcoming')).toBeVisible();
  await page.getByRole('link', { name: 'The ritual', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make it your ritual.' })).toBeVisible();
  await expect(page.locator('.atelier-canvas canvas')).toHaveCount(0);
});
