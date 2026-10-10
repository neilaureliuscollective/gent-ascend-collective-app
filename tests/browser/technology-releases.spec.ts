import { test, expect } from './fixtures';
const project = 'f7300000-0000-4000-8000-000000000001',
  version = 'f7300000-0000-4000-8000-000000000002',
  build = 'f7300000-0000-4000-8000-000000000003';
const brief = {
  name: 'Synthetic release studio',
  industry: 'professional-services',
  vision: 'A considered synthetic website.',
  headline: 'Considered work',
  about: 'A synthetic service.',
  services: [{ name: 'Consultation', description: 'Discuss your needs.', price: '' }],
  hours: '',
  contact: '',
  bookingUrl: '',
};
for (const width of [320, 720, 1440])
  test(`release approval, uncertain-write recovery and revocation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    let receipt: Record<string, unknown> | null = null,
      interrupt = true;
    const posts: Record<string, unknown>[] = [];
    await page.route('**/api/technology', (r) =>
      r.fulfill({
        json: {
          projects: [{ id: project, revision: 1 }],
          versions: [
            {
              id: version,
              project_id: project,
              revision: 1,
              brief,
              reviewed_at: '2026-10-09T00:00:00Z',
              created_at: '2026-10-09T00:00:00Z',
            },
          ],
          runs: [],
          canCreate: true,
          generationAvailable: false,
          mission: null,
        },
      }),
    );
    await page.route('**/api/technology/builds**', (r) =>
      r.fulfill({
        json: {
          builds: [
            {
              id: build,
              project_id: project,
              version_id: version,
              status: 'ready',
              attempts: 1,
              sha256: 'a'.repeat(64),
            },
          ],
        },
      }),
    );
    await page.route('**/api/technology/releases**', async (r) => {
      if (r.request().method() === 'POST') {
        const body = r.request().postDataJSON();
        posts.push(body);
        if (body.action === 'approve') {
          receipt = {
            id: body.id,
            build_id: build,
            project_id: project,
            version_id: version,
            revision: 1,
            sha256: body.sha256,
            approved_at: '2026-10-09T04:00:00Z',
            revoked_at: null,
          };
          if (interrupt) {
            interrupt = false;
            return r.fulfill({
              status: 503,
              json: { error: 'Release completion uncertain. Reload its receipt.' },
            });
          }
        } else receipt = { ...receipt, revoked_at: '2026-10-09T04:01:00Z' };
        return r.fulfill({ json: { id: receipt!.id } });
      }
      return r.fulfill({ json: { releases: receipt ? [receipt] : [] } });
    });
    await page.goto(`http://127.0.0.1:3102/?mode=technology&project=${project}`);
    await page.getByRole('button', { name: 'Review release package' }).click();
    const approve = page.getByRole('button', { name: 'Approve release package' });
    await expect(approve).toBeDisabled();
    await page
      .getByRole('checkbox', {
        name: 'I reviewed this exact build and approve preparing its downloadable files.',
      })
      .check();
    await approve.click();
    await expect(page.getByRole('alert')).toContainText('uncertain');
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      action: 'approve',
      buildId: build,
      sha256: 'a'.repeat(64),
      consent: true,
    });
    await page.getByRole('button', { name: 'Reload release receipt' }).click();
    await expect(page.getByRole('link', { name: 'Download release ZIP' })).toHaveAttribute(
      'href',
      `/api/technology/releases?download=${receipt!.id}`,
    );
    expect(posts).toHaveLength(1);
    await page.reload();
    await page.getByRole('button', { name: 'Review release package' }).click();
    await expect(page.getByText(/Package approved.*Not published/)).toBeVisible();
    await page.getByRole('button', { name: 'Revoke package approval' }).click();
    await expect(page.getByText(/Approval revoked.*Not published/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download release ZIP' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Approve release package' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/technology-release-${width}.png`, fullPage: true });
  });
