import type { CommandData, DailyCommandDecision } from '@/domains/daily-command/model';

export type ProactiveSignal = {
  id: 'occasion' | 'recovery';
  key: string;
  expiresAt: string;
  priority: number;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  action: string;
};

function decision(snapshot: NonNullable<CommandData['snapshot']>, id: DailyCommandDecision['id']) {
  return snapshot.decisions.find((item) => item.id === id) ?? null;
}

/**
 * Today should interrupt only when context materially changes what the member
 * should prepare for. Ordinary focus, hydration and "you can train" guidance
 * stay inside the briefing/engines rather than becoming another card.
 */
export function buildProactiveQueue(
  command: CommandData | null | undefined,
  handled: Iterable<string> = [],
): ProactiveSignal[] {
  const snapshot = command?.mode === 'personal' ? command.snapshot : null;
  if (!snapshot) return [];
  const handledKeys = new Set(handled);
  const queue: ProactiveSignal[] = [];

  const occasion = decision(snapshot, 'occasion');
  if (occasion && snapshot.supportingContext.occasion) {
    const value = snapshot.supportingContext.occasion;
    const key = `occasion:${value.day}:${value.title.trim().toLowerCase()}`;
    const expiresAt = new Date(`${value.day}T23:59:59.999Z`).toISOString();
    if (!handledKeys.has(key))
      queue.push({
        id: 'occasion',
        key,
        expiresAt,
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
    if (training) {
      const key = `recovery:${snapshot.day}`;
      const expiresAt = new Date(`${snapshot.day}T23:59:59.999Z`).toISOString();
      if (!handledKeys.has(key))
        queue.push({
          id: 'recovery',
          key,
          expiresAt,
          priority: 80,
          eyebrow: 'TODAY / CAPACITY',
          title: 'Adjust the day before you push it.',
          detail: snapshot.reason,
          href: training.href,
          action: 'Review Performance',
        });
    }
  }

  return queue.sort((a, b) => b.priority - a.priority || a.expiresAt.localeCompare(b.expiresAt));
}

export function selectProactiveSignal(
  command: CommandData | null | undefined,
  handled: Iterable<string> = [],
): ProactiveSignal | null {
  return buildProactiveQueue(command, handled)[0] ?? null;
}
