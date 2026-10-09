import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';
import { syntheticWork } from '../component-fixture/company-work-data';
const fixture = componentUrl('/?mode=company-job');
for (const width of [360, 768, 1440])
  test(`company work retains edits and reviews the exact version at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const saves: Array<Record<string, unknown>> = [];
    let fail = true;
    await page.route('**/api/company-work?**', async (route) => {
      const url = new URL(route.request().url());
      const result =
        url.searchParams.get('format') === 'preview'
          ? {
              slides: [
                {
                  width: 960,
                  height: 540,
                  lines: [{ text: 'Synthetic positioning', x: 52, y: 62, size: 30, kind: 'title' }],
                },
              ],
            }
          : url.searchParams.has('jobId')
            ? syntheticWork
            : { jobs: [syntheticWork.job] };
      await route.fulfill({ status: 200, json: result });
    });
    await page.route('**/api/company-work', async (route) => {
      const body = route.request().postDataJSON();
      saves.push(body);
      if (fail) {
        fail = false;
        await route.fulfill({ status: 503, json: { error: 'Synthetic lost save acknowledgment' } });
        return;
      }
      await route.fulfill({
        status: 200,
        json: {
          ...syntheticWork,
          job: { ...syntheticWork.job, revision: 2 },
          versions: [
            {
              ...syntheticWork.versions[0],
              id: body.versionId,
              revision: 2,
              content: body.content,
            },
            ...syntheticWork.versions,
          ],
        },
      });
    });
    await page.goto(fixture);
    await page.getByRole('button', { name: 'Brief & presentation', exact: false }).click();
    await expect(page.getByRole('img', { name: 'Slide 1:', exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Edit deliverable', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Title', exact: true })
      .fill('Revised synthetic positioning');
    await page.getByRole('button', { name: 'Save new version', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('lost save acknowledgment');
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Revised synthetic positioning',
    );
    await page.getByRole('button', { name: 'Retry exact save', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Revised synthetic positioning', exact: true }),
    ).toBeVisible();
    expect(saves).toHaveLength(2);
    expect(saves[0]).toEqual(saves[1]);
    expect(saves[0]!.companyId).toBe(syntheticWork.job.company_id);
    expect(saves[0]!.expected).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Company tools', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exit full-screen', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close Company tools', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Company tools', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Full-screen work', exact: true })).toBeVisible();
  });
test('Studio generation remains behind exact prompt approval', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/company-work?**', (route) =>
    route.fulfill({
      status: 200,
      json: new URL(route.request().url()).searchParams.get('format')
        ? { slides: [] }
        : { jobs: [syntheticWork.job] },
    }),
  );
  await page.route('**/api/company-work/visual', async (route) => {
    requests++;
    const body = route.request().postDataJSON();
    expect(body.approved).toBe(true);
    expect(body.companyId).toBe(syntheticWork.job.company_id);
    expect(body.jobId).toBe(syntheticWork.job.id);
    expect(body.prompt).toBe('Synthetic brand visual');
    await route.fulfill({ status: 503, json: { error: 'Synthetic provider unavailable' } });
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Brief & presentation', exact: false }).click();
  await page.getByText('Studio visuals for this job', { exact: true }).click();
  await page.getByLabel('Visual request', { exact: true }).fill('Synthetic brand visual');
  await expect(
    page.getByRole('button', { name: 'Generate approved visual', exact: true }),
  ).toBeDisabled();
  expect(requests).toBe(0);
  await page.getByLabel('Approve one generation with this prompt and mode').check();
  await page.getByRole('button', { name: 'Generate approved visual', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('provider unavailable');
  expect(requests).toBe(1);
});
