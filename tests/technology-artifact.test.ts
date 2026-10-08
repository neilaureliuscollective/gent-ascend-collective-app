import { it, expect } from 'vitest';
import { renderArtifact, checkArtifact } from '@/domains/technology/artifact';
const brief = {
  name: 'Studio North',
  industry: 'grooming-beauty' as const,
  vision: 'A considered local studio.',
  headline: 'Care with intention',
  about: 'Thoughtful service and care.',
  services: [{ name: 'Consultation', price: '$45', description: 'Personal care.' }],
  hours: 'Tue–Sat',
  contact: 'Call us',
  bookingUrl: 'https://booking.example.com/a?x=1&y=2',
};
it('produces a deterministic bounded document, all internal links and honest integration state', () => {
  const h = renderArtifact(brief);
  expect(h).toBe(renderArtifact(brief));
  expect(checkArtifact(h).passed).toBe(true);
  expect(h).toContain('No contact form is connected');
  expect(h).toContain('x=1&amp;y=2');
});
it('escapes attacker markup without creating active tags or attributes', () => {
  const h = renderArtifact({
    ...brief,
    name: '<script>alert(1)</script>',
    about: '<img src=x onerror=alert(1)>',
    services: [
      { name: '<iframe>', price: '<b>$45</b>', description: '</p><script>evil()</script>' },
    ],
  });
  expect(h).not.toMatch(/<script\b|<img\b|<iframe\b/);
  expect(h).toContain('&lt;script&gt;');
  expect(checkArtifact(h).passed).toBe(true);
});
it('rejects malformed briefs and catches corrupted/executable artifacts', () => {
  expect(() => renderArtifact({ ...brief, bookingUrl: 'javascript:alert(1)' })).toThrow();
  expect(checkArtifact(renderArtifact(brief) + '<script>alert(1)</script>').passed).toBe(false);
  expect(checkArtifact(renderArtifact(brief).replace('id="contact"', 'id="missing"')).passed).toBe(
    false,
  );
});
