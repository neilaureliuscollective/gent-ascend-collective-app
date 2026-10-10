import { test, expect } from './fixtures';
// Synthetic navigation/read projection. Real record isolation is a separate Supabase gate.
for (const width of [360, 1440]) {
  test(`saved work keeps exact scope and filters metadata at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const writes: string[] = [];
    await page.route('**/api/workspace', async (route) => {
      if (route.request().method() !== 'GET') writes.push(route.request().method());
      await route.fulfill({
        json: {
          ownerId: '60000000-0000-4000-8000-000000000001',
          items: [
            {
              id: 'mission',
              kind: 'Mission',
              title: 'Personal launch',
              scope: 'Personal',
              detail: 'Review next move',
              date: '2026-10-08',
              href: '/app/missions?id=mission',
            },
            {
              id: 'document',
              kind: 'Document',
              title: 'Retained proposal',
              scope: 'Personal',
              detail: 'Version 2 · Retained after Mission removal',
              date: '2026-10-08',
              href: '/app/missions/deliverables?id=document',
            },
            {
              id: 'visual',
              kind: 'Visual project',
              title: 'Saved visual',
              scope: 'Personal',
              detail: 'Studio · saved project',
              date: '2026-10-08',
              href: '/app/studio?project=visual',
            },
            {
              id: 'company',
              kind: 'Company work',
              title: 'Client brief',
              scope: 'Company · Synthetic room',
              detail: 'Saved work · revision 3',
              date: '2026-10-08',
              href: '/app/companies/company/work/job',
            },
          ],
        },
      });
    });
    await page.goto('/app/library');
    const finder = page.getByRole('region', { name: 'Saved work finder' });
    await expect(finder.getByRole('link', { name: /Retained proposal/ })).toHaveAttribute(
      'href',
      '/app/missions/deliverables?id=document',
    );
    await expect(finder.getByRole('link', { name: /Saved visual/ })).toHaveAttribute(
      'href',
      '/app/studio?project=visual',
    );
    await expect(finder.getByRole('link', { name: /Client brief/ })).toHaveAttribute(
      'href',
      '/app/companies/company/work/job',
    );
    await finder.getByLabel('Find saved work').fill('retained');
    await expect(finder.locator('.company-job')).toHaveCount(1);
    await finder.getByLabel('Find saved work').fill('');
    await finder.getByLabel('Work type').selectOption('Company work');
    await expect(finder.locator('.company-job')).toHaveCount(1);
    await expect(finder).toContainText('Company · Synthetic room');
    await finder.getByLabel('Work type').selectOption('All');
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/saved-work-${width}.png`, fullPage: true });
  });
}
