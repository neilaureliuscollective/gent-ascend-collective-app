import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { maxReferenceBytes } from '@/domains/studio/image-validation';
import { completeTalkAttachment, prepareTalkAttachment } from '@/domains/talk-creation/service';

import { selectStudioReference } from '@/domains/studio/reference-selection';

export const runtime = 'nodejs';
const init = z
  .object({
    action: z.literal('prepare'),
    mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    byteSize: z.number().int().min(100).max(maxReferenceBytes),
  })
  .strict();
const handoff = z
  .object({ action: z.literal('studio'), projectId: z.uuid(), id: z.uuid() })
  .strict();
const finish = z
  .object({
    action: z.literal('complete'),
    projectId: z.uuid(),
    id: z.uuid(),
    mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await mutationBody(request);
    const selected = handoff.safeParse(body);
    if (selected.success)
      return privateJson(await selectStudioReference(selected.data.projectId, selected.data.id));
    const preparation = init.safeParse(body);
    const completion = finish.safeParse(body);
    if (preparation.success)
      return privateJson(
        await prepareTalkAttachment(preparation.data.mediaType, preparation.data.byteSize),
      );
    if (completion.success)
      return privateJson(
        await completeTalkAttachment(
          completion.data.projectId,
          completion.data.id,
          completion.data.mediaType,
        ),
      );
    throw new IntelligenceError('Invalid attachment request.');
  } catch (error) {
    return apiError(error);
  }
}
