import { z } from 'zod';
import { constructCommand } from '@/domains/architect-construct/schema';
import {
  approveConstructChange,
  approveRepairConstruct,
  cancelConstruct,
  proposeConstruct,
  proposeRepairConstruct,
  readConstruct,
  startConstruct,
  startFixtureConstruct,
} from '@/domains/architect-construct/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const project = new URL(request.url).searchParams.get('project');
    if (!project || !z.uuid().safeParse(project).success)
      throw new IntelligenceError('Invalid project.');
    return privateJson(await readConstruct(project));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = constructCommand.safeParse(await mutationBody(request, 20000));
    if (!input.success) throw new IntelligenceError('Check the construct request fields.');
    if (input.data.action === 'start') return privateJson({ run: await startConstruct(input.data) });
    if (input.data.action === 'start-fixture')
      return privateJson({ run: await startFixtureConstruct(input.data) });
    if (input.data.action === 'propose')
      return privateJson(await proposeConstruct(input.data, request.signal));
    if (input.data.action === 'approve-change')
      return privateJson(await approveConstructChange(input.data));
    if (input.data.action === 'propose-repair')
      return privateJson(await proposeRepairConstruct(input.data, request.signal));
    if (input.data.action === 'approve-repair')
      return privateJson(await approveRepairConstruct(input.data));
    return privateJson({ run: await cancelConstruct(input.data) });
  } catch (error) {
    return apiError(error);
  }
}
