import { cookies } from 'next/headers';
import { currentFounderAccess } from '@/domains/access/founder';
import { bridgeCookie } from '@/domains/intelligence/founder-bridge';

export async function POST(request: Request) {
  if (!(await currentFounderAccess())) return new Response('Founder access required.', { status: 403 });
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return new Response('Invalid origin.', { status: 403 });
  const jar = await cookies();
  jar.delete(bridgeCookie);
  return Response.redirect(new URL('/app/aethelios?link=disconnected', request.url), 303);
}
