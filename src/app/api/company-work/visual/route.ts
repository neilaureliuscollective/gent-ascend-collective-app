import { z } from 'zod';
import { workVisualInput, createWorkVisual, workVisualBlob } from '@/domains/company-work/studio';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const input = workVisualInput.safeParse(await mutationBody(request));
    if (!input.success)
      throw new IntelligenceError('Review the visual request and approve generation.');
    return privateJson(await createWorkVisual(input.data), 201);
  } catch (error) {
    return apiError(error);
  }
}
export async function GET(request: Request) {
  try {
    const input = z
      .object({ companyId: z.uuid(), jobId: z.uuid(), assetId: z.uuid() })
      .strict()
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!input.success) throw new IntelligenceError('Choose a saved company visual.');
    const { companyId, jobId, assetId } = input.data;
    const blob = await workVisualBlob(companyId, jobId, assetId);
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
