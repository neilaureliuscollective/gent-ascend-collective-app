import { test, expect } from './fixtures';
const doc = {
  id: 'e7400000-0000-4000-8000-000000000001',
  person_id: 'e7400000-0000-4000-8000-000000000002',
  mission_id: 'e7400000-0000-4000-8000-000000000003',
  source_mission_id: 'e7400000-0000-4000-8000-000000000003',
  source_turn_id: 'e7400000-0000-4000-8000-000000000004',
  source_revision: 1,
  revision: 1,
  created_at: '2026-10-07T00:00:00Z',
};
const v = {
  id: 'e7400000-0000-4000-8000-000000000005',
  person_id: doc.person_id,
  deliverable_id: doc.id,
  revision: 1,
  title: 'Homepage brief',
  body: 'Original saved reply',
  acceptance: '',
  source: 'reply',
  reviewed_at: null as string | null,
  review_note: null as string | null,
  created_at: doc.created_at,
};
for (const width of [320, 720, 1440])
  test(`deliverable save, exact review, history and export at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const versions = [{ ...v }];
    let revision = 1,
      posts = 0;
    await page.route('**/api/missions/deliverables**', async (r) => {
      if (r.request().method() === 'POST') {
        posts++;
        const body = r.request().postDataJSON();
        if (body.action === 'save') {
          expect(body.expected).toBe(revision);
          revision++;
          versions.unshift({
            ...v,
            id: body.versionId,
            revision,
            title: body.title,
            body: body.body,
            acceptance: body.acceptance,
            source: 'manual',
          });
        } else if (body.action === 'review') {
          expect(body.versionId).toBe(versions[0]!.id);
          versions[0] = { ...versions[0]!, reviewed_at: '2026-10-07', review_note: body.note };
        }
        return r.fulfill({ json: { id: doc.id } });
      }
      return r.fulfill({ json: { deliverable: { ...doc, revision }, versions } });
    });
    await page.goto('http://127.0.0.1:3102/?mode=deliverable');
    await expect(page.getByLabel('Work product')).toHaveValue(v.body);
    await expect(page.getByRole('button', { name: 'Mark this version reviewed' })).toBeDisabled();
    await page.getByLabel('Work product').fill('Revised homepage with a clear audience');
    await page.getByLabel('Acceptance criteria').fill('Check audience, facts and call to action');
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect(page.getByRole('status')).toContainText('New version saved');
    await page
      .getByLabel('Review note')
      .fill('Audience and call to action checked. Dates need confirmation.');
    await page.getByRole('button', { name: 'Mark this version reviewed' }).click();
    await expect(page.getByRole('status')).toContainText('Review recorded');
    await expect(page.getByRole('link', { name: 'Export saved version (.md)' })).toHaveAttribute(
      'href',
      new RegExp(versions[0]!.id),
    );
    await page.getByLabel('Work product').fill('Another revision');
    await page.getByRole('button', { name: 'Save new version' }).click();
    await expect(page.getByLabel('Review note')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Mark this version reviewed' })).toBeDisabled();
    await page.getByText('Version history (3)', { exact: true }).click();
    await page.getByRole('button', { name: 'Version 1 · Draft', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Historical version' })).toContainText(
      'Original saved reply',
    );
    expect(posts).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });
test('ambiguous save retains edits and locks mutations until an explicit reload', async ({
  page,
}) => {
  let posts = 0;
  await page.route('**/api/missions/deliverables**', (r) => {
    if (r.request().method() === 'POST') {
      posts++;
      return r.fulfill({ status: 409, json: { error: 'Work changed. Reload first.' } });
    }
    return r.fulfill({ json: { deliverable: doc, versions: [v] } });
  });
  await page.goto('http://127.0.0.1:3102/?mode=deliverable');
  await page.getByLabel('Work product').fill('Unsaved valuable draft');
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('alert')).toContainText('Work changed');
  await expect(page.getByLabel('Work product')).toHaveValue('Unsaved valuable draft');
  await expect(page.getByRole('button', { name: 'Save new version' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Delete deliverable', exact: true }),
  ).toBeDisabled();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Reload saved work' }).click();
  await expect(page.getByLabel('Work product')).toHaveValue(v.body);
  expect(posts).toBe(1);
});

test('Mission promotes an explicit completed reply without model generation', async ({ page }) => {
  const mission = {
    id: doc.mission_id,
    person_id: doc.person_id,
    conversation_id: 'dd000000-0000-4000-8000-000000000003',
    title: 'Website launch',
    objective: 'Launch landscaping website',
    status: 'active',
    decisions: '',
    open_questions: '',
    next_actions: 'Draft the homepage',
    revision: 1,
    created_at: doc.created_at,
    updated_at: doc.created_at,
  };
  let creates = 0;
  await page.route('**/api/missions**', (r) => {
    if (r.request().method() === 'POST') {
      const b = r.request().postDataJSON();
      expect(b).toEqual({
        action: 'create',
        missionId: mission.id,
        turnId: doc.source_turn_id,
        revision: 1,
      });
      creates++;
      return r.fulfill({ json: { id: doc.id } });
    }
    return r.fulfill({
      json: {
        mission,
        proposals: [],
        projectId: null,
        studioRevision: null,
        outputs: [
          {
            id: doc.source_turn_id,
            assistant_text: 'Homepage work product',
            created_at: doc.created_at,
          },
        ],
        images: [],
        deliverables: [],
      },
    });
  });
  await page.goto('http://127.0.0.1:3102/?mode=mission');
  await page.getByText('Saved decisions & outputs', { exact: true }).click();
  await page.getByText('Saved reply ·', { exact: false }).click();
  await page.getByRole('button', { name: 'Create deliverable', exact: true }).click();
  await expect.poll(() => creates).toBe(1);
});

test('deletion requires confirmation and targets the current saved revision', async ({ page }) => {
  let deletes = 0;
  await page.route('**/api/missions/deliverables**', (r) => {
    const b = r.request().postDataJSON();
    expect(b).toEqual({ action: 'delete', id: doc.id, expected: 1 });
    deletes++;
    return r.fulfill({ json: { id: doc.id } });
  });
  await page.goto('http://127.0.0.1:3102/?mode=deliverable');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Delete deliverable', exact: true }).click();
  expect(deletes).toBe(0);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete deliverable', exact: true }).click();
  await expect.poll(() => deletes).toBe(1);
});
