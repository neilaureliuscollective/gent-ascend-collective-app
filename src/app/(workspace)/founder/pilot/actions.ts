'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { reservePilotEmail } from '@/domains/pilot/service';
export async function reservePilotAction(form: FormData) {
  const parsed = z.email().safeParse(form.get('email'));
  if (!parsed.success) redirect('/founder/pilot?status=invalid');
  try { await reservePilotEmail(parsed.data); }
  catch { redirect('/founder/pilot?status=error'); }
  revalidatePath('/founder/pilot');
  redirect('/founder/pilot?status=reserved');
}
