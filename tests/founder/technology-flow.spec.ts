// Real local Next API + Supabase acceptance. No intercepted API or model call.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== '127.0.0.1')
  throw new Error('Local Supabase required');
test('Technology survives real save/review/revision/reload and another account cannot read or create it', async ({
  page,
  browser,
}) => {
  await page.goto('/dev');
  await page.getByLabel('Local entry token').fill(env.AURELIUS_DEV_TOKEN!);
  await page.getByRole('button', { name: 'Enter as founder' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3103/app/aethelios');
  await page.goto('/app/work/technology');
  await page.getByLabel('Business name', { exact: true }).fill('Synthetic Technology Studio');
  await page
    .getByLabel('Your vision')
    .fill('A synthetic service-business website for local acceptance.');
  await page.getByLabel('Headline', { exact: true }).fill('Care with intention');
  await page.getByLabel('About your business').fill('A synthetic studio for local testing only.');
  await page.getByLabel('Service 1', { exact: true }).fill('Consultation');
  await page.getByLabel('Price as displayed').fill('$45');
  await page.getByText('Design direction', { exact: true }).click();
  await page.getByLabel('Website palette').selectOption('ivory');
  await page.getByLabel('Hero composition').selectOption('split');
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('button', { name: 'Confirm this saved brief' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm this saved brief' }).click();
  await expect(page.getByText('Exact saved version reviewed by you')).toBeVisible();
  await page.getByRole('button', { name: 'Prepare website build' }).click();
  await page.getByRole('button', { name: 'Build / resume saved job' }).click();
  const download = page.getByRole('link', { name: 'Download website HTML' });
  await expect(download).toBeVisible();
  const exportPath = (await download.getAttribute('href'))!;
  const artifact = await page.request.get(exportPath);
  expect(artifact.ok()).toBe(true);
  expect(artifact.headers()['cache-control']).toBe('private, no-store');
  const html = await artifact.text();
  expect(html).toContain('Synthetic Technology Studio');
  expect(html).toContain('background:#f5f1e8');
  expect(html).toContain('grid-template-columns:minmax(0,1fr) minmax(0,1fr)');
  const buildList = await (await page.request.get('/api/technology/builds')).json();
  const buildId = buildList.builds[0].id;
  await page.getByRole('button', { name: 'Inspect isolated website' }).click();
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Care with intention' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close website inspection' }).click();
  await page.getByLabel('Headline', { exact: true }).fill('A considered beginning');
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByText('Saved brief needs your review')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Synthetic Technology Studio · v2', exact: true }).click();
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue('A considered beginning');
  const response = await page.request.get('/api/technology');
  expect(response.ok()).toBe(true);
  const owned = await response.json();
  const version = owned.versions.find(
    (v: { brief: { name: string }; revision: number }) =>
      v.brief.name === 'Synthetic Technology Studio' && v.revision === 2,
  );
  expect(version).toBeTruthy();
  expect(version.brief.design.palette).toBe('ivory');
  expect(version.brief.design.hero).toBe('split');
  await page.goto('/app/library');
  await expect(page.getByRole('link', { name: /Synthetic Technology Studio/ })).toBeVisible();
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:3103' });
  try {
    const member = await other.newPage();
    await member.goto('/enter');
    await member.getByLabel('Email').fill('member@aurelius.test');
    await member.getByLabel('Password').fill(env.AURELIUS_FOUNDER_PASSWORD!);
    await member.getByRole('button', { name: 'Enter Aethelios' }).click();
    await expect(member).toHaveURL(/\/app\/aethelios$/);
    const hidden = await member.request.get('/api/technology');
    expect(hidden.ok()).toBe(true);
    const workspace = await hidden.json();
    expect(workspace.canCreate).toBe(false);
    expect(workspace.projects.some((p: { id: string }) => p.id === version.project_id)).toBe(false);
    expect(workspace.versions.some((v: { id: string }) => v.id === version.id)).toBe(false);
    const denied = await member.request.post('/api/technology', {
      headers: { Origin: 'http://127.0.0.1:3103' },
      data: {
        action: 'save',
        id: version.project_id,
        versionId: crypto.randomUUID(),
        expected: 2,
        brief: version.brief,
      },
    });
    expect(denied.status()).toBe(409);
    expect((await (await member.request.get('/api/technology/builds')).json()).builds).toHaveLength(
      0,
    );
    expect((await member.request.get(exportPath)).status()).toBe(404);
    expect(
      (
        await member.request.post('/api/technology/builds', {
          headers: { Origin: 'http://127.0.0.1:3103' },
          data: { action: 'resume', id: buildId },
        })
      ).status(),
    ).toBe(409);
    await member.goto('/app/work/technology');
    await expect(
      member.getByText(
        'Technology creation is an invited pilot. Your membership does not grant this capability.',
      ),
    ).toBeVisible();
    await expect(member.getByLabel('Business name', { exact: true })).toBeDisabled();
  } finally {
    await other.close();
  }
});
