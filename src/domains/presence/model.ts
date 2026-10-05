import { shiftDay } from '@/domains/daily-command/model';

export type PresenceData = {
  mode: 'personal' | 'signed-out';
  ownerId?: string;
  today: string;
  direction: string | null;
  occasions: { title: string; day: string; note: string }[];
  replenishment: { name: string; note: string }[];
  unavailable: string[];
};

/** A saved occasion is relevant within seven days; missing routine logs are never a signal. */
export function approachingOccasion<T extends { day: string }>(occasions: T[], today: string) {
  return (
    occasions
      .filter((occasion) => occasion.day >= today && occasion.day <= shiftDay(today, 7))
      .sort((a, b) => a.day.localeCompare(b.day))[0] ?? null
  );
}

export const presenceStarter =
  'Help me prepare how I show up: grooming, skin, hair, beard, wardrobe and confidence for an important moment. Use relevant saved appearance direction, dated scan summaries, service records, product notes and upcoming occasions only if I enable personal context. Ask which occasion I mean if unclear. Help me choose a few practical preparations, without daily logging or streaks. Ask about wardrobe and service timing rather than inventing a wardrobe inventory or haircut cycle. Do not claim to book, monitor, remind or save anything.';
