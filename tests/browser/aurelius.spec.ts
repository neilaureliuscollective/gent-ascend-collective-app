import { test, expect, type Page } from '@playwright/test';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';
async function setup(page: Page, mode: 'normal' | 'interrupted' | 'unconfigured' = 'normal') {
  const state: WorkspaceData = {
    conversations: [],
    turns: [],
    memories: [],
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
  await page.goto('/aurelius');
  await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
  return { state, sent };
}
test('saved conversation, safe formatting, feedback and return to history', async ({ page }) => {
  const { sent } = await setup(page);
  await page.getByLabel('Message Aurelius').fill('Help me choose a next step');
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
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
  await page
    .getByLabel('Saved conversations')
    .selectOption({ label: 'Help me choose a next step' });
  await expect(page.locator('.user-message')).toContainText('Help me choose a next step');
  await page.reload();
  await page
    .getByLabel('Saved conversations')
    .selectOption({ label: 'Help me choose a next step' });
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
  await page.getByLabel('What should Aurelius remember?').fill('Prefer brief answers');
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
  await page.getByLabel('Message Aurelius').fill('Keep this draft');
  await page.getByRole('button', { name: 'Send', exact: false }).click();
  await expect(page.locator('.aurelius-workspace [role=alert]')).toContainText(
    'before the save was confirmed',
  );
  await expect(page.getByLabel('Message Aurelius')).toHaveValue('Keep this draft');
  await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeDisabled();
  expect(sent[0]).toMatchObject({ includeContext: false });
  await expect(page.getByRole('status')).not.toContainText('Reply saved.');
});
test('missing model connection leaves memory and saved context usable', async ({ page }) => {
  await setup(page, 'unconfigured');
  await page.getByLabel('Message Aurelius').fill('A draft');
  await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeDisabled();
  await expect(
    page.getByText('Aurelius is waiting for its model connection.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Context', exact: true }).click();
  await expect(page.getByText('A meaningful first step', { exact: true })).toBeVisible();
});
for (const width of [360, 768, 1440])
  test(`Aurelius conversation at ${width}px`, async ({ page }) => {
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

test('the global Aurelius panel uses the same saved conversation service', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Aurelius', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
  await dialog.getByLabel('Message Aurelius').fill('From Command');
  await dialog.getByRole('button', { name: 'Send', exact: false }).click();
  await expect(dialog.getByRole('status')).toContainText('Reply saved.');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Aurelius', exact: true }).click();
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
  await page.getByLabel('Message Aurelius').fill('A thought worth keeping');
  await page.getByRole('button', { name: 'Send', exact: false }).click();
  await page.getByRole('button', { name: 'Stop reply' }).click();
  await expect(page.locator('.aurelius-workspace [role=alert]')).toContainText('Reply stopped');
  await expect(page.getByLabel('Message Aurelius')).toHaveValue('A thought worth keeping');
  await expect(page.getByRole('button', { name: 'Send', exact: false })).toBeDisabled();
});
