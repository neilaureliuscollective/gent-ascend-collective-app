import { z } from 'zod';
import {
  approveArchitectApp,
  cancelArchitectApp,
  proposeArchitectApp,
  readArchitectApp,
  reopenArchitectApp,
  startArchitectApp,
} from '@/domains/architect-apps/service';
import { appCommand } from '@/domains/architect-apps/schema';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

export async function GET(request: Request) {
  try {
    const project = new URL(request.url).searchParams.get('project');
    if (!project || !z.uuid().safeParse(project).success) throw new IntelligenceError('Invalid project.');
    return privateJson(await readArchitectApp(project));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = appCommand.safeParse(await mutationBody(request, 200000));
    if (!input.success) throw new IntelligenceError('Check the application fields and content bounds.');
    if (input.data.action === 'propose') return privateJson(await proposeArchitectApp(input.data));
    if (input.data.action === 'approve') return privateJson(await approveArchitectApp(input.data));
    if (input.data.action === 'start') return privateJson({ job: await startArchitectApp(input.data) });
    if (input.data.action === 'reopen') return privateJson(await reopenArchitectApp(input.data));
    return privateJson({ job: await cancelArchitectApp(input.data) });
  } catch (error) {
    return apiError(error);
  }
}
