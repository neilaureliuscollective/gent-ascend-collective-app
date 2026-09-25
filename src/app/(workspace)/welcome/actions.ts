'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { claimPilot, submitPilotFeedback } from '@/domains/pilot/service';
import { serverClient } from '@/platform/supabase/server';

export async function claimPilotAction() {
  let status = 'unavailable';
  try { status = await claimPilot() ? 'claimed' : 'unlisted'; }
  catch { status = 'error'; }
  revalidatePath('/welcome');
  redirect(`/welcome?status=${status}`);
}

export async function setPilotPassword(form: FormData) {
  const parsed = z.string().min(12).max(128).safeParse(form.get('password'));
  if (!parsed.success) redirect('/welcome?status=password-invalid');
  const client = await serverClient();
  if (!client || (await client.auth.getUser()).error) redirect('/welcome?status=auth');
  const { error } = await client.auth.updateUser({ password: parsed.data });
  redirect(`/welcome?status=${error ? 'password-error' : 'password-saved'}`);
}

export async function submitFeedbackAction(form: FormData) {
  const parsed = z.object({
    category: z.enum(['friction','idea','working']),
    message: z.string().trim().min(10).max(1500),
  }).safeParse({ category: form.get('category'), message: form.get('message') });
  if (!parsed.success) redirect('/welcome?status=feedback-invalid');
  try { await submitPilotFeedback(parsed.data.category, parsed.data.message); }
  catch { redirect('/welcome?status=feedback-error'); }
  revalidatePath('/founder/pilot');
  redirect('/welcome?status=feedback-saved');
}
