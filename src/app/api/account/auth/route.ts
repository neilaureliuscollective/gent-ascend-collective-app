import { z } from 'zod';
import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { serverClient } from '@/platform/supabase/server';
import { currentIdentity } from '@/domains/identity/current';
import { accountConfig } from '@/domains/onboarding/config';
import { claimReturn } from '@/domains/onboarding/model';
const input = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('send'),
      email: z.email().max(254),
      captchaToken: z.string().max(4096).default(''),
    })
    .strict(),
  z
    .object({
      action: z.literal('verify'),
      email: z.email().max(254),
      code: z.string().regex(/^\d{6,10}$/),
    })
    .strict(),
  z.object({ action: z.literal('google') }).strict(),
]);
export async function GET() {
  const config = accountConfig(process.env);
  return privateJson({
    authenticated: !!(await currentIdentity()),
    ready: !!config,
    google: config?.google ?? false,
    siteKey: config?.siteKey ?? '',
    captchaRequired: config?.captchaRequired ?? false,
  });
}
export async function POST(request: Request) {
  try {
    const parsed = input.safeParse(await mutationBody(request, 6144));
    if (!parsed.success)
      return privateJson({ error: 'Check your email or verification code.' }, 400);
    const config = accountConfig(process.env);
    if (!config)
      return privateJson(
        { error: 'Free account signup is being prepared. Your draft stays on this device.' },
        503,
      );
    const client = await serverClient();
    if (!client) return privateJson({ error: 'Account access is temporarily unavailable.' }, 503);
    const value = parsed.data;
    if (value.action === 'google') {
      if (!config.google) return privateJson({ error: 'Continue with email instead.' }, 503);
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${config.origin}/auth/confirm?entry=claim`,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url)
        return privateJson({ error: 'Google sign-in could not start. Try email instead.' }, 503);
      return privateJson({ url: data.url });
    }
    if (value.action === 'send') {
      if (config.captchaRequired && !value.captchaToken)
        return privateJson({ error: 'Complete the security check.' }, 400);
      const { error } = await client.auth.signInWithOtp({
        email: value.email,
        options: {
          shouldCreateUser: true,
          captchaToken: value.captchaToken || undefined,
          emailRedirectTo: `${config.origin}/auth/confirm?entry=claim`,
        },
      });
      if (error)
        return privateJson({ error: 'A code could not be sent. Wait a minute and retry.' }, 429);
      return privateJson({ sent: true });
    }
    const { error } = await client.auth.verifyOtp({
      email: value.email,
      token: value.code,
      type: 'email',
    });
    if (error)
      return privateJson(
        { error: 'That code was not accepted. Check it or request a new one.' },
        400,
      );
    return privateJson({ destination: claimReturn });
  } catch (error) {
    return privateJson(
      {
        error:
          error instanceof IntelligenceError
            ? error.message
            : 'Account access is temporarily unavailable. Retry shortly.',
      },
      error instanceof IntelligenceError ? error.status : 503,
    );
  }
}
