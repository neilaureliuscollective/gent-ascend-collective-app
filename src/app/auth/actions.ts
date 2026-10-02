'use server';
import { currentAccess } from '@/domains/access/current';
import { readPilot } from '@/domains/pilot/service';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { serverClient } from '@/platform/supabase/server';
import { supabaseConnection } from '@/platform/supabase/connection';
export async function signIn(form: FormData) {
  // Both entrances share this action. The submitted marker only chooses a fixed local error page.
  const errorPath =
    form.get('entry') === 'world'
      ? '/enter'
      : form.get('entry') === 'membership'
        ? '/join'
        : '/app/you';
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1).max(256) })
    .safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) redirect(`${errorPath}?error=invalid`);
  const client = await serverClient();
  if (!client) redirect(`${errorPath}?error=unavailable`);
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
  if (failure) redirect(`${errorPath}?error=${failure}`);
  if (form.get('entry') === 'membership') redirect('/app/membership');
  const pilot = await readPilot();
  if (!pilot?.beta && !pilot?.founder && (await currentAccess()).has('aurelius.context'))
    redirect('/app');
  redirect(pilot?.person.priority && (pilot.beta || pilot.founder) ? '/app' : '/app/welcome');
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
