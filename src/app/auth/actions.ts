'use server';
import { readPilot } from '@/domains/pilot/service';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { serverClient } from '@/platform/supabase/server';
import { supabaseConnection } from '@/platform/supabase/connection';
export async function signIn(form: FormData) {
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1).max(256) })
    .safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) redirect('/app/you?error=invalid');
  const client = await serverClient();
  if (!client) redirect('/app/you?error=unavailable');
  // The project ref is public configuration. Log it without credentials or user details
  // so a hosted project mismatch is diagnosable from a single failed request.
  const project = new URL(supabaseConnection(process.env)!.url).hostname.split('.')[0];
  console.info('Gent Ascend sign-in attempt', { project });
  let failure: 'credentials' | 'service' | null = null;
  try {
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) {
      console.error('Gent Ascend sign-in rejected', { project, code: error.code, status: error.status });
      failure = error.code === 'invalid_credentials' ? 'credentials' : 'service';
    }
  } catch (error) {
    console.error('Gent Ascend sign-in unavailable', {
      project,
      name: error instanceof Error ? error.name : 'unknown',
    });
    failure = 'service';
  }
  if (failure) redirect(`/app/you?error=${failure}`);
  const pilot = await readPilot();
  redirect(pilot?.person.priority && (pilot.beta || pilot.founder) ? '/app' : '/app/welcome');
}
export async function signOut() {
  const client = await serverClient();
  await client?.auth.signOut();
  redirect('/');
}
