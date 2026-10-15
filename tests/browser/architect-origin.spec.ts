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
  await page.goto(`${base}&construct=adapter`);
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
  const review = page.getByRole('navigation', { name: 'Construct review' });
  await review.getByRole('button', { name: 'Changes', exact: true }).click();
  await expect(page.getByText(/Queued runs do not display a simulated diff/)).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-construct-changes.png', fullPage: true });
  await review.getByRole('button', { name: 'Checks', exact: true }).click();
  await expect(page.getByText(/The browser cannot forge them/)).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-construct-checks.png', fullPage: true });
  await review.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByText(/Preview is unavailable until isolated output is collected/)).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-construct-preview.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await review.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByText(/Deterministic fixture source/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/architect-construct-plan-390.png', fullPage: true });
});

test('integrated workbench polls construct states, cancels, and keeps project-bound output', async ({
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
  await page.route('**/api/architect-construct/source*', async (route) =>
    route.fulfill({
      json: {
        access: 'read-only',
        publishing: false,
        deployment: false,
        github: {
          ready: false,
          repository: null,
          reason: 'Connections is not configured in this fixture.',
        },
        vercel: { ready: false, project: null, reason: 'Publishing is unavailable.' },
      },
    }),
  );
  await page.route('**/api/architect-construct*', async (route) => {
    if (route.request().url().includes('/source')) return;
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
        project: { id: body.projectId, revision: body.expected, name: 'Journey Origin' },
        sources: [
          {
            id: body.requestId,
            person_id: 'owner',
            kind: 'imported',
            repository: null,
            commit: null,
            label: 'Deterministic fixture source — labelled test tree, not an imported application snapshot.',
            tree_hash: 'a'.repeat(64),
            files: [],
            created_at: now,
          },
        ],
        briefs: [],
        runs: [
          {
            id: body.requestId,
            person_id: 'owner',
            project_id: body.projectId,
            brief_id: body.requestId,
            approval_hash: 'b'.repeat(64),
            source_id: body.requestId,
            source_kind: 'imported',
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
              detail: 'Run queued.',
              created_at: now,
            },
          ],
        },
      };
      return route.fulfill({ json: { run: receipt.runs[0] } });
    }
    if (body.action === 'cancel' && receipt) {
      receipt.runs[0] = { ...receipt.runs[0], status: 'cancelled', cancel_requested: true };
      return route.fulfill({ json: { run: receipt.runs[0] } });
    }
    return route.fulfill({ status: 400, json: { error: 'Unsupported construct action' } });
  });
  await page.goto(`${base}&construct=adapter`);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Journey construct');
  await page.getByLabel('Project name (optional)').fill('Journey Origin');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  await page.getByRole('button', { name: 'Queue labelled fixture run' }).click();
  await expect(page.getByText(/Latest run queued/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel run' }).click();
  await expect(page.getByText(/Latest run cancelled/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Repair journey' })).toContainText(
    'Original attempt · cancelled',
  );
  for (const [width, height] of [
    [320, 720],
    [390, 844],
    [720, 900],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('heading', { name: 'Construct', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/architect-creation-journey-1440.png', fullPage: true });
  await page.setViewportSize({ width: 344, height: 430 });
  await expect(page.getByRole('button', { name: 'Queue labelled fixture run' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/architect-creation-journey-keyboard.png', fullPage: true });
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

test('approve, enqueue, progress and revision-bound preview stay on the selected project', async ({
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
  await page.route('**/api/architect-construct/source*', async (route) =>
    route.fulfill({
      json: {
        access: 'read-only',
        publishing: false,
        deployment: false,
        github: {
          ready: false,
          repository: null,
          reason: 'Connections is not configured. Imported files can still be approved.',
        },
        vercel: { ready: false, project: null, reason: 'Publishing is unavailable.' },
      },
    }),
  );
  await page.route('**/api/architect-construct*', async (route) => {
    if (route.request().url().includes('/source')) return;
    if (route.request().method() === 'GET') {
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
    }
    const body = route.request().postDataJSON();
    if (body.action === 'propose') {
      const file = body.excerpts?.[0] ?? { path: 'preview.html', content: 'Before' };
      return route.fulfill({
        json: {
          mocked: true,
          proposal: {
            summary: 'Labelled mocked provider proposal. Not a paid OpenAI call.',
            notes: 'MOCKED PROVIDER — development only.',
            patch: [
              {
                path: file.path,
                before: file.content,
                after: String(file.content).replace(/Before/g, 'After'),
              },
            ],
          },
        },
      });
    }
    if (body.action === 'approve-change') {
      expect(body.sourceKind).toBe('imported');
      expect(body.files.length).toBeGreaterThan(0);
      return route.fulfill({
        json: {
          source: { id: body.sourceId, kind: body.sourceKind, label: 'Imported source snapshot' },
          brief: { id: body.briefId, status: 'approved', approval_hash: 'b'.repeat(64) },
        },
      });
    }
    if (body.action === 'start') {
      expect(body.approvalHash).toBe('b'.repeat(64));
      expect(body.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      if (receipt?.runs[0]) {
        expect(body.requestId).toBe(receipt.runs[0].id);
        return route.fulfill({ json: { run: receipt.runs[0] } });
      }
      const now = new Date().toISOString();
      receipt = {
        project: { id: body.projectId, revision: body.expected, name: 'Approved Origin' },
        sources: [
          {
            id: body.briefId,
            person_id: 'owner',
            kind: 'imported',
            repository: null,
            commit: null,
            label: 'Imported source snapshot — exact attached files, not live repository knowledge.',
            tree_hash: 'a'.repeat(64),
            files: [],
            created_at: now,
          },
        ],
        briefs: [
          {
            id: body.briefId,
            person_id: 'owner',
            approval_hash: 'b'.repeat(64),
            status: 'approved',
            invalidation_reason: null,
            scope: {
              project_id: body.projectId,
              project_revision: body.expected,
              source_id: body.briefId,
              intended_change: 'Replace the imported heading.',
              allowed_paths: ['preview.html'],
              protected_paths: ['.env'],
              repository: null,
              source_commit: null,
              source_tree_hash: 'a'.repeat(64),
              acceptance_checks: [{ name: 'present', command: 'true', args: [] }],
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
            brief_id: body.briefId,
            approval_hash: 'b'.repeat(64),
            source_id: body.briefId,
            source_kind: 'imported',
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
              detail: 'Run queued.',
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
  await page.goto(`${base}&construct=adapter`);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Approved construct path');
  await page.getByLabel('Project name (optional)').fill('Approved Origin');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Authorized source and project brief' })).toBeVisible();
  const intended = page.getByLabel('Intended change');
  await intended.fill('Replace the imported heading and keep this draft.');
  await page.getByRole('button', { name: 'Propose change' }).click();
  await expect(page.getByRole('heading', { name: 'Proposed change awaiting approval' })).toBeVisible();
  await expect(
    page.getByText('Labelled mocked provider. This is not a paid OpenAI call.'),
  ).toBeVisible();
  async function openReview(task: 'Source' | 'Change' | 'Evidence') {
    const close = page.getByRole('button', { name: 'Close review' });
    if (await close.isVisible()) await close.click();
    await page.getByRole('navigation', { name: 'Review context' }).getByRole('button', { name: task }).click();
  }
  async function captureReview(
    width: number,
    height: number,
    task: 'source' | 'change' | 'evidence',
    extraName?: string,
  ) {
    await page.setViewportSize({ width, height });
    await openReview(task === 'source' ? 'Source' : task === 'change' ? 'Change' : 'Evidence');
    const sheet = page.locator('.origin-construct-sheet-card');
    const review = page.locator('.origin-construct-review');
    const target = (await sheet.isVisible()) ? sheet : review;
    await expect(target).toBeVisible();
    if (task === 'change') {
      const diff = target.locator('.origin-diff').first();
      if (await diff.count()) await diff.scrollIntoViewIfNeeded();
    }
    const path = extraName
      ? `docs/evidence/architect-construct/${extraName}.png`
      : `docs/evidence/architect-construct/architect-source-review-${task}-${width}.png`;
    await target.screenshot({ path });
    return target;
  }

  await openReview('Source');
  await expect(page.getByRole('heading', { name: 'What Architect understands' })).toBeVisible();
  await page.getByRole('button', { name: /preview\.html/ }).first().click();
  await expect(page.getByLabel('Inspect preview.html')).toContainText('Complete content is available');
  await captureReview(1440, 900, 'source');
  await openReview('Change');
  await expect(page.locator('.origin-diff [data-diff="remove"]').first()).toContainText('Before');
  await expect(page.locator('.origin-diff [data-diff="add"]').first()).toContainText('After');
  const desktopChange = await captureReview(1440, 900, 'change');
  await page.screenshot({
    path: 'docs/evidence/architect-construct/architect-source-review-1440.png',
    fullPage: true,
  });
  const desktopDiff = desktopChange.locator('.origin-diff');
  await expect(desktopDiff).toBeVisible();
  const desktopDiffBox = await desktopDiff.boundingBox();
  expect(desktopDiffBox && desktopDiffBox.width).toBeGreaterThan(360);

  await page.setViewportSize({ width: 720, height: 900 });
  await openReview('Change');
  await expect(page.getByRole('heading', { name: 'Proposed change awaiting approval' })).toBeVisible();
  const foldReview = page.locator('.origin-construct-review');
  const foldContext = page.locator('.origin-construct-context');
  const foldCanvas = page.locator('.origin-construct-canvas');
  const foldBox = await foldReview.boundingBox();
  const foldContextBox = await foldContext.boundingBox();
  const foldCanvasBox = await foldCanvas.boundingBox();
  expect(foldBox).toBeTruthy();
  expect(foldContextBox).toBeTruthy();
  expect(foldCanvasBox).toBeTruthy();
  if (!foldBox || !foldContextBox || !foldCanvasBox) throw new Error('Fold review layout missing');
  expect(foldContextBox.width).toBeGreaterThan(foldBox.width * 0.72);
  expect(foldCanvasBox.y).toBeGreaterThan(foldContextBox.y);
  await expect(page.locator('.origin-diff [data-diff="remove"]').first()).toBeVisible();
  await captureReview(720, 900, 'change');
  await page.screenshot({
    path: 'docs/evidence/architect-construct/architect-source-review-720.png',
    fullPage: true,
  });
  await captureReview(720, 900, 'source');
  await captureReview(720, 900, 'evidence');

  await page.setViewportSize({ width: 390, height: 844 });
  await openReview('Source');
  await expect(page.getByRole('heading', { name: 'What Architect understands' })).toBeVisible();
  const sourceButton = page
    .locator('.origin-construct-sheet-card .origin-understand-list button')
    .first();
  await expect(sourceButton).toBeVisible();
  const fileBox = await sourceButton.locator('.origin-understand-file').boundingBox();
  const inclusionBox = await sourceButton.locator('.origin-understand-inclusion').boundingBox();
  expect(fileBox).toBeTruthy();
  expect(inclusionBox).toBeTruthy();
  if (!fileBox || !inclusionBox) throw new Error('Source filename and inclusion label missing');
  expect(inclusionBox.y).toBeGreaterThan(fileBox.y + fileBox.height - 2);
  await captureReview(390, 844, 'source');
  await page.screenshot({
    path: 'docs/evidence/architect-construct/architect-source-review-390.png',
    fullPage: true,
  });
  const closeReview = page.getByRole('button', { name: 'Close review' });
  if (await closeReview.isVisible()) await closeReview.click();
  const sourceOpener = page.getByRole('navigation', { name: 'Review context' }).getByRole('button', { name: 'Source' });
  await sourceOpener.focus();
  await sourceOpener.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h2')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(sourceOpener).toBeFocused();
  await openReview('Source');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close review' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openReview('Source');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await captureReview(390, 844, 'change');
  await captureReview(390, 844, 'evidence');
  const closeSheet = page.getByRole('button', { name: 'Close review' });
  if (await closeSheet.isVisible()) await closeSheet.click();

  await page.setViewportSize({ width: 390, height: 480 });
  await openReview('Change');
  await expect(page.locator('.origin-diff [data-diff="add"]').first()).toContainText('After');
  await expect(page.getByRole('button', { name: 'Approve proposed change' })).toBeVisible();
  await captureReview(390, 480, 'change', 'architect-source-review-keyboard-390');
  if (await page.getByRole('button', { name: 'Close review' }).isVisible())
    await page.getByRole('button', { name: 'Close review' }).click();

  await page.setViewportSize({ width: 1440, height: 900 });
  await openReview('Evidence');
  await expect(page.getByRole('heading', { name: 'Check coverage' })).toBeVisible();
  await expect(page.getByText('No applicable checks available. That is not a pass.')).toBeVisible();
  await captureReview(1440, 900, 'evidence');
  await expect(intended).toHaveValue('Replace the imported heading and keep this draft.');
  await page.getByRole('button', { name: 'Approve proposed change' }).click();
  await expect(page.getByText(/Change approved against the pinned source/)).toBeVisible();
  await expect(page.getByText(/Approved inputs are bound to server digest/)).toBeVisible();
  await page.getByRole('button', { name: 'Enqueue approved change' }).click();
  await expect(page.getByText(/Latest run queued/)).toBeVisible();
  await page.getByRole('button', { name: 'Enqueue approved change' }).click();
  await expect(page.getByText(/Retries reuse this request/)).toBeVisible();
  await expect(page.getByText(/Latest run succeeded/)).toHaveCount(0);
  await page.getByLabel('Intended change').fill('Edited after approval — previous digest is invalid.');
  await expect(
    page.getByText(/The previous approval is invalid/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enqueue approved change' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Approve proposed change' })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Construct', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Propose change' })).toBeVisible();
  await page.setViewportSize({ width: 720, height: 900 });
  await expect(page.getByRole('button', { name: 'Propose change' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Isolated preview' })).toBeVisible();
});

test('construct panel drops a late poll after the project switches', async ({ page }) => {
  const projects: OriginProject[] = [];
  const versions: OriginVersion[] = [];
  let releaseB: () => void = () => undefined;
  const holdB = new Promise<void>((resolve) => {
    releaseB = resolve;
  });
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
  await page.route('**/api/architect-construct/source*', async (route) =>
    route.fulfill({
      json: {
        access: 'read-only',
        publishing: false,
        deployment: false,
        github: { ready: false, repository: null, reason: 'Connections is not configured.' },
        vercel: { ready: false, project: null, reason: 'Publishing is unavailable.' },
      },
    }),
  );
  await page.route('**/api/architect-construct*', async (route) => {
    if (route.request().url().includes('/source')) return;
    const projectId = new URL(route.request().url()).searchParams.get('project');
    const current = projects.find((item) => item.id === projectId);
    if (route.request().method() === 'GET') {
      if (!current) return route.fulfill({ status: 404, json: { error: 'Unknown project' } });
      if (projects.length > 1 && projectId === projects[0]!.id) await holdB;
      return route.fulfill({
        json: {
          project: { id: current.id, revision: current.revision, name: current.content.name },
          runs:
            current.content.name === 'Panel Alpha'
              ? [
                  {
                    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    person_id: 'owner',
                    project_id: current.id,
                    brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    approval_hash: 'b'.repeat(64),
                    source_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    source_kind: 'imported',
                    source_tree_hash: 'a'.repeat(64),
                    project_revision: current.revision,
                    status: 'succeeded',
                    result: {
                      isolation: 'docker',
                      runtime_available: true,
                      sandbox: true,
                      blocker: null,
                      source_hash: 'a'.repeat(64),
                      result_hash: 'b'.repeat(64),
                      changed_files: ['alpha.html'],
                      diff: '',
                      checks: [],
                      preview: {
                        path: 'alpha.html',
                        body: '<html><body>Alpha receipt</body></html>',
                        unavailable_reason: null,
                      },
                    },
                  },
                ]
              : [],
          events: {},
          briefs: [],
          sources: [],
        },
      });
    }
    return route.fulfill({ status: 400, json: { error: 'unused' } });
  });
  await page.goto(`${base}&construct=adapter`);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Panel project A');
  await page.getByLabel('Project name (optional)').fill('Panel Alpha');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByText('Saved revision 1. Confirmed by the server.')).toBeVisible();
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  await expect(page.getByText(/Latest run succeeded/)).toBeVisible();
  await page.locator('summary', { hasText: 'Projects / switch creation' }).click();
  await page
    .getByRole('navigation', { name: 'Project library' })
    .getByRole('button', { name: 'New vision +' })
    .click();
  await page.getByLabel('Tell Aethelios what you want to create').fill('Panel project B');
  await page.getByLabel('Project name (optional)').fill('Panel Beta');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByText('Saved revision 1. Confirmed by the server.')).toBeVisible();
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  await expect(page.locator('.origin-workbench-identity h2')).toHaveText('Panel Beta');
  await expect(page.getByText('Alpha receipt')).toHaveCount(0);
  await expect(page.getByText(/Latest run succeeded/)).toHaveCount(0);
  releaseB();
  await expect(page.getByText(/No approved brief for this project yet/)).toBeVisible();
  await expect(page.getByText('Alpha receipt')).toHaveCount(0);
});

test('construct stays off without persistence and does not invent a live run', async ({ page }) => {
  await fixture(page);
  await page.goto(base);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Unavailable worker draft');
  await page.getByLabel('Project name (optional)').fill('Blocked Origin');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  await expect(page.getByText(/Execution persistence is off in this environment/)).toBeVisible();
  await expect(page.getByText(/No simulated success is shown as a live run/)).toBeVisible();
  await expect(page.getByText(/Latest run succeeded/)).toHaveCount(0);
  await expect(page.getByText(/Latest run queued/)).toHaveCount(0);
  await expect(page.locator('.origin-workbench-identity h2')).toHaveText('Blocked Origin');
  await expect(page.getByRole('textbox', { name: 'Intended change' })).toHaveValue(
    'Unavailable worker draft',
  );
});

test('keeps last success and drafts when worker, connections and provider are unavailable', async ({
  page,
}) => {
  await fixture(page);
  const now = new Date().toISOString();
  await page.route('**/api/architect-construct/source*', async (route) =>
    route.fulfill({
      json: {
        access: 'read-only',
        publishing: false,
        deployment: false,
        github: {
          ready: false,
          repository: null,
          reason: 'GitHub App setup is required.',
        },
        vercel: { ready: false, project: null, reason: 'Publishing is unavailable.' },
      },
    }),
  );
  await page.route('**/api/architect-construct*', async (route) => {
    if (route.request().url().includes('/source')) return;
    if (route.request().method() !== 'GET')
      return route.fulfill({
        status: 503,
        json: { error: 'Isolated worker is not running. The queued request was not executed.' },
      });
    const projectId = new URL(route.request().url()).searchParams.get('project') ?? 'project';
    return route.fulfill({
      json: {
        project: { id: projectId, revision: 1, name: 'Blocked Origin' },
        proposal: {
          mode: 'disabled',
          reason:
            'Construct model proposals stay disabled until ARCHITECT_CONSTRUCT_ENABLED, ARCHITECT_CONSTRUCT_AI_ENABLED, a server-only OPENAI_API_KEY, and funded non-production testing are authorized. A funded OpenAI account does not supply a sandbox, durable worker, or repository connection.',
        },
        sources: [],
        briefs: [],
        runs: [
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            person_id: 'owner',
            project_id: projectId,
            brief_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            approval_hash: 'c'.repeat(64),
            source_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            source_kind: 'imported',
            source_tree_hash: 'a'.repeat(64),
            project_revision: 1,
            status: 'queued',
            cancel_requested: false,
            worker_id: null,
            lease_until: null,
            result: null,
            created_at: now,
            updated_at: now,
          },
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            person_id: 'owner',
            project_id: projectId,
            brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            approval_hash: 'b'.repeat(64),
            source_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            source_kind: 'imported',
            source_tree_hash: 'a'.repeat(64),
            project_revision: 1,
            status: 'succeeded',
            result: {
              isolation: 'docker',
              runtime_available: true,
              sandbox: true,
              blocker: null,
              source_hash: 'a'.repeat(64),
              result_hash: 'b'.repeat(64),
              changed_files: ['kept.html'],
              diff: '',
              checks: [
                {
                  name: 'heading',
                  status: 'passed',
                  command: 'node check.mjs',
                  exit_code: 0,
                  log: '',
                },
              ],
              preview: {
                path: 'kept.html',
                body: '<html><body><h1>Kept success</h1></body></html>',
                unavailable_reason: null,
              },
            },
            created_at: now,
            updated_at: now,
          },
        ],
        events: {
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': [
            {
              id: crypto.randomUUID(),
              run_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              person_id: 'owner',
              seq: 1,
              kind: 'queued',
              detail: 'Run queued. Isolated worker is not running.',
              created_at: now,
            },
          ],
        },
      },
    });
  });
  await page.goto(`${base}&construct=adapter`);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Unavailable capabilities');
  await page.getByLabel('Project name (optional)').fill('Blocked Origin');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Repair journey' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Propose repair' })).toBeDisabled();
  await expect(page.getByText(/GitHub App setup is required/)).toBeVisible();
  await expect(page.getByText(/Publishing and deployment stay unavailable/)).toBeVisible();
  await expect(page.getByText(/A funded OpenAI account does not supply/)).toBeVisible();
  await expect(page.getByText(/Latest run queued/)).toBeVisible();
  await expect(page.getByText(/Isolated worker is not running/)).toBeVisible();
  await page.getByRole('button', { name: 'Artifact preview' }).click();
  await expect(page.frameLocator('iframe[title="Isolated artifact preview"]').getByText('Kept success')).toBeVisible();
  await expect(page.locator('.origin-artifact-caption')).toContainText(/Isolated static preview|Last successful Construct/);
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  const review = page.getByRole('navigation', { name: 'Construct review' });
  await review.getByRole('button', { name: 'Changes', exact: true }).click();
  await expect(page.getByText(/Queued runs do not display a simulated diff|No execution result yet/)).toBeVisible();
  await review.getByRole('button', { name: 'Checks', exact: true }).click();
  await expect(page.getByText(/The browser cannot forge them/)).toBeVisible();
  await page.getByRole('button', { name: 'Propose change' }).click();
  await expect(page.getByRole('alert')).toContainText(/Isolated worker is not running|stay disabled|not executed/);
  await expect(page.locator('.origin-workbench-identity h2')).toHaveText('Blocked Origin');
});

test('repair journey keeps the original attempt after enqueue and restores durable stages', async ({
  page,
}) => {
  await fixture(page);
  const now = new Date().toISOString();
  const originalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
  const repairId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01';
  const successId = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
  await page.route('**/api/architect-construct/source*', async (route) =>
    route.fulfill({
      json: {
        access: 'read-only',
        publishing: false,
        deployment: false,
        github: { ready: false, repository: null, reason: 'GitHub App setup is required.' },
        vercel: { ready: false, project: null, reason: 'Publishing is unavailable.' },
      },
    }),
  );
  await page.route('**/api/architect-construct*', async (route) => {
    if (route.request().url().includes('/source')) return;
    if (route.request().method() !== 'GET')
      return route.fulfill({ status: 409, json: { error: 'This original run already has one repair.' } });
    const projectId = new URL(route.request().url()).searchParams.get('project') ?? 'project';
    return route.fulfill({
      json: {
        project: { id: projectId, revision: 1, name: 'Repair Origin' },
        proposal: { mode: 'disabled', reason: 'Labelled mocked provider is unavailable in this fixture.' },
        sources: [],
        briefs: [
          {
            id: repairId,
            status: 'approved',
            approval_hash: 'd'.repeat(64),
            scope: {
              intended_change: `Repair of run ${originalId}: syntax`,
              project_revision: 1,
              allowed_paths: ['ok.mjs'],
              protected_paths: ['.env'],
              resource_limits: { timeout_ms: 30000, max_files: 8 },
              patch: [{ path: 'ok.mjs', before: 'Before', after: 'After' }],
              repair: {
                kind: 'check-driven',
                parent_run_id: originalId,
                parent_approval_hash: 'e'.repeat(64),
                targets: ['syntax:ok.mjs'],
              },
            },
          },
        ],
        runs: [
          {
            id: repairId,
            person_id: 'owner',
            project_id: projectId,
            brief_id: repairId,
            approval_hash: 'd'.repeat(64),
            source_id: successId,
            source_kind: 'imported',
            source_tree_hash: 'a'.repeat(64),
            project_revision: 1,
            status: 'queued',
            parent_run_id: originalId,
            cancel_requested: false,
            result: null,
            created_at: now,
            updated_at: now,
          },
          {
            id: originalId,
            person_id: 'owner',
            project_id: projectId,
            brief_id: originalId,
            approval_hash: 'e'.repeat(64),
            source_id: successId,
            source_kind: 'imported',
            source_tree_hash: 'a'.repeat(64),
            project_revision: 1,
            status: 'failed',
            parent_run_id: null,
            result: {
              isolation: 'process-fixture',
              runtime_available: false,
              sandbox: false,
              blocker: 'Introduced syntax failure.',
              source_hash: 'a'.repeat(64),
              result_hash: null,
              changed_files: ['ok.mjs'],
              diff: '',
              checks: [],
              coverage: {
                no_applicable: false,
                preexisting_failures: [],
                introduced_failures: ['syntax:ok.mjs'],
                untested: [],
                unsupported: [],
                revision_note: '1',
              },
              preview: { path: null, body: '', unavailable_reason: 'failed' },
            },
            created_at: now,
            updated_at: now,
          },
          {
            id: successId,
            person_id: 'owner',
            project_id: projectId,
            brief_id: successId,
            approval_hash: 'f'.repeat(64),
            source_id: successId,
            source_kind: 'imported',
            source_tree_hash: 'a'.repeat(64),
            project_revision: 1,
            status: 'succeeded',
            parent_run_id: null,
            result: {
              isolation: 'docker',
              runtime_available: true,
              sandbox: true,
              blocker: null,
              source_hash: 'a'.repeat(64),
              result_hash: 'b'.repeat(64),
              changed_files: ['kept.html'],
              diff: '',
              checks: [],
              preview: {
                path: 'kept.html',
                body: '<html><body><h1>Kept success</h1></body></html>',
                unavailable_reason: null,
              },
            },
            created_at: now,
            updated_at: now,
          },
        ],
        events: {},
      },
    });
  });
  await page.goto(`${base}&construct=adapter`);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Repair journey');
  await page.getByLabel('Project name (optional)').fill('Repair Origin');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  const journey = page.getByRole('list', { name: 'Repair journey' });
  await expect(journey).toContainText('Original attempt · failed');
  await expect(journey).not.toContainText('Original attempt · queued');
  await expect(journey).toContainText('Observed result · queued');
  await expect(page.getByRole('button', { name: 'Propose repair' })).toBeDisabled();
  await expect(page.getByText(/Latest run queued/)).toBeVisible();
  await expect(page.getByText(/Repair result queued/)).toBeVisible();
  await page.getByRole('button', { name: 'Artifact preview' }).click();
  await expect(page.frameLocator('iframe[title="Isolated artifact preview"]').getByText('Kept success')).toBeVisible();
});

test('approved repair recovers after reload and retries one enqueue after a lost response', async ({
  page,
}) => {
  await fixture(page);
  const now = new Date().toISOString();
  const originalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21';
  const repairBriefId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21';
  const successId = 'cccccccc-cccc-4ccc-8ccc-cccccccccc21';
  const digest = 'd'.repeat(64);
  const starts: Array<{ briefId?: string; requestId?: string }> = [];
  let queued: Record<string, unknown> | null = null;
  const original = (projectId: string) => ({
    id: originalId,
    person_id: 'owner',
    project_id: projectId,
    brief_id: originalId,
    approval_hash: 'e'.repeat(64),
    source_id: successId,
    source_kind: 'imported',
    source_tree_hash: 'a'.repeat(64),
    project_revision: 1,
    status: 'failed',
    parent_run_id: null,
    result: {
      isolation: 'process-fixture',
      runtime_available: false,
      sandbox: false,
      blocker: 'Introduced syntax failure.',
      source_hash: 'a'.repeat(64),
      result_hash: null,
      changed_files: ['ok.mjs'],
      diff: '',
      checks: [],
      coverage: {
        no_applicable: false,
        preexisting_failures: [],
        introduced_failures: ['syntax:ok.mjs'],
        untested: [],
        unsupported: [],
        revision_note: '1',
      },
      preview: { path: null, body: '', unavailable_reason: 'failed' },
    },
    created_at: now,
    updated_at: now,
  });
  const success = (projectId: string) => ({
    id: successId,
    person_id: 'owner',
    project_id: projectId,
    brief_id: successId,
    approval_hash: 'f'.repeat(64),
    source_id: successId,
    source_kind: 'imported',
    source_tree_hash: 'a'.repeat(64),
    project_revision: 1,
    status: 'succeeded',
    parent_run_id: null,
    result: {
      isolation: 'docker',
      runtime_available: true,
      sandbox: true,
      blocker: null,
      source_hash: 'a'.repeat(64),
      result_hash: 'b'.repeat(64),
      changed_files: ['kept.html'],
      diff: '',
      checks: [],
      preview: {
        path: 'kept.html',
        body: '<html><body><h1>Kept success</h1></body></html>',
        unavailable_reason: null,
      },
    },
    created_at: now,
    updated_at: now,
  });
  await page.route('**/api/architect-construct/source*', async (route) =>
    route.fulfill({
      json: {
        access: 'read-only',
        publishing: false,
        deployment: false,
        github: { ready: false, repository: null, reason: 'GitHub App setup is required.' },
        vercel: { ready: false, project: null, reason: 'Publishing is unavailable.' },
      },
    }),
  );
  await page.route('**/api/architect-construct*', async (route) => {
    if (route.request().url().includes('/source')) return;
    const body = route.request().method() === 'POST'
      ? (route.request().postDataJSON() as {
          action?: string;
          projectId?: string;
          briefId?: string;
          requestId?: string;
        })
      : null;
    const projectId =
      body?.projectId || new URL(route.request().url()).searchParams.get('project') || 'project';
    if (route.request().method() === 'POST') {
      if (body?.action === 'start') {
        starts.push({ briefId: body.briefId, requestId: body.requestId });
        queued = {
          id: repairBriefId,
          person_id: 'owner',
          project_id: projectId,
          brief_id: repairBriefId,
          approval_hash: digest,
          source_id: successId,
          source_kind: 'imported',
          source_tree_hash: 'a'.repeat(64),
          project_revision: 1,
          status: 'queued',
          parent_run_id: originalId,
          cancel_requested: false,
          result: null,
          created_at: now,
          updated_at: now,
        };
        if (starts.length === 1) return route.abort('connectionreset');
        return route.fulfill({ json: { run: queued } });
      }
      return route.fulfill({ status: 409, json: { error: 'This original run already has one repair.' } });
    }
    return route.fulfill({
      json: {
        project: { id: projectId, revision: 1, name: 'Recovered Origin' },
        proposal: { mode: 'mock', reason: null },
        pendingRepair: queued
          ? null
          : {
              briefId: repairBriefId,
              requestId: repairBriefId,
              parentRunId: originalId,
              approvalHash: digest,
              status: 'approved',
              invalidationReason: null,
              projectRevision: 1,
              generation: { mode: 'mock', notes: 'Labelled demonstration. Not a paid OpenAI call.' },
              patch: [{ path: 'ok.mjs', before: 'const introduced = ;\n', after: 'export const heading = "After";\n' }],
              intendedChange: `Repair of run ${originalId}: syntax`,
            },
        sources: [],
        briefs: [
          {
            id: repairBriefId,
            status: 'approved',
            approval_hash: digest,
            scope: {
              intended_change: `Repair of run ${originalId}: syntax`,
              project_revision: 1,
              allowed_paths: ['ok.mjs'],
              protected_paths: ['.env'],
              resource_limits: { timeout_ms: 30000, max_files: 8 },
              patch: [{ path: 'ok.mjs', before: 'const introduced = ;\n', after: 'export const heading = "After";\n' }],
              repair: {
                kind: 'check-driven',
                parent_run_id: originalId,
                parent_approval_hash: 'e'.repeat(64),
                targets: ['syntax:ok.mjs'],
                generation: { mode: 'mock', notes: 'Labelled demonstration. Not a paid OpenAI call.' },
              },
            },
          },
        ],
        runs: queued ? [queued, original(projectId), success(projectId)] : [original(projectId), success(projectId)],
        events: {},
      },
    });
  });
  await page.goto(`${base}&construct=adapter`);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Recovered repair');
  await page.getByLabel('Project name (optional)').fill('Recovered Origin');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'Construct', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recovered approved repair' })).toBeVisible();
  await expect(page.getByText('Labelled demonstration. Not a paid OpenAI call.').first()).toBeVisible();
  await expect(page.getByText(/Recovered approved repair is waiting for Start/)).toBeVisible();
  const enqueue = page.getByRole('button', { name: 'Enqueue approved repair' });
  await expect(enqueue).toBeEnabled();
  await enqueue.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await enqueue.click();
  await expect(page.getByRole('list', { name: 'Repair journey' })).toContainText('Observed result · queued');
  await expect(page.getByText(/Repair result queued/)).toBeVisible();
  expect(starts).toEqual([
    { briefId: repairBriefId, requestId: repairBriefId },
    { briefId: repairBriefId, requestId: repairBriefId },
  ]);
});

test('quantity-and-cost estimator can be created, saved, reopened and invoked', async ({ page }) => {
  const tools: Array<Record<string, unknown>> = [];
  const versions: Array<Record<string, unknown>> = [];
  const invocations: Array<Record<string, unknown>> = [];
  await fixture(page);
  await page.route('**/api/architect-tools*', async (route) => {
    if (route.request().method() === 'GET') {
      const requested = new URL(route.request().url()).searchParams.get('tool');
      if (requested && !tools.some((item) => item.id === requested))
        return route.fulfill({ status: 404, json: { error: 'Tool unavailable.' } });
      return route.fulfill({ json: { tools, versions, invocations } });
    }
    const body = route.request().postDataJSON();
    if (body.action === 'save') {
      if (tools[0] && body.expected !== tools[0].revision)
        return route.fulfill({ status: 409, json: { error: 'This tool changed after you opened it.' } });
      const now = new Date().toISOString();
      const revision = body.expected + 1;
      const tool = {
        id: body.toolId,
        person_id: 'owner',
        project_id: body.projectId,
        kind: 'quantity-cost-estimator',
        name: body.name,
        revision,
        created_at: now,
        updated_at: now,
      };
      tools.splice(0, tools.length, tool);
      versions.unshift({
        id: body.requestId,
        tool_id: body.toolId,
        person_id: 'owner',
        project_id: body.projectId,
        revision,
        name: body.name,
        configuration: body.configuration,
        note: body.note,
        created_at: now,
      });
      return route.fulfill({
        json: { revision, requestId: body.requestId, personId: 'owner', toolId: body.toolId },
      });
    }
    if (body.action === 'invoke') {
      if (body.projectId === '00000000-0000-4000-8000-000000000099')
        return route.fulfill({ status: 404, json: { error: 'Saved tool revision unavailable.' } });
      const version = versions.find((item) => item.revision === body.revision);
      if (!version) return route.fulfill({ status: 404, json: { error: 'Saved tool revision unavailable.' } });
      const receipt = {
        toolId: body.toolId,
        projectId: body.projectId,
        revision: body.revision,
        name: version.name,
        configuration: version.configuration,
        inputs: { quantities: body.quantities ?? {} },
        assumptions: ['Markup is not margin.'],
        result: {
          currency: 'USD',
          rounding: 'half-up-minor',
          lines: [],
          subtotal: '310.00',
          waste_total: '31.00',
          markup_amount: '51.15',
          total: '392.15',
          implied_margin_percent: '13.04',
          assumptions: ['Markup is not margin.'],
        },
        provenance: {
          source: body.source,
          requestId: body.requestId,
          personId: 'owner',
          recorded: true,
        },
      };
      invocations.unshift(receipt);
      return route.fulfill({ json: receipt });
    }
    return route.fulfill({ status: 400, json: { error: 'Unsupported tool action' } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Estimate sheet goods for a workshop.');
  await page.getByLabel('Project name (optional)').fill('Workshop estimator');
  await page.getByRole('button', { name: 'Create a quantity & cost estimator' }).click();
  await expect(page.locator('.origin-status')).toContainText('Saved revision 1');
  await expect(page.getByRole('heading', { name: 'Quantity and cost estimator' })).toBeVisible();
  await expect(page.locator('.origin-savebar')).toContainText('No tool revision saved yet');
  await expect(page.locator('.origin-savebar')).not.toContainText('Unsaved tool draft');
  await page.getByRole('button', { name: 'Load labelled sample' }).click();
  await expect(page.locator('.origin-tool-result').getByText(/Sample demonstration/)).toBeVisible();
  await expect(page.locator('.origin-tool .origin-connection-chip')).toHaveText('Unsaved preview');
  await expect(page.locator('.origin-tool-result h4')).toContainText('392.15');
  await expect(page.getByRole('button', { name: 'Agent fixture invoke' })).toHaveCount(0);
  await expect(page.locator('.origin-savebar')).toContainText('Unsaved tool draft');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: 'Open project Talk ↗' }).click();
  await expect(page).toHaveURL(/\/app\/architect/);
  await expect(page.getByRole('heading', { name: 'Quantity and cost estimator' })).toBeVisible();
  await page.getByRole('button', { name: 'Save tool revision' }).click();
  await expect(page.locator('.origin-tool [role="status"]')).toContainText('Saved tool revision 1');
  const intended = page.getByLabel('Assumptions');
  await intended.fill('Edited after save — still a draft until the next revision.');
  await expect(page.locator('.origin-tool .origin-connection-chip')).toHaveText('Unsaved preview');
  await expect(page.locator('.origin-savebar')).toContainText('Unsaved tool draft');
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await expect(page.locator('.origin-savebar')).toContainText('Unsaved tool draft kept');
  await expect(page.locator('.origin-savebar')).not.toContainText('All project changes saved');
  await page.getByRole('button', { name: 'Tool', exact: true }).click();
  await expect(page.getByLabel('Assumptions')).toHaveValue(
    'Edited after save — still a draft until the next revision.',
  );
  await page.screenshot({
    path: 'docs/evidence/architect-construct/architect-tool-1440.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Invoke saved revision' }).click();
  await expect(page.getByText(/invoked Sample plywood estimator revision 1/)).toBeVisible();
  await expect(page.getByText(/This is the saved revision, not the unsaved draft/)).toBeVisible();
  await page.setViewportSize({ width: 720, height: 900 });
  await expect(page.getByRole('heading', { name: 'Quantity and cost estimator' })).toBeVisible();
  await page.screenshot({
    path: 'docs/evidence/architect-construct/architect-tool-720.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Quantity and cost estimator' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save tool revision' })).toBeVisible();
  await page.screenshot({
    path: 'docs/evidence/architect-construct/architect-tool-390.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 480 });
  await expect(page.locator('.origin-tool-result h4')).toBeVisible();
  await page.screenshot({
    path: 'docs/evidence/architect-construct/architect-tool-keyboard-390.png',
    fullPage: true,
  });
});

test('estimator save retries the exact snapshot after a dropped response', async ({ page }) => {
  const tools: Array<Record<string, unknown>> = [];
  const versions: Array<Record<string, unknown>> = [];
  const gate = { release: () => {} };
  await fixture(page);
  await page.route('**/api/architect-tools*', async (route) => {
    if (route.request().method() === 'GET') {
      const requested = new URL(route.request().url()).searchParams.get('tool');
      if (requested && !tools.some((item) => item.id === requested))
        return route.fulfill({ status: 404, json: { error: 'Tool unavailable.' } });
      return route.fulfill({ json: { tools, versions, invocations: [] } });
    }
    const body = route.request().postDataJSON();
    if (body.action === 'save') {
      if (!tools.length) {
        await new Promise<void>((resolve) => {
          gate.release = resolve;
        });
      }
      if (tools[0] && body.requestId === versions[0]?.id)
        return route.fulfill({
          json: { revision: 1, requestId: body.requestId, personId: 'owner', toolId: body.toolId },
        });
      const now = new Date().toISOString();
      tools.splice(0, tools.length, {
        id: body.toolId,
        person_id: 'owner',
        project_id: body.projectId,
        kind: 'quantity-cost-estimator',
        name: body.name,
        revision: 1,
        created_at: now,
        updated_at: now,
      });
      versions.unshift({
        id: body.requestId,
        tool_id: body.toolId,
        person_id: 'owner',
        project_id: body.projectId,
        revision: 1,
        name: body.name,
        configuration: body.configuration,
        note: body.note,
        created_at: now,
      });
      return route.fulfill({
        json: { revision: 1, requestId: body.requestId, personId: 'owner', toolId: body.toolId },
      });
    }
    return route.fulfill({ status: 400, json: { error: 'Unsupported tool action' } });
  });
  await page.goto(base);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Hold the first tool save.');
  await page.getByLabel('Project name (optional)').fill('Retry estimator');
  await page.getByRole('button', { name: 'Create a quantity & cost estimator' }).click();
  await expect(page.getByRole('heading', { name: 'Quantity and cost estimator' })).toBeVisible();
  await page.getByRole('button', { name: 'Load labelled sample' }).click();
  await page.getByRole('button', { name: 'Save tool revision' }).click();
  await expect(page.locator('.origin-savebar')).toContainText('Tool save unconfirmed');
  await page.getByLabel('Assumptions').fill('Later edit after submit.');
  gate.release();
  await expect(page.locator('.origin-tool [role="status"]')).toContainText('Later edits remain an unsaved draft');
  await expect(page.getByLabel('Assumptions')).toHaveValue('Later edit after submit.');
  await expect(page.locator('.origin-tool .origin-connection-chip')).toHaveText('Unsaved preview');
});

test('confirmed tool save with a failed library refresh offers reload, not another save', async ({ page }) => {
  const tools: Array<Record<string, unknown>> = [];
  const versions: Array<Record<string, unknown>> = [];
  const gate = { failRefresh: true };
  await fixture(page);
  await page.route('**/api/architect-tools*', async (route) => {
    if (route.request().method() === 'GET') {
      if (tools.length && gate.failRefresh)
        return route.fulfill({ status: 503, json: { error: 'Tool library unavailable. Reload before editing.' } });
      return route.fulfill({ json: { tools, versions, invocations: [] } });
    }
    const body = route.request().postDataJSON();
    if (body.action === 'save') {
      const now = new Date().toISOString();
      tools.splice(0, tools.length, {
        id: body.toolId,
        person_id: 'owner',
        project_id: body.projectId,
        kind: 'quantity-cost-estimator',
        name: body.name,
        revision: 1,
        created_at: now,
        updated_at: now,
      });
      versions.unshift({
        id: body.requestId,
        tool_id: body.toolId,
        person_id: 'owner',
        project_id: body.projectId,
        revision: 1,
        name: body.name,
        configuration: body.configuration,
        note: body.note,
        created_at: now,
      });
      return route.fulfill({
        json: { revision: 1, requestId: body.requestId, personId: 'owner', toolId: body.toolId },
      });
    }
    return route.fulfill({ status: 400, json: { error: 'Unsupported tool action' } });
  });
  await page.goto(base);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Keep the confirmed tool identity.');
  await page.getByLabel('Project name (optional)').fill('Refresh estimator');
  await page.getByRole('button', { name: 'Create a quantity & cost estimator' }).click();
  await expect(page.getByRole('heading', { name: 'Quantity and cost estimator' })).toBeVisible();
  await page.getByRole('button', { name: 'Load labelled sample' }).click();
  await page.getByRole('button', { name: 'Save tool revision' }).click();
  await expect(page.locator('.origin-tool [role="status"]')).toContainText(
    /Library refresh failed — reload receipts. Do not save this revision again/,
  );
  await expect(page.getByRole('button', { name: 'Reload tool receipts' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save tool revision' })).toBeDisabled();
  await expect(page.locator('.origin-savebar')).not.toContainText('Tool save unconfirmed');
  gate.failRefresh = false;
  await page.getByRole('button', { name: 'Reload tool receipts' }).first().click();
  await expect(page.locator('.origin-tool [role="status"]')).toContainText('The confirmed revision was not saved again');
});

test('UI fixture: app workbench reviews files, recovers approved start after reload, and keeps last working preview', async ({
  page,
}) => {
  await fixture(page);
  const revisionId = '00000000-0000-4000-8000-000000000902';
  let approved = false;
  let starts = 0;
  let lostStart = true;
  const library = () => ({
    app: approved ? { id: 'app', current_revision: 1, last_working_revision: 1, name: 'Tracker' } : null,
    revisions: approved
      ? [
          {
            id: revisionId,
            revision: 1,
            status: starts ? 'ready' : 'approved',
            working: starts > 0,
            approval_hash: 'a'.repeat(64),
            generation: { mode: 'fixture', notes: 'Deterministic fixture application' },
            files: [
              { path: 'src/App.tsx', content: 'export function App() { return null; }' },
              { path: 'src/pages/Board.tsx', content: 'export function Board() { return null; }' },
            ],
            collections: [{ name: 'items' }],
          },
        ]
      : [],
    jobs: starts
      ? [{ id: revisionId, revision_id: revisionId, status: 'succeeded', cancel_requested: false, result: { ok: true, isolation: 'host-fixture', sandbox: false, blocker: null, typecheck: { ok: true }, bundle: { ok: true } } }]
      : [],
    events: [],
    current: approved
      ? { id: revisionId, revision: 1, status: starts ? 'ready' : 'approved', working: starts > 0, approval_hash: 'a'.repeat(64) }
      : null,
    working: starts ? { id: revisionId, revision: 1 } : null,
    selected: starts ? { id: revisionId, revision: 1, status: 'ready', working: true } : null,
    preview: starts
      ? {
          srcDoc: '<!doctype html><title>Tracker</title><p>Working tracker</p>',
          sandbox: 'allow-scripts',
          label: 'Private compiled preview',
        }
      : null,
    previewSession: starts ? 'session' : null,
    pendingStart:
      approved && !starts
        ? { revisionId, requestId: revisionId, approvalHash: 'a'.repeat(64), revision: 1 }
        : null,
    records: {},
    provider: { enabled: true, mode: 'fixture', reason: 'Deterministic fixture application — labelled development evidence, not a live model generation.' },
    profile: { id: 'react-ts-vite', version: '2026-10-14.1', toolchain: 'vite-8.3.0+react-19.3.0+typescript-6.0.3' },
    capabilities: { navigation: true, forms: true, validation: true, filtering: true, calculations: true, persistence: true },
  });
  await page.route('**/api/architect-apps**', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: library() });
    const body = route.request().postDataJSON();
    if (body.action === 'propose')
      return route.fulfill({
        json: {
          proposal: {
            summary: 'Tracker',
            files: [{ path: 'src/App.tsx', content: 'export function App() { return null; }' }],
            collections: [{ name: 'items', fields: [{ name: 'title', type: 'string', required: true }] }],
            behaviors: { navigation: true, forms: true, validation: true, filtering: true, calculations: true, persistence: true },
            notes: 'Deterministic fixture',
          },
          approvalHash: 'a'.repeat(64),
          treeHash: 'b'.repeat(64),
          changes: [{ path: 'src/App.tsx', kind: 'create' }],
          generation: { mode: 'fixture', notes: 'Deterministic fixture application' },
          baseRevision: null,
        },
      });
    if (body.action === 'approve') {
      approved = true;
      return route.fulfill({ json: { revision: { id: revisionId, revision: 1, approval_hash: 'a'.repeat(64) } } });
    }
    if (body.action === 'start') {
      expect(body.requestId).toBe(revisionId);
      if (lostStart) {
        lostStart = false;
        return route.fulfill({ status: 503, json: { error: 'Synthetic lost start response' } });
      }
      starts += 1;
      return route.fulfill({ json: { job: { id: revisionId, status: 'queued' } } });
    }
    return route.fulfill({ status: 400, json: { error: 'Unsupported app action' } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}&apps=adapter`);
  await page.getByLabel('Tell Aethelios what you want to create').fill('Create a usable project tracker.');
  await page.getByLabel('Project name (optional)').fill('App tracker');
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText('Saved revision 1');
  await page.getByRole('button', { name: 'App', exact: true }).click();
  await expect(page.getByRole('heading', { name: /No application yet|Revision/ })).toBeVisible();
  await page.getByRole('button', { name: 'Review proposed files' }).click();
  await expect(page.getByText('src/App.tsx')).toBeVisible();
  await page.getByRole('button', { name: 'Accept revision' }).click();
  await expect(page.getByText(/Revision 1 accepted\. Start remains explicit/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'App', exact: true }).click();
  await expect(page.getByText(/Approved revision 1 recovered/)).toBeVisible();
  await page.getByRole('button', { name: 'Start approved build' }).click();
  await expect(page.getByText(/Build was not queued|Synthetic lost start/)).toBeVisible();
  await page.getByRole('button', { name: 'Start approved build' }).click();
  await expect(page.getByTitle('Private generated application preview')).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-apps-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Phone' })).toBeVisible();
  await page.screenshot({ path: 'test-results/architect-apps-phone.png', fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: 'test-results/architect-apps-fold.png', fullPage: true });
});
