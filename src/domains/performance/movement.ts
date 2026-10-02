import { shiftDay } from './fuel';
import type { PerformanceData } from './schema';
export const movementNames = {
  walk: 'Walking',
  run: 'Running',
  cycle: 'Cycling',
  row: 'Rowing',
  swim: 'Swimming',
  cardio: 'Other cardio',
  mobility: 'Mobility',
} as const;
export function movementReview(data: Pick<PerformanceData, 'today' | 'movements'>) {
  const records = (data.movements ?? [])
    .filter(
      (r) => !r.data.voided && r.data.day >= shiftDay(data.today, -27) && r.data.day <= data.today,
    )
    .sort((a, b) => b.data.day.localeCompare(a.data.day) || b.updatedAt.localeCompare(a.updatedAt));
  const week = records.filter((r) => r.data.day >= shiftDay(data.today, -6)).map((r) => r.data);
  const cardio = week.filter((r) => r.kind !== 'mobility');
  return {
    records,
    cardioMinutes: cardio.reduce((n, r) => n + r.minutes, 0),
    mobilityMinutes: week.filter((r) => r.kind === 'mobility').reduce((n, r) => n + r.minutes, 0),
    recordedDays: new Set(week.map((r) => r.day)).size,
    unknownIntensityMinutes: cardio
      .filter((r) => r.intensity === null)
      .reduce((n, r) => n + r.minutes, 0),
    distance: (Object.keys(movementNames) as (keyof typeof movementNames)[]).flatMap((kind) => {
      const entries = week.filter((r) => r.kind === kind && r.distance !== null);
      return entries.length
        ? [
            {
              kind,
              km: entries.reduce((n, r) => n + r.distance! * (r.unit === 'mi' ? 1.609344 : 1), 0),
              records: entries.length,
            },
          ]
        : [];
    }),
  };
}
