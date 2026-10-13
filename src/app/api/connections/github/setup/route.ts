import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { continueGithubSetup } from '@/domains/connections/service';
import { flowCookieName } from '@/domains/connections/config';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const target = new URL('/app/founder/connections', origin);
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  try {
    const params = request.nextUrl.searchParams;
    const cookie =
      (await cookies()).get(flowCookieName(origin.startsWith('https:')))?.value ??
      (await cookies()).get(flowCookieName(false))?.value ??
      null;
    const state = params.get('state') ?? cookie;
    const continued = await continueGithubSetup(state, params.get('installation_id'));
    const next = NextResponse.redirect(continued.location, 303);
    next.headers.set('Cache-Control', 'private, no-store');
    next.headers.set('Referrer-Policy', 'no-referrer');
    next.cookies.set(continued.cookie.name, state ?? '', continued.cookie.options);
    return next;
  } catch {
    target.searchParams.set('github', 'failed');
    response.headers.set('Location', target.toString());
    return response;
  }
}
