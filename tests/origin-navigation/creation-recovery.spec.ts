import { test, expect, type Page } from '@playwright/test';
import type { OriginProject, OriginVersion } from '../../src/domains/architect-origin/schema';

// Real Next navigation; synthetic API state only, never Auth/RLS/database acceptance.
async function createWithFailedRefresh(
  page: Page,
  receipt: 'valid' | 'missing' | 'empty' = 'valid',
) {
  const state = {
    project: null as OriginProject | null,
    versions: [] as OriginVersion[],
    saves: [] as Record<string, unknown>[],
    failNextRead: false,
    denyRead: false,
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname !== '/api/architect-origin') return route.continue();
    if (route.request().method() === 'GET') {
      if (state.failNextRead) {
        state.failNextRead = false;
        return route.fulfill({
          status: 503,
          json: { error: 'Synthetic immediate history failure' },
        });
      }
      if (state.denyRead)
        return route.fulfill({ status: 403, json: { error: 'Synthetic access denial' } });
      return route.fulfill({
        json: {
          projects: state.project ? [state.project] : [],
          versions: state.versions,
          runs: [],
        },
      });
    }
    const body = route.request().postDataJSON();
    expect(body.action).toBe('save');
    expect(body).not.toHaveProperty('personId');
    expect(body).not.toHaveProperty('person_id');
    state.saves.push(body);
    const revision = (state.project?.revision ?? 0) + 1;
    expect(body.expected).toBe(revision - 1);
    state.project = {
      id: body.projectId,
      person_id: 'synthetic-created-owner',
      revision,
      content: body.content,
      created_at: '',
      updated_at: '',
    };
    state.versions.push({
      id: body.requestId,
      project_id: body.projectId,
      person_id: state.project.person_id,
      revision,
      content: body.content,
      note: body.note,
      created_at: '',
    });
    if (revision === 1) state.failNextRead = true;
    return route.fulfill({
      json: {
        revision,
        requestId: body.requestId,
        ...(receipt === 'missing'
          ? {}
          : { personId: receipt === 'empty' ? '' : state.project.person_id }),
      },
    });
  });
  await page.goto('/app/work');
  await page.getByRole('link', { name: 'Open Architect ↗', exact: true }).click();
  await page.getByLabel('Tell Aethelios what you want to create').fill('Saved creation vision');
  await page.getByLabel('Project name (optional)').fill('Synthetic newly saved project');
  await page.getByRole('button', { name: 'Create & save project', exact: true }).click();
  if (receipt !== 'valid') {
    await expect(page.locator('.origin').getByRole('alert')).toContainText(
      'Save ownership was not confirmed',
    );
    return state;
  }
  await expect(page.getByRole('status')).toContainText(
    'Revision 1 saved. History refresh unavailable',
  );
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await page.getByLabel('Blueprint section').selectOption('vision');
  return state;
}
for (const width of [390, 720, 1440]) {
  test(`new project edits survive failed post-save history and Back/Forward at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await createWithFailedRefresh(page);
    const input = page.getByLabel('Project vision', { exact: true });
    await expect(input).toBeEnabled();
    await input.fill('Unsaved follow-up to a newly saved project');
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/work$/);
    await page.goForward();
    await expect(input).toHaveValue('Unsaved follow-up to a newly saved project');
    expect(state.saves).toHaveLength(1);
    expect(state.project!.content.blueprint.vision).toBe('Saved creation vision');
    await page.getByRole('button', { name: 'Save & confirm revision' }).click();
    await expect(page.getByRole('status')).toContainText('Saved revision 2');
    await page.reload();
    await expect(input).toHaveValue('Unsaved follow-up to a newly saved project');
    expect(state.saves).toHaveLength(2);
  });
}

for (const outcome of ['owner-change', 'access-denial'] as const) {
  test(`new project recovery drops private edits after ${outcome}`, async ({ page }) => {
    const state = await createWithFailedRefresh(page);
    const input = page.getByLabel('Project vision', { exact: true });
    await input.fill('Private newly created owner draft');
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/work$/);
    if (outcome === 'owner-change') state.project!.person_id = 'synthetic-other-owner';
    else state.denyRead = true;
    await page.goForward();
    if (outcome === 'owner-change') await expect(input).toHaveValue('Saved creation vision');
    else
      await expect(page.locator('.origin').getByRole('alert')).toContainText(
        'Synthetic access denial',
      );
    await expect(page.locator('body')).not.toContainText('Private newly created owner draft');
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/work$/);
    state.project!.person_id = 'synthetic-created-owner';
    state.denyRead = false;
    await page.goForward();
    await expect(input).toHaveValue('Saved creation vision');
    expect(state.saves).toHaveLength(1);
  });
}
for (const receipt of ['missing', 'empty'] as const) {
  test(`${receipt} save owner pauses editing until a fresh receipt verifies ownership`, async ({
    page,
  }) => {
    const state = await createWithFailedRefresh(page, receipt);
    await expect(page.getByLabel('Tell Aethelios what you want to create')).toBeDisabled();
    await expect(page.getByLabel('Project vision', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reload receipts', exact: true }).click();
    await expect(page.locator('.origin').getByRole('alert')).toContainText(
      'Synthetic immediate history failure',
    );
    await page.getByRole('button', { name: 'Reload receipts', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(
      'Saved revision confirmed from its receipt',
    );
    await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
    const input = page.getByLabel('Project vision', { exact: true });
    await expect(page).toHaveURL(new RegExp('project=' + state.project!.id));
    await input.fill('Owner verified through receipt recovery');
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/work$/);
    await page.goForward();
    await expect(input).toHaveValue('Owner verified through receipt recovery');
    expect(state.saves).toHaveLength(1);
  });
}
