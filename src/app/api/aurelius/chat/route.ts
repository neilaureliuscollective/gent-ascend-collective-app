import { chatInput } from '@/domains/intelligence/validation';
import { prepareReply, IntelligenceError } from '@/domains/intelligence/service';
import { apiError, mutationBody } from '@/domains/intelligence/http';
import { replyStream } from '@/domains/intelligence/stream';
import { generateReply } from '@/domains/intelligence/model';
import { generateCouncilReply } from '@/domains/intelligence/council-model';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  const started = performance.now();
  let previous = started;
  const timings: string[] = [];
  const measured = (stage: string) => {
    const now = performance.now();
    if (process.env.NODE_ENV === 'development')
      timings.push(`${stage};dur=${(now - previous).toFixed(1)}`);
    previous = now;
  };
  try {
    const input = chatInput.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Write a message of 1–6,000 characters.');
    const prepared = await prepareReply(input.data, measured);
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
                prepared.creation,
              ),
        prepared.finish,
        request.signal,
        {
          activity: request.headers.get('X-Aethelios-Motion') === '1',
          diagnostics:
            process.env.NODE_ENV === 'development' &&
            request.headers.get('X-Aethelios-Diagnostics') === '1',
        },
      ),
      {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          ...(process.env.NODE_ENV === 'development'
            ? {
                'Server-Timing': [
                  ...timings,
                  `prepare;dur=${(performance.now() - started).toFixed(1)}`,
                ].join(', '),
              }
            : {}),
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
