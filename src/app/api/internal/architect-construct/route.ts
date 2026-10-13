import { constructWorkerAuthorized, workerTokenMatches } from '@/domains/architect-construct/readiness';

export const runtime = 'nodejs';
export const maxDuration = 30;
const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request) {
  if (!constructWorkerAuthorized() || new URL(request.url).search)
    return Response.json({ error: 'Not found.' }, { status: 404, headers });
  if (!workerTokenMatches(request))
    return Response.json({ error: 'Unauthorized.' }, { status: 401, headers });
  return Response.json(
    {
      error:
        'Construct execution is not available on the Next request path. Use the standalone worker process against the durable queue.',
    },
    { status: 409, headers },
  );
}

export async function GET() {
  return Response.json({ error: 'Not found.' }, { status: 404, headers });
}
