import type { Plan } from './schema';
export const exerciseCatalog = [
  {
    id: '77000000-0000-4000-8000-000000000001',
    name: 'Goblet squat',
    pattern: 'squat',
    equipment: 'Dumbbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000002',
    name: 'Barbell back squat',
    pattern: 'squat',
    equipment: 'Barbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000003',
    name: 'Leg press',
    pattern: 'squat',
    equipment: 'Machine',
  },
  {
    id: '77000000-0000-4000-8000-000000000004',
    name: 'Dumbbell Romanian deadlift',
    pattern: 'hinge',
    equipment: 'Dumbbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000005',
    name: 'Barbell Romanian deadlift',
    pattern: 'hinge',
    equipment: 'Barbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000006',
    name: 'Hip thrust',
    pattern: 'hinge',
    equipment: 'Barbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000007',
    name: 'Push-up',
    pattern: 'push',
    equipment: 'Bodyweight',
  },
  {
    id: '77000000-0000-4000-8000-000000000008',
    name: 'Dumbbell bench press',
    pattern: 'push',
    equipment: 'Dumbbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000009',
    name: 'Barbell bench press',
    pattern: 'push',
    equipment: 'Barbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000010',
    name: 'Dumbbell overhead press',
    pattern: 'push',
    equipment: 'Dumbbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000011',
    name: 'Cable row',
    pattern: 'pull',
    equipment: 'Cable',
  },
  {
    id: '77000000-0000-4000-8000-000000000012',
    name: 'One-arm dumbbell row',
    pattern: 'pull',
    equipment: 'Dumbbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000013',
    name: 'Lat pulldown',
    pattern: 'pull',
    equipment: 'Cable',
  },
  {
    id: '77000000-0000-4000-8000-000000000014',
    name: 'Pull-up',
    pattern: 'pull',
    equipment: 'Bodyweight',
  },
  {
    id: '77000000-0000-4000-8000-000000000015',
    name: 'Reverse lunge',
    pattern: 'single-leg',
    equipment: 'Bodyweight',
  },
  {
    id: '77000000-0000-4000-8000-000000000016',
    name: 'Dumbbell split squat',
    pattern: 'single-leg',
    equipment: 'Dumbbell',
  },
  {
    id: '77000000-0000-4000-8000-000000000017',
    name: 'Calf raise',
    pattern: 'accessory',
    equipment: 'Bodyweight',
  },
  {
    id: '77000000-0000-4000-8000-000000000018',
    name: 'Dumbbell curl',
    pattern: 'accessory',
    equipment: 'Dumbbell',
  },
] as const;
export type CatalogExercise = (typeof exerciseCatalog)[number];
export function catalogExercise(entry: CatalogExercise): Plan['exercises'][number] {
  return {
    id: entry.id,
    name: entry.name,
    sets: 2,
    reps: 8,
    load: 0,
    restSeconds: 90,
    progression: 'manual',
  };
}
export function finalizeExerciseNames(plan: Plan, initial: Plan): Plan {
  return {
    ...plan,
    exercises: plan.exercises.map((e) => {
      const before = initial.exercises.find((x) => x.id === e.id);
      return before && before.name !== e.name
        ? { ...e, id: crypto.randomUUID(), load: 0, progression: 'manual' }
        : e;
    }),
  };
}
