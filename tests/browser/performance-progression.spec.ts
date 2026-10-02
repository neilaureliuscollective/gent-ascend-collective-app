import { test, expect } from './fixtures';
import { learningFixture } from '../component-fixture/performance';
const fixture = 'http://127.0.0.1:3102/?mode=performance-learning';
for (const width of [344, 768, 1440])
  test(`progression evidence and approval stay readable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const writes: unknown[] = [];
    const updated = structuredClone(learningFixture);
    const review = updated.progression![0]!;
    updated.progressionDecisions = [
      {
        fromVersion: 1,
        toVersion: 2,
        createdAt: new Date().toISOString(),
        review: structuredClone(review),
      },
    ];
    updated.program!.version = 2;
    updated.program!.data.sessions[0]!.plan.exercises[0]!.reps = 9;
    review.proposal = null;
    review.status = 'hold';
    review.reason =
      'Targets changed since these workouts. Learn from two workouts on the current session plan.';
    await page.route('**/api/performance', async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: updated });
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: { version: 2, owner: learningFixture.owner } });
    });
    await page.goto(fixture);
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Earn the next rep.' })).toBeVisible();
    await expect(
      page.getByText(
        'Two completed workouts for this session are needed. Other sessions do not count as substitutes.',
      ),
    ).toBeVisible();
    await page.getByText('See the two latest records (2/2)', { exact: true }).click();
    await expect(page.getByText('2026-09-25', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath('phase3-progression.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Approve Cable row: 8 → 9 reps', exact: true }).click();
    await expect(
      page.getByText(
        'Targets changed since these workouts. Learn from two workouts on the current session plan.',
      ),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      kind: 'progress',
      expectedVersion: 1,
      slotId: learningFixture.progression![0]!.slotId,
      token: 'a'.repeat(64),
    });
    await page.getByText('Approved changes (1)', { exact: true }).click();
    await expect(page.getByText(/Program v1 → v2/)).toBeVisible();
  });
test('stale progression keeps its explanation until records are explicitly reloaded', async ({
  page,
}) => {
  let writes = 0;
  await page.route('**/api/performance', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: {
          ...learningFixture,
          progression: learningFixture.progression!.map((r) => ({
            ...r,
            status: 'hold',
            proposal: null,
            reason: 'Today’s check-in changed. Keep targets steady.',
          })),
        },
      });
    writes++;
    return route.fulfill({
      status: 409,
      json: { error: 'Your evidence changed. Reload saved records before deciding.' },
    });
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('button', { name: 'Approve Cable row: 8 → 9 reps', exact: true }).click();
  await expect(
    page.getByText('Your evidence changed. Reload saved records before deciding.', { exact: true }).first(),
  ).toBeVisible();
  expect(writes).toBe(1);
  await page.getByRole('button', { name: 'Reload saved records', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Approve Cable row: 8 → 9 reps', exact: true }),
  ).toHaveCount(0);
});
