import type { DayInput } from './schema';
export type { DayInput, DayAction } from './schema';
export type DailyReview = {progress:string;blocker:string;tomorrow:string;version:number;source_kind:'user';source_day_version:number;confirmed_at:string};
export type DayEntry = DayInput & { timezone: string; updated_at: string | null; review?: DailyReview | null };
export type DailyData = {
  mode: 'personal' | 'preview' | 'sample';
  name: string | null;
  today: string;
  timezone: string;
  entries: DayEntry[];
  goal: { title: string; next_step: string } | null;
  conversation: { id: string; title: string } | null;
  carryForward?: { day: string; reflection: string; tomorrow: string; blocker: string; unfinished: string[] } | null;
  openCaptures?: number;
  profileDirection?: string | null;
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
export type LoopMove = { label: string; detail: string; target: 'profile' | 'goal' | 'intention' | 'action' | 'complete' | 'review' | 'tomorrow' };
/** A navigation hint derived only from confirmed records, never an AI assessment. */
export function nextLoopMove(data: DailyData): LoopMove | null {
  if (data.mode !== 'personal') return null;
  const today = data.entries.find(entry => entry.day === data.today);
  if (!data.profileDirection) return { label: 'Set your starting point', detail: 'Tell Aethelios what direction matters now. You choose what he keeps.', target: 'profile' };
  if (!data.goal) return { label: 'Choose one larger goal', detail: 'Give today a direction you can return to.', target: 'goal' };
  if (!today?.intention) return { label: 'Set today’s intention', detail: 'Choose what deserves your attention today.', target: 'intention' };
  if (!today.actions.length) return { label: 'Choose one action', detail: 'Make your intention concrete with a step you can take.', target: 'action' };
  if (!today.actions.some(action => action.done)) return { label: 'Follow through on your day', detail: 'When you finish a step, mark it complete. You can also capture what changed.', target: 'complete' };
  if (!today.review) return { label: 'Close today’s loop', detail: 'Record what moved forward and what tomorrow should know.', target: 'review' };
  return { label: 'Return tomorrow with context', detail: 'Your confirmed review is saved for the next day. Keep using Command as life moves.', target: 'tomorrow' };
}
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
