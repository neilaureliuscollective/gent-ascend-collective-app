import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'iphone-short', width: 390, height: 420 },
  { name: 'fold', width: 884, height: 690 },
  { name: 'desktop', width: 1440, height: 900 },
];

test('mocked globe scenes stay labeled and keep controls on screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=live-call-globe&scene=listening');
  await expect(page.getByRole('note')).toContainText('Mocked audio and session states');
  const globe = page.locator('.live-call-globe-immersive');
  await expect(globe).toBeVisible();
  await expect(globe).toHaveAttribute('data-kind', 'listening');
  await expect(globe.locator('.live-call-emblem')).toHaveAttribute(
    'src',
    /aethelios-official-20261015-192/,
  );
  await expect(page.getByRole('button', { name: 'Mute microphone', exact: true })).toBeVisible();
  await expect(page.getByRole('log')).toBeVisible();
  await page.getByRole('button', { name: 'Speaking', exact: true }).click();
  await expect(globe).toHaveAttribute('data-kind', 'speaking');
  await page.getByRole('button', { name: 'Muted', exact: true }).click();
  await expect(globe).toHaveAttribute('data-kind', 'muted');
  await expect(page.getByRole('button', { name: 'Unmute microphone', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Mocked live-call scenes' }).getByRole('button', { name: 'Compact mode', exact: true }).click();
  await expect(page.locator('.live-call-globe-compact')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ended', exact: true }).click();
  await expect(page.locator('.live-call-globe')).toHaveAttribute('data-kind', 'ended');
  await page.getByRole('button', { name: 'Error', exact: true }).click();
  await expect(page.locator('.live-call-globe')).toHaveAttribute('data-kind', 'error');
});

test('keyboard users can move through mocked call controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=live-call-globe&scene=listening');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Mute microphone', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'End session', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('region', { name: 'Aethelios Live' }).getByRole('button', { name: 'Compact', exact: true })).toBeFocused();
});

test('reduced motion keeps the official emblem upright and still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3102/?mode=live-call-globe&scene=speaking');
  const globe = page.locator('.live-call-globe');
  await expect(globe).toHaveAttribute('data-motion', 'still');
  const emblem = page.locator('.live-call-emblem');
  await expect(emblem).toBeVisible();
  const rotation = await emblem.evaluate((node) => getComputedStyle(node).transform);
  expect(rotation === 'none' || rotation === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
});

for (const viewport of viewports)
  test(`mocked call chrome fits ${viewport.name} without covering controls`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('http://127.0.0.1:3102/?mode=live-call-globe&scene=listening');
    const globe = page.locator('.live-orb');
    const controls = page.getByRole('button', { name: 'End session', exact: true });
    const transcript = page.getByRole('log');
    await expect(globe).toBeVisible();
    await expect(controls).toBeVisible();
    await expect(transcript).toBeVisible();
    const globeBox = await globe.boundingBox();
    const controlBox = await controls.boundingBox();
    expect(globeBox?.height ?? 999).toBeLessThanOrEqual(viewport.height * 0.4);
    expect(controlBox?.y ?? 0).toBeLessThan(viewport.height - 20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(
      true,
    );
  });

test('mounting the globe does not acquire a second microphone or session', async ({ page }) => {
  let starts = 0;
  await page.addInitScript(() => {
    let calls = 0;
    const tracks = [
      {
        enabled: true,
        readyState: 'live',
        stop() {},
        addEventListener() {},
      },
    ];
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        calls += 1;
        (window as unknown as { micCalls: number }).micCalls = calls;
        return { getTracks: () => tracks, getAudioTracks: () => tracks };
      },
    });
    class PC {
      localDescription = { sdp: 'v=0' };
      connectionState = 'new';
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
        this.channel.onopen?.();
        (window as unknown as { voiceChannel: PC['channel'] }).voiceChannel = this.channel;
      }
      createDataChannel() {
        return this.channel;
      }
      close() {}
      async getStats() {
        return new Map();
      }
    }
    Object.defineProperty(window, 'RTCPeerConnection', { value: PC });
  });
  await page.route('**/api/aethelios/live', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { jobs: [] } });
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { ended: true } });
    starts += 1;
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
  const compact = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(compact.locator('.live-call-globe')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { micCalls: number }).micCalls)).toBe(
    1,
  );
  await compact.getByRole('button', { name: 'Expand', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aethelios Live', exact: true });
  await expect(dialog.locator('.live-call-globe')).toBeVisible();
  expect(starts).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { micCalls: number }).micCalls)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(compact).toBeVisible();
  expect(starts).toBe(1);
  await compact.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(compact.getByRole('status')).toHaveText('Session ended');
});
