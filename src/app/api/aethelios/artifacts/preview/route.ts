import { z } from 'zod';
import { artifactPreview } from '@/domains/artifacts/service';
import { apiError } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export async function GET(request: Request) {
  try {
    const id = z.uuid().safeParse(new URL(request.url).searchParams.get('id'));
    if (!id.success) throw new IntelligenceError('Invalid preview.');
    const blob = await artifactPreview(id.data);
    return new Response(blob.stream(), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
