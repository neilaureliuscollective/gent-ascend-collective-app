import { z } from 'zod';
export const ritualKinds = ['morning', 'evening', 'weekly'] as const;
export const feedbackChoices = ['Comfortable', 'Too much effort', 'Something irritated'] as const;
export const ritualDraftInput = z
  .object({
    ownerId: z.uuid(),
    requestId: z.uuid(),
    kind: z.enum(ritualKinds),
    expectedVersion: z.number().int().min(0),
    title: z.string().trim().min(3).max(100),
    steps: z.string().trim().min(3).max(1000),
    sourceTurnId: z.uuid().nullable().default(null),
  })
  .strict();
export const ritualFeedbackInput = z
  .object({
    ownerId: z.uuid(),
    checkinId: z.uuid(),
    note: z.enum(feedbackChoices),
  })
  .strict();
export function suggestedRitualKind(at: Date, timezone: string): 'morning' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(at),
  );
  return hour >= 16 || hour < 4 ? 'evening' : 'morning';
}
export function ritualSteps(text: string) {
  return text
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean);
}
/** Counts only the bounded records supplied by the owner-bound week projection. */
export function practiceSummary(
  week: readonly { day: string; completed: number; notes: string[] }[],
) {
  return {
    days: new Set(week.filter((day) => day.completed > 0).map((day) => day.day)).size,
    recorded: week.reduce((total, day) => total + day.completed, 0),
    effort: week.reduce(
      (total, day) => total + day.notes.filter((note) => note === 'Too much effort').length,
      0,
    ),
    irritation: week.reduce(
      (total, day) => total + day.notes.filter((note) => note === 'Something irritated').length,
      0,
    ),
  };
}
export function starterRitual(
  focus: 'beard' | 'hair' | 'skin',
  kind: (typeof ritualKinds)[number],
) {
  const direction = {
    beard:
      'Follow the beard care that already works for me.\nShape and tidy to my preferred look.\nNotice comfort and anything worth changing.',
    hair: 'Follow my familiar hair care.\nStyle to my preferred direction.\nNotice comfort and anything worth changing.',
    skin: 'Follow the skin care that already works for me.\nUse my existing products as directed on their labels.\nNotice comfort and anything worth changing.',
  };
  return {
    title: `${kind[0]!.toUpperCase()}${kind.slice(1)} ${focus} ritual`,
    steps: direction[focus],
  };
}

export const ritualSuggestion = z
  .object({
    kind: z.enum(ritualKinds),
    title: z.string().trim().min(3).max(100),
    steps: z.string().trim().min(3).max(1000),
    reason: z.string().trim().min(1).max(300),
  })
  .strict();
/** Only a complete, schema-valid proposal earns a review control. Model prose is never executed. */
export function parseRitualSuggestion(text: string) {
  const blocks = [...text.matchAll(/```grooming-ritual\s*\n([\s\S]*?)```/g)];
  if (blocks.length !== 1) return null;
  try {
    const parsed = ritualSuggestion.safeParse(JSON.parse(blocks[0]![1]!));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
