import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { currentFounderAccess } from '@/domains/access/founder';
import { currentIdentity } from '@/domains/identity/current';
import { bridgeCookie, privateOrigin, stateCookie, verifierCookie } from '@/domains/intelligence/founder-bridge';

const success = '/app/aethelios?link=connected';
const failure = '/app/aethelios?link=failed';
export async function GET(request: Request) {
  const jar = await cookies();
  const state = jar.get(stateCookie)?.value;
  const verifier = jar.get(verifierCookie)?.value;
  jar.set(stateCookie, '', { path: '/api/aethelios-link', maxAge: 0 });
  jar.set(verifierCookie, '', { path: '/api/aethelios-link', maxAge: 0 });
  if (!(await currentFounderAccess())) return Response.redirect(new URL(failure, request.url), 303);
  const identity = await currentIdentity();
  const url = new URL(request.url);
  const supplied = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  if (!identity || !state || !verifier || !/^[A-Za-z0-9_-]{43}$/.test(code) ||
    Buffer.byteLength(state) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(supplied)))
    return Response.redirect(new URL(failure, request.url), 303);
  try {
    const response = await fetch(`${privateOrigin}/api/collective/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, verifier, collectiveUserId: identity.authUserId }),
      cache: 'no-store', signal: AbortSignal.timeout(6000),
    });
    const payload: unknown = await response.json();
    if (!response.ok || !payload || typeof payload !== 'object' || !('token' in payload) ||
      typeof payload.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(payload.token))
      return Response.redirect(new URL(failure, request.url), 303);
    jar.set(bridgeCookie, payload.token, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/app', maxAge: 30 * 24 * 60 * 60,
    });
    return Response.redirect(new URL(success, request.url), 303);
  } catch { return Response.redirect(new URL(failure, request.url), 303); }
}
