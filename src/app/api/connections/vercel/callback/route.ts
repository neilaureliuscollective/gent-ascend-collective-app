import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { finishVercelCallback } from '@/domains/connections/service';
import { flowCookieName } from '@/domains/connections/config';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const target = new URL('/app/founder/connections', origin);
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  try {
    if (request.nextUrl.searchParams.getAll('state').length !== 1)
      throw new Error('Invalid callback');
    const jar = await cookies();
    const cookieState =
      jar.get(flowCookieName(origin.startsWith('https:')))?.value ??
      jar.get(flowCookieName(false))?.value ??
      null;
    const result = await finishVercelCallback({
      state: request.nextUrl.searchParams.get('state'),
      code: request.nextUrl.searchParams.get('code'),
      configurationId: request.nextUrl.searchParams.get('configurationId'),
      teamId: request.nextUrl.searchParams.get('teamId'),
      cookieState,
    });
    target.searchParams.set(
      'vercel',
      result.connection.status === 'connected' ? 'connected' : 'select',
    );
    response.cookies.set(flowCookieName(origin.startsWith('https:')), '', {
      httpOnly: true,
      secure: origin.startsWith('https:'),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    response.headers.set('Location', target.toString());
    return response;
  } catch {
    target.searchParams.set('vercel', 'failed');
    response.headers.set('Location', target.toString());
    return response;
  }
}
