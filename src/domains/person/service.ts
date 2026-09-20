import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import type { ProfileInput } from './validation';
import type { FormState } from '@/domains/shared/form-state';
export async function updateProfile(input: ProfileInput): Promise<FormState> {
  const context = await authorizedPerson('profile.write');
  if (!context) return { status: 'error', message: 'Sign in to save your profile.' };
  const { version, ...fields } = input;
  const { data, error } = await context.client
    .from('persons')
    .update(fields)
    .eq('id', context.person.id)
    .eq('version', version)
    .select('version')
    .maybeSingle();
  if (error)
    return {
      status: 'error',
      message:
        'We could not confirm the save. Your entries are still here. Reload to check your saved profile before retrying.',
    };
  if (!data)
    return {
      status: 'conflict',
      message:
        'Your profile changed in another session. Reload the latest version before saving again.',
    };
  return { status: 'saved', message: 'Profile saved.', version: data.version };
}
