import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { footageBrief } from '@/domains/studio/footage';
import {
  footageWorkspace,
  quoteFootage,
  startFootage,
  checkFootage,
} from '@/domains/studio/footage-service';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function GET(request: Request) {
  try {
    const project = z.uuid().parse(new URL(request.url).searchParams.get('project'));
    return privateJson(await footageWorkspace(project));
  } catch (error) {
    return apiError(error);
  }
}
const action = z.discriminatedUnion('action', [
  footageBrief.extend({ action: z.literal('quote') }).strict(),
  z
    .object({
      action: z.literal('start'),
      id: z.uuid(),
      projectId: z.uuid(),
      approved: z.literal(true),
      estimate: z.union([z.literal(60), z.literal(120)]),
    })
    .strict(),
  z.object({ action: z.literal('check'), id: z.uuid(), projectId: z.uuid() }).strict(),
]);
export async function POST(request: Request) {
  try {
    const result = action.safeParse(await mutationBody(request));
    if (!result.success) throw new IntelligenceError('Review your footage request and approval.');
    const input = result.data;
    if (input.action === 'quote') {
      const { action: _action, ...brief } = input;
      void _action;
      return privateJson(await quoteFootage(brief), 201);
    }
    return privateJson(
      input.action === 'start'
        ? await startFootage(input.id, input.projectId, input.estimate)
        : await checkFootage(input.id, input.projectId),
    );
  } catch (error) {
    return apiError(error);
  }
}
