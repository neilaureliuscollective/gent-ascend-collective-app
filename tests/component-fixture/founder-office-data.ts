import type { FounderOfficeData } from '@/domains/founder-office/service';
export const founderOfficeFixture: FounderOfficeData = {
  ownerId: 'synthetic-owner',
  person: {
    displayName: 'Synthetic Founder',
    timezone: 'UTC',
    priority: 'Build useful intelligence',
  },
  asOf: '2026-10-11T00:00:00Z',
  companies: [
    {
      id: 'c8000000-0000-4000-8000-000000000001',
      person_id: 'synthetic-owner',
      name: 'Synthetic Company',
      brief: 'Confirmed synthetic company brief. No live business records.',
      version: 1,
      confirmed_at: '2026-10-11T00:00:00Z',
      created_at: '2026-10-11T00:00:00Z',
    },
  ],
  missions: [],
  memories: [],
  proposals: [],
  personalMissions: [],
  operations: {
    windowStart: '2026-10-04T00:00:00Z',
    turns: [],
    usageRecords: 0,
    inputTokens: 0,
    outputTokens: 0,
    incompleteUsage: 0,
    bounded: false,
    workContractReady: true,
    modelConfigured: true,
    model: 'synthetic-model',
    commerceConfigured: false,
  },
};
