import { memoryInput, memoryDeleteInput } from '@/domains/intelligence/validation';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
export async function POST(request: Request) {
  try {
    const parsed = memoryInput.safeParse(await mutationBody(request));
    if (!parsed.success) throw new IntelligenceError('Use 1–500 characters for this memory.');
    const { client } = await intelligenceSession();
    const input = parsed.data;
    const result = await client.rpc('ai_save_memory', {
      p_id: input.id,
      p_content: input.content,
      p_kind: input.kind,
      p_version: input.version,
    });
    if (result.error)
      throw new IntelligenceError(
        result.error.code === 'P0001'
          ? 'You can keep 24 confirmed memories. Edit or remove one first.'
          : 'Memory changed or could not be saved. Reload before retrying.',
        409,
      );
    return privateJson({ saved: true, version: result.data });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const parsed = memoryDeleteInput.safeParse(await mutationBody(request));
    if (!parsed.success) throw new IntelligenceError('Invalid memory.');
    const { client } = await intelligenceSession();
    const result = await client.rpc('ai_delete_memory', {
      p_id: parsed.data.id,
      p_version: parsed.data.version,
    });
    if (result.error || !result.data)
      throw new IntelligenceError(
        'Memory changed or could not be deleted. Reload before retrying.',
        409,
      );
    return privateJson({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
