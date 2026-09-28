import { describe, expect, it } from 'vitest';
import { convertWeight, emptyFuelDay, fuelReview, shiftDay } from '../src/domains/performance/fuel';
import {
  fuelTargetsSchema,
  type Checkin,
  type PerformanceData,
} from '../src/domains/performance/schema';
const today = '2026-09-28';
function review(entries: (Partial<Checkin> & { day: string })[]) {
  return fuelReview({
    today,
    profile: null,
    checkins: entries.map((e) => ({
      version: 1,
      updatedAt: '',
      data: { ...emptyFuelDay(e.day, 'kg'), ...e },
    })),
  });
}
describe('fuel and body evidence', () => {
  it('uses complete per-metric denominators, preserving recorded zero and excluding missing and partial values', () => {
    const result = review([
      { day: today, calories: 0, protein: null, waterMl: 500, nutritionComplete: true },
      { day: shiftDay(today, -1), calories: 2000, protein: 100, nutritionComplete: true },
      { day: shiftDay(today, -2), calories: 900, protein: 30, waterMl: 1000 },
      { day: shiftDay(today, -7), calories: 5000, nutritionComplete: true },
    ]);
    expect(result.calories).toEqual({ average: 1000, days: 2 });
    expect(result.protein).toEqual({ average: 100, days: 1 });
    expect(result.water).toEqual({ average: 750, days: 2 });
    expect(result.partialDays).toBe(1);
  });
  it('normalizes mixed units and requires three readings in both adjacent weeks', () => {
    const entries = [0, 1, 2, 7, 8, 9].map((ago) => ({
      day: shiftDay(today, -ago),
      weight: ago < 7 ? 80 : convertWeight(82, 'kg', 'lb'),
      unit: ago < 7 ? ('kg' as const) : ('lb' as const),
    }));
    const result = review(entries);
    expect(result.change).toBeCloseTo(convertWeight(-2, 'kg', 'lb'));
    expect(result.weeks.map((w) => w.days)).toEqual([0, 0, 3, 3]);
    expect(result.weightReadings[0]!.unit).toBe('lb');
    expect(review(entries.slice(1)).change).toBeNull();
  });
  it('keeps calendar gaps, ignores future and old records and leaves empty averages unknown', () => {
    const result = review([
      { day: shiftDay(today, -28), weight: 80 },
      { day: shiftDay(today, 1), weight: 90 },
      { day: shiftDay(today, -20), weight: 85 },
    ]);
    expect(result.weeks.map((w) => w.days)).toEqual([0, 1, 0, 0]);
    expect(result.change).toBeNull();
    expect(result.calories).toEqual({ average: null, days: 0 });
    expect(result.weightReadings).toHaveLength(1);
  });
  it('target edits never change historical intake or original weight records', () => {
    const data: Pick<PerformanceData, 'today' | 'profile' | 'checkins' | 'fuelTargets'> = {
      today,
      profile: null,
      checkins: [
        {
          version: 1,
          updatedAt: '',
          data: {
            ...emptyFuelDay(today, 'lb'),
            weight: 180,
            calories: 2200,
            nutritionComplete: true,
          },
        },
      ],
    };
    const before = structuredClone(data);
    const baseline = fuelReview(data);
    data.fuelTargets = {
      version: 1,
      updatedAt: '',
      data: { calories: 2500, protein: 120, waterMl: null, goalWeight: 80, unit: 'kg' },
    };
    const after = fuelReview(data);
    expect(after.calories).toEqual(baseline.calories);
    expect(after.weightReadings).toEqual(baseline.weightReadings);
    expect(data.checkins).toEqual(before.checkins);
    expect(after.weeks[3]!.average).toBeCloseTo(81.6466266);
  });
  it('accepts cleared optional references and rejects unknown or out-of-range inputs', () => {
    const blank = { calories: null, protein: null, waterMl: null, goalWeight: null, unit: 'kg' };
    expect(fuelTargetsSchema.safeParse(blank).success).toBe(true);
    for (const change of [
      { calories: 0 },
      { waterMl: 1.5 },
      { goalWeight: 701 },
      { protein: -1 },
      { owner: 'other' },
    ])
      expect(fuelTargetsSchema.safeParse({ ...blank, ...change }).success).toBe(false);
  });
});
