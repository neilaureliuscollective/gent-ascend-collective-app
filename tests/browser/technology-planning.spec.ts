import { test, expect } from './fixtures';
const mission = 'dd000000-0000-4000-8000-000000000001',
  conversation = 'dd000000-0000-4000-8000-000000000003',
  turn = 'f2200000-0000-4000-8000-000000000001';
const brief = {
  name: 'Studio North',
  industry: 'professional-services',
  vision: 'A premium local consulting studio.',
  headline: 'Clarity for your next step',
  about: 'A thoughtful consulting studio for local businesses.',
  services: [{ name: 'Consultation', description: 'Focused guidance.', price: '' }],
  hours: '',
  contact: '',
  bookingUrl: '',
};
for (const width of [320, 720, 1440])
  test(`Talk proposal remains a reviewed draft at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const posts: unknown[] = [];
    await page.route('**/api/technology?mission=*', (r) =>
      r.fulfill({
        json: {
          projects: [],
          versions: [],
          runs: [],
          canCreate: true,
          generationAvailable: true,
          remainingMicros: 10000000,
          mission: { id: mission, revision: 1, title: 'Website', objective: brief.vision },
        },
      }),
    );
    await page.route('**/api/technology/proposal?*', (r) =>
      r.fulfill({ json: { brief, missionId: mission, missionRevision: 1, turnId: turn } }),
    );
    await page.route('**/api/technology', (r) => {
      posts.push(r.request().postDataJSON());
      return r.fulfill({ json: {} });
    });
    await page.goto(`http://127.0.0.1:3102/?mode=technology&mission=${mission}&proposal=${turn}`);
    await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('Studio North');
    await expect(page.getByRole('status')).toContainText('Confirm every fact');
    await expect(page.getByRole('button', { name: 'Save new version' })).toBeEnabled();
    expect(posts).toHaveLength(0);
    await expect(page.getByRole('button', { name: 'Apply requested revision' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/public-phase4-proposal-${width}.png` });
  });
test('saved website Talk context is explicit and sends only identity/revision', async ({
  page,
}) => {
  const project = 'f2200000-0000-4000-8000-000000000002';
  let body: Record<string, unknown> | null = null;
  await page.route('**/api/missions**', (r) => r.fulfill({ json: { missions: [] } }));
  await page.route('**/api/technology', (r) =>
    r.fulfill({
      json: {
        projects: [
          { id: project, revision: 3, mission_id: mission, conversation_id: conversation },
        ],
        versions: [{ id: crypto.randomUUID(), project_id: project, revision: 3, brief }],
        runs: [],
      },
    }),
  );
  await page.route('**/api/aurelius**', (r) => {
    if (r.request().method() === 'POST') {
      body = r.request().postDataJSON();
      return r.fulfill({ status: 503, json: { error: 'Synthetic provider withheld.' } });
    }
    return r.fulfill({
      json: {
        ownerId: 'owner',
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
  await page.goto(`http://127.0.0.1:3102/?mode=mission&talk=1&technology=${project}`);
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  const consent = page.getByRole('checkbox', {
    name: 'Include this website brief in my next Talk message',
  });
  await expect(consent).not.toBeChecked();
  await consent.check();
  await expect(page.getByText('Sends the exact saved v3 brief')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Message Aethelios').fill('How could the homepage be more luxurious?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => body).not.toBeNull();
  expect(body).toMatchObject({ website: { id: project, revision: 3 }, includeContext: false });
  expect(body).not.toHaveProperty('brief');
  expect(body).not.toHaveProperty('websitePlanning');
});

test('planning mode survives a saved reply and presents a business proposal without code', async ({
  page,
}) => {
  let sent: Record<string, unknown> | null = null;
  await page.route('**/api/missions**', (r) => r.fulfill({ json: { missions: [] } }));
  await page.route('**/api/aurelius**', (r) => {
    if (r.request().method() === 'POST') {
      sent = r.request().postDataJSON();
      return r.fulfill({ status: 503, json: { error: 'Synthetic provider withheld.' } });
    }
    return r.fulfill({
      json: {
        ownerId: 'owner',
        conversations: [],
        turns: [
          {
            id: turn,
            conversation_id: conversation,
            user_text: 'Draft my website brief',
            assistant_text:
              'A proposed business website.\n```aethelios-website\n' +
              JSON.stringify(brief) +
              '\n```',
            status: 'complete',
            prompt_version: 'synthetic:website-planning-v1',
            created_at: '2026-10-09T00:00:00Z',
          },
        ],
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
  await page.goto('http://127.0.0.1:3102/?mode=mission&talk=1');
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Plan a website with Aethelios' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Studio North · Proposed website')).toBeVisible();
  await expect(page.locator('.message-markdown')).not.toContainText('bookingUrl');
  await page.getByLabel('Message Aethelios').fill('What should I clarify before saving?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => sent).not.toBeNull();
  expect(sent).toMatchObject({ websitePlanning: true, includeContext: false });
  expect(sent).not.toHaveProperty('website');
});
