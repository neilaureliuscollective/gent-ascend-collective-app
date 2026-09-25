import { test, expect, type Page } from '@playwright/test';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';
async function setup(page: Page, mode: 'normal' | 'interrupted' | 'unconfigured' = 'normal') {
  const state: WorkspaceData = {
    conversations: [],
    turns: [],
    memories: [],
    actionProposals: [],
    context: {
      profile: {
        name: 'Synthetic Founder',
        priority: 'Build deliberately',
        timezone: 'UTC',
        units: 'metric',
        updatedAt: '2026-09-20',
      },
      goal: {
        title: 'A meaningful first step',
        nextStep: 'Plan tomorrow',
        reason: 'Consistency',
        updatedAt: '2026-09-20',
      },
      memories: [],
    },
    canChat: true,
    configured: mode !== 'unconfigured',
    model: 'synthetic-test-model',
  };
  const sent: unknown[] = [];
  await page.route('**/api/aurelius**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = method === 'GET' ? null : request.postDataJSON();
    if (url.pathname.endsWith('/chat')) {
      sent.push(body);
      const row: Turn = {
        id: body.requestId,
        person_id: 'synthetic',
        conversation_id: body.conversationId,
        user_text: body.text,
        assistant_text:
          'Start with **one deliberate action**.\n\n- Name the outcome.\n- Choose the next step.\n\n<script>window.compromised=true</script>\n![tracking](https://example.com/pixel.png)',
        status: 'complete',
        model: 'synthetic-test-model',
        context_included: body.includeContext,
        prompt_version: 'fixture',
        feedback: null,
        created_at: '2026-09-20T12:00:00Z',
        finished_at: '2026-09-20T12:00:01Z',
      };
      state.turns.push(row);
      if (!state.conversations.length)
        state.conversations.push({
          id: body.conversationId,
          person_id: 'synthetic',
          title: body.text,
          created_at: row.created_at,
          updated_at: row.created_at,
        });
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body:
          JSON.stringify({ type: 'delta', text: row.assistant_text }) +
          '\n' +
          (mode === 'interrupted' ? '' : JSON.stringify({ type: 'saved', turn: row }) + '\n'),
      });
    }
    if (url.pathname.endsWith('/memory')) {
      if (method === 'DELETE') {
        state.memories = state.memories.filter((m) => m.id !== body.id);
      } else {
        state.memories = state.memories.filter((m) => m.id !== body.id);
        state.memories.push({
          ...body,
          person_id: 'synthetic',
          source: 'user',
          confirmed_at: '2026-09-20T12:00:00Z',
          version: body.version + 1,
        });
      }
      return route.fulfill({ json: { saved: true } });
    }
    if (url.pathname.endsWith('/feedback')) {
      state.turns = state.turns.map((t) =>
        t.id === body.id ? { ...t, feedback: body.feedback } : t,
      );
      return route.fulfill({ json: { saved: true } });
    }
    if (method === 'DELETE') {
      state.turns = [];
      state.conversations = [];
      return route.fulfill({ json: { saved: true } });
    }
    return route.fulfill({
      json: { ...state, turns: url.searchParams.has('conversationId') ? state.turns : [] },
    });
  });
  await page.goto('/aethelios');
  await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
  return { state, sent };
}
test('saved conversation, safe formatting, feedback and return to history', async ({ page }) => {
  const { sent } = await setup(page);
  await page.getByLabel('Message Aethelios').fill('Help me choose a next step');
  await page.getByRole('button', { name: 'Send', exact: false }).click();
  await expect(page.getByRole('status')).toContainText('Reply saved.');
  await expect(page.locator('.message-markdown strong')).toHaveText('one deliberate action');
  await expect(page.locator('.message-markdown img')).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, 'compromised'))).toBe(false);
  expect(sent).toHaveLength(1);
  await page.getByRole('button', { name: 'Helpful', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Helpful', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Start a conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
  await page.getByRole('button', { name: /Help me choose a next step/ }).click();
  await expect(page.locator('.user-message')).toContainText('Help me choose a next step');
  await page.reload();
  await page.getByRole('button', { name: /Help me choose a next step/ }).click();
  await expect(page.locator('.message-markdown strong')).toBeVisible();
  await page.getByRole('button', { name: 'Delete conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
});
test('memory requires explicit confirmation and can be corrected and forgotten', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await page.getByLabel('What should Aethelios remember?').fill('Prefer brief answers');
  await page.getByRole('button', { name: 'Confirm and remember' }).click();
  await expect(page.locator('.memory-list')).toContainText('Prefer brief answers');
  await page.getByRole('button', { name: 'Edit memory', exact: true }).click();
  await page.getByLabel('Correct this memory').fill('Prefer direct answers');
  await page.getByRole('button', { name: 'Confirm correction' }).click();
  await expect(page.locator('.memory-list')).toContainText('Prefer direct answers');
  await expect(page.locator('.memory-list')).not.toContainText('Prefer brief answers');
  await page.getByRole('button', { name: 'Forget', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm forget' }).click();
  await expect(page.locator('.memory-list li')).toHaveCount(0);
});
test('context opt-out reaches the server and incomplete streams never say saved', async ({
  page,
}) => {
  const { sent } = await setup(page, 'interrupted');
  await page.getByLabel('Use personal context').uncheck();
  await page.getByLabel('Message Aethelios').fill('Keep this draft');
  await page.getByRole('button', { name: 'Send', exact: false }).click();
  await expect(page.locator('.aurelius-workspace [role=alert]')).toContainText(
    'before the save was confirmed',
  );
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('Keep this draft');
  await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeDisabled();
  expect(sent[0]).toMatchObject({ includeContext: false });
  await expect(page.getByRole('status')).not.toContainText('Reply saved.');
});
test('missing model connection leaves memory and saved context usable', async ({ page }) => {
  await setup(page, 'unconfigured');
  await page.getByLabel('Message Aethelios').fill('A draft');
  await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeDisabled();
  await expect(
    page.getByText('Aethelios is waiting for its model connection.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Context', exact: true }).click();
  await expect(page.getByText('A meaningful first step', { exact: true })).toBeVisible();
});
for (const width of [360, 768, 1440])
  test(`Aethelios conversation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setup(page);
    await page.evaluate(() => {
      const marker = document.createElement('p');
      marker.textContent = 'SYNTHETIC BROWSER TEST · NO LIVE MODEL';
      marker.style.cssText = 'color:#d6ae62;font-size:11px;text-align:center';
      document.querySelector('.aurelius-surface')?.prepend(marker);
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeInViewport();
    await page.screenshot({ path: `test-results/aurelius-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
test('anonymous API and hostile origins fail closed', async ({ request }) => {
  expect((await request.get('/api/aurelius')).status()).toBe(401);
  expect(
    (
      await request.post('/api/aurelius/chat', {
        headers: { Origin: 'https://attacker.example' },
        data: { text: 'Try' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/aurelius/memory', {
        headers: { Origin: 'http://127.0.0.1:3100' },
        data: {
          id: '50000000-0000-4000-8000-000000000001',
          content: 'Not authorized',
          kind: 'fact',
          version: 0,
        },
      })
    ).status(),
  ).toBe(401);
});

test('the global Aethelios panel uses the same saved conversation service', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Aethelios', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
  await dialog.getByLabel('Message Aethelios').fill('From Command');
  await dialog.getByRole('button', { name: 'Send', exact: false }).click();
  await expect(dialog.getByRole('status')).toContainText('Reply saved.');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Aethelios', exact: true }).click();
  await dialog.getByLabel('Saved conversations').selectOption({ label: 'From Command' });
  await expect(dialog.locator('.user-message')).toContainText('From Command');
});
test('stopping a request retains the draft and requires checking saved state', async ({ page }) => {
  await setup(page);
  await page.route('**/api/aurelius/chat', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      await route.fulfill({ contentType: 'application/x-ndjson', body: '' });
    } catch {
      /* request was cancelled */
    }
  });
  await page.getByLabel('Message Aethelios').fill('A thought worth keeping');
  await page.getByRole('button', { name: 'Send', exact: false }).click();
  await page.getByRole('button', { name: 'Stop reply' }).click();
  await expect(page.locator('.aurelius-workspace [role=alert]')).toContainText('Reply stopped');
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('A thought worth keeping');
  await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeDisabled();
});

for (const width of [360, 768, 1440]) {
  test(`disconnected workspace can be explored safely at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/aurelius') && request.method() !== 'GET')
        writes.push(request.url());
    });
    await page.goto('/aethelios');
    await expect(page.getByText('Sign in to use your Aethelios workspace.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeInViewport();
    await page.screenshot({ path: `test-results/aurelius-preview-${width}.png`, fullPage: true });
    await page.getByLabel('Message Aethelios').fill('An unsent thought');
    await page.getByLabel('Message Aethelios').press('Control+Enter');
    await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Memory', exact: true }).click();
    await expect(page.getByLabel('What should Aethelios remember?')).toBeDisabled();
    await expect(page.getByText('Preview · sign in to confirm and save memories.')).toBeVisible();
    await page
      .locator('.memory-space form')
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.getByRole('button', { name: 'Context', exact: true }).click();
    await expect(page.getByText('Preview · no personal data loaded')).toBeVisible();
    await page.screenshot({ path: `test-results/aurelius-context-${width}.png`, fullPage: true });
    await page.getByText('Understand the boundaries').click();
    await expect(
      page.getByText('Live web research, voice, file uploads', { exact: false }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Conversation', exact: true }).click();
    await expect(page.getByLabel('Message Aethelios')).toHaveValue('An unsent thought');
    expect(writes).toEqual([]);
  });
}

for (const width of [360, 1440]) {
  test(`conversation library filters and opens saved history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const { state } = await setup(page);
    await page.getByLabel('Message Aethelios').fill('Direction for the week');
    await page.getByRole('button', { name: 'Send', exact: false }).click();
    await expect(page.getByRole('status')).toContainText('Reply saved.');
    state.conversations.push({
      id: '50000000-0000-4000-8000-000000000008',
      person_id: 'synthetic',
      title: 'A different thought',
      created_at: '2026-09-20',
      updated_at: '2026-09-20',
    });
    await page.reload();
    const library = page.getByRole('complementary', { name: 'Conversation library' });
    if (width < 1101) await library.getByRole('button', { name: /^Conversations/ }).click();
    await library.getByLabel('Search conversation titles').fill('nothing matches');
    await expect(library.getByText('No matching titles.')).toBeVisible();
    await library.getByLabel('Search conversation titles').fill('DIRECTION');
    await expect(library.locator('.conversation-list button')).toHaveCount(1);
    await library.getByRole('button', { name: /Direction for the week/ }).click();
    await expect(page.locator('.user-message')).toContainText('Direction for the week');
    if (width < 1101)
      await expect(library.getByLabel('Search conversation titles')).not.toBeVisible();
    await page.getByRole('button', { name: 'Context', exact: true }).click();
    await expect(page.getByText('Personal context is on for your next message')).toBeVisible();
    await expect(page.getByText('A meaningful first step', { exact: true })).toBeVisible();
  });
}

test('conversation deep link resumes the selected history without sending', async ({ page }) => {
  const { state, sent } = await setup(page);
  const id = '62000000-0000-4000-8000-000000000001';
  state.conversations.push({
    id,
    person_id: 'synthetic',
    title: 'A saved thought',
    created_at: '2026-09-21',
    updated_at: '2026-09-21',
  });
  state.turns.push({
    id: '62000000-0000-4000-8000-000000000002',
    person_id: 'synthetic',
    conversation_id: id,
    user_text: 'Remember the small next step',
    assistant_text: 'Synthetic saved response.',
    status: 'complete',
    model: 'synthetic-test-model',
    context_included: false,
    prompt_version: 'fixture',
    feedback: null,
    created_at: '2026-09-21',
    finished_at: '2026-09-21',
  });
  await page.goto(`/aethelios?conversation=${id}`);
  await expect(page.getByText('Synthetic saved response.', { exact: true })).toBeVisible();
  expect(sent).toEqual([]);
});
