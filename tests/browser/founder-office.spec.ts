import { expect, test } from '@playwright/test';
import { founderOfficeFixture } from '../component-fixture/founder-office-data';
import { syntheticWork } from '../component-fixture/company-work-data';
for (const width of [320, 344, 768, 900, 1440, 2560]) {
  test(`Founder Office keeps scope, honest operations and keyboard controls usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3102/?mode=founder-office');
    await expect(page.getByRole('heading', { name: 'Synthetic Founder’s office.' })).toBeVisible();
    await page
      .getByLabel('What needs to happen?')
      .fill('Prepare a useful synthetic business proposal.');
    expect(await page.getByLabel('Company or project').inputValue()).toBe(
      founderOfficeFixture.companies[0]!.id,
    );
    await page.getByLabel('Assigned Coworker').selectOption('mara');
    await expect(
      page.getByText('No authorized repository writes or private access.', { exact: false }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByLabel('What needs to happen?').focus();
    await expect(page.getByLabel('What needs to happen?')).toBeFocused();
    await page.screenshot({ path: `test-results/founder-office-${width}.png`, fullPage: true });
  });
}
test('Founder Office saves an exact mission before generating and recovers its deliverable receipt', async ({
  page,
}) => {
  const preparations: unknown[] = [],
    generations: unknown[] = [];
  await page.route('**/api/founder-office', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: founderOfficeFixture });
    const body = route.request().postDataJSON();
    preparations.push(body);
    await route.fulfill({
      json: {
        ...syntheticWork,
        job: {
          ...syntheticWork.job,
          id: body.jobId,
          conversation_id: body.conversationId,
          revision: 0,
        },
        versions: [],
      },
    });
  });
  await page.route('**/api/company-work', async (route) => {
    const body = route.request().postDataJSON();
    generations.push(body);
    if (generations.length === 1)
      return route.fulfill({
        status: 503,
        json: { error: 'Model reply saved; deliverable acknowledgment unavailable.' },
      });
    await route.fulfill({ json: syntheticWork });
  });
  await page.goto('http://127.0.0.1:3102/?mode=founder-office');
  await page.getByLabel('Assigned Coworker').selectOption('mara');
  await page
    .getByLabel('What needs to happen?')
    .fill('Review supplied synthetic financial evidence');
  await page.getByRole('button', { name: 'Save objective only', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Mission saved');
  expect(generations).toHaveLength(0);
  await page.getByRole('button', { name: 'Prepare and save deliverable', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('acknowledgment unavailable');
  await page.getByRole('button', { name: 'Prepare and save deliverable', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('Deliverable saved');
  expect(preparations).toHaveLength(1);
  expect(generations[0]).toEqual(generations[1]);
  expect(generations[0]).toMatchObject({ specialistId: 'mara', expected: 0 });
  expect(generations[0]).not.toHaveProperty('personId');
});
test('Founder job controls save versioned task and approval snapshots without claiming external execution', async ({
  page,
}) => {
  page.on('pageerror', (error) => console.log('Synthetic Founder fixture error:', error.message));
  let work = structuredClone(syntheticWork);
  const mutations: Array<{ endpoint: string; body: Record<string, unknown> }> = [];
  await page.route('**/api/company-work?*', (route) => route.fulfill({ json: { jobs: [] } }));
  await page.route('**/api/founder-office/tasks', async (route) => {
    const body = route.request().postDataJSON();
    mutations.push({ endpoint: 'tasks', body });
    work = {
      ...work,
      job: { ...work.job, revision: work.job.revision + 1 },
      versions: [
        {
          ...work.versions[0]!,
          id: body.versionId,
          revision: work.job.revision + 1,
          content: { ...work.versions[0]!.content, taskPlan: body.taskPlan },
        },
        ...work.versions,
      ],
    };
    await route.fulfill({ json: work });
  });
  await page.route('**/api/founder-office/approvals', async (route) => {
    const body = route.request().postDataJSON();
    mutations.push({ endpoint: 'approvals', body });
    const proposals = work.versions[0]!.content.approvalRequests ?? [];
    const approvalRequests = body.proposal
      ? [...proposals, { ...body.proposal, status: 'pending' }]
      : proposals.map((item) =>
          item.id === body.proposalId
            ? { ...item, status: body.approve ? ('approved' as const) : ('rejected' as const) }
            : item,
        );
    work = {
      ...work,
      job: { ...work.job, revision: work.job.revision + 1 },
      versions: [
        {
          ...work.versions[0]!,
          id: body.versionId,
          revision: work.job.revision + 1,
          content: { ...work.versions[0]!.content, approvalRequests },
        },
        ...work.versions,
      ],
    };
    await route.fulfill({ json: work });
  });
  await page.goto('http://127.0.0.1:3102/?mode=founder-job');
  const workControl = page.getByRole('button', { name: /Brief & presentation/ });
  await workControl.waitFor({ timeout: 15000 }).catch(async () => {
    throw new Error(
      'Saved-job fixture did not render its controls: ' +
        (await page.locator('body').innerText()).slice(0, 3000),
    );
  });
  await workControl.click();
  await page.getByLabel('Milestone or task').fill('Review the proposal');
  await page.getByLabel('Task objective').fill('Review the supplied evidence before publication');
  await page.getByLabel('Coworker', { exact: true }).selectOption('mara');
  await page.getByRole('button', { name: 'Save milestone', exact: true }).click();
  await expect(page.getByText('MARA · planned')).toBeVisible();
  await page.getByLabel('Approval title').fill('Publish the reviewed proposal');
  await page
    .getByLabel('Exact proposed action, target and limits')
    .fill('Publish only the reviewed private draft after verifying its sources.');
  await page.getByRole('button', { name: 'Save for approval', exact: true }).click();
  await page.getByRole('button', { name: 'Approve proposal', exact: true }).click();
  await expect(page.getByText('publishing · approved · execution unavailable')).toBeVisible();
  expect(mutations.map((m) => m.endpoint)).toEqual(['tasks', 'approvals', 'approvals']);
  expect(mutations[0]!.body.expected).toBe(1);
  expect(mutations[2]!.body.expected).toBe(3);
});
