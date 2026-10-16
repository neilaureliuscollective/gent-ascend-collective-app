import { expect, it } from 'vitest';
import { budgetLiveSeed, liveApplicationFromBuilt } from '@/domains/live/context-budget';
import { buildMessages } from '@/domains/intelligence/prompt';
import { publishedKnowledgeContext } from '@/domains/intelligence/published-knowledge';

it('pins application and artifact context separately from the last twelve history messages', () => {
  const application = [
    { role: 'user', content: 'Application context and thread summary' },
    { role: 'user', content: 'Selected design-board artifact' },
  ];
  const history = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: `History ${index + 1}`,
  }));
  const seed = budgetLiveSeed(application, history, 12);
  expect(seed[0]?.content).toBe('Application context and thread summary');
  expect(seed[1]?.content).toBe('Selected design-board artifact');
  expect(seed).toHaveLength(14);
  expect(seed.at(-1)?.content).toBe('History 20');
  expect(seed.some((item) => item.content === 'History 1')).toBe(false);
  expect(seed.some((item) => item.content === 'History 9')).toBe(true);
});

it('keeps current published knowledge when a long voice history is trimmed', () => {
  const stale =
    'Aethelios is company-building software and Legacy Reserve is a separate current company.';
  const built = buildMessages(
    Array.from({ length: 30 }, (_, index) => ({
      status: 'complete' as const,
      user_text: `Older question ${index}`,
      assistant_text: index === 0 ? stale : `Older answer ${index}`,
    })),
    '',
    null,
    new Date('2026-10-15T12:00:00Z'),
    null,
    stale,
    null,
    null,
    { channel: 'voice' },
  );
  const seed = budgetLiveSeed(built[0] ? [built[0]] : [], built.slice(1), 12);
  expect(String(seed[0]?.content)).toContain(publishedKnowledgeContext());
  expect(String(seed[0]?.content)).toContain('unified technology and lifestyle platform');
  expect(seed.some((item) => String(item.content).includes(stale))).toBe(true);
  expect(seed.filter((item) => String(item.content).startsWith('Older question'))).toHaveLength(6);
  expect(liveApplicationFromBuilt(built)[0]?.text).toContain(publishedKnowledgeContext());
});

// Integration regression: Knowledge's ninth argument and Talk's image attachment
// must coexist; neither may silently replace the other's request context.
it('composes current knowledge, delivery and image analysis in one Talk request', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const built = buildMessages([], 'Describe this image', null, new Date(), null, null, null, null, {
    channel: 'text',
    attachment: { bytes, mediaType: 'image/png' },
  });
  expect(String(built[0]?.content)).toContain(publishedKnowledgeContext());
  expect(String(built[0]?.content)).toContain('Personal context disabled');
  expect(built.at(-1)?.content).toEqual([
    { type: 'text', text: expect.stringContaining('for analysis of these pixels only') },
    { type: 'image', image: bytes, mediaType: 'image/png' },
  ]);
});

it('rejects oversized pinned context instead of silently truncating application data', () => {
  expect(() => budgetLiveSeed([{ role: 'user', content: 'x'.repeat(32001) }], [], 12)).toThrow(
    RangeError,
  );
  expect(() =>
    budgetLiveSeed(
      Array.from({ length: 3 }, () => ({ role: 'user', content: 'x'.repeat(20000) })),
      [],
      12,
    ),
  ).toThrow(RangeError);
});
it('bounds combined context and keeps the newest history tail', () => {
  const seed = budgetLiveSeed(
    [{ role: 'user', content: 'x'.repeat(32000) }],
    [
      { role: 'user', content: 'old'.repeat(10000) },
      { role: 'assistant', content: 'y'.repeat(20000) },
      { role: 'user', content: '' },
      { role: 'user', content: [{ type: 'text', text: 'unsupported attachment' }] },
      { role: 'user', content: 'latest' },
    ],
    12,
  );
  expect(seed).toHaveLength(3);
  expect(seed.at(-1)?.content).toBe('latest');
  expect(seed.reduce((size, item) => size + String(item.content).length, 0)).toBeLessThanOrEqual(
    64000,
  );
});
