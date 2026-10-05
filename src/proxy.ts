import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConnection } from '@/platform/supabase/connection';
export async function proxy(request: NextRequest) {
  // Stripe authenticates its raw event body independently of browser cookies.
  if (request.nextUrl.pathname === '/api/billing/webhook') {
    const response = NextResponse.next({ request });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  const connection = supabaseConnection(process.env);
  let response = NextResponse.next({ request });
  if (connection) {
    const client = createServerClient(connection.url, connection.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data, error } = await client.auth.getClaims();
    // Verified identity only. Refresh cookies on the redirect as on any workspace request.
    if (
      !error &&
      data?.claims.sub &&
      ['/', '/experience', '/enter'].includes(request.nextUrl.pathname)
    ) {
      const destination = new URL('/app', request.url);
      const direct = NextResponse.redirect(destination);
      for (const cookie of response.cookies.getAll()) direct.cookies.set(cookie);
      direct.headers.set('Cache-Control', 'private, no-store');
      return direct;
    }
  }
  response.headers.set('Cache-Control', 'private, no-store');
  if (
    request.nextUrl.pathname === '/app/collection/orders' ||
    request.nextUrl.pathname.startsWith('/api/commerce/customer')
  )
    response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
export const config = {
  matcher: [
    '/',
    '/experience',
    '/experience/world',
    '/experience/grooming',
    '/experience/performance/practice/:path*',
    '/experience/aethelios/:path*',
    '/app/:path*',
    '/enter',
    '/join',
    '/api/:path*',
    '/dev/:path*',
    '/auth/:path*',
  ],
};
