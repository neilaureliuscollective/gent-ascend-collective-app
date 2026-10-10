import { test, expect } from '@playwright/test';
const id = '20000000-0000-4000-8000-000000000001';
const source = {
  version: 1,
  name: 'Cloud example',
  brief: 'Synthetic browser fixture; not a real account.',
  html: '<main><h1>Saved source</h1></main>',
  css: 'body{padding:24px;color:#14382c;background:#fff}',
};
for (const width of [344, 1440])
  test(`reviewed cloud lifecycle at ${width} (intercepted API, not live Auth)`, async ({
    page,
  }) => {
    let revision = 1;
    const saved: Array<Record<string, unknown>> = [];
    const generated: Array<Record<string, unknown>> = [];
    let uncertain = true;
    await page.route('**/api/architect**', async (route) => {
      const request = route.request();
      let body: unknown;
      if (request.method() === 'GET')
        body = request.url().includes('projectId=')
          ? {
              project: { id, revision },
              versions: [{ id: 'saved-v1', revision: 1, content: source }],
            }
          : {
              projects: [{ id, name: 'Cloud example', revision }],
              jobs: [],
              executionEnabled: true,
              monthlyLimit: 3,
              used: 0,
            };
      else {
        const input = request.postDataJSON();
        if (input.action === 'save') {
          saved.push(input);
          if (uncertain) {
            uncertain = false;
            revision++;
            await route.fulfill({ status: 503, json: { error: 'Save confirmation unavailable.' } });
            return;
          }
          revision = Math.max(revision, input.expected + 1);
          body = { revision };
        } else if (input.action === 'generate') {
          generated.push(input);
          body = {
            draft: { ...source, html: '<main><h1>Proposed design</h1></main>' },
            requestId: input.requestId,
          };
        } else body = { deleted: true };
      }
      await route.fulfill({ json: body });
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/app/architect');
    await page.getByText('Cloud projects & bounded AI revisions', { exact: true }).click();
    await page.getByRole('button', { name: 'Load cloud library & usage' }).click();
    await page.getByRole('button', { name: 'Cloud example · revision 1' }).click();
    await expect(page.getByLabel('HTML source')).toHaveValue(source.html);
    await page.getByLabel('HTML source').fill('<main><h1>My edited source</h1></main>');
    await page.getByLabel('AI revision request').fill('Improve the design.');
    await page.getByRole('checkbox', { name: /I authorize one model call/ }).check();
    await expect(page.getByRole('button', { name: 'Request one AI revision' })).toBeDisabled();
    await page.getByRole('button', { name: 'Save cloud revision' }).click();
    await expect(page.getByRole('button', { name: 'Retry same cloud save' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry same cloud save' }).click();
    expect(saved).toHaveLength(2);
    expect(saved[1]).toEqual(saved[0]);
    await page.getByRole('button', { name: 'Request one AI revision' }).click();
    await expect(page.getByRole('region', { name: 'Proposed AI revision' })).toBeVisible();
    await expect(page.getByLabel('HTML source')).toHaveValue(
      '<main><h1>My edited source</h1></main>',
    );
    expect(generated).toHaveLength(1);
    expect(generated[0]!.consent).toBe(true);
    await page.getByRole('button', { name: 'Apply proposed source locally' }).click();
    await expect(
      page.frameLocator('iframe').getByRole('heading', { name: 'Proposed design' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save cloud revision' }).click();
    expect(saved[2]!.expected).toBe(2);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete cloud project' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Cloud source deleted' }),
    ).toBeVisible();
    await expect(page.getByLabel('HTML source')).toHaveValue(
      '<main><h1>Proposed design</h1></main>',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('signed-out cloud access fails closed and sends no inference request', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/app/architect');
  await page.getByText('Cloud projects & bounded AI revisions', { exact: true }).click();
  await page.getByRole('button', { name: 'Load cloud library & usage' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: /Sign in|not enabled|could not/ }),
  ).toBeVisible();
  expect(posts).toEqual([]);
});
