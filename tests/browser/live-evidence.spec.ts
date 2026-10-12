import { test, expect } from '@playwright/test';
import { chart } from '../fixtures/evidence-board';
const conversation = 'ed000000-0000-4000-8000-000000000001',
  job = 'ee000000-0000-4000-8000-000000000020';
for (const width of [390, 1440])
  test('source-linked chart and owned scenario stay distinct at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let percent = 0,
      partId: string | null = null;
    await page.route('**/api/aethelios/artifacts**', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        if ('scenarioPercent' in body) percent = body.scenarioPercent;
        if ('partId' in body) partId = body.partId;
        await route.fulfill({ json: { selected: true } });
        return;
      }
      await route.fulfill({
        json: {
          selectedId: job,
          selectedPartId: partId,
          scenarioPercent: percent,
          projects: [],
          artifacts: [
            {
              id: job,
              conversation_id: conversation,
              operation: 'visual.chart',
              status: 'complete',
              visual: chart,
              prompt: 'Synthetic public chart',
              project_id: null,
              version_id: null,
              base_version_id: null,
              created_at: '2026-10-11T00:00:00Z',
              started_at: null,
              finished_at: null,
            },
          ],
        },
      });
    });
    await page.goto('http://127.0.0.1:3102/?mode=live-artifacts');
    await expect(
      page.getByText('Source-linked AI extraction · review original sources.'),
    ).toBeVisible();
    const table = page
      .getByRole('table')
      .filter({ has: page.getByRole('columnheader', { name: 'Source-linked value' }) });
    await expect(
      table
        .getByRole('row')
        .filter({ has: page.getByRole('button', { name: 'Gamma', exact: true }) }),
    ).toContainText('Not available');
    await page.getByLabel('Hypothetical change (%)').fill('10');
    await page.getByRole('button', { name: 'Apply hypothetical change' }).click();
    await expect(table.getByRole('columnheader', { name: 'Hypothetical 10%' })).toBeVisible();
    const alpha = table
      .getByRole('row')
      .filter({ has: page.getByRole('button', { name: 'Alpha', exact: true }) });
    await expect(alpha.getByRole('cell').nth(0)).toHaveText('10');
    await expect(alpha.getByRole('cell').nth(1)).toHaveText('11');
    await alpha.getByRole('button', { name: 'Alpha', exact: true }).click();
    await expect(alpha.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Refresh saved work' }).click();
    await expect(page.getByLabel('Hypothetical change (%)')).toHaveValue('10');
    await expect(
      page.getByRole('link', { name: '[s1] Synthetic report', exact: true }),
    ).toHaveAttribute('href', 'https://example.com/report');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
