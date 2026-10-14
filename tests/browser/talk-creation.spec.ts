import { test, expect, type Page } from './fixtures';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';
import type { TalkCreationWorkspace } from '../../src/domains/talk-creation/schema';

const conversation = '30000000-0000-4000-8000-000000000011';
const turn: Turn = {
  id: '40000000-0000-4000-8000-000000000011',
  person_id: 'synthetic',
  conversation_id: conversation,
  user_text: 'Help me develop a premium brand and website.',
  assistant_text:
    'I framed a brief and palette from what you asked. Review the sections, then we can refine.',
  status: 'complete',
  model: 'synthetic',
  context_included: false,
  prompt_version: 'fixture',
  feedback: null,
  created_at: '2026-10-13T00:00:00.000Z',
  finished_at: '2026-10-13T00:00:01.000Z',
};

const creations: TalkCreationWorkspace = {
  creations: [
    {
      id: '50000000-0000-4000-8000-000000000011',
      person_id: 'synthetic',
      conversation_id: conversation,
      source_turn_id: turn.id,
      lineage_id: '50000000-0000-4000-8000-000000000011',
      version: 1,
      kind: 'brief',
      content: {
        title: 'Reserve brand',
        purpose: 'A premium personal brand and website.',
        audience: 'Founders who want considered digital presence.',
        visualDirection: 'Obsidian, emerald glass, restrained gold.',
        requirements: ['Phone first', 'No invented products'],
        unresolved: ['Photography'],
      },
      predecessor_id: null,
      superseded_by: null,
      created_at: '2026-10-13T00:00:01.000Z',
    },
    {
      id: '50000000-0000-4000-8000-000000000012',
      person_id: 'synthetic',
      conversation_id: conversation,
      source_turn_id: turn.id,
      lineage_id: '50000000-0000-4000-8000-000000000012',
      version: 1,
      kind: 'palette',
      content: {
        title: 'Imperial palette',
        notes: 'Exact hex roles. No generated color blocks.',
        swatches: [
          { hex: '#080D0D', name: 'Obsidian', role: 'background' },
          { hex: '#E6E7E2', name: 'Ivory', role: 'text' },
          { hex: '#C4912F', name: 'Reserve Gold', role: 'accent' },
        ],
        contrast: [
          {
            foreground: '#E6E7E2',
            background: '#080D0D',
            ratio: 15.4,
            pair: 'Ivory on Obsidian',
            passesAa: true,
          },
        ],
      },
      predecessor_id: null,
      superseded_by: null,
      created_at: '2026-10-13T00:00:01.000Z',
    },
  ],
  selected: {
    brief: '50000000-0000-4000-8000-000000000011',
    palette: '50000000-0000-4000-8000-000000000012',
  },
  images: [
    {
      id: '60000000-0000-4000-8000-000000000011',
      conversation_id: conversation,
      operation: 'image.create',
      prompt: 'A restrained crest on obsidian',
      status: 'approval',
      project_id: null,
      version_id: null,
      base_version_id: null,
      created_at: '2026-10-13T00:00:02.000Z',
    },
  ],
  selectedImageId: null,
  canCreateImages: true,
  imageAccess: 'unavailable',
  attachmentProjectId: null,
};

const workspace = (turns: Turn[]): WorkspaceData => ({
  ownerId: 'synthetic',
  conversations: [
    {
      id: conversation,
      person_id: 'synthetic',
      title: 'Premium brand',
      created_at: turn.created_at,
      updated_at: turn.created_at,
    },
  ],
  turns,
  memories: [],
  actionProposals: [],
  context: {
    profile: { name: 'Synthetic', priority: 'Build', timezone: 'UTC', units: 'metric', updatedAt: '2026-10-13' },
    goal: null,
    memories: [],
  },
  canChat: true,
  configured: true,
  model: 'synthetic-test-model',
  currentConversation: {
    id: conversation,
    person_id: 'synthetic',
    title: 'Premium brand',
    created_at: turn.created_at,
    updated_at: turn.created_at,
  },
});

async function mockTalk(page: Page, turns: Turn[] = [turn]) {
  const state = structuredClone(creations);
  let savedHandoff: unknown = null;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations') {
      if (route.request().method() === 'GET') {
        const lineage = url.searchParams.get('lineage');
        if (lineage)
          return route.fulfill({
            json: { versions: state.creations.filter((item) => item.lineage_id === lineage) },
          });
        const handoffId = url.searchParams.get('handoff');
        if (handoffId) {
          const packageRow = state.creations.find((item) => item.id === handoffId);
          return route.fulfill({
            json: {
              handoffId,
              imported: Boolean(
                packageRow && 'imported' in packageRow.content && packageRow.content.imported,
              ),
              projectId:
                packageRow && 'originProjectId' in packageRow.content
                  ? packageRow.content.originProjectId
                  : null,
              originReady: true,
              project: {
                name: 'Reserve brand',
                description: 'A premium personal brand and website.',
                discipline: 'business',
                blueprint: { vision: 'A premium brand and website.' },
              },
              selections: [
                {
                  kind: 'brief',
                  versionId: '50000000-0000-4000-8000-000000000011',
                  version: 1,
                  title: 'Reserve brand',
                },
              ],
            },
          });
        }
        return route.fulfill({ json: state });
      }
      const body = route.request().postDataJSON() as {
        id?: string;
        action?: string;
        handoffId?: string;
        idea?: string;
        kind?: 'brief' | 'plan' | 'palette' | 'handoff';
        predecessorId?: string | null;
        sourceTurnId?: string | null;
        content?: TalkCreationWorkspace['creations'][number]['content'];
      };
      if (body.action === 'import-origin' && body.handoffId) {
        const existing = state.creations.find((item) => item.id === body.handoffId);
        const projectId = '90000000-0000-4000-8000-000000000011';
        if (existing && existing.kind === 'handoff' && 'imported' in existing.content) {
          existing.content = { ...existing.content, imported: true, originProjectId: projectId };
        }
        savedHandoff = { id: body.id, imported: true, projectId, recovered: Boolean(savedHandoff) };
        return route.fulfill({ json: savedHandoff });
      }
      if (body.idea) {
        const existing = state.creations.find((item) => item.id === body.id);
        savedHandoff = { id: body.id, imported: false, content: { imported: false, idea: body.idea } };
        if (!existing && body.id && state.creations[0])
          state.creations.push({
            person_id: state.creations[0].person_id,
            conversation_id: state.creations[0].conversation_id,
            lineage_id: body.id,
            created_at: state.creations[0].created_at,
            id: body.id,
            kind: 'handoff',
            source_turn_id: state.creations[0].source_turn_id,
            version: 1,
            predecessor_id: null,
            superseded_by: null,
            content: {
              schema: 'talk-architect-handoff/v1',
              conversationId: conversation,
              preparedAt: new Date().toISOString(),
              discipline: 'business',
              idea: body.idea,
              description: '',
              decisions: '',
              selections: [],
              images: [],
              imported: false,
            },
          });
        return route.fulfill({ json: savedHandoff });
      }
      if (body.kind && body.content && body.id) {
        const existing = state.creations.find((item) => item.id === body.id);
        if (existing) return route.fulfill({ json: { id: existing.id, recovered: true } });
        const predecessor = state.creations.find((item) => item.id === body.predecessorId);
        const base = predecessor ?? state.creations[0];
        if (!base) return route.fulfill({ status: 400, json: { error: 'No creation to refine.' } });
        if (predecessor) predecessor.superseded_by = body.id;
        state.creations.push({
          person_id: base.person_id,
          conversation_id: base.conversation_id,
          source_turn_id: predecessor ? predecessor.source_turn_id : (body.sourceTurnId ?? null),
          lineage_id: predecessor?.lineage_id ?? body.id,
          created_at: base.created_at,
          id: body.id,
          kind: body.kind,
          content: body.content,
          version: (predecessor?.version ?? 0) + 1,
          predecessor_id: predecessor?.id ?? null,
          superseded_by: null,
        });
        if (body.kind !== 'handoff') state.selected[body.kind] = body.id;
        return route.fulfill({ json: { id: body.id } });
      }
      return route.fulfill({ json: { id: body.id ?? '50000000-0000-4000-8000-000000000013' } });
    }
    if (url.pathname === '/api/aurelius') return route.fulfill({ json: workspace(turns) });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  return {
    handoff: () => savedHandoff,
    state: () => state,
  };
}

async function settleTalk(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
}

test('Talk creation journey keeps brief, palette and image review in the conversation', async ({
  page,
}, testInfo) => {
  await mockTalk(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await settleTalk(page);
  await expect(page.getByText('Reserve brand')).toBeVisible();
  await expect(page.getByText('Imperial palette')).toBeVisible();
  await expect(page.getByLabel('Imperial palette swatches')).toBeVisible();
  await expect(page.getByText('Queued for your approval', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve and generate', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('talk-creation-phone.png'),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'Reviewed work' })).toBeVisible();
  await expect(page.getByText('Prepare for Architect')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await expect(page.getByRole('complementary', { name: 'Reviewed work' })).toBeVisible();
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('talk-creation-unfolded.png'),
    animations: 'disabled',
  });
});

test('refining a brief writes a new version that survives reload', async ({ page }) => {
  const mock = await mockTalk(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  const panel = page.getByRole('complementary', { name: 'Reviewed work' });
  await panel.getByLabel('Purpose').fill('A quieter luxury brand for private founders.');
  await panel.getByRole('button', { name: 'Save new version', exact: true }).click();
  await expect(page.getByText('New version saved.')).toBeVisible();
  await expect.poll(() => mock.state().creations.at(-1)?.version).toBe(2);
  await page.reload();
  await expect(page.getByText('A quieter luxury brand for private founders.')).toBeVisible();
  await expect(page.getByText('Brief · v2', { exact: false })).toBeVisible();
});

test('Use in Architect saves a package without claiming import', async ({ page }) => {
  const mock = await mockTalk(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  const panel = page.getByRole('complementary', { name: 'Reviewed work' });
  await expect(panel).toBeVisible();
  await panel.getByLabel('Architect idea').fill('A premium brand and website.');
  await panel.getByRole('button', { name: 'Prepare for Architect', exact: true }).click();
  await expect.poll(() => mock.handoff()).toMatchObject({ imported: false });
});

test('reviewed Architect import creates one project and can reopen it', async ({ page }) => {
  const mock = await mockTalk(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  const panel = page.getByRole('complementary', { name: 'Reviewed work' });
  await panel.getByLabel('Architect idea').fill('A premium brand and website.');
  await panel.getByRole('button', { name: 'Prepare for Architect', exact: true }).click();
  await expect.poll(() => mock.handoff()).toMatchObject({ imported: false });
  await page.locator('[data-kind="handoff"]').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(panel.getByText('Project name')).toBeVisible();
  await expect(panel.getByText('Reserve brand', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Create Architect project', exact: true }).click();
  await expect(panel.getByRole('link', { name: 'Open saved Architect project' })).toHaveAttribute(
    'href',
    '/app/architect?project=90000000-0000-4000-8000-000000000011',
  );
  await expect.poll(() => mock.handoff()).toMatchObject({ imported: true });
});
