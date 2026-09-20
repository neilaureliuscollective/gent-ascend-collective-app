import { feedbackInput } from '@/domains/intelligence/validation';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
export async function POST(request: Request) {
  try {
    const parsed = feedbackInput.safeParse(await mutationBody(request));
    if (!parsed.success) throw new IntelligenceError('Invalid feedback.');
    const { client, person } = await intelligenceSession();
    const result = await client
      .from('ai_turns')
      .update({ feedback: parsed.data.feedback })
      .eq('id', parsed.data.id)
      .eq('person_id', person.id)
      .eq('status', 'complete')
      .select('id');
    if (result.error || !result.data?.length)
      throw new IntelligenceError('Feedback could not be saved.', 409);
    return privateJson({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
