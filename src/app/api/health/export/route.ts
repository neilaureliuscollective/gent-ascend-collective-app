import { z } from 'zod';
import { exportHealth, verifyHealthOwner } from '@/domains/health/service';
import { apiError, mutationBody } from '@/domains/intelligence/http';
export async function POST(request: Request) {
  try {
    const input = z
      .object({ request: z.uuid() })
      .strict()
      .parse(await mutationBody(request, 1024));
    await verifyHealthOwner(request);
    const iterator = await exportHealth(input.request),
      encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) controller.close();
          else controller.enqueue(encoder.encode(next.value));
        } catch {
          controller.error(new Error('Private export interrupted. Resume the saved job.'));
        }
      },
      async cancel() {
        await iterator.return(undefined);
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'attachment; filename="aethelios-health-export.json"',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
