import { expiryAuthorization, sweepExpiredLive } from '@/domains/live/expiry';
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
