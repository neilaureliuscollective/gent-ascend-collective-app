import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { DailyError } from '@/domains/daily/service';
import { claimInput, claimReceipt, validDraft } from './model';
export async function claimDirection(value: unknown) {
  const parsed = claimInput.safeParse(value);
  if (!parsed.success || !validDraft(parsed.data.draft))
    throw new DailyError('Your draft expired or is invalid. Choose a fresh direction.', 400);
  const context = await authorizedPerson('daily.write');
  if (!context) throw new DailyError('Sign in to keep your direction.', 401);
  const { draft, replace, expectedVersion, day } = parsed.data;
  const { data, error } = await context.client.rpc('onboarding_claim', {
    p_request: draft.id,
    p_focus: draft.focus,
    p_intention: draft.intention,
    p_timezone: draft.timezone,
    p_created: new Date(draft.createdAt).toISOString(),
    p_replace: replace,
    p_expected: expectedVersion,
    p_day: day ?? null,
  });
  if (error)
    throw new DailyError(
      'Your direction could not be saved. Your draft is still here; retry.',
      503,
    );
  return claimReceipt.parse(data);
}

export async function savedWorld() {
  const { currentIdentity } = await import('@/domains/identity/current');
  const identity = await currentIdentity();
  if (!identity) return null;
  const { data, error } = await identity.client
    .from('onboarding_claims')
    .select('focus')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const { focuses } = await import('./model');
  return focuses[data.focus].world;
}
