import { foundationLibrary, type HealthFoundationId } from './foundations';
import { eveningCatalog, type EveningStepId } from './routine';

export type AssistAction =
  | { kind: 'open'; foundation: HealthFoundationId; reason: string }
  | { kind: 'minutes'; minutes: number; reason: string }
  | { kind: 'finish'; finishAt: string; reason: string }
  | { kind: 'markers'; names: string[]; reason: string }
  | { kind: 'help'; reason: string };

const minutePattern = /\b(\d{1,2})\s*(minutes|minute|mins|min)\b/i;
const wordMinutes: Record<string, number> = {
  ten: 10,
  twenty: 20,
  fifteen: 15,
  thirty: 30,
  five: 5,
};
const timePattern = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

export function interpretHealthAssist(text: string): AssistAction {
  const value = text.trim();
  if (!value) return { kind: 'help', reason: 'Ask for a routine, bloodwork, or a time change.' };
  const lower = value.toLowerCase();
  if (/evening|cook|dinner|kitchen/.test(lower)) {
    const minutes = parseMinutes(lower);
    if (minutes)
      return {
        kind: 'minutes',
        minutes,
        reason: `Apply a ${minutes}-minute limit to the evening sequence.`,
      };
    return {
      kind: 'open',
      foundation: 'evening-routine',
      reason: foundationLibrary[0]!.prompt,
    };
  }
  if (/blood|lab|marker|ldl|hdl|tsh|glucose/.test(lower)) {
    const names = ['LDL cholesterol', 'HDL cholesterol', 'Glucose', 'TSH'].filter((name) =>
      lower.includes(name.split(' ')[0]!.toLowerCase()),
    );
    if (names.length)
      return { kind: 'markers', names, reason: `Show ${names.join(', ')} in the tracker.` };
    return {
      kind: 'open',
      foundation: 'bloodwork-tracker',
      reason: foundationLibrary[1]!.prompt,
    };
  }
  const minutes = parseMinutes(lower);
  if (minutes)
    return { kind: 'minutes', minutes, reason: `Change the time limit to ${minutes} minutes.` };
  const finish = parseClock(lower);
  if (finish)
    return { kind: 'finish', finishAt: finish, reason: `Set the finish time to ${finish}.` };
  return {
    kind: 'help',
    reason:
      'Direct editing stays available. I can open the evening sequence, open Bloodwork Tracker, or apply a stated time limit. This is not clinical advice.',
  };
}

export function stepByTitle(title: string): EveningStepId | null {
  const found = eveningCatalog.find((step) => step.title.toLowerCase() === title.toLowerCase());
  return found?.id ?? null;
}

function parseMinutes(text: string) {
  const numeric = text.match(minutePattern);
  if (numeric) return Math.min(90, Math.max(4, Number(numeric[1])));
  for (const [word, minutes] of Object.entries(wordMinutes)) {
    if (new RegExp(`\\b${word}\\b`).test(text) && /minute/.test(text)) return minutes;
  }
  return null;
}

function parseClock(text: string) {
  const match = text.match(/\b(?:finish(?:es)? at|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ?? '00';
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23) return null;
  return `${hour.toString().padStart(2, '0')}:${minute}`;
}

export { timePattern };
