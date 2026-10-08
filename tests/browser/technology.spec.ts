import { test, expect } from './fixtures';
const brief = {
  name: 'Studio North',
  vision: 'A welcoming local grooming studio.',
  headline: 'Care with intention',
  about: 'A local studio focused on thoughtful care.',
};
for (const width of [320, 720, 1440])
  test(`Technology save/review/history/resume at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const data = {
      projects: [] as Record<string, unknown>[],
      versions: [] as Record<string, unknown>[],
      runs: [],
      canCreate: true,
      generationAvailable: false,
      mission: null,
    };
    let posts = 0;
    await page.route('**/api/technology**', async (route) => {
      if (route.request().method() === 'POST') {
        posts++;
        const b = route.request().postDataJSON();
        if (b.action === 'create') {
          data.projects.push({ id: b.id, revision: 1, mission_id: null });
          data.versions.unshift({
            id: b.versionId,
            project_id: b.id,
            revision: 1,
            brief: b.brief,
            reviewed_at: null,
            created_at: '2026-10-08T12:00:00Z',
          });
        }
        if (b.action === 'save') {
          data.projects[0]!.revision = 2;
          data.versions.unshift({
            id: b.versionId,
            project_id: b.id,
            revision: 2,
            brief: b.brief,
            reviewed_at: null,
            created_at: '2026-10-08T12:01:00Z',
          });
        }
        if (b.action === 'review') data.versions[0]!.reviewed_at = '2026-10-08T12:02:00Z';
        await route.fulfill({ json: { versionId: b.versionId } });
        return;
      }
      await route.fulfill({ json: data });
    });
    await page.route('**/api/technology/builds**', (route) =>
      route.fulfill({ json: { builds: [] } }),
    );
    await page.goto('http://127.0.0.1:3102/?mode=technology');
    await page.getByLabel('Business name', { exact: true }).fill(brief.name);
    await page.getByLabel('Your vision').fill(brief.vision);
    await page.getByLabel('Headline', { exact: true }).fill(brief.headline);
    await page.getByLabel('About your business').fill(brief.about);
    await page.getByLabel('Service 1', { exact: true }).fill('Haircut');
    await page.getByLabel('Price as displayed').fill('$45');
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect(page.getByRole('button', { name: 'Confirm this saved brief' })).toBeEnabled();
    await page.getByRole('button', { name: 'Confirm this saved brief' }).click();
    await expect(page.getByText('Exact saved version reviewed by you')).toBeVisible();
    await page.getByLabel('Headline', { exact: true }).fill('A new beginning');
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect(page.getByText('Saved brief needs your review')).toBeVisible();
    await page.getByRole('button', { name: /Version 1 · Reviewed/ }).click();
    await expect(page.getByRole('heading', { name: brief.headline })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm this saved brief' })).toBeDisabled();
    await page.getByRole('button', { name: 'Return to current working preview' }).click();
    await expect(page.getByRole('button', { name: 'Confirm this saved brief' })).toBeEnabled();
    await page.getByRole('button', { name: 'Contact', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Preview only · messages are not sent' }),
    ).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.reload();
    await page.getByRole('button', { name: /Studio North · v2/ }).click();
    await expect(page.getByLabel('Headline', { exact: true })).toHaveValue('A new beginning');
    expect(posts).toBe(3);
    if (width === 1440)
      await page.screenshot({ path: '/tmp/aethelios-technology-desktop.png', fullPage: true });
  });

test('an ambiguous paid outcome locks writes and reload prevents duplicate generation', async ({
  page,
}) => {
  const b = {
    ...brief,
    industry: 'grooming-beauty',
    services: [{ name: 'Haircut', description: 'Care', price: '$45' }],
    hours: '',
    contact: '',
    bookingUrl: '',
  };
  const data = {
    projects: [{ id: 'p', revision: 1, mission_id: null }],
    versions: [
      {
        id: 'v',
        project_id: 'p',
        revision: 1,
        brief: b,
        reviewed_at: '2026-10-08T12:00:00Z',
        created_at: '2026-10-08T12:00:00Z',
      },
    ],
    runs: [] as Record<string, unknown>[],
    canCreate: true,
    generationAvailable: true,
    mission: null,
  };
  let posts = 0;
  page.on('dialog', (dialog) => dialog.accept());
  await page.route('**/api/technology**', async (route) => {
    if (route.request().method() === 'POST') {
      posts++;
      data.runs.push({ id: 'run', status: 'uncertain', actual_micros: null });
      await route.fulfill({ status: 503, json: { error: 'Generation needs reconciliation.' } });
      return;
    }
    await route.fulfill({ json: data });
  });
  await page.route('**/api/technology/builds**', (route) =>
    route.fulfill({ json: { builds: [] } }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=technology');
  await page.getByRole('button', { name: /Studio North · v1/ }).click();
  await page.getByRole('button', { name: 'Refine copy with Aethelios' }).click();
  await expect(page.getByRole('alert')).toContainText('reconciliation');
  await expect(page.getByLabel('Business name', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload saved state' }).click();
  await expect(page.getByText('Run run · uncertain · $1 reserved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refine copy with Aethelios' })).toBeDisabled();
  expect(posts).toBe(1);
});
