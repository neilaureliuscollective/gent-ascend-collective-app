import type { HealthData } from '@/domains/health/schema';
export const healthFixture: HealthData = {
  owner: '20000000-0000-4000-8000-000000000001',
  mode: 'personal',
  asOf: '2026-10-12T12:00:00Z',
  ingestionEnabled: true,
  aiEnabled: false,
  consents: [
    { purpose: 'wellness', granted: true, version: 1, updated_at: '2026-10-12T12:00:00Z' },
    { purpose: 'records', granted: true, version: 1, updated_at: '2026-10-12T12:00:00Z' },
  ],
  records: [
    {
      id: 'a2000000-0000-4000-8000-000000000001',
      title: 'Synthetic laboratory report',
      mime: 'text/csv',
      size: 180,
      path: 'synthetic/original',
      hash: 'a'.repeat(64),
      status: 'review_required',
      version: 2,
      created_at: '2026-10-12T12:00:00Z',
      candidates: [
        {
          id: 'a1000000-0000-4000-8000-000000000001',
          name: 'Synthetic reported test',
          code: '',
          value: '12',
          unit: 'mg/dL',
          date: '2026-10-01',
          specimen: 'serum',
          method: 'synthetic method',
          range: '5–15',
          flag: '',
        },
      ],
    },
  ],
  observations: [],
  jobs: [],
  turns: [],
  wellness: {
    sleep: [
      {
        date: '2026-10-01',
        value: 7.5,
        source: 'Performance · your self-report',
        updatedAt: '2026-10-02T12:00:00Z',
        version: 1,
      },
      {
        date: '2026-10-05',
        value: 0,
        source: 'Performance · your self-report',
        updatedAt: '2026-10-06T12:00:00Z',
        version: 1,
      },
    ],
    weight: [],
    movement: [],
    recovery: [],
    unavailable: [],
  },
};
