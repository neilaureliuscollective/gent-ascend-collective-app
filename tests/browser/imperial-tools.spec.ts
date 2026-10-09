import { test, expect } from './fixtures';

// Synthetic project responses exercise controls without provider calls or private data.
for (const width of [360, 768, 1440]) {
  test(`Steel Studio controls preserve project drafts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/studio', (route) =>
      route.fulfill({
        json: {
          projects: [
            {
              id: 'synthetic',
              title: 'Material exploration',
              creative_type: 'brand',
              brief: {},
              updated_at: '2026-10-09',
            },
          ],
          projectId: 'synthetic',
          versions: [],
          references: [],
          scenes: [],
          finishes: [],
          configured: false,
        },
      }),
    );
    await page.goto('/app/studio');
    const tabs = page.getByRole('group', { name: 'Studio workspace views' });
    await expect(tabs).toBeVisible();
    await expect(
      page.getByText(
        'Image generation is awaiting a server model connection. Projects and references remain available.',
      ),
    ).toBeVisible();
    await tabs.getByRole('button', { name: 'Direction', exact: true }).click();
    await page.getByLabel('Color direction').fill('Green, steel and ivory');
    await tabs.getByRole('button', { name: 'Library', exact: true }).click();
    await tabs.getByRole('button', { name: 'Direction', exact: true }).click();
    await expect(page.getByLabel('Color direction')).toHaveValue('Green, steel and ivory');
    const material = await tabs.evaluate((el) => ({
      foreground: getComputedStyle(el.querySelector('button')!).color,
      background: getComputedStyle(el).backgroundImage,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(material.foreground).toBe('rgb(246, 244, 237)');
    expect(material.background).toContain('rgb(74, 84, 80)');
    expect(material.overflow).toBe(false);
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.screenshot({
      path: `/workspace/steel-tools-review/studio-${width}.png`,
      fullPage: true,
    });
    await page.locator('html').evaluate((el) => el.setAttribute('data-material', 'solid'));
    await expect(tabs).toHaveCSS('background-image', 'none');
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(tabs).toHaveCSS('background-image', 'none');
  });
}
