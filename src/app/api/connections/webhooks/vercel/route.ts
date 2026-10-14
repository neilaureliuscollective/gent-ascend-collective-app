import { NextRequest, NextResponse } from 'next/server';
import {
  applyVercelWebhook,
  vercelWebhookConfig,
  verifyVercelSignature,
} from '@/domains/connections/webhooks';
import { webhookStore } from '@/domains/connections/store';
import { ConnectionError } from '@/domains/connections/errors';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 500_000)
    return NextResponse.json({ error: 'Webhook too large.' }, { status: 413 });
  try {
    const config = vercelWebhookConfig();
    if (
      !verifyVercelSignature(config.webhookSecret!, raw, request.headers.get('x-vercel-signature'))
    )
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    const delivery =
      request.headers.get('x-vercel-id') ??
      request.headers.get('x-vercel-delivery') ??
      request.headers.get('x-vercel-signature');
    const event = request.headers.get('x-vercel-event') ?? 'vercel';
    if (!delivery)
      return NextResponse.json({ error: 'Missing delivery headers.' }, { status: 400 });
    let payload: unknown = {};
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }
    await applyVercelWebhook(webhookStore(), event, delivery, payload);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof ConnectionError ? error.message : 'Webhook unavailable.' },
      { status: error instanceof ConnectionError && error.status === 400 ? 400 : 503 },
    );
  }
}
