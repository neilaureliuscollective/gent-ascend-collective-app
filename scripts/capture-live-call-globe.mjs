import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const out = 'docs/evidence/live-call-globe';
const mocked = 'http://127.0.0.1:3102/?mode=live-call-globe';
const voice = 'http://127.0.0.1:3102/?mode=live-voice';

async function waitForGlobe(page) {
  const globe = page.locator('.live-call-globe').first();
  await globe.waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const node = document.querySelector('.live-call-globe');
    const earth = node?.getAttribute('data-earth');
    const emblem = node?.getAttribute('data-emblem');
    return (earth === 'ready' || earth === 'fallback') && (emblem === 'ready' || emblem === 'missing');
  });
}

async function fakeTransport(page) {
  await page.addInitScript(() => {
    const tracks = [
      { enabled: true, readyState: 'live', stop() {}, addEventListener() {} },
    ];
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
      data: JSON.stringify({ type: 'output_audio_buffer.started', response_id: 'synthetic-response' }),
    });
  });
}

async function listen(page) {
  await page.evaluate(() => {
    window.voiceChannel?.onmessage?.({
      data: JSON.stringify({ type: 'output_audio_buffer.stopped', response_id: 'synthetic-response' }),
    });
  });
}

const browser = await chromium.launch({ headless: true });
await mkdir(out, { recursive: true });

const shots = [
  { name: 'phone-listening.png', width: 390, height: 844, scene: 'listening' },
  { name: 'phone-speaking.png', width: 390, height: 844, scene: 'speaking' },
  { name: 'phone-muted.png', width: 390, height: 844, scene: 'muted' },
  { name: 'phone-ended.png', width: 390, height: 844, scene: 'ended' },
  { name: 'phone-compact.png', width: 390, height: 844, scene: 'compact' },
  { name: 'fold-listening.png', width: 884, height: 690, scene: 'listening' },
  { name: 'desktop-connecting.png', width: 1440, height: 900, scene: 'connecting' },
  { name: 'desktop-speaking.png', width: 1440, height: 900, scene: 'speaking' },
];

for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
  await page.goto(`${mocked}&scene=${shot.scene}`);
  await waitForGlobe(page);
  await page.screenshot({ path: `${out}/${shot.name}`, animations: 'disabled' });
  await page.close();
}

const liveShots = [
  { name: 'live-voice-phone-compact.png', width: 390, height: 844, immersive: false },
  { name: 'live-voice-phone-immersive.png', width: 390, height: 844, immersive: true },
  { name: 'live-voice-fold-compact.png', width: 884, height: 690, immersive: false },
  { name: 'live-voice-fold-immersive.png', width: 884, height: 690, immersive: true },
  { name: 'live-voice-desktop-compact.png', width: 1440, height: 900, immersive: false },
  { name: 'live-voice-desktop-immersive.png', width: 1440, height: 900, immersive: true },
  { name: 'live-voice-phone-short-immersive.png', width: 390, height: 420, immersive: true },
];

for (const shot of liveShots) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
  await fakeTransport(page);
  await page.goto(voice);
  await startVoice(page);
  if (shot.immersive) {
    await page.getByRole('button', { name: 'Expand', exact: true }).click();
    await page.getByRole('dialog', { name: 'Aethelios Live', exact: true }).waitFor();
  }
  await waitForGlobe(page);
  await page.screenshot({ path: `${out}/${shot.name}`, animations: 'disabled' });
  await page.close();
}

const record = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: out, size: { width: 390, height: 844 } },
});
const page = await record.newPage();
await fakeTransport(page);
await page.goto(voice);
await startVoice(page);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Expand', exact: true }).click();
await waitForGlobe(page);
await page.waitForTimeout(2000);
await speak(page);
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Stop playback', exact: true }).click();
await listen(page);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
await page.keyboard.press('Escape');
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Pause ambient motion', exact: true }).click();
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Enable ambient motion', exact: true }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'End session', exact: true }).click();
await page.waitForTimeout(2500);
const video = page.video();
await page.close();
if (video) {
  await video.saveAs(`${out}/mocked_live_call_states_tour.webm`);
  await video.delete().catch(() => {});
}
await record.close();
await browser.close();
console.log('captured production Live layouts and labeled fake-transport tour');
