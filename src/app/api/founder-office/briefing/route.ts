import { portfolioRequest, portfolioBriefing } from '@/domains/founder-office/briefing';
import { mutationBody, apiError } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const input = portfolioRequest.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Write a portfolio request.');
    return new Response(await portfolioBriefing(input.data, request.signal), {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
