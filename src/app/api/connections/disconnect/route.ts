import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { asIntelligence, disconnectConnection } from '@/domains/connections/service';
import { ConnectionError } from '@/domains/connections/errors';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const input = z
      .object({ provider: z.enum(['github', 'vercel']) })
      .safeParse(await mutationBody(request));
    if (!input.success) throw new ConnectionError('Choose GitHub or Vercel.');
    return privateJson(await disconnectConnection(input.data.provider));
  } catch (error) {
    return apiError(asIntelligence(error));
  }
}
