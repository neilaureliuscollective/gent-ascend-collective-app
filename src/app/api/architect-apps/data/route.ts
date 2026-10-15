import { z } from 'zod';
import { allowlistedAppDataPayload } from '@/domains/architect-apps/allowlist';
import { operateArchitectAppData } from '@/domains/architect-apps/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

const trustedScope = z
  .object({
    projectId: z.uuid(),
    revisionId: z.uuid(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const raw = await mutationBody(request, 16000);
    if (!raw || typeof raw !== 'object') throw new IntelligenceError('Check the host collection request.');
    const body = raw as Record<string, unknown>;
    const trusted = trustedScope.safeParse({
      projectId: body.projectId,
      revisionId: body.revisionId,
    });
    if (!trusted.success) throw new IntelligenceError('Check the host collection request.');
    const input = allowlistedAppDataPayload(body, trusted.data);
    return privateJson(await operateArchitectAppData(input));
  } catch (error) {
    return apiError(error);
  }
}
