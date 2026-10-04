export type AutonomyLevel = 'auto' | 'inform' | 'approve';
/** Classification only, not execution authority. Unknown work is denied. */
export function autonomyFor(
  action: string,
  authorized: boolean,
): { allowed: boolean; level: AutonomyLevel } {
  if (!authorized) return { allowed: false, level: 'approve' };
  switch (action) {
    case 'assemble_briefing':
      return { allowed: true, level: 'auto' };
    case 'carry_saved_context':
    case 'compare_saved_context':
      return { allowed: true, level: 'inform' };
    case 'create_daily_action':
    case 'adopt_prepared_move':
    case 'confirm_completion':
    case 'change_priority':
    case 'write_memory':
    case 'external_action':
      return { allowed: true, level: 'approve' };
    default:
      return { allowed: false, level: 'approve' };
  }
}
/** Only the server supplies authorization. A classification never grants execution. */
export function commandAuthority(action: string, authorized: boolean, confirmed = false) {
  const policy = autonomyFor(action, authorized);
  return { ...policy, executable: policy.allowed && (policy.level !== 'approve' || confirmed) };
}
