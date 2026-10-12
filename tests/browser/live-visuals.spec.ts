import { expect, test } from '@playwright/test';
const conversation = 'ed000000-0000-4000-8000-000000000001';
const job = 'ee000000-0000-4000-8000-000000000010';
for (const width of [390, 1440])
  test(
    'owned conceptual board selection persists across surfaces at ' + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      let status = 'approval',
        partId: string | null = null;
      const visual = {
        kind: 'diagram',
        basis: 'conceptual',
        title: 'Synthetic conversation map',
        summary: 'A synthetic illustration, not live provider output.',
        nodes: [
          { id: 'voice', label: 'Voice transport', detail: 'Continuous speech.' },
          { id: 'tools', label: 'Reviewed tools', detail: 'Separate approved execution.' },
        ],
        edges: [{ from: 'voice', to: 'tools', label: 'Delegates reviewed work' }],
      };
      await page.route('**/api/aethelios/artifacts**', async (route) => {
        if (route.request().method() === 'PATCH') {
          const body = route.request().postDataJSON();
          if ('partId' in body) partId = body.partId;
          else if (body.approve) {
            expect(body.acknowledgeCost).toBe(true);
            status = 'complete';
          }
          await route.fulfill({ json: { approved: true } });
          return;
        }
        await route.fulfill({
          json: {
            selectedId: status === 'complete' ? job : null,
            selectedPartId: partId,
            projects: [],
            artifacts: [
              {
                id: job,
                conversation_id: conversation,
                operation: 'visual.diagram',
                prompt: 'Map this system',
                status,
                visual: status === 'complete' ? visual : null,
                project_id: null,
                base_version_id: null,
                version_id: null,
                created_at: '2026-10-11T00:00:00Z',
                started_at: null,
                finished_at: null,
              },
            ],
          },
        });
      });
      await page.goto('http://127.0.0.1:3102/?mode=live-artifacts');
      await page.getByRole('button', { name: 'Approve paid visual task', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Synthetic conversation map' })).toBeVisible();
      await expect(
        page.getByText(
          'Conceptual illustration · external facts and figures have not been verified.',
        ),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Reviewed tools', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Selected visual detail' })).toContainText(
        'Separate approved execution.',
      );
      await expect(
        page.getByRole('button', { name: 'Reviewed tools', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Refresh saved work' }).click();
      await expect(
        page.getByRole('button', { name: 'Reviewed tools', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download visual data' }).click();
      expect((await download).suggestedFilename()).toBe('aethelios-diagram.json');
    },
  );
