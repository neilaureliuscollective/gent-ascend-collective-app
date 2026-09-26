import { test, expect } from './fixtures';

for (const width of [390, 768, 1440]) {
  test(`emerald chapters and still mode at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const scene = page.locator('#the-world');
    await scene.scrollIntoViewIfNeeded();
    await expect(scene).toHaveClass(/cinematic-scene/);
    const before = await scene.evaluate((e) => e.style.getPropertyValue('--scene-progress'));
    await page.mouse.wheel(0, 250);
    await expect
      .poll(() => scene.evaluate((e) => e.style.getPropertyValue('--scene-progress')))
      .not.toBe(before);
    await page.getByRole('button', { name: 'Still mode', exact: true }).click();
    await expect(page.locator('.public-world')).toHaveAttribute('data-world-still', 'true');
    expect(
      await scene.evaluate((e) => getComputedStyle(e).getPropertyValue('--scene-shift').trim()),
    ).toBe('0px');
    await page
      .getByRole('navigation', { name: 'Explore the world' })
      .getByRole('link', { name: 'The ritual', exact: true })
      .click();
    await expect(page).toHaveURL(/#the-ritual$/);
    await page.locator('.product-atelier').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'The intention', exact: false }).click();
    await expect(page.getByRole('heading', { name: 'The house standard.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/emerald-${width}.png`, fullPage: true });
  });
}

test('3D study renders, rotates, changes lighting and recovers from context loss', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
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

test('dimensional cards respond to a pointer and settle in Still mode', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const card = page.locator('.world-doorways > a').first();
  await card.scrollIntoViewIfNeeded();
  await card.hover({ position: { x: 30, y: 35 } });
  await expect.poll(() => card.evaluate((e) => e.style.getPropertyValue('--card-ry'))).not.toBe('');
  await page.getByRole('button', { name: 'Still mode', exact: true }).click();
  await expect.poll(() => card.evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  await card.getByRole('heading', { name: /Products/ }).click();
  await expect(page).toHaveURL('/shop');
  await expect(page.locator('.public-world')).toHaveAttribute('data-world-still', 'true');
});
