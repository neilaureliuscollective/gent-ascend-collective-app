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
