import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { releaseCommand } from '@/domains/technology/release-schema';
import { downloadRelease, mutateRelease, readReleases } from '@/domains/technology/releases';
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const id = query.get('download') || query.get('build');
    if (!z.uuid().safeParse(id).success) throw new IntelligenceError('Choose a website release.');
    if (!query.has('download')) return privateJson({ releases: await readReleases(id!) });
    const packet = await downloadRelease(id!);
    return new Response(Buffer.from(packet.bytes), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="aethelios-website-release.zip"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Release-Sha256': packet.sha256,
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const command = releaseCommand.safeParse(await mutationBody(request, 2048));
    if (!command.success) throw new IntelligenceError('Review the release request.');
    return privateJson(await mutateRelease(command.data));
  } catch (e) {
    return apiError(e);
  }
}
