import type { CommandData, DailyCommandDecision } from '@/domains/daily-command/model';

export type ProactiveSignal = {
  id: 'occasion' | 'goal-deadline' | 'recovery';
  key: string;
  expiresAt: string;
  priority: number;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  action: string;
};

export type ActiveGoalSignalInput = {
  id: string;
  title: string;
  targetDate: string | null;
  nextStep: string;
  today: string;
} | null;

export type ProactiveProducerContext = {
  command?: CommandData | null;
  goal?: ActiveGoalSignalInput;
};

export type ProactiveProducer = (context: ProactiveProducerContext) => ProactiveSignal[];

function decision(snapshot: NonNullable<CommandData['snapshot']>, id: DailyCommandDecision['id']) {
  return snapshot.decisions.find((item) => item.id === id) ?? null;
}

function shiftDay(day: string, amount: number) {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function expiresAtEndOfDay(day: string) {
  return new Date(`${day}T23:59:59.999Z`).toISOString();
}

export const dailyCommandProducer: ProactiveProducer = ({ command }) => {
  const snapshot = command?.mode === 'personal' ? command.snapshot : null;
  if (!snapshot) return [];
  const queue: ProactiveSignal[] = [];

  const occasion = decision(snapshot, 'occasion');
  if (occasion && snapshot.supportingContext.occasion) {
    const value = snapshot.supportingContext.occasion;
    queue.push({
      id: 'occasion',
      key: `occasion:${value.day}:${value.title.trim().toLowerCase()}`,
      expiresAt: expiresAtEndOfDay(value.day),
      priority: 100,
      eyebrow: `AHEAD / ${value.day}`,
      title: value.title,
      detail: 'An important saved moment is approaching. Prepare once, then get back to your life.',
      href: '/app/aethelios?starter=presence',
      action: 'Prepare with Aethelios',
    });
  }

  if (snapshot.state === 'RECOVER') {
    const training = decision(snapshot, 'training');
    if (training)
      queue.push({
        id: 'recovery',
        key: `recovery:${snapshot.day}`,
        expiresAt: expiresAtEndOfDay(snapshot.day),
        priority: 80,
        eyebrow: 'TODAY / CAPACITY',
        title: 'Adjust the day before you push it.',
        detail: snapshot.reason,
        href: training.href,
        action: 'Review Performance',
      });
  }

  return queue;
};

export const goalDeadlineProducer: ProactiveProducer = ({ goal }) => {
  if (!goal?.targetDate) return [];
  if (goal.targetDate < goal.today || goal.targetDate > shiftDay(goal.today, 3)) return [];
  return [{
    id: 'goal-deadline',
    key: `goal:${goal.id}:${goal.targetDate}`,
    expiresAt: expiresAtEndOfDay(goal.targetDate),
    priority: 90,
    eyebrow: `AHEAD / GOAL · ${goal.targetDate}`,
    title: goal.title,
    detail: goal.nextStep
      ? `Your chosen target is close. Your saved next step: ${goal.nextStep}`
      : 'Your chosen target is close. Review the direction before the date arrives.',
    href: '/app/goals',
    action: 'Review direction',
  }];
};

export const proactiveProducers: ProactiveProducer[] = [
  dailyCommandProducer,
  goalDeadlineProducer,
];

export function buildProactiveQueue(
  context: ProactiveProducerContext,
  handled: Iterable<string> = [],
  producers: ProactiveProducer[] = proactiveProducers,
): ProactiveSignal[] {
  const handledKeys = new Set(handled);
  return producers
    .flatMap((producer) => producer(context))
    .filter((signal) => !handledKeys.has(signal.key))
    .sort((a, b) => b.priority - a.priority || a.expiresAt.localeCompare(b.expiresAt) || a.key.localeCompare(b.key));
}

export function selectProactiveSignal(
  context: ProactiveProducerContext,
  handled: Iterable<string> = [],
): ProactiveSignal | null {
  return buildProactiveQueue(context, handled)[0] ?? null;
}
