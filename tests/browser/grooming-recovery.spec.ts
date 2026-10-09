import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`recovered grooming direction retains a failed draft at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    let saves = 0;
    await page.route('**/fixture-direction-save', (route) => {
      saves++;
      return route.fulfill({
        json: { error: 'Conflict: reload before retrying. Your draft is retained.' },
      });
    });
    await page.goto(componentUrl('/?mode=grooming-direction'));
    await page.getByRole('button', { name: 'Refine direction' }).click();
    await page.getByRole('button', { name: 'Adjust beard' }).click();
    await page.getByLabel('In your own words').fill('Keep my full beard sharp');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Refine direction' }).click();
    await expect(page.getByLabel('In your own words')).toHaveValue('Keep my full beard sharp');
    await page.getByRole('button', { name: 'Review direction' }).click();
    await page.getByRole('button', { name: 'Save this direction' }).click();
    await expect(page.getByRole('alert')).toContainText('Your draft is retained');
    await page.getByRole('button', { name: 'Adjust beard' }).click();
    await expect(page.getByLabel('In your own words')).toHaveValue('Keep my full beard sharp');
    expect(saves).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('keeping unchanged grooming direction produces no save', async ({ page }) => {
  let saves = 0;
  page.on('request', (request) => {
    if (request.url().includes('/fixture-direction-save')) saves++;
  });
  await page.goto(componentUrl('/?mode=grooming-direction'));
  await page.getByRole('button', { name: 'Refine direction' }).click();
  await page.getByRole('button', { name: 'Keep this direction' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(saves).toBe(0);
});
