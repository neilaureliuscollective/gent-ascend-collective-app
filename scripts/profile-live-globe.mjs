import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';

const mocked = 'http://127.0.0.1:3102/?mode=live-call-globe&scene=listening';
const voice = 'http://127.0.0.1:3102/?mode=live-voice';

function percentile(samples, p) {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function summarize(label, sample) {
  return {
    label,
    elapsedMs: sample.elapsed,
    paints: sample.paints,
    fps: sample.fps,
    p50PaintMs: percentile(sample.paintSamples, 0.5),
    p95PaintMs: percentile(sample.paintSamples, 0.95),
    maxPaintMs: sample.paintSamples.length ? Math.max(...sample.paintSamples) : 0,
    bufferWidth: sample.bufferWidth,
    cssWidth: sample.cssWidth,
    sampleCount: sample.paintSamples.length,
    looping: sample.looping,
  };
}

async function waitForGlobe(page) {
  await page.locator('.live-call-globe').first().waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const node = [...document.querySelectorAll('.live-call-globe')].find(
      (el) => el.getClientRects()[0]?.width > 8,
    );
    const earth = node?.getAttribute('data-earth');
    const emblem = node?.getAttribute('data-emblem');
    return (
      (earth === 'ready' || earth === 'fallback') &&
      (emblem === 'ready' || emblem === 'missing')
    );
  });
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const canvas = [...document.querySelectorAll('.live-globe-canvas')].find(
      (el) => el.getClientRects()[0]?.width > 8,
    );
    const metrics = canvas?.__liveGlobeMetrics?.() ?? {
      paints: Number(canvas?.dataset.paints || 0),
      lastPaintMs: Number(canvas?.dataset.paintMs || 0),
      paintSamples: [],
      bufferWidth: canvas?.width ?? 0,
      cssWidth: canvas?.style.width ?? '',
      looping: false,
    };
    return {
      ...metrics,
      userAgent: navigator.userAgent,
    };
  });
}

async function sampleWindow(page, ms) {
  const origin = await readMetrics(page);
  const started = Date.now();
  await page.waitForTimeout(ms);
  const latest = await readMetrics(page);
  const elapsed = Date.now() - started;
  const paints = Math.max(0, latest.paints - origin.paints);
  return {
    elapsed,
    paints,
    fps: elapsed ? (paints / elapsed) * 1000 : 0,
    paintSamples: latest.paintSamples ?? [],
    bufferWidth: latest.bufferWidth,
    cssWidth: latest.cssWidth,
    looping: latest.looping,
    userAgent: latest.userAgent,
  };
}

async function fakeTransport(page) {
  await page.addInitScript(() => {
    const tracks = [{ enabled: true, readyState: 'live', stop() {}, addEventListener() {} }];
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => ({ getTracks: () => tracks, getAudioTracks: () => tracks }),
    });
    class PC {
      localDescription = { sdp: 'v=0' };
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

const browser = await chromium.launch({ headless: true });
const hardware = {
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpus: os.cpus().map((cpu) => cpu.model)[0],
  cpuCount: os.cpus().length,
  totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
  note: 'headless Chromium in the cloud agent VM; not a physical phone or Fold',
};

const windows = [
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'fold-emulated-884x690', width: 884, height: 690 },
];

const sustained = [];
for (const viewport of windows) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await page.goto(mocked);
  await waitForGlobe(page);
  await page.getByRole('button', { name: 'Enable ambient motion', exact: true }).click().catch(() => {});
  const sample = await sampleWindow(page, 30000);
  const row = { viewport: viewport.name, ...summarize(`30s ambient ${viewport.name}`, sample) };
  sustained.push(row);
  console.log(JSON.stringify(row));
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await fakeTransport(page);
await page.goto(voice);
await page.getByRole('button', { name: 'Aethelios Live', exact: true }).click();
const start = page.getByRole('button', { name: 'Start voice', exact: true });
if (await start.count()) {
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await start.click();
}
await page.getByRole('region', { name: 'Persistent Aethelios voice controls' }).waitFor();
await waitForGlobe(page);
const beforeTyping = await readMetrics(page);
await page.getByRole('button', { name: 'Expand voice', exact: true }).click();
await page.getByRole('dialog', { name: 'Aethelios Live', exact: true }).waitFor();
await waitForGlobe(page);
const typeField = page.getByLabel('Type in this voice session');
if (await typeField.count()) await typeField.fill('Typed while the globe is rotating');
await page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
await page.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
await page.evaluate(() => {
  window.voiceChannel?.onmessage?.({
    data: JSON.stringify({
      type: 'output_audio_buffer.started',
      response_id: 'synthetic-response',
    }),
  });
});
await page.waitForTimeout(400);
const speaking = await readMetrics(page);
await page.getByRole('button', { name: 'Stop playback', exact: true }).click();
await page.waitForTimeout(80);
const interrupted = await readMetrics(page);
await page.setViewportSize({ width: 390, height: 420 });
await page.waitForTimeout(300);
const resized = await readMetrics(page);
await page.setViewportSize({ width: 390, height: 844 });
await page.keyboard.press('Escape');
await page
  .getByRole('region', { name: 'Persistent Aethelios voice controls' })
  .waitFor();
await page.getByRole('button', { name: 'Pause ambient motion', exact: true }).click();
await page.waitForTimeout(400);
const still = await readMetrics(page);
await page.getByRole('button', { name: 'Enable ambient motion', exact: true }).click();
const hidden = await page.evaluate(async () => {
  const canvas = [...document.querySelectorAll('.live-globe-canvas')].find(
    (el) => el.getClientRects()[0]?.width > 8,
  );
  const before = canvas?.__liveGlobeMetrics?.().paints ?? Number(canvas?.dataset.paints || 0);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const afterHidden = canvas?.__liveGlobeMetrics?.() ?? {};
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
  return {
    grew: (afterHidden.paints ?? 0) - before,
    looping: afterHidden.looping ?? false,
  };
});
const afterEscape = await readMetrics(page);
await page.close();
await browser.close();

const report = {
  capturedAt: new Date().toISOString(),
  hardware,
  targetFps: 30,
  proposed: { renderedFps: 28, p95PaintMs: 12 },
  sustained,
  exercised: {
    paintsDuringTypingAndControls: Math.max(0, speaking.paints - beforeTyping.paints),
    interruptedPaintsDelta: Math.max(0, interrupted.paints - speaking.paints),
    resizeBufferWidth: resized.bufferWidth,
    stillLooping: still.looping,
    hidden,
    compactAfterEscapeLooping: afterEscape.looping,
    userAgent: afterEscape.userAgent,
  },
  priorRenderer: {
    comparedInThisRun: false,
    reason:
      '84e694aa was not remounted for a 30s same-environment baseline. That renderer allocated ImageData and computed liveGlobeSphereCoords(rotation) plus lighting every pixel. Current reuses ImageData and caches lighting. Earlier 2.5s current sample at 300px was 29.99fps / p95 6.4ms and is not a 30s phone proof.',
  },
  limitations: [
    'Headless Chromium on a cloud Linux VM, not a physical phone or unfolded Fold.',
    '884×690 is an emulated viewport.',
    'No 30s baseline from the prior renderer in this same run.',
    '30fps is the rAF cadence (stamp-last >= 33), not a forced vsync.',
  ],
};

await writeFile(
  'docs/evidence/live-call-globe/frame-timing-30s.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
await writeFile(
  'docs/evidence/live-call-globe/emerald-after/frame-timing-30s.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify({ sustained: report.sustained, exercised: report.exercised }, null, 2));
