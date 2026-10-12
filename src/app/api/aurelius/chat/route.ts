import { chatInput } from '@/domains/intelligence/validation';
import { prepareReply, IntelligenceError } from '@/domains/intelligence/service';
import { apiError, mutationBody } from '@/domains/intelligence/http';
import { replyStream } from '@/domains/intelligence/stream';
import { generateReply } from '@/domains/intelligence/model';
import { generateCouncilReply } from '@/domains/intelligence/council-model';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const input = chatInput.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Write a message of 1–6,000 characters.');
    const prepared = await prepareReply(input.data);
    return new Response(
      replyStream(
        (signal, onActivity) =>
          prepared.council
            ? generateCouncilReply(
                prepared.model,
                prepared.messages,
                prepared.council,
                signal,
                undefined,
                undefined,
                onActivity,
              )
            : generateReply(
                prepared.model,
                prepared.messages,
                signal,
                prepared.founder,
                undefined,
                onActivity,
              ),
        prepared.finish,
        request.signal,
        { activity: request.headers.get('X-Aethelios-Motion') === '1' },
      ),
      {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
