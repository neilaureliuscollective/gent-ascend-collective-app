import { apiError } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { designExportBlob } from '@/domains/studio/design-service';
import { z } from 'zod';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!z.uuid().safeParse(id).success) throw new IntelligenceError('Invalid export.');
    const file = await designExportBlob(id!);
    const name =
      file.format === 'pdf' ? 'studio-design.pdf' : file.format === 'svg' ? 'studio-design.svg' : 'studio-design.png';
    const type =
      file.format === 'pdf' ? 'application/pdf' : file.format === 'svg' ? 'image/svg+xml' : 'image/png';
    return new Response(file.blob.stream(), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${name}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
