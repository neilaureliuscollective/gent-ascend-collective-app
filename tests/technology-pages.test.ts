import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { brief } from './technology.test';
import { briefSchema, type Brief } from '@/domains/technology/schema';
import { renderArtifact, checkArtifact } from '@/domains/technology/artifact';
import { parseWebsiteProposal } from '@/domains/technology/planning';
export const pages: NonNullable<Brief['pages']> = [
  {
    slug: 'our-process',
    title: 'Our process',
    layout: 'cards',
    sections: [{ heading: 'Meet the studio', body: 'Discuss the service you need.' }],
  },
];
it('renders additional pages with unique navigation, safe text and responsive cards', () => {
  const html = renderArtifact({ ...brief, pages });
  expect(html).toContain('href="#our-process"');
  expect(html).toContain('id="our-process"');
  expect(html).toContain('page-sections cards');
  expect(html).toContain('min(100%,240px)');
  expect(checkArtifact(html).passed).toBe(true);
  expect(checkArtifact(html.replace('id="our-process"', 'id="about"')).passed).toBe(false);
  expect(checkArtifact(html.replace('id="our-process"', 'id="missing"')).passed).toBe(false);
  const malicious = renderArtifact({
    ...brief,
    pages: [
      {
        ...pages[0]!,
        title: '<img src=x onerror=evil>',
        sections: [{ heading: '<script>evil</script>', body: '</p><iframe src=x>' }],
      },
    ],
  });
  expect(malicious).not.toMatch(/<img|<script|<iframe/);
  expect(checkArtifact(malicious).passed).toBe(true);
});
it('legacy exported bytes and hashes remain identical to the verified Phase 4 source', () => {
  // The known legacy artifact is independently pinned below, never rewritten when pages evolve.
  expect(createHash('sha256').update(renderArtifact(brief)).digest('hex')).toBe(
    'd92ca937017a8798a054bcc9393781445f9265c112be2902bbc74f9670c380fb',
  );
  expect(renderArtifact({ ...brief, pages: [] })).toBe(renderArtifact(brief));
});
it('rejects unbounded, ambiguous and executable page contracts', () => {
  for (const bad of [
    null,
    Array(4).fill(pages[0]),
    [pages[0], pages[0]],
    [{ ...pages[0], slug: 'about' }],
    [{ ...pages[0], slug: 'javascript:evil' }],
    [{ ...pages[0], slug: 'a'.repeat(49) }],
    [{ ...pages[0], layout: '<script>' }],
    [{ ...pages[0], url: 'https://evil.test' }],
    [{ ...pages[0], sections: [] }],
    [{ ...pages[0], sections: [{ heading: 'Hello', body: 'x'.repeat(601) }] }],
  ])
    expect(briefSchema.safeParse({ ...brief, pages: bad }).success).toBe(false);
  expect(
    parseWebsiteProposal('```aethelios-website\n' + JSON.stringify({ ...brief, pages }) + '\n```'),
  ).toEqual({ ...brief, pages });
});
