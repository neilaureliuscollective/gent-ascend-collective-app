import { test, expect } from './fixtures';
const syntheticMission = { person_id: 'dd000000-0000-4000-8000-000000000002' };
test('resume preserves the selected conversation and stages only authorized direction without sending', async ({
  page,
}) => {
  let sends = 0;
  await page.route('**/api/aurelius**', (route) => {
    if (route.request().method() !== 'GET') sends++;
    return route.fulfill({
      json: {
        ownerId: syntheticMission.person_id,
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
  await page.goto('http://127.0.0.1:3102/?mode=mission');
  await expect(page.getByText(/Recorded contributors: Aethelios · Prometheus/)).toBeVisible();
  await page.getByRole('button', { name: 'Prepare next move' }).click();
  await expect(page.getByLabel('Message Aethelios')).toHaveValue(/Draft the homepage brief/);
  expect(sends).toBe(0);
});
test('Mission conflict keeps edits, locks replay and requests saved-state recovery', async ({
  page,
}) => {
  let saves = 0;
  await page.route('**/api/missions', (route) => {
    saves++;
    return route.fulfill({
      status: 409,
      json: { error: 'Mission changed. Reload before editing again.' },
    });
  });
  await page.goto('http://127.0.0.1:3102/?mode=mission');
  await page.getByLabel('Next actions').fill('Revised next step');
  await expect(page.getByRole('button', { name: 'Prepare next move' })).toBeDisabled();
  await page.getByRole('button', { name: 'Save direction' }).click();
  await expect(page.getByRole('alert')).toContainText('Mission changed');
  await expect(page.getByLabel('Next actions')).toHaveValue('Revised next step');
  await expect(page.getByRole('button', { name: 'Save direction' })).toBeDisabled();
  expect(saves).toBe(1);
});
