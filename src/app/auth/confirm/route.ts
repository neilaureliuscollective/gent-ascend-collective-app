import { type NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/platform/supabase/server';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const destination = new URL('/app/welcome', request.url);
  destination.searchParams.set('status', 'auth');
  if (type !== 'invite' || !token) return NextResponse.redirect(destination);
  const client = await serverClient();
  if (!client) return NextResponse.redirect(destination);
  const { error } = await client.auth.verifyOtp({ token_hash: token, type: 'invite' });
  if (!error) destination.searchParams.delete('status');
  const response = NextResponse.redirect(destination);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
