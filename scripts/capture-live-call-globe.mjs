import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'docs/evidence/live-call-globe';
const after = `${out}/emerald-after`;
const mocked = 'http://127.0.0.1:3102/?mode=live-call-globe';
const voice = 'http://127.0.0.1:3102/?mode=live-voice';

function percentile(samples, p) {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

async function waitForGlobe(page) {
  const globe = page.locator('.live-call-globe').first();
  await globe.waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const node = document.querySelector('.live-call-globe');
    const earth = node?.getAttribute('data-earth');
    const emblem = node?.getAttribute('data-emblem');
    return (
      (earth === 'ready' || earth === 'fallback') &&
      (emblem === 'ready' || emblem === 'missing')
    );
  });
}

async function fakeTransport(page) {
  await page.addInitScript(() => {
    const tracks = [{ enabled: true, readyState: 'live', stop() {}, addEventListener() {} }];
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => ({ getTracks: () => tracks, getAudioTracks: () => tracks }),
    });
    class PC {
      localDescription = { sdp: 'v=0' };
      connectionState = 'new';
      channel = {
        readyState: 'open',
        onmessage: null,
        onopen: null,
        onclose: null,
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
        window.voiceChannel = this.channel;
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
    return route.fulfill({
      json: {
        answer: 'v=0\r\na=synthetic-answer',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      },
    });
  });
}

async function startVoice(page) {
  await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
  const start = page.getByRole('button', { name: 'Start voice', exact: true });
  if (await start.count()) {
    await page.getByRole('checkbox', { name: /I consent/ }).check();
    await start.click();
  }
  await page.getByRole('region', { name: 'Persistent Aethelios voice controls' }).waitFor();
  await waitForGlobe(page);
}

async function speak(page) {
  await page.evaluate(() => {
    window.voiceChannel?.onmessage?.({
      data: JSON.stringify({
        type: 'output_audio_buffer.started',
        response_id: 'synthetic-response',
      }),
    });
  });
}

async function listen(page) {
  await page.evaluate(() => {
    window.voiceChannel?.onmessage?.({
      data: JSON.stringify({
        type: 'output_audio_buffer.stopped',
        response_id: 'synthetic-response',
      }),
    });
  });
}

async function shotPair(page, name, folder) {
  await page.screenshot({ path: `${folder}/${name}`, animations: 'disabled' });
  const box = await page.evaluate(() => {
    const node = [...document.querySelectorAll('.live-call-globe')].find(
      (el) => el.getClientRects()[0]?.width > 8,
    );
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return {
      x: Math.max(0, rect.x),
      y: Math.max(0, rect.y),
      width: Math.min(rect.width, window.innerWidth),
      height: Math.min(rect.height, window.innerHeight),
    };
  });
  if (box && box.width > 8 && box.height > 8) {
    await page.screenshot({
      path: `${folder}/${name.replace('.png', '-globe.png')}`,
      clip: box,
      animations: 'disabled',
    });
  }
}

const browser = await chromium.launch({ headless: true });
await mkdir(after, { recursive: true });

const stills = [
  { name: 'phone-listening.png', width: 390, height: 844, scene: 'listening' },
  { name: 'phone-compact.png', width: 390, height: 844, scene: 'compact' },
  { name: 'fold-listening.png', width: 884, height: 690, scene: 'listening' },
  { name: 'phone-short-immersive.png', width: 390, height: 420, scene: 'listening' },
  { name: 'phone-landscape.png', width: 844, height: 390, scene: 'listening' },
  { name: 'desktop-speaking.png', width: 1440, height: 900, scene: 'speaking' },
  { name: 'desktop-immersive.png', width: 1440, height: 900, scene: 'listening' },
];

for (const shot of stills) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    reducedMotion: 'reduce',
  });
  await page.goto(`${mocked}&scene=${shot.scene}`);
  await waitForGlobe(page);
  await shotPair(page, shot.name, after);
  if (!shot.name.includes('landscape') && !shot.name.includes('short') && !shot.name.includes('immersive')) {
    await page.screenshot({ path: `${out}/${shot.name}`, animations: 'disabled' });
  }
  await page.close();
}

const liveStills = [
  { name: 'live-voice-phone-compact.png', width: 390, height: 844, immersive: false },
  { name: 'live-voice-phone-immersive.png', width: 390, height: 844, immersive: true },
  { name: 'live-voice-fold-compact.png', width: 884, height: 690, immersive: false },
  { name: 'live-voice-fold-immersive.png', width: 884, height: 690, immersive: true },
  { name: 'live-voice-desktop-compact.png', width: 1440, height: 900, immersive: false },
  { name: 'live-voice-desktop-immersive.png', width: 1440, height: 900, immersive: true },
  { name: 'live-voice-phone-short-immersive.png', width: 390, height: 420, immersive: true },
  { name: 'live-voice-phone-landscape.png', width: 844, height: 390, immersive: true },
];

for (const shot of liveStills) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    reducedMotion: 'reduce',
  });
  await fakeTransport(page);
  await page.goto(voice);
  await startVoice(page);
  if (shot.immersive) {
    await page.getByRole('button', { name: 'Expand voice', exact: true }).click();
    await page.getByRole('dialog', { name: 'Aethelios Live', exact: true }).waitFor();
  }
  await waitForGlobe(page);
  await shotPair(page, shot.name, after);
  await page.screenshot({ path: `${out}/${shot.name}`, animations: 'disabled' });
  await page.close();
}

const gallery = [
  { name: 'phone-speaking.png', width: 390, height: 844, scene: 'speaking' },
  { name: 'phone-muted.png', width: 390, height: 844, scene: 'muted' },
  { name: 'phone-ended.png', width: 390, height: 844, scene: 'ended' },
  { name: 'desktop-connecting.png', width: 1440, height: 900, scene: 'connecting' },
];
for (const shot of gallery) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
  await page.goto(`${mocked}&scene=${shot.scene}`);
  await waitForGlobe(page);
  await page.screenshot({ path: `${out}/${shot.name}`, animations: 'disabled' });
  await page.close();
}

const profilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await profilePage.goto(`${mocked}&scene=listening`);
await waitForGlobe(profilePage);
await profilePage.getByRole('button', { name: 'Enable ambient motion', exact: true }).click().catch(() => {});
const current = await profilePage.locator('.live-globe-canvas').evaluate(async (node) => {
  const canvas = node;
  const started = performance.now();
  const origin =
    canvas.__liveGlobeMetrics?.() ?? {
      paints: Number(canvas.dataset.paints || 0),
      lastPaintMs: Number(canvas.dataset.paintMs || 0),
      paintSamples: [],
    };
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const latest = canvas.__liveGlobeMetrics?.() ?? {
    paints: Number(canvas.dataset.paints || 0),
    lastPaintMs: Number(canvas.dataset.paintMs || 0),
    paintSamples: [],
    bufferWidth: canvas.width,
  };
  const elapsed = performance.now() - started;
  const paints = Math.max(0, latest.paints - origin.paints);
  return {
    elapsed,
    paints,
    fps: (paints / elapsed) * 1000,
    lastPaintMs: latest.lastPaintMs,
    paintSamples: latest.paintSamples ?? [],
    bufferWidth: latest.bufferWidth ?? canvas.width,
    userAgent: navigator.userAgent,
  };
});
const hiddenCheck = await profilePage.evaluate(async () => {
  const canvas = document.querySelector('.live-globe-canvas');
  const before = canvas.__liveGlobeMetrics?.().paints ?? Number(canvas.dataset.paints || 0);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((resolve) => setTimeout(resolve, 400));
  const afterHidden = canvas.__liveGlobeMetrics?.().paints ?? Number(canvas.dataset.paints || 0);
  const looping = canvas.__liveGlobeMetrics?.().looping ?? false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
  return { before, afterHidden, looping, grew: afterHidden - before };
});
await profilePage.close();

const timing = {
  capturedAt: new Date().toISOString(),
  device: 'headless Chromium in the cloud agent environment, not a physical phone or Fold',
  targetFps: 30,
  proposed: { renderedFps: 28, p95PaintMs: 12 },
  current: {
    fps: current.fps,
    paints: current.paints,
    elapsedMs: current.elapsed,
    lastPaintMs: current.lastPaintMs,
    p50PaintMs: percentile(current.paintSamples, 0.5),
    p95PaintMs: percentile(current.paintSamples, 0.95),
    bufferWidth: current.bufferWidth,
    sampleCount: current.paintSamples.length,
    userAgent: current.userAgent,
  },
  hidden: hiddenCheck,
  priorRenderer:
    '84e694aa allocated ImageData every paint and computed liveGlobeSphereCoords(rotation) plus lighting per pixel. Current reuses ImageData, caches sphere lighting, and adds rotation to lon0. Pixel budget remains 480.',
  limitations:
    'Frame timing is headless Chromium on the cloud VM. Emulated 884×690 is not physical Fold testing. 30fps is the rAF cadence (stamp-last >= 33), not a forced vsync.',
};
await writeFile(`${after}/frame-timing.json`, `${JSON.stringify(timing, null, 2)}\n`);
await writeFile(`${out}/frame-timing.json`, `${JSON.stringify(timing, null, 2)}\n`);

const record = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: after, size: { width: 390, height: 844 } },
});
const page = await record.newPage();
await fakeTransport(page);
await page.goto(voice);
await startVoice(page);
await page.waitForTimeout(1800);
await page.getByRole('button', { name: 'Expand voice', exact: true }).click();
await waitForGlobe(page);
await page.waitForTimeout(1500);
await speak(page);
await page.waitForTimeout(1800);
await page.getByRole('button', { name: 'Stop playback', exact: true }).click();
await listen(page);
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Pause ambient motion', exact: true }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Enable ambient motion', exact: true }).click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'End session', exact: true }).click();
await page.waitForTimeout(1500);
const video = page.video();
await page.close();
if (video) {
  await video.saveAs(`${after}/emerald-motion.webm`);
  await video.saveAs(`${out}/mocked_live_call_states_tour.webm`);
  await video.delete().catch(() => {});
}
await record.close();
await browser.close();
console.log('captured emerald after stills, motion tour, and frame timing');
console.log(JSON.stringify(timing.current, null, 2));
