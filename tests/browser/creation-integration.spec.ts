import { test, expect } from './fixtures';
import { palettes } from '../../src/domains/technology/design';

// Synthetic API data verifies the real application shell, not hosted persistence.
for (const width of [320, 720, 1440]) {
  test(`creation palettes remain readable inside the Imperial workspace at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/api\/(technology|aurelius|studio)/.test(request.url())) {
        writes.push(request.url());
      }
    });
    await page.route('**/api/technology', (route) => route.fulfill({ json: {
      projects: [], versions: [], runs: [], canCreate: true,
      generationAvailable: false, remainingMicros: 10_000_000, mission: null,
    } }));
    await page.goto('/app/work');
    await page.getByRole('link', { name: /Aethelios Technology/ }).click();
    await expect(page).toHaveURL('/app/work/technology');
    await expect(page.getByLabel('Business name', { exact: true })).toBeVisible();
    await page.getByLabel('Headline', { exact: true }).fill('A considered beginning');
    await page.getByLabel('Service 1', { exact: true }).fill('Consultation');
    await page.getByText('Design direction', { exact: true }).click();
    const preview = page.getByRole('region', { name: 'Website preview' });
    for (const palette of ['petrol', 'slate', 'ivory'] as const) {
      await page.getByLabel('Website palette', { exact: true }).selectOption(palette);
      await preview.getByRole('button', { name: 'Home', exact: true }).click();
      const heading = preview.getByRole('heading', { name: 'A considered beginning' });
      const expected = palettes[palette].foreground;
      const channels = expected.match(/\w\w/g)!.map((value) => parseInt(value, 16));
      await expect(heading).toHaveCSS('color', `rgb(${channels.join(', ')})`);
      await preview.getByRole('button', { name: 'Services', exact: true }).click();
      await expect(preview.getByRole('heading', { name: 'Consultation' })).toHaveCSS(
        'color', `rgb(${channels.join(', ')})`,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(writes).toEqual([]);
  });
}
