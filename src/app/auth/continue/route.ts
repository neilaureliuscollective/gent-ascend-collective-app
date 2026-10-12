import { NextResponse } from 'next/server';
import { signInDestination } from '@/domains/identity/signin-destination';
export async function GET(request: Request) {
  let destination: string;
  try {
    destination = await signInDestination();
  } catch {
    destination = '/enter?error=service';
  }
  return NextResponse.redirect(new URL(destination, request.url), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
