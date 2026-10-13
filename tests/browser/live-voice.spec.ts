import { test, expect } from './fixtures';
// Transport fixture verifies lifecycle/UI only; it cannot establish audio quality or real mobile support.
async function fakeTransport(page: import('@playwright/test').Page) {
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
        onmessage: null as ((event: { data: string }) => void) | null,
        onopen: null as (() => void) | null,
        onclose: null as (() => void) | null,
        close() {},
        send() {},
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
for (const width of [390, 1440])
  test(`persistent voice modes preserve one transport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let starts = 0,
      ends = 0;
    await fakeTransport(page);
    await page.route('**/api/aethelios/live', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { jobs: [] } });
        return;
      }
      if (route.request().method() === 'DELETE') {
        ends++;
        await route.fulfill({ json: { ended: true } });
        return;
      }
      starts++;
      await route.fulfill({
        json: {
          answer: 'v=0\r\na=synthetic-answer',
          expiresAt: new Date(Date.now() + 120000).toISOString(),
        },
      });
    });
    await page.goto('http://127.0.0.1:3102/?mode=live-voice');
    await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start voice', exact: true })).toBeDisabled();
    await page.getByRole('checkbox', { name: /I consent/ }).check();
    await page.getByRole('button', { name: 'Start voice', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Aethelios Live', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('status')).toHaveText('Listening');
    await expect(dialog.locator('.im-presence')).toHaveAttribute('data-phase', 'listening');
    await expect(dialog.locator('.im-presence')).toHaveAttribute('data-motion', 'still');
    await page.screenshot({ path: `test-results/guiding-voice-${width}.png`, fullPage: true });
    await page.evaluate(() => {
      (
        window as unknown as { voiceChannel: { onmessage: (e: { data: string }) => void } }
      ).voiceChannel.onmessage({
        data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.completed',
          item_id: 'u',
          transcript: 'Synthetic question',
        }),
      });
    });
    await expect(dialog.getByRole('log')).toContainText('Synthetic question');
    await dialog.getByRole('button', { name: 'Minimize', exact: true }).click();
    await page.getByRole('button', { name: 'Navigate workspace', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Studio', exact: true })).toBeVisible();
    const compact = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
    await expect(compact.getByRole('status')).toHaveText('Listening');
    expect(starts).toBe(1);
    expect(ends).toBe(0);
    await compact.getByRole('button', { name: 'Mute microphone', exact: true }).click();
    await expect(compact.getByRole('status')).toHaveText('Microphone muted');
    await expect(compact.locator('.im-presence')).toHaveAttribute('data-phase', 'ready');
    await page.evaluate(() =>
      (
        window as unknown as { voiceChannel: { onmessage: (e: { data: string }) => void } }
      ).voiceChannel.onmessage({
        data: JSON.stringify({
          type: 'output_audio_buffer.started',
          response_id: 'synthetic-response',
        }),
      }),
    );
    await expect(compact.getByRole('status')).toHaveText('Speaking');
    await expect(compact.locator('.im-presence')).toHaveAttribute('data-phase', 'speaking');
    await compact.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(compact).toBeVisible();
    expect(starts).toBe(1);
    await compact.getByRole('button', { name: 'End', exact: true }).click();
    await expect(compact.getByRole('status')).toHaveText('Session ended');
    await expect(compact.locator('.im-presence')).toHaveAttribute('data-phase', 'cancelled');
    expect(
      await page.evaluate(() => (window as unknown as { micStopped: boolean }).micStopped),
    ).toBe(true);
    expect(ends).toBe(1);
  });
test('voice diagnostic download excludes transcript and record IDs', async ({ page }) => {
  await fakeTransport(page);
  await page.route('**/api/aethelios/live', (route) =>
    route.fulfill({
      json:
        route.request().method() === 'GET'
          ? { jobs: [] }
          : route.request().method() === 'DELETE'
            ? { ended: true }
            : {
                answer: 'v=0\r\na=synthetic-answer',
                expiresAt: new Date(Date.now() + 120000).toISOString(),
                model: 'gpt-realtime',
              },
    }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=live-voice');
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aethelios Live', exact: true });
  await expect(dialog).toBeVisible();
  // Dialog visibility precedes async admission and fake channel creation.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (window as unknown as { voiceChannel?: { onmessage?: unknown } }).voiceChannel
            ?.onmessage,
      ),
    )
    .toBe('function');
  await page.evaluate(() => {
    (
      window as unknown as { voiceChannel: { onmessage: (e: { data: string }) => void } }
    ).voiceChannel.onmessage({
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'private-record-id',
        transcript: 'DO NOT EXPORT THIS TEXT',
      }),
    });
  });
  await dialog.getByText('Voice diagnostics', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download voice diagnostics', exact: true }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Diagnostic stream unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const contents = Buffer.concat(chunks).toString('utf8');
  expect(contents).not.toMatch(/DO NOT EXPORT|private-record-id/);
  expect(JSON.parse(contents)).toMatchObject({ evidence: 'browser-events', model: 'gpt-realtime' });
  await dialog.getByRole('button', { name: 'End', exact: true }).click();
});
test('cancelling during slow SDP admission revokes the late call without restoring audio', async ({
  page,
}) => {
  await fakeTransport(page);
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let ends = 0,
    admissions = 0;
  await page.route('**/api/aethelios/live', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { jobs: [] } });
      return;
    }
    if (route.request().method() === 'DELETE') {
      ends++;
      await route.fulfill({ json: { ended: true } });
      return;
    }
    admissions++;
    await wait;
    await route.fulfill({
      json: {
        answer: 'v=0\r\na=late-answer',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
  });
  await page.goto('http://127.0.0.1:3102/?mode=live-voice');
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('status')).toHaveText('Connecting');
  await expect.poll(() => admissions).toBe(1);
  await dialog.getByRole('button', { name: 'End', exact: true }).click();
  release();
  await expect.poll(() => ends).toBe(2);
  await expect(dialog.getByRole('status')).toHaveText('Session ended');
  expect(await page.evaluate(() => (window as unknown as { micStopped: boolean }).micStopped)).toBe(
    true,
  );
});
