import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { buildCommand } from '@/domains/technology/build-schema';
import { listBuilds, mutateBuild, exportBuild } from '@/domains/technology/build-service';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      id = url.searchParams.get('export');
    if (!id) return privateJson({ builds: await listBuilds() });
    if (!z.uuid().safeParse(id).success) throw new IntelligenceError('Invalid build.');
    const b = await exportBuild(id);
    return new Response(b.html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="aethelios-site-${id}.html"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Artifact-SHA256': b.hash,
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const b = buildCommand.safeParse(await mutationBody(request));
    if (!b.success) throw new IntelligenceError('Invalid build request.');
    return privateJson(await mutateBuild(b.data));
  } catch (e) {
    return apiError(e);
  }
}
