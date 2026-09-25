import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { currentFounderAccess } from '@/domains/access/founder';
import { privateOrigin, stateCookie, verifierCookie } from '@/domains/intelligence/founder-bridge';

export async function GET() {
  if (!(await currentFounderAccess())) return new Response('Founder access required.', { status: 403 });
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const jar = await cookies();
  for (const [name, value] of [[stateCookie, state], [verifierCookie, verifier]] as [string, string][])
    jar.set(name, value, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/aethelios-link', maxAge: 300 });
  const destination = new URL('/api/collective/authorize', privateOrigin);
  destination.searchParams.set('state', state);
  destination.searchParams.set('challenge', createHash('sha256').update(verifier).digest('base64url'));
  return Response.redirect(destination, 303);
}
