import { test, expect } from '@playwright/test';
const conversation = 'ed000000-0000-4000-8000-000000000001',
  job = 'ee000000-0000-4000-8000-000000000030',
  base = 'ee000000-0000-4000-8000-000000000031';
for (const width of [390, 1440])
  test('reviewed coworker consent and snapshot at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let status = 'approval',
      selected: string | null = null;
    const snapshot = {
      artifactId: base,
      partId: 'alpha',
      scenarioPercent: 10,
      title: 'Synthetic chart',
      kind: 'chart',
      basis: 'research',
      part: {
        id: 'alpha',
        label: 'Alpha',
        detail: 'Synthetic supplied evidence.',
        value: 10,
        unit: 'USD',
        period: '2025',
      },
      hypotheticalValue: 11,
    };
    await page.route('**/api/aethelios/artifacts**', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        expect(body.acknowledgeCost).toBe(true);
        status = 'complete';
        selected = job;
        await route.fulfill({ json: { approved: true } });
        return;
      }
      await route.fulfill({
        json: {
          selectedId: selected,
          selectedPartId: null,
          projects: [],
          artifacts: [
            {
              id: job,
              conversation_id: conversation,
              operation: 'visual.review',
              prompt: 'Review the supplied source evidence',
              review_coworker: 'themis',
              review_scope: 'selected-part',
              review_context: snapshot,
              status,
              visual:
                status === 'complete'
                  ? {
                      kind: 'review',
                      basis: 'coworker',
                      title: 'Themis · scoped review',
                      summary: 'Synthetic contribution.',
                      coworker: 'themis',
                      text: 'Verify the original sources before making a decision.',
                      contextScope: 'selected-part',
                      sourceArtifactId: base,
                      sourcePartId: 'alpha',
                    }
                  : null,
              project_id: null,
              version_id: null,
              base_version_id: null,
              created_at: '2026-10-12T00:00:00Z',
              started_at: null,
              finished_at: null,
            },
          ],
        },
      });
    });
    await page.goto('http://127.0.0.1:3102/?mode=live-artifacts');
    await expect(page.getByText('Recipient: Themis')).toBeVisible();
    await expect(page.getByText('Shared selection: Synthetic chart · Alpha')).toBeVisible();
    await page.getByText('Inspect the exact shared snapshot').click();
    await expect(page.getByText('"scenarioPercent": 10', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Approve paid coworker review', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Coworker contribution' })).toContainText(
      'No research, record changes or external actions',
    );
    await expect(
      page.getByText('Verify the original sources before making a decision.'),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
