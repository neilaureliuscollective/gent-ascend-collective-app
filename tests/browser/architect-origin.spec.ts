import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  type OriginProject,
  type OriginVersion,
  type OriginRun,
} from '../../src/domains/architect-origin/schema';
// Route-owned effects require the real route even in this isolated fixture.
const base = 'http://127.0.0.1:3102/app/architect?mode=architect-origin';
async function fixture(page: Page, failFirst = false) {
  let project: OriginProject | null = null;
  const versions: OriginVersion[] = [],
    runs: OriginRun[] = [],
    saves: unknown[] = [];
  await page.route('**/api/architect-origin*', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { projects: project ? [project] : [], versions, runs } });
    const body = route.request().postDataJSON();
    if (body.action === 'save') {
      saves.push(body);
      if (failFirst && saves.length === 1)
        return route.fulfill({ status: 503, json: { error: 'Synthetic uncertain save' } });
      const old = versions.find((v) => v.id === body.requestId);
      if (!old && (project?.revision ?? 0) !== body.expected)
        return route.fulfill({ status: 409, json: { error: 'Synthetic stale revision' } });
      const now = new Date().toISOString();
      if (!old) {
        project = {
          id: body.projectId,
          person_id: 'owner',
          revision: body.expected + 1,
          content: body.content,
          created_at: now,
          updated_at: now,
        };
        versions.unshift({
          id: body.requestId,
          project_id: body.projectId,
          person_id: 'owner',
          revision: project.revision,
          content: body.content,
          note: body.note,
          created_at: now,
        });
      }
      return route.fulfill({
        json: {
          revision: old?.revision ?? project!.revision,
          requestId: body.requestId,
          personId: 'owner',
        },
      });
    }
    const run = {
      id: body.requestId,
      project_id: body.projectId,
      person_id: 'owner',
      revision: body.expected,
      kind: body.kind,
      instruction: body.instruction,
      status: 'complete' as const,
      created_at: new Date().toISOString(),
      payload: body,
      output: {
        reply: 'Synthetic provider proposal: verify the intended audience.',
        changes: [
          {
            section: 'audience' as const,
            content: 'Adult customers seeking a considered daily skincare ritual.',
            reason: 'A proposed audience, requiring your approval.',
          },
        ],
        document:
          body.kind === 'document'
            ? {
                title: 'Skincare launch plan',
                content:
                  '# Launch plan\n\nConfirm audience interviews, qualified formulation validation and supplier diligence.\n\n## Roadmap\n\nResearch → development → validation → controlled launch.',
              }
            : null,
        sources:
          body.kind === 'research'
            ? [
                {
                  url: 'https://example.com/synthetic-source',
                  title: 'Synthetic source fixture',
                  provenance: 'provider' as const,
                },
              ]
            : [],
        kind: body.documentKind,
        model: 'synthetic',
        researchAvailable: body.kind === 'research',
      },
    };
    runs.unshift(run);
    return route.fulfill({ json: { run } });
  });
  return { saves, versions, runs, getProject: () => project };
}
for (const width of [320, 344, 390, 720, 768, 1440, 1920])
  test(`Origin entry and focused workspace fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto(base);
    await expect(page.getByRole('heading', { name: 'What will you create?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create a Business' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Design an Application' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Develop a Product' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start without limits' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width <= 600)
      await expect(page.getByLabel('Tell Aethelios what you want to create')).toBeInViewport();
    await page.screenshot({
      path: `test-results/architect-immersive-entry-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel('Tell Aethelios what you want to create').fill('Synthetic business idea');
    await page.getByLabel('Project name (optional)').fill('Synthetic Origin');
    await page.getByRole('button', { name: 'Create & save project' }).click();
    await expect(page.getByRole('status')).toContainText('Saved revision 1');
    await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
    await page.getByLabel('Blueprint section').selectOption('requirements');
    await page
      .getByLabel('Requirements & constraints', { exact: true })
      .fill('User-confirmed requirements, no invented customer demand.');
    await page.getByLabel('Requirements & constraints', { exact: true }).focus();
    await expect(page.getByLabel('Requirements & constraints', { exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/architect-origin-${width}.png`, fullPage: true });
  });
test('complete synthetic journey: vision, reviewed research, useful document, focused revision, export and return', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(base);
  await page
    .getByLabel('Tell Aethelios what you want to create')
    .fill('I want to create a premium skincare company.');
  await page.getByLabel('Project name (optional)').fill('Skincare Origin');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByLabel('Your next request').fill('Help clarify the audience');
  await page.getByRole('button', { name: 'Send & prepare proposal' }).click();
  await expect(page.getByRole('status')).toContainText('Proposal saved');
  expect(state.getProject()!.content.blueprint.audience).toBe('');
  await page.getByText('Intended audience — proposed revision').click();
  await page.getByRole('button', { name: 'Accept section into draft' }).click();
  expect(state.getProject()!.content.blueprint.audience).toBe('');
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 2');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByText('Plan a research request', { exact: true }).click();
  await page
    .getByLabel('Your next request')
    .fill('Identify primary sources and feasibility uncertainties');
  await page.getByRole('button', { name: 'Send & prepare proposal' }).click();
  await expect(page.getByRole('status')).toContainText('Proposal saved');
  await page.getByRole('button', { name: 'Accept sources into draft' }).click();
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 3');
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page.getByRole('button', { name: 'Create from approved Blueprint' }).click();
  await page
    .getByLabel('Editable Markdown')
    .fill(
      '# Skincare business plan\n\n## Purpose\n\nA considered daily ritual.\n\n## Validation\n\nInterview target customers; evaluate economics using verified supplier quotes. Laboratory, legal and safety approval are required before production.',
    );
  await page.getByRole('button', { name: 'Mark reviewed & approved in draft' }).click();
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 4');
  expect(state.getProject()!.content.documents[0]!.status).toBe('approved');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Markdown', exact: true }).click();
  const file = await download;
  expect(await readFile((await file.path())!, 'utf8')).toContain('verified supplier quotes');
  await page
    .getByLabel('Editable Markdown')
    .fill(
      '# Revised skincare plan\n\nRetain qualified safety review and add supplier quality checks.',
    );
  await expect(page.getByText('draft · Blueprint basis v3')).toBeVisible();
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 5');
  expect(state.versions.find((v) => v.revision === 4)!.content.documents[0]!.status).toBe(
    'approved',
  );
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Resumed revision 5');
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page
    .getByLabel('Selected document')
    .selectOption(state.getProject()!.content.documents[0]!.id);
  await expect(page.getByLabel('Editable Markdown')).toContainText('supplier quality checks');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: /Revision 4 —/ }).click();
  await page.getByRole('button', { name: 'Restore as a new draft' }).click();
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 6');
  await page.getByRole('button', { name: 'Archive project', exact: true }).click();
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 7');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume project', exact: true })).toBeVisible();
  expect(state.versions).toHaveLength(7);
});
test('uncertain creation retries the exact snapshot and UUIDs with no accidental overwrite', async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto(base);
  await page
    .getByLabel('Tell Aethelios what you want to create')
    .fill('Synthetic application idea');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic uncertain save');
  await expect(page.getByLabel('Tell Aethelios what you want to create')).toBeDisabled();
  await page.getByRole('button', { name: 'Retry same save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  expect(state.saves[1]).toEqual(state.saves[0]);
});
test('source URLs and raw model HTML cannot inject active content', async ({ page }) => {
  await fixture(page);
  await page.goto(base);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Synthetic custom research');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByText('Add a reference you have reviewed').click();
  await page.getByLabel('Source URL').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Add to draft evidence' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP(S)');
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page.getByRole('button', { name: 'Create from approved Blueprint' }).click();
  await page
    .getByLabel('Editable Markdown')
    .fill('<script>window.injected=true</script>\n\n![external](https://example.com/pixel.png)');
  await expect(page.locator('.origin-document-preview img')).toHaveCount(0);
  await expect(page.locator('.origin-document-preview script')).toHaveCount(0);
  await expect(page.getByText('[External image omitted]', { exact: true })).toBeVisible();
});

test('immersive frame keeps its menu accessible and restores keyboard focus', async ({ page }) => {
  await fixture(page);
  await page.goto(base);
  const trigger = page.getByRole('button', { name: 'Aethelios menu', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Your Aethelios environments' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close menu' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator('.environment-immersive')).toHaveCSS(
    'height',
    `${await page.evaluate(() => innerHeight)}px`,
  );
});

test('Blueprint selection and document view resume without changing approved content', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(base);
  await page
    .getByLabel('Tell Aethelios what you want to create')
    .fill('Synthetic immersive application');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await page.getByLabel('Blueprint section').selectOption('architecture');
  await page.reload();
  await expect(page.getByLabel('Blueprint section')).toHaveValue('architecture');
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page.getByRole('button', { name: 'Create from approved Blueprint' }).click();
  await page
    .getByLabel('Editable Markdown')
    .fill('# Synthetic document\n\nPreserve this saved content.');
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 2');
  await page.getByRole('button', { name: 'Focus canvas', exact: true }).click();
  await expect(page.locator('.origin-conversation')).not.toBeVisible();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByLabel('Editable Markdown')).not.toBeVisible();
  await expect(page.getByRole('article', { name: 'Document preview' })).toContainText(
    'Preserve this saved content',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Preview', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('article', { name: 'Document preview' })).toContainText(
    'Preserve this saved content',
  );
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Editable Markdown')).toHaveValue(
    '# Synthetic document\n\nPreserve this saved content.',
  );
  expect(state.saves).toHaveLength(2);
});

test('short keyboard-height workspace retains reachable save controls and drafts during focus changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 344, height: 430 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await fixture(page);
  await page.goto(base);
  await page
    .getByLabel('Tell Aethelios what you want to create')
    .fill('Synthetic short-window concept');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await page.getByLabel('Blueprint section').selectOption('risks');
  await page
    .getByLabel('Risks & open questions', { exact: true })
    .fill('A user draft retained across surfaces.');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('button', { name: 'Focus canvas', exact: true }).click();
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await expect(page.getByLabel('Risks & open questions', { exact: true })).toHaveValue(
    'A user draft retained across surfaces.',
  );
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 2');
  expect(state.getProject()!.content.blueprint.risks).toBe(
    'A user draft retained across surfaces.',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'test-results/architect-immersive-short-window.png',
    fullPage: true,
  });
});

test('labelled demonstration is explicit and isolated from host', async ({ page }) => {
  await fixture(page);
  await page.goto(`${base}&demo=architect-preview`);
  await page
    .getByLabel('Tell Aethelios what you want to create')
    .fill('Labelled demonstration idea');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await expect(
    page.getByText(/Labelled demonstration — not a live generated preview/),
  ).toBeVisible();
  const frame = page.frameLocator('iframe[title="Labelled demonstration preview"]');
  await expect(frame.getByText('Labelled demonstration', { exact: false })).toBeVisible();
  await expect(page.evaluate(() => 'injected' in window || 'pwned' in window)).resolves.toBe(false);
});

test('HTML document preview is sandboxed and keeps the prior artifact when Construct fails', async ({
  page,
}) => {
  const html = `<!DOCTYPE html><html><body>
    <script>window.top.injected=true</script>
    <a href="javascript:alert(1)">Bad link</a>
    <h1>Owned artifact</h1>
  </body></html>`;
  const state = await fixture(page);
  await page.route('**/api/architect-construct*', async (route) => {
    if (!state.getProject())
      return route.fulfill({
        status: 404,
        json: { error: 'Construct execution is not in this checkout.' },
      });
    return route.fulfill({
      status: 503,
      json: { error: 'Synthetic construct failure' },
    });
  });
  await page.goto(base);
  await page
    .getByLabel('Tell Aethelios what you want to create')
    .fill('Application with a static site');
  await page.getByRole('button', { name: 'Design an Application' }).click();
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page.getByRole('button', { name: 'Create from approved Blueprint' }).click();
  await page.getByLabel('Editable Markdown').fill(html);
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 2');
  await page.getByRole('button', { name: 'Artifact preview' }).click();
  const frame = page.frameLocator('iframe[title="Isolated artifact preview"]');
  await expect(frame.getByRole('heading', { name: 'Owned artifact' })).toBeVisible();
  await expect(page.locator('iframe[title="Isolated artifact preview"]')).toHaveAttribute(
    'sandbox',
    '',
  );
  await expect(page.evaluate(() => 'injected' in window)).resolves.toBe(false);
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();
  await expect(page.locator('.origin-workbench-meta .origin-connection-chip')).toHaveText(
    'Build connection pending',
  );
});

test('emerging brief uses typed fields only and preserves drafts across Audience details', async ({
  page,
}) => {
  await fixture(page);
  await page.goto(base);
  await page.getByRole('button', { name: 'Develop a Product' }).click();
  await page
    .getByLabel('Tell Aethelios what you want to create')
    .fill('A travel kettle for Fold desks.');
  await page.getByRole('button', { name: '02 Audience' }).click();
  await page.getByLabel('Audience (optional)').fill('Independent designers.');
  await page.getByLabel('Constraints (optional)').fill('No lithium claims.');
  await expect(page.getByRole('complementary', { name: 'Emerging brief' })).toContainText(
    'Independent designers.',
  );
  await expect(page.getByRole('complementary', { name: 'Emerging brief' })).not.toContainText(
    'proposed',
  );
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await page.getByLabel('Blueprint section').selectOption('audience');
  await expect(page.getByLabel('Intended audience', { exact: true })).toHaveValue(
    'Independent designers.',
  );
});

test('Fold dock reveals one panel at 720px without fabricating checks', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await fixture(page);
  await page.goto(base);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Fold layout concept');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await expect(page.getByRole('navigation', { name: 'Workbench panels' })).toBeVisible();
  const dock = page.getByRole('navigation', { name: 'Workbench panels' });
  await dock.getByRole('button', { name: 'Outline', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Outline and context' })).toBeVisible();
  await dock.getByRole('button', { name: 'Canvas', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Workbench views' })
    .getByRole('button', { name: 'Checks', exact: true })
    .click();
  await expect(page.locator('.origin-checks-pane')).toBeVisible();
  await expect(page.locator('.origin-checks-pane')).toContainText(
    'Construct checks are not in this checkout',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/architect-studio-fold-720.png', fullPage: true });
});
