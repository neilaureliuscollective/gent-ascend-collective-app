import { cookies } from 'next/headers';
import { currentFounderAccess } from '@/domains/access/founder';
import { currentIdentity } from '@/domains/identity/current';
import { bridgeCookie, privateOrigin } from '@/domains/intelligence/founder-bridge';

export async function POST(request: Request) {
  if (!(await currentFounderAccess())) return new Response('Founder access required.', { status: 403 });
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return new Response('Invalid origin.', { status: 403 });
  const jar = await cookies();
  const token = jar.get(bridgeCookie)?.value;
  const identity = await currentIdentity();
  if (token && identity) {
    try {
      const response = await fetch(`${privateOrigin}/api/collective/revoke`, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'x-collective-user-id': identity.authUserId },
        cache: 'no-store', signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) return new Response('Could not disconnect. Please try again.', { status: 503 });
    } catch { return new Response('Could not disconnect. Please try again.', { status: 503 }); }
  }
  jar.delete(bridgeCookie);
  return Response.redirect(new URL('/app/aethelios?link=disconnected', request.url), 303);
}
