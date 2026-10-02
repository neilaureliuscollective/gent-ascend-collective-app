import { decisionOutcome } from '../../src/domains/performance/outcomes';
import { startProgramSession } from '../../src/domains/performance/program';
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

// Synthetic follow-through records: real evaluator, no database or model call.
export const outcomesFixture: PerformanceData = (() => {
  const data = structuredClone(learningFixture);
  const review = structuredClone(data.progression![0]!);
  const plan = structuredClone(data.program!.data.sessions[0]!.plan);
  plan.exercises[0]!.reps = 9;
  const decision = { fromVersion: 1, toVersion: 2, createdAt: '2026-09-25T12:00:00Z', review };
  data.progressionDecisions = [decision];
  data.program!.version = 2;
  data.program!.data.sessions[0]!.plan = plan;
  data.progression![0] = {
    ...review,
    status: 'hold',
    proposal: null,
    reason: 'Keep the current targets while you review these recorded attempts.',
  };
  const sessions = ['2026-09-26', '2026-09-27'].map((day, i) => {
    const session = startProgramSession({
      ruleVersion: 1,
      programVersion: 2,
      slotId: review.slotId,
      mode: 'planned',
      timeBudget: 40,
      plan,
      originalPlan: plan,
    });
    return {
      ...session,
      startedAt: `${day}T10:00:00Z`,
      endedAt: `${day}T11:00:00Z`,
      status: 'complete' as const,
      sets: session.sets.map((s) => ({ ...s, done: true, effort: i === 0 ? null : 8 })),
    };
  });
  data.outcomes = [
    decisionOutcome(
      { ...decision, approvedPlan: plan, revisedAt: null, sessions },
      'UTC',
      '2026-09-28T12:00:00Z',
    ),
  ];
  return data;
})();

export const fuelFixture: PerformanceData = {
  ...performanceFixture,
  fuelTargets: {
    version: 1,
    updatedAt: '',
    data: { calories: 2400, protein: 150, waterMl: 2500, goalWeight: 175, unit: 'lb' },
  },
  checkins: [0, 1, 2, 7, 8, 9, 20].map((ago) => {
    const date = new Date(`${performanceFixture.today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ago);
    return {
      version: 1,
      updatedAt: '',
      data: {
        day: date.toISOString().slice(0, 10),
        sleepMinutes: 450,
        energy: 4,
        soreness: 'none',
        weight: ago < 7 ? 180 : 82,
        unit: ago < 7 ? 'lb' : 'kg',
        calories: 2300,
        protein: 140,
        waterMl: 2200,
        nutritionComplete: ago !== 0,
      },
    };
  }),
};

export const recoveryFixture: PerformanceData = {
  ...fuelFixture,
  recoveryRoutines: [1, 3].map((ago) => {
    const date = new Date(`${fuelFixture.today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ago);
    return {
      version: 1,
      updatedAt: '',
      data: {
        day: date.toISOString().slice(0, 10),
        action: 'quiet-time',
        minutes: 15,
        cue: 'After my shift',
        outcome: null,
      },
    };
  }),
};

export const movementFixture: PerformanceData = {
  ...performanceFixture,
  movements: [
    {
      version: 1,
      updatedAt: '',
      data: {
        id: '77000000-0000-4000-9000-000000000001',
        day: performanceFixture.today,
        kind: 'walk',
        minutes: 20,
        distance: 1,
        unit: 'mi',
        intensity: null,
        note: 'Synthetic walk',
        voided: false,
      },
    },
    {
      version: 1,
      updatedAt: '',
      data: {
        id: '77000000-0000-4000-9000-000000000002',
        day: performanceFixture.today,
        kind: 'mobility',
        minutes: 10,
        distance: null,
        unit: 'mi',
        intensity: null,
        note: '',
        voided: false,
      },
    },
  ],
};
