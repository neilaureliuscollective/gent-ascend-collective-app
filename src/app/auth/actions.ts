'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { serverClient } from '@/platform/supabase/server';
export async function signIn(form: FormData) {
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1).max(256) })
    .safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) redirect('/you?error=signin');
  const client = await serverClient();
  if (!client) redirect('/you?error=unavailable');
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) redirect('/you?error=signin');
  redirect('/');
}
export async function signOut() {
  const client = await serverClient();
  await client?.auth.signOut();
  redirect('/');
}
