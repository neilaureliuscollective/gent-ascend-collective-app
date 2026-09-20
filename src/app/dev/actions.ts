'use server';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { requireLocalHarness } from '@/domains/development/guard';
import { currentIdentity } from '@/domains/identity/current';
import {
  founderAuthId,
  founderEmail,
  scenarioSchema,
  signScenario,
  tokenMatches,
} from '@/domains/development/scenario';
import { serverClient } from '@/platform/supabase/server';
export async function enterFounder(form: FormData) {
  const env = await requireLocalHarness(true);
  const supplied = form.get('token');
  if (
    typeof supplied !== 'string' ||
    !env.AURELIUS_DEV_TOKEN ||
    !tokenMatches(supplied, env.AURELIUS_DEV_TOKEN)
  )
    redirect('/dev?error=entry');
  const client = await serverClient();
  if (!client || !env.AURELIUS_FOUNDER_PASSWORD) notFound();
  const { data, error } = await client.auth.signInWithPassword({
    email: founderEmail,
    password: env.AURELIUS_FOUNDER_PASSWORD,
  });
  if (error || data.user?.id !== founderAuthId) redirect('/dev?error=database');
  redirect('/');
}
export async function updateScenario(form: FormData) {
  const env = await requireLocalHarness(true);
  const identity = await currentIdentity();
  if (identity?.authUserId !== founderAuthId || !env.AURELIUS_DEV_TOKEN) notFound();
  const parsed = scenarioSchema.safeParse({
    membership: form.get('membership'),
    billing: form.get('billing'),
    onboarded: form.get('onboarded') === 'on',
  });
  if (!parsed.success) redirect('/dev?error=scenario');
  (await cookies()).set('aurelius-scenario', signScenario(parsed.data, env.AURELIUS_DEV_TOKEN), {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60,
    secure: false,
  });
  redirect('/dev?saved=1');
}
