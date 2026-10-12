import { z } from 'zod';
import { downloadOriginal } from '@/domains/health/service';
import { apiError } from '@/domains/intelligence/http';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await params).id),
      { record, file } = await downloadOriginal(id);
    return new Response(file, {
      headers: {
        'Content-Type': record.mime,
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'attachment; filename="health-original"',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'",
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
