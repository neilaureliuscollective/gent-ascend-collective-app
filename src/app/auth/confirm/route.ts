import { type NextRequest, NextResponse } from 'next/server';
import { claimReturn } from '@/domains/onboarding/model';
import { serverClient } from '@/platform/supabase/server';

export async function GET(request: NextRequest) {
  const claim = request.nextUrl.searchParams.get('entry') === 'claim';
  const token = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const code = request.nextUrl.searchParams.get('code');
  if (code && code.length <= 2048) {
    const destination = new URL(
      claim ? '/experience/world?claim=1&status=auth' : '/join?status=auth',
      request.url,
    );
    const client = await serverClient();
    if (client) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        const next = new URL(claim ? claimReturn : '/app/membership', request.url);
        destination.pathname = next.pathname;
        destination.search = next.search;
      }
    }
    const response = NextResponse.redirect(destination);
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  const destination = new URL(
    claim ? claimReturn : type === 'email' ? '/join' : '/app/welcome',
    request.url,
  );
  destination.searchParams.set('status', 'auth');
  if (!['invite', 'email'].includes(type ?? '') || !token)
    return NextResponse.redirect(destination);
  const client = await serverClient();
  if (!client) return NextResponse.redirect(destination);
  const { error } = await client.auth.verifyOtp({
    token_hash: token,
    type: type as 'invite' | 'email',
  });
  if (!error) {
    destination.pathname = claim
      ? '/experience/world'
      : type === 'email'
        ? '/app/membership'
        : '/app/welcome';
    destination.searchParams.delete('status');
  }
  const response = NextResponse.redirect(destination);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
