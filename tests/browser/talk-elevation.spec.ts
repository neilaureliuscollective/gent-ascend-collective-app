import { test, expect } from './fixtures';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';
import type { TalkCreationWorkspace } from '../../src/domains/talk-creation/schema';
import { lifestyleLaunchBoard, selectDesignDirection } from '../../src/domains/talk-creation/design-board';

const conversation = '30000000-0000-4000-8000-000000000441';
const turn: Turn = {
  id: '40000000-0000-4000-8000-000000000441',
  person_id: 'synthetic',
  conversation_id: conversation,
  user_text: 'Launch Aethelios Lifestyle with three visual directions.',
  assistant_text: 'Labelled deterministic Talk fixture. Three Aethelios Lifestyle directions are on the board.',
  status: 'complete',
  model: 'synthetic',
  context_included: false,
  prompt_version: 'fixture',
  feedback: null,
  created_at: '2026-10-15T03:00:00.000Z',
  finished_at: '2026-10-15T03:00:01.000Z',
};

function workspace(): WorkspaceData {
  return {
    ownerId: 'synthetic',
    configured: true,
    canChat: true,
    model: 'synthetic-test-model',
    memories: [],
    actionProposals: [],
    context: {
      profile: { name: 'Synthetic', priority: 'Build', timezone: 'UTC', units: 'metric', updatedAt: '2026-10-15' },
      goal: null,
      memories: [],
    },
    conversations: [
      {
        id: conversation,
        person_id: 'synthetic',
        title: 'Aethelios Lifestyle launch',
        created_at: turn.created_at,
        updated_at: turn.created_at,
      },
    ],
    currentConversation: {
      id: conversation,
      person_id: 'synthetic',
      title: 'Aethelios Lifestyle launch',
      created_at: turn.created_at,
      updated_at: turn.created_at,
    },
    turns: [turn],
  };
}

test('Talk elevation names the selected Lifestyle direction above the shared composer', async ({
  page,
}, testInfo) => {
  const board = selectDesignDirection(lifestyleLaunchBoard(), 'direction-c');
  const creations: TalkCreationWorkspace = {
    creations: [
      {
        id: '50000000-0000-4000-8000-000000000441',
        person_id: 'synthetic',
        conversation_id: conversation,
        source_turn_id: turn.id,
        lineage_id: '50000000-0000-4000-8000-000000000441',
        version: 4,
        kind: 'board',
        content: board,
        predecessor_id: null,
        superseded_by: null,
        created_at: '2026-10-15T03:00:01.000Z',
      },
    ],
    selected: { board: '50000000-0000-4000-8000-000000000441' },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations') return route.fulfill({ json: creations });
    if (url.pathname === '/api/aurelius') return route.fulfill({ json: workspace() });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await expect(page.getByText(/Changing this: Aethelios Lifestyle launch directions · v4 · Emerald Glass/)).toBeVisible();
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await expect(page.locator('#talk-voice-dock')).toHaveCount(1);
  await expect(page.getByText('Legacy Reserve')).toHaveCount(0);
  for (const [name, size] of [
    ['phone', { width: 390, height: 844 }],
    ['fold', { width: 768, height: 884 }],
    ['desktop', { width: 1440, height: 900 }],
  ] as const) {
    await page.setViewportSize(size);
    await expect(page.getByText(/Changing this: Aethelios Lifestyle launch directions · v4 · Emerald Glass/)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`talk-elevation-${name}.png`),
      animations: 'disabled',
    });
  }
});

test('Talk elevation opens a Lifestyle brief as an editable document with honest export', async ({
  page,
}, testInfo) => {
  const brief = {
    title: 'Aethelios Lifestyle launch',
    purpose: 'Introduce the line with a precise visual direction.',
    audience: 'Founders reviewing Aethelios Lifestyle.',
    visualDirection: 'Obsidian, emerald glass and restrained gold.',
    requirements: ['Phone-first reading'],
    unresolved: ['Final merchandising copy'],
  };
  const current = {
    id: '50000000-0000-4000-8000-000000000442',
    person_id: 'synthetic',
    conversation_id: conversation,
    source_turn_id: turn.id,
    lineage_id: '50000000-0000-4000-8000-000000000442',
    version: 2,
    kind: 'brief' as const,
    content: brief,
    predecessor_id: '50000000-0000-4000-8000-000000000443',
    superseded_by: null,
    created_at: '2026-10-15T03:00:02.000Z',
  };
  const previous = {
    ...current,
    id: '50000000-0000-4000-8000-000000000443',
    version: 1,
    predecessor_id: null,
    superseded_by: current.id,
    content: { ...brief, purpose: 'Introduce the line.' },
    created_at: '2026-10-15T03:00:01.000Z',
  };
  const creations: TalkCreationWorkspace = {
    creations: [current],
    selected: { brief: current.id },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations') {
      if (url.searchParams.get('lineage') === current.lineage_id)
        return route.fulfill({ json: { versions: [current, previous] } });
      return route.fulfill({ json: creations });
    }
    if (url.pathname === '/api/aurelius') return route.fulfill({ json: workspace() });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await expect(page.getByText(/Changing this: Aethelios Lifestyle launch · v2/)).toBeVisible();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Document view' })).toBeVisible();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Document preview' })).toContainText(
    'Introduce the line with a precise visual direction.',
  );
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Change Purpose' }).click();
  await expect(page.getByText('Changing this: Aethelios Lifestyle launch · v2 · Purpose')).toBeVisible();
  await page.getByText('Saved versions').click();
  await page.getByLabel('Compare with').selectOption(previous.id);
  await expect(page.getByText(/Purpose: “Introduce the line.” →/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download Markdown' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print / PDF' })).toBeVisible();
  await expect(page.getByText('Legacy Reserve')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('talk-elevation-document.png'),
    animations: 'disabled',
  });
});

test('Talk keeps a brief Purpose target when a design board is also selected', async ({ page }) => {
  const board = selectDesignDirection(lifestyleLaunchBoard(), 'direction-c');
  const briefId = '50000000-0000-4000-8000-000000000444';
  const boardId = '50000000-0000-4000-8000-000000000445';
  const creations: TalkCreationWorkspace = {
    creations: [
      {
        id: briefId,
        person_id: 'synthetic',
        conversation_id: conversation,
        source_turn_id: turn.id,
        lineage_id: briefId,
        version: 2,
        kind: 'brief',
        content: {
          title: 'Aethelios Lifestyle launch',
          purpose: 'Introduce the line.',
          audience: 'Founders',
          visualDirection: 'Obsidian and emerald',
          requirements: ['Phone-first'],
          unresolved: [],
        },
        predecessor_id: null,
        superseded_by: null,
        created_at: '2026-10-15T03:00:02.000Z',
      },
      {
        id: boardId,
        person_id: 'synthetic',
        conversation_id: conversation,
        source_turn_id: turn.id,
        lineage_id: boardId,
        version: 4,
        kind: 'board',
        content: board,
        predecessor_id: null,
        superseded_by: null,
        created_at: '2026-10-15T03:00:01.000Z',
      },
    ],
    selected: { brief: briefId, board: boardId },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations') return route.fulfill({ json: creations });
    if (url.pathname === '/api/aurelius') return route.fulfill({ json: workspace() });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await page.locator('.talk-creation-card[data-kind="brief"]').getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: 'Change Purpose' }).click();
  await expect(page.getByText('Changing this: Aethelios Lifestyle launch · v2 · Purpose')).toBeVisible();
  await expect(page.getByText('Changing this: Aethelios Lifestyle launch directions · v4 · Emerald Glass')).toHaveCount(0);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByText('Changing this: Aethelios Lifestyle launch · v2 · Purpose')).toHaveCount(0);
});

test('Talk drops a brief field target when the opened conversation changes', async ({ page }) => {
  const other = '30000000-0000-4000-8000-000000000446';
  const briefId = '50000000-0000-4000-8000-000000000446';
  const creations: TalkCreationWorkspace = {
    creations: [
      {
        id: briefId,
        person_id: 'synthetic',
        conversation_id: conversation,
        source_turn_id: turn.id,
        lineage_id: briefId,
        version: 2,
        kind: 'brief',
        content: {
          title: 'Aethelios Lifestyle launch',
          purpose: 'Introduce the line.',
          audience: 'Founders',
          visualDirection: 'Obsidian and emerald',
          requirements: ['Phone-first'],
          unresolved: [],
        },
        predecessor_id: null,
        superseded_by: null,
        created_at: '2026-10-15T03:00:02.000Z',
      },
    ],
    selected: { brief: briefId },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  const otherTurn: Turn = {
    ...turn,
    id: '40000000-0000-4000-8000-000000000446',
    conversation_id: other,
    user_text: 'Other work.',
    assistant_text: 'Labelled deterministic Talk fixture. This is a separate conversation.',
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations') {
      return route.fulfill({
        json: url.searchParams.get('conversationId') === conversation ? creations : {
          creations: [],
          selected: {},
          images: [],
          selectedImageId: null,
          canCreateImages: false,
          imageAccess: 'unavailable',
          attachmentProjectId: null,
        },
      });
    }
    if (url.pathname === '/api/aurelius') {
      const id = url.searchParams.get('conversationId');
      const current = id === other ? otherTurn : turn;
      return route.fulfill({
        json: {
          ...workspace(),
          conversations: [
            ...workspace().conversations,
            {
              id: other,
              person_id: 'synthetic',
              title: 'Other work',
              created_at: otherTurn.created_at,
              updated_at: otherTurn.created_at,
            },
          ],
          currentConversation: {
            id: current.conversation_id,
            person_id: 'synthetic',
            title: current.conversation_id === other ? 'Other work' : 'Aethelios Lifestyle launch',
            created_at: current.created_at,
            updated_at: current.created_at,
          },
          turns: [current],
        },
      });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('button', { name: 'Change Purpose' }).click();
  await expect(page.getByText('Changing this: Aethelios Lifestyle launch · v2 · Purpose')).toBeVisible();
  await page.getByRole('button', { name: 'Conversations', exact: true }).click();
  await page.locator('.conversation-list > li > button').filter({ hasText: 'Other work' }).click();
  await expect(page.getByText('Changing this: Aethelios Lifestyle launch · v2 · Purpose')).toHaveCount(0);
  await expect(page.locator('.talk-title').getByText('Other work')).toBeVisible();
});
