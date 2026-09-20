'use server';
import { revalidatePath } from 'next/cache';
import { goalMutationSchema, goalTransitionSchema } from '@/domains/goals/validation';
import { saveGoal, transitionGoal } from '@/domains/goals/service';
import { validationErrors, type FormState } from '@/domains/shared/form-state';
function refreshGoalViews() {
  for (const path of ['/goals', '/', '/world', '/progress']) revalidatePath(path);
}
export async function saveGoalAction(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = goalMutationSchema.safeParse(
    Object.fromEntries(
      ['id', 'version', 'title', 'domain', 'reason', 'next_step', 'target_date'].map((key) => [
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
    result = await saveGoal(parsed.data);
  } catch {
    return {
      status: 'error',
      message: 'We could not confirm the save. Reload to check your goal before retrying.',
    };
  }
  if (result.status === 'saved') refreshGoalViews();
  return result;
}
export async function transitionGoalAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = goalTransitionSchema.safeParse(
    Object.fromEntries(['id', 'version', 'status'].map((key) => [key, form.get(key)])),
  );
  if (!parsed.success)
    return { status: 'error', message: 'This request could not be verified. Reload your goal.' };
  let result: FormState;
  try {
    result = await transitionGoal(parsed.data);
  } catch {
    return {
      status: 'error',
      message: 'We could not confirm this change. Reload your goal before retrying.',
    };
  }
  if (result.status === 'saved') refreshGoalViews();
  return result;
}
