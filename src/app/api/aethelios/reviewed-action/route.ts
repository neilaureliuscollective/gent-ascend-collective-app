import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import {
  prepareReviewedAction,
  confirmReviewedAction,
} from '@/domains/artifacts/daily-action-service';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = z
      .object({ conversationId: z.uuid(), reviewId: z.uuid() })
      .safeParse({
        conversationId: url.searchParams.get('conversationId'),
        reviewId: url.searchParams.get('reviewId'),
      });
    if (!input.success) throw new IntelligenceError('Invalid review.');
    return privateJson(await prepareReviewedAction(input.data.conversationId, input.data.reviewId));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    return privateJson(await confirmReviewedAction(await mutationBody(request, 2048)));
  } catch (error) {
    return apiError(error);
  }
}
