import { test, expect } from './fixtures';
const brief = {
  name: 'Studio North',
  industry: 'grooming-beauty',
  vision: 'A welcoming local studio.',
  headline: 'Care with intention',
  about: 'A local studio focused on thoughtful care.',
  services: [{ name: 'Consultation', description: 'Discuss your needs.', price: '' }],
  hours: '',
  contact: '',
  bookingUrl: '',
};
for (const width of [320, 720, 1440])
  test(`informational pages save, return, reorder and remove at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const id = 'f5100000-0000-4000-8000-000000000001';
    let current = {
      ...brief,
      pages: [] as {
        slug: string;
        title: string;
        layout: string;
        sections: { heading: string; body: string }[];
      }[],
    };
    let revision = 1;
    const saved: unknown[] = [];
    await page.route('**/api/technology', async (r) => {
      if (r.request().method() === 'POST') {
        const body = r.request().postDataJSON();
        saved.push(body);
        current = body.brief;
        revision++;
        return r.fulfill({ json: { versionId: body.versionId } });
      }
      return r.fulfill({
        json: {
          projects: [{ id, revision }],
          versions: [
            {
              id: crypto.randomUUID(),
              project_id: id,
              revision,
              brief: current,
              reviewed_at: null,
              created_at: '2026-10-09T00:00:00Z',
            },
          ],
          runs: [],
          canCreate: true,
          generationAvailable: false,
          remainingMicros: 10000000,
          mission: null,
        },
      });
    });
    await page.route('**/api/technology/builds**', (r) => r.fulfill({ json: { builds: [] } }));
    await page.goto(`http://127.0.0.1:3102/?mode=technology&project=${id}`);
    await page.getByText('Additional pages', { exact: true }).click();
    await page.getByRole('button', { name: 'Add informational page' }).click();
    await page.getByLabel('Page 1 title', { exact: true }).fill('Our process');
    await page.getByLabel('Page 1 address').fill('our-process');
    await page.getByLabel('Page 1 layout').selectOption('cards');
    await page.getByLabel('Page 1 section 1 heading').fill('Discuss your needs');
    await page
      .getByLabel('Page 1 section 1 text')
      .fill('A conversation about your service requirements.');
    await page.getByRole('button', { name: 'Our process', exact: true }).click();
    await expect(
      page.locator('.technology-preview').getByRole('heading', { name: 'Discuss your needs' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect.poll(() => saved.length).toBe(1);
    await page.reload();
    await page.getByText('Additional pages', { exact: true }).click();
    await expect(page.getByLabel('Page 1 title', { exact: true })).toHaveValue('Our process');
    await page.getByRole('button', { name: 'Add informational page' }).click();
    await page.getByLabel('Page 2 title', { exact: true }).fill('Prepare for a visit');
    await page.getByLabel('Page 2 section 1 heading').fill('Before a visit');
    await page.getByLabel('Page 2 section 1 text').fill('Bring your questions for discussion.');
    await page.getByRole('button', { name: 'Move page 2 earlier' }).click();
    await expect(page.getByLabel('Page 1 title', { exact: true })).toHaveValue(
      'Prepare for a visit',
    );
    await page.getByRole('button', { name: 'Our process', exact: true }).click();
    await page.getByRole('button', { name: 'Remove page 2', exact: true }).click();
    await expect(
      page.locator('.technology-preview').getByRole('heading', { name: brief.headline }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect.poll(() => saved.length).toBe(2);
    await page.screenshot({ path: `test-results/technology-pages-${width}.png`, fullPage: true });
  });
