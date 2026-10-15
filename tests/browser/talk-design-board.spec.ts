import { test, expect } from './fixtures';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';
import type { TalkCreationWorkspace } from '../../src/domains/talk-creation/schema';
import { legacyReserveBoard } from '../../src/domains/talk-creation/design-board';

const conversation = '30000000-0000-4000-8000-000000000031';
const turn: Turn = {
  id: '40000000-0000-4000-8000-000000000031',
  person_id: 'synthetic',
  conversation_id: conversation,
  user_text: 'Give me three visual directions for Legacy Reserve.',
  assistant_text: 'Three labelled directions are on the board. Select one and adjust it here.',
  status: 'complete',
  model: 'synthetic',
  context_included: false,
  prompt_version: 'fixture',
  feedback: null,
  created_at: '2026-10-14T00:00:00.000Z',
  finished_at: '2026-10-14T00:00:01.000Z',
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
      profile: { name: 'Synthetic', priority: 'Build', timezone: 'UTC', units: 'metric', updatedAt: '2026-10-14' },
      goal: null,
      memories: [],
    },
    conversations: [
      {
        id: conversation,
        person_id: 'synthetic',
        title: 'Legacy Reserve',
        created_at: turn.created_at,
        updated_at: turn.created_at,
      },
    ],
    currentConversation: {
      id: conversation,
      person_id: 'synthetic',
      title: 'Legacy Reserve',
      created_at: turn.created_at,
      updated_at: turn.created_at,
    },
    turns: [turn],
  };
}

test('renders three interactive Legacy Reserve directions and updates the sample without a paid call', async ({
  page,
}, testInfo) => {
  const board = legacyReserveBoard();
  const creations: TalkCreationWorkspace = {
    creations: [
      {
        id: '50000000-0000-4000-8000-000000000031',
        person_id: 'synthetic',
        conversation_id: conversation,
        source_turn_id: turn.id,
        lineage_id: '50000000-0000-4000-8000-000000000031',
        version: 1,
        kind: 'board',
        content: board,
        predecessor_id: null,
        superseded_by: null,
        created_at: '2026-10-14T00:00:01.000Z',
      },
    ],
    selected: { board: '50000000-0000-4000-8000-000000000031' },
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
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('tab', { name: /Warm Reserve/ })).toBeVisible();
  await expect(page.getByText('Demonstration packaging — not a product photograph')).toBeVisible();
  await page.getByRole('tab', { name: /Emerald Glass/ }).click();
  await expect(page.getByRole('heading', { name: 'A glass reading of the line.' })).toBeVisible();
  for (const [name, size] of [
    ['phone', { width: 390, height: 844 }],
    ['fold', { width: 768, height: 884 }],
    ['desktop', { width: 1440, height: 900 }],
  ] as const) {
    await page.setViewportSize(size);
    await page.locator('.talk-design-board').evaluate((board) => {
      const scroll = board.closest('.conversation-scroll');
      if (!(scroll instanceof HTMLElement)) return;
      const top =
        board.getBoundingClientRect().top -
        scroll.getBoundingClientRect().top +
        scroll.scrollTop;
      scroll.scrollTop = Math.max(0, top - 8);
    });
    await expect(page.getByRole('tab', { name: /Graphite Chamber/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Warm Reserve/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Emerald Glass/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A glass reading of the line.' })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`talk-design-board-${name}.png`),
      animations: 'disabled',
    });
  }
});
