import { it, expect } from 'vitest';
import { brief } from './technology.test';
import {
  parseWebsiteProposal,
  planningInstructions,
  websiteContextMessage,
} from '@/domains/technology/planning';
import { chatInput } from '@/domains/intelligence/validation';
const block = (value: unknown) =>
  `A proposal, not a completed build.\n\`\`\`aethelios-website\n${JSON.stringify(value)}\n\`\`\``;
it('accepts exactly one bounded schema-valid proposal, never executable extensions or repaired JSON', () => {
  expect(parseWebsiteProposal(block(brief))).toEqual(brief);
  for (const text of [
    block(brief) + block(brief),
    block({ ...brief, script: 'alert(1)' }),
    block({ ...brief, bookingUrl: 'javascript:evil' }),
    '```aethelios-website\n{broken}\n```',
    'x'.repeat(16001),
  ])
    expect(parseWebsiteProposal(text)).toBeNull();
  expect(parseWebsiteProposal(block({ ...brief, name: '' }))).toBeNull();
});
it('separates planning, reviewed website context and Council; rejects caller data/privileges', () => {
  const base = {
    conversationId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    text: 'Plan a business website',
    includeContext: false,
  };
  const website = { id: crypto.randomUUID(), revision: 1 };
  expect(chatInput.safeParse({ ...base, websitePlanning: true }).success).toBe(true);
  expect(chatInput.safeParse({ ...base, website }).success).toBe(true);
  for (const extra of [
    { websitePlanning: true, website },
    { website: { ...website, brief } },
    { website: { ...website, revision: 0 } },
    { websitePlanning: true, council: { kind: 'specialist', specialists: ['athena'] } },
    { website, council: { kind: 'specialist', specialists: ['athena'] } },
  ])
    expect(chatInput.safeParse({ ...base, ...extra }).success).toBe(false);
});
it('marks website data untrusted, includes precise receipt, and caps bytes without truncation', () => {
  const message = websiteContextMessage({ revision: 3, brief });
  expect(message).toContain('untrusted records');
  expect(message).toContain('"revision":3');
  expect(message).toContain('Technology');
  expect(() => websiteContextMessage({ brief: '💫'.repeat(4000) })).toThrow(/too large/);
  expect(planningInstructions).toContain('asking at most two');
  expect(planningInstructions).toContain('cannot create, execute or publish');
});
