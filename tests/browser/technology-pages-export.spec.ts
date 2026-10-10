import { test, expect } from './fixtures';
import { renderArtifact } from '../../src/domains/technology/artifact';
for (const width of [320, 720, 1440])
  test(`exported page cards and navigation are usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const html = renderArtifact({
      name: 'Synthetic consulting',
      industry: 'professional-services',
      vision: 'A considered business website.',
      headline: 'Considered work',
      about: 'Discuss your service needs.',
      services: [{ name: 'Consultation', description: 'Discuss your needs.', price: '' }],
      contact: '',
      hours: '',
      bookingUrl: '',
      pages: [
        {
          slug: 'process',
          title: 'Our process',
          layout: 'cards',
          sections: [
            { heading: 'Discuss', body: 'Bring your questions for discussion.' },
            { heading: 'Consider', body: 'Review the service requirements.' },
            { heading: 'Continue', body: 'Return to the discussion when ready.' },
          ],
        },
      ],
    });
    await page.setContent(html);
    const nav = page.getByRole('navigation', { name: 'Website sections' });
    await expect(nav.getByRole('link')).toHaveCount(5);
    await nav.getByRole('link', { name: 'Our process' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#process')).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Our process', level: 2 })).toBeVisible();
    await expect(page.locator('.page-sections.cards')).toHaveCSS('display', 'grid');
    const boxes = await page
      .locator('#process article')
      .evaluateAll((els) =>
        els.map((el) => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y })),
      );
    expect(boxes).toHaveLength(3);
    if (width === 320) expect(boxes[0]!.x).toBe(boxes[2]!.x);
    if (width === 1440) expect(boxes[0]!.y).toBe(boxes[2]!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/technology-pages-export-${width}.png` });
  });
