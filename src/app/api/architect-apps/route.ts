import { z } from 'zod';
import {
  approveArchitectApp,
  cancelArchitectApp,
  proposeArchitectApp,
  readArchitectApp,
  reopenArchitectApp,
  startArchitectApp,
} from '@/domains/architect-apps/service';
import { classifyAppRequestFailure } from '@/domains/architect-apps/generation-policy';
import { appCommand } from '@/domains/architect-apps/schema';
import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

function appsApiError(error: unknown) {
  const classified = classifyAppRequestFailure(error);
  return privateJson(
    {
      error: classified.message,
      class: classified.class,
    },
    error instanceof IntelligenceError ? error.status : 503,
  );
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const project = params.get('project');
    const selected = params.get('selected');
    if (!project || !z.uuid().safeParse(project).success) throw new IntelligenceError('Invalid project.');
    const revision = selected && /^\d+$/.test(selected) ? Number(selected) : undefined;
    return privateJson(await readArchitectApp(project, revision));
  } catch (error) {
    return appsApiError(error);
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
    return appsApiError(error);
  }
}
