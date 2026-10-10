import { it, expect } from 'vitest';
import { brief } from './technology.test';
import { briefSchema, defaultDesign } from '@/domains/technology/schema';
import { renderArtifact, checkArtifact } from '@/domains/technology/artifact';
import { designCss } from '@/domains/technology/design';
it('keeps legacy artifacts deterministic while all audited compositions pass static checks', () => {
  expect(designCss(brief)).toBe('');
  const old = renderArtifact(brief);
  for (const palette of ['petrol', 'ivory', 'slate'] as const)
    for (const hero of ['editorial', 'centered', 'split'] as const)
      for (const typography of ['serif', 'sans'] as const)
        for (const spacing of ['spacious', 'compact'] as const) {
          const b = { ...brief, design: { ...defaultDesign, palette, hero, typography, spacing } };
          const html = renderArtifact(b);
          expect(html).not.toBe(old);
          expect(html).toBe(renderArtifact(b));
          expect(checkArtifact(html).passed).toBe(true);
        }
  expect(renderArtifact(brief)).toBe(old);
});
it('does not allow executable design values and escapes design CTA markup', () => {
  for (const design of [
    null,
    { ...defaultDesign, palette: 'url(javascript:evil)' },
    { ...defaultDesign, css: 'script' },
    { ...defaultDesign, request: 'x'.repeat(1001) },
  ])
    expect(briefSchema.safeParse({ ...brief, design }).success).toBe(false);
  const html = renderArtifact({
    ...brief,
    design: { ...defaultDesign, cta: '<img src=x onerror=evil>' },
  });
  expect(html).not.toContain('<img');
  expect(checkArtifact(html).passed).toBe(true);
});
