import type { Checkin, PerformanceData } from './schema';
export function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function convertWeight(value: number, from: 'kg' | 'lb', to: 'kg' | 'lb') {
  return from === to ? value : from === 'lb' ? value * 0.45359237 : value / 0.45359237;
}
export const roundWeight = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
/** Fixed calendar windows, per-metric denominators and no imputation. */
export function fuelReview(
  data: Pick<PerformanceData, 'today' | 'checkins' | 'profile' | 'fuelTargets'>,
) {
  const unit = data.fuelTargets?.data.unit ?? data.profile?.data.unit ?? 'lb';
  const since = shiftDay(data.today, -27);
  const records = data.checkins
    .map((c) => c.data)
    .filter((c) => c.day >= since && c.day <= data.today)
    .sort((a, b) => a.day.localeCompare(b.day));
  const recent = records.filter((c) => c.day >= shiftDay(data.today, -6));
  const metric = (key: 'calories' | 'protein' | 'waterMl', completeOnly: boolean) => {
    const days = recent.filter((c) => (!completeOnly || c.nutritionComplete) && c[key] !== null);
    return { average: average(days.map((c) => c[key]!)), days: days.length };
  };
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = shiftDay(data.today, -27 + i * 7);
    const end = shiftDay(start, 6);
    const readings = records.filter((c) => c.day >= start && c.day <= end && c.weight !== null);
    const mean = average(readings.map((c) => convertWeight(c.weight!, c.unit, unit)));
    return { start, end, average: mean, days: readings.length };
  });
  const latest = weeks[3]!;
  const previous = weeks[2]!;
  const change =
    latest.days >= 3 && previous.days >= 3 ? latest.average! - previous.average! : null;
  return {
    since,
    until: data.today,
    unit,
    weeks,
    change,
    calories: metric('calories', true),
    protein: metric('protein', true),
    water: metric('waterMl', false),
    completeDays: recent.filter(
      (c) => c.nutritionComplete && (c.calories !== null || c.protein !== null),
    ).length,
    partialDays: recent.filter(
      (c) => !c.nutritionComplete && (c.calories !== null || c.protein !== null),
    ).length,
    weightReadings: records
      .filter((c) => c.weight !== null)
      .map((c) => ({ day: c.day, value: c.weight!, unit: c.unit })),
  };
}
export function emptyFuelDay(day: string, unit: Checkin['unit']): Checkin {
  return {
    day,
    unit,
    sleepMinutes: null,
    energy: null,
    soreness: null,
    weight: null,
    calories: null,
    protein: null,
    waterMl: null,
    nutritionComplete: false,
  };
}
