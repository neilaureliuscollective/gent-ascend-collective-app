// Review-only evidence. Synthetic fixture events are labeled. No paid provider calls.
// Holds surrounding UI state long enough to read labels. Does not slow product motion.
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const artifacts = resolve('/opt/cursor/artifacts');
const shots = resolve(artifacts, 'screenshots');
const videos = resolve(artifacts, 'videos');
mkdirSync(shots, { recursive: true });
mkdirSync(videos, { recursive: true });

const OPEN = 2000;
const DWELL = 2200;
const END = 2000;

const evidence = {
  generatedAt: new Date().toISOString(),
  label: 'Deterministic fixture and signed-out Next Talk. Not a paid Live or authenticated provider proof.',
  timings: { openingMs: OPEN, dwellMs: DWELL, endingMs: END },
  nextTalk: [],
  fixture: [],
};

async function headerFits(page) {
  const width = page.viewportSize().width;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const buttons = page.locator('.talk-toolbar button:visible');
  const count = await buttons.count();
  const boxes = [];
  for (let i = 0; i < count; i += 1) {
    const box = await buttons.nth(i).boundingBox();
    boxes.push(box);
    if (!box || box.x < -1 || box.x + box.width > width + 1) {
      return { overflow, count, ok: false, boxes };
    }
  }
  return { overflow, count, ok: overflow && count > 0, boxes };
}

async function verifyNextTalk(browser) {
  const page = await browser.newPage();
  const widths = [
    { width: 320, height: 844 },
    { width: 344, height: 844 },
    { width: 390, height: 844 },
    { width: 690, height: 820 },
    { width: 690, height: 420 },
  ];
  for (const viewport of widths) {
    await page.setViewportSize(viewport);
    const response = await page.goto('http://127.0.0.1:3100/app/aethelios', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('.talk-page .talk-toolbar, .aurelius-composer', { timeout: 20000 });
    const status = response?.status() ?? 0;
    const toolbar = await page.locator('.talk-toolbar').count();
    const composer = page.getByLabel('Message Aethelios', { exact: true });
    const composerVisible = await composer.count();
    let header = { ok: toolbar === 0, overflow: true, count: 0, boxes: [] };
    if (toolbar) header = await headerFits(page);
    let focus = null;
    if (composerVisible) {
      await composer.click();
      await page.waitForTimeout(400);
      focus = await page.evaluate(() => {
        const field = document.querySelector('.talk-page textarea.talk-input, textarea.talk-input');
        const shell = document.querySelector('.talk-page .aurelius-composer, .aurelius-composer');
        const fieldStyle = field ? getComputedStyle(field) : null;
        const shellStyle = shell ? getComputedStyle(shell) : null;
        return {
          keyboard: document.querySelector('.talk-page')?.getAttribute('data-keyboard') ?? null,
          inner: fieldStyle?.outlineStyle ?? null,
          shell: shellStyle?.outlineStyle ?? null,
          shellColor: shellStyle?.outlineColor ?? null,
          shellWidth: shellStyle?.outlineWidth ?? null,
        };
      });
      if (viewport.height === 420) {
        await page.evaluate(() => {
          document.querySelector('.talk-page')?.setAttribute('data-keyboard', 'open');
        });
      }
      header = toolbar ? await headerFits(page) : header;
    }
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '24px';
    });
    const zoomed = toolbar ? await headerFits(page) : { ok: true, overflow: true, count: 0 };
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
    const name = `next-talk-${viewport.width}x${viewport.height}`;
    await page.screenshot({ path: resolve(shots, `${name}.png`), fullPage: true });
    evidence.nextTalk.push({
      viewport,
      status,
      toolbar,
      composerVisible: Boolean(composerVisible),
      header,
      zoomed,
      focus,
    });
  }
  await page.close();
}

async function recordClip(browser, name, viewport, startUrl, run, media = {}) {
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: videos, size: viewport },
    reducedMotion: media.reducedMotion ?? 'no-preference',
  });
  const page = await context.newPage();
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.talk-page .talk-toolbar, .review-controls, .aurelius-composer');
  await page.waitForTimeout(OPEN);
  await run(page);
  await page.waitForTimeout(END);
  const video = page.video();
  await page.close();
  const source = await video.path();
  await context.close();
  const dest = resolve(videos, `${name}.webm`);
  try {
    renameSync(source, dest);
    evidence.fixture.push({ name, dest, renamed: true, startUrl });
  } catch {
    evidence.fixture.push({ name, source, dest, renamed: false, startUrl });
  }
  return dest;
}

async function recordReviewClips(browser) {
  const fixture = 'http://127.0.0.1:3102/motion-integration.html';
  const nextTalk = 'http://127.0.0.1:3100/app/aethelios';

  await recordClip(browser, 'review-next-talk-narrow-header', { width: 344, height: 844 }, nextTalk, async (page) => {
    await page.waitForSelector('.talk-page .talk-toolbar');
    await page.getByLabel('Message Aethelios', { exact: true }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Tools & context' }).click();
    await page.waitForTimeout(DWELL);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(DWELL);
    await page.setViewportSize({ width: 344, height: 420 });
    await page.evaluate(() => {
      document.querySelector('.talk-page')?.setAttribute('data-keyboard', 'open');
    });
    await page.waitForTimeout(DWELL);
  });

  await recordClip(browser, 'review-text-send-response-saved', { width: 768, height: 900 }, fixture, async (page) => {
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic request');
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Emit response text' }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Emit saving event' }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
    await page.waitForTimeout(DWELL);
  });

  await recordClip(browser, 'review-artifact-approval-complete', { width: 768, height: 900 }, fixture, async (page) => {
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic image request');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Emit image approval' }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Emit image artifact' }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Emit completed image' }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
    await page.waitForTimeout(DWELL);
  });

  await recordClip(browser, 'review-artifact-stop-and-failure', { width: 768, height: 900 }, fixture, async (page) => {
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic cancel artifacts');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Emit completed image' }).click();
    await page.getByRole('button', { name: 'Emit image approval' }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Stop reply' }).click();
    await page.waitForTimeout(DWELL);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.talk-page .talk-toolbar');
    await page.waitForTimeout(OPEN);
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic fail artifacts');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Emit image artifact' }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Emit failure' }).click();
    await page.waitForTimeout(DWELL);
  });

  await recordClip(browser, 'review-voice-listening-playback-end', { width: 768, height: 900 }, fixture, async (page) => {
    await page.getByLabel('Surface', { exact: true }).selectOption('voice');
    await page.waitForTimeout(DWELL);
    await page.getByLabel('Voice phase', { exact: true }).selectOption('listening');
    await page.getByLabel('Synthetic audio level', { exact: true }).fill('0');
    await page.waitForTimeout(DWELL);
    await page.getByLabel('Synthetic audio level', { exact: true }).fill('0.8');
    await page.waitForTimeout(DWELL);
    await page.getByLabel('Voice phase', { exact: true }).selectOption('speaking');
    await page.getByLabel('Synthetic output level', { exact: true }).fill('0.7');
    await page.waitForTimeout(DWELL);
    await page.getByLabel('Block playback').check();
    await page.waitForTimeout(DWELL);
    await page.getByLabel('Voice phase', { exact: true }).selectOption('ended');
    await page.waitForTimeout(DWELL);
  });

  await recordClip(
    browser,
    'review-reduced-motion-still',
    { width: 768, height: 900 },
    fixture,
    async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic reduced motion');
      await page.waitForTimeout(DWELL);
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.waitForTimeout(DWELL);
      const still = page
        .getByLabel('Pause ambient motion')
        .or(page.getByLabel('Enable ambient motion'));
      if (await still.count()) await still.first().click();
      await page.waitForTimeout(DWELL);
      await page.getByRole('button', { name: 'Emit response text' }).click();
      await page.waitForTimeout(DWELL);
      await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
      await page.waitForTimeout(DWELL);
    },
    { reducedMotion: 'reduce' },
  );

  await recordClip(browser, 'review-persistent-notice-second-request', { width: 768, height: 900 }, `${fixture}?imageAccess=unavailable`, async (page) => {
    await page.getByLabel('Message Aethelios', { exact: true }).fill('First synthetic turn');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Emit response text' }).click();
    await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
    await page.waitForTimeout(DWELL);
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Second synthetic turn');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Emit saving event' }).click();
    await page.waitForTimeout(DWELL);
    await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
    await page.waitForTimeout(DWELL);
  });
}

const browser = await chromium.launch({ headless: true });
try {
  await verifyNextTalk(browser);
  await recordReviewClips(browser);
} finally {
  await browser.close();
}
writeFileSync(resolve(artifacts, 'conversation-motion-evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
