import 'server-only';
import { z } from 'zod';
import { serverClient } from '@/platform/supabase/server';
import { registrationConfig } from './registration-config';

export const registrationInput = z
  .object({
    email: z.email().max(254),
    password: z.string().min(12).max(128),
    captchaToken: z.string().max(4096).default(''),
  })
  .strict();
export async function registerMembership(input: unknown) {
  const config = registrationConfig(process.env);
  if (!config) return { status: 503, message: 'Account registration is not open yet.' };
  const parsed = registrationInput.safeParse(input);
  if (!parsed.success)
    return { status: 400, message: 'Enter a valid email and a password of 12–128 characters.' };
  if (config.captchaRequired && !parsed.data.captchaToken)
    return { status: 400, message: 'Complete the security check before registering.' };
  const client = await serverClient();
  if (!client) return { status: 503, message: 'Account registration is temporarily unavailable.' };
  const { data, error } = await client.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${config.origin}/auth/confirm`,
      captchaToken: parsed.data.captchaToken || undefined,
    },
  });
  if (error)
    return {
      status: 503,
      message:
        'Registration could not be completed. Please retry shortly or sign in if you already have an account.',
    };
  // Registration never grants beta/founder/paid access. Confirm-email must be enabled in Auth.
  if (data.session) await client.auth.signOut({ scope: 'local' });
  return {
    status: 200,
    message:
      'Check your email to confirm your account. If you already have an account, sign in with your existing password.',
  };
}
