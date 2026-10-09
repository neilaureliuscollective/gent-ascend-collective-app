import { componentUrl } from './fixtures';
import { test, expect } from './fixtures';
const mission = {
  id: 'dd000000-0000-4000-8000-000000000001',
  person_id: 'dd000000-0000-4000-8000-000000000002',
  conversation_id: 'dd000000-0000-4000-8000-000000000003',
  title: 'Website launch',
  objective: 'Launch landscaping website',
  status: 'active',
  decisions: 'Use a single clear offer',
  open_questions: 'Which photos can we use?',
  next_actions: 'Draft the homepage brief',
  revision: 1,
  created_at: '2026-10-06T00:00:00Z',
  updated_at: '2026-10-06T00:00:00Z',
};
const continuity = {
  mission,
  proposals: [],
  projectId: null,
  studioRevision: null,
  outputs: [],
  images: [],
};
async function mockMission(page: import('@playwright/test').Page) {
  await page.route('**/api/missions**', (r) =>
    r.fulfill({
      json: r.request().url().includes('/continuity') ? continuity : { missions: [mission] },
    }),
  );
}
test('resume exposes reviewed Mission scope without staging or sending a synthetic prompt', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let sends = 0;
  await mockMission(page);
  await page.route('**/api/aurelius**', (r) => {
    if (r.request().method() !== 'GET') sends++;
    return r.fulfill({
      json: {
        ownerId: mission.person_id,
        conversations: [],
        turns: [],
        memories: [],
        actionProposals: [],
        context: {
          profile: {
            name: 'Synthetic',
            priority: '',
            timezone: 'UTC',
            units: 'metric',
            updatedAt: '',
          },
          goal: null,
          memories: [],
        },
        canChat: true,
        configured: true,
        model: 'synthetic',
      },
    });
  });
  await page.goto(componentUrl('/?mode=mission&talk=1'));
  await expect(page.locator('.talk-mission-trigger')).toContainText('context on');
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('');
  await page.locator('.talk-mission-trigger').click();
  await expect(page.getByText('Draft the homepage brief').first()).toBeVisible();
  await page.screenshot({ path: '/tmp/public-mission-dialog.png' });
  await page.getByRole('checkbox', { name: /Use this Mission/ }).uncheck();
  await expect(page.locator('.talk-mission-trigger')).toContainText('context off');
  expect(sends).toBe(0);
});
test('Mission conflict keeps edits, locks replay and requests saved-state recovery', async ({
  page,
}) => {
  let saves = 0;
  await mockMission(page);
  await page.route('**/api/missions', (r) => {
    saves++;
    return r.fulfill({
      status: 409,
      json: { error: 'Mission changed. Reload before editing again.' },
    });
  });
  await page.goto(componentUrl('/?mode=mission'));
  await page.getByText('Edit saved direction', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Next actions', exact: true }).fill('Revised next step');
  await page.getByRole('button', { name: 'Save direction', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Mission changed');
  await expect(page.getByRole('textbox', { name: 'Next actions', exact: true })).toHaveValue(
    'Revised next step',
  );
  await expect(page.getByRole('button', { name: 'Save direction', exact: true })).toBeDisabled();
  expect(saves).toBe(1);
});
test('reviewed proposals preserve edits and require explicit acceptance', async ({ page }) => {
  const direction = {
    title: mission.title,
    objective: mission.objective,
    decisions: mission.decisions,
    open_questions: mission.open_questions,
    next_actions: 'Review a first draft',
  };
  let accepted: unknown = null;
  await page.route('**/api/missions/continuity**', (r) => {
    if (r.request().method() === 'POST') {
      accepted = r.request().postDataJSON();
      return r.fulfill({ json: { missionId: mission.id } });
    }
    return r.fulfill({
      json: {
        ...continuity,
        proposals: accepted
          ? []
          : [
              {
                id: mission.id,
                mission_id: mission.id,
                person_id: mission.person_id,
                source_turn_id: mission.id,
                base_revision: 1,
                direction,
                status: 'pending',
                accepted_direction: null,
                created_at: mission.created_at,
              },
            ],
      },
    });
  });
  await page.goto(componentUrl('/?mode=mission'));
  await expect(page.getByText('Review proposed direction')).toBeVisible();
  expect(accepted).toBe(null);
  await page.locator('.mission-proposal textarea').fill('Review my revised draft');
  await page.getByRole('button', { name: 'Accept reviewed direction' }).click();
  await expect
    .poll(() => accepted)
    .toMatchObject({ action: 'decide', direction: { next_actions: 'Review my revised draft' } });
});
for (const width of [360, 720, 1440])
  test(`Mission detail stays usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await mockMission(page);
    await page.goto(componentUrl('/?mode=mission'));
    await expect(page.getByRole('button', { name: 'Prepare creative project' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });

test('linked Studio project survives refresh without generating and returns to its Mission', async ({
  page,
}) => {
  const project = 'de000000-0000-4000-8000-000000000001';
  let writes = 0;
  const loads: string[] = [];
  await page.route('**/api/studio**', (r) => {
    if (r.request().method() !== 'GET') writes++;
    loads.push(r.request().url());
    return r.fulfill({
      json: {
        owner: mission.person_id,
        projectId: project,
        projects: [
          {
            id: project,
            title: 'Website visual',
            creative_type: 'personal',
            brief: { purpose: 'Launch landscaping website', direction: 'Use a single clear offer' },
            updated_at: mission.updated_at,
          },
        ],
        versions: [],
        references: [],
        scenes: [],
        finishes: [],
        configured: true,
        mission: { id: mission.id, title: mission.title },
      },
    });
  });
  await page.goto(`/app/studio?project=${project}`);
  await expect(page.getByRole('link', { name: '← Return to Website launch' })).toHaveAttribute(
    'href',
    `/app/missions?id=${mission.id}`,
  );
  await page.reload();
  await expect(page.getByRole('link', { name: '← Return to Website launch' })).toBeVisible();
  expect(loads.filter((x) => x.includes(`project=${project}`)).length).toBeGreaterThanOrEqual(2);
  expect(writes).toBe(0);
});
