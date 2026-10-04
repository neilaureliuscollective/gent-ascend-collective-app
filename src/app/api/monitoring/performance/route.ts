import { performanceEvent } from '@/domains/release/performance';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: Request) {
  if (process.env.GENT_PERFORMANCE_ENABLED !== 'true')
    return Response.json({}, { status: 404, headers });
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({}, { status: 403, headers });
  if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1')
    return Response.json({}, { status: 202, headers });
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({}, { status: 415, headers });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({}, { status: 400, headers });
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 512) {
        await reader.cancel();
        return Response.json({}, { status: 413, headers });
      }
      text += decoder.decode(value, { stream: true });
    }
    const result = performanceEvent.safeParse(JSON.parse(text + decoder.decode()));
    if (!result.success) return Response.json({}, { status: 400, headers });
    const source = process.env.VERCEL_GIT_COMMIT_SHA;
    console.info('gent_performance', {
      ...result.data,
      release: source && /^[a-f0-9]{40}$/i.test(source) ? source : null,
    });
    return Response.json({}, { status: 202, headers });
  } catch {
    return Response.json({}, { status: 400, headers });
  }
}
