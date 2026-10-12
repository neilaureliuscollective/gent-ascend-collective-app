import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { narrationInput } from '@/domains/studio/narration';
import {
  generateNarration,
  narrationWorkspace,
  recoverNarration,
} from '@/domains/studio/narration-service';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function GET(request: Request) {
  try {
    const project = z.uuid().safeParse(new URL(request.url).searchParams.get('project'));
    if (!project.success) throw new IntelligenceError('Choose a project.');
    return privateJson(await narrationWorkspace(project.data));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = await mutationBody(request);
    const recovery = z
      .object({ action: z.literal('recover'), id: z.uuid(), projectId: z.uuid() })
      .strict()
      .safeParse(body);
    if (recovery.success)
      return privateJson(await recoverNarration(recovery.data.id, recovery.data.projectId));
    const input = narrationInput.safeParse(body);
    if (!input.success) throw new IntelligenceError('Review and approve your narration request.');
    return privateJson(await generateNarration(input.data), 201);
  } catch (error) {
    return apiError(error);
  }
}
