import { expect, test } from './fixtures';

for (const width of [360, 768, 1440]) {
  test(`saved-work foundation gives bounded release guidance at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3102/?mode=release-foundation');
    await expect(
      page.getByRole('heading', { name: 'Saved work needs release validation.' }),
    ).toBeVisible();
    await expect(page.getByText('Schema unavailable', { exact: true })).toHaveCount(7);
    await expect(page.getByRole('link', { name: 'Open Missions →' })).toHaveAttribute(
      'href',
      '/app/missions',
    );
    await expect(page.getByRole('link', { name: 'Open saved work →' })).toHaveAttribute(
      'href',
      '/app/library',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/saved-work-foundation-${width}.png`,
      fullPage: true,
    });
    await page.goto('http://127.0.0.1:3102/?mode=release-foundation&state=accessible');
    await expect(
      page.getByRole('heading', { name: 'The saved-work schema is reachable.' }),
    ).toBeVisible();
    await expect(page.getByText('Readable schema', { exact: true })).toHaveCount(8);
    await expect(
      page.getByText(/Writes, isolation, exports and live intelligence still need/),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
