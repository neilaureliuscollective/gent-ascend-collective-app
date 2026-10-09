import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';
import { outcomesFixture } from '../component-fixture/performance';
for (const width of [344, 390, 768, 1440]) {
  test(`decision outcomes show actual records without writes at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const writes: unknown[] = [];
    await page.route('**/api/performance', async (route) => {
      if (route.request().method() !== 'GET') writes.push(route.request().postDataJSON());
      await route.fulfill({ json: outcomesFixture });
    });
    await page.goto(componentUrl('/?mode=performance-outcomes'));
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    const section = page.getByRole('region', { name: 'Latest change outcome' });
    await expect(section.getByRole('heading', { name: 'Did the change hold?' })).toBeVisible();
    await expect(
      section.getByRole('heading', { name: 'Target met on two separate days' }),
    ).toBeVisible();
    const details = section.getByText('See what you recorded (2/2 attempts)', { exact: true });
    await details.focus();
    await page.keyboard.press('Enter');
    await expect(section.getByText('Effort is missing', { exact: false })).toBeVisible();
    await expect(section.getByText('9 · 9 · 9', { exact: true })).toHaveCount(2);
    await expect(section.getByText('8/10', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(writes).toHaveLength(0);
    await section.screenshot({
      path: info.outputPath('phase4-outcomes.png'),
      animations: 'disabled',
    });
    await page.getByText('Approved changes (1)', { exact: true }).click();
    await expect(page.getByText(/Program v1 → v2/)).toBeVisible();
    expect(writes).toHaveLength(0);
  });
}
