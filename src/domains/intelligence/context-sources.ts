import type { PersonalContext } from './types';
export const contextSourceLabels = {
  profile: 'Profile and confirmed preferences',
  goals: 'Active goal',
  memory: 'Confirmed memories',
  daily: 'Daily actions and reflections',
  lifestyle: 'Presence records (training summaries with Daily)',
} as const;
export type ContextSources = Record<keyof typeof contextSourceLabels, boolean>;
export const noContextSources: ContextSources = { profile: false, goals: false, memory: false, daily: false, lifestyle: false };
export const legacyContextSources: ContextSources = { profile: true, goals: true, memory: true, daily: true, lifestyle: true };
/** Consent controls saved sources. Existing conversation text remains in scope. */
export function selectedContext(context: PersonalContext, sources: ContextSources): PersonalContext {
  return {
    profile: sources.profile ? context.profile : { name: '', priority: '', timezone: '', units: '', updatedAt: '' },
    goal: sources.goals ? context.goal : null,
    memories: sources.memory ? context.memories : [],
    ...(sources.profile ? { ascendProfile: context.ascendProfile } : {}),
    ...(sources.daily ? { daily: context.daily, dailyBrief: context.dailyBrief } : {}),
    ...(sources.lifestyle ? { grooming: context.grooming } : {}),
    ...(sources.daily && sources.lifestyle ? { continuity: context.continuity ? { ...context.continuity, nextAction: sources.goals ? context.continuity.nextAction : null } : context.continuity } : {}),
  };
}
