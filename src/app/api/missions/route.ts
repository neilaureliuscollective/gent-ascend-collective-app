import { z } from 'zod';
import { createMissionInput, updateMissionInput } from '@/domains/missions/schema';
import { createMission, readMissions, updateMission } from '@/domains/missions/service';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('conversation');
    if (id && !z.uuid().safeParse(id).success) throw new IntelligenceError('Invalid conversation.');
    return privateJson({ missions: await readMissions(id ?? undefined) });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = createMissionInput.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Check the Mission objective and fields.');
    return privateJson({ mission: await createMission(input.data) });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const input = updateMissionInput.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Invalid Mission update.');
    return privateJson({ mission: await updateMission(input.data) });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const input = z
      .object({ id: z.uuid(), expected_revision: z.number().int().positive() })
      .strict()
      .safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Invalid Mission.');
    const { client, person } = await intelligenceSession();
    const result = await client
      .from('intelligence_missions')
      .delete()
      .eq('person_id', person.id)
      .eq('id', input.data.id)
      .eq('revision', input.data.expected_revision)
      .select('id');
    if (result.error || !result.data?.length)
      throw new IntelligenceError(
        'Mission changed or deletion was not confirmed. Reload first.',
        409,
      );
    return privateJson({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
