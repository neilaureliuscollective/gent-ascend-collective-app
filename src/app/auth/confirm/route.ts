import { type NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/platform/supabase/server';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const code = request.nextUrl.searchParams.get('code');
  if (code && code.length <= 2048) {
    const destination = new URL('/join?status=auth', request.url);
    const client = await serverClient();
    if (client) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        destination.pathname = '/app/membership';
        destination.search = '';
      }
    }
    const response = NextResponse.redirect(destination);
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  const destination = new URL(type === 'email' ? '/join' : '/app/welcome', request.url);
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
    destination.pathname = type === 'email' ? '/app/membership' : '/app/welcome';
    destination.searchParams.delete('status');
  }
  const response = NextResponse.redirect(destination);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
