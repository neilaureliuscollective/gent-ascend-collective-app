import 'server-only';
import { cache } from 'react';
import { authorizedPerson } from '@/domains/access/authorize';
import type { GoalInput, GoalTransition } from './validation';
import type { FormState } from '@/domains/shared/form-state';
export const readGoals = cache(async () => {
  const context = await authorizedPerson('goals.read');
  if (!context) return null;
  const { data, error } = await context.client
    .from('goals')
    .select('*')
    .eq('person_id', context.person.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error('Your goals could not be loaded.');
  return data;
});
const conflict: FormState = {
  status: 'conflict',
  message:
    'This goal changed or was closed in another session. Reload the latest version before continuing.',
};
export async function saveGoal(input: GoalInput): Promise<FormState> {
  const context = await authorizedPerson('goals.write');
  if (!context) return { status: 'error', message: 'Sign in to save your goal.' };
  const { id, version, target_date, ...fields } = input;
  const values = { ...fields, target_date: target_date || null };
  const query =
    version === 0
      ? context.client.from('goals').insert({ ...values, id, person_id: context.person.id })
      : context.client
          .from('goals')
          .update(values)
          .eq('id', id)
          .eq('person_id', context.person.id)
          .eq('version', version)
          .eq('status', 'active');
  const { data, error } = await query.select('version').maybeSingle();
  if (error?.code === '23505')
    return {
      status: 'conflict',
      message: 'An active goal is already saved. Reload to review it before adding another.',
    };
  if (error)
    return {
      status: 'error',
      message:
        'We could not confirm the save. Your entries are still here. Reload to check your saved goal before retrying.',
    };
  if (!data) return conflict;
  return {
    status: 'saved',
    message: version === 0 ? 'Goal created. Your next step is on Command.' : 'Goal updated.',
    version: data.version,
  };
}
export async function transitionGoal(input: GoalTransition): Promise<FormState> {
  const context = await authorizedPerson('goals.write');
  if (!context) return { status: 'error', message: 'Sign in to update your goal.' };
  const { data, error } = await context.client
    .from('goals')
    .update({ status: input.status })
    .eq('id', input.id)
    .eq('person_id', context.person.id)
    .eq('version', input.version)
    .eq('status', 'active')
    .select('version')
    .maybeSingle();
  if (error)
    return {
      status: 'error',
      message: 'We could not confirm this change. Reload your goal before trying again.',
    };
  if (!data) return conflict;
  return {
    status: 'saved',
    message:
      input.status === 'completed'
        ? 'Goal completed. Your progress is saved.'
        : 'Goal archived. It remains in your history.',
    version: data.version,
  };
}
