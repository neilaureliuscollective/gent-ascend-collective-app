import { test, expect } from './fixtures';
import sharp from 'sharp';
import { renderArtifact } from '../../src/domains/technology/artifact';
const project = 'f6400000-0000-4000-8000-000000000001',
  source = 'f6400000-0000-4000-8000-000000000002',
  asset = 'f6400000-0000-4000-8000-000000000003';
const brief = {
  name: 'Synthetic image studio',
  industry: 'professional-services' as const,
  vision: 'A considered studio website.',
  headline: 'Considered work',
  about: 'A studio for thoughtful work.',
  services: [{ name: 'Consultation', description: 'Discuss your needs.', price: '' }],
  contact: '',
  hours: '',
  bookingUrl: '',
};
for (const width of [320, 720, 1440]) {
  test(`owned image selection, alt review and saved recovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const jpeg = await sharp({
      create: { width: 900, height: 600, channels: 3, background: '#145463' },
    })
      .jpeg()
      .toBuffer();
    let current: typeof brief & { image?: { assetId: string; alt: string } } = { ...brief };
    let revision = 1;
    let prepared = false;
    const posts: Record<string, unknown>[] = [];
    await page.route('**/api/technology', async (r) => {
      if (r.request().method() === 'POST') {
        const body = r.request().postDataJSON();
        posts.push(body);
        current = body.brief;
        revision++;
        return r.fulfill({ json: { versionId: body.versionId } });
      }
      return r.fulfill({
        json: {
          projects: [{ id: project, revision }],
          versions: [
            {
              id: crypto.randomUUID(),
              project_id: project,
              revision,
              brief: current,
              reviewed_at: null,
              created_at: '2026-10-09T00:00:00Z',
            },
          ],
          runs: [],
          canCreate: true,
          generationAvailable: false,
          mission: null,
          remainingMicros: 10000000,
        },
      });
    });
    await page.route('**/api/technology/builds**', (r) => r.fulfill({ json: { builds: [] } }));
    await page.route('**/api/technology/images**', (r) => {
      if (r.request().url().includes('id='))
        return r.fulfill({ body: jpeg, contentType: 'image/jpeg' });
      if (r.request().method() === 'POST') {
        posts.push(r.request().postDataJSON());
        prepared = true;
        return r.fulfill({ json: { id: asset } });
      }
      return r.fulfill({
        json: {
          sources: [{ id: source, kind: 'reference', label: 'Synthetic personal Studio image' }],
          images: prepared
            ? [
                {
                  id: asset,
                  source_id: source,
                  source_kind: 'reference',
                  status: 'ready',
                  attempts: 1,
                },
              ]
            : [],
        },
      });
    });
    await page.goto(`http://127.0.0.1:3102/?mode=technology&project=${project}`);
    await page.getByText('Website imagery', { exact: true }).click();
    await page.getByLabel('Personal Studio image').selectOption(`reference:${source}`);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Prepare selected image' }).click();
    await expect(page.getByLabel('Homepage image').locator('option')).toHaveCount(2);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ sourceId: source, consent: true, expected: 1 });
    expect(posts[0]).not.toHaveProperty('person_id');
    await page.getByLabel('Homepage image').selectOption(asset);
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect(page.getByRole('alert')).toContainText('image.alt');
    expect(posts).toHaveLength(1);
    await page.getByLabel('Image description').fill('A synthetic petrol studio');
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect.poll(() => posts.length).toBe(2);
    expect(posts[1]).toMatchObject({
      brief: { image: { assetId: asset, alt: 'A synthetic petrol studio' } },
    });
    await page.reload();
    await expect(page.locator('.technology-preview img')).toHaveAttribute(
      'alt',
      'A synthetic petrol studio',
    );
    await expect
      .poll(() =>
        page
          .locator('.technology-preview img')
          .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/technology-image-preview-${width}.png`,
      fullPage: true,
    });
    await page.getByText('Website imagery', { exact: true }).click();
    await page.getByLabel('Homepage image').selectOption('');
    await expect(page.locator('.technology-preview img')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect.poll(() => posts.length).toBe(3);
    expect(posts[2]!.brief as Record<string, unknown>).not.toHaveProperty('image');
  });
  test(`embedded image export stays responsive and makes no remote image request at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const data = await sharp({
      create: { width: 1000, height: 650, channels: 3, background: '#145463' },
    })
      .jpeg()
      .toBuffer();
    const remote: string[] = [];
    page.on('request', (r) => {
      if (/^https?:/.test(r.url())) remote.push(r.url());
    });
    const html = renderArtifact(
      { ...brief, image: { assetId: asset, alt: 'A synthetic petrol studio' } },
      { assetId: asset, dataUrl: 'data:image/jpeg;base64,' + data.toString('base64') },
    );
    await page.setContent(html);
    await expect
      .poll(() =>
        page
          .getByRole('img', { name: 'A synthetic petrol studio' })
          .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
      )
      .toBe(true);
    expect(remote).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/technology-image-export-${width}.png` });
  });
}
