import { expect, test } from './fixtures';

test('native sharing uses only the canonical product path', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        localStorage.setItem('share-fixture', JSON.stringify(data));
      },
    });
  });
  await page.goto('/shop/vitalis?campaign=example#formula');
  await page.getByRole('button', { name: 'Share this product' }).click();
  await expect(page.getByText('Share completed.', { exact: true })).toBeVisible();
  const shared = await page.evaluate(() => JSON.parse(localStorage.getItem('share-fixture')!));
  expect(shared.url).toBe('http://127.0.0.1:3100/shop/vitalis');
  expect(shared.title).toBe('Vitalis');
});

test('copy and denied sharing provide a usable manual link', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (url: string) => {
          localStorage.setItem('copy-fixture', url);
        },
      },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      },
    });
  });
  await page.goto('/shop/vitalis?private=exclude');
  await page.getByRole('button', { name: 'Copy product link' }).click();
  await expect(page.getByText('Product link copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('copy-fixture'))).toBe(
    'http://127.0.0.1:3100/shop/vitalis',
  );
  await page.getByRole('button', { name: 'Share this product' }).click();
  const link = page.getByRole('textbox', { name: 'Product link', exact: true });
  await expect(link).toHaveValue('http://127.0.0.1:3100/shop/vitalis');
  await link.focus();
  expect(await link.evaluate((element: HTMLInputElement) => element.selectionEnd)).toBe(
    'http://127.0.0.1:3100/shop/vitalis'.length,
  );
});

test('cancelling native share is quiet and product metadata preserves the launch indexing gate', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Cancelled', 'AbortError');
      },
    });
  });
  await page.goto('/shop/vitalis');
  await page.getByRole('button', { name: 'Share this product' }).click();
  await expect(page.getByRole('button', { name: 'Share this product' })).toBeEnabled();
  await expect(page.locator('.reserve-product-share input')).toHaveCount(0);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Vitalis');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
