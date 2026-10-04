import { NextRequest, NextResponse } from 'next/server';
import { BillingError, inspectBillingReadiness } from '@/domains/billing/provider';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  try {
    return NextResponse.json(await inspectBillingReadiness(), { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof BillingError ? error.message : 'Readiness could not be checked.' },
      { status: error instanceof BillingError ? error.status : 503, headers },
    );
  }
}
