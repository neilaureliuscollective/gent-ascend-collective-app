import { test, expect, type Page } from './fixtures';
async function cameraFixture(page: Page, denied = false) {
  await page.addInitScript((denied) => {
    const state = { calls: 0, stopped: 0 };
    Object.assign(window, { mirrorCamera: state });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async (constraints: MediaStreamConstraints) => {
        state.calls++;
        if (constraints.audio !== false) throw new Error('Audio must remain off');
        if (denied) throw new DOMException('blocked', 'NotAllowedError');
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 640;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#327568';
        ctx.fillRect(0, 0, 480, 640);
        const stream = canvas.captureStream(10);
        stream.getTracks().forEach((track) => {
          const stop = track.stop.bind(track);
          track.stop = () => {
            state.stopped++;
            stop();
          };
        });
        return stream;
      },
    });
  }, denied);
}
for (const width of [360, 768, 1440]) {
  test(`Mirror manual capture, review consent and cleanup at ${width}px (camera fixture)`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 850 });
    await cameraFixture(page);
    await page.route('**/mirror/capture-worker.js', (route) => route.abort());
    let posts = 0;
    await page.route('**/api/grooming/scan', (route) => {
      posts++;
      return route.fulfill({ status: 503, json: { error: 'Assessment temporarily unavailable.' } });
    });
    await page.goto('http://127.0.0.1:3102/?mode=mirror');
    expect(
      await page.evaluate(
        () => (window as unknown as { mirrorCamera: { calls: number } }).mirrorCamera.calls,
      ),
    ).toBe(0);
    await page.getByRole('button', { name: 'Start scan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Capture now', exact: true })).toBeEnabled();
    await page.screenshot({ path: info.outputPath('mirror-camera.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Capture now', exact: true }).click();
      if (i < 2) await expect(page.locator('.mirror-top')).toContainText(`VIEW ${i + 2} OF 3`);
    }
    await expect(page.getByRole('dialog')).toContainText('Ready for a closer look?');
    expect(posts).toBe(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { mirrorCamera: { stopped: number } }).mirrorCamera.stopped,
      ),
    ).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Add optional hair view' }).click();
    await expect(page.getByRole('status')).toContainText('Capture when ready.');
    await expect(page.getByRole('checkbox', { name: 'Auto-capture when steady' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Skip optional view' }).click();
    await expect(page.locator('.mirror-thumbnails img')).toHaveCount(3);
    await page.getByRole('button', { name: 'Retake front', exact: true }).click();
    await page.getByRole('button', { name: 'Capture now', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Ready for a closer look?');
    await page.getByRole('button', { name: 'Send photos & assess' }).click();
    await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
    expect(posts).toBe(1);
    await expect(page.getByRole('button', { name: 'Retake front', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Close Review your scan' }).click();
    await expect(page.getByRole('button', { name: 'Continue scan', exact: true })).toBeFocused();
  });
}
test('camera permission denial offers recovery and photo fallback', async ({ page }) => {
  await cameraFixture(page, true);
  await page.goto('http://127.0.0.1:3102/?mode=mirror');
  await page.getByRole('button', { name: 'Start scan', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Allow camera access');
  await expect(page.getByRole('button', { name: 'Try camera again' })).toBeEnabled();
  await expect(page.getByLabel('Use existing photo', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Close Ascend Mirror' }).click();
});
test('automatic steady capture advances three views and never sends before approval (tracker fixture)', async ({
  page,
}) => {
  await cameraFixture(page);
  let workers = 0;
  await page.route('**/mirror/capture-worker.js', (route) => {
    const turn = [0.5, 0.78, 0.22][workers++] ?? 0.5;
    return route.fulfill({
      contentType: 'text/javascript',
      body: `self.onmessage=({data})=>{if(data.type==='init')self.postMessage({type:'ready'});if(data.type==='frame'){data.frame.close();self.postMessage({type:'result',faces:1,outline:[{x:.5,y:.2},{x:.5,y:.8},{x:.25,y:.5},{x:.75,y:.5}],brightness:100,turn:${turn}})}}`,
    });
  });
  let posts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/grooming/scan')) posts++;
  });
  await page.goto('http://127.0.0.1:3102/?mode=mirror');
  await page.getByRole('button', { name: 'Start scan', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Ready for a closer look?', {
    timeout: 20000,
  });
  await expect(page.locator('.mirror-thumbnails img')).toHaveCount(3);
  expect(posts).toBe(0);
});
test('real self-hosted MediaPipe worker processes an image on-device', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/?mode=mirror');
  const reading = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/brand/aethelios-portrait.webp';
    await image.decode();
    const frame = await createImageBitmap(image, {
      resizeWidth: 400,
      resizeHeight: Math.round((400 * image.naturalHeight) / image.naturalWidth),
    });
    return new Promise<{ type: string; faces?: number; outline?: unknown[] }>((resolve, reject) => {
      const worker = new Worker('/mirror/capture-worker.js');
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker timeout'));
      }, 45000);
      worker.onerror = (e) => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(e.message));
      };
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready')
          worker.postMessage({ type: 'frame', frame, time: performance.now() }, [frame]);
        else if (data.type !== 'loading') {
          clearTimeout(timer);
          worker.terminate();
          resolve(data);
        }
      };
      worker.postMessage({ type: 'init' });
    });
  });
  expect(reading.type).toBe('result');
  expect(reading.faces).toBe(1);
  expect(reading.outline).toHaveLength(4);
});
test('production document permits same-origin camera and retains microphone and location denial', async ({
  request,
}) => {
  for (const path of ['/', '/app', '/app/grooming/scan']) {
    const response = await request.get(path);
    expect(response.headers()['permissions-policy']).toBe(
      'camera=(self), microphone=(), geolocation=()',
    );
  }
  expect((await request.get('/dev')).status()).toBe(404);
});

test('native camera API is allowed by the production document policy (synthetic Chromium camera)', async ({
  playwright,
}) => {
  const browser = await playwright.chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--no-zygote',
      '--single-process',
      '--disable-dev-shm-usage',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  });
  try {
    const context = await browser.newContext({ permissions: ['camera'] });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3100/enter');
    const result = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      const track = stream.getVideoTracks()[0]!;
      const live = track.readyState;
      const audio = stream.getAudioTracks().length;
      stream.getTracks().forEach((t) => t.stop());
      return { live, ended: track.readyState, audio };
    });
    expect(result).toEqual({ live: 'live', ended: 'ended', audio: 0 });
  } finally {
    await browser.close();
  }
});

test('closing during delayed camera permission discards and stops the late stream', async ({
  page,
}) => {
  await cameraFixture(page);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async (c: MediaStreamConstraints) => {
        await new Promise((r) => setTimeout(r, 800));
        return original(c);
      },
    });
  });
  await page.goto('http://127.0.0.1:3102/?mode=mirror');
  await page.getByRole('button', { name: 'Start scan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Opening camera…' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Ascend Mirror' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { mirrorCamera: { stopped: number } }).mirrorCamera.stopped,
      ),
    )
    .toBe(1);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
