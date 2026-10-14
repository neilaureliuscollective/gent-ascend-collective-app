import { appDataCommand } from '@/domains/architect-apps/schema';
import { operateArchitectAppData } from '@/domains/architect-apps/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';

export async function POST(request: Request) {
  try {
    const input = appDataCommand.safeParse(await mutationBody(request, 16000));
    if (!input.success) throw new IntelligenceError('Check the host collection request.');
    return privateJson(await operateArchitectAppData(input.data));
  } catch (error) {
    return apiError(error);
  }
}
