import { shiftDay } from './fuel';
import type { PerformanceData } from './schema';
export const recoveryActions = {
  'quiet-time': 'Quiet wind-down',
  'screen-break': 'Screen break',
  'gentle-mobility': 'Gentle mobility',
  rest: 'Protected rest',
} as const;
export const recoveryOutcomes = { done: 'Done', partial: 'Partly', skipped: 'Skipped' } as const;
export function recoveryReview(
  data: Pick<PerformanceData, 'today' | 'checkins' | 'recoveryRoutines'>,
) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(data.today, i - 6);
    const check = data.checkins.find((c) => c.data.day === day)?.data;
    return {
      day,
      sleepMinutes: check?.sleepMinutes ?? null,
      energy: check?.energy ?? null,
      soreness: check?.soreness ?? null,
    };
  });
  const sleep = days.flatMap((d) => (d.sleepMinutes === null ? [] : [d.sleepMinutes]));
  const energy = days.flatMap((d) => (d.energy === null ? [] : [d.energy]));
  const routines = (data.recoveryRoutines ?? [])
    .filter((r) => r.data.day >= shiftDay(data.today, -27) && r.data.day <= data.today)
    .sort((a, b) => b.data.day.localeCompare(a.data.day))
    .map((r) => {
      const nextDay = shiftDay(r.data.day, 1);
      const check =
        nextDay <= data.today ? data.checkins.find((c) => c.data.day === nextDay) : undefined;
      return {
        record: r,
        nextDay,
        observation: check
          ? {
              sleepMinutes: check.data.sleepMinutes,
              energy: check.data.energy,
              soreness: check.data.soreness,
            }
          : null,
        pending: nextDay > data.today,
      };
    });
  return {
    days,
    sleep: {
      average: sleep.length ? sleep.reduce((a, b) => a + b, 0) / sleep.length : null,
      days: sleep.length,
    },
    energy: {
      average: energy.length ? energy.reduce((a, b) => a + b, 0) / energy.length : null,
      days: energy.length,
    },
    sorenessDays: days.filter((d) => d.soreness !== null).length,
    highSorenessDays: days.filter((d) => d.soreness === 'high').length,
    routines,
  };
}
export const sleepText = (minutes: number | null) =>
  minutes === null ? 'Not recorded' : `${Math.round((minutes / 60) * 10) / 10} h`;
