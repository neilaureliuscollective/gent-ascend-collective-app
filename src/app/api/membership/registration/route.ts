import { NextRequest, NextResponse } from 'next/server';
import { registerMembership } from '@/domains/identity/registration';
import { registrationConfig } from '@/domains/identity/registration-config';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const config = registrationConfig(process.env);
  if (!config)
    return NextResponse.json({ error: 'Account registration is not open yet.' }, { status: 503 });
  if (request.headers.get('origin') !== config.origin)
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const result = await registerMembership(await request.json().catch(() => null));
    return NextResponse.json(
      result.status === 200 ? { message: result.message } : { error: result.message },
      { status: result.status, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Account registration is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
