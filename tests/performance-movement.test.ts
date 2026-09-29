import { describe, it, expect } from 'vitest';
import { movementSchema, type Movement } from '../src/domains/performance/schema';
import { movementReview } from '../src/domains/performance/movement';
import {
  catalogExercise,
  exerciseCatalog,
  finalizeExerciseNames,
} from '../src/domains/performance/catalog';
import { shiftDay } from '../src/domains/performance/fuel';
const today = '2026-09-29';
const entry = (patch: Partial<Movement> = {}) => ({
  version: 1,
  updatedAt: '',
  data: {
    id: crypto.randomUUID(),
    day: today,
    kind: 'walk' as const,
    minutes: 20,
    distance: null,
    unit: 'mi' as const,
    intensity: null,
    note: '',
    voided: false,
    ...patch,
  },
});
describe('broader movement evidence', () => {
  it('keeps cardio/mobility distinct and converts distance only within each activity type', () => {
    const report = movementReview({
      today,
      movements: [
        entry({ distance: 1 }),
        entry({ distance: 1, unit: 'km', intensity: 'easy' }),
        entry({ kind: 'cycle', distance: 10, intensity: 'moderate' }),
        entry({ kind: 'mobility', minutes: 15 }),
      ],
    });
    expect(report.cardioMinutes).toBe(60);
    expect(report.mobilityMinutes).toBe(15);
    expect(report.unknownIntensityMinutes).toBe(20);
    expect(report.recordedDays).toBe(1);
    expect(report.distance[0]).toMatchObject({ kind: 'walk', records: 2 });
    expect(report.distance[0]!.km).toBeCloseTo(2.609344);
    expect(report.distance[1]!.kind).toBe('cycle');
  });
  it('excludes removed, old and future data and bounds the seven-day window independently of history', () => {
    const report = movementReview({
      today,
      movements: [
        entry({ voided: true }),
        entry({ day: shiftDay(today, -28) }),
        entry({ day: shiftDay(today, 1) }),
        entry({ day: shiftDay(today, -7) }),
      ],
    });
    expect(report.records).toHaveLength(1);
    expect(report.cardioMinutes).toBe(0);
    expect(report.recordedDays).toBe(0);
  });
  it('validates appropriate units and preserves unknown intensity', () => {
    expect(movementSchema.safeParse(entry().data).success).toBe(true);
    for (const patch of [
      { minutes: 0 },
      { minutes: 1.2 },
      { distance: 0 },
      { unit: 'meters' },
      { kind: 'mobility', distance: 1 },
      { kind: 'mobility', intensity: 'easy' },
      { extra: 'x' },
    ])
      expect(movementSchema.safeParse({ ...entry().data, ...patch }).success).toBe(false);
  });
  it('library identities are stable, distinct and start with manual targets and cleared loads', () => {
    expect(new Set(exerciseCatalog.map((x) => x.id)).size).toBe(exerciseCatalog.length);
    const exercise = catalogExercise(exerciseCatalog[0]);
    expect(exercise).toMatchObject({ load: 0, progression: 'manual' });
    expect(catalogExercise(exerciseCatalog[0]).id).toBe(exercise.id);
    const original = {
      title: 'Session',
      unit: 'lb' as const,
      exercises: [{ ...exercise, load: 40 }],
    };
    const changed = {
      ...original,
      exercises: [{ ...original.exercises[0]!, name: 'Custom variation' }],
    };
    const saved = finalizeExerciseNames(changed, original);
    expect(saved.exercises[0]!.id).not.toBe(exercise.id);
    expect(saved.exercises[0]!.load).toBe(0);
    expect(original.exercises[0]!.load).toBe(40);
    expect(finalizeExerciseNames(original, original)).toEqual(original);
  });
});
