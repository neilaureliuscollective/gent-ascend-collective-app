import { describe, it, expect } from 'vitest';
import {
  defaultProfile,
  nextAdjustment,
  samplePerformance,
  starterPlan,
  todayDirection,
  weeklyReview,
} from '../src/domains/performance/model';
import {
  mutationSchema,
  sessionSchema,
  type PerformanceData,
  type Session,
} from '../src/domains/performance/schema';
const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function history(): PerformanceData {
  const plan = {
    title: 'Strength',
    unit: 'lb' as const,
    exercises: [{ id: id(1), name: 'Row', sets: 2, reps: 8, load: 40, restSeconds: 90 }],
  };
  return {
    ...samplePerformance(),
    today: '2026-09-28',
    mode: 'personal',
    owner: id(99),
    profile: { data: defaultProfile, version: 1, updatedAt: '2026-09-20T12:00:00Z' },
    plan: { data: plan, version: 1, updatedAt: '2026-09-20T12:00:00Z' },
    sessions: [0, 1].map((i) => ({
      version: 1,
      updatedAt: '2026-09-27T12:00:00Z',
      data: {
        id: id(i + 10),
        title: 'Strength',
        planVersion: 1,
        startedAt: `2026-09-${27 - i * 2}T12:00:00Z`,
        endedAt: `2026-09-${27 - i * 2}T12:30:00Z`,
        status: 'complete',
        unit: 'lb',
        pain: false,
        note: '',
        sets: [1, 2].map((n) => ({
          id: id(i * 10 + n + 20),
          exerciseId: id(1),
          exercise: 'Row',
          targetReps: 8,
          targetLoad: 40,
          reps: 8,
          load: 40,
          effort: 7,
          done: true,
        })),
      } as Session,
    })),
  };
}
describe('Performance evidence and boundaries', () => {
  it('proposes one rep after two matching sessions and reports sources', () => {
    const data = history();
    expect(nextAdjustment(data)).toMatchObject({
      exercise: 'Row',
      from: 8,
      to: 9,
      sourceIds: [id(10), id(11)],
    });
  });
  it('withholds progression for missing effort, missing sets, changed plans, pain, limitations, or high fatigue', () => {
    for (const change of [
      (d: PerformanceData) => {
        d.sessions[0]!.data.sets[0]!.effort = null;
      },
      (d: PerformanceData) => {
        d.sessions[0]!.data.sets.pop();
      },
      (d: PerformanceData) => {
        d.plan!.version = 2;
      },
      (d: PerformanceData) => {
        d.sessions[0]!.data.pain = true;
      },
      (d: PerformanceData) => {
        d.profile!.data = { ...defaultProfile, limitations: 'Shoulder limitation' };
      },
      (d: PerformanceData) => {
        d.sessions[0]!.data.unit = 'kg';
      },
      (d: PerformanceData) => {
        d.sessions[0]!.data.sets[0]!.load = 50;
      },
      (d: PerformanceData) => {
        d.checkins = [
          {
            version: 1,
            updatedAt: '',
            data: {
              day: d.today,
              sleepMinutes: 240,
              energy: null,
              soreness: null,
              weight: null,
              unit: 'lb',
              calories: null,
              protein: null,
              waterMl: null,
              nutritionComplete: false,
            },
          },
        ];
      },
    ]) {
      const data = history();
      change(data);
      expect(nextAdjustment(data)).toBeNull();
    }
  });
  it('does not treat old history or an incomplete session as current evidence', () => {
    const d = history();
    d.today = '2026-11-01';
    expect(nextAdjustment(d)).toBeNull();
    d.today = '2026-09-28';
    d.sessions[0]!.data.status = 'abandoned';
    expect(nextAdjustment(d)).toBeNull();
  });
  it('keeps missing sleep unknown and counts only completed sessions in the local week', () => {
    const d = history();
    d.sessions[1]!.data.status = 'abandoned';
    expect(weeklyReview(d)).toMatchObject({
      sessions: 1,
      sets: 2,
      sleepMinutes: null,
      sleepDays: 0,
    });
    d.timezone = 'America/Chicago';
    d.today = '2026-09-27';
    d.sessions[0]!.data.endedAt = '2026-09-28T01:00:00Z';
    expect(weeklyReview(d).sessions).toBe(1);
  });
  it('validates units, ownership marker, and set completion before sync', () => {
    const d = history();
    const s = d.sessions[0]!.data;
    expect(sessionSchema.safeParse(s).success).toBe(true);
    expect(sessionSchema.safeParse({ ...s, sets: [{ ...s.sets[0]!, reps: null }] }).success).toBe(
      false,
    );
    expect(
      mutationSchema.safeParse({
        kind: 'session',
        requestId: id(20),
        expectedVersion: 0,
        payload: s,
      }).success,
    ).toBe(false);
    expect(
      mutationSchema.safeParse({
        kind: 'session',
        owner: id(99),
        requestId: id(20),
        expectedVersion: 0,
        payload: s,
      }).success,
    ).toBe(true);
    expect(sessionSchema.safeParse({ ...s, endedAt: '2026-09-27T12:30:00+00:00' }).success).toBe(
      true,
    );
  });
  it('presents setup as the next move and provides equipment-specific editable defaults', () => {
    expect(todayDirection(samplePerformance()).title).toContain('direction');
    expect(
      starterPlan({ ...defaultProfile, equipment: 'bodyweight' }, () => id(1)).exercises[0]!.name,
    ).toBe('Chair squat');
  });
});
