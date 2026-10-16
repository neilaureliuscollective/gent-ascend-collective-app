import { test, expect, type Page } from './fixtures';
import type { Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';
import {
  lifestyleLaunchBoard,
  selectDesignDirection,
} from '../../src/domains/talk-creation/design-board';

const owner = '60000000-0000-4000-8000-000000000001';
const project = '10000000-0000-4000-8000-000000000001';
const reference = '10000000-0000-4000-8000-000000000002';
const creationId = '50000000-0000-4000-8000-000000000441';
const conversation = '30000000-0000-4000-8000-000000000441';
const longFilename = 'supercalifragilistic-lifestyle-product-world-hero-reference.png';

type VoiceHost = {
  micGets: number;
  peerCount: number;
  micStopped: boolean;
  blockPlayback: boolean;
  micTracks: { enabled: boolean }[];
  voiceChannel: { onmessage: ((event: { data: string }) => void) | null };
};

async function fakeTransport(page: Page) {
  await page.addInitScript(() => {
    const host = window as unknown as VoiceHost;
    host.micGets = 0;
    host.peerCount = 0;
    host.micStopped = false;
    host.blockPlayback = false;
    const tracks = [
      {
        enabled: true,
        stop() {
          host.micStopped = true;
        },
        addEventListener() {},
      },
    ];
    host.micTracks = tracks;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        host.micGets += 1;
        return { getTracks: () => tracks, getAudioTracks: () => tracks };
      },
    });
    HTMLMediaElement.prototype.play = function () {
      if (host.blockPlayback) return Promise.reject(new Error('blocked'));
      return Promise.resolve();
    };
    class PC {
      localDescription = { sdp: 'v=0\r\na=synthetic-test-offer' };
      connectionState = 'new';
      onconnectionstatechange: (() => void) | null = null;
      ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
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
      constructor() {
        host.peerCount += 1;
      }
      addTrack() {}
      async createOffer() {
        return { type: 'offer', sdp: this.localDescription.sdp };
      }
      async setLocalDescription() {}
      async setRemoteDescription() {
        this.connectionState = 'connected';
        this.channel.onopen?.();
        host.voiceChannel = this.channel;
        this.ontrack?.({ streams: [new MediaStream()] });
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
            created_at: '2026-10-16T18:00:00Z',
            updated_at: '2026-10-16T18:00:00Z',
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
        updatedAt: '2026-10-16',
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
          created_at: '2026-10-16T18:00:00Z',
          updated_at: '2026-10-16T18:00:00Z',
        }
      : null,
  };
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  slack = 0.5,
) {
  return (
    a.x + slack < b.x + b.width &&
    a.x + a.width > b.x + slack &&
    a.y + slack < b.y + b.height &&
    a.y + a.height > b.y + slack
  );
}

async function assertPointerTarget(control: Locator, viewport: { width: number; height: number }) {
  const box = (await control.boundingBox())!;
  const name =
    (await control.getAttribute('aria-label')) || ((await control.textContent()) ?? '').trim();
  expect(box.width, name).toBeGreaterThanOrEqual(44);
  expect(box.height, name).toBeGreaterThanOrEqual(44);
  expect(box.x, `${name} left`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${name} top`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${name} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${name} bottom`).toBeLessThanOrEqual(viewport.height + 1);
  const parentClip = await control.evaluate((node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    let ancestor = node.parentElement;
    while (ancestor && ancestor !== document.body) {
      const style = getComputedStyle(ancestor);
      const clip =
        style.overflow === 'hidden' || style.overflowY === 'hidden' || style.overflowX === 'hidden';
      if (clip) {
        const box = ancestor.getBoundingClientRect();
        if (
          rect.top < box.top - 2 ||
          rect.bottom > box.bottom + 2 ||
          rect.left < box.left - 2 ||
          rect.right > box.right + 2
        )
          return `${ancestor.className || ancestor.tagName} t${(rect.top - box.top).toFixed(1)} b${(box.bottom - rect.bottom).toFixed(1)} l${(rect.left - box.left).toFixed(1)} r${(box.right - rect.right).toFixed(1)}`;
      }
      ancestor = ancestor.parentElement;
    }
    return '';
  });
  expect(parentClip, name).toBe('');
  if (await control.isEnabled()) await control.click({ trial: true });
  const points = [
    [box.x + box.width / 2, box.y + box.height / 2],
    [box.x + box.width / 2, box.y + 4],
    [box.x + box.width / 2, box.y + box.height - 4],
    [box.x + 4, box.y + box.height / 2],
    [box.x + box.width - 4, box.y + box.height / 2],
  ] as const;
  for (const point of points) {
    const hit = await control.evaluate((node: HTMLElement, [x, y]: readonly [number, number]) => {
      const target = document.elementFromPoint(x, y);
      return target === node || node.contains(target)
        ? ''
        : (target as HTMLElement)?.outerHTML?.slice(0, 160) || 'null';
    }, point);
    expect(hit, `${name} @ ${point.join(',')}`).toBe('');
  }
}

async function startCombinedVoice(page: Page, original: Buffer) {
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeEnabled();
  await expect(page.locator('.talk-selection-summary-text')).toContainText(
    'Lifestyle product world',
  );
  const choose = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await (
    await choose
  ).setFiles({
    name: longFilename,
    mimeType: 'image/png',
    buffer: original,
  });
  await expect(page.getByRole('button', { name: 'Remove image', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(dock.locator('.live-compact-presence .im-status')).toHaveText('Listening');
  return dock;
}

async function prepareTalkVoice(page: Page, original: Buffer) {
  let selected: string | null = conversation;
  const live = {
    jobs: [] as {
      id: string;
      task: string;
      coworker: string | null;
      status: string;
      result: string;
      duration_ms: number | null;
    }[],
    starts: 0,
    ends: 0,
    cleanupWorks: true,
  };
  const history: Turn[] = Array.from({ length: 8 }, (_, index) => ({
    id: `synthetic-turn-${index}`,
    person_id: owner,
    conversation_id: 'pending',
    user_text: `Earlier spoken note ${index + 1}`,
    assistant_text: `Saved conversation response ${index + 1}: keep this timeline readable.`,
    status: 'complete',
    model: 'synthetic-test-model',
    context_included: false,
    prompt_version: 'fixture',
    feedback: null,
    created_at: '2026-10-16T18:00:00Z',
    finished_at: '2026-10-16T18:00:01Z',
  }));
  await page.route('**/api/aurelius**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/aurelius/attachments') {
      const body = route.request().postDataJSON();
      if (body.action === 'prepare') {
        return route.fulfill({
          json: {
            id: reference,
            projectId: project,
            path: `synthetic/${project}/${reference}.png`,
            token: 'synthetic-only',
            url: 'https://storage-fixture.test',
            publishableKey: 'synthetic-public-only',
          },
        });
      }
      if (body.action === 'complete')
        return route.fulfill({ json: { id: reference, projectId: project } });
      if (body.action === 'studio')
        return route.fulfill({
          json: {
            projectId: project,
            referenceId: reference,
            href: `/app/studio?project=${project}&reference=${reference}`,
          },
        });
    }
    if (url.pathname === '/api/aurelius/creations') {
      const conversationId = url.searchParams.get('conversationId') || selected;
      const board = selectDesignDirection(lifestyleLaunchBoard(), 'direction-c');
      return route.fulfill({
        json: {
          creations: [
            {
              id: creationId,
              person_id: owner,
              conversation_id: conversationId,
              source_turn_id: history[0]?.id,
              lineage_id: creationId,
              version: 1,
              kind: 'board',
              content: { ...board, title: 'Lifestyle product world' },
              predecessor_id: null,
              superseded_by: null,
              created_at: '2026-10-16T18:00:01.000Z',
            },
          ],
          selected: { board: creationId },
          images: [],
          selectedImageId: null,
          canCreateImages: false,
          imageAccess: 'unavailable',
          attachmentProjectId: project,
        },
      });
    }
    if (url.pathname.endsWith('/chat'))
      return route.fulfill({ contentType: 'application/x-ndjson', body: '' });
    const id = url.searchParams.get('conversationId') || selected;
    const turns = id ? history.map((turn) => ({ ...turn, conversation_id: id })) : [];
    return route.fulfill({ json: workspace(turns, id) });
  });
  await page.route('https://storage-fixture.test/**', async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'PUT, OPTIONS',
        },
      });
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: { Key: `aethelios-studio/synthetic/${project}/${reference}.png` },
    });
  });
  await page.route('**/api/studio/image**', (route) =>
    route.fulfill({ contentType: 'image/png', body: original }),
  );
  await page.route(/\/api\/aethelios\/live(?:\?|$)/, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { jobs: live.jobs } });
    if (route.request().method() === 'DELETE') {
      live.ends += 1;
      return route.fulfill({ json: { ended: live.cleanupWorks } });
    }
    live.starts += 1;
    const body = route.request().postDataJSON() as { conversationId?: string };
    selected = body.conversationId ?? null;
    return route.fulfill({
      json: {
        answer: 'v=0\r\na=synthetic-answer',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
  });
  return { selected: () => selected, live };
}

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'fold', width: 884, height: 690 },
  { name: 'desktop', width: 1440, height: 900 },
];

test.use({ video: { mode: 'on' } });

test('combined voice dock, selected work and attachment keep reading space', async ({
  page,
}, testInfo) => {
  testInfo.annotations.push({
    type: 'transport',
    description:
      'Mocked voice transport and Talk fixtures, not a physical device or live OpenAI call.',
  });
  const original = await readFile('public/brand/gent-ascend-master.png');
  await fakeTransport(page);
  const prepared = await prepareTalkVoice(page, original);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `http://127.0.0.1:3102/app/aethelios?mode=talk-live&conversation=${conversation}`,
  );
  const dock = await startCombinedVoice(page, original);
  await expect.poll(() => prepared.selected()).toBe(conversation);
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue('');
  await expect(dock.locator('[aria-label="Expand voice"] .live-call-action-caption')).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(dock.locator('.live-compact-presence .im-status')).toHaveText('Listening');
    const composer = page.locator('.aurelius-composer');
    const transcript = page.locator('.conversation-scroll');
    const region = page.locator('.aurelius-compose-region');
    await expect
      .poll(async () => (await transcript.boundingBox())?.height ?? 0)
      .toBeGreaterThan(viewport.height * 0.28);
    expect((await region.boundingBox())!.height).toBeLessThan(viewport.height * 0.52);
    expect((await composer.boundingBox())!.height).toBeLessThan(260);
    expect(await dock.evaluate((node) => node.scrollHeight - node.clientHeight <= 1)).toBe(true);
    const filename = page.locator('.talk-image-preview span').first();
    const remove = page.getByRole('button', { name: 'Remove image', exact: true });
    const studio = page.getByRole('button', { name: 'Use in Studio', exact: true });
    const add = page.getByRole('button', { name: 'Add image', exact: true });
    for (const control of [
      dock.getByRole('button', { name: 'Mute microphone', exact: true }),
      dock.getByRole('button', { name: 'End session', exact: true }),
      dock.getByRole('button', { name: 'Expand voice', exact: true }),
      add,
      remove,
      studio,
      page.getByRole('button', { name: 'Expand writing space', exact: true }),
      page.getByRole('button', { name: 'Send', exact: true }),
    ])
      await assertPointerTarget(control, viewport);
    const nameBox = (await filename.boundingBox())!;
    const removeBox = (await remove.boundingBox())!;
    const studioBox = (await studio.boundingBox())!;
    expect(rectsOverlap(nameBox, removeBox)).toBe(false);
    expect(rectsOverlap(nameBox, studioBox)).toBe(false);
    expect(rectsOverlap(removeBox, studioBox)).toBe(false);
    await expect(filename).toBeVisible();
    expect(await filename.evaluate((node) => node.scrollWidth > node.clientWidth + 1)).toBe(true);
    await page.getByLabel('Image attached · details', { exact: true }).click();
    await expect(page.locator('.talk-image-filename')).toHaveText(longFilename);
    await page.getByLabel('Image attached · details', { exact: true }).press('Enter');
    await page.locator('.talk-selection-chip summary').click();
    await expect(page.locator('.talk-selection-full')).toContainText('Lifestyle product world');
    await page.locator('.talk-selection-chip summary').press('Enter');
    await page.screenshot({
      path: `test-results/talk-voice-dock-${viewport.name}-compact.png`,
      fullPage: true,
    });
    const counts = await page.evaluate(() => {
      const host = window as unknown as VoiceHost;
      return { micGets: host.micGets, peerCount: host.peerCount };
    });
    await dock.getByRole('button', { name: 'Expand voice', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Aethelios Live', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Minimize voice', exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as VoiceHost).micTracks[0]?.enabled)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/talk-voice-dock-${viewport.name}-expanded.png`,
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(dock).toBeVisible();
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue('');
    expect(await page.evaluate(() => (window as unknown as VoiceHost).micGets)).toBe(
      counts.micGets,
    );
    expect(await page.evaluate(() => (window as unknown as VoiceHost).peerCount)).toBe(
      counts.peerCount,
    );
    expect(prepared.live.starts).toBe(1);
    expect(prepared.live.ends).toBe(0);
  }
});

test('docked transcript focuses Talk, mute matches the track, and details stay inert', async ({
  page,
}, testInfo) => {
  testInfo.annotations.push({
    type: 'transport',
    description: 'Mocked voice transport fixture, not a live microphone or paid model call.',
  });
  const original = await readFile('public/brand/gent-ascend-master.png');
  await fakeTransport(page);
  const prepared = await prepareTalkVoice(page, original);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `http://127.0.0.1:3102/app/aethelios?mode=talk-live&conversation=${conversation}`,
  );
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(dock.locator('.live-compact-presence .im-status')).toHaveText('Listening');
  await page.getByRole('button', { name: 'Aethelios presence', exact: true }).click();
  await expect(page.getByText('Microphone off.')).toHaveCount(0);
  await expect(page.getByText(/Voice is active in the dock/)).toBeVisible();
  await page.keyboard.press('Escape');
  const transcript = page.locator('#talk-conversation-transcript');
  await transcript.evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => transcript.evaluate((node) => node.scrollTop === 0)).toBe(true);
  await page.evaluate(() => {
    (window as unknown as VoiceHost).voiceChannel.onmessage!({
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'spoken-while-reading',
        transcript: 'New spoken line while reading history',
      }),
    });
  });
  await expect.poll(() => transcript.evaluate((node) => node.scrollTop === 0)).toBe(true);
  await dock.getByRole('button', { name: 'Open conversation transcript', exact: true }).click();
  await expect(transcript).toBeFocused();
  await expect.poll(() => transcript.evaluate((node) => node.scrollTop > 0)).toBe(true);

  await dock.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  await expect(dock.locator('.live-compact-presence .im-status')).toHaveText('Microphone muted');
  expect(await page.evaluate(() => (window as unknown as VoiceHost).micTracks[0]?.enabled)).toBe(
    false,
  );
  await dock.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as VoiceHost).micTracks[0]?.enabled)).toBe(
    true,
  );

  await expect(
    dock.getByRole('button', { name: 'Download voice diagnostics', exact: true }),
  ).toHaveCount(0);
  await dock.locator('summary').filter({ hasText: 'Details' }).click();
  await expect(
    dock.getByRole('button', { name: 'Download voice diagnostics', exact: true }),
  ).toBeVisible();
  await dock.locator('summary').filter({ hasText: 'Details' }).click();
  await expect(
    dock.getByRole('button', { name: 'Download voice diagnostics', exact: true }),
  ).toHaveCount(0);
  await expect(
    dock.getByRole('button', { name: 'Download voice diagnostics', exact: true }),
  ).toHaveCount(0);

  await page
    .getByLabel('Message Aethelios', { exact: true })
    .fill('Keep the caret through layout changes');
  const caret = await page.getByLabel('Message Aethelios', { exact: true }).evaluate((node) => {
    const field = node as HTMLTextAreaElement;
    field.setSelectionRange(8, 12);
    return { start: field.selectionStart, end: field.selectionEnd, value: field.value };
  });
  const before = await page.evaluate(() => {
    const host = window as unknown as VoiceHost;
    return { micGets: host.micGets, peerCount: host.peerCount };
  });
  await dock.getByRole('button', { name: 'Expand voice', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aethelios Live', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Open live transcript', exact: true }).click();
  await expect(dialog.getByRole('log')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue(caret.value);
  const after = await page.getByLabel('Message Aethelios', { exact: true }).evaluate((node) => {
    const field = node as HTMLTextAreaElement;
    return { start: field.selectionStart, end: field.selectionEnd };
  });
  expect(after).toEqual({ start: caret.start, end: caret.end });
  expect(await page.evaluate(() => (window as unknown as VoiceHost).micGets)).toBe(before.micGets);
  expect(await page.evaluate(() => (window as unknown as VoiceHost).peerCount)).toBe(
    before.peerCount,
  );
  expect(prepared.live.starts).toBe(1);
  expect(prepared.live.ends).toBe(0);

  await page.evaluate(() => {
    (window as unknown as VoiceHost).voiceChannel.onmessage!({
      data: JSON.stringify({
        type: 'output_audio_buffer.started',
        response_id: 'synthetic-response',
      }),
    });
  });
  await expect(dock.locator('.live-compact-presence .im-status')).toHaveText('Speaking');
  await dock.getByRole('button', { name: 'Stop playback', exact: true }).click();
  await dock.getByRole('button', { name: 'End session', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as VoiceHost).micStopped)).toBe(true);
});

test('multiline input, long names and a short keyboard leave essential controls inside the viewport', async ({
  page,
}, testInfo) => {
  testInfo.annotations.push({
    type: 'viewport',
    description: 'Simulated Chromium viewports, not a physical Fold, phone or native IME.',
  });
  const original = await readFile('public/brand/gent-ascend-master.png');
  await fakeTransport(page);
  await prepareTalkVoice(page, original);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `http://127.0.0.1:3102/app/aethelios?mode=talk-live&conversation=${conversation}`,
  );
  const dock = await startCombinedVoice(page, original);
  const input = page.getByLabel('Message Aethelios', { exact: true });
  await input.fill('Line one\nLine two\nLine three\nLine four\nLine five');
  expect((await page.locator('.aurelius-composer').boundingBox())!.height).toBeLessThan(340);
  await page.setViewportSize({ width: 390, height: 420 });
  await expect(page.locator('[data-keyboard="open"]')).toBeVisible();
  const short = { width: 390, height: 420 };
  await expect
    .poll(async () => (await page.locator('.conversation-scroll').boundingBox())?.height ?? 0)
    .toBeGreaterThan(420 * 0.22);
  for (const control of [
    dock.getByRole('button', { name: 'Mute microphone', exact: true }),
    dock.getByRole('button', { name: 'End session', exact: true }),
    dock.getByRole('button', { name: 'Expand voice', exact: true }),
    page.getByRole('button', { name: 'Remove image', exact: true }),
    page.getByRole('button', { name: 'Use in Studio', exact: true }),
    page.getByRole('button', { name: 'Add image', exact: true }),
    page.getByRole('button', { name: 'Send', exact: true }),
  ])
    await assertPointerTarget(control, short);
  await page.setViewportSize({ width: 844, height: 390 });
  await assertPointerTarget(dock.getByRole('button', { name: 'Expand voice', exact: true }), {
    width: 844,
    height: 390,
  });
  await expect(dock.locator('[aria-label="Expand voice"] .live-call-action-caption')).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 32px; }' });
  await assertPointerTarget(dock.getByRole('button', { name: 'End session', exact: true }), {
    width: 844,
    height: 390,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  const zoomed = { width: 390, height: 844 };
  for (const control of [
    dock.getByRole('button', { name: 'Mute microphone', exact: true }),
    dock.getByRole('button', { name: 'End session', exact: true }),
    dock.getByRole('button', { name: 'Expand voice', exact: true }),
  ])
    await assertPointerTarget(control, zoomed);
  await expect
    .poll(async () => (await page.locator('.conversation-scroll').boundingBox())?.height ?? 0)
    .toBeGreaterThan(844 * 0.16);
});

test('details, speaking, blocked playback, cleanup retry and approvals stay inside the budget', async ({
  page,
}, testInfo) => {
  testInfo.annotations.push({
    type: 'transport',
    description: 'Mocked voice transport stress states, not a physical device or paid Live call.',
  });
  const original = await readFile('public/brand/gent-ascend-master.png');
  await fakeTransport(page);
  await page.addInitScript(() => {
    (window as unknown as VoiceHost).blockPlayback = true;
    localStorage.setItem('aurelius-material', 'solid');
  });
  const prepared = await prepareTalkVoice(page, original);
  prepared.live.jobs.push({
    id: 'synthetic-approval',
    task: `${'Review this long background research task for the Lifestyle product world. '.repeat(12)}`,
    coworker: 'athena',
    status: 'approval',
    result: '',
    duration_ms: null,
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 884, height: 690 });
  await page.goto(
    `http://127.0.0.1:3102/app/aethelios?mode=talk-live&conversation=${conversation}`,
  );
  await page.locator('html').evaluate((el) => el.setAttribute('data-material', 'solid'));
  await expect(page.locator('html')).toHaveAttribute('data-material', 'solid');
  const dock = await startCombinedVoice(page, original);
  const input = page.getByLabel('Message Aethelios', { exact: true });
  await input.fill('Line one\nLine two\nLine three\nLine four');
  const fold = { width: 884, height: 690 };
  await expect.poll(() => dock.getByRole('button', { name: 'Approve this task' }).count()).toBe(1);
  await dock.locator('summary').filter({ hasText: 'Details' }).click();
  const diagnostics = dock.getByRole('button', { name: 'Download voice diagnostics', exact: true });
  await expect(diagnostics).toBeVisible();
  await diagnostics.scrollIntoViewIfNeeded();
  await assertPointerTarget(diagnostics, fold);
  await page.screenshot({
    path: 'test-results/talk-voice-dock-fold-details-approval.png',
    fullPage: true,
  });
  for (const control of [
    dock.getByRole('button', { name: 'Mute microphone', exact: true }),
    dock.getByRole('button', { name: 'End session', exact: true }),
    dock.getByRole('button', { name: 'Expand voice', exact: true }),
    dock.locator('.live-dock-approval-actions').getByRole('button', { name: 'Approve this task' }),
    page.getByRole('button', { name: 'Remove image', exact: true }),
    page.getByRole('button', { name: 'Send', exact: true }),
  ])
    await assertPointerTarget(control, fold);
  expect((await page.locator('.aurelius-compose-region').boundingBox())!.height).toBeLessThan(
    fold.height * 0.62,
  );
  await expect
    .poll(() => page.getByRole('button', { name: 'Enable voice playback' }).count())
    .toBe(1);
  await assertPointerTarget(page.getByRole('button', { name: 'Enable voice playback' }), fold);
  await page.screenshot({
    path: 'test-results/talk-voice-dock-fold-blocked-playback.png',
    fullPage: true,
  });
  await page.evaluate(() => {
    (window as unknown as VoiceHost).blockPlayback = false;
  });
  await page.getByRole('button', { name: 'Enable voice playback' }).click();
  await expect(page.getByRole('button', { name: 'Enable voice playback' })).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as VoiceHost).voiceChannel.onmessage!({
      data: JSON.stringify({
        type: 'output_audio_buffer.started',
        response_id: 'synthetic-response',
      }),
    });
  });
  await expect(dock.locator('.live-compact-presence .im-status')).toHaveText('Speaking');
  await assertPointerTarget(dock.getByRole('button', { name: 'Stop playback', exact: true }), fold);
  await page.screenshot({
    path: 'test-results/talk-voice-dock-fold-speaking.png',
    fullPage: true,
  });
  prepared.live.cleanupWorks = false;
  await dock.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(dock.getByRole('button', { name: 'Retry end session', exact: true })).toBeVisible();
  await page.screenshot({
    path: 'test-results/talk-voice-dock-fold-cleanup-retry.png',
    fullPage: true,
  });
  await assertPointerTarget(
    dock.getByRole('button', { name: 'Retry end session', exact: true }),
    fold,
  );
  prepared.live.cleanupWorks = true;
  await dock.getByRole('button', { name: 'Retry end session', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as VoiceHost).micStopped)).toBe(true);
  expect(prepared.live.starts).toBe(1);
});
