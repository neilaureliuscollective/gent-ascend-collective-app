import { idInput } from '@/domains/intelligence/validation';
import {
  intelligenceSession,
  readWorkspace,
  IntelligenceError,
} from '@/domains/intelligence/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
export async function GET(request: Request) {
  try {
    const value = new URL(request.url).searchParams.get('conversationId');
    if (value && !idInput.safeParse(value).success)
      throw new IntelligenceError('Invalid conversation.');
    return privateJson(await readWorkspace(value ?? undefined));
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const body = await mutationBody(request);
    const id = idInput.safeParse((body as { id?: unknown })?.id);
    if (!id.success) throw new IntelligenceError('Invalid conversation.');
    const { client, person } = await intelligenceSession();
    const result = await client
      .from('ai_conversations')
      .delete()
      .eq('id', id.data)
      .eq('person_id', person.id)
      .select('id');
    if (result.error) throw new IntelligenceError('Conversation could not be deleted.', 503);
    if (!result.data?.length) throw new IntelligenceError('Conversation not found.', 404);
    return privateJson({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
