'use server';
import { currentAccess } from '@/domains/access/current';
import { readPilot } from '@/domains/pilot/service';
import { currentPerson } from '@/domains/person/current';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { serverClient } from '@/platform/supabase/server';
import { supabaseConnection } from '@/platform/supabase/connection';
export async function signIn(form: FormData) {
  // Both entrances share this action. The submitted marker only chooses a fixed local error page.
  const errorPath =
    form.get('entry') === 'world'
      ? form.get('claim') === '1'
        ? '/enter?entry=claim'
        : '/enter'
      : form.get('entry') === 'membership'
        ? '/join'
        : '/app/you';
  const failed = (reason: string) =>
    `${errorPath}${errorPath.includes('?') ? '&' : '?'}error=${reason}`;
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1).max(256) })
    .safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) redirect(failed('invalid'));
  const client = await serverClient();
  if (!client) redirect(failed('unavailable'));
  // The project ref is public configuration. Log it without credentials or user details
  // so a hosted project mismatch is diagnosable from a single failed request.
  const project = new URL(supabaseConnection(process.env)!.url).hostname.split('.')[0];
  console.info('Gent Ascend sign-in attempt', { project });
  let failure: 'credentials' | 'service' | null = null;
  try {
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) {
      console.error('Gent Ascend sign-in rejected', {
        project,
        code: error.code,
        status: error.status,
      });
      failure = error.code === 'invalid_credentials' ? 'credentials' : 'service';
    }
  } catch (error) {
    console.error('Gent Ascend sign-in unavailable', {
      project,
      name: error instanceof Error ? error.name : 'unknown',
    });
    failure = 'service';
  }
  if (failure) redirect(failed(failure));
  if (form.get('claim') === '1') redirect('/experience/world?claim=1');
  if (form.get('entry') === 'membership') redirect('/app/membership');
  const [pilot, person] = await Promise.all([readPilot(), currentPerson()]);
  if (pilot?.beta || pilot?.founder || person?.onboarding_completed || person?.priority)
    redirect('/app');
  if ((await currentAccess()).has('aurelius.context')) redirect('/app');
  redirect('/app/welcome');
}
export async function signOut() {
  (await cookies()).set('performance-reset', '1', {
    path: '/',
    sameSite: 'strict',
    httpOnly: false,
  });
  const client = await serverClient();
  await client?.auth.signOut();
  redirect('/');
}
