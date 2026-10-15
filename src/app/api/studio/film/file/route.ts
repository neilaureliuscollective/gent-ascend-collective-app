import { apiError } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { renderBlob } from '@/domains/studio/composition-service';
import { z } from 'zod';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    const kind = params.get('kind');
    if (!z.uuid().safeParse(id).success || !['film', 'cover', 'captions'].includes(kind ?? ''))
      throw new IntelligenceError('Invalid film file.');
    const file = await renderBlob(id!, kind as 'film' | 'cover' | 'captions');
    return new Response(file.blob.stream(), {
      headers: {
        'Content-Type': file.type,
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
