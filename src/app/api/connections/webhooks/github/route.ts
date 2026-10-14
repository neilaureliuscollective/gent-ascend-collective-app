import { NextRequest, NextResponse } from 'next/server';
import {
  applyGithubWebhook,
  githubWebhookConfig,
  verifyGithubSignature,
} from '@/domains/connections/webhooks';
import { webhookStore } from '@/domains/connections/store';
import { ConnectionError } from '@/domains/connections/errors';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 500_000)
    return NextResponse.json({ error: 'Webhook too large.' }, { status: 413 });
  try {
    const config = githubWebhookConfig();
    if (
      !verifyGithubSignature(config.webhookSecret!, raw, request.headers.get('x-hub-signature-256'))
    )
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    const delivery = request.headers.get('x-github-delivery');
    const event = request.headers.get('x-github-event');
    if (!delivery || !event)
      return NextResponse.json({ error: 'Missing delivery headers.' }, { status: 400 });
    let payload: unknown = {};
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }
    await applyGithubWebhook(webhookStore(), event, delivery, payload);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof ConnectionError ? error.message : 'Webhook unavailable.' },
      { status: error instanceof ConnectionError && error.status === 400 ? 400 : 503 },
    );
  }
}
