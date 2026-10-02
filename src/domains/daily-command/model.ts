import { z } from 'zod';
export const arrivalSchema = z
  .object({
    sleepMinutes: z.number().int().min(0).max(1440).nullable(),
    energy: z.number().int().min(1).max(5).nullable(),
    soreness: z.enum(['none', 'mild', 'high']).nullable(),
    bandwidth: z.enum(['limited', 'steady', 'open']).nullable(),
    minutes: z.number().int().min(5).max(240).nullable(),
  })
  .strict();
export type Arrival = z.infer<typeof arrivalSchema>;
export const emptyArrival: Arrival = {
  sleepMinutes: null,
  energy: null,
  soreness: null,
  bandwidth: null,
  minutes: null,
};
export type DailyCommandState = 'RECOVER' | 'STEADY' | 'READY' | 'PUSH';
export type DailyCommandConfidence = {
  level: 'limited' | 'partial' | 'supported';
  known: number;
  total: number;
  missing: string[];
};
export type Signal = {
  family: 'recovery' | 'training' | 'fuel' | 'movement' | 'life' | 'grooming' | 'occasion';
  source: 'user-reported' | 'app-history';
  detail: string;
  day: string;
};
export type DailyCommandDecision = {
  id: string;
  label: string;
  detail: string;
  reason: string;
  href: string;
};
export type DailyCommandSignals = {
  day: string;
  arrival: Arrival;
  signals: Signal[];
  recentTraining: { day: string; sets: number; effort: number | null; pain: boolean }[];
  water: number | null;
  waterTarget: number | null;
  priority: string | null;
  blocker: string | null;
  goal: string | null;
  ritual: string | null;
  occasion: { title: string; day: string } | null;
  priorFit?: DailyCommandOutcome['fit'];
  unavailable: string[];
};
export type DailyCommandSnapshot = {
  ruleVersion: 1;
  day: string;
  state: DailyCommandState;
  reason: string;
  confidence: DailyCommandConfidence;
  signals: Signal[];
  decisions: DailyCommandDecision[];
  interpretation: string;
  unavailable: string[];
};
export const outcomeSchema = z
  .object({
    decisions: z
      .array(
        z
          .object({
            id: z.string().max(100),
            result: z.enum(['done', 'partial', 'skipped', 'unknown']),
          })
          .strict(),
      )
      .max(5),
    fit: z.enum(['right', 'too-much', 'too-light', 'unsure']).nullable(),
    tomorrow: z.string().trim().max(240),
  })
  .strict();
export type DailyCommandOutcome = z.infer<typeof outcomeSchema>;
export const mutationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('arrival'),
      requestId: z.uuid(),
      ownerId: z.uuid(),
      day: z.iso.date(),
      version: z.number().int().min(0),
      arrival: arrivalSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('outcome'),
      requestId: z.uuid(),
      ownerId: z.uuid(),
      day: z.iso.date(),
      version: z.number().int().positive(),
      outcome: outcomeSchema,
    })
    .strict(),
]);
export type CommandRecord = {
  person_id: string;
  day: string;
  version: number;
  arrival: Arrival;
  snapshot: DailyCommandSnapshot;
  outcome: DailyCommandOutcome | null;
  updated_at: string;
};
export type CommandData = {
  ownerId?: string;
  mode: 'personal' | 'preview';
  snapshot: DailyCommandSnapshot | null;
  arrival: Arrival;
  record: CommandRecord | null;
  yesterday: { day: string; outcome: DailyCommandOutcome } | null;
  error?: string;
};
/** Product heuristics, not a physiological measurement. Null never means zero. */
export function deriveCommand(input: DailyCommandSignals): DailyCommandSnapshot {
  const a = input.arrival;
  const fields = [
    ['Sleep', a.sleepMinutes],
    ['Energy', a.energy],
    ['Soreness', a.soreness],
  ] as const;
  const missing = fields.filter(([, value]) => value === null).map(([name]) => name);
  const known = 3 - missing.length;
  const recent = input.recentTraining.filter(
    (s) => s.day <= input.day && s.day >= shiftDay(input.day, -2),
  );
  const demanding = recent.some((s) => (s.effort !== null && s.effort >= 8) || s.sets >= 16);
  const caution =
    a.soreness === 'high' ||
    (a.energy !== null && a.energy <= 2) ||
    (a.sleepMinutes !== null && a.sleepMinutes < 360) ||
    recent.some((s) => s.pain);
  const solid = known === 3 && a.sleepMinutes! >= 420 && a.energy! >= 4 && a.soreness !== 'high';
  const state: DailyCommandState = caution
    ? 'RECOVER'
    : solid &&
        !demanding &&
        a.energy === 5 &&
        a.soreness === 'none' &&
        a.bandwidth === 'open' &&
        input.recentTraining.some((s) => s.day < input.day && s.day >= shiftDay(input.day, -6)) &&
        !input.recentTraining.some((s) => s.day === input.day) &&
        input.unavailable.length === 0 &&
        input.priorFit !== 'too-much'
      ? 'PUSH'
      : solid && a.bandwidth !== 'limited'
        ? 'READY'
        : 'STEADY';
  const cautions = [
    a.soreness === 'high' ? 'high soreness' : '',
    a.energy !== null && a.energy <= 2 ? 'low energy' : '',
    a.sleepMinutes !== null && a.sleepMinutes < 360 ? 'less than six hours of reported sleep' : '',
    recent.some((s) => s.pain) ? 'recent training discomfort' : '',
  ].filter(Boolean);
  const reason = caution
    ? `Take a more conservative day in light of ${cautions.join(', ')}.`
    : known < 3
      ? 'Today’s recovery picture is incomplete. Keep the next move manageable.'
      : a.bandwidth === 'limited'
        ? 'Keep the day focused around the capacity you reported.'
        : demanding
          ? 'Your check-in looks steady; recent demanding training still deserves consideration.'
          : solid
            ? 'Your reported sleep, energy and soreness support your usual day.'
            : 'Your check-in suggests a steady pace. Choose what matters most.';
  const decisions: DailyCommandDecision[] = [];
  const fitContext =
    input.priorFit === 'too-much'
      ? ' Yesterday’s direction felt like too much. Consider a smaller session today.'
      : '';
  const add = (id: string, label: string, detail: string, why: string, href: string) =>
    decisions.push({ id, label, detail, reason: why, href });
  if (input.occasion)
    add(
      'occasion',
      'PREPARE',
      `${input.occasion.title} · ${input.occasion.day}`,
      'A saved grooming occasion is approaching. Review your look and handoff.',
      '/app/grooming/professional',
    );
  if (input.priority)
    add(
      'focus',
      'FOCUS',
      input.priority,
      input.blocker
        ? `Carry-forward blocker: ${input.blocker}`
        : input.goal
          ? `In the context of your goal: ${input.goal}`
          : 'Your saved intention or unfinished priority deserves attention.',
      '/app/daily#daily-actions',
    );
  const trainedToday = input.recentTraining.some((s) => s.day === input.day);
  add(
    'training',
    trainedToday ? 'RECOVER' : caution ? 'RECOVER' : 'TRAIN',
    trainedToday
      ? 'Your session is recorded. Leave room to recover.'
      : caution
        ? 'Consider rest or a lighter session.'
        : a.minutes !== null
          ? `Review a session that fits ${a.minutes} minutes.`
          : 'Review your usual session before starting.',
    fitContext
      ? fitContext.trim()
      : demanding
        ? 'Recent recorded training was demanding. Check how the intended movements feel.'
        : reason,
    caution || trainedToday ? '/app/performance?space=restore' : '/app/performance',
  );
  if (input.water !== null && input.waterTarget !== null && input.water < input.waterTarget)
    add(
      'fuel',
      'HYDRATE',
      'Recorded water is below your chosen daily reference.',
      'This is a partial-day log, not evidence of dehydration.',
      '/app/performance?space=fuel',
    );
  else if (input.water === null)
    add(
      'fuel',
      'FUEL',
      'Check your water and food plan if useful.',
      'Intake is unknown. No deficit is assumed.',
      '/app/performance?space=fuel',
    );
  if (input.ritual)
    add(
      'groom',
      'GROOM',
      input.ritual,
      'Your saved morning ritual has no completion recorded today.',
      '/experience/grooming',
    );
  if (!input.priority && decisions.length < 5)
    add(
      'focus',
      'FOCUS',
      input.goal ?? 'Choose one meaningful action.',
      'You choose the priority; no task or goal has been created.',
      '/app/daily#daily-actions',
    );
  return {
    ruleVersion: 1,
    day: input.day,
    state,
    reason,
    confidence: {
      level:
        known === 3 && input.unavailable.length === 0
          ? 'supported'
          : known === 0
            ? 'limited'
            : 'partial',
      known,
      total: 3,
      missing,
    },
    signals: input.signals,
    decisions: decisions.slice(0, 5),
    interpretation:
      input.priorFit === 'too-much'
        ? 'Yesterday felt like too much. Keep today’s scope smaller and review how it fits; your plan remains yours.'
        : caution
          ? 'Protect your capacity. Keep one meaningful priority and give yourself room to adjust.'
          : a.bandwidth === 'limited'
            ? 'A smaller, deliberate day can still move you forward.'
            : solid
              ? 'You have room to act. Keep the day focused and choose the scope yourself.'
              : 'Start with what matters. You do not need to track everything to make a useful next move.',
    unavailable: input.unavailable,
  };
}
export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function commandDraft(s: DailyCommandSnapshot) {
  const header = `Help me interpret and prioritize my day. This is a rule-based suggestion, not a biometric assessment.\n${s.day}: ${s.state}. ${s.reason}\nConfidence: ${s.confidence.level}; missing: ${s.confidence.missing.join(', ') || 'none of the three arrival signals'}. Unavailable context: ${s.unavailable.join(', ') || 'none'}.\nSuggested moves:\n${s.decisions.map((x) => `${x.label}: ${x.detail} Why: ${x.reason}`).join('\n')}\n`;
  const ending = '\nAsk before changing any plan. Do not diagnose or infer causation.';
  let draft = header;
  for (const signal of s.signals) {
    const line = `${signal.source} (${signal.day}): ${signal.detail}\n`;
    if (draft.length + line.length > 5500) { draft += 'Additional evidence remains in Daily Command; not included in this draft.\n'; break; }
    draft += line;
  }
  return draft.slice(0, 5800) + ending;
}
