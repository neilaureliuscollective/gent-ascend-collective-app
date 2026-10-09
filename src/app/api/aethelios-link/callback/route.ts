import { cookies } from 'next/headers';
import { bridgeCookie, stateCookie, verifierCookie } from '@/domains/intelligence/founder-bridge';
export async function GET() {
  const jar = await cookies();
  jar.set(bridgeCookie, '', { path: '/app', maxAge: 0 });
  for (const name of [stateCookie, verifierCookie])
    jar.set(name, '', { path: '/api/aethelios-link', maxAge: 0 });
  return new Response('Private workspace linking is unavailable in the public platform.', {
    status: 410,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
