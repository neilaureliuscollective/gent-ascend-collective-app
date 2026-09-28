import { startProgramSession } from '@/domains/performance/program';
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
export const programFixture: PerformanceData = {
  ...performanceFixture,
  program: {
    version: 1,
    updatedAt: new Date().toISOString(),
    nextSlotId: 'c0000000-0000-4000-8000-000000000010',
    data: {
      title: 'Synthetic A / B cycle',
      sessions: [
        {
          id: 'c0000000-0000-4000-8000-000000000010',
          plan: {
            ...performanceFixture.plan!.data,
            title: 'Strength A',
            exercises: performanceFixture.plan!.data.exercises.map((e) => ({ ...e, sets: 3 })),
          },
        },
        {
          id: 'c0000000-0000-4000-8000-000000000011',
          plan: { ...performanceFixture.plan!.data, title: 'Strength B' },
        },
      ],
    },
  },
};
export const learningFixture: PerformanceData = {
  ...programFixture,
  sessions: ['2026-09-25', '2026-09-22'].map((day, i) => {
    const slot = programFixture.program!.data.sessions[0]!;
    const session = startProgramSession({
      ruleVersion: 1,
      programVersion: 1,
      slotId: slot.id,
      mode: 'planned',
      timeBudget: 40,
      originalPlan: slot.plan,
      plan: slot.plan,
    });
    return {
      version: 1,
      updatedAt: `${day}T11:00:00Z`,
      data: {
        ...session,
        id: `c0000000-0000-4000-8000-00000000002${i + 1}`,
        startedAt: `${day}T10:00:00Z`,
        endedAt: `${day}T11:00:00Z`,
        status: 'complete',
        sets: session.sets.map((s) => ({ ...s, done: true, effort: 7 })),
      },
    };
  }),
  progression: [
    {
      slotId: programFixture.program!.data.sessions[0]!.id,
      title: 'Strength A',
      status: 'ready',
      reason:
        'Both workouts met this exercise’s targets at the same load with effort recorded at 7/10 or lower. Try one more rep per set; the rest of the program stays as planned.',
      evidence: [
        {
          sessionId: 'c0000000-0000-4000-8000-000000000021',
          day: '2026-09-25',
          mode: 'planned',
          completedSets: 3,
          plannedSets: 3,
        },
        {
          sessionId: 'c0000000-0000-4000-8000-000000000022',
          day: '2026-09-22',
          mode: 'planned',
          completedSets: 3,
          plannedSets: 3,
        },
      ],
      proposal: {
        ruleVersion: 1,
        token: 'a'.repeat(64),
        programVersion: 1,
        exerciseId: performanceFixture.plan!.data.exercises[0]!.id,
        exercise: 'Cable row',
        from: 8,
        to: 9,
        sets: 3,
        load: 40,
        unit: 'lb',
        sourceIds: ['c0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000022'],
      },
    },
    {
      slotId: programFixture.program!.data.sessions[1]!.id,
      title: 'Strength B',
      status: 'hold',
      reason:
        'Two completed workouts for this session are needed. Other sessions do not count as substitutes.',
      evidence: [],
      proposal: null,
    },
  ],
  progressionDecisions: [],
};
