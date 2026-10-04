import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { funnelEvent } from '@/domains/onboarding/events';
// Bounded structured logs: no text, emails, IPs, tokens, or private activity payloads.
// Logs are a lightweight initial sink, not durable analytics or trusted activation proof.
export async function POST(request: Request) {
  try {
    const event = funnelEvent.safeParse(await mutationBody(request, 512));
    if (!event.success) return privateJson({}, 400);
    console.info('gent_account_funnel', event.data);
    return privateJson({}, 202);
  } catch {
    return privateJson({}, 400);
  }
}
