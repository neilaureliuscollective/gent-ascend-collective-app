import { NextRequest, NextResponse } from 'next/server';
import { BillingError, handleWebhook } from '@/domains/billing/provider';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  // Verification requires the unparsed request body. This route does not use cookies or CSRF origin checks.
  const raw = await request.text();
  if (raw.length > 1_000_000)
    return NextResponse.json({ error: 'Webhook too large.' }, { status: 413 });
  try {
    await handleWebhook(raw, signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Transient errors must be retried by Stripe, not acknowledged as success.
    return NextResponse.json(
      {
        error:
          error instanceof BillingError && error.status === 400
            ? error.message
            : 'Billing synchronization unavailable.',
      },
      { status: error instanceof BillingError && error.status === 400 ? 400 : 503 },
    );
  }
}
