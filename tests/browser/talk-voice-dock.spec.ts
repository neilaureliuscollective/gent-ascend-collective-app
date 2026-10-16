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
    (window as unknown as { micTracks: typeof tracks }).micTracks = tracks;
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

async function assertPointerTarget(control: Locator, viewport: { width: number; height: number }) {
  const box = (await control.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect
    .poll(() =>
      control.evaluate((node: HTMLElement) => {
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.x + Math.min(rect.width / 2, 20),
          rect.y + Math.min(rect.height / 2, 20),
        );
        return hit === node || node.contains(hit);
      }),
    )
    .toBe(true);
}

async function prepareTalkVoice(page: Page, original: Buffer) {
  let selected: string | null = conversation;
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
  return () => selected;
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
  const selected = await prepareTalkVoice(page, original);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `http://127.0.0.1:3102/app/aethelios?mode=talk-live&conversation=${conversation}`,
  );
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeEnabled();
  await expect(page.getByText(/Changing this: Lifestyle product world/)).toBeVisible();
  const choose = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await (
    await choose
  ).setFiles({
    name: 'supercalifragilistic-lifestyle-product-world-hero-reference.png',
    mimeType: 'image/png',
    buffer: original,
  });
  await expect(page.getByRole('button', { name: 'Remove image', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(dock.getByRole('status')).toHaveText('Listening');
  await expect.poll(() => selected()).toBe(conversation);
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue('');

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(dock.getByRole('status')).toHaveText('Listening');
    const composer = page.locator('.aurelius-composer');
    const transcript = page.locator('.conversation-scroll');
    const region = page.locator('.aurelius-compose-region');
    await expect
      .poll(async () => (await transcript.boundingBox())?.height ?? 0)
      .toBeGreaterThan(viewport.height * 0.28);
    expect((await region.boundingBox())!.height).toBeLessThan(viewport.height * 0.52);
    expect((await composer.boundingBox())!.height).toBeLessThan(240);
    expect(await dock.evaluate((node) => node.scrollHeight - node.clientHeight <= 1)).toBe(true);
    for (const control of [
      dock.getByRole('button', { name: 'Mute microphone', exact: true }),
      dock.getByRole('button', { name: 'End session', exact: true }),
      dock.getByRole('button', { name: 'Expand voice', exact: true }),
      page.getByRole('button', { name: 'Remove image', exact: true }),
      page.getByRole('button', { name: 'Expand writing space', exact: true }),
    ])
      await assertPointerTarget(control, viewport);
    const filename = page.locator('.talk-image-preview span').first();
    await expect(filename).toBeVisible();
    expect(await filename.evaluate((node) => node.scrollWidth > node.clientWidth + 1)).toBe(true);
    await expect(filename).toHaveAttribute(
      'title',
      'supercalifragilistic-lifestyle-product-world-hero-reference.png',
    );
    await page.screenshot({
      path: `test-results/talk-voice-dock-${viewport.name}-compact.png`,
      fullPage: true,
    });
    await dock.getByRole('button', { name: 'Expand voice', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Aethelios Live', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Minimize voice', exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { micTracks: { enabled: boolean }[] }).micTracks[0]?.enabled,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/talk-voice-dock-${viewport.name}-expanded.png`,
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(dock).toBeVisible();
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue('');
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
  await prepareTalkVoice(page, original);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `http://127.0.0.1:3102/app/aethelios?mode=talk-live&conversation=${conversation}`,
  );
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(dock.getByRole('status')).toHaveText('Listening');
  const transcript = page.locator('#talk-conversation-transcript');
  await transcript.evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect.poll(() => transcript.evaluate((node) => node.scrollTop === 0)).toBe(true);
  await dock.getByRole('button', { name: 'Open conversation transcript', exact: true }).click();
  await expect(transcript).toBeFocused();
  await expect.poll(() => transcript.evaluate((node) => node.scrollTop > 0)).toBe(true);

  await dock.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  await expect(dock.getByRole('status')).toHaveText('Microphone muted');
  expect(
    await page.evaluate(
      () => (window as unknown as { micTracks: { enabled: boolean }[] }).micTracks[0]?.enabled,
    ),
  ).toBe(false);
  await dock.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { micTracks: { enabled: boolean }[] }).micTracks[0]?.enabled,
    ),
  ).toBe(true);

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

  await page
    .getByLabel('Message Aethelios', { exact: true })
    .fill('Keep the caret through layout changes');
  const caret = await page.getByLabel('Message Aethelios', { exact: true }).evaluate((node) => {
    const field = node as HTMLTextAreaElement;
    field.setSelectionRange(8, 12);
    return { start: field.selectionStart, end: field.selectionEnd, value: field.value };
  });
  await dock.getByRole('button', { name: 'Expand voice', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Aethelios Live', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue(caret.value);

  await page.evaluate(() => {
    (
      window as unknown as { voiceChannel: { onmessage: (event: { data: string }) => void } }
    ).voiceChannel.onmessage({
      data: JSON.stringify({
        type: 'output_audio_buffer.started',
        response_id: 'synthetic-response',
      }),
    });
  });
  await expect(dock.getByRole('status')).toHaveText('Speaking');
  await dock.getByRole('button', { name: 'End session', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { micStopped: boolean }).micStopped)).toBe(
    true,
  );
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
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeEnabled();
  const choose = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await (
    await choose
  ).setFiles({
    name: 'supercalifragilistic-lifestyle-product-world-hero-reference.png',
    mimeType: 'image/png',
    buffer: original,
  });
  await expect(page.getByRole('button', { name: 'Remove image', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const dock = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(dock.getByRole('status')).toHaveText('Listening');
  const input = page.getByLabel('Message Aethelios', { exact: true });
  await input.fill('Line one\nLine two\nLine three\nLine four\nLine five');
  expect((await page.locator('.aurelius-composer').boundingBox())!.height).toBeLessThan(280);
  await page.setViewportSize({ width: 390, height: 420 });
  await expect(page.locator('[data-keyboard="open"]')).toBeVisible();
  await expect
    .poll(async () => {
      const box = await page
        .getByRole('button', { name: 'Remove image', exact: true })
        .boundingBox();
      return box ? box.y + box.height : 999;
    })
    .toBeLessThanOrEqual(421);
  await assertPointerTarget(dock.getByRole('button', { name: 'Mute microphone', exact: true }), {
    width: 390,
    height: 420,
  });
  await assertPointerTarget(page.getByRole('button', { name: 'Remove image', exact: true }), {
    width: 390,
    height: 420,
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await assertPointerTarget(dock.getByRole('button', { name: 'Expand voice', exact: true }), {
    width: 844,
    height: 390,
  });
  await page.addStyleTag({ content: 'html { font-size: 20px; }' });
  await assertPointerTarget(dock.getByRole('button', { name: 'End session', exact: true }), {
    width: 844,
    height: 390,
  });
});
