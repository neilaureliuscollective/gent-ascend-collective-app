import { test, expect, type Page } from './fixtures';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';
import type { TalkCreationWorkspace } from '../../src/domains/talk-creation/schema';

const owner = 'synthetic';
const conversationA = '30000000-0000-4000-8000-000000000011';
const conversationB = '30000000-0000-4000-8000-000000000012';
const turnA: Turn = {
  id: '40000000-0000-4000-8000-000000000011',
  person_id: owner,
  conversation_id: conversationA,
  user_text: 'Help me develop a premium brand and website.',
  assistant_text: 'I framed a brief from what you asked.',
  status: 'complete',
  model: 'synthetic',
  context_included: false,
  prompt_version: 'fixture',
  feedback: null,
  created_at: '2026-10-13T00:00:00.000Z',
  finished_at: '2026-10-13T00:00:01.000Z',
};
const turnB: Turn = {
  ...turnA,
  id: '40000000-0000-4000-8000-000000000012',
  conversation_id: conversationB,
  user_text: 'Start a different conversation.',
  assistant_text: 'This conversation is empty of saved work.',
};

function brief(conversationId: string, title: string): TalkCreationWorkspace['creations'][number] {
  return {
    id: conversationId === conversationA ? '50000000-0000-4000-8000-000000000011' : '50000000-0000-4000-8000-000000000021',
    person_id: owner,
    conversation_id: conversationId,
    source_turn_id: conversationId === conversationA ? turnA.id : turnB.id,
    lineage_id: conversationId === conversationA ? '50000000-0000-4000-8000-000000000011' : '50000000-0000-4000-8000-000000000021',
    version: 1,
    kind: 'brief',
    content: {
      title,
      purpose: 'A premium personal brand and website.',
      audience: 'Founders',
      visualDirection: 'Obsidian and gold',
      requirements: ['Phone first'],
      unresolved: ['Typeface'],
    },
    predecessor_id: null,
    superseded_by: null,
    created_at: '2026-10-13T00:00:01.000Z',
  };
}

function workspaceFor(id: string, turns: Turn[]): WorkspaceData {
  return {
    ownerId: owner,
    conversations: [
      {
        id: conversationA,
        person_id: owner,
        title: 'Premium brand',
        created_at: turnA.created_at,
        updated_at: turnA.created_at,
      },
      {
        id: conversationB,
        person_id: owner,
        title: 'Other work',
        created_at: turnB.created_at,
        updated_at: turnB.created_at,
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
      id,
      person_id: owner,
      title: id === conversationA ? 'Premium brand' : 'Other work',
      created_at: turnA.created_at,
      updated_at: turnA.created_at,
    },
  };
}

function emptyWorkspace(): TalkCreationWorkspace {
  return {
    creations: [],
    selected: {},
    images: [],
    selectedImageId: null,
    canCreateImages: true,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  };
}

async function settleTalk(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
}

test('handoff retries reuse one identity and preparedAt', async ({ page }) => {
  const posts: Array<Record<string, unknown>> = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push(body);
      if (posts.length === 1) {
        return route.abort();
      }
      return route.fulfill({
        json: { id: body.id, content: { imported: false }, recovered: true },
      });
    }
    if (url.pathname === '/api/aurelius/creations')
      return route.fulfill({
        json: {
          creations: [brief(conversationA, 'Reserve brand')],
          selected: { brief: '50000000-0000-4000-8000-000000000011' },
          images: [],
          selectedImageId: null,
          canCreateImages: false,
          imageAccess: 'unavailable',
          attachmentProjectId: null,
        },
      });
    if (url.pathname === '/api/aurelius')
      return route.fulfill({ json: workspaceFor(conversationA, [turnA]) });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  const panel = page.getByRole('complementary', { name: 'Reviewed work' });
  await panel.getByLabel('Architect idea').fill('A premium brand and website.');
  await panel.getByRole('button', { name: 'Prepare for Architect', exact: true }).click();
  await expect(panel.getByText(/Failed to fetch|could not be saved/i)).toBeVisible();
  await panel.getByRole('button', { name: 'Prepare for Architect', exact: true }).click();
  await expect(page.getByText(/Prepared for Architect/)).toBeVisible();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[0]?.id).toBe(posts[1]?.id);
  expect(posts[0]?.preparedAt).toBe(posts[1]?.preparedAt);
  expect(posts[0]?.idea).toBe(posts[1]?.idea);
});

test('reload recovers a pending save that the server already committed', async ({
  page,
}, testInfo) => {
  const posts: Array<Record<string, unknown>> = [];
  const pendingId = '70000000-0000-4000-8000-000000000011';
  await page.addInitScript(
    ({ ownerId, conversationId, id }) => {
      sessionStorage.setItem(
        `aethelios-talk-saves-v1:${ownerId}`,
        JSON.stringify({
          entries: [
            {
              id,
              conversationId,
              intent: 'revision',
              payload: {
                id,
                conversationId,
                kind: 'brief',
                predecessorId: '50000000-0000-4000-8000-000000000011',
                sourceTurnId: '40000000-0000-4000-8000-000000000011',
                content: {
                  title: 'Recovered brief',
                  purpose: 'Saved before the response returned.',
                  audience: 'Founders',
                  visualDirection: 'Obsidian and gold',
                  requirements: ['Phone first'],
                  unresolved: ['Typeface'],
                },
              },
              at: Date.now(),
            },
          ],
        }),
      );
    },
    { ownerId: owner, conversationId: conversationA, id: pendingId },
  );
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push(body);
      return route.fulfill({ json: { id: body.id, recovered: true } });
    }
    if (url.pathname === '/api/aurelius/creations')
      return route.fulfill({
        json: {
          creations: [brief(conversationA, 'Reserve brand')],
          selected: { brief: '50000000-0000-4000-8000-000000000011' },
          images: [],
          selectedImageId: null,
          canCreateImages: false,
          imageAccess: 'unavailable',
          attachmentProjectId: null,
        },
      });
    if (url.pathname === '/api/aurelius')
      return route.fulfill({ json: workspaceFor(conversationA, [turnA]) });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await expect(page.locator('.aurelius-notice').filter({ hasText: 'Recovered the previous save.' })).toBeVisible();
  await expect.poll(() => posts).toEqual([
    expect.objectContaining({ id: pendingId, kind: 'brief' }),
  ]);
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await settleTalk(page);
  await page.screenshot({
    path: testInfo.outputPath('talk-recovery-phone.png'),
    animations: 'disabled',
  });
});

test('a late image result from conversation A cannot fill a new conversation', async ({ page }) => {
  let releaseA: () => void = () => {};
  const holdA = new Promise<void>((resolve) => {
    releaseA = resolve;
  });
  let aComplete = false;
  let aRequested = false;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations') {
      const conversationId = url.searchParams.get('conversationId');
      if (conversationId === conversationA) {
        aRequested = true;
        await holdA;
        return route.fulfill({
          json: {
            creations: [brief(conversationA, 'Reserve brand')],
            selected: { brief: '50000000-0000-4000-8000-000000000011' },
            images: [
              {
                id: '60000000-0000-4000-8000-000000000011',
                conversation_id: conversationA,
                operation: 'image.create',
                prompt: 'A restrained crest on obsidian',
                status: aComplete ? 'complete' : 'running',
                project_id: '80000000-0000-4000-8000-000000000011',
                version_id: aComplete ? '80000000-0000-4000-8000-000000000012' : null,
                base_version_id: null,
                created_at: '2026-10-13T00:00:02.000Z',
              },
            ],
            selectedImageId: null,
            canCreateImages: true,
            imageAccess: 'unavailable',
            attachmentProjectId: null,
          },
        });
      }
      return route.fulfill({ json: emptyWorkspace() });
    }
    if (url.pathname === '/api/aurelius') {
      const conversationId = url.searchParams.get('conversationId');
      if (conversationId === conversationB)
        return route.fulfill({ json: workspaceFor(conversationB, [turnB]) });
      if (!conversationId)
        return route.fulfill({
          json: { ...workspaceFor(conversationA, []), currentConversation: null, turns: [] },
        });
      return route.fulfill({ json: workspaceFor(conversationA, [turnA]) });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await expect.poll(() => aRequested).toBe(true);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.locator('.talk-title').filter({ hasText: 'New conversation' })).toBeVisible();
  aComplete = true;
  releaseA();
  await expect(page.locator('.talk-title').filter({ hasText: 'New conversation' })).toBeVisible();
  await expect(page.getByText('Reserve brand')).toHaveCount(0);
  await expect(page.getByText('A restrained crest on obsidian')).toHaveCount(0);
  await page.getByRole('button', { name: 'Conversations', exact: true }).click();
  await page.locator('.conversation-list > li > button').filter({ hasText: 'Other work' }).click();
  await expect(page.locator('.talk-title').filter({ hasText: 'New conversation' })).toHaveCount(0);
  await expect(page.getByText('Reserve brand')).toHaveCount(0);
  await expect(page.getByText('A restrained crest on obsidian')).toHaveCount(0);
  await page.getByRole('button', { name: 'Conversations', exact: true }).click();
  await page.locator('.conversation-list > li > button').filter({ hasText: 'Premium brand' }).click();
  await expect(page.getByRole('heading', { name: 'Reserve brand', level: 3 })).toBeVisible();
  await expect(page.getByText('Saved in Studio.')).toBeVisible();
});

test('New conversation does not recover conversation A into an empty screen', async ({ page }) => {
  const pendingId = '70000000-0000-4000-8000-000000000051';
  const posts: Array<Record<string, unknown>> = [];
  const gets: string[] = [];
  let releaseA: () => void = () => {};
  const holdA = new Promise<void>((resolve) => {
    releaseA = resolve;
  });
  let aGetSettled = false;
  let signedOut = false;
  await page.addInitScript(
    ({ ownerId, conversationId, id }) => {
      sessionStorage.setItem(
        `aethelios-talk-saves-v1:${ownerId}`,
        JSON.stringify({
          entries: [
            {
              id,
              conversationId,
              intent: 'revision',
              payload: {
                id,
                conversationId,
                kind: 'brief',
                predecessorId: '50000000-0000-4000-8000-000000000011',
                sourceTurnId: '40000000-0000-4000-8000-000000000011',
                content: {
                  title: 'Pending from A',
                  purpose: 'Must not appear on a new conversation.',
                  audience: 'Founders',
                  visualDirection: 'Obsidian and gold',
                  requirements: ['Phone first'],
                  unresolved: ['Typeface'],
                },
              },
              at: Date.now(),
            },
          ],
        }),
      );
    },
    { ownerId: owner, conversationId: conversationA, id: pendingId },
  );
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push(body);
      return route.fulfill({ json: { id: body.id, recovered: true } });
    }
    if (url.pathname === '/api/aurelius/creations') {
      const conversationId = url.searchParams.get('conversationId') ?? '';
      gets.push(conversationId);
      if (conversationId === conversationA) {
        await holdA;
        aGetSettled = true;
        return route.fulfill({
          json: {
            creations: [brief(conversationA, 'Reserve brand')],
            selected: { brief: '50000000-0000-4000-8000-000000000011' },
            images: [
              {
                id: '60000000-0000-4000-8000-000000000011',
                conversation_id: conversationA,
                operation: 'image.create',
                prompt: 'A restrained crest on obsidian',
                status: 'running',
                project_id: '80000000-0000-4000-8000-000000000011',
                version_id: null,
                base_version_id: null,
                created_at: '2026-10-13T00:00:02.000Z',
              },
            ],
            selectedImageId: null,
            canCreateImages: true,
            imageAccess: 'unavailable',
            attachmentProjectId: null,
          },
        });
      }
      return route.fulfill({ json: emptyWorkspace() });
    }
    if (url.pathname === '/api/aurelius') {
      if (signedOut) return route.fulfill({ status: 401, json: { error: 'Sign in required.' } });
      const conversationId = url.searchParams.get('conversationId');
      if (conversationId === conversationB)
        return route.fulfill({ json: workspaceFor(conversationB, [turnB]) });
      if (!conversationId)
        return route.fulfill({
          json: { ...workspaceFor(conversationA, []), currentConversation: null, turns: [] },
        });
      return route.fulfill({ json: workspaceFor(conversationA, [turnA]) });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await expect.poll(() => gets.filter((id) => id === conversationA).length).toBe(1);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.locator('.talk-title').filter({ hasText: 'New conversation' })).toBeVisible();
  releaseA();
  await expect.poll(() => aGetSettled).toBe(true);
  await expect(page.locator('.talk-title').filter({ hasText: 'New conversation' })).toBeVisible();
  await expect(page.getByText('Pending from A')).toHaveCount(0);
  await expect(page.getByText('Reserve brand')).toHaveCount(0);
  await expect(page.locator('.aurelius-notice').filter({ hasText: 'Recovered the previous save.' })).toHaveCount(0);
  await expect.poll(() => posts.length).toBe(0);
  expect(gets.filter((id) => id === conversationA)).toHaveLength(1);
  await page.getByRole('button', { name: 'Conversations', exact: true }).click();
  await page.locator('.conversation-list > li > button').filter({ hasText: 'Other work' }).click();
  await expect(page.getByText('Reserve brand')).toHaveCount(0);
  await expect.poll(() => posts.length).toBe(0);
  signedOut = true;
  await page.getByRole('button', { name: 'Conversations', exact: true }).click();
  await page.locator('.conversation-list > li > button').filter({ hasText: 'Premium brand' }).click();
  await expect(page.locator('.aurelius-notice').filter({ hasText: 'Recovered the previous save.' })).toHaveCount(0);
  await expect.poll(() => posts.length).toBe(0);
  const leftover = await page.evaluate(
    (ownerId) =>
      JSON.parse(sessionStorage.getItem(`aethelios-talk-saves-v1:${ownerId}`) ?? 'null') as {
        entries?: Array<{ id: string }>;
      } | null,
    owner,
  );
  expect(leftover?.entries?.some((entry) => entry.id === pendingId)).toBe(true);
  signedOut = false;
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await expect(page.locator('.aurelius-notice').filter({ hasText: 'Recovered the previous save.' })).toBeVisible();
  await expect.poll(() => posts).toEqual([expect.objectContaining({ id: pendingId, kind: 'brief' })]);
});

test('a pending save for another owner is not replayed', async ({ page }) => {
  const posts: Array<Record<string, unknown>> = [];
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'aethelios-talk-saves-v1:other-owner',
      JSON.stringify({
        entries: [
          {
            id: '70000000-0000-4000-8000-000000000041',
            conversationId: '30000000-0000-4000-8000-000000000011',
            intent: 'revision',
            payload: { id: '70000000-0000-4000-8000-000000000041', kind: 'brief' },
            at: Date.now(),
          },
        ],
      }),
    );
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations' && route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: { id: '70000000-0000-4000-8000-000000000041' } });
    }
    if (url.pathname === '/api/aurelius/creations')
      return route.fulfill({
        json: {
          creations: [brief(conversationA, 'Reserve brand')],
          selected: { brief: '50000000-0000-4000-8000-000000000011' },
          images: [],
          selectedImageId: null,
          canCreateImages: false,
          imageAccess: 'unavailable',
          attachmentProjectId: null,
        },
      });
    if (url.pathname === '/api/aurelius')
      return route.fulfill({ json: workspaceFor(conversationA, [turnA]) });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await expect(page.getByRole('heading', { name: 'Reserve brand', level: 3 })).toBeVisible();
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await expect(page.locator('.aurelius-notice').filter({ hasText: 'Recovered the previous save.' })).toHaveCount(0);
  expect(posts).toEqual([]);
});

test('a stale generated proposal remains reviewable after reload', async ({
  page,
}, testInfo) => {
  const candidate = {
    ...brief(conversationA, 'Generated proposal'),
    id: '50000000-0000-4000-8000-000000000031',
    version: 3,
    candidate: true,
    predecessor_id: '50000000-0000-4000-8000-000000000012',
  };
  const current = {
    ...brief(conversationA, 'Manual edit'),
    id: '50000000-0000-4000-8000-000000000012',
    version: 2,
    predecessor_id: '50000000-0000-4000-8000-000000000011',
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations') {
      if (url.searchParams.get('lineage'))
        return route.fulfill({ json: { versions: [current, candidate] } });
      return route.fulfill({
        json: {
          creations: [current, candidate],
          selected: { brief: current.id },
          images: [],
          selectedImageId: null,
          canCreateImages: false,
          imageAccess: 'unavailable',
          attachmentProjectId: null,
        },
      });
    }
    if (url.pathname === '/api/aurelius')
      return route.fulfill({ json: workspaceFor(conversationA, [turnA]) });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await expect(page.getByRole('heading', { name: 'Manual edit', level: 3 }).first()).toBeVisible();
  await expect(page.getByText('Proposal · not applied')).toBeVisible();
  await page.getByRole('button', { name: 'Open', exact: true }).nth(1).click();
  const panel = page.getByRole('complementary', { name: 'Reviewed work' });
  await expect(panel.getByText('Proposal · not applied')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Keep as new version', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Keep this version', exact: true })).toHaveCount(0);
  await settleTalk(page);
  await page.screenshot({
    path: testInfo.outputPath('talk-recovery-unfolded.png'),
    animations: 'disabled',
  });
});

test('a failed recovery leaves the original pending save and keeps chat usable', async ({ page }) => {
  const pendingId = '70000000-0000-4000-8000-000000000021';
  await page.addInitScript(
    ({ ownerId, conversationId, id }) => {
      sessionStorage.setItem(
        `aethelios-talk-saves-v1:${ownerId}`,
        JSON.stringify({
          entries: [
            {
              id,
              conversationId,
              intent: 'revision',
              payload: {
                id,
                conversationId,
                kind: 'brief',
                predecessorId: '50000000-0000-4000-8000-000000000011',
                sourceTurnId: '40000000-0000-4000-8000-000000000011',
                content: {
                  title: 'Unconfirmed brief',
                  purpose: 'Saved before the network failed.',
                  audience: 'Founders',
                  visualDirection: 'Obsidian and gold',
                  requirements: ['Phone first'],
                  unresolved: ['Typeface'],
                },
              },
              at: Date.now(),
            },
          ],
        }),
      );
    },
    { ownerId: owner, conversationId: conversationA, id: pendingId },
  );
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations' && route.request().method() === 'POST')
      return route.fulfill({ status: 503, json: { error: 'Creation could not be saved.' } });
    if (url.pathname === '/api/aurelius/creations')
      return route.fulfill({
        json: {
          creations: [brief(conversationA, 'Reserve brand')],
          selected: { brief: '50000000-0000-4000-8000-000000000011' },
          images: [],
          selectedImageId: null,
          canCreateImages: false,
          imageAccess: 'unavailable',
          attachmentProjectId: null,
        },
      });
    if (url.pathname === '/api/aurelius')
      return route.fulfill({ json: workspaceFor(conversationA, [turnA]) });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await expect(
    page.locator('.aurelius-notice').filter({ hasText: 'A previous save did not confirm. It is still pending.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  const leftover = await page.evaluate(
    (ownerId) =>
      JSON.parse(sessionStorage.getItem(`aethelios-talk-saves-v1:${ownerId}`) ?? 'null') as {
        entries?: Array<{ id: string; conversationId: string }>;
      } | null,
    owner,
  );
  expect(leftover?.entries?.some((entry) => entry.id === pendingId && entry.conversationId === conversationA)).toBe(
    true,
  );
});

test('a recovered save that conflicts with newer work stays pending and does not overwrite', async ({
  page,
}) => {
  const pendingId = '70000000-0000-4000-8000-000000000031';
  await page.addInitScript(
    ({ ownerId, conversationId, id }) => {
      sessionStorage.setItem(
        `aethelios-talk-saves-v1:${ownerId}`,
        JSON.stringify({
          entries: [
            {
              id,
              conversationId,
              intent: 'revision',
              payload: {
                id,
                conversationId,
                kind: 'brief',
                predecessorId: '50000000-0000-4000-8000-000000000011',
                sourceTurnId: '40000000-0000-4000-8000-000000000011',
                content: {
                  title: 'Older pending edit',
                  purpose: 'This should not overwrite the newer version.',
                  audience: 'Founders',
                  visualDirection: 'Obsidian and gold',
                  requirements: ['Phone first'],
                  unresolved: ['Typeface'],
                },
              },
              at: Date.now(),
            },
          ],
        }),
      );
    },
    { ownerId: owner, conversationId: conversationA, id: pendingId },
  );
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/creations' && route.request().method() === 'POST')
      return route.fulfill({
        status: 409,
        json: { error: 'This version changed. Reload the saved work before editing again.' },
      });
    if (url.pathname === '/api/aurelius/creations')
      return route.fulfill({
        json: {
          creations: [
            {
              ...brief(conversationA, 'Manual edit'),
              id: '50000000-0000-4000-8000-000000000012',
              version: 2,
              predecessor_id: '50000000-0000-4000-8000-000000000011',
            },
          ],
          selected: { brief: '50000000-0000-4000-8000-000000000012' },
          images: [],
          selectedImageId: null,
          canCreateImages: false,
          imageAccess: 'unavailable',
          attachmentProjectId: null,
        },
      });
    if (url.pathname === '/api/aurelius')
      return route.fulfill({ json: workspaceFor(conversationA, [turnA]) });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await expect(page.getByRole('heading', { name: 'Manual edit', level: 3 })).toBeVisible();
  await expect(
    page.getByText('A recovered save conflicts with newer work. Open the work to resolve it.'),
  ).toBeVisible();
  const leftover = await page.evaluate(
    (ownerId) =>
      JSON.parse(sessionStorage.getItem(`aethelios-talk-saves-v1:${ownerId}`) ?? 'null') as {
        entries?: Array<{ id: string }>;
      } | null,
    owner,
  );
  expect(leftover?.entries?.some((entry) => entry.id === pendingId)).toBe(true);
});
