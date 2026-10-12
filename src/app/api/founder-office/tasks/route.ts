import { taskSave, taskGenerate, saveTaskPlan, prepareTask } from '@/domains/founder-office/tasks';
import { mutationBody, privateJson, apiError } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const body = await mutationBody(request, 65536);
    const save = taskSave.safeParse(body);
    if (save.success) return privateJson(await saveTaskPlan(save.data));
    const generate = taskGenerate.safeParse(body);
    if (generate.success) return privateJson(await prepareTask(generate.data, request.signal));
    throw new IntelligenceError('Check the task plan or generation request.');
  } catch (error) {
    return apiError(error);
  }
}
