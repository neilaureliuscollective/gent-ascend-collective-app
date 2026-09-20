export type FormState = {
  status: 'idle' | 'saved' | 'error' | 'conflict';
  message: string;
  errors?: Record<string, string[]>;
  version?: number;
};
export const initialFormState: FormState = { status: 'idle', message: '' };
export type FormAction = (previous: FormState, data: FormData) => Promise<FormState>;
export function validationErrors(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? 'form');
    (result[field] ??= []).push(issue.message);
  }
  return result;
}
