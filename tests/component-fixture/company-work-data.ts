import { emptyWork } from '@/domains/company-work/schema';
export const syntheticWork = {
  job: {
    id: 'c8000000-0000-4000-8000-000000000021',
    person_id: 'synthetic-owner',
    company_id: 'c8000000-0000-4000-8000-000000000001',
    conversation_id: 'c8000000-0000-4000-8000-000000000022',
    company_name: 'Synthetic A',
    company_brief: 'Synthetic brief',
    brief_version: 1,
    scope: {
      request: 'Synthetic company positioning',
      audience: 'Founder',
      outcome: 'A useful brief and presentation',
      constraints: 'No invented economics',
      acceptance: 'A clear offer and plan',
      evidence: [],
      figures: [],
    },
    revision: 1,
    created_at: '2026-10-06T00:00:00Z',
  },
  versions: [
    {
      id: 'c8000000-0000-4000-8000-000000000023',
      person_id: 'synthetic-owner',
      company_id: 'c8000000-0000-4000-8000-000000000001',
      job_id: 'c8000000-0000-4000-8000-000000000021',
      revision: 1,
      content: emptyWork('Synthetic positioning'),
      source: 'manual' as const,
      source_turn: null,
      reviewed_at: null,
      created_at: '2026-10-06T00:00:00Z',
    },
  ],
  projectId: null,
  assets: [],
};
