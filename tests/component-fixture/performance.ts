import type { PerformanceData } from '@/domains/performance/schema';
export const performanceFixture: PerformanceData = {
  mode: 'personal',
  owner: 'c0000000-0000-4000-8000-000000000001',
  today: new Date().toISOString().slice(0, 10),
  timezone: 'UTC',
  profile: {
    version: 1,
    updatedAt: new Date().toISOString(),
    data: {
      goal: 'strength',
      experience: 'returning',
      daysPerWeek: 3,
      minutes: 40,
      equipment: 'gym',
      limitations: '',
      unit: 'lb',
    },
  },
  plan: {
    version: 1,
    updatedAt: new Date().toISOString(),
    data: {
      title: 'Synthetic strength session',
      unit: 'lb',
      exercises: [
        {
          id: 'c0000000-0000-4000-8000-000000000002',
          name: 'Cable row',
          sets: 2,
          reps: 8,
          load: 40,
          restSeconds: 90,
        },
      ],
    },
  },
  checkins: [],
  sessions: [],
};
