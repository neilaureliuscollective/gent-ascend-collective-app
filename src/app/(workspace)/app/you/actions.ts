'use server';
import { revalidatePath } from 'next/cache';
import { profileSchema } from '@/domains/person/validation';
import { updateProfile } from '@/domains/person/service';
import { validationErrors, type FormState } from '@/domains/shared/form-state';
export async function saveProfileAction(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse(
    Object.fromEntries(
      ['display_name', 'timezone', 'unit_system', 'priority', 'version'].map((key) => [
        key,
        form.get(key),
      ]),
    ),
  );
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Review the highlighted fields.',
      errors: validationErrors(parsed.error.issues),
    };
  let result: FormState;
  try {
    result = await updateProfile(parsed.data);
  } catch {
    return {
      status: 'error',
      message:
        'We could not confirm the save. Your entries are still here. Reload to check your saved profile before retrying.',
    };
  }
  if (result.status === 'saved') {
    revalidatePath('/app/you');
    revalidatePath('/app');
  }
  return result;
}
