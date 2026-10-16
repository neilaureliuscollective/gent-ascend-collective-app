import { test, expect } from './fixtures';
import {
  lifestyleLaunchBoard,
  legacyReserveBoard,
} from '../../src/domains/talk-creation/design-board';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';
import type { TalkCreationWorkspace, TalkCreation } from '../../src/domains/talk-creation/schema';
const conversation = '30000000-0000-4000-8000-000000000031';
const turn: Turn = {
  id: '40000000-0000-4000-8000-000000000031',
  person_id: 'synthetic',
  conversation_id: conversation,
  user_text: 'Review these saved campaign studies.',
  assistant_text: 'Synthetic saved campaign studies and brief. No provider or project execution.',
  status: 'complete',
  model: 'fixture',
  context_included: false,
  prompt_version: 'fixture',
  feedback: null,
  created_at: '2026-10-15',
  finished_at: '2026-10-15',
};
const savedConversation = {
  id: conversation,
  person_id: 'synthetic',
  title: 'Campaign review fixture',
  created_at: turn.created_at,
  updated_at: turn.created_at,
};
const state: WorkspaceData = {
  ownerId: 'synthetic',
  configured: true,
  canChat: true,
  model: 'fixture',
  memories: [],
  actionProposals: [],
  context: {
    profile: {
      name: 'Synthetic',
      priority: 'Build',
      timezone: 'UTC',
      units: 'metric',
      updatedAt: '2026-10-15',
    },
    goal: null,
    memories: [],
  },
  conversations: [savedConversation],
  currentConversation: savedConversation,
  turns: [turn],
};
function creation(kind: 'board' | 'brief', content: TalkCreation['content']): TalkCreation {
  const id =
    kind === 'board'
      ? '50000000-0000-4000-8000-000000000031'
      : '50000000-0000-4000-8000-000000000032';
  return {
    id,
    person_id: 'synthetic',
    conversation_id: conversation,
    source_turn_id: turn.id,
    lineage_id: id,
    version: 1,
    kind,
    content,
    predecessor_id: null,
    superseded_by: null,
    created_at: turn.created_at,
  };
}
test('real Talk desktop detail panel preserves compositions and aligned semantic Preview lists', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const board = lifestyleLaunchBoard();
  const boardRow = creation('board', board);
  const briefRow = creation('brief', {
    title: 'A considered launch',
    purpose:
      'Create a considered daily ritual.\n\nPreserve the approved identity and review the creative.\n\n1. Confirm the identity\n2. Review the copy',
    audience: 'Founders who value deliberate choices.',
    visualDirection: 'Charcoal glass, emerald light and restrained gold.',
    requirements: [
      'Use the actual approved emblem.',
      'Label missing product photography.',
      'Review copy before publication.',
    ],
    unresolved: ['Launch date.'],
  });
  const creations: TalkCreationWorkspace = {
    creations: [boardRow, briefRow],
    selected: { board: boardRow.id, brief: briefRow.id },
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/aurelius/creations') {
      if (url.searchParams.has('direction'))
        return route.fulfill({
          json: {
            receipt: {
              digest: 'a'.repeat(64),
              content: {
                name: 'Warm Reserve',
                summary: 'Legacy fixture',
                copy: { title: 'Legacy fixture' },
              },
            },
            boardVersion: 1,
            selectedDirectionName: 'Warm Reserve',
            unsupported: [],
            imported: false,
          },
        });
      if (url.searchParams.has('lineage'))
        return route.fulfill({ json: { versions: [boardRow, briefRow] } });
      return route.fulfill({ json: creations });
    }
    if (url.pathname === '/api/aurelius') return route.fulfill({ json: state });
    return route.fulfill({ json: {} });
  });
  for (const [index, direction] of board.directions.entries()) {
    board.selectedDirectionId = direction.id;
    await page.goto(`/app/aethelios?conversation=${conversation}`);
    await page
      .locator('[data-kind="board"]')
      .getByRole('button', { name: 'Open', exact: true })
      .click();
    const panel = page.getByLabel('Reviewed work', { exact: true });
    await expect(panel).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const width = (await panel.boundingBox())!.width;
    expect(width).toBeGreaterThanOrEqual(400);
    expect(width).toBeLessThanOrEqual(421);
    const canvas = panel.locator('.talk-design-hero');
    await expect(canvas).toHaveAttribute('data-composition', direction.demo.kind);
    expect(
      (await canvas.evaluate((node) => getComputedStyle(node).gridTemplateColumns))
        .trim()
        .split(/\s+/),
    ).toHaveLength(1);
    expect(await canvas.evaluate((node) => parseFloat(getComputedStyle(node).paddingLeft))).toBe(
      20,
    );
    expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`talk-detail-desktop-${index + 1}.png`) });
    await panel.evaluate((node) => {
      const hero = node.querySelector('.talk-design-hero')!;
      node.scrollTop += hero.getBoundingClientRect().top - node.getBoundingClientRect().top - 12;
    });
    await page.screenshot({ path: info.outputPath(`talk-detail-canvas-${index + 1}.png`) });
  }
  await page
    .getByLabel('Reviewed work', { exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await page
    .locator('[data-kind="brief"]')
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  const panel = page.getByLabel('Reviewed work', { exact: true });
  const preview = panel.getByRole('article', { name: 'Document preview' });
  await expect(preview).toBeVisible();
  await expect(preview.locator('ul').first()).toHaveCSS('list-style-type', 'disc');
  await expect(preview.locator('ol')).toHaveCSS('list-style-type', 'decimal');
  const positions = await preview.evaluate((node) =>
    ['h1', 'p', 'ul', 'ol'].map(
      (selector) => node.querySelector(selector)!.getBoundingClientRect().left,
    ),
  );
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
  await page.screenshot({ path: info.outputPath('talk-preview-desktop-aligned.png') });
  await panel.evaluate((node) => {
    const list = node.querySelector('.talk-document-preview ul')!;
    node.scrollTop += list.getBoundingClientRect().top - node.getBoundingClientRect().top - 100;
  });
  await page.screenshot({ path: info.outputPath('talk-preview-desktop-lists.png') });
  // The unchanged historical Auth journey expects this truthful limitation.
  boardRow.content = legacyReserveBoard();
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await page
    .locator('[data-kind="board"]')
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await page
    .getByLabel('Reviewed work', { exact: true })
    .getByRole('button', { name: 'Review design transfer' })
    .click();
  await expect(
    page.getByLabel('Reviewed work', { exact: true }).getByText(/Hero-product demonstration/),
  ).toBeVisible();
});
