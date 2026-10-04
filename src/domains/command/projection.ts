import { daysEnding, emptyDay, type DailyData } from '@/domains/daily/model';
import { resolveNextMove } from './next-move';
export type CommandSignal = {
  id: string;
  label: string;
  value: string;
  source: string;
  detail: string;
  href: string | null;
  kind: 'direction' | 'actions' | 'energy' | 'continuity';
};
/** A deterministic view of saved records. Connections express briefing membership, never causality. */
export function projectCommand(data: DailyData) {
  const day =
    data.entries.find((entry) => entry.day === data.today) ?? emptyDay(data.today, data.timezone);
  const move = resolveNextMove({
    day: data.today,
    actions: day.actions,
    reviewed: !!day.review,
    previousReview: data.carryForward
      ? { day: data.carryForward.day, tomorrow: data.carryForward.tomorrow }
      : null,
    goalStep: data.goal?.next_step ?? null,
  });
  const completed = day.actions.filter((action) => action.done).length;
  const receipts: { id: string; title: string; detail: string; source: string }[] = [];
  if (day.actions.length)
    receipts.push({
      id: 'plan',
      title: 'Plan organized',
      detail: `${completed} of ${day.actions.length} saved actions complete. Your order is preserved.`,
      source: data.today,
    });
  if (data.carryForward)
    receipts.push({
      id: 'carry',
      title: 'Context carried forward',
      detail:
        data.carryForward.tomorrow ||
        data.carryForward.reflection ||
        `${data.carryForward.unfinished.length} unfinished actions retained in their original day.`,
      source: data.carryForward.day,
    });
  if (move.kind === 'review' || move.kind === 'goal')
    receipts.push({
      id: 'move',
      title: 'Next move prepared',
      detail:
        move.title.length <= 100
          ? 'Ready for your confirmation. Nothing has been added to your plan.'
          : 'Full saved text retained. Choose a shorter action in the day workspace when useful.',
      source: move.source,
    });
  if (data.goal || data.profileDirection)
    receipts.push({
      id: 'direction',
      title: 'Direction brought forward',
      detail: data.goal?.title || data.profileDirection!,
      source: data.goal ? 'Your active goal' : 'Your Ascend Profile',
    });
  const signals: CommandSignal[] = [];
  if (data.profileDirection || data.goal)
    signals.push({
      id: 'direction',
      kind: 'direction',
      label: 'Direction',
      value: data.goal ? '01' : 'Saved',
      source: data.goal ? 'Your active goal' : 'Your Ascend Profile',
      detail: data.goal?.title || data.profileDirection!,
      href: data.goal ? '/app/goals' : '/app/ascend-profile',
    });
  if (day.actions.length)
    signals.push({
      id: 'actions',
      kind: 'actions',
      label: 'Follow-through',
      value: `${day.actions.filter((a) => a.done).length}/${day.actions.length}`,
      source: `Your daily record · ${data.today}`,
      detail: day.actions.map((a) => `${a.done ? 'Complete' : 'Open'} · ${a.title}`).join('\n'),
      href: null,
    });
  if (day.energy != null)
    signals.push({
      id: 'energy',
      kind: 'energy',
      label: 'Energy',
      value: `${day.energy}/5`,
      source: `Self-reported · ${data.today}`,
      detail: `Energy entered by you: ${day.energy} of 5.${day.sleep_minutes == null ? '' : ` Sleep entered by you: ${Math.floor(day.sleep_minutes / 60)}h ${day.sleep_minutes % 60}m.`} These observations are not a readiness score or an AI assessment.`,
      href: null,
    });
  if (data.carryForward)
    signals.push({
      id: 'continuity',
      kind: 'continuity',
      label: 'Carried forward',
      value: 'Saved',
      source: `Your saved record · ${data.carryForward.day}`,
      detail: [
        data.carryForward.tomorrow && `Tomorrow: ${data.carryForward.tomorrow}`,
        data.carryForward.reflection && `Reflection: ${data.carryForward.reflection}`,
        data.carryForward.blocker && `Friction: ${data.carryForward.blocker}`,
        ...data.carryForward.unfinished.map((title) => `Unfinished: ${title}`),
      ]
        .filter(Boolean)
        .join('\n'),
      href: null,
    });
  else if (data.conversation)
    signals.push({
      id: 'continuity',
      kind: 'continuity',
      label: 'Conversation',
      value: 'Resume',
      source: 'Your latest saved conversation',
      detail: data.conversation.title,
      href: `/app/aethelios?conversation=${data.conversation.id}`,
    });
  const trajectory = daysEnding(data.today, 7).map((date) => ({
    day: date,
    energy: data.entries.find((e) => e.day === date)?.energy ?? null,
  }));
  return {
    day,
    move,
    signals,
    trajectory,
    receipts,
    canAdopt: (move.kind === 'review' || move.kind === 'goal') && move.title.length <= 100,
    briefing:
      (day.actions.length
        ? `${completed} of ${day.actions.length} planned actions complete.${completed === day.actions.length ? ' Your saved plan is complete.' : ' One next move is ready below.'}`
        : '') ||
      (day.review ? 'Your confirmed review is saved. Nothing else is required here.' : '') ||
      day.intention ||
      data.profileDirection ||
      data.goal?.title ||
      'Your space is ready. Bring what matters; the rest can wait.',
    briefingSource: day.actions.length
      ? `Your saved plan · ${data.today}`
      : day.review
        ? `Your confirmed review · ${data.today}`
        : day.intention
          ? 'Your intention'
          : data.profileDirection
            ? 'Your saved direction'
            : data.goal
              ? 'Your active goal'
              : 'A quiet starting point',
    decisions: data.pendingDecisions ?? [],
    decisionsAvailable: data.mode !== 'personal' || data.decisionsAvailable !== false,
  };
}
export type CommandProjection = ReturnType<typeof projectCommand>;
