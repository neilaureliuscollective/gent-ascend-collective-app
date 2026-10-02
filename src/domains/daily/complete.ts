import 'server-only';
import { z } from 'zod';
import { authorizedPerson } from '@/domains/access/authorize';
import { DailyError } from './service';

export const completeInput = z.object({ day: z.iso.date(), actionId: z.uuid(), version: z.number().int().min(1) }).strict();

export async function completeDailyAction(input: z.infer<typeof completeInput>) {
  const context = await authorizedPerson('daily.write');
  if (!context) throw new DailyError('Sign in to complete an action.', 401);
  const { data, error } = await context.client.rpc('daily_complete_action', {
    p_day: input.day, p_action: input.actionId, p_version: input.version,
  });
  if (error?.code === '40001' || error?.code === '22023')
    throw new DailyError('Your day changed. Reload the saved state before confirming.', 409);
  if (error?.code === '42501') throw new DailyError('That action is no longer available.', 404);
  if (error) throw new DailyError('Completion could not be confirmed. Reload your day before trying again.', 503);
  return { day: input.day, version: data, actionId: input.actionId, done: true as const };
}
