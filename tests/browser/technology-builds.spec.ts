import { test, expect } from './fixtures';
import { renderArtifact } from '../../src/domains/technology/artifact';
const project = 'f1900000-0000-4000-8000-000000000001',
  version = 'f1900000-0000-4000-8000-000000000002';
const brief = {
  name: 'Build Studio',
  industry: 'grooming-beauty' as const,
  vision: 'A considered local business.',
  headline: 'Care with intention',
  about: 'A carefully considered local studio.',
  services: [{ name: 'Consultation', description: 'Thoughtful service.', price: '$45' }],
  hours: 'Tue–Sat',
  contact: 'Call the studio',
  bookingUrl: 'https://booking.example.com',
};
for (const width of [320, 720, 1440])
  test(`Verified build recovery/export and isolated inspection ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const builds: Record<string, unknown>[] = [];
    let posts = 0;
    let interrupt = true;
    await page.route('**/api/technology', (route) =>
      route.fulfill({
        json: {
          projects: [{ id: project, revision: 1, mission_id: null }],
          versions: [
            {
              id: version,
              project_id: project,
              revision: 1,
              brief,
              reviewed_at: '2026-10-08T12:00:00Z',
              created_at: '2026-10-08T12:00:00Z',
            },
          ],
          runs: [],
          canCreate: true,
          generationAvailable: false,
          mission: null,
        },
      }),
    );
    await page.route('**/api/technology/builds**', async (route) => {
      if (route.request().url().includes('?export=')) {
        await route.fulfill({ contentType: 'text/html', body: renderArtifact(brief) });
        return;
      }
      if (route.request().method() === 'POST') {
        posts++;
        const b = route.request().postDataJSON();
        if (b.action === 'queue')
          builds.push({
            id: b.id,
            project_id: project,
            version_id: version,
            status: 'queued',
            attempts: 0,
          });
        if (b.action === 'resume') {
          if (interrupt) {
            interrupt = false;
            await route.fulfill({
              status: 503,
              json: { error: 'Build completion uncertain. Reload before resuming.' },
            });
            return;
          }
          Object.assign(builds[0]!, { status: 'ready', attempts: 2, sha256: 'a'.repeat(64) });
        }
        await route.fulfill({ json: { id: b.id } });
        return;
      }
      await route.fulfill({ json: { builds } });
    });
    await page.goto(`http://127.0.0.1:3102/?mode=technology&project=${project}`);
    await page.getByRole('button', { name: 'Prepare website build' }).click();
    await expect(page.getByText(/Current version · queued/)).toBeVisible();
    await page.getByRole('button', { name: 'Build / resume saved job' }).click();
    await expect(
      page.getByText('Build completion uncertain. Reload before resuming.'),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Current version · queued/)).toBeVisible();
    expect(posts).toBe(2);
    await page.getByRole('button', { name: 'Build / resume saved job' }).click();
    await expect(page.getByRole('link', { name: 'Download website HTML' })).toHaveAttribute(
      'href',
      /export=/,
    );
    await page.getByRole('button', { name: 'Inspect isolated website' }).click();
    const frame = page.frameLocator('iframe[title="Isolated built website"]');
    await expect(frame.getByRole('heading', { name: 'Care with intention' })).toBeVisible();
    await frame.getByRole('link', { name: 'Services', exact: true }).click();
    expect(
      await frame.getByRole('heading', { name: 'Services', exact: true }).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < innerHeight;
      }),
    ).toBe(true);
    await expect(page.locator('iframe')).toHaveAttribute('sandbox', '');
    await page.locator('iframe').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/technology-build-${width}.png` });
    expect(
      await frame
        .locator('body')
        .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByLabel('Headline', { exact: true }).fill('Unsaved revision');
    await expect(page.getByRole('button', { name: 'Prepare website build' })).toBeDisabled();
  });
