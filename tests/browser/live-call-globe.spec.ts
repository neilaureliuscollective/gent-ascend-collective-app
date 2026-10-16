import { expect, test, type Locator } from '@playwright/test';

async function canvasDigest(canvas: Locator) {
  return canvas.evaluate((node) => {
    const canvasNode = node as HTMLCanvasElement;
    const context = canvasNode.getContext('2d');
    if (!context) return '';
    const image = context.getImageData(0, 0, canvasNode.width, canvasNode.height);
    let total = 0;
    for (let i = 0; i < image.data.length; i += 17) total = (total + (image.data[i] ?? 0)) % 1_000_003;
    return `${canvasNode.width}x${canvasNode.height}:${image.data.length}:${total}`;
  });
}

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
  await expect(globe).toHaveAttribute('data-emblem-id', 'original-full-logo');
  await expect(globe).toHaveAttribute('data-earth', 'ready', { timeout: 15000 });
  await expect(globe).toHaveAttribute('data-emblem', 'ready', { timeout: 15000 });
  const canvas = globe.locator('.live-globe-canvas');
  await expect(canvas).toBeAttached();
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
  await page.getByRole('region', { name: 'Aethelios Live' }).getByRole('button', { name: 'Mute microphone', exact: true }).focus();
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
  const canvas = globe.locator('.live-globe-canvas');
  await expect(canvas).toBeVisible();
  const rotation = await canvas.evaluate((node) => getComputedStyle(node).transform);
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
    const canvasBox = await page.locator('.live-globe-canvas').boundingBox();
    expect(globeBox?.height ?? 999).toBeLessThanOrEqual(viewport.height * 0.4);
    expect(Math.abs((globeBox?.width ?? 0) - (globeBox?.height ?? 1))).toBeLessThan(2);
    expect(Math.abs((canvasBox?.width ?? 0) - (canvasBox?.height ?? 1))).toBeLessThan(2);
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

test('Still and reduced motion apply on the production Live surface without remounting', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tracks = [{ enabled: true, readyState: 'live', stop() {}, addEventListener() {} }];
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => ({ getTracks: () => tracks, getAudioTracks: () => tracks }),
    });
    class PC {
      localDescription = { sdp: 'v=0' };
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
              },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=live-voice');
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const compact = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  const globe = compact.locator('.live-call-globe');
  const canvas = globe.locator('.live-globe-canvas');
  await expect(globe).toBeVisible();
  await expect(globe).toHaveAttribute('data-earth', /ready|fallback/, { timeout: 15000 });
  await canvas.evaluate((node) => node.setAttribute('data-keep', '1'));
  const first = await canvasDigest(canvas);
  await expect.poll(async () => canvasDigest(canvas), { timeout: 1500 }).not.toBe(first);
  await page.getByRole('button', { name: 'Pause ambient motion', exact: true }).click();
  await expect(globe).toHaveAttribute('data-motion', 'still');
  await page.waitForTimeout(80);
  const still = await canvasDigest(canvas);
  await page.waitForTimeout(240);
  expect(await canvasDigest(canvas)).toBe(still);
  await page.getByRole('button', { name: 'Enable ambient motion', exact: true }).click();
  await expect(globe).toHaveAttribute('data-motion', 'ambient');
  await expect.poll(async () => canvasDigest(canvas), { timeout: 1500 }).not.toBe(still);
  await expect(canvas).toHaveAttribute('data-keep', '1');
  await compact.getByRole('button', { name: 'Expand', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aethelios Live', exact: true });
  const immersive = dialog.locator('.live-call-globe');
  await expect(immersive).toBeVisible();
  const box = await immersive.boundingBox();
  expect(Math.abs((box?.width ?? 0) - (box?.height ?? 1))).toBeLessThan(3);
  await page.keyboard.press('Escape');
  await compact.getByRole('button', { name: 'End session', exact: true }).click();
});

test('canvas stays circular in compact and expanded production layouts', async ({ page }) => {
  await page.addInitScript(() => {
    const tracks = [{ enabled: true, readyState: 'live', stop() {}, addEventListener() {} }];
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => ({ getTracks: () => tracks, getAudioTracks: () => tracks }),
    });
    class PC {
      localDescription = { sdp: 'v=0' };
      channel = {
        readyState: 'open',
        onmessage: null as ((event: { data: string }) => void) | null,
        onopen: null as (() => void) | null,
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
              },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=live-voice');
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const compact = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(compact.locator('.live-call-globe')).toBeVisible();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 390, height: 420 },
    { width: 884, height: 690 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const compactBox = await compact.locator('.live-call-globe').boundingBox();
    expect(Math.abs((compactBox?.width ?? 0) - (compactBox?.height ?? 1))).toBeLessThan(3);
    await compact.getByRole('button', { name: 'Expand', exact: true }).click();
    const immersiveBox = await page
      .getByRole('dialog', { name: 'Aethelios Live', exact: true })
      .locator('.live-call-globe')
      .boundingBox();
    expect(Math.abs((immersiveBox?.width ?? 0) - (immersiveBox?.height ?? 1))).toBeLessThan(3);
    await page.keyboard.press('Escape');
    await expect(compact).toBeVisible();
  }
  await compact.getByRole('button', { name: 'End session', exact: true }).click();
});

test('Still resize updates canvas bitmap and displayed size without restarting motion', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tracks = [{ enabled: true, readyState: 'live', stop() {}, addEventListener() {} }];
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => ({ getTracks: () => tracks, getAudioTracks: () => tracks }),
    });
    class PC {
      localDescription = { sdp: 'v=0' };
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
              },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=live-voice');
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  const compact = page.getByRole('region', { name: 'Persistent Aethelios voice controls' });
  await expect(compact.locator('.live-call-globe')).toHaveAttribute('data-earth', /ready|fallback/, {
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Pause ambient motion', exact: true }).click();
  await expect(compact.locator('.live-call-globe')).toHaveAttribute('data-motion', 'still');
  await compact.getByRole('button', { name: 'Expand', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aethelios Live', exact: true });
  const globe = dialog.locator('.live-call-globe');
  const canvas = globe.locator('.live-globe-canvas');
  await expect(globe).toHaveAttribute('data-motion', 'still');
  await expect(globe).toHaveAttribute('data-earth', /ready|fallback/, { timeout: 15000 });
  await canvas.evaluate((node) => node.setAttribute('data-keep', '1'));
  const readSize = () =>
    canvas.evaluate((node) => {
      const canvasNode = node as HTMLCanvasElement;
      return {
        bufferWidth: canvasNode.width,
        bufferHeight: canvasNode.height,
        cssWidth: canvasNode.clientWidth,
        cssHeight: canvasNode.clientHeight,
      };
    });
  const phone = await readSize();
  expect(phone.bufferWidth).toBe(phone.bufferHeight);
  expect(Math.abs(phone.cssWidth - phone.cssHeight)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 420 });
  await expect
    .poll(async () => (await readSize()).cssHeight, { timeout: 5000 })
    .not.toBe(phone.cssHeight);
  const short = await readSize();
  expect(short.bufferWidth).toBe(short.bufferHeight);
  expect(Math.abs(short.cssWidth - short.cssHeight)).toBeLessThan(2);
  expect(short.cssWidth).toBeLessThan(phone.cssWidth);
  expect(short.bufferWidth).toBeLessThanOrEqual(phone.bufferWidth);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(async () => (await readSize()).cssWidth, { timeout: 5000 })
    .not.toBe(short.cssWidth);
  const landscape = await readSize();
  expect(landscape.bufferWidth).toBe(landscape.bufferHeight);
  expect(Math.abs(landscape.cssWidth - landscape.cssHeight)).toBeLessThan(2);
  await expect(globe).toHaveAttribute('data-motion', 'still');
  await expect(canvas).toHaveAttribute('data-keep', '1');
  await page.keyboard.press('Escape');
  await compact.getByRole('button', { name: 'End session', exact: true }).click();
});

test('Ambient changes canvas pixels and Still or reduced motion stop after settling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=live-call-globe&scene=listening');
  const globe = page.locator('.live-call-globe-immersive');
  const canvas = globe.locator('.live-globe-canvas');
  await expect(globe).toHaveAttribute('data-earth', 'ready', { timeout: 15000 });
  await expect(globe).toHaveAttribute('data-emblem', 'ready', { timeout: 15000 });
  await expect(globe).toHaveAttribute('data-motion', 'ambient');
  await canvas.evaluate((node) => node.setAttribute('data-keep', '1'));
  const first = await canvasDigest(canvas);
  await expect.poll(async () => canvasDigest(canvas), { timeout: 1500 }).not.toBe(first);
  const moving = await canvasDigest(canvas);
  await page.getByRole('button', { name: 'Pause ambient motion', exact: true }).click();
  await expect(globe).toHaveAttribute('data-motion', 'still');
  await page.waitForTimeout(80);
  const still = await canvasDigest(canvas);
  await page.waitForTimeout(240);
  expect(await canvasDigest(canvas)).toBe(still);
  await page.getByRole('button', { name: 'Enable ambient motion', exact: true }).click();
  await expect(globe).toHaveAttribute('data-motion', 'ambient');
  await expect.poll(async () => canvasDigest(canvas), { timeout: 1500 }).not.toBe(still);
  await expect(canvas).toHaveAttribute('data-keep', '1');
  expect(moving).not.toBe(first);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(globe).toHaveAttribute('data-motion', 'still');
  await page.waitForTimeout(80);
  const reduced = await canvasDigest(canvas);
  await page.waitForTimeout(240);
  expect(await canvasDigest(canvas)).toBe(reduced);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(globe).toHaveAttribute('data-motion', 'ambient');
  await expect.poll(async () => canvasDigest(canvas), { timeout: 1500 }).not.toBe(reduced);
  await expect(canvas).toHaveAttribute('data-keep', '1');
});

test('transparent emblem leaves surrounding globe visible without a rectangular plate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/?mode=live-call-globe&scene=listening');
  const globe = page.locator('.live-call-globe-immersive');
  const canvas = globe.locator('.live-globe-canvas');
  await expect(globe).toHaveAttribute('data-emblem-id', 'original-full-logo');
  await expect(globe).toHaveAttribute('data-earth', 'ready', { timeout: 15000 });
  await expect(globe).toHaveAttribute('data-emblem', 'ready', { timeout: 15000 });
  const sample = await canvas.evaluate((node) => {
    const canvasNode = node as HTMLCanvasElement;
    const context = canvasNode.getContext('2d');
    if (!context) return null;
    const { data, width, height } = context.getImageData(0, 0, canvasNode.width, canvasNode.height);
    const at = (x: number, y: number) => {
      const index = (Math.round(y) * width + Math.round(x)) * 4;
      return [data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0] as const;
    };
    const cx = width / 2;
    const cy = height / 2;
    const radius = width * 0.46;
    const size = radius * 0.7;
    const dy = size * 0.035;
    const half = size / 2;
    const field = [
      at(cx - half + 3, cy - half + dy + 3),
      at(cx + half - 3, cy - half + dy + 3),
      at(cx - half + size * 0.18, cy - half + dy + size * 0.16),
      at(cx + half - size * 0.18, cy - half + dy + size * 0.16),
      at(cx + radius * 0.82, cy),
    ];
    return {
      center: at(cx, cy + dy),
      field,
      earth: at(cx + radius * 0.82, cy),
    };
  });
  expect(sample).toBeTruthy();
  expect(sample!.center[0]).toBeGreaterThan(90);
  expect(sample!.center[0]).toBeGreaterThan(sample!.center[2]);
  const plateLike = (pixel: readonly [number, number, number]) => {
    const luma = 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2];
    const chroma = Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2]);
    return luma > 170 && chroma < 28;
  };
  expect(sample!.field.some((pixel) => plateLike(pixel))).toBe(false);
  expect(sample!.earth[1]).toBeGreaterThan(sample!.earth[0] - 8);
  expect(sample!.earth[0]).toBeLessThan(140);
  expect(new Set(sample!.field.map((pixel) => pixel.join(','))).size).toBeGreaterThan(1);
});
