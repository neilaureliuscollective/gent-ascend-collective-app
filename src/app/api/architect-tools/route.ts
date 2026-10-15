import { z } from 'zod';
import { toolCommand } from '@/domains/architect-tools/schema';
import { invokeArchitectTool, readArchitectTools, saveArchitectTool } from '@/domains/architect-tools/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const project = params.get('project');
    const tool = params.get('tool');
    if (!project || !z.uuid().safeParse(project).success)
      throw new IntelligenceError('Invalid project.');
    if (tool && !z.uuid().safeParse(tool).success) throw new IntelligenceError('Invalid tool.');
    return privateJson(await readArchitectTools(project, tool ?? undefined));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = toolCommand.safeParse(await mutationBody(request, 40000));
    if (!input.success) throw new IntelligenceError('Check the tool fields, quantities and content bounds.');
    return privateJson(
      input.data.action === 'save' ? await saveArchitectTool(input.data) : await invokeArchitectTool(input.data),
    );
  } catch (error) {
    return apiError(error);
  }
}
