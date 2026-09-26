'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { reservePilotEmail } from '@/domains/pilot/service';
export async function reservePilotAction(form: FormData) {
  const parsed = z.email().safeParse(form.get('email'));
  if (!parsed.success) redirect('/app/founder/pilot?status=invalid');
  try { await reservePilotEmail(parsed.data); }
  catch { redirect('/app/founder/pilot?status=error'); }
  revalidatePath('/app/founder/pilot');
  redirect('/app/founder/pilot?status=reserved');
}
