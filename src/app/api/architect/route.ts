import { z } from 'zod';
import { mutationBody, privateJson, apiError } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { architectInput } from '@/domains/architect/schema';
import {
  listProjects,
  readProject,
  saveProject,
  deleteProject,
  generateProject,
} from '@/domains/architect/service';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const query = z
      .object({ projectId: z.uuid().optional() })
      .strict()
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) throw new IntelligenceError('Choose a valid project.');
    return privateJson(
      query.data.projectId ? await readProject(query.data.projectId) : await listProjects(),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const parsed = architectInput.safeParse(await mutationBody(request, 200000));
    if (!parsed.success)
      throw new IntelligenceError('Check the project request and explicit AI consent.');
    const input = parsed.data;
    if (input.action === 'save')
      return privateJson(
        await saveProject(input.projectId, input.versionId, input.expected, input.content),
      );
    if (input.action === 'delete') return privateJson(await deleteProject(input.projectId));
    return privateJson(await generateProject(input, request.signal));
  } catch (error) {
    return apiError(error);
  }
}
