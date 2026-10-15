// Review-only evidence. Synthetic fixture events are labeled. No paid provider calls.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const artifacts = resolve('/opt/cursor/artifacts');
const shots = resolve(artifacts, 'screenshots');
const videos = resolve(artifacts, 'videos');
mkdirSync(shots, { recursive: true });
mkdirSync(videos, { recursive: true });

const evidence = {
  generatedAt: new Date().toISOString(),
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
    await page.waitForSelector('.talk-page .talk-toolbar, .aurelius-composer', {
      timeout: 20000,
    });
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
          innerColor: fieldStyle?.outlineColor ?? null,
          shell: shellStyle?.outlineStyle ?? null,
          shellColor: shellStyle?.outlineColor ?? null,
          shellWidth: shellStyle?.outlineWidth ?? null,
        };
      });
      if (viewport.height === 420) {
        await page.evaluate(() => {
          const root = document.querySelector('.talk-page');
          root?.setAttribute('data-keyboard', 'open');
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

async function recordClip(browser, name, viewport, run) {
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: videos, size: viewport },
    reducedMotion: name.includes('reduced') ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3102/motion-integration.html', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('.talk-page .talk-toolbar, .review-controls');
  await page.waitForTimeout(700);
  await run(page);
  await page.waitForTimeout(900);
  const video = page.video();
  await page.close();
  const source = await video.path();
  await context.close();
  const dest = resolve(videos, `${name}.webm`);
  const { renameSync } = await import('node:fs');
  try {
    renameSync(source, dest);
  } catch {
    evidence.fixture.push({ name, source, dest, renamed: false });
    return dest;
  }
  evidence.fixture.push({ name, dest, renamed: true });
  return dest;
}

async function recordFixture(browser) {
  await recordClip(browser, 'motion-narrow-header-keyboard', { width: 344, height: 844 }, async (page) => {
    await page.getByLabel('Message Aethelios', { exact: true }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Tools & context' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'New conversation' }).click();
    await page.waitForTimeout(400);
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic narrow draft');
    await page.setViewportSize({ width: 344, height: 420 });
    await page.evaluate(() => {
      document.querySelector('.talk-page')?.setAttribute('data-keyboard', 'open');
    });
    await page.waitForTimeout(800);
  });

  await recordClip(browser, 'motion-submit-activity-saved', { width: 768, height: 900 }, async (page) => {
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic request');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Emit response text' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Emit saving event' }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
    await page.waitForTimeout(800);
  });

  await recordClip(browser, 'motion-image-approval-cancel-fail', { width: 768, height: 900 }, async (page) => {
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic image request');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Emit image approval' }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Stop reply' }).click();
    await page.waitForTimeout(700);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.talk-page .talk-toolbar');
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic fail artifacts');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Emit image artifact' }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Emit failure' }).click();
    await page.waitForTimeout(800);
  });

  await recordClip(browser, 'motion-voice-states', { width: 768, height: 900 }, async (page) => {
    await page.getByLabel('Surface', { exact: true }).selectOption('voice');
    await page.getByLabel('Voice phase', { exact: true }).selectOption('listening');
    await page.waitForTimeout(600);
    await page.getByLabel('Synthetic audio level', { exact: true }).fill('0');
    await page.waitForTimeout(500);
    await page.getByLabel('Synthetic audio level', { exact: true }).fill('0.8');
    await page.waitForTimeout(700);
    await page.getByLabel('Voice phase', { exact: true }).selectOption('speaking');
    await page.getByLabel('Synthetic output level', { exact: true }).fill('0.7');
    await page.waitForTimeout(700);
    await page.getByLabel('Block playback').check();
    await page.waitForTimeout(600);
    await page.getByLabel('Voice phase', { exact: true }).selectOption('ended');
    await page.waitForTimeout(800);
  });

  await recordClip(browser, 'motion-reduced-motion-still', { width: 768, height: 900 }, async (page) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Synthetic reduced motion');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForTimeout(800);
    const still = page.getByLabel('Pause ambient motion').or(page.getByLabel('Enable ambient motion'));
    if (await still.count()) await still.first().click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Emit response text' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
    await page.waitForTimeout(800);
  });
}

const browser = await chromium.launch({ headless: true });
try {
  await verifyNextTalk(browser);
  await recordFixture(browser);
} finally {
  await browser.close();
}
writeFileSync(resolve(artifacts, 'conversation-motion-evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
