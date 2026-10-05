import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { markProactiveReceipt } from '@/domains/intelligence/proactive-receipts';

const inputSchema = z.object({
  signalKey: z.string().trim().min(3).max(240),
  disposition: z.enum(['opened','dismissed']),
  expiresAt: z.iso.datetime({ offset: true }),
}).strict();

export async function POST(request: Request) {
  try {
    const input = inputSchema.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('This Ahead signal is invalid.');
    return privateJson(await markProactiveReceipt(input.data), 201);
  } catch (error) {
    return apiError(error);
  }
}
