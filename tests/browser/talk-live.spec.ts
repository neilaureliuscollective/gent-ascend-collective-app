import { test, expect, type Page } from './fixtures';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';

const owner = '60000000-0000-4000-8000-000000000001';

async function fakeTransport(page: Page) {
  await page.addInitScript(() => {
    const tracks = [
      {
        enabled: true,
        stop() {
          (window as unknown as { micStopped: boolean }).micStopped = true;
        },
        addEventListener() {},
      },
    ];
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => ({ getTracks: () => tracks, getAudioTracks: () => tracks }),
    });
    class PC {
      localDescription = { sdp: 'v=0\r\na=synthetic-test-offer' };
      connectionState = 'new';
      onconnectionstatechange: (() => void) | null = null;
      channel = {
        readyState: 'open',
        sent: [] as string[],
        onmessage: null as ((event: { data: string }) => void) | null,
        onopen: null as (() => void) | null,
        onclose: null as (() => void) | null,
        close() {},
        send(raw: string) {
          this.sent.push(raw);
        },
      };
      addTrack() {}
      async createOffer() {
        return { type: 'offer', sdp: this.localDescription.sdp };
      }
      async setLocalDescription() {}
      async setRemoteDescription() {
        this.connectionState = 'connected';
        this.channel.onopen?.();
        (window as unknown as { voiceChannel: PC['channel'] }).voiceChannel = this.channel;
      }
      createDataChannel() {
        return this.channel;
      }
      close() {
        this.connectionState = 'closed';
      }
      async getStats() {
        return new Map();
      }
    }
    Object.defineProperty(window, 'RTCPeerConnection', { value: PC });
  });
}

function workspace(turns: Turn[] = [], conversationId: string | null = null): WorkspaceData {
  return {
    ownerId: owner,
    conversations: conversationId
      ? [
          {
            id: conversationId,
            person_id: owner,
            title: 'Spoken conversation',
            created_at: '2026-10-14T18:00:00Z',
            updated_at: '2026-10-14T18:00:00Z',
          },
        ]
      : [],
    turns,
    memories: [],
    actionProposals: [],
    context: {
      profile: {
        name: 'Synthetic Founder',
        priority: 'Build deliberately',
        timezone: 'UTC',
        units: 'metric',
        updatedAt: '2026-10-14',
      },
      goal: null,
      memories: [],
    },
    canChat: true,
    configured: true,
    model: 'synthetic-test-model',
    currentConversation: conversationId
      ? {
          id: conversationId,
          person_id: owner,
          title: 'Spoken conversation',
          created_at: '2026-10-14T18:00:00Z',
          updated_at: '2026-10-14T18:00:00Z',
        }
      : null,
  };
}

async function openTalkVoice(page: Page) {
  await page.goto('http://127.0.0.1:3102/app/aethelios?mode=talk-live');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  // Keyboard consent keeps this transcript fixture independent of the separately owned phone panel styling.
  const consent = page.getByRole('checkbox', { name: /I consent/ });
  await consent.focus();
  await page.keyboard.press('Space');
  await expect(consent).toBeChecked();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
}

test('New voice adopts one Talk conversation and shares the composer and timeline', async ({
  page,
}) => {
  await fakeTransport(page);
  const chats: unknown[] = [];
  let selected: string | null = null;
  const saved: Turn[] = [];
  await page.route('**/api/aurelius**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/chat')) {
      chats.push(route.request().postDataJSON());
      return route.fulfill({ contentType: 'application/x-ndjson', body: '' });
    }
    const id = url.searchParams.get('conversationId');
    return route.fulfill({ json: workspace(saved, id) });
  });
  await page.route('**/api/aethelios/live/receipt**', async (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: {
        ownerId: owner,
        conversationId: url.searchParams.get('conversationId'),
        sessionId: url.searchParams.get('sessionId'),
        bindings: [{ providerItemId: 'spoken-1', providerResponseId: null, turnId: 'spoken-1' }],
        turns: [
          { id: 'spoken-1', user_text: 'Spoken in Talk', created_at: '2026-10-14T18:24:00Z' },
        ],
      },
    });
  });
  await page.route('**/api/aethelios/live', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { jobs: [] } });
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { ended: true } });
    const body = route.request().postDataJSON() as { conversationId?: string };
    selected = body.conversationId ?? null;
    return route.fulfill({
      json: {
        answer: 'v=0\r\na=synthetic-answer',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
  });
  await openTalkVoice(page);
  await expect
    .poll(() => selected)
    .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  await expect.poll(() => new URL(page.url()).searchParams.get('conversation')).toBe(selected);
  await expect(page.getByRole('dialog', { name: 'Aethelios Live', exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const channel = (
      window as unknown as { voiceChannel: { onmessage: (event: { data: string }) => void } }
    ).voiceChannel;
    for (const id of ['c' + '0'.repeat(25), 'ctx_legacy'])
      channel.onmessage({
        data: JSON.stringify({
          type: 'conversation.item.added',
          item: {
            id,
            role: 'user',
            content: [{ text: 'SYNTHETIC INTERNAL SEED MUST STAY HIDDEN' }],
          },
        }),
      });
  });
  await expect(page.locator('.live-provisional')).toHaveCount(0);

  await page.evaluate(() => {
    (
      window as unknown as { voiceChannel: { onmessage: (event: { data: string }) => void } }
    ).voiceChannel.onmessage({
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'spoken-1',
        transcript: 'Spoken in Talk',
      }),
    });
  });
  await expect(page.locator('.live-provisional')).toContainText('Spoken in Talk');
  await page.evaluate(() => {
    const channel = (
      window as unknown as { voiceChannel: { onmessage: (event: { data: string }) => void } }
    ).voiceChannel;
    for (const type of ['conversation.item.created', 'conversation.item.added'])
      channel.onmessage({
        data: JSON.stringify({
          type,
          item: {
            id: 'c' + '1'.repeat(25),
            role: 'user',
            content: [{ text: 'SYNTHETIC INTERNAL UPDATE MUST STAY HIDDEN' }],
          },
        }),
      });
  });
  await expect(page.locator('.live-provisional')).toHaveCount(1);

  await page.getByLabel('Message Aethelios').fill('Typed during voice');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { voiceChannel: { sent: string[] } }).voiceChannel.sent,
      ),
    )
    .toEqual(expect.arrayContaining([expect.stringContaining('Typed during voice')]));
  expect(chats).toHaveLength(0);
  saved.push({
    id: 'spoken-1',
    person_id: owner,
    conversation_id: selected!,
    user_text: 'Spoken in Talk',
    assistant_text: 'Saved spoken reply',
    status: 'complete',
    model: 'gpt-realtime',
    context_included: false,
    prompt_version: 'fixture',
    feedback: null,
    created_at: '2026-10-14T18:24:00Z',
    finished_at: '2026-10-14T18:24:01Z',
  });
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(page.locator('.user-message')).toContainText('Spoken in Talk');
  await expect(page.locator('.live-provisional')).toHaveCount(0);
  await expect(page.getByText(/SYNTHETIC INTERNAL/)).toHaveCount(0);
  await expect(page.locator('.user-message')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.user-message')).toContainText('Spoken in Talk');
  await expect(page.locator('.user-message')).toHaveCount(1);
  await expect(page.locator('.live-provisional')).toHaveCount(0);
  await expect(page.getByText(/SYNTHETIC INTERNAL/)).toHaveCount(0);
});

test('connection failure stays in Talk with retry and leaves the composer usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeTransport(page);
  const chats: unknown[] = [];
  await page.route('**/api/aurelius**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/chat')) {
      chats.push(route.request().postDataJSON());
      const body = route.request().postDataJSON() as { requestId: string; text: string };
      const row: Turn = {
        id: body.requestId,
        person_id: owner,
        conversation_id: body.requestId,
        user_text: body.text,
        assistant_text: 'Typed reply after voice failed.',
        status: 'complete',
        model: 'synthetic-test-model',
        context_included: false,
        prompt_version: 'fixture',
        feedback: null,
        created_at: '2026-10-14T18:24:00Z',
        finished_at: '2026-10-14T18:24:01Z',
      };
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body:
          JSON.stringify({ type: 'delta', text: row.assistant_text }) +
          '\n' +
          JSON.stringify({ type: 'saved', turn: row }) +
          '\n',
      });
    }
    return route.fulfill({ json: workspace() });
  });
  await page.route('**/api/aethelios/live', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { jobs: [] } });
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { ended: true } });
    return route.fulfill({
      status: 503,
      json: {
        error:
          'Voice control could not attach to the provider session. Your text workspace remains available.',
        detail: { stage: 'sideband', category: 'timeout' },
      },
    });
  });
  await openTalkVoice(page);
  await expect(page.locator('.connection-note')).toContainText('Voice control could not attach');
  await expect(page.getByRole('button', { name: 'Retry voice', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Aethelios Live', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Persistent Aethelios voice controls' }),
  ).toHaveCount(0);
  await page.getByLabel('Message Aethelios').fill('Continue in text');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Reply saved.');
  expect(chats).toHaveLength(1);
  await page.screenshot({
    path: 'test-results/talk-live-failure-phone-390.png',
    fullPage: true,
  });
});

test('a delayed workspace body cannot rewrite the current conversation after switch', async ({
  page,
}) => {
  await fakeTransport(page);
  let selected: string | null = null;
  const saved: Turn[] = [];
  let releaseHeldWorkspace = () => {};
  const held = new Promise<void>((resolve) => {
    releaseHeldWorkspace = resolve;
  });
  let holdNextWorkspace = false;
  await page.route('**/api/aurelius**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/chat')) {
      return route.fulfill({ contentType: 'application/x-ndjson', body: '' });
    }
    const id = url.searchParams.get('conversationId');
    if (holdNextWorkspace && id === selected && url.pathname === '/api/aurelius') {
      holdNextWorkspace = false;
      await held;
      return route.fulfill({
        json: workspace(
          [
            {
              id: 'stale-1',
              person_id: owner,
              conversation_id: selected!,
              user_text: 'Stale spoken turn',
              assistant_text: 'Stale saved reply',
              status: 'complete',
              model: 'gpt-realtime',
              context_included: false,
              prompt_version: 'fixture',
              feedback: null,
              created_at: '2026-10-14T18:24:00Z',
              finished_at: '2026-10-14T18:24:01Z',
            },
          ],
          selected,
        ),
      });
    }
    return route.fulfill({ json: workspace(saved, id) });
  });
  await page.route('**/api/aethelios/live/receipt**', async (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: {
        ownerId: owner,
        conversationId: url.searchParams.get('conversationId'),
        sessionId: url.searchParams.get('sessionId'),
        bindings: [{ providerItemId: 'spoken-1', providerResponseId: null, turnId: 'spoken-1' }],
        turns: [
          { id: 'spoken-1', user_text: 'Spoken in Talk', created_at: '2026-10-14T18:24:00Z' },
        ],
      },
    });
  });
  await page.route('**/api/aethelios/live', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { jobs: [] } });
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { ended: true } });
    const body = route.request().postDataJSON() as { conversationId?: string };
    selected = body.conversationId ?? null;
    return route.fulfill({
      json: {
        answer: 'v=0\r\na=synthetic-answer',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
  });
  await openTalkVoice(page);
  await expect.poll(() => selected).toBeTruthy();
  await page.evaluate(() => {
    (
      window as unknown as { voiceChannel: { onmessage: (event: { data: string }) => void } }
    ).voiceChannel.onmessage({
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'spoken-1',
        transcript: 'Spoken in Talk',
      }),
    });
  });
  await expect(page.locator('.live-provisional')).toContainText('Spoken in Talk');
  holdNextWorkspace = true;
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await page.getByRole('button', { name: 'Conversations', exact: true }).click();
  await page.getByRole('button', { name: 'Start a conversation' }).click();
  await expect(page.locator('.talk-title')).toContainText('New conversation');
  releaseHeldWorkspace();
  await expect(page.locator('.user-message')).toHaveCount(0);
  await expect(page.getByText('Stale spoken turn')).toHaveCount(0);
  await expect(page.getByText('Stale saved reply')).toHaveCount(0);
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('');
});
