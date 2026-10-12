import { expiryAuthorization, sweepExpiredLive } from '@/domains/live/expiry';
import { inspectProviderMetadata } from '@/domains/live/preflight-service';
import { parseEnvironment } from '@/platform/environment';
import { previewBinding } from '@/domains/live/preview-binding';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  if (process.env.AETHELIOS_LIVE_EXPIRY_ENABLED !== 'true')
    return Response.json({ error: 'Not found.' }, { status: 404, headers });
  if (!expiryAuthorization(request))
    return Response.json({ error: 'Unauthorized.' }, { status: 401, headers });
  // This route never accepts IDs, commands, provider URLs or model-generated input.
  if (new URL(request.url).search)
    return Response.json({ error: 'Invalid request.' }, { status: 400, headers });
  try {
    const result = await sweepExpiredLive();
    return Response.json(result, { status: result.pending ? 503 : 200, headers });
  } catch {
    return Response.json({ error: 'Expiry cleanup unavailable.' }, { status: 503, headers });
  }
}

/** Operator metadata probe only: no caller-selected model, identity, call or commands. */
export async function POST(request: Request) {
  if (process.env.AETHELIOS_LIVE_EXPIRY_ENABLED !== 'true')
    return Response.json({ error: 'Not found.' }, { status: 404, headers });
  if (!expiryAuthorization(request))
    return Response.json({ error: 'Unauthorized.' }, { status: 401, headers });
  if (new URL(request.url).search)
    return Response.json({ error: 'Invalid request.' }, { status: 400, headers });
  // Reject any body without buffering attacker-controlled content.
  if (request.body) {
    const reader = request.body.getReader();
    const first = await reader.read();
    if (!first.done) {
      await reader.cancel();
      return Response.json({ error: 'Invalid request.' }, { status: 400, headers });
    }
  }
  try {
    if (
      parseEnvironment(process.env).mode !== 'preview' ||
      previewBinding(process.env) !== 'configuration-matched'
    )
      return Response.json(
        { error: 'Preview configuration unavailable.' },
        { status: 403, headers },
      );
    const provider = await inspectProviderMetadata(process.env);
    return Response.json(
      { provider, callAcceptance: 'unverified' },
      {
        status: provider.status === 'metadata-accessible' ? 200 : 503,
        headers,
      },
    );
  } catch {
    return Response.json({ error: 'Provider metadata unavailable.' }, { status: 503, headers });
  }
}
