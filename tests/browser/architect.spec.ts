import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
for (const width of [344, 390, 1440])
  test(`Architect source to export at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const writes: string[] = [];
    const external: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('example.com')) external.push(r.url());
    });
    page.on('request', (r) => {
      if (r.method() === 'POST') writes.push(r.url());
    });
    await page.goto('/app/architect');
    await page.getByLabel('Project name', { exact: true }).fill('Founder project');
    await page.getByRole('button', { name: 'Create starter project' }).click();
    const preview = page.frameLocator('iframe[title="Isolated website preview"]');
    await expect(
      preview.getByRole('heading', { name: 'Founder project', exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('HTML source')
      .fill(
        '<main><h1>Revised project</h1><script>window.parent.document.body.innerHTML="escaped"</script><a href="https://example.com">outside</a><img src="https://example.com/track"></main>',
      );
    await page.getByRole('button', { name: 'Apply revision' }).click();
    await expect(preview.getByRole('heading', { name: 'Revised project' })).toBeVisible();
    await expect(preview.locator('script')).toHaveCount(0);
    await expect(preview.locator('img')).toHaveCount(0);
    await expect(preview.getByText('outside')).not.toHaveAttribute('href');
    await expect(page.locator('iframe')).toHaveAttribute('sandbox', '');
    await page.getByRole('button', { name: 'Run static checks' }).click();
    await expect(page.getByLabel('Check results')).toContainText('Active content');
    const saved = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save project JSON' }).click();
    const savedFile = await saved;
    expect(savedFile.suggestedFilename()).toBe('aethelios-project.json');
    const savedPath = await savedFile.path();
    const savedContents = await readFile(savedPath!, 'utf8');
    expect(JSON.parse(savedContents).html).toContain('Revised project');
    const exported = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export website HTML' }).click();
    expect((await exported).suggestedFilename()).toBe('index.html');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(writes).toEqual([]);
    expect(external).toEqual([]);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Clear project' }).click();
    await page.getByText('Open reviewed project JSON from Talk', { exact: true }).click();
    await page.getByLabel('Project JSON', { exact: true }).fill(savedContents);
    await page.getByRole('button', { name: 'Open reviewed JSON', exact: true }).click();
    await expect(preview.getByRole('heading', { name: 'Revised project' })).toBeVisible();
  });

test('Architect Talk handoff only stages an explicit request', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/')) calls.push(r.url());
  });
  await page.goto('/app/architect');
  await page.getByRole('link', { name: 'Prepare a reviewed website request in Talk' }).click();
  await expect(page.getByRole('textbox', { name: 'Message Aethelios' })).toHaveValue(
    /Return a single JSON object/,
  );
  expect(calls).toEqual([]);
});

test('four launch memberships are honest about legacy and agent status', async ({ page }) => {
  await page.goto('/membership');
  for (const name of ['Access', 'Essential', 'Signature', 'Architect'])
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('$129.00');
  await expect(page.locator('main')).toContainText('not automatically converted');
  await expect(page.locator('main')).toContainText('Not a launched coding agent');
});
