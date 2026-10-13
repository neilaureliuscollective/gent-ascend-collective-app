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
test('Construct plan, changes, checks and preview stay honest without forged success', async ({
  page,
}) => {
  await fixture(page);
  let receipt: {
    project: { id: string; revision: number; name: string };
    runs: Array<Record<string, unknown>>;
    events: Record<string, Array<Record<string, unknown>>>;
    briefs: Array<Record<string, unknown>>;
    sources: Array<Record<string, unknown>>;
  } | null = null;
  await page.route('**/api/architect-construct*', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json:
          receipt ?? {
            project: { id: 'none', revision: 1, name: 'none' },
            runs: [],
            events: {},
            briefs: [],
            sources: [],
          },
      });
    const body = route.request().postDataJSON();
    if (body.action === 'start-fixture') {
      const now = new Date().toISOString();
      receipt = {
        project: { id: body.projectId, revision: body.expected, name: 'Synthetic Origin' },
        sources: [
          {
            id: body.requestId,
            person_id: 'owner',
            kind: 'fixture',
            repository: 'neilaureliuscollective/gent-ascend-collective-app',
            commit: null,
            label: 'Deterministic fixture source — labelled test tree, not an imported application snapshot.',
            tree_hash: 'a'.repeat(64),
            files: [],
            created_at: now,
          },
        ],
        briefs: [
          {
            id: body.requestId,
            person_id: 'owner',
            approval_hash: 'b'.repeat(64),
            status: 'approved',
            invalidation_reason: null,
            scope: {
              project_id: body.projectId,
              project_revision: body.expected,
              source_id: body.requestId,
              repository: 'neilaureliuscollective/gent-ascend-collective-app',
              source_commit: null,
              source_tree_hash: 'a'.repeat(64),
              allowed_paths: ['preview.html'],
              protected_paths: ['.env'],
              intended_change: 'Replace the fixture heading Before with After.',
              acceptance_checks: [{ name: 'heading', command: 'node', args: ['check.mjs'] }],
              resource_limits: {
                timeout_ms: 30000,
                lease_ms: 45000,
                max_files: 32,
                max_file_bytes: 65536,
                max_output_bytes: 16384,
                max_diff_bytes: 32768,
              },
              patch: [{ path: 'preview.html', before: 'Before', after: 'After' }],
            },
            created_at: now,
          },
        ],
        runs: [
          {
            id: body.requestId,
            person_id: 'owner',
            project_id: body.projectId,
            brief_id: body.requestId,
            approval_hash: 'b'.repeat(64),
            source_id: body.requestId,
            source_kind: 'fixture',
            source_tree_hash: 'a'.repeat(64),
            project_revision: body.expected,
            status: 'queued',
            cancel_requested: false,
            worker_id: null,
            lease_until: null,
            result: null,
            created_at: now,
            updated_at: now,
          },
        ],
        events: {
          [body.requestId]: [
            {
              id: crypto.randomUUID(),
              run_id: body.requestId,
              person_id: 'owner',
              seq: 1,
              kind: 'queued',
              detail: 'Run queued. The request handler does not execute software changes.',
              created_at: now,
            },
          ],
        },
      };
      return route.fulfill({ json: { run: receipt.runs[0] } });
    }
    return route.fulfill({ status: 400, json: { error: 'Unsupported construct action' } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Synthetic construct project');
  await page.getByLabel('Project name (optional)').fill('Construct Origin');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Construct', exact: true })).toBeVisible();
  await expect(page.getByText('No approved brief for this project yet')).toBeVisible();
  await page.getByRole('button', { name: 'Queue labelled fixture run' }).click();
  await expect(page.getByText(/Deterministic fixture source/)).toBeVisible();
  await expect(page.getByText(/Latest run queued/)).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-construct-plan.png', fullPage: true });
  await page.getByRole('button', { name: 'Changes', exact: true }).click();
  await expect(page.getByText(/Queued runs do not display a simulated diff/)).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-construct-changes.png', fullPage: true });
  await page.getByRole('button', { name: 'Checks', exact: true }).click();
  await expect(page.getByText(/The browser cannot forge them/)).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-construct-checks.png', fullPage: true });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByText(/Preview is unavailable until isolated output is collected/)).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-construct-preview.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByText(/Deterministic fixture source/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/architect-construct-plan-390.png', fullPage: true });
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

const htmlSite = `<!DOCTYPE html><html><body><h1>Owned artifact</h1></body></html>`;

for (const width of [320, 390]) {
  test(`phone workbench keeps Artifact preview reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    const state = await fixture(page);
    await page.goto(base);
    await page.getByLabel('Tell Aethelios what you want to create').fill('Phone preview concept');
    await page.getByRole('button', { name: 'Create & save project' }).click();
    await expect(page.getByRole('status')).toContainText('Saved revision 1');
    await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
    await page.getByRole('button', { name: 'Create from approved Blueprint' }).click();
    await page.getByLabel('Editable Markdown').fill(htmlSite);
    await page.getByRole('button', { name: 'Save & confirm revision' }).click();
    await expect(page.getByRole('status')).toContainText('Saved revision 2');
    await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
    await page.getByLabel('Blueprint section').selectOption('audience');
    await page
      .getByLabel('Intended audience', { exact: true })
      .fill('A phone draft that must survive preview navigation.');
    const preview = page.getByRole('navigation', { name: 'Workbench views' }).getByRole('button', {
      name: 'Artifact preview',
    });
    await expect(preview).toBeVisible();
    await preview.focus();
    await expect(preview).toBeFocused();
    await page.keyboard.press('Enter');
    const frame = page.frameLocator('iframe[title="Isolated artifact preview"]');
    await expect(frame.getByRole('heading', { name: 'Owned artifact' })).toBeVisible();
    await expect(page.getByText('Actual saved document', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
    await expect(page.getByLabel('Editable Markdown')).toContainText('Owned artifact');
    await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
    await expect(page.getByLabel('Intended audience', { exact: true })).toHaveValue(
      'A phone draft that must survive preview navigation.',
    );
    expect(state.getProject()!.content.blueprint.audience).toBe('');
    await page.screenshot({
      path: `test-results/architect-phone-preview-${width}.png`,
      fullPage: true,
    });
  });
}

test('unsaved document preview is not labelled as a saved revision', async ({ page }) => {
  await fixture(page);
  await page.goto(base);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Draft provenance concept');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await page.getByRole('button', { name: 'Create from approved Blueprint' }).click();
  await page.getByLabel('Editable Markdown').fill('# Saved document\n\nConfirmed copy.');
  await page.getByRole('button', { name: 'Save & confirm revision' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 2');
  await page.getByLabel('Editable Markdown').fill('# Unsaved rewrite\n\nStill a draft.');
  await page.getByRole('button', { name: 'Artifact preview' }).click();
  await expect(page.getByText('Unsaved draft preview', { exact: false })).toBeVisible();
  await expect(page.getByText('Actual saved document', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  await expect(page.getByLabel('Editable Markdown')).toHaveValue(
    '# Unsaved rewrite\n\nStill a draft.',
  );
});

test('delayed failed construct fetch cannot leak another project preview', async ({ page }) => {
  const projects: OriginProject[] = [];
  const versions: OriginVersion[] = [];
  let releaseB: () => void = () => undefined;
  const holdB = new Promise<void>((resolve) => {
    releaseB = resolve;
  });
  const hash = 'c'.repeat(64);
  await page.route('**/api/architect-origin*', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { projects, versions, runs: [] } });
    const body = route.request().postDataJSON();
    if (body.action !== 'save') return route.fulfill({ json: { error: 'unused' }, status: 400 });
    const now = new Date().toISOString();
    const project: OriginProject = {
      id: body.projectId,
      person_id: 'owner',
      revision: (projects.find((item) => item.id === body.projectId)?.revision ?? 0) + 1,
      content: body.content,
      created_at: now,
      updated_at: now,
    };
    const existing = projects.findIndex((item) => item.id === project.id);
    if (existing >= 0) projects[existing] = project;
    else projects.unshift(project);
    versions.unshift({
      id: body.requestId,
      project_id: body.projectId,
      person_id: 'owner',
      revision: project.revision,
      content: body.content,
      note: body.note,
      created_at: now,
    });
    return route.fulfill({
      json: { revision: project.revision, requestId: body.requestId, personId: 'owner' },
    });
  });
  await page.route('**/api/architect-construct*', async (route) => {
    const projectId = new URL(route.request().url()).searchParams.get('project');
    const current = projects.find((item) => item.id === projectId);
    if (!current) return route.fulfill({ status: 404, json: { error: 'Unknown project' } });
    if (projects.length > 1 && projectId === projects[0]!.id) {
      await holdB;
      return route.fulfill({ status: 503, json: { error: 'Synthetic construct failure' } });
    }
    return route.fulfill({
      json: {
        project: { id: current.id, revision: current.revision, name: current.content.name },
        runs: [
          {
            id: '77777777-7777-4777-8777-777777777777',
            person_id: 'owner',
            project_id: current.id,
            project_revision: current.revision,
            source_tree_hash: hash,
            status: 'succeeded',
            result: {
              isolation: 'process-fixture',
              runtime_available: true,
              sandbox: false,
              blocker: null,
              source_hash: hash,
              result_hash: hash,
              changed_files: ['index.html'],
              diff: '',
              checks: [],
              preview: {
                path: 'index.html',
                body: '<html><body><h1>Project A site</h1></body></html>',
                unavailable_reason: null,
              },
            },
          },
        ],
      },
    });
  });
  await page.goto(`${base}&construct=adapter`);
  await page.getByLabel('Tell Aethelios what you want to create').fill('First project with a site');
  await page.getByLabel('Project name (optional)').fill('Project Alpha');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await expect(
    page.frameLocator('iframe[title="Isolated artifact preview"]').getByRole('heading', {
      name: 'Project A site',
    }),
  ).toBeVisible();
  await page.locator('summary', { hasText: 'Projects / switch creation' }).click();
  await page
    .getByRole('navigation', { name: 'Project library' })
    .getByRole('button', { name: 'New vision +' })
    .click();
  await page
    .getByLabel('Tell Aethelios what you want to create')
    .fill('Second project without a site');
  await page.getByLabel('Project name (optional)').fill('Project Beta');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await expect(page.locator('.origin-workbench-identity h2')).toHaveText('Project Beta');
  await expect(page.locator('iframe[title="Isolated artifact preview"]')).toHaveCount(0);
  await expect(page.getByText('Project A site')).toHaveCount(0);
  releaseB();
  await page
    .getByRole('navigation', { name: 'Workbench views' })
    .getByRole('button', { name: 'Checks', exact: true })
    .click();
  await expect(page.getByText('Synthetic construct failure')).toBeVisible();
  await expect(page.getByText('Project A site')).toHaveCount(0);
});
