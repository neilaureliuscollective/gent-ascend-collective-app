import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConnection } from '@/platform/supabase/connection';
export async function proxy(request: NextRequest) {
  const connection = supabaseConnection(process.env);
  let response = NextResponse.next({ request });
  if (connection) {
    const client = createServerClient(
      connection.url,
      connection.key,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (values) => {
            values.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            values.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );
    await client.auth.getClaims();
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: [
    '/',
    '/world',
    '/progress',
    '/you',
    '/welcome',
    '/founder/:path*',
    '/goals',
    '/aurelius/:path*',
    '/aethelios/:path*',
    '/api/aurelius/:path*',
    '/dev/:path*',
    '/auth/:path*',
  ],
};
