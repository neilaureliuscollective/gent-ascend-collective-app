import { z } from 'zod';
import '@/domains/talk-creation/architect-source';
import { receiveDesignDirectionCommand } from '@/domains/architect-design-direction/contract';
import { readRetainedDirection, receiveDesignDirection } from '@/domains/architect-design-direction/receiver';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

export async function GET(request: Request) {
  try {
    const project = new URL(request.url).searchParams.get('project');
    if (!project || !z.uuid().safeParse(project).success) throw new IntelligenceError('Invalid project.');
    const retained = await readRetainedDirection(project);
    return privateJson({
      direction: retained,
      started: false,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = receiveDesignDirectionCommand.safeParse(await mutationBody(request, 40000));
    if (!input.success)
      throw new IntelligenceError('Check the design-direction identity, copy bounds and receipt fields.');
    const retained = await receiveDesignDirection(input.data);
    return privateJson({
      projectId: retained.project_id,
      requestId: retained.request_id,
      revision: retained.revision,
      digest: retained.digest,
      started: false,
    });
  } catch (error) {
    return apiError(error);
  }
}
