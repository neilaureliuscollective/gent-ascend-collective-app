import { test, expect } from '@playwright/test';
import { lifestyleLaunchBoard } from '../../src/domains/talk-creation/design-board';
test.setTimeout(120000);

test('three premium compositions, keyboard selection, revision reload, document Preview and received design', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3102/premium.html');
  await page.evaluate(() => document.fonts.ready);
  const tabs = page.getByRole('tablist', { name: 'Design directions' });
  await expect(tabs).toBeVisible();
  for (const [name, viewport] of [
    ['phone', { width: 390, height: 844 }],
    ['fold', { width: 884, height: 690 }],
    ['desktop', { width: 1440, height: 900 }],
  ] as const) {
    await page.setViewportSize(viewport);
    for (const [index, label] of [
      'The Founder’s Journal',
      'Luminous Precision',
      'A Singular Standard',
    ].entries()) {
      await page.getByRole('tab', { name: new RegExp(label) }).click();
      await expect(page.getByRole('tabpanel')).toContainText(
        lifestyleLaunchBoard().directions[index]!.demo.headline,
      );
      await expect(page.getByRole('tabpanel').getByRole('img')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`${name}-direction-${index + 1}.png`),
        fullPage: true,
      });
    }
  }
  await page.getByRole('tab', { name: /A Singular Standard/ }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: /Founder’s Journal/ })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Luminous Precision/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByText('Edit colors & design details', { exact: true }).click();
  await page.getByLabel('Campaign headline', { exact: true }).fill('A ritual, considered.');
  await page.getByLabel('Luminous emerald swatch').fill('#76e8c2');
  await page.getByRole('button', { name: 'Save this version' }).click();
  await page.reload();
  await expect(page.getByLabel('Luminous emerald swatch')).toHaveValue('#76e8c2');
  await expect(page.getByRole('tab', { name: /Luminous Precision/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'A ritual, considered.' })).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('synthetic-premium-board')!),
  );
  let failed = true;
  await page.route('**/api/architect-design-direction?*', (route) =>
    failed
      ? route.fulfill({ status: 503, json: { error: 'Unavailable' } })
      : route.fulfill({
          json: {
            direction: {
              digest: 'a'.repeat(64),
              receipt: {
                identity: { boardVersion: 2 },
                content: {
                  designSnapshot: { product: saved.product, direction: saved.directions[1] },
                },
              },
            },
          },
        }),
  );
  await page.goto('http://127.0.0.1:3102/premium.html?surface=architect');
  await expect(page.getByRole('alert')).toContainText('could not be read');
  failed = false;
  await page.getByRole('button', { name: 'Retry design read' }).click();
  await expect(page.getByText('Received · awaiting build approval')).toBeVisible();
  await expect(page.locator('.talk-design-hero')).toHaveAttribute(
    'data-composition',
    'split-campaign',
  );
  expect(
    await page
      .locator('.talk-design-hero')
      .evaluate((element) => getComputedStyle(element).getPropertyValue('--board-accent')),
  ).toBe('#76e8c2');
  await page.screenshot({ path: info.outputPath('architect-retained.png'), fullPage: true });
  await page.getByRole('button', { name: 'Review build brief' }).click();
  await expect(page.getByRole('status')).toContainText('No generation started');
  await page.goto('http://127.0.0.1:3102/premium.html?surface=document');
  await expect(page.getByRole('article', { name: 'Document preview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A considered launch', level: 1 })).toBeVisible();
  await expect(page.locator('.talk-document-preview li')).toHaveCount(4);
  await expect(
    page.locator('.talk-document-preview p').filter({ hasText: /^Audience:/ }),
  ).toHaveText('Audience: Founders who value deliberate choices.');
  await page.screenshot({ path: info.outputPath('document-preview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('textarea').first()).toBeVisible();
  await page.goto('http://127.0.0.1:3102/premium.html?surface=board-detail');
  await expect(
    page.getByRole('button', { name: 'Review design transfer', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Premium design transfer is not available yet/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('premium-transfer-blocked.png'), fullPage: true });
  expect(errors).toEqual([]);
});

for (const width of [390, 884])
  test(`Talk accepted send, failed draft recovery and asynchronous reading anchor at ${width}`, async ({
    page,
  }, info) => {
    page.on('pageerror', (error) => console.error('Fixture page error:', error.message));
    page.on('crash', () => console.error('Fixture renderer crashed'));
    const { disconnectedWorkspace } = await import('../../src/components/aurelius/preview');
    const conversation = '30000000-0000-4000-8000-000000000031';
    const data = {
      ...disconnectedWorkspace,
      ownerId: 'synthetic',
      configured: true,
      canChat: true,
      currentConversation: {
        id: conversation,
        person_id: 'synthetic',
        title: 'Campaign working session',
        created_at: '2026-10-15',
        updated_at: '2026-10-15',
      },
      turns: Array.from({ length: 20 }, (_, index) => ({
        id: `saved-${index}`,
        person_id: 'synthetic',
        conversation_id: conversation,
        user_text: `Campaign decision ${index + 1}`,
        assistant_text:
          'A deliberate creative decision.\n\nKeep the approved identity and review each change.\n\n'.repeat(
            4,
          ),
        status: 'complete',
        model: 'fixture',
        context_included: false,
        prompt_version: 'fixture',
        feedback: null,
        created_at: '2026-10-15',
        finished_at: '2026-10-15',
      })),
    };
    let failed = false;
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/premium-fixture-save') {
        data.turns.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true } });
      }
      if (path === '/api/aurelius/chat') {
        if (failed)
          return route.fulfill({
            status: 503,
            json: { error: 'Synthetic send failure. Draft recoverable.' },
          });
        const request = route.request().postDataJSON();
        const turn = {
          ...data.turns[0]!,
          id: request.requestId,
          user_text: request.text,
          assistant_text: 'A saved fixture campaign response.',
          status: 'complete',
        };
        data.turns.push(turn);
        return route.fulfill({
          contentType: 'application/x-ndjson',
          body: [
            { type: 'activity', phase: 'generating' },
            { type: 'delta', text: turn.assistant_text },
            { type: 'saved', turn },
          ]
            .map((event) => JSON.stringify(event) + '\n')
            .join(''),
        });
      }
      if (path === '/api/aurelius/creations')
        return route.fulfill({
          json: {
            creations: [],
            selected: {},
            images: [],
            selectedImageId: null,
            canCreateImages: false,
            imageAccess: 'unavailable',
            attachmentProjectId: null,
          },
        });
      if (path === '/api/aurelius') return route.fulfill({ json: data });
      return route.fulfill({ json: {} });
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('http://127.0.0.1:3102/premium.html?surface=talk');
    const field = page.getByLabel('Message Aethelios', { exact: true });
    await expect(field).toBeVisible();
    await field.fill('A long campaign draft with deliberate details.\n'.repeat(45));
    await field.focus();
    await page.setViewportSize({ width, height: 420 });
    await field.press('End');
    await field.type(' Final words visible.');
    await expect
      .poll(() =>
        field.evaluate(
          (element: HTMLTextAreaElement) =>
            element.scrollHeight - element.scrollTop - element.clientHeight,
        ),
      )
      .toBeLessThan(5);
    await expect(field).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`talk-keyboard-${width}.png`) });
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(field).toHaveValue('');
    await expect
      .poll(() => field.evaluate((element) => element.getBoundingClientRect().height))
      .toBeLessThan(90);
    await expect(page.locator('.im-response[data-phase="complete"]').last()).toBeVisible();
    failed = true;
    await field.fill('Recover this exact failed campaign draft.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(field).toHaveValue('Recover this exact failed campaign draft.');
    await expect(
      page.getByText('Synthetic send failure. Draft recoverable.', { exact: false }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Reload saved state', exact: true }).click();
    await expect(field).toHaveValue('Recover this exact failed campaign draft.');
    const scroll = page.locator('.conversation-scroll');
    for (const draft of ['A short draft', 'Long synthetic draft\n'.repeat(40)]) {
      await field.fill(draft);
      await scroll.evaluate((node) => {
        node.scrollTop = 0;
        node.dispatchEvent(new Event('scroll'));
      });
      const latest = page.getByRole('button', { name: 'Latest message' });
      await expect(latest).toBeVisible();
      await latest.click();
      await expect
        .poll(() =>
          scroll.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop),
        )
        .toBeLessThan(5);
    }

    await scroll.evaluate((node) => {
      node.scrollTop = 1600;
      node.dispatchEvent(new Event('scroll'));
    });
    await expect(page.getByRole('button', { name: 'Latest message' })).toBeVisible();
    const anchor = await scroll.evaluate((node) => {
      const top = node.getBoundingClientRect().top;
      const row = [...node.querySelectorAll<HTMLElement>('[data-turn-id]')].find(
        (element) => element.getBoundingClientRect().bottom > top,
      )!;
      return { id: row.dataset.turnId!, offset: row.getBoundingClientRect().top - top };
    });
    await scroll.evaluate((node) => {
      const art = document.createElement('img');
      art.src = '/brand/aethelios-human-ascendance-20261015-crest.webp';
      art.alt = 'Synthetic asynchronous artifact growth';
      art.style.cssText = 'display:block;width:220px;height:220px';
      node.querySelector('[data-turn-id]')!.append(art);
    });
    await expect
      .poll(() =>
        scroll.evaluate((node, saved) => {
          const row = [...node.querySelectorAll<HTMLElement>('[data-turn-id]')].find(
            (element) => element.dataset.turnId === saved.id,
          )!;
          return Math.abs(
            row.getBoundingClientRect().top - node.getBoundingClientRect().top - saved.offset,
          );
        }, anchor),
      )
      .toBeLessThan(3);
    await page.screenshot({ path: info.outputPath(`talk-reading-anchor-${width}.png`) });
    // A controlled browser stream exercises incremental production stream consumption.
    await page.evaluate(() => {
      const original = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        if (String(input) !== '/api/aurelius/chat') return original(input, init);
        const request = JSON.parse(String(init?.body));
        const encoder = new TextEncoder();
        let answer = '';
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              const emit = (event: unknown) =>
                controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
              emit({ type: 'activity', phase: 'generating' });
              (
                window as unknown as {
                  premiumStream: { delta: (text: string) => void; finish: () => void };
                }
              ).premiumStream = {
                delta(text) {
                  answer += text;
                  emit({ type: 'delta', text });
                },
                finish() {
                  const turn = {
                    id: request.requestId,
                    person_id: 'synthetic',
                    conversation_id: request.conversationId,
                    user_text: request.text,
                    assistant_text: answer,
                    status: 'complete',
                    model: 'fixture',
                    context_included: false,
                    prompt_version: 'fixture',
                    feedback: null,
                    created_at: '2026-10-15',
                    finished_at: '2026-10-15',
                  };
                  void original('/api/premium-fixture-save', {
                    method: 'POST',
                    body: JSON.stringify(turn),
                  }).then(() => {
                    emit({ type: 'saved', turn });
                    controller.close();
                  });
                },
              };
            },
          }),
          { headers: { 'content-type': 'application/x-ndjson' } },
        );
      };
    });
    await field.fill('Continue our written discussion with a careful explanation.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(field).toHaveValue('');
    await page.evaluate(() =>
      (
        window as unknown as { premiumStream: { delta: (text: string) => void } }
      ).premiumStream.delta('An intentional campaign.\n\n'.repeat(30)),
    );
    await expect(page.locator('.conversation-turn').last()).toContainText(
      'An intentional campaign.',
    );
    await expect
      .poll(() => scroll.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight))
      .toBeLessThan(5);
    await scroll.evaluate((node) => {
      node.scrollTop = 1600;
      node.dispatchEvent(new Event('scroll'));
    });
    await expect(page.getByRole('button', { name: 'Latest message' })).toBeVisible();
    const readingTop = await scroll.evaluate((node) => node.scrollTop);
    await page.evaluate(() =>
      (
        window as unknown as { premiumStream: { delta: (text: string) => void } }
      ).premiumStream.delta('Keep the selected identity.\n\n'.repeat(35)),
    );
    await expect(page.locator('.conversation-turn').last()).toContainText(
      'Keep the selected identity.',
    );
    await expect
      .poll(() => scroll.evaluate((node, top) => Math.abs(node.scrollTop - top), readingTop))
      .toBeLessThan(3);
    await page.screenshot({ path: info.outputPath(`talk-stream-reading-${width}.png`) });
    await page.evaluate(() =>
      (window as unknown as { premiumStream: { finish: () => void } }).premiumStream.finish(),
    );
    await expect(page.getByRole('button', { name: 'Stop reply', exact: true })).not.toBeVisible();
  });
