import type { CommandData, DailyCommandDecision } from '@/domains/daily-command/model';

export type ProactiveSignal = {
  id: 'occasion' | 'recovery';
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
export function selectProactiveSignal(command: CommandData | null | undefined): ProactiveSignal | null {
  const snapshot = command?.mode === 'personal' ? command.snapshot : null;
  if (!snapshot) return null;

  const occasion = decision(snapshot, 'occasion');
  if (occasion && snapshot.supportingContext.occasion) {
    return {
      id: 'occasion',
      eyebrow: `AHEAD / ${snapshot.supportingContext.occasion.day}`,
      title: snapshot.supportingContext.occasion.title,
      detail: 'An important saved moment is approaching. Prepare once, then get back to your life.',
      href: '/app/aethelios?starter=presence',
      action: 'Prepare with Aethelios',
    };
  }

  if (snapshot.state === 'RECOVER') {
    const training = decision(snapshot, 'training');
    if (training) {
      return {
        id: 'recovery',
        eyebrow: 'TODAY / CAPACITY',
        title: 'Adjust the day before you push it.',
        detail: snapshot.reason,
        href: training.href,
        action: 'Review Performance',
      };
    }
  }

  return null;
}
