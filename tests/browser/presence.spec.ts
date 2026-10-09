import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';

for (const width of [344, 390, 768, 1440]) {
  test(`Presence concierge and preserved tools at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 850 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(componentUrl('/?mode=presence'));
    await expect(page.getByRole('heading', { name: 'Show up with intention.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Investor meeting' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Prepare with Aethelios/ })).toHaveAttribute(
      'href',
      '/app/aethelios?starter=presence',
    );
    await expect(page.getByRole('link', { name: /A closer look/ })).toHaveAttribute(
      'href',
      '/app/grooming/scan',
    );
    await expect(page.getByRole('link', { name: /Review occasion details/ })).toHaveAttribute(
      'href',
      '/app/grooming?section=occasion#occasion',
    );
    await page.getByText('Your grooming intelligence', { exact: true }).click();
    await expect(page.getByRole('link', { name: /Private visual history/ })).toBeVisible();
    await expect(page.getByText('Recording practice is optional.', { exact: false })).toBeVisible();
    await page.screenshot({ path: `test-results/presence-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
test('Presence empty and degraded states do not invent preparation needs', async ({ page }) => {
  await page.goto(componentUrl('/?mode=presence&empty=1&unavailable=1'));
  await expect(
    page.getByRole('heading', { name: 'Keep your standard. Leave room for life.' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Occasions could not be loaded');
  await expect(page.getByRole('link', { name: /Add an important occasion/ })).toBeVisible();
  await expect(page.getByText(/overdue|completion recorded today/i)).toHaveCount(0);
});
