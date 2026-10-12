import { z } from 'zod';
import { apiError } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { narrationBlob } from '@/domains/studio/narration-service';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const id = z.uuid().safeParse(new URL(request.url).searchParams.get('id'));
    if (!id.success) throw new IntelligenceError('Choose a saved narration.');
    const blob = await narrationBlob(id.data);
    return new Response(blob.stream(), {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline; filename="studio-narration.wav"',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
