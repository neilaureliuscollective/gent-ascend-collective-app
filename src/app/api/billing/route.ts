import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { foundingTiers } from '@/domains/billing/founding-catalog';
import {
  BillingError,
  startCheckout,
  openPortal,
  refreshBilling,
} from '@/domains/billing/provider';
import { billingConfig } from '@/domains/billing/config';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const input = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('checkout'),
      tier: z.enum(foundingTiers),
      consent: z.literal(true),
      termsVersion: z.string().min(1).max(100),
    })
    .strict(),
  z.object({ action: z.literal('portal') }).strict(),
  z.object({ action: z.literal('refresh') }).strict(),
]);
export async function POST(request: NextRequest) {
  const config = billingConfig(process.env);
  const origin = request.headers.get('origin');
  if (!origin || origin !== (config?.origin ?? new URL(request.url).origin))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid membership request.' }, { status: 400, headers });
  try {
    const command = parsed.data;
    if (command.action === 'refresh') {
      await refreshBilling();
      return NextResponse.json({ refreshed: true }, { headers });
    }
    const url =
      command.action === 'checkout'
        ? await startCheckout(command.tier, command.termsVersion)
        : await openPortal();
    return NextResponse.json({ url }, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BillingError
            ? error.message
            : 'Billing could not be reached. Please retry shortly.',
      },
      { status: error instanceof BillingError ? error.status : 502, headers },
    );
  }
}
