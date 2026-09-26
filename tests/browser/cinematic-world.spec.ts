import { test, expect } from './fixtures';

test('3D study renders, rotates, changes lighting and recovers from context loss', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/shop/vitalis');
  await expect(page.locator('.atelier-canvas canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore in 3D' }).click();
  await expect(page.locator('.product-atelier')).toHaveAttribute('data-renderer', 'ready');
  const slider = page.getByRole('slider', { name: 'Rotate vessel' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('1');
  await page.getByRole('button', { name: 'Emerald light', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Emerald light', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(slider).toHaveValue('0');
  await page.locator('.product-atelier').screenshot({ path: 'test-results/atelier-3d.png' });
  await page
    .locator('.atelier-canvas canvas')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
  await expect(page.locator('.product-atelier')).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator('.atelier-canvas canvas')).toHaveCount(0);
  await expect(page.getByText('Still study shown.', { exact: false })).toBeVisible();
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
  await page.getByRole('button', { name: 'Explore in 3D' }).click();
  await expect(page.locator('.product-atelier')).toHaveAttribute('data-renderer', 'fallback');
  await page.getByRole('button', { name: 'The ritual', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'A moment to prepare.' })).toBeVisible();
  await expect(page.locator('.atelier-canvas canvas')).toHaveCount(0);
});
