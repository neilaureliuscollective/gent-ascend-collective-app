import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  test(`connected week resumes saved work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(componentUrl('/?mode=continuity'));
    await expect(
      page.getByRole('heading', { name: 'Evidence. Then your next move.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Saved strength session/ })).toHaveAttribute(
      'href',
      '/app/performance',
    );
    await expect(page.getByRole('link', { name: /Saved Council decision/ })).toHaveAttribute(
      'href',
      '/app/aethelios?conversation=60000000-0000-4000-8000-000000000001',
    );
    await page.getByText('See the recorded days', { exact: true }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('table')).toContainText('No record');
    await expect(page.getByRole('link', { name: 'Review with Aethelios' })).toHaveAttribute(
      'href',
      '/app/aethelios?starter=weekly-review',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('connected week labels unavailable practice and preserves reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(componentUrl('/?mode=continuity&unavailable=1'));
  await expect(page.getByRole('status')).toContainText('Grooming practice');
  await expect(page.getByText('Days with grooming practice', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Presence/ })).toHaveAttribute(
    'href',
    '/app/presence',
  );
  await page.getByText('See the recorded days', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('table')).toContainText('Unknown');
});
