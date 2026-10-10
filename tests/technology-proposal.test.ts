import { it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const s = vi.hoisted(() => ({ results: [] as unknown[], eq: vi.fn() }));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => ({
    person: { id: 'owner' },
    client: {
      from: () => {
        const q = {
          select: () => q,
          eq: (...a: unknown[]) => {
            s.eq(...a);
            return q;
          },
          maybeSingle: async () => s.results.shift(),
        };
        return q;
      },
    },
  }),
}));
import { readWebsiteProposal } from '@/domains/technology/proposal';
const brief = {
  name: 'Studio North',
  industry: 'professional-services',
  vision: 'A local business website',
  headline: 'A careful approach',
  about: 'Thoughtful services for local businesses',
  services: [{ name: 'Consultation', description: '', price: '' }],
  hours: '',
  contact: '',
  bookingUrl: '',
};
const proposal = {
  assistant_text: '```aethelios-website\n' + JSON.stringify(brief) + '\n```',
  status: 'complete',
  prompt_version: 'aethelios-v1:website-planning-v1',
};
beforeEach(() => {
  vi.clearAllMocks();
  s.results = [
    { data: { id: 'mission', conversation_id: 'conversation', revision: 2, status: 'active' } },
    { data: proposal },
  ];
});
it('imports only a selected completed planning reply from the owner Mission conversation', async () => {
  expect(await readWebsiteProposal('mission', 'turn')).toEqual({
    brief,
    missionId: 'mission',
    turnId: 'turn',
    missionRevision: 2,
  });
  expect(s.eq).toHaveBeenCalledWith('conversation_id', 'conversation');
  expect(s.eq.mock.calls.filter(([k]) => k === 'person_id')).toHaveLength(2);
});
it('fails closed for detached/archived Missions, foreign/pending replies and ordinary chat', async () => {
  for (const data of [null, { status: 'archived' }, { status: 'completed' }]) {
    s.results = [{ data }];
    await expect(readWebsiteProposal('mission', 'turn')).rejects.toThrow(/Mission/);
  }
  for (const data of [
    null,
    { ...proposal, status: 'pending' },
    { ...proposal, prompt_version: 'ordinary' },
    { ...proposal, assistant_text: 'invalid' },
  ]) {
    s.results = [
      { data: { conversation_id: 'conversation', status: 'active', revision: 1 } },
      { data },
    ];
    await expect(readWebsiteProposal('mission', 'turn')).rejects.toThrow(/proposal/);
  }
});
