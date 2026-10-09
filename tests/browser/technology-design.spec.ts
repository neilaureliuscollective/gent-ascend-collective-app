import { test, expect } from './fixtures';
import { defaultDesign } from '../../src/domains/technology/schema';
const id = 'f1900000-0000-4000-8000-000000000001',
  vid = 'f1900000-0000-4000-8000-000000000002';
const brief = {
  name: 'Studio North',
  industry: 'grooming-beauty',
  vision: 'A premium local grooming studio.',
  headline: 'Care with intention',
  about: 'A carefully considered local studio.',
  services: [{ name: 'Haircut', description: 'Attentive care.', price: '$45' }],
  hours: 'Tue–Sat',
  contact: 'Call us',
  bookingUrl: '',
};
for (const width of [320, 720, 1440])
  test(`Conversational design revision preserves history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const data = {
      projects: [{ id, revision: 1, mission_id: null }],
      versions: [
        {
          id: vid,
          project_id: id,
          revision: 1,
          brief,
          reviewed_at: '2026-10-09T00:00:00Z',
          created_at: '2026-10-09T00:00:00Z',
        },
      ],
      runs: [],
      canCreate: true,
      generationAvailable: true,
      remainingMicros: 10000000,
      mission: null,
    };
    const posts: Record<string, unknown>[] = [];
    await page.route('**/api/technology', async (route) => {
      if (route.request().method() === 'POST') {
        const b = route.request().postDataJSON();
        posts.push(b);
        if (b.action === 'generate') {
          expect(b.expected).toBe(1);
          expect(b.instruction).toBe('Make the homepage more luxurious.');
          expect(b.consent).toBe(true);
          data.projects[0]!.revision = 2;
          data.versions.unshift({
            id: crypto.randomUUID(),
            project_id: id,
            revision: 2,
            brief: {
              ...brief,
              headline: 'A considered standard',
              design: {
                ...defaultDesign,
                palette: 'ivory',
                hero: 'centered',
                rationale: 'An editorial hierarchy.',
                request: b.instruction,
              },
            },
            reviewed_at: null,
            created_at: '2026-10-09T00:01:00Z',
          } as unknown as (typeof data.versions)[number]);
        }
        await route.fulfill({ json: { versionId: data.versions[0]!.id } });
        return;
      }
      await route.fulfill({ json: data });
    });
    await page.route('**/api/technology/builds**', (route) =>
      route.fulfill({ json: { builds: [] } }),
    );
    await page.goto(`http://127.0.0.1:3102/?mode=technology&project=${id}`);
    await page.getByLabel('Website revision request').fill('Make the homepage more luxurious.');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Apply requested revision' }).click();
    await expect(page.getByText('Saved brief needs your review')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A considered standard' })).toBeVisible();
    await expect(page.getByText('Design decision: An editorial hierarchy.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply requested revision' })).toBeDisabled();
    await expect(page.locator('.technology-preview')).toHaveCSS(
      'background-color',
      'rgb(245, 241, 232)',
    );
    await page.screenshot({
      path: `test-results/technology-phase3-current-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: /Version 1 · Reviewed/ }).click();
    await expect(page.getByRole('heading', { name: 'Care with intention' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm this saved brief' })).toBeDisabled();
    expect(posts).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/technology-phase3-${width}.png`, fullPage: true });
  });
