import { describe, it, expect } from 'vitest';
import { emptyFuelDay, shiftDay } from '../src/domains/performance/fuel';
import { recoveryReview } from '../src/domains/performance/recovery';
import { recoveryRoutineSchema, type PerformanceData } from '../src/domains/performance/schema';
const today = '2026-09-28';
const routine = (day: string) => ({
  version: 1,
  updatedAt: '',
  data: { day, action: 'quiet-time' as const, minutes: 15, cue: 'After my shift', outcome: null },
});
describe('recovery evidence', () => {
  it('uses seven calendar days and separate denominators without treating missing observations as zero', () => {
    const checks = [
      { ...emptyFuelDay(today, 'lb'), sleepMinutes: 0 },
      {
        ...emptyFuelDay(shiftDay(today, -2), 'lb'),
        sleepMinutes: 480,
        energy: 4,
        soreness: 'high' as const,
      },
      { ...emptyFuelDay(shiftDay(today, -7), 'lb'), sleepMinutes: 720, energy: 1 },
      { ...emptyFuelDay(shiftDay(today, 1), 'lb'), sleepMinutes: 720 },
    ];
    const r = recoveryReview({
      today,
      checkins: checks.map((data) => ({ version: 1, updatedAt: '', data })),
    });
    expect(r.days).toHaveLength(7);
    expect(r.sleep).toEqual({ average: 240, days: 2 });
    expect(r.energy).toEqual({ average: 4, days: 1 });
    expect(r.highSorenessDays).toBe(1);
    expect(r.sorenessDays).toBe(1);
    expect(r.days[5]!.sleepMinutes).toBeNull();
  });
  it('pairs only the exact next day and retains unknown follow-through; never substitutes later evidence', () => {
    const data: Pick<PerformanceData, 'today' | 'checkins' | 'recoveryRoutines'> = {
      today,
      checkins: [
        {
          version: 1,
          updatedAt: '',
          data: { ...emptyFuelDay(today, 'lb'), sleepMinutes: 450, energy: 3 },
        },
      ],
      recoveryRoutines: [
        routine(today),
        routine(shiftDay(today, -1)),
        routine(shiftDay(today, -2)),
        routine(shiftDay(today, -28)),
        routine(shiftDay(today, 1)),
      ],
    };
    const original = structuredClone(data);
    const r = recoveryReview(data);
    expect(r.routines).toHaveLength(3);
    expect(r.routines[0]!.pending).toBe(true);
    expect(r.routines[0]!.observation).toBeNull();
    expect(r.routines[1]!.observation?.sleepMinutes).toBe(450);
    expect(r.routines[2]!.observation).toBeNull();
    expect(r.routines[1]!.record.data.outcome).toBeNull();
    expect(data).toEqual(original);
  });
  it('keeps empty history unknown and rejects extra, impossible or fractional routine input', () => {
    expect(recoveryReview({ today, checkins: [] }).sleep).toEqual({ average: null, days: 0 });
    const valid = routine(today).data;
    expect(recoveryRoutineSchema.safeParse(valid).success).toBe(true);
    for (const change of [
      { minutes: 0 },
      { minutes: 5.5 },
      { outcome: 'success' },
      { day: '2026-02-30' },
      { cue: 'x'.repeat(121) },
      { owner: 'someone' },
    ])
      expect(recoveryRoutineSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});
