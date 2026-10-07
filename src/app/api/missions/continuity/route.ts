import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { continuityAction } from '@/domains/missions/continuity-schema';
import { readMissionContinuity, missionContinuityAction } from '@/domains/missions/continuity';
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const id = z.uuid().safeParse(new URL(request.url).searchParams.get('id'));
    if (!id.success) throw new IntelligenceError('Invalid Mission.');
    return privateJson(await readMissionContinuity(id.data));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = continuityAction.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Check the Mission request.');
    return privateJson(await missionContinuityAction(input.data));
  } catch (error) {
    return apiError(error);
  }
}
