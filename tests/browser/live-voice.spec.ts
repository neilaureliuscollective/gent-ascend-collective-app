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
    const compact = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
    await expect(compact).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Aethelios Live', exact: true })).toHaveCount(0);
    await expect(compact.getByRole('status')).toHaveText('Listening');
    await expect(compact.locator('.im-presence')).toHaveAttribute('data-phase', 'listening');
    await expect(compact.locator('.im-presence')).toHaveAttribute('data-motion', 'still');
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
    await expect(compact.getByRole('log')).toContainText('Synthetic question');
    await page.getByRole('button', { name: 'Navigate workspace', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Studio', exact: true })).toBeVisible();
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
    await compact.getByRole('button', { name: 'Expand voice', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Aethelios Live', exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(compact).toBeVisible();
    expect(starts).toBe(1);
    expect(await compact.evaluate((node) => node.scrollHeight - node.clientHeight <= 1)).toBe(true);
    await compact.getByRole('button', { name: 'End session', exact: true }).click();
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
  const dialog = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(dialog).toBeVisible();
  // Compact chrome precedes async admission and fake channel creation.
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
  await dialog.getByText('Details', { exact: true }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Voice diagnostics', exact: true }),
  ).toBeVisible();
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
  await dialog.getByRole('button', { name: 'End session', exact: true }).click();
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
  const dialog = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(dialog.getByRole('status')).toHaveText('Connecting');
  await expect.poll(() => admissions).toBe(1);
  await dialog.getByRole('button', { name: 'End session', exact: true }).click();
  release();
  await expect.poll(() => ends).toBe(2);
  await expect(dialog.getByRole('status')).toHaveText('Session ended');
  expect(await page.evaluate(() => (window as unknown as { micStopped: boolean }).micStopped)).toBe(
    true,
  );
});

test('late ASR stays ordered and uncertain cleanup prevents another voice session', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeTransport(page);
  let starts = 0;
  let cleanupWorks = false;
  await page.route('**/api/aethelios/live', async (route) => {
    const method = route.request().method();
    if (method === 'GET') return route.fulfill({ json: { jobs: [] } });
    if (method === 'DELETE') return route.fulfill({ json: { ended: cleanupWorks } });
    starts++;
    return route.fulfill({
      json: {
        answer: 'v=0\r\na=synthetic-answer',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
  });
  await page.goto('http://127.0.0.1:3102/?mode=live-voice');
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const dialog = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(dialog.getByRole('status')).toHaveText('Listening');
  await page.evaluate(() => {
    const channel = (
      window as unknown as { voiceChannel: { onmessage: (event: { data: string }) => void } }
    ).voiceChannel;
    for (const event of [
      { type: 'input_audio_buffer.committed', item_id: 'voice-first' },
      {
        type: 'response.output_audio_transcript.delta',
        item_id: 'answer',
        delta: 'Synthetic first answer',
      },
      {
        type: 'conversation.item.added',
        item: { id: 'typed-next', role: 'user', content: [{ text: 'Synthetic typed followup' }] },
      },
      {
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'voice-first',
        transcript: 'Synthetic first question',
      },
    ])
      channel.onmessage({ data: JSON.stringify(event) });
  });
  await expect(dialog.getByRole('log')).toContainText(
    /Synthetic first question[\s\S]*Synthetic first answer[\s\S]*Synthetic typed followup/,
  );
  await dialog.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(dialog).toContainText('Server cleanup is pending');
  expect(starts).toBe(1);
  cleanupWorks = true;
  await dialog.getByRole('button', { name: 'Retry end session', exact: true }).click();
  await expect(dialog).not.toContainText('Server cleanup is pending');
  expect(starts).toBe(1);
});

test('connection failure stays compact with a usable retry and does not force fullscreen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeTransport(page);
  await page.route('**/api/aethelios/live', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { jobs: [] } });
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { ended: true } });
    return route.fulfill({
      status: 503,
      json: {
        error:
          'The voice provider did not complete admission. Your text workspace remains available.',
        detail: { stage: 'provider', category: 'rejected', providerStatus: 401 },
      },
    });
  });
  await page.goto('http://127.0.0.1:3102/?mode=live-voice');
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Aethelios Live', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Persistent Aethelios voice controls' }),
  ).toHaveCount(0);
});

test('simulated phone and unfolded-Fold consent stays scrollable with reachable Start', async ({
  page,
}, testInfo) => {
  testInfo.annotations.push({
    type: 'viewport',
    description: 'Simulated Chromium viewports, not a physical Fold or phone.',
  });
  for (const viewport of [
    { name: 'phone', width: 390, height: 844 },
    { name: 'fold-unfolded', width: 768, height: 712 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('http://127.0.0.1:3102/?mode=live-voice');
    await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
    const consent = page.getByRole('group', { name: 'Voice pilot consent' });
    await expect(consent).toBeVisible();
    const box = await consent.boundingBox();
    expect(box?.height ?? 9999).toBeLessThanOrEqual(viewport.height * 0.8);
    await expect(consent.getByRole('button', { name: 'Start voice', exact: true })).toBeVisible();
    await page.screenshot({
      path: `test-results/talk-live-consent-${viewport.name}-${viewport.width}.png`,
      fullPage: true,
    });
    await consent.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
});

test('unavailable Live remains visible in Talk with an understandable reason', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=live-voice-unavailable');
  const live = page.getByRole('button', { name: 'Aethelios Live', exact: true });
  await expect(live).toBeVisible();
  await live.click();
  await expect(page.getByRole('status')).toContainText(
    'Aethelios Live is not enabled on this deployment.',
  );
  await expect(page.getByRole('button', { name: 'Start voice' })).toHaveCount(0);
});

test('acknowledged voice retries in one tap without optional consent or automatic admission', async ({
  page,
}) => {
  await fakeTransport(page);
  const starts: { includeContext: boolean; backgroundWork: boolean }[] = [];
  await page.route('**/api/aethelios/live', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { jobs: [] } });
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { ended: true } });
    starts.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: 'Synthetic rejection' } });
  });
  await page.goto('http://127.0.0.1:3102/?mode=live-voice');
  const entry = page.getByRole('button', { name: 'Aethelios Live', exact: true });
  await entry.click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await entry.click();
  await expect(page.getByRole('checkbox', { name: /I consent/ })).not.toBeChecked();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('checkbox', { name: /Include my selected personal/ }).check();
  await page.getByRole('checkbox', { name: /Allow proposals/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  await expect.poll(() => starts.length).toBe(1);
  expect(starts[0]).toMatchObject({ includeContext: true, backgroundWork: true });
  // Wait for controller cleanup before the next explicit gesture.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { micStopped: boolean }).micStopped))
    .toBe(true);
  await page.reload();
  await expect(entry).toBeVisible();
  expect(starts).toHaveLength(1);
  await entry.click();
  await expect.poll(() => starts.length).toBe(2);
  expect(starts[1]).toMatchObject({ includeContext: false, backgroundWork: false });
  await expect(page.getByRole('group', { name: 'Voice pilot consent' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voice options', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /I consent/ })).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: /Include my selected personal/ }),
  ).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Allow proposals/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Switch synthetic user', exact: true }).click();
  await entry.click();
  await expect(page.getByRole('checkbox', { name: /I consent/ })).not.toBeChecked();
  expect(starts).toHaveLength(2);
});
