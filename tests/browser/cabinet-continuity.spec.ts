import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`Cabinet import requires a reviewed confirmation and retains browser saves at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() =>
      localStorage.setItem('gent-ascend-collection-v1', JSON.stringify(['vitalis', 'retired'])),
    );
    let reviews = 0,
      imports = 0;
    await page.route('**/fixture-import-review', (route) => {
      reviews++;
      expect(route.request().postDataJSON()).toEqual(['vitalis', 'retired']);
      return route.fulfill({
        json: {
          owner: 'ce000000-0000-4000-8000-000000000002',
          items: [{ handle: 'vitalis', id: 'gid://shopify/Product/1', title: 'Published Vitalis' }],
          unavailable: ['retired'],
          error: '',
        },
      });
    });
    await page.route('**/fixture-import-confirm', (route) => {
      imports++;
      const payload = route.request().postDataJSON();
      expect(JSON.parse(payload.items)).toEqual([
        { handle: 'vitalis', id: 'gid://shopify/Product/1' },
      ]);
      return route.fulfill({
        json:
          imports === 1
            ? {
                error:
                  'Import could not be confirmed. Retry this selection; existing records are kept.',
                message: '',
              }
            : { error: '', message: '1 product added to your Cabinet.' },
      });
    });
    await page.goto('http://127.0.0.1:3102/?mode=cabinet-import');
    await expect(page.getByRole('checkbox', { name: 'vitalis', exact: true })).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Review selected products' })).toBeDisabled();
    expect(imports).toBe(0);
    await page.getByRole('checkbox', { name: 'vitalis', exact: true }).check();
    await page.getByRole('checkbox', { name: 'retired', exact: true }).check();
    await page.getByRole('button', { name: 'Review selected products' }).click();
    await expect(page.getByRole('heading', { name: 'Review your Cabinet import' })).toBeVisible();
    await expect(page.getByText(/Unavailable for account import/)).toContainText('retired');
    expect(imports).toBe(0);
    expect(reviews).toBe(1);
    await page.getByRole('button', { name: 'Confirm import to my Cabinet' }).click();
    await expect(page.getByRole('alert')).toContainText('Retry this selection');
    await expect(page.getByRole('checkbox', { name: 'vitalis', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Confirm import to my Cabinet' }).click();
    await expect(page.getByText(/1 product added/)).toBeVisible();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('gent-ascend-collection-v1')!)),
    ).toEqual(['vitalis', 'retired']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/cabinet-import-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}
test('product account save is explicit and keeps the browser selection separate', async ({
  page,
}) => {
  let saves = 0;
  await page.route('**/fixture-cabinet-save', (route) => {
    saves++;
    return route.fulfill({ json: { error: '', message: 'Saved to your Cabinet.' } });
  });
  await page.goto('http://127.0.0.1:3102/?mode=commerce&account=true');
  expect(saves).toBe(0);
  await page.getByRole('button', { name: 'Save to my Cabinet' }).click();
  await expect(page.getByText('Saved to your Cabinet.', { exact: true })).toBeVisible();
  expect(saves).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('gent-ascend-collection-v1'))).toBeNull();
});
