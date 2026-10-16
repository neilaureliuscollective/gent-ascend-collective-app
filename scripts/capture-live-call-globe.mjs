import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const out = 'docs/evidence/live-call-globe';
const mocked = 'http://127.0.0.1:3102/?mode=live-call-globe';
const voice = 'http://127.0.0.1:3102/?mode=live-voice';

async function waitForGlobe(page) {
  const canvas = page.locator('.live-globe-canvas').first();
  await canvas.waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const node = document.querySelector('.live-globe-canvas');
    return Boolean(node && node.width > 8 && node.height > 8);
  });
  await page.waitForTimeout(1800);
}

async function fakeTransport(page) {
  await page.addInitScript(() => {
    const tracks = [
      {
        enabled: true,
        readyState: 'live',
        stop() {},
        addEventListener() {},
      },
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
  await page.getByRole('checkbox', { name: /I consent/ }).check();
  await page.getByRole('button', { name: 'Start voice', exact: true }).click();
  await page.getByRole('region', { name: 'Persistent Aethelios voice controls' }).waitFor();
  await waitForGlobe(page);
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
await page.goto(`${mocked}&tour=1`);
await waitForGlobe(page);
await page.waitForTimeout(36000);
const video = page.video();
await page.close();
if (video) {
  await video.saveAs(`${out}/mocked_live_call_states_tour.webm`);
  await video.delete().catch(() => {});
}
await record.close();
await browser.close();
console.log('captured mocked after-shots, fake-transport Live layouts, and labeled tour');
