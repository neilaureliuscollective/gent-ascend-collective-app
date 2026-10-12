import { test, expect } from '@playwright/test';
const conversationId = 'ed000000-0000-4000-8000-000000000001',
  reviewId = 'ad000000-0000-4000-8000-000000000002';
// Synthetic HTTP fixture; not real Auth/RLS, provider or physical-device acceptance.
for (const width of [390, 1440])
  test('explicit reviewed action and uncertain receipt recovery at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let writes = 0,
      receipt: null | { id: string; title: string; day: string; verified: boolean } = null;
    await page.route('**/api/aethelios/artifacts**', (route) =>
      route.fulfill({
        json: {
          selectedId: reviewId,
          projects: [],
          artifacts: [
            {
              id: reviewId,
              conversation_id: conversationId,
              operation: 'visual.review',
              prompt: 'Synthetic review',
              status: 'complete',
              project_id: null,
              base_version_id: null,
              version_id: null,
              created_at: '2026-10-12T00:00:00Z',
              started_at: null,
              finished_at: '2026-10-12T00:00:01Z',
              visual: {
                kind: 'review',
                basis: 'coworker',
                title: 'Athena synthetic review',
                summary: 'Suggestion only',
                coworker: 'athena',
                text: 'Verify sources before use.',
                contextScope: 'task-only',
                sourceArtifactId: null,
                sourcePartId: null,
              },
            },
          ],
        },
      }),
    );
    await page.route('**/api/aethelios/reviewed-action**', async (route) => {
      const preparation = {
        conversationId,
        reviewId,
        sourceTitle: 'Athena synthetic review',
        day: '2026-10-12',
        timezone: 'UTC',
        version: 3,
        receipt,
      };
      if (route.request().method() === 'POST') {
        writes++;
        const body = route.request().postDataJSON();
        expect(body.confirm).toBe(true);
        expect(body.title).toBe('Verify original company sources');
        expect(body.day).toBe('2026-10-12');
        expect(body.version).toBe(3);
        receipt = { id: body.id, title: body.title, day: body.day, verified: true };
        await route.fulfill({
          status: 503,
          json: { error: 'Synthetic lost acknowledgment. Check saved status.' },
        });
        return;
      }
      await route.fulfill({ json: preparation });
    });
    await page.goto('http://127.0.0.1:3102/?mode=live-artifacts');
    await page.getByRole('button', { name: 'Review a personal daily action' }).click();
    const action = page.getByRole('region', { name: 'Reviewed personal daily action' });
    await expect(action.getByLabel('Your exact action title')).toHaveValue('');
    expect(writes).toBe(0);
    await expect(action.getByRole('button', { name: 'Confirm and add to my day' })).toBeDisabled();
    await action.getByLabel('Your exact action title').fill('Verify original company sources');
    await action.getByRole('button', { name: 'Confirm and add to my day' }).click();
    await expect(
      action.getByText('Save unconfirmed. Confirmation is locked to prevent duplicate actions.'),
    ).toBeVisible();
    await expect(action.getByLabel('Your exact action title')).toBeDisabled();
    await action.getByRole('button', { name: 'Check saved action status' }).click();
    await expect(action.getByRole('status')).toContainText('Verified saved action');
    expect(writes).toBe(1);
    await expect(action.getByRole('link', { name: 'View my daily actions' })).toHaveAttribute(
      'href',
      '/app/daily',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
