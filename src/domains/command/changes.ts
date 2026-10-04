import type { DailyData } from '@/domains/daily/model';
/** Compare mounted snapshots only. No browser storage, history claims or raw-text logging. */
export function commandChanges(previous: DailyData, current: DailyData): string[] {
  if (
    previous.mode !== 'personal' ||
    current.mode !== 'personal' ||
    previous.ownerId !== current.ownerId
  )
    return [];
  if (previous.today !== current.today) return ['A new local day is ready.'];
  const changes: string[] = [];
  const before = previous.entries.find((entry) => entry.day === previous.today);
  const after = current.entries.find((entry) => entry.day === current.today);
  if (JSON.stringify(before?.actions ?? []) !== JSON.stringify(after?.actions ?? []))
    changes.push('Your saved plan changed.');
  if (before?.intention !== after?.intention && (before?.intention || after?.intention))
    changes.push('Your saved intention changed.');
  if (
    (before?.energy ?? null) !== (after?.energy ?? null) ||
    (before?.sleep_minutes ?? null) !== (after?.sleep_minutes ?? null)
  )
    changes.push('Your saved observations changed.');
  if (
    JSON.stringify(previous.goal) !== JSON.stringify(current.goal) ||
    previous.profileDirection !== current.profileDirection
  )
    changes.push('Your saved direction changed.');
  if (
    JSON.stringify(previous.carryForward) !== JSON.stringify(current.carryForward) ||
    JSON.stringify(before?.review ?? null) !== JSON.stringify(after?.review ?? null)
  )
    changes.push('Your confirmed review context changed.');
  if (
    previous.decisionsAvailable !== false &&
    current.decisionsAvailable !== false &&
    JSON.stringify(previous.pendingDecisions ?? []) !==
      JSON.stringify(current.pendingDecisions ?? [])
  )
    changes.push('Your saved decisions changed.');
  if ((previous.openCaptures ?? 0) !== (current.openCaptures ?? 0))
    changes.push('Your capture inbox count changed.');
  return changes;
}
