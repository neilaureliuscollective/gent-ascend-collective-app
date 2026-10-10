import { describe, it, expect } from 'vitest';
import { briefSchema, bookingUrl, commandSchema, usageMicros } from '@/domains/technology/schema';
export const brief = {
  name: 'Studio North',
  industry: 'grooming-beauty' as const,
  vision: 'A welcoming local grooming studio.',
  headline: 'Care with intention',
  about: 'A local studio focused on thoughtful care.',
  services: [{ name: 'Haircut', description: 'An attentive appointment.', price: '$45' }],
  hours: 'Tue–Sat',
  contact: 'Call the studio',
  bookingUrl: 'https://booking.example.com/studio',
};
describe('Technology contract', () => {
  it('accepts bounded business data, not executable structure', () => {
    expect(briefSchema.safeParse(brief).success).toBe(true);
    expect(briefSchema.safeParse({ ...brief, script: 'alert(1)' }).success).toBe(false);
    expect(
      briefSchema.safeParse({ ...brief, services: Array(13).fill(brief.services[0]) }).success,
    ).toBe(false);
  });
  it('denies active/local/credential booking URLs', () => {
    for (const u of [
      'javascript:alert(1)',
      'http://example.com',
      'https://user:secret@example.com',
      'https://example.com/a b',
      'https://127.0.0.1',
      'https://localhost',
      'https://[::1]',
    ])
      expect(bookingUrl.safeParse(u).success).toBe(false);
  });
  it('requires explicit consent and exact revision before paid work', () => {
    expect(
      commandSchema.safeParse({
        action: 'generate',
        id: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        expected: 1,
        consent: false,
      }).success,
    ).toBe(false);
  });
  it('accounts for full output tokens and rejects unknown usage', () => {
    expect(usageMicros(5000, 4000)).toBe(50000);
    expect(() => usageMicros(NaN, 3)).toThrow();
  });
});
