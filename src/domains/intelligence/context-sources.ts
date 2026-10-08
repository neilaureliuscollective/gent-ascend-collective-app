import { z } from 'zod';
import type { PersonalContext } from './types';
export const contextSourceLabels = {
  profile: 'Profile and confirmed preferences',
  goals: 'Active goal',
  memory: 'Confirmed memories',
  daily: 'Daily actions and reflections',
  lifestyle: 'Presence and training summaries',
} as const;
export const contextSourcesSchema = z
  .object({
    profile: z.boolean(),
    goals: z.boolean(),
    memory: z.boolean(),
    daily: z.boolean(),
    lifestyle: z.boolean(),
  })
  .strict();
export type ContextSources = z.infer<typeof contextSourcesSchema>;
export const noContextSources: ContextSources = {
  profile: false,
  goals: false,
  memory: false,
  daily: false,
  lifestyle: false,
};
/** Older clients must choose sources again rather than implicitly share everything. */
export function effectiveSources(included: boolean, sources?: ContextSources): ContextSources {
  return included && sources ? sources : noContextSources;
}
export function selectedContext(
  context: PersonalContext,
  sources: ContextSources,
): PersonalContext {
  return {
    profile: sources.profile
      ? context.profile
      : { name: '', priority: '', timezone: '', units: '', updatedAt: '' },
    goal: sources.goals ? context.goal : null,
    memories: sources.memory ? context.memories : [],
    ...(sources.profile ? { ascendProfile: context.ascendProfile } : {}),
    ...(sources.daily
      ? {
          daily: context.daily,
          dailyBrief: context.dailyBrief
            ? {
                ...context.dailyBrief,
                nextMove: sources.goals ? context.dailyBrief.nextMove : undefined,
              }
            : undefined,
        }
      : {}),
    ...(sources.lifestyle ? { grooming: context.grooming } : {}),
    ...(sources.daily && sources.lifestyle && sources.goals
      ? { continuity: context.continuity }
      : {}),
  };
}
