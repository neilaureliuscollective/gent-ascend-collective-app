import { test, expect, type Page } from './fixtures';
import type { Turn, WorkspaceData } from '../../src/domains/intelligence/types';

const owner = '60000000-0000-4000-8000-000000000001';
const conversationA = '30000000-0000-4000-8000-00000000000a';
const conversationB = '30000000-0000-4000-8000-00000000000b';

function turn(id: string, conversation: string, user: string, created: string): Turn {
  return {
    id,
    person_id: owner,
    conversation_id: conversation,
    user_text: user,
    assistant_text: `${user} reply`,
    status: 'complete',
    model: 'synthetic',
    context_included: false,
    prompt_version: 'fixture',
    feedback: null,
    created_at: created,
    finished_at: created,
  };
}

const latestA = turn('a-latest', conversationA, 'Alpha latest', '2026-10-16T12:00:00.000Z');
const olderA = turn(
  'a-older',
  conversationA,
  'Alpha older history that must not leak',
  '2026-10-16T09:00:00.000Z',
);
const latestB = turn('b-latest', conversationB, 'Beta latest', '2026-10-16T12:30:00.000Z');

function workspace(turns: Turn[], conversationId: string | null, older = false): WorkspaceData {
  const current =
    conversationId === conversationA ? latestA : conversationId === conversationB ? latestB : null;
  return {
    ownerId: owner,
    configured: true,
    canChat: true,
    model: 'synthetic-test-model',
    memories: [],
    actionProposals: [],
    context: {
      profile: {
        name: 'Synthetic',
        priority: 'Build',
        timezone: 'UTC',
        units: 'metric',
        updatedAt: '2026-10-16',
      },
      goal: null,
      memories: [],
    },
    conversations: [
      {
        id: conversationA,
        person_id: owner,
        title: 'Alpha thread',
        created_at: '2026-10-16T09:00:00.000Z',
        updated_at: '2026-10-16T12:00:00.000Z',
      },
      {
        id: conversationB,
        person_id: owner,
        title: 'Beta thread',
        created_at: '2026-10-16T12:30:00.000Z',
        updated_at: '2026-10-16T12:30:00.000Z',
      },
    ],
    currentConversation: current
      ? {
          id: current.conversation_id,
          person_id: owner,
          title: current.conversation_id === conversationA ? 'Alpha thread' : 'Beta thread',
          created_at: current.created_at,
          updated_at: current.created_at,
        }
      : null,
    turns,
    hasOlderTurns: older,
  };
}

async function openTalk(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/app/aethelios?conversation=${conversationA}`);
  await expect(page.locator('.user-message')).toContainText('Alpha latest');
}

async function openLibrary(page: Page) {
  await page.getByRole('button', { name: 'Conversations', exact: true }).click();
}

test('delayed older history from A cannot prepend into B or New', async ({ page }) => {
  let releaseOlder = () => {};
  const held = new Promise<void>((resolve) => {
    releaseOlder = resolve;
  });
  let olderLoads = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/chat') {
      return route.fulfill({ contentType: 'application/x-ndjson', body: '' });
    }
    if (url.pathname === '/api/aurelius') {
      const id = url.searchParams.get('conversationId');
      const before = url.searchParams.get('before');
      if (before && id === conversationA) {
        olderLoads += 1;
        await held;
        return route.fulfill({ json: workspace([olderA], conversationA, false) });
      }
      if (id === conversationB)
        return route.fulfill({ json: workspace([latestB], conversationB, false) });
      if (id === conversationA)
        return route.fulfill({ json: workspace([latestA], conversationA, true) });
      return route.fulfill({ json: workspace([], null, false) });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await openTalk(page);
  await page.getByRole('button', { name: 'Load older messages', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Loading…', exact: true })).toBeVisible();
  await openLibrary(page);
  await page.locator('.conversation-list > li > button').filter({ hasText: 'Beta thread' }).click();
  await expect(page.locator('.user-message')).toContainText('Beta latest');
  await expect(page.getByText('Alpha latest')).toHaveCount(0);
  releaseOlder();
  await expect.poll(() => olderLoads).toBe(1);
  await expect(page.locator('.user-message')).toContainText('Beta latest');
  await expect(page.getByText('Alpha older history that must not leak')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Loading…', exact: true })).toHaveCount(0);
  await openLibrary(page);
  await page
    .locator('.conversation-list > li > button')
    .filter({ hasText: 'Alpha thread' })
    .click();
  await expect(page.locator('.user-message')).toContainText('Alpha latest');
  await expect(page.getByText('Alpha older history that must not leak')).toHaveCount(0);
  await openLibrary(page);
  await page.getByRole('button', { name: 'Start a conversation', exact: true }).click();
  await expect(page.locator('.talk-title')).toContainText('New conversation');
  await expect(page.getByText('Alpha older history that must not leak')).toHaveCount(0);
});

test('rapid A → B → A ignores the first delayed older load', async ({ page }) => {
  let firstRelease = () => {};
  let secondRelease = () => {};
  const firstHeld = new Promise<void>((resolve) => {
    firstRelease = resolve;
  });
  const secondHeld = new Promise<void>((resolve) => {
    secondRelease = resolve;
  });
  let olderLoads = 0;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/chat') {
      return route.fulfill({ contentType: 'application/x-ndjson', body: '' });
    }
    if (url.pathname === '/api/aurelius') {
      const id = url.searchParams.get('conversationId');
      const before = url.searchParams.get('before');
      if (before && id === conversationA) {
        olderLoads += 1;
        await (olderLoads === 1 ? firstHeld : secondHeld);
        return route.fulfill({ json: workspace([olderA], conversationA, false) });
      }
      if (id === conversationB)
        return route.fulfill({ json: workspace([latestB], conversationB, false) });
      if (id === conversationA)
        return route.fulfill({ json: workspace([latestA], conversationA, true) });
      return route.fulfill({ json: workspace([], null, false) });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await openTalk(page);
  await page.getByRole('button', { name: 'Load older messages', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Loading…', exact: true })).toBeVisible();
  await openLibrary(page);
  await page.locator('.conversation-list > li > button').filter({ hasText: 'Beta thread' }).click();
  await expect(page.locator('.user-message')).toContainText('Beta latest');
  await openLibrary(page);
  await page
    .locator('.conversation-list > li > button')
    .filter({ hasText: 'Alpha thread' })
    .click();
  await expect(page.locator('.user-message')).toContainText('Alpha latest');
  await page.getByRole('button', { name: 'Load older messages', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Loading…', exact: true })).toBeVisible();
  firstRelease();
  await expect.poll(() => olderLoads).toBe(2);
  await expect(page.getByRole('button', { name: 'Loading…', exact: true })).toBeVisible();
  await expect(page.getByText('Alpha older history that must not leak', { exact: true })).toHaveCount(
    0,
  );
  secondRelease();
  await expect(
    page.locator('.user-message').filter({ hasText: 'Alpha older history that must not leak' }),
  ).toHaveCount(1);
  await expect(page.locator('.user-message').filter({ hasText: 'Alpha latest' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Loading…', exact: true })).toHaveCount(0);
});

test('cancelling Switch keeps the current draft, selection and focus', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/chat') {
      return route.fulfill({ contentType: 'application/x-ndjson', body: '' });
    }
    if (url.pathname === '/api/aurelius') {
      const id = url.searchParams.get('conversationId');
      if (id === conversationB)
        return route.fulfill({ json: workspace([latestB], conversationB, false) });
      return route.fulfill({ json: workspace([latestA], conversationA, false) });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await openTalk(page);
  const field = page.getByLabel('Message Aethelios', { exact: true });
  await field.fill('Keep this unsent thought');
  await field.evaluate((node) => {
    const input = node as HTMLTextAreaElement;
    input.setSelectionRange(5, 9);
  });
  await openLibrary(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('.conversation-list > li > button').filter({ hasText: 'Beta thread' }).click();
  await expect(field).toHaveValue('Keep this unsent thought');
  await expect(page.locator('.user-message')).toContainText('Alpha latest');
  await expect(page.getByText('Beta latest')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close Conversations', exact: true }).click();
  await field.focus();
  await expect
    .poll(async () =>
      field.evaluate((node) => {
        const input = node as HTMLTextAreaElement;
        return { start: input.selectionStart, end: input.selectionEnd };
      }),
    )
    .toEqual({ start: 5, end: 9 });
});

test('Edit last message cancel restores the previous draft and caret', async ({ page }) => {
  const chats: Array<Record<string, unknown>> = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/chat') {
      chats.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ contentType: 'application/x-ndjson', body: '' });
    }
    if (url.pathname === '/api/aurelius') {
      const id = url.searchParams.get('conversationId');
      if (id === conversationB)
        return route.fulfill({ json: workspace([latestB], conversationB, false) });
      return route.fulfill({ json: workspace([latestA], conversationA, false) });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await openTalk(page);
  const field = page.getByLabel('Message Aethelios', { exact: true });
  await field.fill('Keep this unsent thought');
  await field.evaluate((node) => {
    const input = node as HTMLTextAreaElement;
    input.setSelectionRange(5, 9);
  });
  await page.getByRole('button', { name: 'Edit and resend', exact: true }).click();
  await expect(field).toHaveValue('Alpha latest');
  await expect(page.getByText('Editing your last message')).toBeVisible();
  await page
    .locator('.revision-notice')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(field).toHaveValue('Keep this unsent thought');
  await expect
    .poll(async () =>
      field.evaluate((node) => {
        const input = node as HTMLTextAreaElement;
        return { start: input.selectionStart, end: input.selectionEnd };
      }),
    )
    .toEqual({ start: 5, end: 9 });
  expect(chats).toHaveLength(0);
});

test('edit then switch then send does not carry the previous revision', async ({ page }) => {
  const chats: Array<Record<string, unknown>> = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/chat') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      chats.push(body);
      const saved = turn(
        String(body.requestId),
        String(body.conversationId),
        String(body.text),
        new Date().toISOString(),
      );
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body:
          JSON.stringify({ type: 'delta', text: 'Saved on B' }) +
          '\n' +
          JSON.stringify({ type: 'saved', turn: { ...saved, assistant_text: 'Saved on B' } }) +
          '\n',
      });
    }
    if (url.pathname === '/api/aurelius') {
      const id = url.searchParams.get('conversationId');
      if (id === conversationB)
        return route.fulfill({ json: workspace([latestB], conversationB, false) });
      if (id === conversationA)
        return route.fulfill({ json: workspace([latestA], conversationA, false) });
      return route.fulfill({ json: workspace([], null, false) });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  await openTalk(page);
  await page.getByRole('button', { name: 'Edit and resend', exact: true }).click();
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue('Alpha latest');
  await openLibrary(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.conversation-list > li > button').filter({ hasText: 'Beta thread' }).click();
  await expect(page.locator('.user-message')).toContainText('Beta latest');
  await expect(page.getByText('Editing your last message')).toHaveCount(0);
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Fresh thought on Beta');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => chats.length).toBe(1);
  expect(chats[0]?.sourceTurnId).toBeUndefined();
  expect(chats[0]?.conversationId).toBe(conversationB);
});
