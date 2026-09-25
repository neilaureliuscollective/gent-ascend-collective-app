import type { DayInput } from './schema';
export type { DayInput, DayAction } from './schema';
export type DayEntry = DayInput & { timezone: string; updated_at: string | null };
export type DailyData = {
  mode: 'personal' | 'preview' | 'sample';
  name: string | null;
  today: string;
  timezone: string;
  entries: DayEntry[];
  goal: { title: string; next_step: string } | null;
  conversation: { id: string; title: string } | null;
  carryForward?: { day: string; reflection: string; unfinished: string[] } | null;
  openCaptures?: number;
};
export function localDay(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function daysEnding(day: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - count + i + 1);
    return date.toISOString().slice(0, 10);
  });
}
export function emptyDay(day: string, timezone: string): DayEntry {
  return {
    day,
    timezone,
    version: 0,
    energy: null,
    sleep_minutes: null,
    intention: '',
    reflection: '',
    actions: [],
    updated_at: null,
  };
}
export function dayLabel(day: string, short = false) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: short ? 'short' : 'long',
    day: 'numeric',
    ...(short ? {} : { weekday: 'long' as const }),
  }).format(new Date(`${day}T12:00:00Z`));
}
export const energyLabels = ['Very low', 'Low', 'Steady', 'Good', 'High'] as const;
export function sampleData(today: string): DailyData {
  const timezone = 'America/Chicago';
  const days = daysEnding(today, 7);
  const energies = [3, 4, null, 2, 3, 4, 4];
  return {
    mode: 'sample',
    name: 'Alex',
    today,
    timezone,
    goal: {
      title: 'Build a week that feels balanced.',
      next_step: 'Make time for movement and one meaningful conversation.',
    },
    conversation: null,
    entries: days
      .filter((_, i) => i !== 2)
      .map((day, i) => ({
        ...emptyDay(day, timezone),
        version: 1,
        energy: energies[days.indexOf(day)] ?? null,
        sleep_minutes: [420, 450, 390, 435, 465, 450][i] ?? 450,
        intention: day === today ? 'Make room for focused work and a clear mind.' : '',
        actions:
          day === today
            ? [
                {
                  id: '61000000-0000-4000-8000-000000000001',
                  title: 'Take a walk before the day gets busy',
                  done: true,
                },
                {
                  id: '61000000-0000-4000-8000-000000000002',
                  title: 'Give the most important project 45 focused minutes',
                  done: false,
                },
                {
                  id: '61000000-0000-4000-8000-000000000003',
                  title: 'Check in with someone who matters',
                  done: false,
                },
              ]
            : [],
        updated_at: `${day}T14:00:00Z`,
      })),
  };
}
