import { it, expect } from 'vitest';
import {
  websiteInputSchema,
  websiteAskSchema,
  websiteSourceSchema,
} from '@/domains/business-connections/website-schema';
it('website contracts reject arbitrary HTML/code fields, publishing and cross-company/personal context', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  const input = {
    connectionId: id,
    requestId: id,
    websiteId: 'fix-it-shop',
    baseRevision: 1,
    content: { headline: 'Synthetic', about: 'Synthetic about' },
    serviceChanges: [],
  };
  expect(websiteInputSchema.safeParse(input).success).toBe(true);
  for (const extra of [
    { publish: true },
    { companyId: id },
    { providerId: 'other' },
    { content: { ...input.content, html: '<script>' } },
  ])
    expect(websiteInputSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  const ask = {
    connectionId: id,
    requestId: id,
    conversationId: id,
    text: 'Help with wording',
    consent: true,
  };
  expect(websiteAskSchema.safeParse(ask).success).toBe(true);
  expect(websiteAskSchema.safeParse({ ...ask, includeContext: true }).success).toBe(false);
  expect(websiteAskSchema.safeParse({ ...ask, consent: false }).success).toBe(false);
  expect(
    websiteInputSchema.safeParse({
      ...input,
      serviceChanges: [
        { id: 'service', baseRevision: 1, description: 'x' },
        { id: 'service', baseRevision: 1, description: 'y' },
      ],
    }).success,
  ).toBe(false);
  expect(websiteSourceSchema.safeParse({ source: 'Other' }).success).toBe(false);
});
