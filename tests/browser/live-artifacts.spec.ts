import { test, expect } from './fixtures';
const conversation = 'ed000000-0000-4000-8000-000000000001';
const job = 'ec000000-0000-4000-8000-000000000001';
const project = 'ef000000-0000-4000-8000-000000000001';
// Synthetic HTTP and image fixture; does not verify provider generation or real Storage/Auth.
for (const width of [390, 1440])
  test(`Live creation preserves paid approval and selected Studio version at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    let status = 'approval';
    let approvals = 0;
    let selected = false;
    await page.route('**/api/aethelios/artifacts**', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        if (body.artifactId) selected = true;
        else {
          expect(body.acknowledgeCost).toBe(true);
          approvals++;
          status = 'complete';
          selected = true;
        }
        await route.fulfill({ json: { approved: true } });
        return;
      }
      await route.fulfill({
        json: {
          selectedId: selected ? job : null,
          projects: [{ id: project, title: 'Synthetic city' }],
          artifacts: [
            {
              id: job,
              conversation_id: conversation,
              operation: 'image.create',
              prompt: 'Synthetic futuristic city',
              project_id: project,
              base_version_id: null,
              version_id: status === 'complete' ? job : null,
              status,
              created_at: '2026-10-11T00:00:00Z',
              started_at: null,
              finished_at: null,
            },
          ],
        },
      });
    });
    await page.route('**/api/studio/image**', (route) =>
      route.fulfill({
        path: 'public/brand/aethelios-imperial-obsidian-20261010-192.png',
        contentType: 'image/png',
      }),
    );
    await page.goto('http://127.0.0.1:3102/?mode=live-artifacts');
    const workspace = page.getByRole('region', { name: 'Conversation creation workspace' });
    await workspace.getByRole('button', { name: 'Approve paid image task', exact: true }).click();
    await expect(
      workspace.getByAltText('Generated concept: Synthetic futuristic city'),
    ).toBeVisible();
    await expect(
      workspace.getByRole('link', { name: 'Open this version in Studio' }),
    ).toHaveAttribute('href', '/app/studio?project=' + project + '&version=' + job);
    expect(approvals).toBe(1);
    await workspace.getByLabel('Creation task', { exact: true }).selectOption('image.edit');
    await workspace.getByLabel('Your direction', { exact: true }).fill('Make the buildings taller');
    await expect(workspace.getByRole('button', { name: 'Prepare image request' })).toBeEnabled();
  });
