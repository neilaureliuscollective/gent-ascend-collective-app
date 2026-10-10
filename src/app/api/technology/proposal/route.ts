import { z } from 'zod';
import { readWebsiteProposal } from '@/domains/technology/proposal';
import { apiError } from '@/domains/intelligence/http';
export async function GET(request: Request) {
  try {
    const query = z
      .object({ mission: z.uuid(), turn: z.uuid() })
      .strict()
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json(await readWebsiteProposal(query.mission, query.turn), {
      headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    return apiError(error);
  }
}
