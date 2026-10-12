import { expect, test } from '@playwright/test';
const fixture = 'http://127.0.0.1:3102/?mode=lifestyle-product';
for (const width of [344, 720, 768, 1440]) {
  test(`atelier inspection stays keyboard accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('https://cdn.shopify.com/fixture/*.png', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#101415"/><text x="50" y="120" fill="white" font-size="32">SYNTHETIC PHOTO</text></svg>',
      }),
    );
    await page.goto(fixture);
    await page.getByRole('button', { name: 'Next product image', exact: true }).click();
    const trigger = page.getByRole('button', { name: /Enlarge Fixture Vitalis image 2/ });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Zoom in on product image' }).click();
    await expect(dialog.locator('.atelier-zoom-image')).toHaveAttribute('data-zoom', '2');
    await dialog.getByRole('button', { name: 'Fit product image' }).click();
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.getByRole('img')).toHaveAttribute('src', /front/);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: /Enlarge Fixture Vitalis image 1/ }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `docs/evidence/lifestyle/atelier-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}
test('a failed photograph preserves product selection and other views', async ({ page }) => {
  await page.route('https://cdn.shopify.com/fixture/front.png', (route) => route.abort());
  await page.route('https://cdn.shopify.com/fixture/back.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" />',
    }),
  );
  await page.goto(fixture);
  await expect(page.getByText('This photograph could not load.', { exact: false })).toBeVisible();
  await expect(page.locator('.commerce-add')).toBeEnabled();
  await page.getByRole('button', { name: 'Next product image', exact: true }).click();
  await expect(page.getByRole('button', { name: /Enlarge Fixture Vitalis image 2/ })).toBeVisible();
});
test('approved film loads only after selection and has captions and a transcript', async ({
  page,
}) => {
  await page.route('https://cdn.shopify.com/fixture/captions.vtt', (route) =>
    route.fulfill({
      contentType: 'text/vtt',
      body: 'WEBVTT\n\n00:00.000 --> 00:01.000\nSynthetic caption\n',
    }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-film&approved=false');
  await expect(page.getByRole('button', { name: 'Watch product film' })).toHaveCount(0);
  await page.goto('http://127.0.0.1:3102/?mode=lifestyle-film');
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('button', { name: 'Watch product film' }).click();
  await expect(page.locator('video')).toHaveAttribute('preload', 'none');
  await expect(page.locator('video')).not.toHaveAttribute('autoplay');
  await expect(page.locator('video track')).toHaveAttribute('kind', 'captions');
  await page.getByText('Read film transcript').click();
  await expect(page.getByText('Synthetic film transcript. No product claims.')).toBeVisible();
  await page.getByRole('button', { name: 'View image 1', exact: true }).click();
  await expect(page.locator('video')).toHaveCount(0);
});
