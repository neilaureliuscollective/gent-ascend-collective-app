import { z } from 'zod';
import { originCommand } from '@/domains/architect-origin/schema';
import { readOrigin, saveOrigin, generateOrigin } from '@/domains/architect-origin/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const project = new URL(request.url).searchParams.get('project');
    if (project && !z.uuid().safeParse(project).success)
      throw new IntelligenceError('Invalid project.');
    const before = z.coerce
      .number()
      .int()
      .min(1)
      .max(501)
      .safeParse(new URL(request.url).searchParams.get('before') ?? 501);
    if (!before.success) throw new IntelligenceError('Invalid history page.');
    return privateJson(await readOrigin(project ?? undefined, before.data));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = originCommand.safeParse(await mutationBody(request, 120000));
    if (!input.success) throw new IntelligenceError('Check the project fields and content bounds.');
    return privateJson(
      input.data.action === 'save'
        ? await saveOrigin(input.data)
        : { run: await generateOrigin(input.data, request.signal) },
    );
  } catch (error) {
    return apiError(error);
  }
}
