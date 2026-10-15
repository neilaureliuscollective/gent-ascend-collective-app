import { openGlobalMenu, globalDestinations } from '../support/global-navigation';
import { test, expect, type Page } from '@playwright/test';
import {
  initialProject,
  type OriginProject,
  type OriginVersion,
} from '../../src/domains/architect-origin/schema';
// All API data is synthetic. This tests actual Next route teardown/history, not persistence/RLS.
async function fixture(page: Page) {
  const make = (name: string): OriginProject => ({
    id: crypto.randomUUID(),
    person_id: 'synthetic-owner-a',
    revision: 1,
    content: {
      ...initialProject('Synthetic navigation review', 'application'),
      name,
      documents: ['One', 'Two'].map((title) => ({
        id: crypto.randomUUID(),
        title,
        kind: 'Business plan',
        status: 'draft',
        basis: 1,
        content: `Saved document ${title}`,
      })),
    },
    created_at: '',
    updated_at: '',
  });
  const state = {
    projects: [make('Synthetic Alpha'), make('Synthetic Beta')],
    versions: [] as OriginVersion[],
    saves: [] as Record<string, unknown>[],
    failSave: false,
    failRead: false,
    transientRead: false,
    failAfterCommit: false,
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname !== '/api/architect-origin') return route.continue();
    if (route.request().method() === 'GET')
      return state.transientRead
        ? route.fulfill({ status: 503, json: { error: 'Synthetic network outage' } })
        : state.failRead
          ? route.fulfill({ status: 403, json: { error: 'Synthetic signed-out denial' } })
          : route.fulfill({
              json: { projects: state.projects, versions: state.versions, runs: [] },
            });
    const body = route.request().postDataJSON();
    expect(body.action).toBe('save');
    state.saves.push(body);
    if (state.failSave)
      return route.fulfill({ status: 503, json: { error: 'Synthetic uncertain save' } });
    const project = state.projects.find((p) => p.id === body.projectId)!;
    if (body.expected !== project.revision)
      return route.fulfill({ status: 409, json: { error: 'Synthetic stale revision' } });
    project.revision++;
    project.content = body.content;
    state.versions.push({
      id: body.requestId,
      project_id: project.id,
      person_id: project.person_id,
      revision: project.revision,
      content: project.content,
      note: body.note,
      created_at: '',
    });
    if (state.failAfterCommit)
      return route.fulfill({ status: 503, json: { error: 'Synthetic lost acknowledgement' } });
    return route.fulfill({
      json: { revision: project.revision, requestId: body.requestId, personId: project.person_id },
    });
  });
  await page.goto('/app/work');
  await page.getByRole('link', { name: 'Open Architect ↗', exact: true }).click();
  await page.getByRole('button', { name: /Synthetic Alpha/ }).click();
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page
    .getByLabel('Selected document')
    .selectOption(state.projects[0]!.content.documents[0]!.id);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Editable Markdown')).toHaveValue('Saved document One');
  return state;
}
const editor = (page: Page) => page.getByLabel('Editable Markdown');
async function backForward(page: Page) {
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/work$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/app\/architect\?/);
}
for (const width of [390, 720, 1440]) {
  test(`history restores unsaved documents repeatedly, save clears recovery at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page);
    await editor(page).fill('Private unsaved One');
    await page
      .getByLabel('Selected document')
      .selectOption(state.projects[0]!.content.documents[1]!.id);
    await expect(editor(page)).toHaveValue('Saved document Two');
    await editor(page).fill('Private unsaved Two');
    for (let i = 0; i < 3; i++) {
      await backForward(page);
      await expect(editor(page)).toHaveValue('Private unsaved Two');
      await expect(page.getByRole('status')).toContainText('Unsaved work restored');
    }
    expect(state.saves).toHaveLength(0);
    await page
      .getByLabel('Selected document')
      .selectOption(state.projects[0]!.content.documents[0]!.id);
    await expect(editor(page)).toHaveValue('Private unsaved One');
    await page.getByRole('button', { name: 'Save & confirm revision' }).click();
    await expect(page.getByRole('status')).toContainText('Saved revision 2');
    await page.reload();
    await expect(editor(page)).toHaveValue('Private unsaved One');
    await backForward(page);
    await expect(editor(page)).toHaveValue('Private unsaved One');
    await expect(page.getByRole('status')).toContainText('Resumed revision 2');
    expect(state.saves).toHaveLength(1);
    expect(state.projects[0]!.content.documents.map((d) => d.content)).toEqual([
      'Private unsaved One',
      'Private unsaved Two',
    ]);
  });
  test(`internal cancel, explicit leave, discard and refresh decisions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await editor(page).fill('Cancel must retain');
    page.once('dialog', (d) => d.dismiss());
    await openGlobalMenu(page);
    await globalDestinations(page)
      .getByRole('link', { name: 'Work', exact: true })
      .click();
    await expect(editor(page)).toHaveValue('Cancel must retain');
    await page.keyboard.press('Escape');
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await expect(editor(page)).toHaveValue('Cancel must retain');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await backForward(page);
    await expect(editor(page)).toHaveValue('Saved document One');
    await editor(page).fill('Explicit leave discards');
    page.once('dialog', (d) => d.accept());
    await openGlobalMenu(page);
    await globalDestinations(page)
      .getByRole('link', { name: 'Work', exact: true })
      .click();
    await expect(page).toHaveURL(/\/app\/work$/);
    await page.goBack();
    await expect(editor(page)).toHaveValue('Saved document One');
    await editor(page).fill('Refresh cancellation retains');
    const cancelled = page.waitForEvent('dialog');
    // A cancelled beforeunload has no new load event; bound that expected wait.
    const reload = page.reload({ timeout: 5000 }).catch(() => null);
    const dialog = await cancelled;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
    await reload;
    await expect(editor(page)).toHaveValue('Refresh cancellation retains');
    page.once('dialog', (d) => d.accept());
    await page.reload();
    await expect(editor(page)).toHaveValue('Saved document One');
  });
}
test('project switch cancellation preserves, confirmation discards without crossing projects', async ({
  page,
}) => {
  const state = await fixture(page);
  await editor(page).fill('Only Alpha owns this edit');
  await page.getByText('Projects / switch creation', { exact: true }).click();
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: /Synthetic Beta/ }).click();
  await expect(editor(page)).toHaveValue('Only Alpha owns this edit');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Synthetic Beta/ }).click();
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page
    .getByLabel('Selected document')
    .selectOption(state.projects[1]!.content.documents[0]!.id);
  await expect(editor(page)).toHaveValue('Saved document One');
  await backForward(page);
  await expect(editor(page)).toHaveValue('Saved document One');
  await page.getByText('Projects / switch creation', { exact: true }).click();
  await page.getByRole('button', { name: /Synthetic Alpha/ }).click();
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page
    .getByLabel('Selected document')
    .selectOption(state.projects[0]!.content.documents[0]!.id);
  await expect(editor(page)).toHaveValue('Saved document One');
});
for (const denial of ['owner-change', 'read-denied'] as const) {
  test(`${denial} drops retained private content before rendering, with no later resurrection`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await editor(page).fill('Private owner A secret draft');
    await page.goBack();
    if (denial === 'owner-change') state.projects[0]!.person_id = 'synthetic-owner-b';
    else state.failRead = true;
    await page.goForward();
    if (denial === 'owner-change') await expect(editor(page)).toHaveValue('Saved document One');
    else
      await expect(page.locator('.origin').getByRole('alert')).toContainText(
        'Synthetic signed-out denial',
      );
    await expect(page.locator('body')).not.toContainText('Private owner A secret draft');
    await page.goBack();
    state.projects[0]!.person_id = 'synthetic-owner-a';
    state.failRead = false;
    await page.goForward();
    await expect(editor(page)).toHaveValue('Saved document One');
    expect(state.saves).toHaveLength(0);
  });
}
test('recovered stale revision is not silently rebased or written', async ({ page }) => {
  const state = await fixture(page);
  await editor(page).fill('Stale local edit');
  await page.goBack();
  state.projects[0]!.revision = 2;
  state.projects[0]!.content.documents[0]!.content = 'New saved revision from another session';
  await page.goForward();
  await expect(editor(page)).toHaveValue('Stale local edit');
  await expect(page.getByRole('status')).toContainText(
    'Based on revision 1; current saved revision 2',
  );
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.locator('.origin').getByRole('alert')).toContainText(
    'Synthetic stale revision',
  );
  expect(state.saves[0]!.expected).toBe(1);
  expect(state.projects[0]!.content.documents[0]!.content).toBe(
    'New saved revision from another session',
  );
});
test('unconfirmed save survives history with its exact replay lock and no automatic replay', async ({
  page,
}) => {
  const state = await fixture(page);
  state.failSave = true;
  await editor(page).fill('Unconfirmed edit');
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.locator('.origin').getByRole('alert')).toContainText(
    'Synthetic uncertain save',
  );
  await backForward(page);
  await expect(editor(page)).toHaveValue('Unconfirmed edit');
  await expect(editor(page)).toBeDisabled();
  expect(state.saves).toHaveLength(1);
  state.failSave = false;
  await page.getByRole('button', { name: 'Retry same save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 2');
  expect(state.saves[1]!).toEqual(state.saves[0]!);
  await backForward(page);
  await expect(page.getByRole('status')).toContainText('Resumed revision 2');
});

test('history recovery survives a transient read failure and warns before refreshing away', async ({
  page,
}) => {
  const state = await fixture(page);
  await editor(page).fill('Retain through interrupted recovery');
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/work$/);
  // The workspace handoff still guards full unload while Architect is unmounted.
  await page.keyboard.press('Tab');
  const cancelled = page.waitForEvent('dialog');
  // A cancelled beforeunload has no new load event; bound that expected wait.
  const reload = page.reload({ timeout: 5000 }).catch(() => null);
  const dialog = await cancelled;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await reload;
  state.transientRead = true;
  await page.goForward();
  await expect(page.locator('.origin').getByRole('alert')).toContainText(
    'Synthetic network outage',
  );
  await expect(editor(page)).toHaveCount(0);
  state.transientRead = false;
  await page.getByRole('button', { name: 'Reload receipts', exact: true }).click();
  await expect(editor(page)).toHaveValue('Retain through interrupted recovery');
  expect(state.saves).toHaveLength(0);
});

test('new unsaved document selection survives history without becoming a saved artifact', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByLabel('Selected document').selectOption('');
  await page.getByRole('button', { name: 'Create from approved Blueprint', exact: true }).click();
  await editor(page).fill('New unsaved artifact');
  const id = await page.getByLabel('Selected document').inputValue();
  await backForward(page);
  await expect(page.getByLabel('Selected document')).toHaveValue(id);
  await expect(editor(page)).toHaveValue('New unsaved artifact');
  expect(state.projects[0]!.content.documents).toHaveLength(2);
  expect(state.saves).toHaveLength(0);
});

test('discard after recovery returns to the freshly read saved revision', async ({ page }) => {
  const state = await fixture(page);
  await editor(page).fill('Stale local edit');
  await page.goBack();
  state.projects[0]!.revision = 2;
  state.projects[0]!.content.documents[0]!.content = 'Current saved document';
  await page.goForward();
  await expect(editor(page)).toHaveValue('Stale local edit');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await expect(editor(page)).toHaveValue('Current saved document');
  await expect(page.locator('.origin-savebar')).toContainText('All changes saved · revision 2');
});

test('Forward away from a dirty history entry also restores on Back', async ({ page }) => {
  await fixture(page);
  await openGlobalMenu(page);
  await globalDestinations(page)
    .getByRole('link', { name: 'Work', exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/work$/);
  await page.goBack();
  await expect(editor(page)).toHaveValue('Saved document One');
  await editor(page).fill('Dirty forward navigation');
  await page.goForward();
  await expect(page).toHaveURL(/\/app\/work$/);
  await page.goBack();
  await expect(editor(page)).toHaveValue('Dirty forward navigation');
});

test('fresh save receipt resolves a recovered uncertain save without replaying it', async ({
  page,
}) => {
  const state = await fixture(page);
  state.failAfterCommit = true;
  await editor(page).fill('Saved but acknowledgement lost');
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.locator('.origin').getByRole('alert')).toContainText(
    'Synthetic lost acknowledgement',
  );
  await backForward(page);
  await expect(editor(page)).toHaveValue('Saved but acknowledgement lost');
  await expect(editor(page)).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Resumed revision 2');
  await expect(page.getByRole('button', { name: 'Save & confirm revision' })).toBeDisabled();
  expect(state.saves).toHaveLength(1);
});

for (const width of [390, 720, 1440]) {
  test(`early native Back during restored editor mount cannot write Architect state onto Work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page);
    await editor(page).fill('Synthetic saved early-back document');
    await page.getByRole('button', { name: 'Save & confirm revision' }).click();
    await expect(page.getByRole('status')).toContainText('Saved revision 2');
    // Reproduce navigation between the restored DOM commit and passive URL effect.
    // Only native history.back() is used: no patched URL, history state or app code.
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const restored = [...document.querySelectorAll<HTMLTextAreaElement>('textarea')].some(
          (el) => el.value === 'Synthetic saved early-back document',
        );
        if (!restored) return;
        observer.disconnect();
        history.back();
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    await expect(page).toHaveURL(/\/app\/work$/);
    await expect(page.locator('.company-work')).toBeVisible();
    await page.goForward();
    await expect(editor(page)).toHaveValue('Synthetic saved early-back document');
    await expect(page.getByRole('status')).toContainText('Resumed revision 2');
    expect(state.saves).toHaveLength(1);
  });
}
